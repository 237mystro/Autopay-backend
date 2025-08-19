const express = require('express');
const {
  getPayrolls,
  getPayroll,
  createPayroll,
  processPayroll
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'hr'), getPayrolls)
  .post(protect, authorize('admin', 'hr'), createPayroll);

router.route('/:id')
  .get(protect, authorize('admin', 'hr'), getPayroll);

router.route('/:id/process')
  .put(protect, authorize('admin', 'hr'), processPayroll);

module.exports = router;