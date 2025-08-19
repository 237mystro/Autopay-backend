// backend/utils/emailService.js
const nodemailer = require('nodemailer');

// Create transporter (configure with your email service)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER, // Your emfail
      pass: process.env.EMAIL_PASS  // Your email password or app password
    }
  });
};

// Send employee credentials email
const sendEmployeeCredentials = async (employeeEmail, employeeName, tempPassword, companyName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: employeeEmail,
      subject: `Welcome to ${companyName} - AutoPayroll Account`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Welcome to AutoPayroll</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #1976d2; margin: 0;">AutoPayroll</h1>
                    <p style="color: #666; margin: 10px 0 0 0;">Automated Payroll Management</p>
                </div>
                
                <h2 style="color: #333;">Welcome, ${employeeName}!</h2>
                
                <p>Your account has been created by your administrator at <strong>${companyName}</strong>.</p>
                
                <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 25px 0;">
                    <h3 style="margin-top: 0; color: #1976d2;">Your Login Credentials:</h3>
                    <p style="margin: 10px 0;"><strong>Email:</strong> ${employeeEmail}</p>
                    <p style="margin: 10px 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
                </div>
                
                <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 25px 0; border-left: 4px solid #ff9800;">
                    <p style="margin: 0;"><strong>⚠️ Important:</strong> Please change your password immediately after logging in for security.</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                       style="background-color: #1976d2; color: white; padding: 15px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;
                              font-weight: bold; font-size: 16px;">
                        Login to AutoPayroll
                    </a>
                </div>
                
                <p>If you have any questions, please contact your HR administrator.</p>
                <p>Best regards,<br/><strong>The AutoPayroll Team</strong></p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; text-align: center;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Credentials email sent successfully to:', employeeEmail);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending credentials email to:', employeeEmail, error);
    return { success: false, error: error.message };
  }
};

// Send password reset email (bonus feature)
const sendPasswordReset = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'AutoPayroll - Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Password Reset Request</h2>
          <p>You have requested to reset your password. Click the button below to reset it:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p>If you didn't request this, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
          
          <p>Best regards,<br/>The AutoPayroll Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmployeeCredentials,
  sendPasswordReset
};