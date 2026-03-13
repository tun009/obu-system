require('dotenv').config();
const mqtt = require('mqtt');
const Redis = require('ioredis');
const { prisma } = require('@obu-system/database');
const { parseObuMessage, determineVehicleStatus } = require('./parser');

console.log('Starting Service: MQTT Ingestion');

const redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redisPublisher.on('connect', () => console.log('Redis Publisher Connected'));

// Memory Cache for Vehicle IDs to prevent excessive DB queries
const vehicleCache = new Map();
// Buffer array for batch inserting logs to prevent Database Connection Pool Exhaustion
const journeyLogsBuffer = [];

const mqttOptions = {
    clientId: process.env.MQTT_CLIENT_ID || `obu_backend_${Math.random().toString(16).substr(2, 8)}`,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clean: true
};
const mqttUrl = `${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`;
const mqttClient = mqtt.connect(mqttUrl, mqttOptions);

mqttClient.on('connect', () => {
    console.log(`MQTT Connected to Broker: ${mqttUrl}`);
    mqttClient.subscribe('obuv1/+', (err) => {
        if (!err) {
            console.log('Listening to OBU data stream (topic obuv1/+)...');
        }
    });
});

mqttClient.on('error', (err) => {
    console.error('MQTT Connection Error:', err);
});

mqttClient.on('message', async (topic, message) => {
    const rawData = message.toString();
    const payload = parseObuMessage(rawData);

    if (!payload) return;

    const topicParts = topic.split('/');
    if (topicParts.length !== 2 || topicParts[0] !== 'obuv1') return;
    
    const imei = topicParts[1].trim();
    if (!imei) return;

    let longitude = parseFloat(payload.long);
    let latitude = parseFloat(payload.lat);
    const speed = parseFloat(payload.car_speed) || 0;
    const rpm = parseInt(payload.car_rpm) || 0;
    const fuel = parseFloat(payload.car_fuel_level) || 0;
    const coolantTemp = parseFloat(payload.car_coolant_temp) || 0;
    const throttle = parseFloat(payload.car_throttle) || 0;
    const direction = parseFloat(payload.direction) || 0;
    const carResponse = payload.car_response;

    const status = determineVehicleStatus(rpm, speed, carResponse);

    // Filter invalid 0,0 GPS coordinates (both must be valid -> use &&)
    const isValidGPS = !isNaN(latitude) && !isNaN(longitude) && (Math.abs(latitude) > 0.1 && Math.abs(longitude) > 0.1);
    if (!isValidGPS) {
        longitude = null;
        latitude = null;
    }

    try {
        // --- 1. In-Memory Vehicle Cache ---
        let vehicleId = vehicleCache.get(imei);
        if (!vehicleId) {
            let vehicle = await prisma.vehicle.findUnique({ where: { imei } });
            
            // Drop message if vehicle is completely unknown (no more auto-creation)
            if (!vehicle) {
                console.log(`[Drop] Ignored payload for unregistered vehicle: ${imei}`);
                return;
            }
            vehicleId = vehicle.id;
            vehicleCache.set(imei, vehicleId);
        }

        // --- 2. Update Latest State (Vehicles Table) ---
        // For current_location, if invalid, we might want to keep the old one or set to NULL. Since requirements state to filter them, we set to NULL so it's accurate.
        const locationSql = isValidGPS 
            ? `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)` 
            : `NULL`;

        await prisma.$executeRawUnsafe(`
            UPDATE vehicles 
            SET "current_location" = ${locationSql},
                "current_status" = '${status}'::"VehicleStatus",
                "engine_rpm" = ${rpm},
                "speed_kmh" = ${speed},
                "fuel_level" = ${fuel},
                "coolant_temp" = ${coolantTemp},
                "throttle" = ${throttle},
                "direction" = ${direction},
                "last_updated_at" = NOW()
            WHERE "id" = ${vehicleId};
        `);

        // --- 3. Batch Journey Logs (Buffer) ---
        journeyLogsBuffer.push({
            vehicleId,
            longitude,
            latitude,
            isValidGPS,
            speed,
            rpm,
            fuel,
            coolantTemp,
            throttle,
            direction,
            engineStatus: status === 'RUNNING',
            timestamp: new Date().toISOString()
        });

        // --- 4. Real-time Pub/Sub ---
        const realTimePing = JSON.stringify({
            imei: imei,
            lat: latitude,
            lng: longitude,
            speed: speed,
            rpm: rpm,
            fuel: fuel,
            direction: direction,
            status: status
        });
        
        redisPublisher.publish('OBU_REALTIME_STREAM', realTimePing);

    } catch (error) {
        console.error(`Local processing error for vehicle ${imei}:`, error);
    }
});

// --- FLUSH BUFFER TO DATABASE EVERY 2 SECONDS ---
setInterval(async () => {
    if (journeyLogsBuffer.length === 0) return;

    // Take a snapshot of the buffer and clear it immediately
    const batchToInsert = [...journeyLogsBuffer];
    journeyLogsBuffer.length = 0;

    try {
        // Build raw SQL for bulk insertion
        const values = batchToInsert.map(log => {
            const geom = log.isValidGPS 
                ? `ST_SetSRID(ST_MakePoint(${log.longitude}, ${log.latitude}), 4326)` 
                : `NULL`;
            
            return `(
                ${log.vehicleId}, 
                ${geom}, 
                ${log.speed}, 
                ${log.rpm}, 
                ${log.fuel},
                ${log.coolantTemp},
                ${log.throttle},
                ${log.direction},
                ${log.engineStatus}, 
                '${log.timestamp}'::timestamptz
            )`;
        }).join(',');

        const query = `
            INSERT INTO journey_logs (
                "vehicle_id", "location", "speed", "rpm", "fuel_level", 
                "coolant_temp", "throttle", "direction", "engine_status", "timestamp"
            ) VALUES ${values};
        `;

        await prisma.$executeRawUnsafe(query);
        console.log(`[Batch Insert] Successfully ingested ${batchToInsert.length} logs.`);
    } catch (error) {
        console.error('[Batch Insert Error] Failed to insert logs:', error);
        // Fallback: put them back to buffer or save to dead letter queue, but for now we log it.
    }
}, 2000);

process.on('SIGINT', async () => {
    console.log('Shutting down Database connection...');
    await prisma.$disconnect();
    redisPublisher.quit();
    mqttClient.end();
    process.exit(0);
});
