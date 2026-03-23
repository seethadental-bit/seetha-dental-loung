const { supabaseAdmin } = require('../config/supabaseClient');
const { sendRecallEmail } = require('./emailService');

const INTERVALS = {
  '1_week':   7,
  '1_month':  30,
  '3_months': 90,
  '6_months': 180,
};

function calcRecallDate(interval) {
  const days = INTERVALS[interval];
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function createRecall({ patientId, doctorId, tokenId, interval }) {
  const recall_date = calcRecallDate(interval);
  if (!recall_date) return null;

  const { data, error } = await supabaseAdmin
    .from('recalls')
    .insert({ patient_id: patientId, doctor_id: doctorId, original_token_id: tokenId, recall_date })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Called daily by cron — sends emails for recalls due in 7 days
async function processDueRecalls() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  const dateStr = targetDate.toISOString().split('T')[0];

  const { data: recalls, error } = await supabaseAdmin
    .from('recalls')
    .select('*, patient:patient_id(full_name, email:id), doctor:doctor_id(display_name)')
    .eq('recall_date', dateStr)
    .eq('status', 'pending');

  if (error) { console.error('[recall] Query error:', error.message); return; }
  if (!recalls?.length) { console.log('[recall] No recalls due on', dateStr); return; }

  for (const recall of recalls) {
    try {
      // Get patient email from auth
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(recall.patient_id);
      await sendRecallEmail({
        to: user.email,
        name: recall.patient.full_name,
        doctorName: recall.doctor.display_name,
        recallDate: recall.recall_date,
        recallId: recall.id,
      });

      await supabaseAdmin.from('recalls')
        .update({ status: 'sent', email_sent_at: new Date().toISOString() })
        .eq('id', recall.id);

      console.log('[recall] Email sent for recall', recall.id);
    } catch (err) {
      console.error('[recall] Failed for', recall.id, err.message);
    }
  }
}

module.exports = { createRecall, processDueRecalls };
