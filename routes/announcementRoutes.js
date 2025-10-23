const express = require('express');
const { protect } = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');

const router = express.Router();

// GET /api/v1/messages/announcements - Get all announcements for logged-in user
router.get('/announcements', protect, async (req, res) => {
  try {
    // Validate user ID
    if (!req.user.id || !req.user.company) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user or company ID'
      });
    }
    const announcements = await Message.find({
      receiver: req.user.id,
      isAnnouncement: true
    })
    .sort({ createdAt: -1 })
    .populate('sender', 'name email role');

    res.status(200).json({
      success: true,
      announcements
    });
  } catch (err) {
    console.error('Fetch announcements error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching announcements'
    });
  }
});

module.exports = router;
