/**
 * PDF Routes
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const { uploadPDF, listPDFs, deletePDF, togglePDF, streamPDF } = require('../controllers/pdfController');

// List PDFs (both admin and students)
router.get('/list', authenticate, listPDFs);

// Secure stream endpoint (both admin and students)
router.get('/stream/:id', streamPDF);

// Admin-only routes
router.post('/upload', authenticate, requireAdmin, upload.single('pdf'), handleUploadError, uploadPDF);
router.delete('/:id', authenticate, requireAdmin, deletePDF);
router.patch('/:id/toggle', authenticate, requireAdmin, togglePDF);

module.exports = router;
