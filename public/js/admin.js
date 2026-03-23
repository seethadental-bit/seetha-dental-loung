// Admin dashboard — full management logic

if (!requireAuth('admin')) { /* redirected by requireAuth */ }

// ── State ──────────────────────────────────────────────────
let editingDoctorId  = null;
let editingPatientId = null;
let doctorList       = [];
let searchTimer      = null;

// ── Section navigation ─────────────────────────────────────
function showSection(name) {
  ['dashboard','doctors','patients','tokens','recalls'].forEach(s => {
    const el = document.getElementById(`sec-${s}`);
    if (el) el.style.display = s === name ? '' : 'none';
    const nav = document.getElementById(`nav-${s}`);
    if (nav) nav.classList.toggle('nav-active', s === name);
  });
  if (name === 'dashboard') loadDashboard();
  if (name === 'doctors')   loadDoctors();
  if (name === 'patients')  loadPatients();
  if (name === 'tokens')    { loadDoctorFilter(); loadTokens(); }
  if (name === 'recalls')   loadRecalls();
}

function safeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  const res = await apiFetch('/admin/dashboard');
  if (!res.success) return;
  const { summary, byDoctor } = res.data;

  const stats = [
    { l: 'Total Bookings', n: summary.total,          c: 'primary',     i: 'analytics',      status: '' },
    { l: 'Waiting',        n: summary.waiting||0,     c: 'secondary',   i: 'hourglass_empty',status: 'waiting' },
    { l: 'In Progress',    n: summary.in_progress||0, c: 'primary',     i: 'play_circle',    status: 'in_progress' },
    { l: 'Completed',      n: summary.completed||0,   c: 'emerald-600', i: 'check_circle',   status: 'completed' },
    { l: 'Skipped',        n: summary.skipped||0,     c: 'amber-600',   i: 'redo',           status: 'skipped' },
    { l: 'Cancelled',      n: summary.cancelled||0,   c: 'error',       i: 'cancel',         status: 'cancelled' }
  ];

  const colorMap = {
    'primary': '#003f87', 'secondary': '#4a6079',
    'emerald-600': '#059669', 'amber-600': '#d97706', 'error': '#ba1a1a'
  };

  const statGrid = document.getElementById('stat-grid');
  statGrid.innerHTML = '';
  stats.forEach(s => {
    const color = colorMap[s.c] || '#003f87';
    const clickable = ['waiting','in_progress','completed','skipped','cancelled'].includes(s.status);
    const card = document.createElement('div');
    card.style.cssText = `background:white;border:1px solid #e2e8f0;border-radius:1rem;padding:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.06);${clickable ? 'cursor:pointer;' : ''}transition:box-shadow 0.2s`;
    
    if (clickable) {
      card.onclick = () => openStatDrawer(s.status, s.l);
      card.onmouseover = () => card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      card.onmouseout = () => card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
    }

    card.innerHTML = `
      <span class="material-symbols-outlined" style="color:${color};opacity:0.8;font-size:1.5rem">${s.i}</span>
      <div style="font-size:2rem;font-weight:900;line-height:1;margin:0.25rem 0;color:${color}">${s.n}</div>
      <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">${s.l}</div>
      ${clickable && s.n > 0 ? '<div style="font-size:0.6rem;color:#94a3b8;margin-top:0.25rem">tap to view ›</div>' : ''}
    `;
    statGrid.appendChild(card);
  });

  const statsWrap = document.getElementById('doctor-stats-wrap');
  if (doctorList.length && Object.keys(byDoctor).length) {
    statsWrap.innerHTML = `
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
            <tbody id="doctor-stats-tbody" class="divide-y divide-slate-50"></tbody>
          </table>
        </div>
      </div>`;
    
    const tbody = document.getElementById('doctor-stats-tbody');
    Object.entries(byDoctor).forEach(([did, count]) => {
      const doc = doctorList.find(d => d.id === did);
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50/50 transition-colors text-sm";
      tr.innerHTML = `
        <td class="px-6 py-4 font-bold text-slate-700 name-cell"></td>
        <td class="px-6 py-4 text-right"><span class="bg-primary/5 text-primary px-3 py-1 rounded-full font-bold">${count}</span></td>
      `;
      tr.querySelector('.name-cell').textContent = doc?.display_name || did;
      tbody.appendChild(tr);
    });
  } else {
    statsWrap.innerHTML = '';
  }
}


