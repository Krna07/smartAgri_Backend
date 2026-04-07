const express = require('express');
const router = express.Router();
const IrrigationLog = require('../models/IrrigationLog');
const Sensor = require('../models/Sensor');
const auth = require('../middleware/auth');

// GET /status?userId=xxx — ESP32 polls this to check if irrigation is active
router.get('/status', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const active = await IrrigationLog.findOne({ userId, status: 'in-progress' });
    res.json({ irrigating: !!active, plantRow: active?.plantRow || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /start
router.post('/start', auth, async (req, res) => {
  try {
    const { plantRow, duration, triggeredBy } = req.body;
    const sensor = await Sensor.findOne({ userId: req.user._id, plantRow });

    const log = await IrrigationLog.create({
      userId: req.user._id,
      plantRow,
      duration,
      triggerType: 'manual',
      triggeredBy: triggeredBy || 'User',
      soilMoistureBefore: sensor?.soilMoisture,
      status: 'in-progress'
    });

    req.app.get('io').to(`user_${req.user._id}`).emit('irrigationStarted', { plantRow, duration, logId: log._id });

    setTimeout(async () => {
      await IrrigationLog.findByIdAndUpdate(log._id, { status: 'completed' });
      req.app.get('io').to(`user_${req.user._id}`).emit('irrigationCompleted', { plantRow, logId: log._id });
    }, duration * 60 * 1000);

    res.json(log);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /history
router.get('/history', auth, async (req, res) => {
  try {
    const logs = await IrrigationLog.find({ userId: req.user._id }).sort({ timestamp: -1 }).limit(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
