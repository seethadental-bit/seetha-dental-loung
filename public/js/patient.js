// Patient dashboard logic

if (!requireAuth('patient')) { /* redirected */ }

const profile = getProfile();
const nameEl = document.getElementById('patient-name-text');
if (nameEl) nameEl.textContent = profile?.full_name || 'Patient';

let activeTokenId   = null;
let selectedSlot    = null;  // { label, value, session }
let cachedCounts    = {};    // last fetched booked counts
let cachedSlotDate  = null;  // date those counts belong to
const MAX_PER_SLOT  = 2;

// ── Slot generation ───────────────────────────────────────────
function generateSlots() {
  const slots = [];
  // Morning: 9:30 – 13:00, Evening: 14:00 – 18:00
  const ranges = [
    { start: [9, 30],  end: [13, 0],  session: 'Morning' },
    { start: [14, 0],  end: [18, 0],  session: 'Evening' },
  ];
  ranges.forEach(({ start, end, session }) => {
    let [h, m] = start;
    while (h < end[0] || (h === end[0] && m < end[1])) {
      const nh = m + 15 >= 60 ? h + 1 : h;
      const nm = (m + 15) % 60;
      const fmt = t => String(t).padStart(2, '0');
      const label = `${fmt(h)}:${fmt(m)}–${fmt(nh)}:${fmt(nm)}`;
      const display = `${to12(h, m)}–${to12(nh, nm)}`;
      slots.push({ label, display, value: `${fmt(h)}:${fmt(m)}`, session });
      h = nh; m = nm;
    }
  });
  return slots;
}

