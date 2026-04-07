/**
 * PDF Model
 * Stores metadata for uploaded PDF files
 */

const mongoose = require('mongoose');

const pdfSchema = new mongoose.Schema({
  // Display title shown to students
  title: {
    type: String,
    required: [true, 'PDF title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  // Optional description / notes about the PDF
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },

  // Original filename (sanitized)
  originalName: {
    type: String,
    required: true
  },

  // Server-side filename (UUID-based, not guessable)
fileUrl: {
  type: String,
  required: true
},

public_id: {
  type: String,
  required: true
},

  // File size in bytes
  fileSize: {
    type: Number,
    required: true
  },

  // Category / Subject tag for organization
 folder: {
  type: String,
  required: true,
  default: 'General'
},

  // Which admin uploaded this
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Total views across all students
  viewCount: {
    type: Number,
    default: 0
  },

  // Whether this PDF is visible to students
  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

// Index for common queries
pdfSchema.index({ isActive: 1, createdAt: -1 });
pdfSchema.index({ category: 1 });

module.exports = mongoose.model('PDF', pdfSchema);
