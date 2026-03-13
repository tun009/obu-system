require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { prisma } = require('@obu-system/database');
const setupSocketHub = require('./socketHub');
const vehicleRoutes = require('./routes/vehicles');

const app = express();
app.use(cors());
app.use(express.json());

// Mount REST APIs
app.use('/api/vehicles', vehicleRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'OBU Backend API & Socket Service v1.0.0 is running' });
});

// Setup HTTP Server with Socket.io integration
const server = http.createServer(app);
setupSocketHub(server);

// Automated Guard System (Cronjob: runs every 60 seconds)
// Function: Scans all vehicles. If a vehicle hasn't pinged coordinates for > 10 mins -> Mark as LOST_SIGNAL
setInterval(async () => {
    try {
        const result = await prisma.$executeRaw`
            UPDATE vehicles
            SET current_status = 'LOST_SIGNAL'::"VehicleStatus"
            WHERE current_status != 'LOST_SIGNAL'::"VehicleStatus"
              AND last_updated_at < NOW() - INTERVAL '10 minutes';
        `;
        if (result > 0) {
            console.log(`Marked ${result} vehicles as LOST_SIGNAL due to 10 minutes of inactivity.`);
        }
    } catch (error) {
        console.error('Error during offline vehicle cleanup job:', error);
    }
}, 60000); // 60,000ms = 1 minute

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`API & WebSocket Server is listening on http://localhost:${PORT}`);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down Database connection...');
    await prisma.$disconnect();
    process.exit(0);
});
