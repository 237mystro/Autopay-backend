const QRCode = require('qrcode');
const crypto = require('crypto');

// Generate QR code for a shift
const generateShiftQRCode = async (shiftId, locationId) => {
  try {
    // Create a unique token for this shift
    const token = crypto.randomBytes(32).toString('hex');
    
    // Create QR data with shift ID and token
    const qrData = JSON.stringify({
      shiftId,
      locationId,
      token,
      timestamp: Date.now()
    });
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    return {
      qrCode,
      token
    };
  } catch (err) {
    throw new Error('Error generating QR code');
  }
};

// Generate QR code for a location
const generateLocationQRCode = async (locationId) => {
  try {
    // Create a unique token for this location
    const token = crypto.randomBytes(32).toString('hex');
    
    // Create QR data with location ID and token
    const qrData = JSON.stringify({
      locationId,
      token,
      timestamp: Date.now()
    });
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    return {
      qrCode,
      token
    };
  } catch (err) {
    throw new Error('Error generating QR code');
  }
};

// Verify QR code data
const verifyQRCode = (qrData, expectedShiftId) => {
  try {
    const data = JSON.parse(qrData);
    
    // Check if it's for the correct shift
    if (data.shiftId !== expectedShiftId) {
      return { valid: false, message: 'Invalid QR code for this shift' };
    }
    
    // Check if it's not expired (5 minutes)
    const now = Date.now();
    if (now - data.timestamp > 5 * 60 * 1000) {
      return { valid: false, message: 'QR code has expired' };
    }
    
    return { valid: true, data };
  } catch (err) {
    return { valid: false, message: 'Invalid QR code' };
  }
};

module.exports = {
  generateShiftQRCode,
  generateLocationQRCode,
  verifyQRCode
};