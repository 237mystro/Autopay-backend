// backend/controllers/messageController.js

const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Configure Cloudinary (if using)
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// @desc    Get conversation between two users
// @route   GET /api/v1/messages/:contactId
// @access  Private
exports.getConversation = async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Validate contact ID
    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }

    // Verify contact belongs to same company
    const contact = await User.findById(contactId);
    if (!contact || contact.company.toString() !== req.user.company.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Get messages between users
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: contactId },
        { sender: contactId, receiver: req.user.id }
      ],
      company: req.user.company,
      isAnnouncement: false
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'name email role')
    .populate('receiver', 'name email role');

    // Mark messages as read for receiver
    if (String(req.user.id) !== String(contactId)) {
      await Message.updateMany(
        { 
          sender: contactId, 
          receiver: req.user.id, 
          readBy: { $ne: req.user.id } 
        },
        { $addToSet: { readBy: req.user.id } }
      );
    }

    res.status(200).json({
      success: true,
      count: messages.length,
        messages: messages.reverse(), // Show oldest first
        page,
        pages: Math.ceil(messages.length / limit)
    });
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching conversation'
    });
  }
};

// @desc    Send a new message
// @route   POST /api/v1/messages/send
// @access  Private
exports.sendMessage = async (req, res, next) => {
  try {
    const { receiverId, content } = req.body;
    let { fileUrl, fileName, fileType } = req.body;

    // Validate required fields
    if (!receiverId && !content && !fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide receiver and content or file'
      });
    }

    // Verify receiver belongs to same company
    const receiver = await User.findById(receiverId);
    if (!receiver || receiver.company.toString() !== req.user.company.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // Handle file upload if provided
    if (req.file) {
      // If using Cloudinary
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'autpay_messages',
          resource_type: 'auto'
        });
        
        fileUrl = result.secure_url;
        fileName = req.file.originalname;
        fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
        
        // Delete local file after upload
        fs.unlinkSync(req.file.path);
      } else {
        // If storing locally
        fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        fileName = req.file.originalname;
        fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
      }
    }

    // Create message
    const message = await Message.create({
      sender: req.user.id,
      receiver: receiverId,
      company: req.user.company,
      content: content || '',
      fileUrl: fileUrl || '',
      fileName: fileName || '',
      fileType: fileType || 'other',
      isAnnouncement: false
    });

    // Populate sender and receiver
    await message.populate('sender', 'name email role');
    await message.populate('receiver', 'name email role');

    // Emit message to receiver via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiverId}`).emit('message:receive', {
        message,
        sender: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      message
    });
  } catch (err) {
    console.error('Send message error:', err);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: message.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while sending message'
    });
  }
};

// @desc    Send an announcement (admin only)
// @route   POST /api/v1/messages/announcement
// @access  Private (Admin/HR)
exports.sendAnnouncement = async (req, res, next) => {
  try {
    // Check if user is admin or HR
    if (req.user.role !== 'admin' && req.user.role !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send announcements'
      });
    }

    const { content } = req.body;
    let { fileUrl, fileName, fileType } = req.body;

    // Validate required fields
    if (!content && !fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide content or file for announcement'
      });
    }

    // Handle file upload if provided
    if (req.file) {
      // If using Cloudinary
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'autpay_announcements',
          resource_type: 'auto'
        });
        
        fileUrl = result.secure_url;
        fileName = req.file.originalname;
        fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
        
        // Delete local file after upload
        fs.unlinkSync(req.file.path);
      } else {
        // If storing locally
        fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        fileName = req.file.originalname;
        fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
      }
    }

    // Get all employees in the company
    const employees = await User.find({
      company: req.user.company,
      role: 'employee'
    }).select('_id');

    const employeeIds = employees.map(emp => emp._id);

    // Create announcement message for each employee
    const announcementPromises = employeeIds.map(employeeId => {
      return Message.create({
        sender: req.user.id,
        receiver: employeeId,
        company: req.user.company,
        content: content || '',
        fileUrl: fileUrl || '',
        fileName: fileName || '',
        fileType: fileType || 'other',
        isAnnouncement: true
      });
    });

    const announcements = await Promise.all(announcementPromises);

    // Emit announcement to all employees via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`company_${req.user.company}`).emit('announcement:receive', {
        announcements: announcements[0], // Just send one as example
        sender: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Announcement sent to all employees',
        announcements: announcements.length 
    });
  } catch (err) {
    console.error('Send announcement error:', err);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: message.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while sending announcement'
    });
  }
};

// @desc    Get unread messages count
// @route   GET /api/v1/messages/unread-count
// @access  Private
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user.id,
      readBy: { $ne: req.user.id },
      isAnnouncement: false
    });

    res.status(200).json({
      success: true,
       count
    });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread count'
    });
  }
};

// @desc    Get company contacts for messaging
// @route   GET /api/v1/messages/contacts
// @access  Private
exports.getContacts = async (req, res, next) => {
  try {
    // Get all users from the same company (excluding current user)
    const contacts = await User.find({
      company: req.user.company,
      _id: { $ne: req.user.id }
    }).select('_id name email role');

    // Get last message for each contact
    const contactsWithLastMessage = await Promise.all(
      contacts.map(async (contact) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: req.user.id, receiver: contact._id.toString() },
            { sender: contact._id.toString(), receiver: req.user.id }
          ],
          company: req.user.company,
          isAnnouncement: false
        })
        .sort({ createdAt: -1 })
        .populate('sender', 'name')
        .populate('receiver', 'name');

        // Get unread message count
        const unreadCount = await Message.countDocuments({
          sender: contact._id.toString(),
          receiver: req.user.id,
          readBy: { $ne: req.user.id },
          isAnnouncement: false
        });

        return {
          user: {
            id: contact._id.toString(),
            name: contact.name,
            email: contact.email,
            role: contact.role
          },
          lastMessage: lastMessage ? {
            id: lastMessage._id,
            content: lastMessage.content,
            sender: lastMessage.sender._id,
            receiver: lastMessage.receiver._id,
            createdAt: lastMessage.createdAt
          } : null,
          unreadCount
        };
      })
    );

    res.status(200).json({
      success: true,
      count: contactsWithLastMessage.length,
       contacts: contactsWithLastMessage
    });
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contacts'
    });
  }
};