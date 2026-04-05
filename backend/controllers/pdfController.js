/**
 * PDF Controller
 * Upload, delete, list, and secure stream PDFs
 */

const path = require('path');
const fs = require('fs');
const PDF = require('../models/PDF');
const cloudinary = require('../config/cloudinary');
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
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'PDF title is required.' });
    }

    // 🔥 Upload to Cloudinary (CORRECT PLACE)
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",
      folder: "pdf-notes"
    });

    // 🔥 Save in DB
    const pdf = await PDF.create({
      title: title.trim(),
      description: (description || '').trim(),
      category: (category || 'General').trim(),
      originalName: req.file.originalname,
      fileUrl: result.secure_url,
      public_id: result.public_id,
      fileSize: req.file.size,
      uploadedBy: req.user._id
    });

    // 🔥 Delete local file
    fs.unlinkSync(req.file.path);

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
      return res.status(404).json({ success: false });
    }

    // 🔥 New PDF (Cloudinary)
    if (pdf.public_id) {
      await cloudinary.uploader.destroy(pdf.public_id, {
        resource_type: "raw"
      });
    }

    // 🔥 Old PDF (skip cloudinary)
    await PDF.findByIdAndDelete(req.params.id);

    res.json({ success: true });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ success: false });
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
    if (!req.params.id || req.params.id === "undefined") {
      return res.status(400).json({ message: "Invalid PDF ID" });
    }
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ success: false, message: 'PDF not found.' });
    }

    if (!pdf.isActive && req.user.role === 'student') {
      return res.status(403).json({ success: false, message: 'This PDF is not available.' });
    }

    // 🔥 Direct Cloudinary URL
    res.redirect(pdf.fileUrl);

    // Log view
    PDF.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).exec();

    if (req.user.role === 'student') {
      AccessLog.create({
        user: req.user._id,
        pdf: pdf._id,
        action: 'view',
        deviceId: req.headers['x-device-id'],
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }).catch(() => { });
    }

  } catch (err) {
    console.error('streamPDF error:', err);
    res.status(500).json({ success: false, message: 'Failed to stream PDF.' });
  }
};

module.exports = { uploadPDF, listPDFs, deletePDF, togglePDF, streamPDF };