function to12(h, m) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function nowISTMinutes() {
  const ist = new Date(Date.now() + 5.5 * 3600000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

function todayISTStr() {
  const ist = new Date(Date.now() + 5.5 * 3600000);
  return ist.toISOString().split('T')[0];
}

// ── Render slot grid ──────────────────────────────────────────
function renderSlots(bookedCounts, selectedDate) {
  const slots    = generateSlots();
  const isToday  = selectedDate === todayISTStr();
  const nowMins  = nowISTMinutes();

  const morning = slots.filter(s => s.session === 'Morning');
  const evening = slots.filter(s => s.session === 'Evening');

  ['morning', 'evening'].forEach((sess, i) => {
    const list = i === 0 ? morning : evening;
    const container = document.getElementById(`${sess}-slots`);
    container.innerHTML = list.map(slot => {
      const [sh, sm] = slot.value.split(':').map(Number);
      const slotMins  = sh * 60 + sm;
      const isPast    = isToday && slotMins + 15 <= nowMins;
      const count     = bookedCounts[slot.label] || 0;
      const isFull    = count >= MAX_PER_SLOT;
      const isSelected = selectedSlot?.value === slot.value;

      let cls = 'slot-btn rounded-xl py-2 px-1 text-[11px] font-bold text-center w-full ';
      let disabled = '';
      if (isSelected)     cls += 'slot-selected';
      else if (isPast)    { cls += 'slot-past';   disabled = 'disabled'; }
      else if (isFull)    { cls += 'slot-booked'; disabled = 'disabled'; }
      else                  cls += 'slot-available';

      return `<button class="${cls}" ${disabled} onclick="selectSlot('${slot.value}','${slot.label}','${slot.session}')">${slot.display}</button>`;
    }).join('');
  });
}

function selectSlot(value, label, session) {
  selectedSlot = { value, label, session };
  const date = document.getElementById('booking-date').value;
  renderSlots(cachedCounts, date);  // re-render with cached counts, no API call
}

async function loadAndRenderSlots(doctorId, date) {
  if (!doctorId || !date) return;
  document.getElementById('slot-loading').style.display = '';
  document.getElementById('slot-section').style.display = 'none';

  const res = await apiFetch(`/patient/booked-slots?doctor_id=${doctorId}&date=${date}`);
  cachedCounts   = res.success ? res.data : {};
  cachedSlotDate = date;

  document.getElementById('slot-loading').style.display = 'none';
  document.getElementById('slot-section').style.display = '';
  renderSlots(cachedCounts, date);
}

function onDoctorOrDateChange() {
  selectedSlot  = null;
  cachedCounts  = {};
  cachedSlotDate = null;
  const doctorId = document.getElementById('doctor-select').value;
  const date     = document.getElementById('booking-date').value;
  if (doctorId && date) loadAndRenderSlots(doctorId, date);
  else {
    document.getElementById('slot-section').style.display = 'none';
    document.getElementById('slot-loading').style.display = 'none';
  }
}

// ── Init form defaults ────────────────────────────────────────
window.addEventListener('load', () => {
  const dateInp = document.getElementById('booking-date');
  if (dateInp) {
    const today = todayISTStr();
    dateInp.value = today;
    dateInp.min   = today;
  }
});

// ── Load doctors ──────────────────────────────────────────────
async function loadDoctors() {
  const res = await apiFetch('/patient/doctors');
  const sel = document.getElementById('doctor-select');
  if (!res.success) { sel.innerHTML = '<option>Failed to load specialists</option>'; return; }
  sel.innerHTML = res.data.length
    ? '<option value="">— Select Specialist —</option>' + res.data.map(d =>
        `<option value="${d.id}">${d.display_name}${d.specialty ? ` (${d.specialty})` : ''}</option>`).join('')
    : '<option value="">No specialists available currently</option>';
}

// ── Book token ────────────────────────────────────────────────
async function bookToken() {
  const doctorId = document.getElementById('doctor-select').value;
  const date     = document.getElementById('booking-date').value;
  const notes    = document.getElementById('booking-notes').value;

  if (!doctorId)    return showAlert('alert-box', 'Please select a specialist', 'warn');
  if (!date)        return showAlert('alert-box', 'Please select a date', 'warn');
  if (!selectedSlot) return showAlert('alert-box', 'Please select a time slot', 'warn');

  const slotString = `${selectedSlot.session} | ${selectedSlot.label}`;

  const btn = document.querySelector('button[onclick="bookToken()"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Booking...';

  const res = await apiFetch('/patient/book-token', {
    method: 'POST',
    body: JSON.stringify({ doctor_id: doctorId, booking_date: date, slot_time: slotString, notes })
  });

  btn.disabled = false;
  btn.innerHTML = '<span class="material-symbols-outlined">confirmation_number</span> Book Appointment';

  if (!res.success) return showAlert('alert-box', res.message);

  const token = res.data;
  document.getElementById('booking-notes').value = '';
  selectedSlot = null;
  loadMyTokens();
  showBookingModal(token, date);
  loadAndRenderSlots(doctorId, date);
}

// ── Confirmation modal ────────────────────────────────────────
function showBookingModal(token, date) {
  const slot = (token.slot_time || '').split('|')[1]?.trim() || '—';
  const queuePos = token.queue_position || token.token_number;
  const waitMins = ((queuePos - 1) * 15);

  document.getElementById('modal-token').textContent  = `#${token.token_number}`;
  document.getElementById('modal-slot').textContent   = slot;
  document.getElementById('modal-date').textContent   = date;
  document.getElementById('modal-doctor').textContent = token.doctor?.display_name || '—';
  document.getElementById('modal-queue').textContent  = `#${queuePos}`;
  document.getElementById('modal-wait').textContent   = waitMins > 0 ? `~${waitMins}` : '<5';
  document.getElementById('booking-modal').style.display = '';
}

function closeBookingModal() {
  document.getElementById('booking-modal').style.display = 'none';
}

// ── Token helpers ─────────────────────────────────────────────
function formatToken(t) {
  if (!t) return '';
  const slot = t.slot_time || '';
  const prefix = slot.startsWith('Evening') ? 'E-' : 'M-';
  return `${prefix}${t.token_number}`;
}

async function loadMyTokens() {
  const res = await apiFetch('/patient/my-tokens');
  if (!res.success) return;

  const tokens = res.data || [];
  const active = tokens.find(t => ['waiting', 'called', 'in_progress'].includes(t.status));

  const activeSection = document.getElementById('active-token-section');
  if (active) {
    activeTokenId = active.id;
    activeSection.style.display = '';
    await refreshActiveToken();
  } else {
    activeSection.style.display = 'none';
    activeTokenId = null;
  }

  document.getElementById('tokens-tbody').innerHTML = tokens.map(t => `
    <tr class="hover:bg-slate-50/50 transition-colors">
      <td class="px-2 py-4 font-black text-primary text-lg">#${formatToken(t)}</td>
      <td class="px-2 py-4">
        <div class="font-bold text-slate-700">${t.doctor?.display_name || 'Lounge Specialist'}</div>
        <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${t.doctor?.specialty || ''}</div>
      </td>
      <td class="px-2 py-4">
        <div class="text-sm font-medium text-slate-600">${t.booking_date}</div>
        <div class="text-[10px] text-slate-400 font-bold uppercase">${(t.slot_time || '').split('|')[1]?.trim() || ''}</div>
      </td>
      <td class="px-2 py-4">${badge(t.status)}</td>
      <td class="px-2 py-4 text-right">
        ${['waiting', 'called'].includes(t.status)
          ? `<button onclick="cancelToken('${t.id}')" class="p-2 text-error hover:bg-red-50 rounded-xl transition-all" title="Cancel Token">
               <span class="material-symbols-outlined">cancel</span>
             </button>`
          : '<span class="text-slate-300 material-symbols-outlined">lock</span>'}
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="py-12 text-center text-slate-400">No recent activity found</td></tr>';
}

async function refreshActiveToken() {
  if (!activeTokenId) return;
  const res = await apiFetch(`/patient/my-token-status/${activeTokenId}`);
  if (!res.success) return;
  const t = res.data;

  document.getElementById('active-token-display').innerHTML = `
    <div class="signature-gradient w-48 h-48 rounded-full flex flex-col items-center justify-center text-white shadow-2xl relative">
      <div class="absolute inset-2 border-2 border-white/20 rounded-full"></div>
      <span class="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Your Token</span>
      <span class="text-7xl font-black font-headline tracking-tighter">#${formatToken(t)}</span>
      <div class="mt-2 px-3 py-1 bg-white/20 rounded-full text-[9px] font-bold uppercase tracking-widest">${t.status}</div>
    </div>
  `;

  document.getElementById('active-token-details').innerHTML = `
    <div class="bg-white/60 px-5 py-2.5 rounded-full border border-white text-primary text-sm font-bold flex items-center gap-2 shadow-sm">
      <span class="material-symbols-outlined text-sm">medical_services</span>
      ${t.doctor?.display_name || 'Specialist'}
    </div>
    ${t.queue_position != null ? `
      <div class="bg-indigo-50 px-5 py-2.5 rounded-full border border-indigo-100 text-indigo-700 text-sm font-bold flex items-center gap-2 shadow-sm">
        <span class="material-symbols-outlined text-sm animate-bounce">person</span>
        Position: ${t.queue_position}
      </div>
    ` : ''}
    <div class="bg-emerald-50 px-5 py-2.5 rounded-full border border-emerald-100 text-emerald-700 text-sm font-bold flex items-center gap-2 shadow-sm">
      <span class="material-symbols-outlined text-sm">schedule</span>
      ${(t.slot_time || '').split('|')[1]?.trim() || t.booking_date}
    </div>
  `;
}

async function cancelToken(id) {
  if (!confirm('Are you sure you want to release your spot in the queue?')) return;
  const res = await apiFetch(`/patient/tokens/${id}/cancel`, { method: 'PATCH' });
  if (!res.success) return showAlert('alert-box', res.message);
  showAlert('alert-box', 'Token released successfully.', 'success');
  loadMyTokens();
}

// ── Init ──────────────────────────────────────────────────────
loadDoctors();
loadMyTokens();
setInterval(() => { if (activeTokenId) refreshActiveToken(); }, 15000);
