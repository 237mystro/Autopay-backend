const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  payrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'XOF'
  },
  paymentMethod: {
    type: String,
    enum: ['mtn', 'orange', 'bank'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  momoReference: {
    type: String
  },
  receiptUrl: {
    type: String
  },
  paidAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', PaymentSchema);