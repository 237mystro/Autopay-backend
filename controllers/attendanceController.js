// backend/controllers/attendanceController.js
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const User = require('../models/User');
const { verifyLocation, formatDistance } = require('../utils/locationVerification');

// Company location in DMS format (4°08'49.9"N 9°17'08.8"E)
const COMPANY_LOCATION_DMS = "4°08'49.9\"N 9°17'08.8\"E";
const MAX_DISTANCE_METERS = 20; // 20 meters

// ===============================
// @desc    Process employee check-in with QR code + location
// @route   POST /api/v1/attendance/checkin
// @access  Private (Employee)
// ===============================
exports.checkIn = async (req, res) => {
  try {
    const { qrData, userLocation } = req.body;

    if (!qrData || !userLocation) {
      return res.status(400).json({
        success: false,
        message: 'Please provide QR code data and location'
      });
    }

    // Parse QR data
    let parsedQRData;
    try {
      parsedQRData = JSON.parse(qrData);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    // Verify QR contains required fields
    if (!parsedQRData.shiftId || !parsedQRData.token) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code data'
      });
    }

    // Find the shift
    const shift = await Shift.findById(parsedQRData.shiftId).populate('employeeId');
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Verify QR token
    if (parsedQRData.token !== shift.qrToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code token'
      });
    }

    // Expiration check (5 min)
    const qrTimestamp = new Date(parsedQRData.timestamp);
    if (Date.now() - qrTimestamp > 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'QR code has expired'
      });
    }

    // Verify company match
    const employeeUser = await User.findById(shift.employeeId.userId);
    if (employeeUser.company !== req.user.company) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to check in for this shift'
      });
    }

    // Verify location
    const locationResult = verifyLocation(userLocation, COMPANY_LOCATION_DMS, MAX_DISTANCE_METERS);
    if (!locationResult.allowed) {
      return res.status(400).json({
        success: false,
        message: `You are ${formatDistance(locationResult.distance)} away from the office. Max allowed is ${MAX_DISTANCE_METERS}m.`
      });
    }

    // Check attendance for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let attendance = await Attendance.findOne({
      employeeId: shift.employeeId._id,
      date: { $gte: today, $lt: tomorrow }
    });

    const checkInTime = new Date();
    const shiftStart = new Date(`${shift.date.split('T')[0]}T${shift.startTime}`);
    const status = checkInTime > shiftStart ? 'late' : 'present';

    if (attendance) {
      // Update existing record
      attendance.checkInTime = checkInTime;
      attendance.status = status;
      attendance.location = {
        type: 'Point',
        coordinates: [userLocation.longitude, userLocation.latitude]
      };
      attendance.qrData = qrData;
      attendance.updatedAt = Date.now();
      await attendance.save();
    } else {
      // Create new record
      attendance = await Attendance.create({
        employeeId: shift.employeeId._id,
        shiftId: shift._id,
        date: today,
        checkInTime,
        status,
        location: {
          type: 'Point',
          coordinates: [userLocation.longitude, userLocation.latitude]
        },
        qrData
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
      data: {
        attendance,
        shift
      }
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during check-in'
    });
  }
};

// ===============================
// @desc    Get attendance records (Admin dashboard)
// @route   GET /api/v1/attendance
// @access  Private (Admin/HR)
// ===============================
exports.getAttendance = async (req, res) => {
  try {
    // Get employees for same company
    const employees = await Employee.find({ 
      userId: { $in: await User.find({ company: req.user.company }).distinct('_id') }
    });

    const employeeIds = employees.map(emp => emp._id);

    // Today range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Attendance records
    const todaysAttendance = await Attendance.find({ 
      employeeId: { $in: employeeIds },
      date: { $gte: today, $lt: tomorrow }
    }).populate('employeeId', 'name position');

    // Summary
    const presentCount = todaysAttendance.filter(a => a.status === 'present').length;
    const lateCount = todaysAttendance.filter(a => a.status === 'late').length;
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
