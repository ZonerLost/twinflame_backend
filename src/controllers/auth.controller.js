const authService = require("../services/auth.service");
const { successResponse } = require("../utils/helpers");

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
    return successResponse(res, result, "Reset email sent");
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
    const { newPassword } = req.body;
    const result = await authService.changePassword(req.userId, { newPassword });
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
  resetPassword,
  refreshToken,
  socialLogin,
  changePassword,
  logout,
  getMe,
};
