const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// ========================
// Configuration
// ========================
const MQTT_BROKER = 'mqtt://0.tcp.ap.ngrok.io:16386';
const MQTT_TOPIC = 'obuv1/25075738112';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'obu_data.json');
const PORT = 3002;
const MAX_RECORDS = 10000; // Maximum records to keep in JSON file

// ========================
// Express + Socket.IO Setup
// ========================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ========================
// Data Storage
// ========================
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let allRecords = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    allRecords = JSON.parse(raw);
    console.log(`📂 Loaded ${allRecords.length} existing records from obu_data.json`);
  } catch (e) {
    console.warn('⚠️  Could not parse existing data file, starting fresh.');
    allRecords = [];
  }
}

function saveToFile() {
  // Keep only last MAX_RECORDS
  if (allRecords.length > MAX_RECORDS) {
    allRecords = allRecords.slice(-MAX_RECORDS);
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(allRecords, null, 2), 'utf-8');
}

// ========================
// MQTT Client
// ========================
let mqttConnected = false;

console.log(`🔌 Connecting to MQTT broker: ${MQTT_BROKER}`);
const mqttClient = mqtt.connect(MQTT_BROKER, {
  reconnectPeriod: 5000,
  connectTimeout: 10000,
});


mqttClient.on('connect', () => {
  mqttConnected = true;
  console.log('✅ Connected to MQTT broker');

  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error('❌ Failed to subscribe:', err.message);
    } else {
      console.log(`📡 Subscribed to topic: "${MQTT_TOPIC}"`);
    }
  });

  // Notify all connected clients
  io.emit('mqtt_status', { connected: true });
});

// Parse OBU message — supports both standard JSON and non-standard format
// Standard: {"alt":0.00,"speed":0.00,"direction":0.00}
// Non-standard: {alt:0.00,speed:0.00,direction:0.00}
function parseObuMessage(raw) {
  const str = raw.toString().trim();
  if (!str.startsWith('{') || !str.endsWith('}')) return null;

  // Try standard JSON first
  try {
    return JSON.parse(str);
  } catch (_) {
    // Fall through to custom parser
  }

  // Custom parser for non-standard format (unquoted keys, possibly invalid values)
  const inner = str.slice(1, -1);
  const obj = {};

  const parts = inner.split(',');
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;

    // Strip quotes from key
    const key = part.substring(0, colonIdx).trim().replace(/^"|"$/g, '');
    const valStr = part.substring(colonIdx + 1).trim().replace(/^"|"$/g, '');

    if (!key) continue;

    if (valStr === '' || valStr === undefined) {
      obj[key] = null;
    } else {
      const num = Number(valStr);
      obj[key] = isNaN(num) ? valStr : num;
    }
  }

  return Object.keys(obj).length > 0 ? obj : null;
}

