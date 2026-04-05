/**
 * Admin Routes - All protected (authenticate + requireAdmin)
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getUsers, createUser, approveUser, toggleBlock,
  deleteUser, resetDevice, getStats
} = require('../controllers/adminController');

// Apply auth middleware to all admin routes
router.use(authenticate, requireAdmin);

// Dashboard stats
router.get('/stats', getStats);

// User management
router.get('/users', getUsers);
router.post('/users', createUser);
router.patch('/users/:id/approve', approveUser);
router.patch('/users/:id/block', toggleBlock);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/reset-device', resetDevice);

module.exports = router;
