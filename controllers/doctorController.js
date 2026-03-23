const { supabaseAdmin } = require('../config/supabaseClient');
const { ok, fail } = require('../utils/responseHelpers');
const { getDoctorByProfileId } = require('../services/doctorService');
const { getDoctorQueue, transitionToken } = require('../services/tokenService');
const { createRecall } = require('../services/recallService');
const audit = require('../services/auditService');
const { todayIST } = require('../utils/dateUtils');

async function getQueue(req, res, next) {
  try {
    const doctor = await getDoctorByProfileId(req.user.id);
    const queue = await getDoctorQueue(doctor.id, todayIST());
    return ok(res, queue);
  } catch (e) { next(e); }
}

async function getCurrent(req, res, next) {
  try {
    const doctor = await getDoctorByProfileId(req.user.id);
    const { data, error } = await supabaseAdmin
      .from('tokens')
      .select('*, patient:patient_id(full_name, phone)')
      .eq('doctor_id', doctor.id)
      .eq('booking_date', todayIST())
      .in('status', ['called', 'in_progress'])
      .order('called_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (e) { next(e); }
}

async function callNext(req, res, next) {
  try {
    const doctor = await getDoctorByProfileId(req.user.id);
    const date = todayIST();

    // Guard: block only if a token is in_progress (patient is in the chair).
    // A 'called' token can still be acted on, but we also prevent calling another
    // while one is already called to avoid two patients being summoned at once.
    const { data: active } = await supabaseAdmin
      .from('tokens')
      .select('id, token_number, status')
      .eq('doctor_id', doctor.id)
      .eq('booking_date', date)
      .in('status', ['called', 'in_progress'])
      .limit(1)
      .maybeSingle();

    if (active) {
      return fail(res,
        `Token #${active.token_number} is ${active.status}. Complete, skip, or cancel it before calling the next patient.`,
        409
      );
    }

    // Get the next waiting token (lowest token_number)
    const { data: next, error } = await supabaseAdmin
      .from('tokens')
      .select('*, patient:patient_id(full_name, phone)')
      .eq('doctor_id', doctor.id)
      .eq('booking_date', date)
      .eq('status', 'waiting')
      .order('token_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) return fail(res, error.message, 500);
    if (!next) return fail(res, 'No waiting patients', 404);

    const updated = await transitionToken({ tokenId: next.id, doctorId: doctor.id, toStatus: 'called' });
    await audit.log({ actorId: req.user.id, actorRole: 'doctor', action: 'queue_advanced', targetEntity: 'tokens', targetId: next.id });
    return ok(res, updated);
  } catch (e) { next(e); }
}

async function startToken(req, res, next) {
  try {
    const doctor = await getDoctorByProfileId(req.user.id);
    const updated = await transitionToken({ tokenId: req.params.id, doctorId: doctor.id, toStatus: 'in_progress' });
    await audit.log({ actorId: req.user.id, actorRole: 'doctor', action: 'token_started', targetEntity: 'tokens', targetId: req.params.id });
    return ok(res, updated);
  } catch (e) { next(e); }
}

async function skipToken(req, res, next) {
  try {
    const doctor = await getDoctorByProfileId(req.user.id);
    const updated = await transitionToken({ tokenId: req.params.id, doctorId: doctor.id, toStatus: 'skipped' });
    await audit.log({ actorId: req.user.id, actorRole: 'doctor', action: 'token_skipped', targetEntity: 'tokens', targetId: req.params.id });
    return ok(res, updated);
  } catch (e) { next(e); }
}

async function recallToken(req, res, next) {
  try {
    const doctor = await getDoctorByProfileId(req.user.id);
    // skipped -> waiting is an allowed transition in the state machine
    const updated = await transitionToken({ tokenId: req.params.id, doctorId: doctor.id, toStatus: 'waiting' });
    await audit.log({ actorId: req.user.id, actorRole: 'doctor', action: 'token_recalled', targetEntity: 'tokens', targetId: req.params.id });
    return ok(res, updated);
  } catch (e) { next(e); }
}

async function cancelToken(req, res, next) {
  try {
    const doctor = await getDoctorByProfileId(req.user.id);
    const updated = await transitionToken({ tokenId: req.params.id, doctorId: doctor.id, toStatus: 'cancelled' });
    await audit.log({ actorId: req.user.id, actorRole: 'doctor', action: 'token_cancelled', targetEntity: 'tokens', targetId: req.params.id });
    return ok(res, updated);
  } catch (e) { next(e); }
}

async function completeToken(req, res, next) {
  try {
    const doctor = await getDoctorByProfileId(req.user.id);
    const updated = await transitionToken({ tokenId: req.params.id, doctorId: doctor.id, toStatus: 'completed' });
    await audit.log({ actorId: req.user.id, actorRole: 'doctor', action: 'token_completed', targetEntity: 'tokens', targetId: req.params.id });

    const { recallInterval } = req.body;
    if (recallInterval && recallInterval !== 'none') {
      createRecall({ patientId: updated.patient_id, doctorId: doctor.id, tokenId: req.params.id, interval: recallInterval })
        .catch(err => console.error('[recall] Failed to create recall:', err.message));
    }

    return ok(res, updated);
  } catch (e) { next(e); }
}

module.exports = { getQueue, getCurrent, callNext, startToken, skipToken, recallToken, cancelToken, completeToken };
