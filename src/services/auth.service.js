const { supabase, supabaseAuth } = require("../config/supabase");
const { sendOTPEmail } = require("../utils/mailer");

// In-memory OTP store: key = email/phone, value = { otp, password, userId, expiresAt }
// In production, replace with Redis or a DB table
const otpStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

class AuthService {
  // ---- REGISTER with email + password ----
  async register({ email, phone, password }) {
    // Use admin API to create user — this does NOT send any confirmation email
    const createPayload = { password };
    if (email) {
      createPayload.email = email;
      createPayload.email_confirm = true; // auto-confirm, no email sent
    }
    if (phone) {
      createPayload.phone = phone;
      createPayload.phone_confirm = true;
    }

    const { data, error } = await supabase.auth.admin.createUser(createPayload);

    let userId;

    if (error) {
      // If user already exists, find their ID and proceed
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

    // Generate 6-digit OTP and store it
    const otp = generateOTP();
    const key = email || phone;
    otpStore.set(key, {
      otp,
      password,
      userId,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    // Send OTP via email (or log to console if SMTP not configured)
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

    // Check if account is active
    const { data: userRow } = await supabase
      .from("users")
      .select("is_active, is_profile_complete")
      .eq("id", result.data.user.id)
      .single();

    if (userRow && !userRow.is_active) {
      throw Object.assign(new Error("Account is deactivated"), { statusCode: 403 });
    }

    // Update last seen
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

    // Generate a new OTP
    const otp = generateOTP();
    existing.otp = otp;
    existing.expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(key, existing);

    // Send OTP via email (or log to console if SMTP not configured)
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

    // OTP is valid — login the user to get session tokens
    let loginResult;
    if (email) {
      loginResult = await supabaseAuth.auth.signInWithPassword({ email, password: stored.password });
    } else {
      loginResult = await supabaseAuth.auth.signInWithPassword({ phone, password: stored.password });
    }

    // Clear the OTP entry
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

  // ---- FORGOT PASSWORD (sends reset email) ----
  async forgotPassword({ email }) {
    if (!email) {
      throw Object.assign(new Error("Email is required for password reset"), { statusCode: 400 });
    }

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email);

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 400 });
    }

    return { message: "Password reset email sent" };
  }

  // ---- RESET PASSWORD (user has a valid session from reset link) ----
  async resetPassword({ accessToken, newPassword }) {
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
      provider, // 'google' or 'apple'
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
  async changePassword(userId, { newPassword }) {
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
