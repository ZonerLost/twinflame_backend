const express = require("express");
const router = express.Router();
const Joi = require("joi");
const authController = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().min(10).max(20).optional(),
  password: Joi.string().min(6).required(),
}).or("email", "phone");

const loginSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  password: Joi.string().required(),
}).or("email", "phone");

const otpSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  otp: Joi.string().length(6).required(),
}).or("email", "phone");

const sendOtpSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
}).or("email", "phone");

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  accessToken: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

const socialLoginSchema = Joi.object({
  idToken: Joi.string().required(),
  provider: Joi.string().valid("google", "apple").required(),
});

const changePasswordSchema = Joi.object({
  newPassword: Joi.string().min(6).required(),
});

// Public routes
router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/send-otp", authLimiter, validate(sendOtpSchema), authController.sendOTP);
router.post("/verify-otp", authLimiter, validate(otpSchema), authController.verifyOTP);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post("/refresh-token", authController.refreshToken);
router.post("/social-login", authLimiter, validate(socialLoginSchema), authController.socialLogin);

// Protected routes
router.post("/change-password", authenticate, validate(changePasswordSchema), authController.changePassword);
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getMe);

module.exports = router;
