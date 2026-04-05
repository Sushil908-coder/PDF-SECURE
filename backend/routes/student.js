/**
 * Student Routes
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireStudent } = require('../middleware/auth');

// Students can view their own profile
router.get('/profile', authenticate, requireStudent, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
