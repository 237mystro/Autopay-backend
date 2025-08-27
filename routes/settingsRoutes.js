// backend/routes/settingsRoutes.js
const express = require('express');
const {
  getSettings,
  updateSettings,
  updateProfile,
  changePassword
} = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getSettings)
  .put(protect, updateSettings);

router.route('/profile')
  .put(protect, updateProfile);

router.route('/change-password')
  .put(protect, changePassword);

module.exports = router;