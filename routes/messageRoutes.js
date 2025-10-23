// backend/routes/messageRoutes.js

const express = require('express');
const {
  getConversation,
  sendMessage,
  sendAnnouncement,
  getUnreadCount,
  getContacts
} = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create uploads directory if it doesn't exist
    const dir = './uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and documents
  if (file.mimetype.startsWith('image/') || 
      file.mimetype.includes('pdf') || 
      file.mimetype.includes('document')) {
    cb(null, true);
  } else {
    cb(new Error('Only images and documents are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Routes
router.route('/contacts')
  .get(protect, getContacts);

router.route('/unread-count')
  .get(protect, getUnreadCount);

router.route('/:contactId')
  .get(protect, getConversation);

router.route('/send')
  .post(protect, upload.single('file'), sendMessage);

router.route('/announcement')
  .post(protect, authorize('admin', 'hr'), upload.single('file'), sendAnnouncement);

module.exports = router;