// ── Doctors ────────────────────────────────────────────────
async function loadDoctors() {
  const res = await apiFetch('/admin/doctors');
  if (!res.success) return;
  doctorList = res.data;

  const tbody = document.getElementById('doctors-tbody');
  tbody.innerHTML = '';

  if (!res.data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400">No medical staff found</td></tr>';
    return;
  }

  res.data.forEach(d => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 transition-colors group";
    tr.innerHTML = `
      <td class="px-6 py-4">
        <div class="flex flex-col">
          <span class="font-bold text-slate-900 name-cell"></span>
          <span class="text-xs text-slate-400 font-medium email-cell"></span>
          <span class="text-xs text-slate-400 font-medium phone-cell"></span>
        </div>
      </td>
      <td class="px-6 py-4 text-sm text-slate-600 specialty-cell"></td>
      <td class="px-6 py-4 text-sm text-slate-600 font-medium hours-cell"></td>
      <td class="px-6 py-4 text-sm font-bold text-slate-400 max-cell"></td>
      <td class="px-6 py-4">
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" class="sr-only peer avail-check" ${d.is_available ? 'checked' : ''}>
          <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </td>
      <td class="px-6 py-4 text-right">
        <div class="flex items-center justify-end gap-2">
          <button class="edit-btn p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all" title="Edit Doctor">
            <span class="material-symbols-outlined text-lg">edit</span>
          </button>
          <button class="queue-btn p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all" title="View Queue">
            <span class="material-symbols-outlined text-lg">format_list_numbered</span>
          </button>
          <button class="delete-btn p-2 text-error hover:bg-red-50 rounded-xl transition-all" title="Delete Doctor">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </td>
    `;

    tr.querySelector('.name-cell').textContent = d.display_name;
    tr.querySelector('.email-cell').textContent = d.profile?.email || '—';
    tr.querySelector('.phone-cell').textContent = d.profile?.phone || '—';
    tr.querySelector('.specialty-cell').textContent = d.specialty || '—';
    tr.querySelector('.hours-cell').textContent = `${d.consultation_start_time || '—'} – ${d.consultation_end_time || '—'}`;
    tr.querySelector('.max-cell').textContent = d.max_daily_tokens || '∞';

    tr.querySelector('.avail-check').onchange = (e) => toggleAvailability(d.id, e.target.checked);
    tr.querySelector('.edit-btn').onclick = () => openDoctorModal(d.id);
    tr.querySelector('.queue-btn').onclick = () => viewDoctorQueue(d.id, d.display_name);
    tr.querySelector('.delete-btn').onclick = () => deleteDoctor(d.id, d.display_name);

    tbody.appendChild(tr);
  });
}


