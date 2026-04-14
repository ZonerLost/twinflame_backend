const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendOTPEmail(to, otp) {
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
    console.log(`\n========================================`);
    console.log(`  OTP for ${to}: ${otp}`);
    console.log(`  (Email send failed - using console fallback)`);
    console.log(`========================================\n`);
  }
}

async function sendPasswordResetApprovalEmail(
  to,
  { approveUrl, denyUrl, approveDeepLink, denyDeepLink, expiresAt }
) {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.log(`\n========================================`);
    console.log(`  Password reset approval email for ${to}`);
    console.log(`  APPROVE: ${approveUrl}`);
    console.log(`  DENY:    ${denyUrl}`);
    console.log(`  APPROVE APP: ${approveDeepLink}`);
    console.log(`  DENY APP:    ${denyDeepLink}`);
    console.log(`  EXPIRES: ${expiresAt}`);
    console.log(`========================================\n`);
    return;
  }

  const mailOptions = {
    from: `"Twin Flame" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: "Approve Password Reset - Twin Flame",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background:#ffffff;">
        <h2 style="color: #FE5F8C; text-align: center; margin-bottom: 8px;">Twin Flame</h2>
        <h3 style="color:#111; text-align:center; margin-top:0;">Password Reset Request</h3>
        <p style="font-size: 16px; color: #333; line-height: 1.6;">
          Someone requested to reset the password for your Twin Flame account.
          If this was you, approve the request below. If not, deny it immediately.
        </p>
        <p style="font-size: 14px; color: #666; line-height: 1.6;">
          This request expires at <strong>${new Date(expiresAt).toLocaleString()}</strong>.
        </p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${approveUrl}" style="display:inline-block; margin:0 8px 12px; padding:14px 28px; border-radius:999px; background:#111; color:#fff; text-decoration:none; font-weight:700;">Yes, it's me</a>
          <a href="${denyUrl}" style="display:inline-block; margin:0 8px 12px; padding:14px 28px; border-radius:999px; background:#f4f4f5; color:#111; text-decoration:none; font-weight:700; border:1px solid #ddd;">No</a>
        </div>
        <p style="font-size: 12px; color: #999; line-height:1.6;">
          If you approve this request on another device, the app will detect it automatically and continue to the reset password screen.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset approval email sent to ${to}`);
  } catch (err) {
    console.error(`Failed to send password reset approval email to ${to}:`, err.message);
    console.log(`\n========================================`);
    console.log(`  Password reset approval email for ${to}`);
    console.log(`  APPROVE: ${approveUrl}`);
    console.log(`  DENY:    ${denyUrl}`);
    console.log(`========================================\n`);
  }
}

module.exports = { sendOTPEmail, sendPasswordResetApprovalEmail };
