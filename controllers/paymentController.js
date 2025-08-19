const Payment = require('../models/Payment');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const { processMTNPayment, processOrangePayment } = require('../utils/momo');

// @desc    Get all payments
// @route   GET /api/v1/payments
// @access  Private
exports.getPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find().populate('employeeId', 'name position');

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Get single payment
// @route   GET /api/v1/payments/:id
// @access  Private
exports.getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('employeeId', 'name position');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Process payment to employee
// @route   POST /api/v1/payments
// @access  Private
exports.processPayment = async (req, res, next) => {
  try {
    const { employeeId, amount, paymentMethod, payrollId } = req.body;

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if employee has MoMo number
    if (!employee.momoNumber) {
      return res.status(400).json({
        success: false,
        message: 'Employee does not have a mobile money number'
      });
    }

    // Process payment based on method
    let transactionResult;
    if (paymentMethod === 'mtn') {
      transactionResult = await processMTNPayment(employee.momoNumber, amount);
    } else if (paymentMethod === 'orange') {
      transactionResult = await processOrangePayment(employee.momoNumber, amount);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    if (!transactionResult.success) {
      return res.status(400).json({
        success: false,
        message: transactionResult.message
      });
    }

    // Create payment record
    const payment = await Payment.create({
      employeeId,
      payrollId,
      amount,
      paymentMethod,
      transactionId: transactionResult.transactionId,
      status: 'completed',
      momoReference: transactionResult.momoReference,
      receiptUrl: transactionResult.receiptUrl,
      paidAt: Date.now()
    });

    // Populate employee details
    await payment.populate('employeeId', 'name position');

    res.status(201).json({
      success: true,
      data: payment
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};