async function deleteDoctor(id, name) {
  if (!confirm(`Delete Dr. ${name}? This will also delete their account and cannot be undone.`)) return;
  const res = await apiFetch(`/admin/doctors/${id}`, { method: 'DELETE' });
  if (res.success) { loadDoctors(); showAlert('global-alert', 'Doctor deleted.', 'success'); }
  else showAlert('global-alert', res.message);
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
  document.getElementById('dm-email').readOnly = isEdit;

  if (!isEdit) {
    document.getElementById('doctor-form').reset();
    document.getElementById('dm-available').checked = true;
  } else {
    const d = doctorList.find(x => x.id === id);
    if (d) {
      document.getElementById('dm-name').value      = d.display_name || '';
      document.getElementById('dm-email').value     = d.profile?.email || '';
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

async function loadPatients() {
  const search = document.getElementById('patient-search')?.value.trim() || '';
  const url = `/admin/users?role=patient${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const res = await apiFetch(url);
  if (!res.success) return;

  const items = res.data.items || [];
  const tbody = document.getElementById('patients-tbody');
  tbody.innerHTML = '';

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-12 text-center text-slate-400">No patient records found</td></tr>';
    return;
  }

  items.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 transition-colors group";
    tr.innerHTML = `
      <td class="px-6 py-4 font-bold text-slate-900 name-cell"></td>
      <td class="px-6 py-4 text-sm text-slate-600 phone-cell"></td>
      <td class="px-6 py-4 status-cell"></td>
      <td class="px-6 py-4 text-xs font-bold text-slate-400 date-cell"></td>
      <td class="px-6 py-4 text-right">
        <div class="flex items-center justify-end gap-1">
          <button class="edit-btn p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all" title="Edit Profile">
            <span class="material-symbols-outlined text-lg">edit</span>
          </button>
          <button class="hist-btn p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all" title="Token History">
            <span class="material-symbols-outlined text-lg">history</span>
          </button>
          <button class="del-btn p-2 text-error hover:bg-red-50 rounded-xl transition-all" title="Delete Patient">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
          <span class="status-btns flex items-center gap-1"></span>
        </div>
      </td>
    `;

    tr.querySelector('.name-cell').textContent = u.full_name;
    tr.querySelector('.phone-cell').textContent = u.phone || '—';
    tr.querySelector('.date-cell').textContent = new Date(u.created_at).toLocaleDateString('en-IN');
    tr.querySelector('.status-cell').innerHTML = statusBadge(u);

    const sBtns = tr.querySelector('.status-btns');
    if (u.is_banned) {
      const btn = document.createElement('button');
      btn.className = "p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all";
      btn.title = "Unban Patient";
      btn.innerHTML = '<span class="material-symbols-outlined text-lg">lock_open</span>';
      btn.onclick = () => setUserStatus(u.id, { is_banned: false });
      sBtns.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = "p-2 text-error hover:bg-red-50 rounded-xl transition-all";
      btn.title = "Ban Patient";
      btn.innerHTML = '<span class="material-symbols-outlined text-lg">block</span>';
      btn.onclick = () => setUserStatus(u.id, { is_banned: true });
      sBtns.appendChild(btn);
    }

    if (u.is_active) {
      const btn = document.createElement('button');
      btn.className = "p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all";
      btn.title = "Deactivate Account";
      btn.innerHTML = '<span class="material-symbols-outlined text-lg">do_not_disturb_on</span>';
      btn.onclick = () => setUserStatus(u.id, { is_active: false });
      sBtns.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = "p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all";
      btn.title = "Activate Account";
      btn.innerHTML = '<span class="material-symbols-outlined text-lg">check_circle</span>';
      btn.onclick = () => setUserStatus(u.id, { is_active: true });
      sBtns.appendChild(btn);
    }

    tr.querySelector('.edit-btn').onclick = () => openPatientModal(u.id, u.full_name, u.phone, u.email);
    tr.querySelector('.hist-btn').onclick = () => viewPatientHistory(u.id, u.full_name);
    tr.querySelector('.del-btn').onclick  = () => deletePatient(u.id, u.full_name);

    tbody.appendChild(tr);
  });
}


async function deletePatient(id, name) {
  if (!confirm(`Delete patient ${name}? This cannot be undone.`)) return;
  const res = await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
  if (res.success) { loadPatients(); showAlert('global-alert', 'Patient deleted.', 'success'); }
  else showAlert('global-alert', res.message);
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
function openPatientModal(id = null, name = '', phone = '', email = '') {
  editingPatientId = id;
  const isEdit = !!id;
  document.getElementById('patient-modal-title').textContent = isEdit ? 'Edit Patient' : 'Add Patient';
  document.getElementById('patient-modal-alert').innerHTML = '';
  document.getElementById('pm-password-group').style.display = isEdit ? 'none' : '';
  document.getElementById('pm-email').readOnly = isEdit;

  document.getElementById('pm-name').value  = name;
  document.getElementById('pm-phone').value = phone;
  document.getElementById('pm-email').value = email;
  if (!isEdit) {
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
  const tbody = document.getElementById('tokens-tbody');
  tbody.innerHTML = '';

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400">No token logs found</td></tr>';
    return;
  }

  items.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 transition-colors text-sm";
    tr.innerHTML = `
      <td class="px-6 py-4"><span class="bg-slate-100 text-slate-700 px-2 py-1 rounded font-mono font-bold text-xs token-cell"></span></td>
      <td class="px-6 py-4">
        <div class="flex flex-col">
          <span class="font-bold text-slate-900 name-cell"></span>
          <span class="text-[10px] text-slate-400 uppercase font-bold phone-cell"></span>
        </div>
      </td>
      <td class="px-6 py-4 text-slate-600 font-medium doc-cell"></td>
      <td class="px-6 py-4 text-slate-500 date-cell"></td>
      <td class="px-6 py-4 status-cell"></td>
      <td class="px-6 py-4 text-right action-cell"></td>
    `;

    tr.querySelector('.token-cell').textContent = `#${formatToken(t)}`;
    tr.querySelector('.name-cell').textContent = t.patient?.full_name || '—';
    tr.querySelector('.phone-cell').textContent = t.patient?.phone || '';
    tr.querySelector('.doc-cell').textContent = t.doctor?.display_name || '—';
    tr.querySelector('.date-cell').textContent = t.booking_date;
    tr.querySelector('.status-cell').innerHTML = badge(t.status);

    const actionCell = tr.querySelector('.action-cell');
    if (!['completed','cancelled'].includes(t.status)) {
      const btn = document.createElement('button');
      btn.className = "p-2 text-error hover:bg-red-50 rounded-xl transition-all";
      btn.title = "Cancel Token";
      btn.innerHTML = '<span class="material-symbols-outlined text-lg">cancel</span>';
      btn.onclick = () => adminCancel(t.id);
      actionCell.appendChild(btn);
    } else {
      actionCell.textContent = '—';
    }

    tbody.appendChild(tr);
  });
}

async function adminCancel(id) {
  if (!confirm('Cancel this token?')) return;
  const res = await apiFetch(`/admin/tokens/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ cancel_reason: 'Cancelled by admin' }) });
  if (res.success) { loadTokens(); showAlert('global-alert', 'Token cancelled.', 'success'); }
  else showAlert('global-alert', res.message);
}

async function openStatDrawer(status, label) {
  const date = todayIST();
  openHistoryDrawer(`${label} — Today`);
  const res = await apiFetch(`/admin/tokens?status=${status}&date=${date}`);
  renderDrawerTokens(res, status);
}

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

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

function renderDrawerTokens(res, statusFilter) {
  const body = document.getElementById('drawer-body');
  if (!res.success) {
    body.innerHTML = `<div class="alert alert-error">${res.message}</div>`;
    return;
  }
  const items = res.data.items || res.data;
  if (!items.length) {
    body.innerHTML = '<div class="py-12 text-center text-slate-400 italic">No records found</div>';
    return;
  }

  body.innerHTML = '';
  items.forEach(t => {
    const timeMap = {
      completed:   { label: 'Completed at',  val: t.completed_at },
      cancelled:   { label: 'Cancelled at',  val: t.cancelled_at },
      skipped:     { label: 'Skipped at',    val: t.skipped_at },
      called:      { label: 'Called at',     val: t.called_at },
      in_progress: { label: 'Started at',   val: t.called_at },
    };
    const tm = timeMap[t.status];
    const timeStr = tm?.val ? new Date(tm.val).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : null;

    const card = document.createElement('div');
    card.className = "bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3";
    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <span class="text-xl font-black text-primary token-num"></span>
          <span class="ml-2 text-xs text-slate-400 font-bold date-text"></span>
        </div>
        <span class="badge-wrap"></span>
      </div>
      <div class="space-y-1.5">
        <div class="flex items-center gap-2 text-sm font-bold text-slate-800">
          <span class="material-symbols-outlined text-base text-primary">person</span>
          <span class="name-text"></span>
        </div>
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <span class="material-symbols-outlined text-base">call</span>
          <span class="phone-text"></span>
        </div>
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <span class="material-symbols-outlined text-base text-primary">medical_services</span>
          <span class="doc-text"></span>
        </div>
        ${timeStr ? `<div class="flex items-center gap-2 text-sm text-slate-500">
          <span class="material-symbols-outlined text-base">schedule</span>
          ${tm.label}: <span class="font-bold text-slate-700">${timeStr}</span>
        </div>` : ''}
        <div class="reason-wrap hidden">
          <div class="flex items-center gap-2 text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-xl">
            <span class="material-symbols-outlined text-sm">info</span>
            <span class="reason-text"></span>
          </div>
        </div>
        <div class="notes-wrap hidden">
          <div class="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl italic notes-text"></div>
        </div>
      </div>
    `;

    card.querySelector('.token-num').textContent = `#${t.token_number}`;
    card.querySelector('.date-text').textContent = t.booking_date;
    card.querySelector('.badge-wrap').innerHTML = badge(t.status);
    card.querySelector('.name-text').textContent = t.patient?.full_name || '—';
    card.querySelector('.phone-text').textContent = t.patient?.phone || '—';
    card.querySelector('.doc-text').textContent = t.doctor?.display_name || '—';
    
    if (t.cancel_reason) {
      card.querySelector('.reason-wrap').classList.remove('hidden');
      card.querySelector('.reason-text').textContent = t.cancel_reason;
    }
    if (t.notes) {
      card.querySelector('.notes-wrap').classList.remove('hidden');
      card.querySelector('.notes-text').textContent = `"${t.notes}"`;
    }

    body.appendChild(card);
  });
}


