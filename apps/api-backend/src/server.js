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

app.use('/api/vehicles', vehicleRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'OBU Backend API & Socket Service v1.0.0 is running' });
});

const server = http.createServer(app);
setupSocketHub(server);

require('./cron/pingStatus');

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`API & WebSocket Server is listening on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
    console.log('Shutting down Database connection...');
    await prisma.$disconnect();
    process.exit(0);
});
