// backend/models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  company: {
    type: mongoose.Schema.Types.Mixed,
    ref: 'Company',
    required: true
  },
  content: {
    type: String,
    trim: true,
    maxlength: [1000, 'Message content cannot exceed 1000 characters']
  },
  fileUrl: {
    type: String,
    trim: true
  },
  fileName: {
    type: String,
    trim: true
  },
  fileType: {
    type: String,
    enum: ['image', 'document', 'other'],
    default: 'other'
  },
  isAnnouncement: {
    type: Boolean,
    default: false
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying
MessageSchema.index({ company: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ company: 1, isAnnouncement: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);