// backend/controllers/attendanceController.js (debugged and fixed)
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const User = require('../models/User');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { calculateDistance } = require('../utils/location');

// Office location coordinates (default - should be configurable)
const OFFICE_LOCATION = {
  latitude: parseFloat(process.env.OFFICE_LATITUDE) || 8.147194,
  longitude: parseFloat(process.env.OFFICE_LONGITUDE) || 9.285777
};
const MAX_DISTANCE = parseInt(process.env.MAX_CHECKIN_DISTANCE) || 20; // 20 meters

// ------------------ CHECK IN ------------------
exports.checkIn = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { qrData, userLocation } = req.body;

    if (!qrData || !userLocation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Please provide QR code data and location'
      });
    }

    let parsedQRData;
    try {
      parsedQRData = JSON.parse(qrData);
    } catch {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    if (!parsedQRData.shiftId || !parsedQRData.token) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code data'
      });
    }

    const shift = await Shift.findById(parsedQRData.shiftId)
      .populate('employeeId')
      .session(session);

    if (!shift) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    if (parsedQRData.token !== shift.qrToken) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code token'
      });
    }

    const qrTimestamp = new Date(parsedQRData.timestamp);
    const now = new Date();
    if (now - qrTimestamp > 5 * 60 * 1000) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'QR code has expired'
      });
    }

    const employeeUser = await User.findById(shift.employeeId.userId).session(session);
    if (!employeeUser || employeeUser.company !== req.user.company) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to check in for this shift'
      });
    }

    const distance = calculateDistance(userLocation, OFFICE_LOCATION);
    if (distance > MAX_DISTANCE) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `You are ${Math.round(distance)} meters away from the office. Maximum allowed distance is ${MAX_DISTANCE} meters.`
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let attendance = await Attendance.findOne({
      employeeId: shift.employeeId._id,
      date: { $gte: today, $lt: tomorrow }
    }).session(session);

    const checkInTime = new Date();

    if (attendance) {
      attendance.checkInTime = checkInTime;
      attendance.status = checkInTime > new Date(`${shift.date.split('T')[0]}T${shift.startTime}`) ? 'late' : 'present';
      attendance.location = {
        type: 'Point',
        coordinates: [userLocation.longitude, userLocation.latitude]
      };
      attendance.qrData = qrData;
      attendance.updatedAt = Date.now();
      await attendance.save({ session });
    } else {
      const shiftStart = new Date(`${shift.date.split('T')[0]}T${shift.startTime}`);
      const status = checkInTime > shiftStart ? 'late' : 'present';
      
      attendance = await Attendance.create([{
        employeeId: shift.employeeId._id,
        shiftId: shift._id,
        date: today,
        checkInTime: checkInTime,
        status: status,
        location: {
          type: 'Point',
          coordinates: [userLocation.longitude, userLocation.latitude]
        },
        qrData: qrData
      }], { session });
      
      attendance = attendance[0];
    }

    shift.checkInTime = checkInTime;
    shift.status = 'in-progress';
    shift.checkInLocation = {
      type: 'Point',
      coordinates: [userLocation.longitude, userLocation.latitude]
    };
    await shift.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      data: { attendance, shift }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Check-in error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during check-in'
    });
  }
};

// ------------------ CHECK OUT ------------------
exports.checkOut = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { shiftId, userLocation } = req.body;

    if (!shiftId || !userLocation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Please provide shift ID and location'
      });
    }

    const shift = await Shift.findById(shiftId)
      .populate('employeeId')
      .session(session);

    if (!shift) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    const employeeUser = await User.findById(shift.employeeId.userId).session(session);
    if (!employeeUser || employeeUser.company !== req.user.company) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to check out for this shift'
      });
    }

    const distance = calculateDistance(userLocation, OFFICE_LOCATION);
    if (distance > MAX_DISTANCE) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `You are ${Math.round(distance)} meters away from the office. Maximum allowed distance is ${MAX_DISTANCE} meters.`
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let attendance = await Attendance.findOne({
      employeeId: shift.employeeId._id,
      date: { $gte: today, $lt: tomorrow }
    }).session(session);

    if (!attendance) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'No check-in record found for today'
      });
    }

    const checkOutTime = new Date();

    attendance.checkOutTime = checkOutTime;
    attendance.updatedAt = Date.now();
    await attendance.save({ session });

    shift.checkOutTime = checkOutTime;
    shift.status = 'completed';
    await shift.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Check-out successful',
      data: { attendance, shift }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Check-out error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during check-out'
    });
  }
};

// ------------------ GET ATTENDANCE ------------------
exports.getAttendance = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ userId: req.user.id });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found'
      });
    }

    const attendance = await Attendance.find({ employeeId: employee._id })
      .sort({ date: -1 })
      .limit(30);

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance records'
    });
  }
};

// ------------------ ADMIN DASHBOARD ------------------
exports.getAdminAttendanceDashboard = async (req, res, next) => {
  try {
    const employees = await Employee.find({ 
      userId: { $in: await User.find({ company: req.user.company }).distinct('_id') }
    });

    const employeeIds = employees.map(emp => emp._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysAttendance = await Attendance.find({ 
      employeeId: { $in: employeeIds },
      date: { $gte: today, $lt: tomorrow }
    }).populate('employeeId', 'name position');

    const presentCount = todaysAttendance.filter(att => att.status === 'present').length;
    const lateCount = todaysAttendance.filter(att => att.status === 'late').length;
    const absentCount = employees.length - presentCount - lateCount;

    res.status(200).json({
      success: true,
      data: {
        totalEmployees: employees.length,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        attendance: todaysAttendance
      }
    });
  } catch (err) {
    console.error('Admin attendance dashboard error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance dashboard'
    });
  }
};

// ------------------ GENERATE QR ------------------
exports.generateQRCode = async (req, res, next) => {
  try {
    const { shiftId } = req.body;

    if (!shiftId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide shift ID'
      });
    }

    const shift = await Shift.findById(shiftId).populate('employeeId');

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    const employeeUser = await User.findById(shift.employeeId.userId);
    if (employeeUser.company !== req.user.company) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate QR code for this shift'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();

    shift.qrToken = token;
    shift.qrGeneratedAt = timestamp;
    await shift.save();

    const qrData = JSON.stringify({
      shiftId: shift._id,
      token,
      timestamp
    });

    res.status(200).json({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrData,
        shiftId: shift._id,
        expiresAt: new Date(timestamp + 5 * 60 * 1000)
      }
    });
  } catch (err) {
    console.error('Generate QR code error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while generating QR code'
    });
  }
};
