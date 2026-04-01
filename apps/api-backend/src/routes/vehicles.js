const express = require('express');
const { prisma } = require('@obu-system/database');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const vehicles = await prisma.$queryRaw`
            SELECT 
                id, 
                imei, 
                license_plate as "licensePlate", 
                type, 
                current_status as "status", 
                engine_rpm as "rpm", 
                speed_kmh as "speed",
                fuel_level as "fuel",
                coolant_temp as "coolantTemp",
                throttle,
                direction,
                ST_X(current_location) as lng, 
                ST_Y(current_location) as lat,
                last_updated_at as "lastUpdate"
            FROM vehicles
            ORDER BY last_updated_at DESC;
        `;
        
        res.json({ success: true, count: vehicles.length, data: vehicles });
    } catch (error) {
        console.error('API /vehicles error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * GET /api/vehicles/:imei/history
 * Returns the journey polyline data for a specific vehicle within a time range.
 * Expects query params: ?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Efficiently uses the `journey_logs` partitioned hypertable.
 */
router.get('/:imei/history', async (req, res) => {
    const { imei } = req.params;
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ success: false, message: 'Missing start or end date query params' });
    }

    try {
        const vehicle = await prisma.vehicle.findUnique({ where: { imei } });
        if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

        // Strip Z to prevent Postgres timezone shift
        const startString = new Date(start).toISOString().replace('Z', '');
        const endString = new Date(end).toISOString().replace('Z', '');

        const history = await prisma.$queryRaw`
            SELECT 
                speed, 
                rpm, 
                fuel_level as "fuel",
                coolant_temp as "coolantTemp",
                throttle,
                direction,
                to_char("timestamp", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "timestamp", 
                CASE WHEN location IS NOT NULL AND (ST_X(location) != 0 AND ST_Y(location) != 0) THEN ST_X(location) ELSE NULL END as lng, 
                CASE WHEN location IS NOT NULL AND (ST_X(location) != 0 AND ST_Y(location) != 0) THEN ST_Y(location) ELSE NULL END as lat
            FROM journey_logs
            WHERE vehicle_id = ${vehicle.id}
              AND "timestamp" >= ${startString}::timestamp
              AND "timestamp" <= ${endString}::timestamp
            ORDER BY "timestamp" ASC;
        `;

        const totalDistanceQuery = await prisma.$queryRaw`
            SELECT ST_Length(
                ST_MakeLine(location::geometry)::geography
            ) / 1000 as "totalKm"
            FROM (
                SELECT location 
                FROM journey_logs
                WHERE vehicle_id = ${vehicle.id}
                  AND "timestamp" >= ${startString}::timestamp
                  AND "timestamp" <= ${endString}::timestamp
                  AND (ST_X(location) != 0 AND ST_Y(location) != 0)
                ORDER BY "timestamp" ASC
            ) AS ordered_logs
        `;

        const totalKm = totalDistanceQuery.length > 0 && totalDistanceQuery[0].totalKm 
            ? parseFloat(totalDistanceQuery[0].totalKm).toFixed(2) 
            : 0;

        res.json({ success: true, count: history.length, totalKm: parseFloat(totalKm), data: history });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/:imei/check', async (req, res) => {
    const { imei } = req.params;
    try {
        const vehicles = await prisma.$queryRaw`
            SELECT 
                id, 
                imei, 
                current_status as "status", 
                speed_kmh as "speed",
                ST_X(current_location) as lng, 
                ST_Y(current_location) as lat,
                last_updated_at as "lastUpdate"
            FROM vehicles
            WHERE imei = ${imei}
        `;

        if (vehicles.length === 0) {
            return res.json({ success: false, status: 'error', message: 'Thiết bị không tồn tại trong hệ thống' });
        }

        const vehicle = vehicles[0];

        if (vehicle.lat == null || vehicle.lng == null) {
            return res.json({ success: false, status: 'error', message: 'Thiết bị chưa có dữ liệu GPS hợp lệ' });
        }

        const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
        const isActive = new Date(vehicle.lastUpdate) > FIVE_MINUTES_AGO;

        if (isActive && vehicle.status !== 'OFFLINE' && vehicle.status !== 'LOST_SIGNAL') {
            res.json({ 
                success: true, 
                status: 'success', 
                data: vehicle 
            });
        } else {
            res.json({ success: false, status: 'error', message: 'Thiết bị đang offline hoặc mất tín hiệu GPS quá lâu' });
        }
    } catch (error) {
        console.error('API CHECK error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    const { imei, licensePlate, type } = req.body;
    if (!imei) return res.status(400).json({ success: false, message: 'IMEI is required' });

    try {
        const vehicle = await prisma.vehicle.upsert({
            where: { imei },
            update: { licensePlate, type },
            create: { imei, licensePlate, type, currentStatus: 'OFFLINE' }
        });
        res.json({ success: true, data: vehicle });
    } catch (error) {
        console.error('API POST error:', error);
        res.status(500).json({ success: false, message: 'Database Write Error' });
    }
});

router.put('/:imei', async (req, res) => {
    const { imei } = req.params;
    const { imei: newImei, licensePlate, type } = req.body;
    try {
        const updateData = { licensePlate, type };
        if (newImei && newImei !== imei) {
            updateData.imei = newImei;
        }
        const vehicle = await prisma.vehicle.update({
            where: { imei },
            data: updateData
        });
        res.json({ success: true, data: vehicle });
    } catch (error) {
        console.error('API PUT error:', error);
        res.status(500).json({ success: false, message: 'Database Update Error' });
    }
});

router.delete('/:imei', async (req, res) => {
    const { imei } = req.params;
    try {
        await prisma.vehicle.delete({
            where: { imei }
        });
        res.json({ success: true, message: 'Vehicle and related logs successfully deleted' });
    } catch (error) {
        console.error('API DELETE error:', error);
        res.status(500).json({ success: false, message: 'Vehicle deletion failed. It may not exist.' });
    }
});

module.exports = router;
