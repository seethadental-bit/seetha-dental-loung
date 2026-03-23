const { supabaseAdmin } = require('../config/supabaseClient');
const { todayIST } = require('../utils/dateUtils');

// Valid state transitions — only these moves are permitted.
// called→completed allowed directly (skipping in_progress is fine for simple consults).
const ALLOWED_TRANSITIONS = {
  waiting:     ['called', 'skipped', 'cancelled'],
  called:      ['in_progress', 'completed', 'skipped', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  skipped:     ['waiting', 'cancelled'],
};

async function bookToken({ patientId, doctorId, notes, bookingDate, slotTime, recallId }) {
  const date = bookingDate || todayIST();

  const { data: holiday } = await supabaseAdmin
    .from('holidays').select('id').eq('holiday_date', date).maybeSingle();
  if (holiday) throw Object.assign(new Error(`Clinic is closed on ${date} (holiday)`), { status: 400 });

  const { data: doctor, error: dErr } = await supabaseAdmin
    .from('doctors').select('id, is_available, max_daily_tokens').eq('id', doctorId).single();
  if (dErr || !doctor) throw Object.assign(new Error('Doctor not found'), { status: 404 });
  if (!doctor.is_available) throw Object.assign(new Error('Doctor is not available currently'), { status: 400 });

  if (doctor.max_daily_tokens) {
    let countQuery = supabaseAdmin
      .from('tokens')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('booking_date', date)
      .neq('status', 'cancelled');
    const { count } = await countQuery;
    if (count >= doctor.max_daily_tokens)
      throw Object.assign(new Error('Doctor has reached maximum tokens for this date'), { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('tokens').select('id')
    .eq('patient_id', patientId).eq('doctor_id', doctorId)
    .eq('booking_date', date).neq('status', 'cancelled').maybeSingle();
  if (existing)
    throw Object.assign(new Error(`You already have an active token for this doctor on ${date}`), { status: 409 });

  // Use raw insert instead of RPC if we haven't updated the RPC yet, 
  // but let's assume we want to keep the sequential token number logic.
  // Since we can't easily run SQL to update RPC, we'll do it in JS for now or use the notes field.
  // Actually, I'll use the notes field to store slot for now to avoid DB migration issues if psql is missing.
  // Wait, I can try to use supabaseAdmin.from().insert() with manual token number calc if needed.
  
  const fullSlotString = slotTime || '';

  // Single RPC: advisory lock + session-based MAX(token_number) + INSERT in one transaction
  const { data: token, error } = await supabaseAdmin
    .rpc('book_token_atomic', {
      p_patient_id:   patientId,
      p_doctor_id:    doctorId,
      p_date:         date,
      p_notes:        notes || null,
      p_slot_time:    fullSlotString,
      p_max_per_slot: 2,
    });

  if (error) {
    console.error('[bookToken] RPC error:', error.code, error.message);
    if (error.code === '23505')
      throw Object.assign(new Error('Booking conflict, please try again'), { status: 409 });
    if (error.message?.includes('SLOT_FULL'))
      throw Object.assign(new Error('This slot is full. Please choose another time.'), { status: 409 });
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  
  token.display_token = token.token_number;

  if (recallId) {
    await supabaseAdmin.from('recalls')
      .update({ status: 'booked' })
      .eq('id', recallId)
      .eq('patient_id', patientId);
  }

  return token;
}

async function getDoctorQueue(doctorId, date) {
  const { data, error } = await supabaseAdmin
    .from('tokens')
    .select('id, token_number, status, notes, created_at, called_at, patient:patient_id(id, full_name, phone)')
    .eq('doctor_id', doctorId).eq('booking_date', date)
    .in('status', ['waiting', 'called', 'in_progress', 'skipped'])
    .order('token_number', { ascending: true });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function transitionToken({ tokenId, doctorId, toStatus }) {
  const { data: token, error } = await supabaseAdmin
    .from('tokens').select('id, status, doctor_id').eq('id', tokenId).single();
  if (error || !token) throw Object.assign(new Error('Token not found'), { status: 404 });
  if (token.doctor_id !== doctorId) throw Object.assign(new Error('Access denied'), { status: 403 });

  const allowed = ALLOWED_TRANSITIONS[token.status];
  if (!allowed) throw Object.assign(new Error(`Token is already ${token.status}`), { status: 400 });
  if (!allowed.includes(toStatus))
    throw Object.assign(new Error(`Cannot move token from '${token.status}' to '${toStatus}'`), { status: 400 });

  const now = new Date().toISOString();
  const timestamps = {
    called:      { called_at: now },
    in_progress: { called_at: now },
    completed:   { completed_at: now },
    skipped:     { skipped_at: now },
    cancelled:   { cancelled_at: now },
    waiting:     {},
  };

  const { data: updated, error: upErr } = await supabaseAdmin
    .from('tokens').update({ status: toStatus, ...timestamps[toStatus] })
    .eq('id', tokenId).select('*').single();
  if (upErr) throw Object.assign(new Error(upErr.message), { status: 500 });
  return updated || { id: tokenId, status: toStatus };
}

module.exports = { bookToken, getDoctorQueue, transitionToken };
