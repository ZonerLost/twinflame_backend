const authService = require("../services/auth.service");
const { successResponse } = require("../utils/helpers");

function renderPasswordResetDecisionPage({ title, message, deepLink }) {
  const escapedTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const button = deepLink
    ? `<a href="${deepLink}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#000;color:#fff;text-decoration:none;font-weight:600;">Open Twin Flame</a>`
    : "";
  const script = deepLink
    ? `<script>setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 250);</script>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle}</title>
    <style>
      body{font-family:Arial,sans-serif;background:#f7f7f7;color:#111;margin:0;padding:24px}
      .card{max-width:520px;margin:80px auto;background:#fff;border-radius:24px;padding:32px;box-shadow:0 12px 30px rgba(0,0,0,.08);text-align:center}
      h1{margin:0 0 16px;font-size:28px}
      p{margin:0 0 28px;color:#555;line-height:1.5}
      .hint{margin-top:18px;font-size:13px;color:#888}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapedTitle}</h1>
      <p>${escapedMessage}</p>
      ${button}
      <div class="hint">You can close this page after returning to the app.</div>
    </div>
    ${script}
  </body>
</html>`;
}

async function register(req, res, next) {
  try {
    const { email, phone, password } = req.body;
    const result = await authService.register({ email, phone, password });
    return successResponse(res, result, "Registration successful", 201);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { email, phone, password } = req.body;
    const result = await authService.login({ email, phone, password });
    return successResponse(res, result, "Login successful");
  } catch (err) { next(err); }
}

async function sendOTP(req, res, next) {
  try {
    const { email, phone } = req.body;
    const result = await authService.sendOTP({ email, phone });
    return successResponse(res, result, "OTP sent");
  } catch (err) { next(err); }
}

async function verifyOTP(req, res, next) {
  try {
    const { email, phone, otp } = req.body;
    const result = await authService.verifyOTP({ email, phone, otp });
    return successResponse(res, result, "OTP verified successfully");
  } catch (err) { next(err); }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword({ email });
    return successResponse(res, result, "Reset approval email sent");
  } catch (err) { next(err); }
}

async function getPasswordResetStatus(req, res, next) {
  try {
    const result = await authService.getPasswordResetStatus({ requestId: req.params.requestId });
    return successResponse(res, result, "Password reset status retrieved");
  } catch (err) { next(err); }
}

async function approvePasswordReset(req, res, next) {
  try {
    const result = await authService.approvePasswordReset({
      requestId: req.query.requestId,
      token: req.query.token,
    });
    return res.status(result.statusCode || 200).send(renderPasswordResetDecisionPage(result));
  } catch (err) { next(err); }
}

async function denyPasswordReset(req, res, next) {
  try {
    const result = await authService.denyPasswordReset({
      requestId: req.query.requestId,
      token: req.query.token,
    });
    return res.status(result.statusCode || 200).send(renderPasswordResetDecisionPage(result));
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { accessToken, newPassword } = req.body;
    const result = await authService.resetPassword({ accessToken, newPassword });
    return successResponse(res, result, "Password reset successful");
  } catch (err) { next(err); }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    return successResponse(res, result, "Token refreshed");
  } catch (err) { next(err); }
}

async function socialLogin(req, res, next) {
  try {
    const { idToken, provider } = req.body;
    const result = await authService.socialLogin({ idToken, provider });
    return successResponse(res, result, "Social login successful");
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.userId, {
      currentPassword,
      newPassword,
    });
    return successResponse(res, result, "Password changed");
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const result = await authService.logout(token);
    return successResponse(res, result, "Logged out");
  } catch (err) { next(err); }
}

async function getMe(req, res, next) {
  try {
    const result = await authService.getUser(req.userId);
    return successResponse(res, result, "User retrieved");
  } catch (err) { next(err); }
}

module.exports = {
  register,
  login,
  sendOTP,
  verifyOTP,
  forgotPassword,
  getPasswordResetStatus,
  approvePasswordReset,
  denyPasswordReset,
  resetPassword,
  refreshToken,
  socialLogin,
  changePassword,
  logout,
  getMe,
};
