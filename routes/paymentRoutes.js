const express = require('express');
const {
  getPayments,
  getPayment,
  processPayment
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'hr'), getPayments)
  .post(protect, authorize('admin', 'hr'), processPayment);

router.route('/:id')
  .get(protect, authorize('admin', 'hr'), getPayment);

module.exports = router;