/**
 * PDF Controller
 * Upload, delete, list, and secure stream PDFs
 */

const path = require('path');
const fs = require('fs');
const PDF = require('../models/PDF');
const AccessLog = require('../models/AccessLog');

const UPLOAD_DIR = path.join(__dirname, '../uploads');

// ─── Admin: Upload PDF ────────────────────────────────────────────────────────

/**
 * POST /api/pdf/upload  (Admin only)
 */
const uploadPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { title, description, category } = req.body;

    if (!title || !title.trim()) {
      // Delete uploaded file if title missing
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'PDF title is required.' });
    }

    const pdf = await PDF.create({
      title: title.trim(),
      description: (description || '').trim(),
      category: (category || 'General').trim(),
      originalName: req.file.originalname,
      filename: req.file.filename,
      fileSize: req.file.size,
      uploadedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'PDF uploaded successfully.',
      pdf: {
        id: pdf._id,
        title: pdf.title,
        category: pdf.category,
        fileSize: pdf.fileSize,
        createdAt: pdf.createdAt
      }
    });
  } catch (err) {
    console.error('uploadPDF error:', err);
    // Clean up file if DB save failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'Failed to upload PDF.' });
  }
};

// ─── List PDFs ────────────────────────────────────────────────────────────────

/**
 * GET /api/pdf/list
 * Admins see all PDFs; students see only active ones
 */
const listPDFs = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { isActive: true };
    
    const pdfs = await PDF.find(filter)
      .populate('uploadedBy', 'name userId')
      .sort({ createdAt: -1 })
      .select('-filename'); // Never expose the real filename to client

    res.json({ success: true, pdfs });
  } catch (err) {
    console.error('listPDFs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch PDFs.' });
  }
};

// ─── Admin: Delete PDF ────────────────────────────────────────────────────────

/**
 * DELETE /api/pdf/:id  (Admin only)
 */
const deletePDF = async (req, res) => {
  try {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ success: false, message: 'PDF not found.' });
    }

    // Delete physical file
    const filePath = path.join(UPLOAD_DIR, pdf.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await PDF.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: `"${pdf.title}" deleted successfully.` });
  } catch (err) {
    console.error('deletePDF error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete PDF.' });
  }
};

// ─── Admin: Toggle PDF visibility ─────────────────────────────────────────────

/**
 * PATCH /api/pdf/:id/toggle  (Admin only)
 */
const togglePDF = async (req, res) => {
  try {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) return res.status(404).json({ success: false, message: 'PDF not found.' });

    pdf.isActive = !pdf.isActive;
    await pdf.save();

    res.json({ 
      success: true, 
      message: `PDF is now ${pdf.isActive ? 'visible' : 'hidden'} to students.`,
      isActive: pdf.isActive
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update PDF.' });
  }
};

// ─── Secure PDF Streaming ─────────────────────────────────────────────────────

/**
 * GET /api/pdf/stream/:id
 * Streams the PDF file securely — never exposes the real file path.
 * Supports range requests for efficient PDF.js loading.
 */
const streamPDF = async (req, res) => {
  try {
    // Find the PDF metadata
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ success: false, message: 'PDF not found.' });
    }

    // Students can only access active PDFs
    if (!pdf.isActive && req.user.role === 'student') {
      return res.status(403).json({ success: false, message: 'This PDF is not available.' });
    }

    // Resolve real file path (never sent to client)
    const filePath = path.join(UPLOAD_DIR, pdf.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // Security headers: prevent caching and direct access
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline'); // Show in viewer, not download
    // Prevent embedding in other sites
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // ── Range Request Support (for PDF.js page-by-page loading) ────────────
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.status(206); // Partial content

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }

    // Log the view (fire and forget)
    PDF.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).exec();
    if (req.user.role === 'student') {
      AccessLog.create({
        user: req.user._id,
        pdf: pdf._id,
        action: 'view',
        deviceId: req.headers['x-device-id'],
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }).catch(() => {});
    }

  } catch (err) {
    console.error('streamPDF error:', err);
    res.status(500).json({ success: false, message: 'Failed to stream PDF.' });
  }
};

module.exports = { uploadPDF, listPDFs, deletePDF, togglePDF, streamPDF };