mqttClient.on('message', (topic, message) => {
  try {
    const raw = message.toString();
    console.log("message received:", raw);

    const data = parseObuMessage(raw);
    if (!data) {
      console.warn('⚠️  Could not parse message:', raw);
      return;
    }

    // Normalize field names: long→lon, dir→direction
    const record = {
      lat: data.lat,
      lon: data.long !== undefined ? data.long : data.lon,
      alt: data.alt,
      speed: data.speed,
      direction: data.dir !== undefined ? data.dir : data.direction,
      date: data.date,
      time: data.time,
      car_rpm: data.car_rpm !== undefined ? Number(data.car_rpm) : 0,
      car_speed: data.car_speed !== undefined ? Number(data.car_speed) : 0,
      car_coolant_temp: data.car_coolant_temp !== undefined ? Number(data.car_coolant_temp) : 0,
      car_throttle: data.car_throttle !== undefined ? Number(data.car_throttle) : 0,
      car_fuel_level: data.car_fuel_level !== undefined ? Number(data.car_fuel_level) : 0,
      receivedAt: new Date().toISOString(),
    };

    // Parse date/time fields and convert GPS UTC → Vietnam time (UTC+7)
    if (record.date && record.time) {
      const dateStr = String(record.date).padStart(6, '0');
      const timeStr = String(record.time).padStart(6, '0');
      // date format: DDMMYY, time format: HHMMSS (GPS = UTC)
      const day = parseInt(dateStr.substring(0, 2), 10);
      const month = parseInt(dateStr.substring(2, 4), 10) - 1; // JS month 0-based
      const year = 2000 + parseInt(dateStr.substring(4, 6), 10);
      const hour = parseInt(timeStr.substring(0, 2), 10);
      const min = parseInt(timeStr.substring(2, 4), 10);
      const sec = parseInt(timeStr.substring(4, 6), 10);

      // Build UTC Date then shift +7h to get Vietnam time
      const utcDate = new Date(Date.UTC(year, month, day, hour, min, sec));
      const vnDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);

      const pad = (n) => String(n).padStart(2, '0');
      const vDay = pad(vnDate.getUTCDate());
      const vMonth = pad(vnDate.getUTCMonth() + 1);
      const vYear = vnDate.getUTCFullYear();
      const vHour = pad(vnDate.getUTCHours());
      const vMin = pad(vnDate.getUTCMinutes());
      const vSec = pad(vnDate.getUTCSeconds());

      record.formattedDate = `${vDay}/${vMonth}/${vYear}`;
      record.formattedTime = `${vHour}:${vMin}:${vSec}`;
      record.formattedDateTime = `${vDay}/${vMonth}/${vYear} ${vHour}:${vMin}:${vSec}`;
    }

    allRecords.push(record);
    saveToFile();

    // Emit to all connected browser clients
    io.emit('obu_data', record);

    console.log(`📍 [${record.formattedDateTime || 'N/A'}] Lat: ${record.lat}, Lon: ${record.lon}, GPS Speed: ${record.speed} km/h, Car RPM: ${record.car_rpm}`);

  } catch (e) {
    console.error('❌ Error parsing MQTT message:', e.message);
  }
});

mqttClient.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
  mqttConnected = false;
  io.emit('mqtt_status', { connected: false, error: err.message });
});

mqttClient.on('offline', () => {
  mqttConnected = false;
  console.log('⚡ MQTT client offline');
  io.emit('mqtt_status', { connected: false });
});

mqttClient.on('reconnect', () => {
  console.log('🔄 Reconnecting to MQTT broker...');
});

mqttClient.on('close', () => {
  mqttConnected = false;
  io.emit('mqtt_status', { connected: false });
});

// ========================
// API Routes
// ========================
app.get('/api/data', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const records = allRecords.slice(-limit);
  res.json({
    total: allRecords.length,
    returned: records.length,
    records
  });
});

app.get('/api/latest', (req, res) => {
  if (allRecords.length === 0) {
    return res.json({ record: null });
  }
  res.json({ record: allRecords[allRecords.length - 1] });
});

app.get('/api/status', (req, res) => {
  res.json({
    mqttConnected,
    totalRecords: allRecords.length,
    broker: MQTT_BROKER,
    topic: MQTT_TOPIC
  });
});

// ========================
// Socket.IO
// ========================
io.on('connection', (socket) => {
  console.log(`🌐 Browser client connected: ${socket.id}`);

  // Send current status
  socket.emit('mqtt_status', { connected: mqttConnected });

  // Send last 50 records for map trail
  const recentRecords = allRecords.slice(-50);
  socket.emit('history', recentRecords);

  socket.on('disconnect', () => {
    console.log(`🔌 Browser client disconnected: ${socket.id}`);
  });
});

// ========================
// Start Server
// ========================
server.listen(PORT, () => {
  console.log(`\n🚀 OBU Tracker server running at http://localhost:${PORT}`);
  console.log(`📡 MQTT Broker: ${MQTT_BROKER}`);
  console.log(`📋 Topic: ${MQTT_TOPIC}`);
  console.log(`📂 Data file: ${DATA_FILE}\n`);
});
