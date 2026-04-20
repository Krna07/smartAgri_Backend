const mongoose = require('mongoose');

const sensorHistorySchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sensorId:     { type: String, required: true },
  plantRow:     { type: String },
  soilMoisture: { type: Number },
  temperature:  { type: Number },
  humidity:     { type: Number },
  timestamp:    { type: Date, default: Date.now },
});

// Index for fast queries by user + sensor + time
sensorHistorySchema.index({ userId: 1, sensorId: 1, timestamp: -1 });

// Auto-delete records older than 7 days
sensorHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('SensorHistory', sensorHistorySchema);
