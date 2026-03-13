require('dotenv').config();
const mqtt = require('mqtt');
const Redis = require('ioredis');
const { prisma } = require('@obu-system/database');
const { parseObuMessage, determineVehicleStatus } = require('./parser');

console.log('Starting Service: MQTT Ingestion');

const redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redisPublisher.on('connect', () => console.log('Redis Publisher Connected'));

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
    mqttClient.subscribe('#', (err) => {
        if (!err) {
            console.log('Listening to OBU data stream (topic #)...');
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

    const imei = topic.replace(':', '').trim();
    if (!imei) return;

    const longitude = parseFloat(payload.long) || 0;
    const latitude = parseFloat(payload.lat) || 0;
    const speed = parseFloat(payload.car_speed) || 0;
    const rpm = parseInt(payload.car_rpm) || 0;
    const fuel = parseFloat(payload.car_fuel_level) || 0;
    const coolantTemp = parseFloat(payload.car_coolant_temp) || 0;
    const throttle = parseFloat(payload.car_throttle) || 0;
    const direction = parseFloat(payload.direction) || 0;

    const status = determineVehicleStatus(rpm, speed);

    try {
        let vehicle = await prisma.vehicle.findUnique({ where: { imei } });
        
        if (!vehicle) {
            vehicle = await prisma.vehicle.create({
                data: { imei, type: '', licensePlate: `New Car ${imei}` }
            });
            console.log(`Registered new vehicle: ${imei}`);
        }

        const vehicleId = vehicle.id;

        await prisma.$executeRaw`
            UPDATE vehicles 
            SET "current_location" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
                "current_status" = ${status}::"VehicleStatus",
                "engine_rpm" = ${rpm},
                "speed_kmh" = ${speed},
                "fuel_level" = ${fuel},
                "coolant_temp" = ${coolantTemp},
                "throttle" = ${throttle},
                "direction" = ${direction},
                "last_updated_at" = NOW()
            WHERE "id" = ${vehicleId};
        `;

        await prisma.$executeRaw`
            INSERT INTO journey_logs ("vehicle_id", "location", "speed", "rpm", "fuel_level", "coolant_temp", "throttle", "direction", "engine_status", "timestamp")
            VALUES (
                ${vehicleId}, 
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326), 
                ${speed}, 
                ${rpm}, 
                ${fuel},
                ${coolantTemp},
                ${throttle},
                ${direction},
                ${status === 'RUNNING'}, 
                NOW()
            );
        `;

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
        console.error(`Local insertion error for vehicle ${imei}:`, error);
    }
});

process.on('SIGINT', async () => {
    console.log('Shutting down Database connection...');
    await prisma.$disconnect();
    redisPublisher.quit();
    mqttClient.end();
    process.exit(0);
});
