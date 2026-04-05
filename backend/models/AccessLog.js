/**
 * AccessLog Model
 * Tracks which student viewed which PDF and when
 */

const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pdf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PDF',
    required: false
  },
  action: {
    type: String,
    enum: ['view', 'login', 'logout', 'blocked_attempt'],
    default: 'view'
  },
  deviceId: String,
  ip: String,
  userAgent: String
}, { timestamps: true });

accessLogSchema.index({ user: 1, createdAt: -1 });
accessLogSchema.index({ pdf: 1 });

module.exports = mongoose.model('AccessLog', accessLogSchema);
