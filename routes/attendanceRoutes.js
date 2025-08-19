// backend/routes/attendanceRoutes.js
const express = require('express');
const {
  checkIn,
  checkOut,
  getAttendanceByDate,
  getAttendanceSummary
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/checkin')
  .post(protect, checkIn);

router.route('/checkout')
  .post(protect, checkOut);

router.route('/')
  .get(protect, authorize('admin', 'hr'), getAttendanceByDate);

router.route('/summary')
  .get(protect, authorize('admin', 'hr'), getAttendanceSummary);

module.exports = router;