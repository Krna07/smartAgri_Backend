const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');
const SensorHistory = require('../models/SensorHistory');
const auth = require('../middleware/auth');

// GET all sensors for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const sensors = await Sensor.find({ userId: req.user._id }).sort({ lastUpdated: -1 });
    res.json(sensors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /history/:sensorId — last 24h readings for chart
router.get('/history/:sensorId', auth, async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const history = await SensorHistory.find({
      userId:   req.user._id,
      sensorId: req.params.sensorId,
      timestamp: { $gte: since },
    }).sort({ timestamp: 1 }).limit(200);
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /update — from IoT hardware
router.post('/update', async (req, res) => {
  try {
    const { sensorId, soilMoisture, temperature, humidity, userId, plantRow, isDemo } = req.body;
    if (!userId)   return res.status(400).json({ message: 'userId required' });
    if (!sensorId) return res.status(400).json({ message: 'sensorId required' });

    const updateFields = { lastUpdated: new Date(), isActive: true };
    if (plantRow     !== undefined) updateFields.plantRow     = plantRow;
    if (temperature  !== undefined) updateFields.temperature  = temperature;
    if (humidity     !== undefined) updateFields.humidity     = humidity;
    if (soilMoisture !== undefined) updateFields.soilMoisture = soilMoisture;
    if (isDemo       !== undefined) updateFields.isDemo       = isDemo;
    else updateFields.isDemo = false;

    const sensor = await Sensor.findOneAndUpdate(
      { userId, sensorId },
      updateFields,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Save to history collection
    await SensorHistory.create({
      userId, sensorId,
      plantRow:     sensor.plantRow,
      soilMoisture: soilMoisture ?? sensor.soilMoisture,
      temperature:  temperature  ?? sensor.temperature,
      humidity:     humidity     ?? sensor.humidity,
    });

    // Mark user as having real hardware
    if (isDemo === false || isDemo === 'false') {
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, { hasHardware: true });
    }

    req.app.get('io').to(`user_${userId}`).emit('sensorUpdate', sensor);

    if (soilMoisture !== undefined && soilMoisture < 30) {
      const alertMsg = `Low soil moisture in ${sensor.plantRow} (${soilMoisture}%)`;
      req.app.get('io').to(`user_${userId}`).emit('irrigationAlert', {
        plantRow: sensor.plantRow, soilMoisture, message: alertMsg,
      });
      if (!global.notifStore) global.notifStore = {};
      if (!global.notifStore[userId]) global.notifStore[userId] = [];
      const n = { id: Date.now(), message: alertMsg, type: 'warning', plantRow: sensor.plantRow, timestamp: new Date(), read: false };
      global.notifStore[userId].unshift(n);
      if (global.notifStore[userId].length > 100) global.notifStore[userId].splice(100);
      req.app.get('io').to(`user_${userId}`).emit('newNotification', n);
    }

    res.json(sensor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
