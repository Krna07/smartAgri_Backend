const mongoose = require('mongoose');

const irrigationLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plantRow: { type: String, required: true },
  duration: { type: Number, required: true },
  triggerType: { type: String, enum: ['manual', 'automatic', 'scheduled'], required: true },
  triggeredBy: { type: String, default: 'system' },
  timestamp: { type: Date, default: Date.now },
  soilMoistureBefore: { type: Number },
  status: { type: String, enum: ['completed', 'in-progress', 'failed'], default: 'completed' }
});

module.exports = mongoose.model('IrrigationLog', irrigationLogSchema);
