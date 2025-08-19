// backend/controllers/attendanceController.js
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const { verifyQRData } = require('../utils/qrcode');
const { isPointWithinRadius } = require('geolib');

// @desc    Process employee check-in
// @route   POST /api/v1/attendance/checkin
// @access  Private
exports.checkIn = async (req, res, next) => {
  try {
    const { qrData, userLocation } = req.body;
    
    // Verify QR code data
    const verification = verifyQRData(qrData);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }
    
    const { shiftId, token } = verification.data;
    
    // Find the shift
    const shift = await Shift.findById(shiftId).populate('employeeId');
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
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
    
    // Check if attendance record already exists for this employee and date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let attendance = await Attendance.findOne({
      employeeId: shift.employeeId._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    const checkInTime = new Date();
    
    if (attendance) {
      // Update existing attendance record
      attendance.checkInTime = checkInTime;
      attendance.status = checkInTime > new Date(`${shift.date}T${shift.startTime}`) ? 'late' : 'present';
      attendance.location = {
        type: 'Point',
        coordinates: [userLocation.longitude, userLocation.latitude]
      };
      attendance.qrData = qrData;
      attendance.updatedAt = Date.now();
      await attendance.save();
    } else {
      // Create new attendance record
      const shiftStart = new Date(`${shift.date}T${shift.startTime}`);
      const status = checkInTime > shiftStart ? 'late' : 'present';
      
      attendance = await Attendance.create({
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
      });
    }
    
    // Update shift status
    shift.checkInTime = checkInTime;
    shift.status = 'in-progress';
    shift.checkInLocation = {
      type: 'Point',
      coordinates: [userLocation.longitude, userLocation.latitude]
    };
    await shift.save();
    
    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      data: attendance
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Process employee check-out
// @route   POST /api/v1/attendance/checkout
// @access  Private
exports.checkOut = async (req, res, next) => {
  try {
    const { shiftId, userLocation } = req.body;
    
    // Find the shift
    const shift = await Shift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }
    
    // Check if attendance record exists
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const attendance = await Attendance.findOne({
      employeeId: shift.employeeId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No check-in record found for today'
      });
    }
    
    const checkOutTime = new Date();
    
    // Update attendance record
    attendance.checkOutTime = checkOutTime;
    attendance.updatedAt = Date.now();
    await attendance.save();
    
    // Update shift status
    shift.checkOutTime = checkOutTime;
    shift.status = 'completed';
    await shift.save();
    
    res.status(200).json({
      success: true,
      message: 'Check-out successful',
      data: attendance
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Get attendance records for a specific date
// @route   GET /api/v1/attendance?date=:date
// @access  Private (Admin/HR)
exports.getAttendanceByDate = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    date.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    
    // Get all attendance records for the date
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: date,
        $lt: nextDay
      }
    }).populate('employeeId', 'name position');
    
    // Get all employees scheduled for today
    const scheduledEmployees = await Shift.find({
      date: {
        $gte: date,
        $lt: nextDay
      }
    }).populate('employeeId', 'name position');
    
    // Combine attendance and scheduled employees
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.employeeId._id.toString()] = record;
    });
    
    const attendanceReport = scheduledEmployees.map(shift => {
      const attendance = attendanceMap[shift.employeeId._id.toString()];
      
      return {
        employeeId: shift.employeeId._id,
        name: shift.employeeId.name,
        position: shift.employeeId.position,
        shiftId: shift._id,
        shiftStart: shift.startTime,
        shiftEnd: shift.endTime,
        checkInTime: attendance ? attendance.checkInTime : null,
        checkOutTime: attendance ? attendance.checkOutTime : null,
        status: attendance ? attendance.status : 'absent',
        location: attendance ? attendance.location : null
      };
    });
    
    res.status(200).json({
      success: true,
      count: attendanceReport.length,
      data: attendanceReport
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Get attendance summary
// @route   GET /api/v1/attendance/summary
// @access  Private (Admin/HR)
exports.getAttendanceSummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const summary = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format summary
    const result = {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0
    };
    
    summary.forEach(item => {
      result[item._id] = item.count;
    });
    
    // Get total scheduled employees
    const totalScheduled = await Shift.countDocuments({
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    result.totalScheduled = totalScheduled;
    result.attendanceRate = totalScheduled > 0 ? 
      Math.round(((result.present + result.late) / totalScheduled) * 100) : 0;
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};