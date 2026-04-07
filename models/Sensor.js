const mongoose = require('mongoose');

const sensorSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sensorId:     { type: String, required: true },
  plantRow:     { type: String, default: 'Unknown' },
  soilMoisture: { type: Number, min: 0, max: 100, default: 0 },
  temperature:  { type: Number, default: 0 },
  humidity:     { type: Number, default: 0 },
  lastUpdated:  { type: Date, default: Date.now },
  isActive:     { type: Boolean, default: true },
  isDemo:       { type: Boolean, default: false }
}, { autoIndex: false });

// sensorId unique per user (compound index only)
sensorSchema.index({ userId: 1, sensorId: 1 }, { unique: true });

module.exports = mongoose.model('Sensor', sensorSchema);
