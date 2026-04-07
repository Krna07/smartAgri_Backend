const mongoose = require('mongoose');
const User = require('../models/User');
const Sensor = require('../models/Sensor');
require('dotenv').config({ path: '../.env' });

const DEMO_SENSORS = [
  { sensorId: 'DEMO_001', plantRow: 'Row A - Tomatoes', soilMoisture: 65, temperature: 24.5, humidity: 58 },
  { sensorId: 'DEMO_002', plantRow: 'Row B - Lettuce',  soilMoisture: 42, temperature: 22.0, humidity: 62 },
  { sensorId: 'DEMO_003', plantRow: 'Row C - Peppers',  soilMoisture: 28, temperature: 26.0, humidity: 55 },
  { sensorId: 'DEMO_004', plantRow: 'Row D - Herbs',    soilMoisture: 71, temperature: 23.0, humidity: 60 },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/irrigation');

  let user = await User.findOne({ email: 'demo@smartagri.io' });
  if (!user) {
    user = await User.create({
      name: 'Demo User',
      email: 'demo@smartagri.io',
      password: 'demo1234',
      farmName: 'Demo Farm',
    });
    console.log('Demo user created');
  } else {
    console.log('Demo user already exists');
  }

  for (const s of DEMO_SENSORS) {
    await Sensor.findOneAndUpdate(
      { userId: user._id, sensorId: s.sensorId },
      { ...s, userId: user._id, isDemo: true, lastUpdated: new Date() },
      { upsert: true }
    );
  }

  console.log('Demo sensors seeded');
  console.log('\n--- Demo Credentials ---');
  console.log('Email:    demo@smartagri.io');
  console.log('Password: demo1234');
  console.log('------------------------\n');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
