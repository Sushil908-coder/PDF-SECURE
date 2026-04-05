/**
 * Admin Controller
 * Full user and system management for admins
 */

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PDF = require('../models/PDF');
const AccessLog = require('../models/AccessLog');

// ─── User Management ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Returns all users with online status
 */
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'student' })
      .select('-password -activeTokenId')
      .sort({ createdAt: -1 });

    // Attach isOnline virtual
    const usersWithStatus = users.map(u => ({
      ...u.toJSON(),
      isOnline: u.lastSeen && new Date(u.lastSeen) > new Date(Date.now() - 5 * 60 * 1000)
    }));

    res.json({ success: true, users: usersWithStatus });
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

/**
 * POST /api/admin/users
 * Creates a new student account
 */
const createUser = async (req, res) => {
  try {
    const { userId, name, password, batch } = req.body;

    if (!userId || !name || !password) {
      return res.status(400).json({ success: false, message: 'userId, name, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // Check if userId already exists
    const existing = await User.findOne({ userId: userId.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User ID already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      userId: userId.toLowerCase().trim(),
      name: name.trim(),
      password: hashedPassword,
      role: 'student',
      isApproved: false, // Requires explicit approval
      batch: batch || ''
    });

    res.status(201).json({ 
      success: true, 
      message: 'Student account created. Remember to approve them.',
      user: { id: user._id, userId: user.userId, name: user.name, batch: user.batch }
    });
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
};

/**
 * PATCH /api/admin/users/:id/approve
 * Approves a pending student
 */
const approveUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: true, isBlocked: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: `${user.name} approved successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve user.' });
  }
};

/**
 * PATCH /api/admin/users/:id/block
 * Blocks or unblocks a student
 */
const toggleBlock = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const newBlockState = !user.isBlocked;
    await User.findByIdAndUpdate(req.params.id, { 
      isBlocked: newBlockState,
      // Invalidate their session when blocked
      activeTokenId: newBlockState ? null : user.activeTokenId
    });

    res.json({ 
      success: true, 
      message: `${user.name} has been ${newBlockState ? 'blocked' : 'unblocked'}.`,
      isBlocked: newBlockState
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
};

/**
 * DELETE /api/admin/users/:id
 * Permanently deletes a student account
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    
    // Clean up their logs
    await AccessLog.deleteMany({ user: req.params.id });

    res.json({ success: true, message: `${user.name}'s account deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
};

/**
 * PATCH /api/admin/users/:id/reset-device
 * Resets the device binding so user can login from a new device
 */
const resetDevice = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { deviceId: null, deviceInfo: null, activeTokenId: null },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: `Device reset for ${user.name}. They can now login from a new device.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset device.' });
  }
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/stats
 */
const getStats = async (req, res) => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [totalStudents, approvedStudents, pendingStudents, blockedStudents, 
           activeNow, totalPDFs, recentActivity] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', isApproved: true, isBlocked: false }),
      User.countDocuments({ role: 'student', isApproved: false }),
      User.countDocuments({ role: 'student', isBlocked: true }),
      User.countDocuments({ role: 'student', lastSeen: { $gt: fiveMinAgo } }),
      PDF.countDocuments({ isActive: true }),
      AccessLog.find({ action: 'view' })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'name userId')
        .populate('pdf', 'title')
    ]);

    res.json({
      success: true,
      stats: { totalStudents, approvedStudents, pendingStudents, blockedStudents, activeNow, totalPDFs },
      recentActivity
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
};

module.exports = { getUsers, createUser, approveUser, toggleBlock, deleteUser, resetDevice, getStats };
