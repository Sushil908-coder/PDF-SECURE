/**
 * Authentication & Authorization Middleware
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verifies JWT token and attaches user to request.
 * Also enforces single-session and device restrictions.
 */
const authenticate = async (req, res, next) => {
  try {
    // 🔥 ADD THIS (VERY IMPORTANT)
if (req.query.token) {
  req.headers.authorization = `Bearer ${req.query.token}`;
}
    // 1. Extract token from Authorization header
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    // 3. Fetch user from DB (ensures they still exist and aren't blocked)
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    // 4. Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Your account has been blocked. Contact admin.' });
    }

    // 5. Check if user is approved (students must be approved)
    if (!user.isApproved && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Your account is pending approval.' });
    }

    // 6. Single-session enforcement: check token ID matches stored active token
  if (user.role === 'admin') {
  const validSession = user.adminSessions.find(
    s => s.tokenId === decoded.tokenId
  );

  if (!validSession) {
    return res.status(401).json({
      success: false,
      message: 'Session invalid ❌'
    });
  }
} else {
  if (user.activeTokenId !== decoded.tokenId) {
    return res.status(401).json({
      success: false,
      message: 'Session invalid ❌'
    });
  }
}

    // 7. Device restriction: verify request comes from registered device
    const requestDeviceId = req.headers['x-device-id'];
    if (user.role === 'student' && user.deviceId &&   requestDeviceId && requestDeviceId !== user.deviceId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. This account is registered to a different device.' 
      });
    }

    // 8. Update last seen timestamp (fire and forget)
    User.findByIdAndUpdate(user._id, { lastSeen: new Date() }).exec();

    // Attach user to request
    req.user = user;
    req.user.tokenId = decoded.tokenId;
    next();

  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ success: false, message: 'Authentication error.' });
  }
};

/**
 * Requires the authenticated user to be an admin.
 * Must be used after authenticate().
 */
const requireAdmin = (req, res, next) => {
if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
};

/**
 * Requires the authenticated user to be a student.
 * Must be used after authenticate().
 */
const requireStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Student access required.' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireStudent };
