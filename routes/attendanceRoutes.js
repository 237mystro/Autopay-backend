// backend/routes/attendanceRoutes.js (updated)
const express = require('express');
const {
  checkIn,
  getAttendance,
  getAdminAttendanceDashboard
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Employee routes
router.route('/checkin')
  .post(protect, authorize('employee'), checkIn);

router.route('/')
  .get(protect, authorize('employee'), getAttendance);

// Admin routes
router.route('/admin-dashboard')
  .get(protect, authorize('admin', 'hr'), getAdminAttendanceDashboard);

module.exports = router;