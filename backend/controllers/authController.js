/**
 * Authentication Controller
 * Handles login and logout with device binding + single session
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const AccessLog = require('../models/AccessLog');

/**
 * POST /api/auth/login
 * Body: { userId, password, deviceId, deviceInfo }
 */
const login = async (req, res) => {
  try {
    const { userId, password, deviceId, deviceInfo } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!userId || !password) {
      return res.status(400).json({ success: false, message: 'User ID and password are required.' });
    }
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Device identification failed.' });
    }

    // ── Find user ─────────────────────────────────────────────────────────────
    const user = await User.findOne({ userId: userId.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // ── Check approval status ─────────────────────────────────────────────────
    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. Please contact your administrator.'
      });
    }

    // ── Check blocked status ──────────────────────────────────────────────────
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Contact admin.'
      });
    }

    // ── Verify password ───────────────────────────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // ── Device restriction (students only) ────────────────────────────────────
    if (user.role === 'student') {
      if (user.deviceId && user.deviceId !== deviceId) {
        // This account is bound to a different device
        await AccessLog.create({
          user: user._id,
          action: 'blocked_attempt',
          deviceId,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
        return res.status(403).json({
          success: false,
          message: 'This account is registered to another device. Contact your admin to reset your device.'
        });
      }
    }

   

    // 🔥 SUPERADMIN → NO LIMIT (kuch nahi likhna)
    // ── Generate unique token ID (for single-session enforcement) ─────────────
    const tokenId = uuidv4();

    const updateData = {
      lastLogin: new Date(),
      lastSeen: new Date()
    };


    // ── Sign JWT ──────────────────────────────────────────────────────────────
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        tokenId
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // ── Update user: bind device (if first login) + store session token ───────

    // 🔥 ADMIN vs STUDENT LOGIC
    if (user.userId.toLowerCase() === 'abhi2010') {
  updateData.activeTokenId = tokenId; // unlimited admin
}
else if (user.role === 'admin') {
  updateData.$push = {
    adminSessions: {
      tokenId,
      deviceId
    }
  };
}
else if (user.role === 'student') {
  updateData.activeTokenId = tokenId;
}

    // 🔥 SUPERADMIN → kuch nahi (no session store)
    // Bind device on first successful login
    if (user.role === 'student' && !user.deviceId) {
      updateData.deviceId = deviceId;
      updateData.deviceInfo = deviceInfo || 'Unknown Device';
    }

    await User.findByIdAndUpdate(user._id, updateData);

    // ── Log the login ─────────────────────────────────────────────────────────
    await AccessLog.create({
      user: user._id,
      action: 'login',
      deviceId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        role: user.role,
        batch: user.batch
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

/**
 * POST /api/auth/logout
 * Invalidates the current session token
 */
const logout = async (req, res) => {
  try {
    // Clear the active token so no further requests can use it
    if (req.user.role === 'admin') {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: {
          adminSessions: { tokenId: req.user.tokenId }
        }
      });
    } else {
      await User.findByIdAndUpdate(req.user._id, { activeTokenId: null });
    }

    await AccessLog.create({
      user: req.user._id,
      action: 'logout',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, message: 'Server error during logout.' });
  }
};

/**
 * GET /api/auth/me
 * Returns current authenticated user info
 */
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { login, logout, getMe };
