const express = require('express');
const {
  getShifts,
  getShift,
  createShift,
  updateShift,
  deleteShift,
  checkIn,
  checkOut
} = require('../controllers/scheduleController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'hr'), getShifts)
  .post(protect, authorize('admin', 'hr'), createShift);

router.route('/:id')
  .get(protect, authorize('admin', 'hr'), getShift)
  .put(protect, authorize('admin', 'hr'), updateShift)
  .delete(protect, authorize('admin', 'hr'), deleteShift);

router.route('/:id/checkin')
  .post(protect, checkIn);

router.route('/:id/checkout')
  .post(protect, checkOut);

module.exports = router;