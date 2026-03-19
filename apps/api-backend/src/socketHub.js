const { Server } = require('socket.io');
const Redis = require('ioredis');

function setupSocketHub(httpServer) {
    const io = new Server(httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"] }
    });

    const redisSubscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    redisSubscriber.on('ready', () => {
        console.log('SocketHub: Subscribed to Redis Queue');
        redisSubscriber.subscribe('OBU_REALTIME_STREAM', (err) => {
            if (err) console.error('Failed to subscribe to Redis channel', err);
            else console.log('Listening for real-time pings on channel: OBU_REALTIME_STREAM');
        });
    });

    redisSubscriber.on('message', (channel, message) => {
        if (channel === 'OBU_REALTIME_STREAM' && io.engine.clientsCount > 0) {
            io.emit('vehicle_moved', JSON.parse(message));
        }
    });

    io.on('connection', (socket) => {
        console.log(`New Web Viewer Connected: ${socket.id} (Total: ${io.engine.clientsCount})`);
        socket.on('disconnect', () => {
            console.log(`Viewer Disconnected. (Remaining: ${io.engine.clientsCount})`);
        });
    });

    return io;
}

module.exports = setupSocketHub;
