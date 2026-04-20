const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const allowedOrigins = [FRONTEND_URL, 'http://localhost:3001', 'http://localhost:3000', 'https://localhost', 'capacitor://localhost', 'ionic://localhost'];

const io = socketIo(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/irrigation', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sensors', require('./routes/sensors'));
app.use('/api/irrigation', require('./routes/irrigation'));
app.use('/api/notifications', require('./routes/notifications'));

// Socket.io — frontend real-time
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`Socket joined room user_${userId}`);
  });
  socket.on('disconnect', () => {});
});

app.set('io', io);

// MQTT — IoT device communication
const MQTT_BROKER   = process.env.MQTT_BROKER;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

if (MQTT_BROKER) {
  const mqttClient = mqtt.connect(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('✅ MQTT broker connected');
    // Subscribe to all sensor data topics: sensors/<userId>/data
    mqttClient.subscribe('sensors/+/data', (err) => {
      if (!err) console.log('📡 Subscribed to sensors/+/data');
    });
    // Subscribe to irrigation status requests: irrigation/<userId>/status
    mqttClient.subscribe('irrigation/+/request', (err) => {
      if (!err) console.log('📡 Subscribed to irrigation/+/request');
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const parts = topic.split('/');
      const userId = parts[1];
      const type   = parts[2];

      if (type === 'data') {
        // Sensor data from ESP32
        const data = JSON.parse(message.toString());
        const Sensor = require('./models/Sensor');

        const sensor = await Sensor.findOneAndUpdate(
          { userId, sensorId: data.sensorId },
          {
            plantRow:     data.plantRow     || 'Main Sensor',
            temperature:  data.temperature,
            humidity:     data.humidity,
            soilMoisture: data.soilMoisture,
            lastUpdated:  new Date(),
            isActive:     true,
            isDemo:       false,
          },
          { upsert: true, new: true }
        );

        // Push to frontend via Socket.io
        io.to(`user_${userId}`).emit('sensorUpdate', sensor);
        console.log(`📊 MQTT sensor [${data.sensorId}] — Temp: ${data.temperature}°C Soil: ${data.soilMoisture}%`);

        // Save to history
        const SensorHistory = require('./models/SensorHistory');
        await SensorHistory.create({
          userId, sensorId: data.sensorId,
          plantRow: sensor.plantRow,
          soilMoisture: data.soilMoisture,
          temperature:  data.temperature,
          humidity:     data.humidity,
        });

        // Mark user as having real hardware
        const User = require('./models/User');
        await User.findByIdAndUpdate(userId, { hasHardware: true });

        // Low moisture alert — emit socket + save to notification store
        if (data.soilMoisture < 30) {
          const alertPayload = {
            plantRow: sensor.plantRow,
            soilMoisture: data.soilMoisture,
            message: `Low soil moisture in ${sensor.plantRow} (${data.soilMoisture}%)`,
          };
          io.to(`user_${userId}`).emit('irrigationAlert', alertPayload);

          // Save to in-memory notification store via internal POST
          const notifStore = require('./routes/notifications');
          const uid = String(userId);
          const n = {
            id: Date.now(),
            message: alertPayload.message,
            type: 'warning',
            plantRow: sensor.plantRow,
            timestamp: new Date(),
            read: false
          };
          // Access the store directly
          if (!global.notifStore) global.notifStore = {};
          if (!global.notifStore[uid]) global.notifStore[uid] = [];
          global.notifStore[uid].unshift(n);
          if (global.notifStore[uid].length > 100) global.notifStore[uid].splice(100);
          io.to(`user_${userId}`).emit('newNotification', n);
        }
      }

      if (type === 'request') {
        // ESP32 asking for irrigation status to control LED
        const IrrigationLog = require('./models/IrrigationLog');
        const active = await IrrigationLog.findOne({ userId, status: 'in-progress' });
        const response = JSON.stringify({ irrigating: !!active, plantRow: active?.plantRow || null });
        mqttClient.publish(`irrigation/${userId}/status`, response);
      }

    } catch (err) {
      console.error('MQTT message error:', err.message);
    }
  });

  mqttClient.on('error', (err) => console.error('MQTT error:', err.message));
  app.set('mqttClient', mqttClient);
} else {
  console.log('⚠️  MQTT_BROKER not set — using HTTP fallback for sensors');
}

// Keep-alive ping to prevent Render free tier from sleeping
setInterval(() => {
  const http = require('http');
  const url = process.env.RENDER_EXTERNAL_URL;
  if (url) http.get(url).on('error', () => {});
}, 14 * 60 * 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