// ── Recalls ───────────────────────────────────────────────
async function loadRecalls() {
  const status = document.getElementById('recall-status-filter')?.value || '';
  const res = await apiFetch(`/admin/recalls${status ? `?status=${status}` : ''}`);
  if (!res.success) return;

  const items = res.data || [];

  // Stats
  const counts = { pending: 0, sent: 0, booked: 0, expired: 0 };
  items.forEach(r => counts[r.status] = (counts[r.status] || 0) + 1);
  const statsEl = document.getElementById('recall-stats');
  statsEl.innerHTML = [
    { l: 'Pending',  n: counts.pending,  c: '#003f87', i: 'schedule' },
    { l: 'Sent',     n: counts.sent,     c: '#6d28d9', i: 'mark_email_read' },
    { l: 'Booked',   n: counts.booked,   c: '#059669', i: 'event_available' },
    { l: 'Expired',  n: counts.expired,  c: '#94a3b8', i: 'event_busy' },
  ].map(s => `
    <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <span class="material-symbols-outlined" style="color:${s.c};font-size:1.4rem">${s.i}</span>
      <div style="font-size:1.75rem;font-weight:900;color:${s.c};line-height:1;margin:4px 0">${s.n}</div>
      <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">${s.l}</div>
    </div>`).join('');

  // Table
  const tbody = document.getElementById('recalls-tbody');
  tbody.innerHTML = '';
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-12 text-center text-slate-400">No recalls found</td></tr>';
    return;
  }

  const recallBadge = s => {
    const cfg = { pending: 'bg-blue-100 text-blue-700', sent: 'bg-purple-100 text-purple-700', booked: 'bg-emerald-100 text-emerald-700', expired: 'bg-slate-100 text-slate-500' };
    return `<span class="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-tight ${cfg[s] || 'bg-slate-100 text-slate-600'}">${s}</span>`;
  };

  items.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/50 transition-colors text-sm';
    tr.innerHTML = `
      <td class="px-4 md:px-6 py-4 font-bold text-slate-900 name-cell"></td>
      <td class="px-4 md:px-6 py-4 text-slate-600 doc-cell hidden md:table-cell"></td>
      <td class="px-4 md:px-6 py-4 font-medium text-slate-700 date-cell"></td>
      <td class="px-4 md:px-6 py-4 status-cell"></td>
      <td class="px-4 md:px-6 py-4 text-slate-400 text-xs sent-cell hidden sm:table-cell"></td>
    `;
    tr.querySelector('.name-cell').textContent = r.patient?.full_name || '—';
    tr.querySelector('.doc-cell').textContent = r.doctor?.display_name ? `Dr. ${r.doctor.display_name}` : '—';
    tr.querySelector('.date-cell').textContent = r.recall_date;
    tr.querySelector('.status-cell').innerHTML = recallBadge(r.status);
    tr.querySelector('.sent-cell').textContent = r.email_sent_at ? new Date(r.email_sent_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—';
    tbody.appendChild(tr);
  });
}

async function triggerRecallJob() {
  const btn = event.target.closest('button');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Sending...';
  const res = await apiFetch('/admin/recalls/trigger', { method: 'POST' });
  btn.disabled = false;
  btn.innerHTML = '<span class="material-symbols-outlined">send</span> Send Due Emails';
  if (res.success) { showAlert('global-alert', res.data?.message || 'Recall job completed.', 'success'); loadRecalls(); }
  else showAlert('global-alert', res.message);
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

function formatToken(t) {
  if (!t) return '';
  const slot = t.slot_time || '';
  const prefix = slot.startsWith('Afternoon') ? 'A-' : 'M-';
  return `${prefix}${t.token_number}`;
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
