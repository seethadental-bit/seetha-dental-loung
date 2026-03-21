const { supabaseAdmin } = require('../config/supabaseClient');
const { ok, fail } = require('../utils/responseHelpers');
const { validateRequired, validatePhone } = require('../utils/validators');
const audit = require('../services/auditService');
const { todayIST } = require('../utils/dateUtils');

async function getDashboard(req, res, next) {
  try {
    const date = todayIST();
    const { data: stats } = await supabaseAdmin
      .from('tokens')
      .select('status, doctor_id')
      .eq('booking_date', date);

    const summary = { total: 0, waiting: 0, completed: 0, cancelled: 0, skipped: 0, in_progress: 0 };
    const byDoctor = {};
    (stats || []).forEach(t => {
      summary.total++;
      summary[t.status] = (summary[t.status] || 0) + 1;
      byDoctor[t.doctor_id] = (byDoctor[t.doctor_id] || 0) + 1;
    });

    return ok(res, { date, summary, byDoctor });
  } catch (e) { next(e); }
}

async function getUsers(req, res, next) {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, role, is_active, is_banned, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (role) query = query.eq('role', role);
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return fail(res, error.message, 500);

    return ok(res, {
      items: data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (e) { next(e); }
}

// Admin creates a doctor or patient account directly
async function createUserByAdmin(req, res, next) {
  try {
    const { full_name, phone, email, password, role, notes } = req.body;
    const missing = validateRequired(req.body, ['full_name', 'email', 'password', 'role']);
    if (missing.length) return fail(res, 'Missing fields', 400, missing);
    if (!['doctor', 'patient'].includes(role)) return fail(res, 'Role must be doctor or patient', 400);
    if (phone && !validatePhone(phone)) return fail(res, 'Invalid phone number', 400);
    if (password.length < 6) return fail(res, 'Password must be at least 6 characters', 400);

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (authErr) return fail(res, authErr.message, 400);

    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id, full_name: full_name.trim(),
      phone: phone || null, role,
      is_active: req.body.is_active !== false, // honour admin's choice; default true
      is_banned: false
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return fail(res, 'Profile creation failed', 500);
    }

    await audit.log({ actorId: req.user.id, actorRole: 'admin', action: 'user_created_by_admin', targetEntity: 'profiles', targetId: authData.user.id, metadata: { role, notes } });
    return ok(res, { id: authData.user.id, role }, 'Account created', 201);
  } catch (e) { next(e); }
}

// Admin updates a user's profile details
async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = ['full_name', 'phone'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (update.phone && !validatePhone(update.phone)) return fail(res, 'Invalid phone number', 400);
    if (!Object.keys(update).length) return fail(res, 'No valid fields', 400);

    const { data, error } = await supabaseAdmin.from('profiles').update(update).eq('id', id).select().single();
    if (error) return fail(res, error.message, 500);
    await audit.log({ actorId: req.user.id, actorRole: 'admin', action: 'user_updated', targetEntity: 'profiles', targetId: id, metadata: update });
    return ok(res, data);
  } catch (e) { next(e); }
}

// Get all tokens for a specific user (patient or doctor)
async function getUserTokens(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('tokens')
      .select('*, doctor:doctor_id(display_name, specialty)')
      .eq('patient_id', id)
      .order('created_at', { ascending: false });
    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (e) { next(e); }
}

async function updateUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active, is_banned } = req.body;
    const update = {};
    if (typeof is_active === 'boolean') update.is_active = is_active;
    if (typeof is_banned === 'boolean') update.is_banned = is_banned;
    if (!Object.keys(update).length) return fail(res, 'No valid fields to update', 400);

    const { data, error } = await supabaseAdmin
      .from('profiles').update(update).eq('id', id).select().single();
    if (error) return fail(res, error.message, 500);

    await audit.log({
      actorId: req.user.id, actorRole: 'admin',
      action: is_banned ? 'user_banned' : 'user_status_updated',
      targetEntity: 'profiles', targetId: id, metadata: update
    });
    return ok(res, data);
  } catch (e) { next(e); }
}

