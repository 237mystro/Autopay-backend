// backend/controllers/employeeController.js (corrected & cleaned)
const User = require('../models/User');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { sendEmployeeCredentials } = require('../utils/emailService');

// @desc    Get all employees for the admin's company
// @route   GET /api/v1/employees
// @access  Private (Admin/HR)
exports.getEmployees = async (req, res) => {
  try {

      // Only get employees from the same company
    const employees = await Employee.find({ 
      userId: { $in: await User.find({ company: req.user.company }).distinct('_id') }
    }).populate('userId', 'name email');
    
    // Add shift count to each employee
    const employeesWithShifts = await Promise.all(employees.map(async (employee) => {
      const shiftCount = await Shift.countDocuments({ employeeId: employee._id });
      return {
        ...employee.toObject(),
        shifts: shiftCount
      };
    }));

    res.status(200).json({
      success: true,
      count: employeesWithShifts.length,
      data: employeesWithShifts   // ✅ fixed
    });
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employees'
    });
  }
};

// @desc    Create new employee with shifts and pay
// @route   POST /api/v1/employees
// @access  Private (Admin/HR)
exports.createEmployee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { name, email, phone, momoNumber, position, department, salary, payPerShift, shifts } = req.body;

    if (!name || !email || !phone || !momoNumber || !position || salary === undefined || payPerShift === undefined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate simple 6-character password
    const tempPassword = crypto.randomBytes(4).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);

    const user = new User({
      name,
      email,
      password: tempPassword,
      company: req.user.company,
      role: 'employee',
      momoNumber,
      position
    });
    await user.save({ session });

    const employee = new Employee({
      userId: user._id,
      employeeId: `EMP${Date.now()}`,
      name,
      email,
      phone,
      momoNumber,
      position,
      department: department || '',
      salary,
      payPerShift
    });
    await employee.save({ session });

    let createdShifts = [];
    if (shifts && Array.isArray(shifts) && shifts.length > 0) {
      const validShifts = shifts.filter(s => s.day && s.startTime && s.endTime && s.date);
      if (validShifts.length > 0) {
        const shiftDocs = validShifts.map(shift => ({
          employeeId: employee._id,
          date: new Date(shift.date),
          day: shift.day,
          startTime: shift.startTime,
          endTime: shift.endTime,
          status: 'scheduled'
        }));
        createdShifts = await Shift.insertMany(shiftDocs, { session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    const emailResult = await sendEmployeeCredentials(email, name, tempPassword, req.user.company);

    res.status(201).json({
      success: true,
      message: 'Employee account created successfully with shifts',
      data: {   // ✅ fixed
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        employee,
        shifts: createdShifts,
        temporaryPassword: tempPassword
      },
      emailSent: emailResult.success
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ Create employee error:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: message.join(', ') });
    }
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    res.status(500).json({ success: false, message: 'Server error while creating employee: ' + err.message });
  }
};

// @desc    Get single employee with shifts
// @route   GET /api/v1/employees/:id
// @access  Private (Admin/HR)
exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('userId', 'name email');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const user = await User.findById(employee.userId);
    if (user.company !== req.user.company) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this employee' });
    }

    const shifts = await Shift.find({ employeeId: employee._id });

    res.status(200).json({
      success: true,
      data: {   // ✅ fixed
        employee,
        shifts
      }
    });
  } catch (err) {
    console.error('Get employee error:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching employee' });
  }
};

// @desc    Update employee
// @route   PUT /api/v1/employees/:id
// @access  Private (Admin/HR)
exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const user = await User.findById(employee.userId);
    if (user.company !== req.user.company) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this employee' });
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (req.body.momoNumber || req.body.position) {
      await User.findByIdAndUpdate(employee.userId, {
        momoNumber: req.body.momoNumber,
        position: req.body.position
      }, { runValidators: true });
    }

    res.status(200).json({
      success: true,
      data: updatedEmployee   // ✅ fixed
    });
  } catch (err) {
    console.error('Update employee error:', err);
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: message.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Server error while updating employee' });
  }
};

// @desc    Delete employee
// @route   DELETE /api/v1/employees/:id
// @access  Private (Admin/HR)
exports.deleteEmployee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const employee = await Employee.findById(req.params.id).session(session);

    if (!employee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const user = await User.findById(employee.userId).session(session);
    if (user.company !== req.user.company) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Not authorized to delete this employee' });
    }

    await Employee.deleteOne({ _id: employee._id }).session(session);
    await User.deleteOne({ _id: employee.userId }).session(session);
    await Shift.deleteMany({ employeeId: employee._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Delete employee error:', err);
    res.status(500).json({ success: false, message: 'Server error while deleting employee' });
  }
};
