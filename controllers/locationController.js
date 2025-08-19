const Location = require('../models/Location');
const { generateLocationQRCode } = require('../utils/qrcode');

// @desc    Get all locations
// @route   GET /api/v1/locations
// @access  Private (Admin/HR)
exports.getLocations = async (req, res, next) => {
  try {
    const locations = await Location.find();

    res.status(200).json({
      success: true,
      count: locations.length,
      data: locations
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Get single location
// @route   GET /api/v1/locations/:id
// @access  Private (Admin/HR)
exports.getLocation = async (req, res, next) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    res.status(200).json({
      success: true,
      data: location
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Create new location
// @route   POST /api/v1/locations
// @access  Private (Admin/HR)
exports.createLocation = async (req, res, next) => {
  try {
    const { name, address, location, radius } = req.body;

    // Create location
    const newLocation = await Location.create({
      name,
      address,
      location,
      radius
    });

    // Generate QR code for the location
    const { qrCode } = await generateLocationQRCode(newLocation._id);
    newLocation.qrCode = qrCode;
    await newLocation.save();

    res.status(201).json({
      success: true,
      data: newLocation
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Update location
// @route   PUT /api/v1/locations/:id
// @access  Private (Admin/HR)
exports.updateLocation = async (req, res, next) => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Regenerate QR code if location changed
    if (req.body.location || req.body.radius) {
      const { qrCode } = await generateLocationQRCode(location._id);
      location.qrCode = qrCode;
      await location.save();
    }

    res.status(200).json({
      success: true,
      data: location
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Delete location
// @route   DELETE /api/v1/locations/:id
// @access  Private (Admin/HR)
exports.deleteLocation = async (req, res, next) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    await location.remove();

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

// @desc    Get QR code for location
// @route   GET /api/v1/locations/:id/qrcode
// @access  Private (Admin/HR)
exports.getLocationQRCode = async (req, res, next) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Generate new QR code
    const { qrCode } = await generateLocationQRCode(location._id);

    res.status(200).json({
      success: true,
      data: {
        qrCode,
        location: location.name
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};