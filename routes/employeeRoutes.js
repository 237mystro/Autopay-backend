// backend/routes/employeeRoutes.js
const express = require('express');
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'hr'), getEmployees)
  .post(protect, authorize('admin', 'hr'), createEmployee);

router.route('/:id')
  .get(protect, authorize('admin', 'hr'), getEmployee)
  .put(protect, authorize('admin', 'hr'), updateEmployee)
  .delete(protect, authorize('admin', 'hr'), deleteEmployee);

module.exports = router;