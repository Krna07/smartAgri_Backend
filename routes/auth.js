const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Sensor = require('../models/Sensor');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'smartagri_secret_key';
const sign = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });

const DEMO_SENSORS = [];

async function seedDemoData(userId) {
  // No demo data — only real hardware sensors shown
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, farmName } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, farmName: farmName || 'My Farm' });
    await seedDemoData(user._id);

    res.status(201).json({ token: sign(user._id), user: { id: user._id, name: user.name, email: user.email, farmName: user.farmName, hasHardware: user.hasHardware } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid email or password' });

    res.json({ token: sign(user._id), user: { id: user._id, name: user.name, email: user.email, farmName: user.farmName, hasHardware: user.hasHardware } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const u = req.user;
  res.json({ id: u._id, name: u.name, email: u.email, farmName: u.farmName, hasHardware: u.hasHardware });
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, farmName } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, farmName },
      { new: true }
    );
    res.json({ user: { id: user._id, name: user.name, email: user.email, farmName: user.farmName } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
