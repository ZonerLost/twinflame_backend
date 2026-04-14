const { randomBytes, randomUUID } = require("crypto");
const { supabase, supabaseAuth } = require("../config/supabase");
const { sendOTPEmail, sendPasswordResetApprovalEmail } = require("../utils/mailer");

// In-memory OTP store: key = email/phone, value = { otp, password, userId, expiresAt }
// In production, replace with Redis or a DB table
const otpStore = new Map();

const PASSWORD_RESET_REQUEST_TABLE = "password_reset_requests";
const PASSWORD_RESET_EXPIRY_MS = 15 * 60 * 1000;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSecureToken() {
  return randomBytes(32).toString("hex");
}

function normalizeBaseUrl(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

class AuthService {
  // ---- REGISTER with email + password ----
  async register({ email, phone, password }) {
    const createPayload = { password };
    if (email) {
      createPayload.email = email;
      createPayload.email_confirm = true;
    }
    if (phone) {
      createPayload.phone = phone;
      createPayload.phone_confirm = true;
    }

    const { data, error } = await supabase.auth.admin.createUser(createPayload);

    let userId;

    if (error) {
      if (error.message.includes("already been registered") || error.message.includes("already exists")) {
        userId = await this._findUserId({ email, phone });
      } else {
        throw Object.assign(new Error(error.message), { statusCode: 400 });
      }
    } else {
      userId = data.user.id;
    }

    if (!userId) {
      throw Object.assign(new Error("Registration failed"), { statusCode: 500 });
    }

    const otp = generateOTP();
    const key = email || phone;
    otpStore.set(key, {
      otp,
      password,
      userId,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    if (email) {
      await sendOTPEmail(email, otp);
    } else {
      console.log(`\n========================================`);
      console.log(`  OTP for ${key}: ${otp}`);
      console.log(`========================================\n`);
    }

    return {
      user: {
        id: userId,
        email: email || null,
        phone: phone || null,
      },
      message: "OTP sent successfully. Check your email/phone.",
    };
  }

  // ---- LOGIN with email/phone + password ----
  async login({ email, phone, password }) {
    let result;

    if (email) {
      result = await supabaseAuth.auth.signInWithPassword({ email, password });
    } else {
      result = await supabaseAuth.auth.signInWithPassword({ phone, password });
    }

    if (result.error) {
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("is_active, is_profile_complete")
      .eq("id", result.data.user.id)
      .single();

    if (userRow && !userRow.is_active) {
      throw Object.assign(new Error("Account is deactivated"), { statusCode: 403 });
    }

    await supabase
      .from("users")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", result.data.user.id);

    return {
      accessToken: result.data.session.access_token,
      refreshToken: result.data.session.refresh_token,
      expiresAt: result.data.session.expires_at,
      user: {
        id: result.data.user.id,
        email: result.data.user.email,
        phone: result.data.user.phone,
        isProfileComplete: userRow?.is_profile_complete || false,
      },
    };
  }

  // ---- SEND OTP (resend) ----
  async sendOTP({ email, phone }) {
    const key = email || phone;
    const existing = otpStore.get(key);

    if (!existing) {
      throw Object.assign(new Error("No pending registration found. Please register first."), { statusCode: 400 });
    }

    const otp = generateOTP();
    existing.otp = otp;
    existing.expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(key, existing);

    if (email) {
      await sendOTPEmail(email, otp);
    } else {
      console.log(`\n========================================`);
      console.log(`  OTP (resend) for ${key}: ${otp}`);
      console.log(`========================================\n`);
    }

    return { message: "OTP sent successfully" };
  }

  // ---- VERIFY OTP ----
  async verifyOTP({ email, phone, otp }) {
    const key = email || phone;
    const stored = otpStore.get(key);

    if (!stored) {
      throw Object.assign(new Error("No OTP found. Please register or request a new OTP."), { statusCode: 400 });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(key);
      throw Object.assign(new Error("OTP has expired. Please request a new one."), { statusCode: 400 });
    }

    if (stored.otp !== otp) {
      throw Object.assign(new Error("Invalid OTP. Please try again."), { statusCode: 400 });
    }

    let loginResult;
    if (email) {
      loginResult = await supabaseAuth.auth.signInWithPassword({ email, password: stored.password });
    } else {
      loginResult = await supabaseAuth.auth.signInWithPassword({ phone, password: stored.password });
    }

    otpStore.delete(key);

    if (loginResult.error) {
      throw Object.assign(new Error("Verification succeeded but login failed."), { statusCode: 500 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("is_profile_complete")
      .eq("id", loginResult.data.user.id)
      .single();

    return {
      accessToken: loginResult.data.session.access_token,
      refreshToken: loginResult.data.session.refresh_token,
      expiresAt: loginResult.data.session.expires_at,
      user: {
        id: loginResult.data.user.id,
        email: loginResult.data.user.email,
        phone: loginResult.data.user.phone,
        isProfileComplete: userRow?.is_profile_complete || false,
      },
    };
  }

  // ---- FORGOT PASSWORD (send custom approval email) ----
  async forgotPassword({ email }) {
    if (!email) {
      throw Object.assign(new Error("Email is required for password reset"), { statusCode: 400 });
    }

    const userId = await this._findUserId({ email });
    if (!userId) {
      return {
        requestId: null,
        status: "pending",
        message: "If this email exists, a password reset approval email has been sent.",
      };
    }

    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS).toISOString();
    const requestId = randomUUID();
    const approvalToken = generateSecureToken();
    const resetToken = generateSecureToken();

    await supabase
      .from(PASSWORD_RESET_REQUEST_TABLE)
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("email", email)
      .eq("status", "pending");

    const { error } = await supabase.from(PASSWORD_RESET_REQUEST_TABLE).insert({
      id: requestId,
      user_id: userId,
      email,
      status: "pending",
      approval_token: approvalToken,
      reset_token: resetToken,
      expires_at: expiresAt,
    });

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 400 });
    }

    const backendBaseUrl = this._getBackendBaseUrl();
    const approveUrl = `${backendBaseUrl}/auth/password-reset/approve?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(approvalToken)}`;
    const denyUrl = `${backendBaseUrl}/auth/password-reset/deny?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(approvalToken)}`;
    const deepLinkBase = `${process.env.APP_DEEP_LINK_SCHEME || "twinflame"}://password-reset`;

    await sendPasswordResetApprovalEmail(email, {
      approveUrl,
      denyUrl,
      approveDeepLink: `${deepLinkBase}?action=approve&token=${encodeURIComponent(resetToken)}`,
      denyDeepLink: `${deepLinkBase}?action=deny`,
      expiresAt,
    });

    return {
      requestId,
      status: "pending",
      expiresAt,
      message: "Password reset approval email sent.",
    };
  }

  async getPasswordResetStatus({ requestId }) {
    const request = await this._getPasswordResetRequest({ requestId });
    const normalized = await this._normalizePasswordResetStatus(request);

    const data = {
      requestId: normalized.id,
      status: normalized.status,
      expiresAt: normalized.expires_at,
    };

    if (normalized.status === "approved") {
      data.accessToken = normalized.reset_token;
    }

    return data;
  }

  async approvePasswordReset({ requestId, token }) {
    const request = await this._getPasswordResetRequest({ requestId, approvalToken: token });
    const normalized = await this._normalizePasswordResetStatus(request);

    if (normalized.status === "approved") {
      return {
        statusCode: 200,
        title: "Approval already granted",
        message: "This reset request was already approved. Return to the app to continue.",
        deepLink: `${process.env.APP_DEEP_LINK_SCHEME || "twinflame"}://password-reset?action=approve&token=${encodeURIComponent(normalized.reset_token)}`,
      };
    }

    if (normalized.status === "denied") {
      return {
        statusCode: 200,
        title: "Approval already denied",
        message: "This reset request was already denied. Open the app to continue.",
        deepLink: `${process.env.APP_DEEP_LINK_SCHEME || "twinflame"}://password-reset?action=deny`,
      };
    }

    if (normalized.status === "expired") {
      return {
        statusCode: 410,
        title: "Request expired",
        message: "This password reset request has expired. Please submit a new forgot password request.",
      };
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from(PASSWORD_RESET_REQUEST_TABLE)
      .update({ status: "approved", approved_at: now, updated_at: now })
      .eq("id", requestId)
      .eq("approval_token", token);

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 400 });
    }

    return {
      statusCode: 200,
      title: "Approval granted",
      message: "You can now return to the app and reset your password.",
      deepLink: `${process.env.APP_DEEP_LINK_SCHEME || "twinflame"}://password-reset?action=approve&token=${encodeURIComponent(request.reset_token)}`,
    };
  }

  async denyPasswordReset({ requestId, token }) {
    const request = await this._getPasswordResetRequest({ requestId, approvalToken: token });
    const normalized = await this._normalizePasswordResetStatus(request);

    if (normalized.status === "denied") {
      return {
        statusCode: 200,
        title: "Approval already denied",
        message: "This password reset request has already been denied.",
        deepLink: `${process.env.APP_DEEP_LINK_SCHEME || "twinflame"}://password-reset?action=deny`,
      };
    }

    if (normalized.status === "expired") {
      return {
        statusCode: 410,
        title: "Request expired",
        message: "This password reset request has expired. Please submit a new forgot password request.",
      };
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from(PASSWORD_RESET_REQUEST_TABLE)
      .update({ status: "denied", denied_at: now, updated_at: now })
      .eq("id", requestId)
      .eq("approval_token", token);

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 400 });
    }

    return {
      statusCode: 200,
      title: "Approval denied",
      message: "This password reset request was denied. Open the app to continue.",
      deepLink: `${process.env.APP_DEEP_LINK_SCHEME || "twinflame"}://password-reset?action=deny`,
    };
  }

  // ---- RESET PASSWORD (custom approved token or legacy Supabase session token) ----
  async resetPassword({ accessToken, newPassword }) {
    const { data: resetRequest, error: resetRequestError } = await supabase
      .from(PASSWORD_RESET_REQUEST_TABLE)
      .select("id, user_id, email, status, reset_token, expires_at")
      .eq("reset_token", accessToken)
      .maybeSingle();

    if (!resetRequestError && resetRequest) {
      const normalized = await this._normalizePasswordResetStatus(resetRequest);
      if (normalized.status !== "approved") {
        throw Object.assign(new Error("Reset approval is not granted"), { statusCode: 400 });
      }

      const userId = normalized.user_id || await this._findUserId({ email: normalized.email });
      if (!userId) {
        throw Object.assign(new Error("User not found for reset request"), { statusCode: 404 });
      }

      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) {
        throw Object.assign(new Error(error.message), { statusCode: 400 });
      }

      await supabase
        .from(PASSWORD_RESET_REQUEST_TABLE)
        .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", normalized.id);

      return { message: "Password reset successfully" };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !userData.user) {
      throw Object.assign(new Error("Invalid or expired reset token"), { statusCode: 400 });
    }

    const { error } = await supabase.auth.admin.updateUserById(userData.user.id, {
      password: newPassword,
    });

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 400 });
    }

    return { message: "Password reset successfully" };
  }

  // ---- REFRESH TOKEN ----
  async refreshToken(refreshToken) {
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });

    if (error) {
      throw Object.assign(new Error("Invalid or expired refresh token"), { statusCode: 401 });
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    };
  }

  // ---- SOCIAL LOGIN (Google / Apple) ----
  async socialLogin({ idToken, provider }) {
    const { data, error } = await supabaseAuth.auth.signInWithIdToken({
      provider,
      token: idToken,
    });

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 400 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("is_profile_complete")
      .eq("id", data.user.id)
      .single();

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        isProfileComplete: userRow?.is_profile_complete || false,
      },
    };
  }

  // ---- CHANGE PASSWORD (authenticated user) ----
  async changePassword(userId, { currentPassword, newPassword }) {
    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(userId);

    if (authUserError || !authUser.user) {
      throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }

    let verifyResult;
    if (authUser.user.email) {
      verifyResult = await supabaseAuth.auth.signInWithPassword({
        email: authUser.user.email,
        password: currentPassword,
      });
    } else if (authUser.user.phone) {
      verifyResult = await supabaseAuth.auth.signInWithPassword({
        phone: authUser.user.phone,
        password: currentPassword,
      });
    } else {
      throw Object.assign(new Error("Current password cannot be verified"), { statusCode: 400 });
    }

    if (verifyResult.error) {
      throw Object.assign(new Error("Current password is incorrect"), { statusCode: 400 });
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 400 });
    }

    return { message: "Password changed successfully" };
  }

  // ---- LOGOUT ----
  async logout(accessToken) {
    const { error } = await supabase.auth.admin.signOut(accessToken);
    if (error) {
      console.log("Logout note:", error.message);
    }
    return { message: "Logged out successfully" };
  }

  async _getPasswordResetRequest({ requestId, approvalToken }) {
    let query = supabase
      .from(PASSWORD_RESET_REQUEST_TABLE)
      .select("id, user_id, email, status, approval_token, reset_token, expires_at")
      .eq("id", requestId);

    if (approvalToken) {
      query = query.eq("approval_token", approvalToken);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 400 });
    }

    if (!data) {
      throw Object.assign(new Error("Password reset request not found"), { statusCode: 404 });
    }

    return data;
  }

  async _normalizePasswordResetStatus(request) {
    if (request.status === "pending" && new Date(request.expires_at).getTime() < Date.now()) {
      await supabase
        .from(PASSWORD_RESET_REQUEST_TABLE)
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", request.id);
      return { ...request, status: "expired" };
    }

    return request;
  }

  _getBackendBaseUrl() {
    const base = normalizeBaseUrl(process.env.BACKEND_PUBLIC_URL || process.env.API_BASE_URL || "http://3.149.82.219/api");
    if (!base) {
      throw Object.assign(new Error("BACKEND_PUBLIC_URL is required for password reset emails"), { statusCode: 500 });
    }
    return base;
  }

  // ---- HELPER: Find user ID by email/phone ----
  async _findUserId({ email, phone }) {
    const { data } = await supabase.auth.admin.listUsers();
    let user;
    if (email) {
      user = data?.users?.find((u) => u.email === email);
    } else if (phone) {
      user = data?.users?.find((u) => u.phone === phone);
    }
    return user?.id || null;
  }

  // ---- GET AUTH USER INFO ----
  async getUser(userId) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error) {
      throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }

    return {
      id: data.user.id,
      email: data.user.email,
      phone: data.user.phone,
      emailConfirmed: !!data.user.email_confirmed_at,
      phoneConfirmed: !!data.user.phone_confirmed_at,
      createdAt: data.user.created_at,
    };
  }
}

module.exports = new AuthService();

