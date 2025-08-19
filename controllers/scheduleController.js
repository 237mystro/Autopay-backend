const Shift = require('../models/Shift');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const { generateShiftQRCode } = require('../utils/qrcode');
const { verifyQRCode } = require('../utils/qrcode');
const { isPointWithinRadius } = require('geolib');

// @desc    Get all shifts
// @route   GET /api/v1/schedules
// @access  Private
exports.getShifts = async (req, res, next) => {
  try {
    const shifts = await Shift.find().populate('employeeId', 'name position');

    res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Get single shift
// @route   GET /api/v1/schedules/:id
// @access  Private
exports.getShift = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('employeeId', 'name position');

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    res.status(200).json({
      success: true,
      data: shift
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Create new shift
// @route   POST /api/v1/schedules
// @access  Private
exports.createShift = async (req, res, next) => {
  try {
    const { employeeId, date, day, startTime, endTime, location } = req.body;

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if location exists
    const locationDoc = await Location.findById(location._id);
    if (!locationDoc) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Create shift with location data
    const shift = await Shift.create({
      employeeId,
      date,
      day,
      startTime,
      endTime,
      location: {
        type: 'Point',
        coordinates: [location.coordinates.longitude, location.coordinates.latitude],
        name: location.name,
        radius: location.radius || 100
      }
    });

    // Generate QR code for the shift
    const { qrCode, token } = await generateShiftQRCode(shift._id, location._id);
    shift.qrCode = qrCode;
    shift.qrToken = token;
    
    // Set QR expiry (1 hour after shift start)
    const shiftStart = new Date(date);
    const [startHours, startMinutes] = startTime.split(':');
    shiftStart.setHours(parseInt(startHours), parseInt(startMinutes), 0, 0);
    shift.qrExpiry = new Date(shiftStart.getTime() + 60 * 60 * 1000);
    
    await shift.save();

    // Populate employee details
    await shift.populate('employeeId', 'name position');

    res.status(201).json({
      success: true,
      data: shift
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Update shift
// @route   PUT /api/v1/schedules/:id
// @access  Private
exports.updateShift = async (req, res, next) => {
  try {
    const shift = await Shift.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('employeeId', 'name position');

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    res.status(200).json({
      success: true,
      data: shift
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Delete shift
// @route   DELETE /api/v1/schedules/:id
// @access  Private
exports.deleteShift = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    await shift.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Employee check-in with QR code and location verification
// @route   POST /api/v1/schedules/:id/checkin
// @access  Private
exports.checkIn = async (req, res, next) => {
  try {
    const { qrData, userLocation } = req.body;
    const shiftId = req.params.id;

    // Find the shift
    const shift = await Shift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Verify QR code
    const verification = verifyQRCode(qrData, shiftId);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // Check if QR code has expired
    if (new Date() > shift.qrExpiry) {
      return res.status(400).json({
        success: false,
        message: 'QR code has expired'
      });
    }

    // Verify location
    const shiftLocation = {
      longitude: shift.location.coordinates[0],
      latitude: shift.location.coordinates[1]
    };
    
    const employeeLocation = {
      longitude: userLocation.longitude,
      latitude: userLocation.latitude
    };
    
    const distance = isPointWithinRadius(
      employeeLocation,
      shiftLocation,
      shift.location.radius
    );
    
    if (!distance) {
      return res.status(400).json({
        success: false,
        message: `You are too far from ${shift.location.name}. Distance: ${distance} meters`
      });
    }

    // Record check-in
    shift.checkInTime = new Date();
    shift.status = 'in-progress';
    shift.checkInLocation = {
      type: 'Point',
      coordinates: [userLocation.longitude, userLocation.latitude]
    };
    await shift.save();

    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      data: shift
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Employee check-out
// @route   POST /api/v1/schedules/:id/checkout
// @access  Private
exports.checkOut = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Record check-out
    shift.checkOutTime = new Date();
    shift.status = 'completed';
    await shift.save();

    res.status(200).json({
      success: true,
      message: 'Check-out successful',
      data: shift
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Get QR code for shift
// @route   GET /api/v1/schedules/:id/qrcode
// @access  Private (Admin/HR)
exports.getShiftQRCode = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Generate new QR code
    const { qrCode } = await generateShiftQRCode(shift._id, shift.location._id);

    res.status(200).json({
      success: true,
      data: {
        qrCode,
        shiftId: shift._id
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};