require('dotenv').config();
const mqtt = require('mqtt');
const Redis = require('ioredis');
const { prisma } = require('@obu-system/database');
const { parseObuMessage, determineVehicleStatus } = require('./parser');

console.log('Starting Service: MQTT Ingestion');

const redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redisPublisher.on('connect', () => console.log('Redis Publisher Connected'));

// Vehicle ID cache (TTL: 30 min)
const CACHE_TTL_MS = 30 * 60 * 1000;
const vehicleCache = new Map();
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
    // Prefer car_speed (OBD) over GPS speed
    const carSpeed = parseFloat(payload.car_speed);
    const gpsSpeed = parseFloat(payload.speed);
    let speed = !isNaN(carSpeed) && carSpeed > 0 ? carSpeed : (!isNaN(gpsSpeed) ? gpsSpeed : 0);
    const rpm = parseInt(payload.car_rpm) || 0;
    const fuel = parseFloat(payload.car_fuel_level) || 0;
    const coolantTemp = parseFloat(payload.car_coolant_temp) || 0;
    const throttle = parseFloat(payload.car_throttle) || 0;
    let direction = parseFloat(payload.dir) || 0;
    const carResponse = payload.car_response;

    if (direction < 0 || direction >= 360) direction = 0;

    const status = determineVehicleStatus(rpm, speed, carResponse);

    // Filter invalid GPS coordinates
    const isValidGPS = !isNaN(latitude) && !isNaN(longitude) && (Math.abs(latitude) > 0.1 && Math.abs(longitude) > 0.1);
    if (!isValidGPS) {
        longitude = null;
        latitude = null;
    }

    try {
        const cached = vehicleCache.get(imei);
        const isExpired = cached && (Date.now() - cached.cachedAt > CACHE_TTL_MS);

        let vehicleId;
        if (cached && !isExpired) {
            vehicleId = cached.id;
        } else {
            let vehicle = await prisma.vehicle.findUnique({ where: { imei } });

            if (!vehicle) {
                console.log(`[Drop] Ignored payload for unregistered vehicle: ${imei}`);
                if (isExpired) vehicleCache.delete(imei);
                return;
            }
            vehicleId = vehicle.id;
            vehicleCache.set(imei, { id: vehicleId, cachedAt: Date.now() });
        }

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

// Flush buffer to database every 2 seconds
setInterval(async () => {
    if (journeyLogsBuffer.length === 0) return;

    const batchToInsert = [...journeyLogsBuffer];
    journeyLogsBuffer.length = 0;

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

    let attempt = 0;
    while (attempt < 3) {
        try {
            await prisma.$executeRawUnsafe(query);
            console.log(`[Batch Insert] OK: ${batchToInsert.length} logs.`);
            break;
        } catch (error) {
            attempt++;
            if (attempt >= 3) {
                console.error(`[Batch Insert] FAILED after 3 attempts. ${batchToInsert.length} logs dropped.`, error.message);
            } else {
                console.warn(`[Batch Insert] Retry ${attempt}/3 in ${attempt * 500}ms...`);
                await new Promise(r => setTimeout(r, attempt * 500));
            }
        }
    }
}, 2000);

process.on('SIGINT', async () => {
    console.log('Shutting down Database connection...');
    await prisma.$disconnect();
    redisPublisher.quit();
    mqttClient.end();
    process.exit(0);
});
