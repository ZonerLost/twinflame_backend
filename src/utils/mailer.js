const nodemailer = require("nodemailer");

// Create transporter using Gmail SMTP
// For Gmail: enable 2FA, then create an App Password at
// https://myaccount.google.com/apppasswords
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD, // Gmail App Password (not your regular password)
  },
});

async function sendOTPEmail(to, otp) {
  // If SMTP is not configured, just log to console
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.log(`\n========================================`);
    console.log(`  OTP for ${to}: ${otp}`);
    console.log(`  (Set SMTP_EMAIL & SMTP_PASSWORD in .env to send real emails)`);
    console.log(`========================================\n`);
    return;
  }

  const mailOptions = {
    from: `"Twin Flame" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: "Your Verification Code - Twin Flame",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #FE5F8C; text-align: center;">Twin Flame</h2>
        <p style="font-size: 16px; color: #333;">Your verification code is:</p>
        <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #FE5F8C;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #666;">This code expires in 5 minutes. Do not share it with anyone.</p>
        <p style="font-size: 12px; color: #999; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${to}`);
  } catch (err) {
    console.error(`Failed to send OTP email to ${to}:`, err.message);
    // Still log OTP to console as fallback
    console.log(`\n========================================`);
    console.log(`  OTP for ${to}: ${otp}`);
    console.log(`  (Email send failed — using console fallback)`);
    console.log(`========================================\n`);
  }
}

module.exports = { sendOTPEmail };
