const { supabaseAdmin } = require('../config/supabaseClient');
const { ok, fail } = require('../utils/responseHelpers');
const { bookToken } = require('../services/tokenService');
const audit = require('../services/auditService');
const { todayIST } = require('../utils/dateUtils');
const { sendTokenConfirmation } = require('../services/emailService');

async function getDoctors(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('doctors')
      .select('id, display_name, specialty, consultation_start_time, consultation_end_time, is_available, max_daily_tokens')
      .eq('is_available', true)
      .order('display_name');
    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (e) { next(e); }
}

async function bookNewToken(req, res, next) {
  try {
    const { doctor_id, notes, booking_date, slot_time, recall_id } = req.body;
    if (!doctor_id) return fail(res, 'doctor_id is required', 400);

    const token = await bookToken({ 
      patientId: req.user.id, 
      doctorId: doctor_id, 
      notes, 
      bookingDate: booking_date, 
      slotTime: slot_time,
      recallId: recall_id || null,
    });

    // Fire-and-forget booking confirmation email
    sendTokenConfirmation({
      to: req.user.email,
      name: req.user.full_name,
      tokenNumber: token.token_number,
      doctorName: token.doctor?.display_name || '',
      bookingDate: token.booking_date,
      slotTime: token.slot_time,
      specialty: token.doctor?.specialty || '',
    });

    return ok(res, token, 'Token booked successfully', 201);
  } catch (e) {
    if (e.status) return fail(res, e.message, e.status);
    next(e);
  }
}

async function getMyTokens(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('tokens')
      .select('*, doctor:doctor_id(display_name, specialty)')
      .eq('patient_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (e) { next(e); }
}

async function getTokenStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { data: token, error } = await supabaseAdmin
      .from('tokens')
      .select('*, doctor:doctor_id(display_name)')
      .eq('id', id)
      .eq('patient_id', req.user.id)
      .single();
    if (error || !token) return fail(res, 'Token not found', 404);

    // Calculate queue position
    let queuePosition = null;
    if (['waiting', 'called', 'in_progress'].includes(token.status)) {
      const { count } = await supabaseAdmin
        .from('tokens')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', token.doctor_id)
        .eq('booking_date', token.booking_date)
        .in('status', ['waiting', 'called', 'in_progress'])
        .lte('token_number', token.token_number);
      queuePosition = count;
    }

    return ok(res, { ...token, queue_position: queuePosition });
  } catch (e) { next(e); }
}

async function cancelMyToken(req, res, next) {
  try {
    const { id } = req.params;
    const { data: token } = await supabaseAdmin
      .from('tokens').select('status, patient_id').eq('id', id).single();
    if (!token) return fail(res, 'Token not found', 404);
    if (token.patient_id !== req.user.id) return fail(res, 'Access denied', 403);
    if (['completed', 'cancelled'].includes(token.status)) return fail(res, `Token already ${token.status}`, 400);

    const { data, error } = await supabaseAdmin.from('tokens')
      .update({ status: 'cancelled', cancel_reason: 'Cancelled by patient', cancelled_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return fail(res, error.message, 500);

    await audit.log({ actorId: req.user.id, actorRole: 'patient', action: 'token_cancelled', targetEntity: 'tokens', targetId: id });
    return ok(res, data);
  } catch (e) { next(e); }
}

async function getBookedSlots(req, res, next) {
  try {
    const { doctor_id, date } = req.query;
    if (!doctor_id || !date) return fail(res, 'doctor_id and date required', 400);
    const { data, error } = await supabaseAdmin
      .from('tokens')
      .select('slot_time')
      .eq('doctor_id', doctor_id)
      .eq('booking_date', date)
      .neq('status', 'cancelled');
    if (error) return fail(res, error.message, 500);
    // Count bookings per slot
    const counts = {};
    (data || []).forEach(t => {
      if (t.slot_time) counts[t.slot_time] = (counts[t.slot_time] || 0) + 1;
    });
    return ok(res, counts);
  } catch (e) { next(e); }
}

async function getRecallInfo(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('recalls')
      .select('*, patient:patient_id(full_name), doctor:doctor_id(id, display_name, specialty)')
      .eq('id', id)
      .eq('patient_id', req.user.id)
      .single();
    if (error || !data) return fail(res, 'Recall not found', 404);
    return ok(res, data);
  } catch (e) { next(e); }
}

module.exports = { getDoctors, bookNewToken, getMyTokens, getTokenStatus, cancelMyToken, getBookedSlots, getRecallInfo };