async function getDoctors(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('doctors')
      .select('*, profile:profile_id(full_name, phone, is_active)')
      .order('created_at', { ascending: true });
    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (e) { next(e); }
}

// Admin creates a full doctor account (auth user + profile + doctor record) in one step
async function createDoctor(req, res, next) {
  try {
    const { email, password, phone, display_name, specialty, consultation_start_time, consultation_end_time, max_daily_tokens } = req.body;
    const missing = validateRequired(req.body, ['email', 'password', 'display_name']);
    if (missing.length) return fail(res, 'Missing fields', 400, missing);
    if (phone && !validatePhone(phone)) return fail(res, 'Invalid phone number', 400);

    // Create auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (authErr) return fail(res, authErr.message, 400);

    const profileId = authData.user.id;

    // Create profile with doctor role
    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: profileId, full_name: display_name.trim(), phone: phone || null, role: 'doctor'
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(profileId);
      return fail(res, 'Profile creation failed', 500);
    }

    // Create doctor record
    const { data, error } = await supabaseAdmin.from('doctors').insert({
      profile_id: profileId, display_name: display_name.trim(), specialty,
      consultation_start_time: consultation_start_time || null,
      consultation_end_time: consultation_end_time || null,
      max_daily_tokens: max_daily_tokens || null
    }).select().single();
    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(profileId);
      return fail(res, error.message, 400);
    }

    await audit.log({ actorId: req.user.id, actorRole: 'admin', action: 'doctor_created', targetEntity: 'doctors', targetId: data.id });
    return ok(res, data, 'Doctor created', 201);
  } catch (e) { next(e); }
}

async function updateDoctor(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = ['display_name', 'specialty', 'consultation_start_time', 'consultation_end_time', 'max_daily_tokens', 'is_available'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(update).length) return fail(res, 'No valid fields', 400);

    const { data, error } = await supabaseAdmin.from('doctors').update(update).eq('id', id).select().single();
    if (error) return fail(res, error.message, 500);

    await audit.log({ actorId: req.user.id, actorRole: 'admin', action: 'doctor_updated', targetEntity: 'doctors', targetId: id, metadata: update });
    return ok(res, data);
  } catch (e) { next(e); }
}

async function setDoctorAvailability(req, res, next) {
  try {
    const { id } = req.params;
    const { is_available } = req.body;
    if (typeof is_available !== 'boolean') return fail(res, 'is_available must be boolean', 400);

    const { data, error } = await supabaseAdmin.from('doctors').update({ is_available }).eq('id', id).select().single();
    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (e) { next(e); }
}

async function getAllTokens(req, res, next) {
  try {
    const { date, doctor_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('tokens')
      .select('*, patient:patient_id(full_name, phone), doctor:doctor_id(display_name)', { count: 'exact' })
      .order('booking_date', { ascending: false })
      .order('token_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (date) query = query.eq('booking_date', date);
    if (doctor_id) query = query.eq('doctor_id', doctor_id);

    const { data, error, count } = await query;
    if (error) return fail(res, error.message, 500);

    return ok(res, {
      items: data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (e) { next(e); }
}

async function adminCancelToken(req, res, next) {
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;

    const { data: token } = await supabaseAdmin.from('tokens').select('status').eq('id', id).single();
    if (!token) return fail(res, 'Token not found', 404);
    if (['completed', 'cancelled'].includes(token.status)) return fail(res, `Token already ${token.status}`, 400);

    const { data, error } = await supabaseAdmin.from('tokens')
      .update({ status: 'cancelled', cancel_reason: cancel_reason || 'Cancelled by admin', cancelled_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return fail(res, error.message, 500);

    await audit.log({ actorId: req.user.id, actorRole: 'admin', action: 'token_cancelled', targetEntity: 'tokens', targetId: id });
    return ok(res, data);
  } catch (e) { next(e); }
}

module.exports = { getDashboard, getUsers, createUserByAdmin, updateUser, getUserTokens, updateUserStatus, getDoctors, createDoctor, updateDoctor, setDoctorAvailability, getAllTokens, adminCancelToken };
