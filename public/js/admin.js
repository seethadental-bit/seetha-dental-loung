// Admin dashboard — full management logic

if (!requireAuth('admin')) { /* redirected by requireAuth */ }

// ── State ──────────────────────────────────────────────────
let editingDoctorId  = null;
let editingPatientId = null;
let doctorList       = [];
let searchTimer      = null;

// ── Section navigation ─────────────────────────────────────
function showSection(name) {
  ['dashboard','doctors','patients','tokens'].forEach(s => {
    const el = document.getElementById(`sec-${s}`);
    if (el) el.style.display = s === name ? '' : 'none';
    const nav = document.getElementById(`nav-${s}`);
    if (nav) nav.classList.toggle('nav-active', s === name);
  });
  if (name === 'dashboard') loadDashboard();
  if (name === 'doctors')   loadDoctors();
  if (name === 'patients')  loadPatients();
  if (name === 'tokens')    { loadDoctorFilter(); loadTokens(); }
}

// ── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  const res = await apiFetch('/admin/dashboard');
  if (!res.success) return;
  const { summary, byDoctor } = res.data;

  const stats = [
    { l: 'Total Bookings', n: summary.total,       c: 'primary',   i: 'analytics' },
    { l: 'Waiting',        n: summary.waiting||0,  c: 'secondary', i: 'hourglass_empty' },
    { l: 'In Progress',    n: summary.in_progress||0,c: 'primary', i: 'play_circle' },
    { l: 'Completed',      n: summary.completed||0,c: 'emerald-600', i: 'check_circle' },
    { l: 'Skipped',        n: summary.skipped||0,  c: 'amber-600', i: 'redo' },
    { l: 'Cancelled',      n: summary.cancelled||0,c: 'error',     i: 'cancel' }
  ];

  document.getElementById('stat-grid').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2">
        <span class="material-symbols-outlined text-${s.c} opacity-80">${s.i}</span>
      </div>
      <div class="num text-${s.c}">${s.n}</div>
      <div class="lbl">${s.l}</div>
    </div>`).join('');

  if (doctorList.length && Object.keys(byDoctor).length) {
    const rows = Object.entries(byDoctor).map(([did, count]) => {
      const doc = doctorList.find(d => d.id === did);
      return `
        <tr class="hover:bg-slate-50/50 transition-colors text-sm">
          <td class="px-6 py-4 font-bold text-slate-700">${doc?.display_name || did}</td>
          <td class="px-6 py-4 text-right"><span class="bg-primary/5 text-primary px-3 py-1 rounded-full font-bold">${count}</span></td>
        </tr>`;
    }).join('');
    
    document.getElementById('doctor-stats-wrap').innerHTML = `
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden max-w-2xl mt-8">
        <div class="px-6 py-5 border-b border-slate-100">
          <h3 class="font-headline font-bold text-primary">Doctor-wise Token Summary</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th class="px-6 py-4">Specialist</th>
                <th class="px-6 py-4 text-right">Tokens</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">${rows}</tbody>
          </table>
        </div>
      </div>`;
  }
}

// ── Doctors ────────────────────────────────────────────────
async function loadDoctors() {
  const res = await apiFetch('/admin/doctors');
  if (!res.success) return;
  doctorList = res.data;

  document.getElementById('doctors-tbody').innerHTML = res.data.length
    ? res.data.map(d => `
      <tr class="hover:bg-slate-50/50 transition-colors group">
        <td class="px-6 py-4">
          <div class="flex flex-col">
            <span class="font-bold text-slate-900">${d.display_name}</span>
            <span class="text-xs text-slate-400 font-medium">${d.profile?.phone || '—'}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-slate-600">${d.specialty || '—'}</td>
        <td class="px-6 py-4 text-sm text-slate-600 font-medium">${d.consultation_start_time || '—'} – ${d.consultation_end_time || '—'}</td>
        <td class="px-6 py-4 text-sm font-bold text-slate-400">${d.max_daily_tokens || '∞'}</td>
        <td class="px-6 py-4">
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" class="sr-only peer" ${d.is_available ? 'checked' : ''} onchange="toggleAvailability('${d.id}',this.checked)">
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </td>
        <td class="px-6 py-4 text-right">
          <div class="flex items-center justify-end gap-2">
            <button onclick="openDoctorModal('${d.id}')" class="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all" title="Edit Doctor">
              <span class="material-symbols-outlined text-lg">edit</span>
            </button>
            <button onclick="viewDoctorQueue('${d.id}','${d.display_name}')" class="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all" title="View Queue">
              <span class="material-symbols-outlined text-lg">format_list_numbered</span>
            </button>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400">No medical staff found</td></tr>';
}

