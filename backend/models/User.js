/**
 * User Model
 * Handles both Admin and Student accounts
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Unique login ID (e.g., "STU001", "admin")
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    unique: true,
    trim: true,
    lowercase: true
  },

  // Display name
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },

  // Hashed password
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },

  // User role: 'admin' or 'student'
  role: {
    type: String,
    enum: ['admin', 'student'],
    default: 'student'
  },

  // Admin must approve students before they can login
  isApproved: {
    type: Boolean,
    default: false
  },

  // Admin can block users at any time
  isBlocked: {
    type: Boolean,
    default: false
  },

  // ─── Device Restriction ────────────────────────────────────────────────────
  // Stores the fingerprint of the device they first logged in from
  deviceId: {
    type: String,
    default: null
  },

  // Track the device name/info for admin visibility
  deviceInfo: {
    type: String,
    default: null
  },

  // Current active JWT session token identifier (for single-session enforcement)
  activeTokenId: {
    type: String,
    default: null
  },

  // Timestamp of last login
  lastLogin: {
    type: Date,
    default: null
  },

  // Last seen timestamp (updated on each authenticated request)
  lastSeen: {
    type: Date,
    default: null
  },

  // Optional: batch/class info for students
  batch: {
    type: String,
    default: ''
  }

}, { timestamps: true });

// Index for fast lookups
userSchema.index({ userId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isApproved: 1, isBlocked: 1 });

// Virtual: is user currently "active" (seen in last 5 minutes)
userSchema.virtual('isOnline').get(function () {
  if (!this.lastSeen) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastSeen > fiveMinutesAgo;
});

// Don't expose password in JSON responses
userSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.activeTokenId;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
