const { supabaseAdmin, supabaseAnon } = require('../config/supabaseClient');
const { ok, fail } = require('../utils/responseHelpers');
const { validatePhone, validateEmail, validateRequired } = require('../utils/validators');
const { sendWelcome, sendOtpEmail } = require('../services/emailService');

// In-memory OTP store: email -> { otp, expiry, full_name, phone, password }
const otpStore = new Map();

// Reset OTP rate limit: email -> { count, resetAt }
const resetRateLimit = new Map();
const RESET_OTP_DAILY_LIMIT = 3;

function checkResetRateLimit(email) {
  const now = Date.now();
  const record = resetRateLimit.get(email);
  const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
  if (!record || now >= record.resetAt) {
    resetRateLimit.set(email, { count: 1, resetAt: midnight.getTime() });
    return true;
  }
  if (record.count >= RESET_OTP_DAILY_LIMIT) return false;
  record.count++;
  return true;
}

async function sendOtp(req, res, next) {
  try {
    const { full_name, phone, email, password } = req.body;
    const missing = validateRequired(req.body, ['full_name', 'email', 'password']);
    if (missing.length) return fail(res, 'Missing fields', 400, missing);
    if (!validateEmail(email)) return fail(res, 'Invalid email address', 400);
    if (password.length < 6) return fail(res, 'Password must be at least 6 characters', 400);
    if (phone && !validatePhone(phone)) return fail(res, 'Invalid phone number', 400);

    // Check if email already registered
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    if (data?.users?.some(u => u.email === email)) {
      return fail(res, 'Email already registered', 400);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(email, { otp, expiry: Date.now() + 10 * 60 * 1000, full_name, phone, password });

    await sendOtpEmail({ to: email, name: full_name.trim(), otp });
    return ok(res, null, 'OTP sent to your email');
  } catch (e) { next(e); }
}

async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return fail(res, 'Email and OTP required', 400);

    const record = otpStore.get(email);
    if (!record) return fail(res, 'OTP expired or not requested', 400);
    if (Date.now() > record.expiry) { otpStore.delete(email); return fail(res, 'OTP expired', 400); }
    if (record.otp !== otp.trim()) return fail(res, 'Invalid OTP', 400);

    otpStore.delete(email);
    const { full_name, phone, password } = record;

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (authErr) return fail(res, authErr.message, 400);

    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id, full_name: full_name.trim(), phone: phone || null, role: 'patient'
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return fail(res, 'Profile creation failed', 500);
    }

    sendWelcome({ to: email, name: full_name.trim() });
    return ok(res, { id: authData.user.id }, 'Registration successful', 201);
  } catch (e) { next(e); }
}

async function register(req, res, next) {
  try {
    const { full_name, phone, email, password } = req.body;
    const missing = validateRequired(req.body, ['full_name', 'email', 'password']);
    if (missing.length) return fail(res, 'Missing fields', 400, missing);
    if (!validateEmail(email)) return fail(res, 'Invalid email address', 400);
    if (password.length < 6) return fail(res, 'Password must be at least 6 characters', 400);
    if (phone && !validatePhone(phone)) return fail(res, 'Invalid phone number', 400);

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (authErr) return fail(res, authErr.message, 400);

    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id, full_name: full_name.trim(), phone: phone || null, role: 'patient'
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return fail(res, 'Profile creation failed', 500);
    }

    sendWelcome({ to: email, name: full_name.trim() });

    return ok(res, { id: authData.user.id }, 'Registration successful', 201);
  } catch (e) { next(e); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Email and password required', 400);

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) return fail(res, 'Invalid credentials', 401);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_active, is_banned')
      .eq('id', data.user.id)
      .single();

    if (!profile?.is_active || profile?.is_banned) {
      return fail(res, 'Account suspended or banned', 403);
    }

    const token = data.session.access_token;
    
    // Set httpOnly cookie
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('sdl_token', token, {
      httpOnly: true,
      secure: isProd, // only over HTTPS in prod
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return ok(res, { profile }); // No longer need to send token in body
  } catch (e) { next(e); }
}

async function logout(req, res, next) {
  try {
    res.clearCookie('sdl_token');
    return ok(res, null, 'Logged out');
  } catch (e) { next(e); }
}

async function me(req, res, next) {
  try {
    return ok(res, req.user);
  } catch (e) { next(e); }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return fail(res, 'Email is required', 400);

    if (!checkResetRateLimit(email)) {
      return fail(res, 'Too many reset attempts. Try again tomorrow.', 429);
    }

    // Check email exists
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    const user = data?.users?.find(u => u.email === email);
    // Always return success to prevent email enumeration
    if (!user) return ok(res, null, 'If that email exists, a reset code has been sent');

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(`reset_${email}`, { otp, expiry: Date.now() + 10 * 60 * 1000 });

    const { sendResetOtpEmail } = require('../services/emailService');
    await sendResetOtpEmail({ to: email, otp });

    return ok(res, null, 'If that email exists, a reset code has been sent');
  } catch (e) { next(e); }
}

async function verifyResetOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return fail(res, 'Email and OTP required', 400);

    const record = otpStore.get(`reset_${email}`);
    if (!record) return fail(res, 'OTP expired or not requested', 400);
    if (Date.now() > record.expiry) { otpStore.delete(`reset_${email}`); return fail(res, 'OTP expired', 400); }
    if (record.otp !== otp.trim()) return fail(res, 'Invalid OTP', 400);

    // Mark as verified but keep in store for the reset step
    otpStore.set(`reset_${email}`, { ...record, verified: true });
    return ok(res, null, 'OTP verified');
  } catch (e) { next(e); }
}

async function resetPassword(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Email and password required', 400);
    if (password.length < 6) return fail(res, 'Password must be at least 6 characters', 400);

    const record = otpStore.get(`reset_${email}`);
    if (!record?.verified) return fail(res, 'Please verify your OTP first', 400);

    const { data, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const user = data?.users?.find(u => u.email === email);
    if (!user) return fail(res, 'User not found', 404);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
    if (error) return fail(res, error.message, 500);

    otpStore.delete(`reset_${email}`);
    return ok(res, null, 'Password updated successfully');
  } catch (e) { next(e); }
}

module.exports = { register, login, logout, me, sendOtp, verifyOtp, forgotPassword, verifyResetOtp, resetPassword };
