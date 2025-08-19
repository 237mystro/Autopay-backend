const crypto = require('crypto');

// Mock MTN MoMo payment processing
const processMTNPayment = async (momoNumber, amount) => {
  try {
    // In a real implementation, this would call the MTN MoMo API
    // This is a mock implementation for demonstration
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock transaction ID
    const transactionId = `MTN_${crypto.randomBytes(10).toString('hex')}`;
    
    // Simulate success/failure
    const success = Math.random() > 0.1; // 90% success rate
    
    if (success) {
      return {
        success: true,
        transactionId,
        momoReference: `REF_${crypto.randomBytes(8).toString('hex')}`,
        receiptUrl: `https://receipts.mtn.com/${transactionId}`
      };
    } else {
      return {
        success: false,
        message: 'Payment failed. Please try again.'
      };
    }
  } catch (err) {
    return {
      success: false,
      message: 'Payment processing error'
    };
  }
};

// Mock Orange Money payment processing
const processOrangePayment = async (momoNumber, amount) => {
  try {
    // In a real implementation, this would call the Orange Money API
    // This is a mock implementation for demonstration
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock transaction ID
    const transactionId = `ORANGE_${crypto.randomBytes(10).toString('hex')}`;
    
    // Simulate success/failure
    const success = Math.random() > 0.1; // 90% success rate
    
    if (success) {
      return {
        success: true,
        transactionId,
        momoReference: `REF_${crypto.randomBytes(8).toString('hex')}`,
        receiptUrl: `https://receipts.orange.com/${transactionId}`
      };
    } else {
      return {
        success: false,
        message: 'Payment failed. Please try again.'
      };
    }
  } catch (err) {
    return {
      success: false,
      message: 'Payment processing error'
    };
  }
};

// Helper function to generate employee ID
const generateEmployeeId = () => {
  return `EMP${Date.now()}${Math.floor(Math.random() * 1000)}`;
};

module.exports = {
  processMTNPayment,
  processOrangePayment,
  generateEmployeeId
};