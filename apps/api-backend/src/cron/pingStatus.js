const { prisma } = require('@obu-system/database');
const mqtt = require('mqtt');
const cron = require('node-cron');
const Redis = require('ioredis');

const redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const mqttOptions = {
    clientId: `obu_ping_cron_${Math.random().toString(16).substr(2, 8)}`,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clean: true
};
const mqttUrl = `${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`;
const mqttClient = mqtt.connect(mqttUrl, mqttOptions);

mqttClient.on('connect', () => {
    console.log('[CRON] MQTT Connected for Watchdog Ping.');
});

// Chạy tự động mỗi 3 phút
cron.schedule('*/3 * * * *', async () => {
    console.log('[CRON] Running Vehicle Status Watchdog...');
    try {
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);

        // 1. Mark as completely OFFLINE if no signal for > 10 mins
        const deadVehicles = await prisma.vehicle.findMany({
            where: {
                lastUpdatedAt: { lt: tenMinutesAgo },
                currentStatus: { not: 'OFFLINE' }
            }
        });

        if (deadVehicles.length > 0) {
            const deadIds = deadVehicles.map(v => v.id);
            await prisma.vehicle.updateMany({
                where: { id: { in: deadIds } },
                data: { 
                    currentStatus: 'OFFLINE',
                    speedKmh: 0,
                    engineRpm: 0,
                    fuelLevel: 0,
                    throttle: 0,
                }
            });
            console.log(`[CRON] Marked ${deadVehicles.length} vehicles as OFFLINE.`);

            // Push to Redis to notify Frontend
            for (const v of deadVehicles) {
                redisPublisher.publish('OBU_REALTIME_STREAM', JSON.stringify({
                    imei: v.imei,
                    status: 'OFFLINE'
                }));
            }
        }

        // 2. Ping vehicles that are PARKED or haven't sent data in the last 3 mins (but < 10 mins)
        // Or we just ping anything hasn't sent data in 3 mins, to prompt them.
        const sleepingVehicles = await prisma.vehicle.findMany({
            where: {
                lastUpdatedAt: { lt: threeMinutesAgo, gte: tenMinutesAgo },
                currentStatus: { not: 'OFFLINE' }
            }
        });

        if (sleepingVehicles.length > 0) {
            console.log(`[CRON] Pinging ${sleepingVehicles.length} sleeping/parked vehicles...`);
            for (const v of sleepingVehicles) {
                // Publish MQTT message to prompt OBU to send response
                mqttClient.publish(`obuv1/${v.imei}`, 'check_status');
            }
        }

    } catch (error) {
        console.error('[CRON] Watchdog Error:', error);
    }
});

console.log('[CRON] Vehicle Status Watchdog initialized. Will run every 3 minutes.');
