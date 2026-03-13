const express = require('express');
const { prisma } = require('@obu-system/database');
const router = express.Router();

/**
 * GET /api/vehicles
 * Returns a list of all vehicles with their LATEST coordinates and status.
 * This query is extremely fast because it targets the snapshot `vehicles` table.
 */
router.get('/', async (req, res) => {
    try {
        // We use raw SQL to specifically extract X, Y from the PostGIS geometry point.
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
        // Ensure the vehicle exists
        const vehicle = await prisma.vehicle.findUnique({ where: { imei } });
        if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

        // Query the massive journey_logs table. PostGIS extraction for raw Point objects.
        const history = await prisma.$queryRaw`
            SELECT 
                speed, 
                rpm, 
                fuel_level as "fuel",
                coolant_temp as "coolantTemp",
                throttle,
                direction,
                "timestamp", 
                ST_X(location) as lng, 
                ST_Y(location) as lat
            FROM journey_logs
            WHERE vehicle_id = ${vehicle.id}
              AND "timestamp" >= ${new Date(start)}
              AND "timestamp" <= ${new Date(end)}
              AND location IS NOT NULL
              AND (ST_X(location) != 0 AND ST_Y(location) != 0)
            ORDER BY "timestamp" ASC;
        `;

        // Tính tổng quãng đường bằng PostGIS
        const totalDistanceQuery = await prisma.$queryRaw`
            SELECT ST_Length(
                ST_MakeLine(location::geometry)::geography
            ) / 1000 as "totalKm"
            FROM (
                SELECT location 
                FROM journey_logs
                WHERE vehicle_id = ${vehicle.id}
                  AND "timestamp" >= ${new Date(start)}
                  AND "timestamp" <= ${new Date(end)}
                  AND location IS NOT NULL
                  AND (ST_X(location) != 0 AND ST_Y(location) != 0)
                ORDER BY "timestamp" ASC
            ) AS ordered_logs
        `;

        const totalKm = totalDistanceQuery.length > 0 && totalDistanceQuery[0].totalKm 
            ? parseFloat(totalDistanceQuery[0].totalKm).toFixed(2) 
            : 0;

        res.json({ success: true, count: history.length, totalKm: parseFloat(totalKm), data: history });
    } catch (error) {
        console.error(`API /history error for ${imei}:`, error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * GET /api/vehicles/:imei/check
 * Verify if the vehicle exists and is actively streaming data (updated within 5 mins).
 * Returns the latest stats or offline notice.
 */
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
        
        // Cần đảm bảo thiết bị có dữ liệu lat lng hợp lệ
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

/**
 * POST /api/vehicles
 * Manually register a new vehicle or update license plate mapping
 */
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

/**
 * PUT /api/vehicles/:imei
 * Update a vehicle's basic details
 */
router.put('/:imei', async (req, res) => {
    const { imei } = req.params;
    const { licensePlate, type } = req.body;
    try {
        const vehicle = await prisma.vehicle.update({
            where: { imei },
            data: { licensePlate, type }
        });
        res.json({ success: true, data: vehicle });
    } catch (error) {
        console.error('API PUT error:', error);
        res.status(500).json({ success: false, message: 'Database Update Error' });
    }
});

/**
 * DELETE /api/vehicles/:imei
 * Delete a vehicle. Due to Prisma Cascade setup, 
 * this also deletes ALL related JourneyLogs automatically.
 */
router.delete('/:imei', async (req, res) => {
    const { imei } = req.params;
    try {
        await prisma.vehicle.delete({
            where: { imei }
        });
        res.json({ success: true, message: 'Vehicle and related logs successfully deleted' });
    } catch (error) {
        console.error('API DELETE error:', error);
        // Prisma throws error if record not found
        res.status(500).json({ success: false, message: 'Vehicle deletion failed. It may not exist.' });
    }
});

module.exports = router;
