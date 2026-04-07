const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');
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

// POST /update — from IoT hardware (uses userId in body or query)
router.post('/update', async (req, res) => {
  try {
    const { sensorId, soilMoisture, temperature, humidity, userId, plantRow, isDemo } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required for hardware updates' });
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

    req.app.get('io').to(`user_${userId}`).emit('sensorUpdate', sensor);

    if (soilMoisture !== undefined && soilMoisture < 30) {
      req.app.get('io').to(`user_${userId}`).emit('irrigationAlert', {
        plantRow: sensor.plantRow,
        soilMoisture,
        message: `Low soil moisture in ${sensor.plantRow}`
      });
    }

    res.json(sensor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