async function toggleAvailability(id, val) {
  const res = await apiFetch(`/admin/doctors/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ is_available: val }) });
  if (!res.success) showAlert('global-alert', res.message);
  else loadDoctors();
}

async function viewDoctorQueue(doctorId, name) {
  openHistoryDrawer(`Queue — ${name}`);
  const res = await apiFetch(`/admin/tokens?doctor_id=${doctorId}`);
  renderDrawerTokens(res);
}

// ── DOCTOR MANAGEMENT ──────────────────────────────────────
// Doctor modal
function openDoctorModal(id = null) {
  editingDoctorId = id;
  const isEdit = !!id;
  document.getElementById('doctor-modal-title').textContent = isEdit ? 'Edit Specialist' : 'Add Doctor';
  document.getElementById('doctor-modal-alert').innerHTML = '';
  document.getElementById('dm-password-group').style.display = isEdit ? 'none' : '';

  if (!isEdit) {
    document.getElementById('doctor-form').reset();
    document.getElementById('dm-available').checked = true;
  } else {
    const d = doctorList.find(x => x.id === id);
    if (d) {
      document.getElementById('dm-name').value      = d.display_name || '';
      document.getElementById('dm-email').value     = '';
      document.getElementById('dm-phone').value     = d.profile?.phone || '';
      document.getElementById('dm-specialty').value = d.specialty || '';
      document.getElementById('dm-start').value     = d.consultation_start_time || '';
      document.getElementById('dm-end').value       = d.consultation_end_time || '';
      document.getElementById('dm-max').value       = d.max_daily_tokens || '';
      document.getElementById('dm-available').checked = d.is_available;
    }
  }
  document.getElementById('doctor-modal').style.display = 'flex';
}

function closeDoctorModal() {
  document.getElementById('doctor-modal').style.display = 'none';
  editingDoctorId = null;
}

async function saveDoctorForm(e) {
  e.preventDefault();
  const alertEl = document.getElementById('doctor-modal-alert');
  alertEl.innerHTML = '';

  const name     = document.getElementById('dm-name').value.trim();
  const email    = document.getElementById('dm-email').value.trim();
  const password = document.getElementById('dm-password').value;
  const phone    = document.getElementById('dm-phone').value.trim();

  if (!name) { alertEl.innerHTML = alertHtml('Name is required'); return; }
  if (!editingDoctorId && !email) { alertEl.innerHTML = alertHtml('Email is required'); return; }
  if (!editingDoctorId && password.length < 6) { alertEl.innerHTML = alertHtml('Password must be at least 6 characters'); return; }

  const btn = document.getElementById('doctor-save-btn');
  btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span>';

  const body = {
    display_name:             name,
    email,
    phone:                    phone || undefined,
    password:                 password || undefined,
    specialty:                document.getElementById('dm-specialty').value || undefined,
    consultation_start_time:  document.getElementById('dm-start').value || null,
    consultation_end_time:    document.getElementById('dm-end').value || null,
    max_daily_tokens:         document.getElementById('dm-max').value ? parseInt(document.getElementById('dm-max').value) : null,
    is_available:             document.getElementById('dm-available').checked
  };

  const res = editingDoctorId
    ? await apiFetch(`/admin/doctors/${editingDoctorId}`, { method: 'PUT', body: JSON.stringify(body) })
    : await apiFetch('/admin/doctors', { method: 'POST', body: JSON.stringify(body) });

  btn.disabled = false; btn.textContent = 'Save Record';

  if (!res.success) { alertEl.innerHTML = alertHtml(res.message); return; }
  closeDoctorModal();
  loadDoctors();
  showAlert('global-alert', editingDoctorId ? 'Doctor updated.' : 'Doctor account created.', 'success');
}

// ── PATIENT MANAGEMENT ─────────────────────────────────────

// ── Patients ───────────────────────────────────────────────
async function loadPatients() {
  const search = document.getElementById('patient-search')?.value.trim() || '';
  const url = `/admin/users?role=patient${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const res = await apiFetch(url);
  if (!res.success) return;

  const items = res.data.items || [];

  document.getElementById('patients-tbody').innerHTML = items.length
    ? items.map(u => `
      <tr class="hover:bg-slate-50/50 transition-colors group">
        <td class="px-6 py-4 font-bold text-slate-900">${u.full_name}</td>
        <td class="px-6 py-4 text-sm text-slate-600">${u.phone || '—'}</td>
        <td class="px-6 py-4">${statusBadge(u)}</td>
        <td class="px-6 py-4 text-xs font-bold text-slate-400">${new Date(u.created_at).toLocaleDateString('en-IN')}</td>
        <td class="px-6 py-4 text-right">
          <div class="flex items-center justify-end gap-1">
            <button onclick="openPatientModal('${u.id}','${escHtml(u.full_name)}','${u.phone||''}')" class="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all" title="Edit Profile">
              <span class="material-symbols-outlined text-lg">edit</span>
            </button>
            <button onclick="viewPatientHistory('${u.id}','${escHtml(u.full_name)}')" class="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all" title="Token History">
              <span class="material-symbols-outlined text-lg">history</span>
            </button>
            ${u.is_banned
              ? `<button onclick="setUserStatus('${u.id}',{is_banned:false})" class="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all" title="Unban Patient"><span class="material-symbols-outlined text-lg">lock_open</span></button>`
              : `<button onclick="setUserStatus('${u.id}',{is_banned:true})" class="p-2 text-error hover:bg-red-50 rounded-xl transition-all" title="Ban Patient"><span class="material-symbols-outlined text-lg">block</span></button>`}
            ${u.is_active
              ? `<button onclick="setUserStatus('${u.id}',{is_active:false})" class="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Deactivate Account"><span class="material-symbols-outlined text-lg">do_not_disturb_on</span></button>`
              : `<button onclick="setUserStatus('${u.id}',{is_active:true})" class="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all" title="Activate Account"><span class="material-symbols-outlined text-lg">check_circle</span></button>`}
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="px-6 py-12 text-center text-slate-400">No patient records found</td></tr>';
}

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadPatients, 350);
}

async function setUserStatus(id, update) {
  const res = await apiFetch(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify(update) });
  if (res.success) loadPatients();
  else showAlert('global-alert', res.message);
}

async function viewPatientHistory(id, name) {
  openHistoryDrawer(`Token History — ${name}`);
  const res = await apiFetch(`/admin/users/${id}/tokens`);
  renderDrawerTokens(res);
}

// Patient modal
function openPatientModal(id = null, name = '', phone = '') {
  editingPatientId = id;
  const isEdit = !!id;
  document.getElementById('patient-modal-title').textContent = isEdit ? 'Patient Profile' : 'Add Patient';
  document.getElementById('patient-modal-alert').innerHTML = '';
  document.getElementById('pm-password-group').style.display = isEdit ? 'none' : '';

  document.getElementById('pm-name').value  = name;
  document.getElementById('pm-phone').value = phone;
  if (!isEdit) {
    document.getElementById('pm-email').value    = '';
    document.getElementById('pm-password').value = '';
    document.getElementById('pm-status').value   = 'active';
  }
  document.getElementById('patient-modal').style.display = 'flex';
}

function closePatientModal() {
  document.getElementById('patient-modal').style.display = 'none';
  editingPatientId = null;
}

async function savePatientForm(e) {
  e.preventDefault();
  const alertEl = document.getElementById('patient-modal-alert');
  alertEl.innerHTML = '';

  const name     = document.getElementById('pm-name').value.trim();
  const phone    = document.getElementById('pm-phone').value.trim();
  const email    = document.getElementById('pm-email').value.trim();
  const password = document.getElementById('pm-password').value;
  const status   = document.getElementById('pm-status').value;

  if (!name)  { alertEl.innerHTML = alertHtml('Full name is required'); return; }
  if (!phone) { alertEl.innerHTML = alertHtml('Phone number is required'); return; }
  if (!editingPatientId && !email)    { alertEl.innerHTML = alertHtml('Email is required'); return; }
  if (!editingPatientId && password.length < 6) { alertEl.innerHTML = alertHtml('Password must be at least 6 characters'); return; }

  const btn = document.getElementById('patient-save-btn');
  btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span>';

  let res;
  if (editingPatientId) {
    res = await apiFetch(`/admin/users/${editingPatientId}`, { method: 'PUT', body: JSON.stringify({ full_name: name, phone }) });
  } else {
    res = await apiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ full_name: name, phone, email, password, role: 'patient', is_active: status === 'active' })
    });
  }

  btn.disabled = false; btn.textContent = 'Save Record';

  if (!res.success) { alertEl.innerHTML = alertHtml(res.message); return; }
  closePatientModal();
  loadPatients();
  showAlert('global-alert', editingPatientId ? 'Patient updated.' : 'Patient account created.', 'success');
}

// ── Tokens ─────────────────────────────────────────────────
async function loadDoctorFilter() {
  if (doctorList.length) return;
  const res = await apiFetch('/admin/doctors');
  if (!res.success) return;
  doctorList = res.data;
  const sel = document.getElementById('token-doctor-filter');
  if (sel) {
    sel.innerHTML = '<option value="">All Doctors</option>';
    res.data.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id; opt.textContent = d.display_name;
      sel.appendChild(opt);
    });
  }
}

async function loadTokens() {
  const date     = document.getElementById('token-date-filter')?.value || '';
  const doctorId = document.getElementById('token-doctor-filter')?.value || '';
  let url = '/admin/tokens?';
  if (date)     url += `date=${date}&`;
  if (doctorId) url += `doctor_id=${doctorId}`;

  const res = await apiFetch(url);
  if (!res.success) return;

  const items = res.data.items || [];

  document.getElementById('tokens-tbody').innerHTML = items.length
    ? items.map(t => `
      <tr class="hover:bg-slate-50/50 transition-colors text-sm">
        <td class="px-6 py-4"><span class="bg-slate-100 text-slate-700 px-2 py-1 rounded font-mono font-bold text-xs">#${formatToken(t)}</span></td>
        <td class="px-6 py-4">
          <div class="flex flex-col">
            <span class="font-bold text-slate-900">${t.patient?.full_name || '—'}</span>
            <span class="text-[10px] text-slate-400 uppercase font-bold">${t.patient?.phone||''}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-slate-600 font-medium">${t.doctor?.display_name || '—'}</td>
        <td class="px-6 py-4 text-slate-500">${t.booking_date}</td>
        <td class="px-6 py-4">${badge(t.status)}</td>
        <td class="px-6 py-4 text-right">
          ${!['completed','cancelled'].includes(t.status)
            ? `<button onclick="adminCancel('${t.id}')" class="p-2 text-error hover:bg-red-50 rounded-xl transition-all" title="Cancel Token"><span class="material-symbols-outlined text-lg">cancel</span></button>`
            : '—'}
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400">No token logs found</td></tr>';
}

async function adminCancel(id) {
  if (!confirm('Cancel this token?')) return;
  const res = await apiFetch(`/admin/tokens/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ cancel_reason: 'Cancelled by admin' }) });
  if (res.success) { loadTokens(); showAlert('global-alert', 'Token cancelled.', 'success'); }
  else showAlert('global-alert', res.message);
}

// ── Drawer (token history) ─────────────────────────────────
function openHistoryDrawer(title) {
  document.getElementById('drawer-title').textContent = title;
  document.getElementById('drawer-body').innerHTML = '<div class="py-12 text-center"><span class="material-symbols-outlined animate-spin text-primary">sync</span></div>';
  document.getElementById('history-backdrop').classList.remove('hidden');
  document.getElementById('history-drawer').classList.add('open');
}

function closeHistoryDrawer() {
  document.getElementById('history-backdrop').classList.add('hidden');
  document.getElementById('history-drawer').classList.remove('open');
}

function renderDrawerTokens(res) {
  if (!res.success) {
    document.getElementById('drawer-body').innerHTML = `<div class="alert alert-error">${res.message}</div>`;
    return;
  }
  if (!res.data.length) {
    document.getElementById('drawer-body').innerHTML = '<div class="py-12 text-center text-slate-400 italic">No historical data found</div>';
    return;
  }
  document.getElementById('drawer-body').innerHTML = res.data.map(t => `
    <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <div class="flex justify-between items-center">
        <span class="text-2xl font-black text-primary">#${t.token_number}</span>
        ${badge(t.status)}
      </div>
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-sm font-bold text-slate-600">
          <span class="material-symbols-outlined text-sm text-primary">medical_services</span>
          ${t.doctor?.display_name || 'General Lounge'}
        </div>
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <span class="material-symbols-outlined text-sm">calendar_today</span>
          ${t.booking_date}
        </div>
      </div>
      ${t.notes ? `<div class="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 leading-relaxed font-medium">"${t.notes}"</div>` : ''}
      ${t.cancel_reason ? `<div class="text-[10px] font-bold uppercase text-error tracking-widest flex items-center gap-1"><span class="material-symbols-outlined text-xs">info</span> ${t.cancel_reason}</div>` : ''}
    </div>`).join('');
}

// ── Helpers ────────────────────────────────────────────────
function alertHtml(msg) {
  return `<div class="alert alert-error">${msg}</div>`;
}

function badge(status) {
  const cfg = {
    waiting:     'bg-secondary-container text-on-secondary-container',
    called:      'bg-primary-fixed text-primary',
    completed:   'bg-emerald-100 text-emerald-700',
    cancelled:   'bg-red-100 text-red-700',
    skipped:     'bg-amber-100 text-amber-700',
    in_progress: 'bg-indigo-100 text-indigo-700'
  };
  const cls = cfg[status] || 'bg-slate-100 text-slate-600';
  return `<span class="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-tight ${cls}">${status.replace('_', ' ')}</span>`;
}

function statusBadge(u) {
  if (u.is_banned)  return badge('cancelled');
  if (!u.is_active) return `<span class="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-tight bg-slate-100 text-slate-400">Inactive</span>`;
  return `<span class="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-tight bg-emerald-50 text-emerald-600">Active</span>`;
}

function escHtml(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function handleBackdropClick(e, modalId) {
  if (e.target.id === modalId) {
    if (modalId === 'doctor-modal')  closeDoctorModal();
    if (modalId === 'patient-modal') closePatientModal();
  }
}

// ── Init ───────────────────────────────────────────────────
loadDashboard();
apiFetch('/admin/doctors').then(r => { if (r.success) doctorList = r.data; });

// ── Report Generation ──────────────────────────────────────
async function downloadReport() {
  const res = await apiFetch('/admin/dashboard');
  if (!res.success) return showAlert('global-alert', 'Failed to fetch report data');
  const { summary, byDoctor } = res.data;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const accentColor = [0, 63, 135]; // #003f87
  const lightAccent = [215, 226, 255]; // #d7e2ff

  // 1. Header Design (Reference Style)
  doc.setFillColor(248, 249, 250); // Background
  doc.rect(0, 0, 210, 297, 'F');
  
  // Sidebar Accent Line (Reference)
  doc.setFillColor(...accentColor);
  doc.rect(5, 5, 2, 287, 'F');

  // Clinic Info
  doc.setTextColor(...accentColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SEETHA DENTAL LOUNGE', 15, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Junction, Paravur, Kerala 691301', 15, 32);
  doc.text('info@seethadental.com | +91 80753 33723', 15, 37);

  // Line Separator
  doc.setDrawColor(...lightAccent);
  doc.setLineWidth(0.5);
  doc.line(15, 45, 195, 45);

  // 2. Report Title
  doc.setFontSize(28);
  doc.setTextColor(...accentColor);
  doc.setFont('helvetica', 'bold');
  doc.text('CLINICAL SUMMARY', 15, 65);
  doc.setFontSize(14);
  doc.text('DAILY OPERATIONS REPORT', 15, 75);
  
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generated on: ${dateStr}`, 15, 82);

  // 3. Summary Boxes (Bento Style)
  const boxW = 60;
  const boxH = 25;
  const startY = 95;

  const drawBox = (x, y, label, val, color) => {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, boxW - 5, boxH, 3, 3, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + 5, y + 8);
    doc.setTextColor(...color);
    doc.setFontSize(14);
    doc.text(String(val), x + 5, y + 18);
  };

  drawBox(15, startY, 'Total Bookings', summary.total, accentColor);
  drawBox(15 + boxW, startY, 'Completed', summary.completed || 0, [56, 161, 105]);
  drawBox(15 + (boxW * 2), startY, 'In Queue', summary.waiting || 0, [49, 130, 206]);

  // 4. Doctor Breakdown Table
  doc.setFontSize(14);
  doc.setTextColor(...accentColor);
  doc.setFont('helvetica', 'bold');
  doc.text('SPECIALIST WORKLOAD', 15, 140);

  const tableData = Object.entries(byDoctor).map(([did, count]) => {
    const docObj = doctorList.find(d => d.id === did);
    return [
      docObj?.display_name || did,
      docObj?.specialty || 'General Dentistry',
      count,
      'Active'
    ];
  });

  doc.autoTable({
    startY: 145,
    margin: { left: 15 },
    head: [['Doctor Name', 'Specialty', 'Tokens Issued', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: accentColor, textColor: 255, fontStyle: 'bold' },
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 5 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  // 5. Footer
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text('This is an electronically generated report. Clinical Serenity Defined.', 15, 280);
  
  doc.save(`SDL_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

setInterval(() => {
  if (document.getElementById('sec-dashboard').style.display !== 'none') loadDashboard();
}, 20000);
