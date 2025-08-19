const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  day: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'missed'],
    default: 'scheduled'
  },
  qrCode: {
    type: String
  },
  qrExpiry: {
    type: Date
  },
  checkInTime: {
    type: Date
  },
  checkOutTime: {
    type: Date
  },
  // Location data for the shift
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    radius: {
      type: Number, // in meters
      default: 100
    }
  },
  // Actual check-in location
  checkInLocation: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: {
      type: [Number] // [longitude, latitude]
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Shift', ShiftSchema);