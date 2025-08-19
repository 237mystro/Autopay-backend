const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const Payment = require('../models/Payment');

// @desc    Get all payrolls
// @route   GET /api/v1/payrolls
// @access  Private
exports.getPayrolls = async (req, res, next) => {
  try {
    const payrolls = await Payroll.find();

    res.status(200).json({
      success: true,
      count: payrolls.length,
      data: payrolls
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Get single payroll
// @route   GET /api/v1/payrolls/:id
// @access  Private
exports.getPayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payroll
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Create payroll
// @route   POST /api/v1/payrolls
// @access  Private
exports.createPayroll = async (req, res, next) => {
  try {
    const { period, startDate, endDate } = req.body;

    // Get all active employees
    const employees = await Employee.find({ status: 'active' });

    // Calculate payroll for each employee
    const payrollEmployees = [];
    let totalAmount = 0;
    let totalEmployees = 0;

    for (const employee of employees) {
      // Get shifts for this employee in the period
      const shifts = await Shift.find({
        employeeId: employee._id,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        status: 'completed'
      });

      if (shifts.length > 0) {
        const totalShifts = shifts.length;
        const totalHours = shifts.reduce((sum, shift) => {
          const start = new Date(`1970-01-01T${shift.startTime}`);
          const end = new Date(`1970-01-01T${shift.endTime}`);
          return sum + (end - start) / (1000 * 60 * 60);
        }, 0);
        
        const totalAmountForEmployee = totalShifts * employee.payPerShift;

        payrollEmployees.push({
          employeeId: employee._id,
          name: employee.name,
          position: employee.position,
          shifts: totalShifts,
          hours: totalHours,
          payPerShift: employee.payPerShift,
          totalAmount: totalAmountForEmployee
        });

        totalAmount += totalAmountForEmployee;
        totalEmployees++;
      }
    }

    // Create payroll record
    const payroll = await Payroll.create({
      period,
      startDate,
      endDate,
      employees: payrollEmployees,
      totalEmployees,
      totalAmount,
      processedBy: req.user.id,
      processedAt: Date.now()
    });

    res.status(201).json({
      success: true,
      data: payroll
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Process payroll payment
// @route   PUT /api/v1/payrolls/:id/process
// @access  Private
exports.processPayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    if (payroll.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Payroll has already been processed'
      });
    }

    // Update payroll status
    payroll.status = 'processed';
    payroll.paidAt = Date.now();
    await payroll.save();

    res.status(200).json({
      success: true,
      data: payroll
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};