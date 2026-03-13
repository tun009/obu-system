const { Server } = require('socket.io');
const Redis = require('ioredis');

function setupSocketHub(httpServer) {
    // Enable CORS so the separate React frontend can easily connect
    const io = new Server(httpServer, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });

    // 1. Setup Redis Subscriber Client
    const redisSubscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    redisSubscriber.on('ready', () => {
        console.log('SocketHub: Subscribed to Redis Queue');
        // Once a Redis client enters 'subscriber' mode via .subscribe(), it can ONLY listen.
        // NO OTHER COMMANDS (like .info or .publish) can be sent on this specific instance.
        redisSubscriber.subscribe('OBU_REALTIME_STREAM', (err) => {
            if (err) console.error('Failed to subscribe to Redis channel', err);
            else console.log('Listening for real-time pings on channel: OBU_REALTIME_STREAM');
        });
    });

    // 2. Stream Data to Connected Web Clients
    redisSubscriber.on('message', (channel, message) => {
        if (channel === 'OBU_REALTIME_STREAM') {
            // Check if there are any users viewing the web dashboard
            if (io.engine.clientsCount > 0) {
                // Parse the tiny JSON ping { imei, lat, lng, speed, status }
                const realTimeData = JSON.parse(message);
                
                // Blast the data instantly over Websocket to all browsers
                io.emit('vehicle_moved', realTimeData);
            }
            // If clientsCount === 0, the event is silently ignored (Drop packet behavior).
            // This prevents memory leaks and saves bandwidth when nobody is looking.
        }
    });

    // 3. Monitor Web Viewers
    io.on('connection', (socket) => {
        console.log(`New Web Viewer Connected: ${socket.id} (Total: ${io.engine.clientsCount})`);
        
        socket.on('disconnect', () => {
            console.log(`Viewer Disconnected. (Remaining: ${io.engine.clientsCount})`);
        });
    });

    return io;
}

module.exports = setupSocketHub;
