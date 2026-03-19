const { supabaseAdmin, supabaseAnon } = require('../config/supabaseClient');
const { ok, fail } = require('../utils/responseHelpers');
const { validatePhone, validateEmail, validateRequired } = require('../utils/validators');

async function register(req, res, next) {
  try {
    const { full_name, phone, email, password } = req.body;
    const missing = validateRequired(req.body, ['full_name', 'email', 'password']);
    if (missing.length) return fail(res, 'Missing fields', 400, missing);
    if (!validateEmail(email)) return fail(res, 'Invalid email address', 400);
    if (password.length < 8) return fail(res, 'Password must be at least 8 characters', 400);
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

    return ok(res, { token: data.session.access_token, profile });
  } catch (e) { next(e); }
}

async function logout(req, res, next) {
  try {
    // JWT is stateless; client should discard token. Supabase global sign-out optional.
    return ok(res, null, 'Logged out');
  } catch (e) { next(e); }
}

async function me(req, res, next) {
  try {
    return ok(res, req.user);
  } catch (e) { next(e); }
}

module.exports = { register, login, logout, me };
