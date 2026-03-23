// Doctor portal logic — queue management

if (!requireAuth('doctor')) { /* redirected */ }

async function loadQueue() {
  const profile = getProfile();
  if (document.getElementById('doctor-name-text')) {
    document.getElementById('doctor-name-text').textContent = profile.full_name || 'Specialist';
  }

  const res = await apiFetch(`/doctor/queue`);
  if (!res.success) return showAlert('alert-box', res.message);

  const tokens = res.data || [];
  const current = tokens.find(t => t.status === 'in_progress') || tokens.find(t => t.status === 'called') || null;
  const queue = tokens.filter(t => t.status === 'waiting' || t.status === 'skipped');

  // 1. Render Current Patient
  const currentWrap = document.getElementById('current-token-display');
  if (current) {
    currentWrap.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div class="space-y-4">
          <div class="flex items-center gap-4">
            <span class="text-6xl font-black text-primary tracking-tighter">#${formatToken(current)}</span>
            <span class="px-4 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest">In Progress</span>
          </div>
          <div>
            <h3 class="text-3xl font-headline font-extrabold text-slate-900">${current.patient?.full_name}</h3>
            <p class="text-slate-500 font-medium flex items-center gap-2 mt-1">
              <span class="material-symbols-outlined text-sm">call</span>
              ${current.patient?.phone}
            </p>
          </div>
          ${current.notes ? `
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-w-md">
              <p class="text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">Patient Notes</p>
              <p class="text-sm text-slate-600 font-medium italic">"${current.notes}"</p>
            </div>` : ''}
        </div>
        <div class="flex flex-col gap-3">
          <button onclick="completeToken('${current.id}')" class="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">check_circle</span>
            Mark Completed
          </button>
          <button onclick="skipToken('${current.id}')" class="bg-white text-amber-600 border border-amber-200 px-8 py-4 rounded-2xl font-bold hover:bg-amber-50 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">redo</span>
            Skip Patient
          </button>
        </div>
      </div>
    `;
  } else {
    currentWrap.innerHTML = `
      <div class="text-center py-12 space-y-4">
        <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
          <span class="material-symbols-outlined text-4xl">person_off</span>
        </div>
        <div>
          <p class="text-xl font-headline font-bold text-slate-400">No Active Session</p>
          <p class="text-sm text-slate-400">Call the next patient from the queue to begin.</p>
        </div>
      </div>
    `;
  }

  // 2. Render Queue List
  const queueWrap = document.getElementById('queue-list');
  const countEl = document.getElementById('queue-count');
  
  if (countEl) countEl.textContent = `${queue.length} Patient${queue.length === 1 ? '' : 's'}`;

  if (!queue.length) {
    queueWrap.innerHTML = `
      <div class="col-span-full py-16 text-center space-y-3 bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
        <span class="material-symbols-outlined text-4xl text-slate-200">group_off</span>
        <p class="text-slate-400 font-medium">The waiting queue is currently empty.</p>
      </div>
    `;
    return;
  }

  queueWrap.innerHTML = queue.map((t, idx) => `
    <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
      <div class="flex items-center gap-5">
        <div class="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xl group-hover:bg-primary/5 group-hover:text-primary transition-colors">
          ${formatToken(t)}
        </div>
        <div>
          <p class="font-bold text-slate-900">${t.patient?.full_name}</p>
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${idx === 0 ? 'Next in line' : `Waiting (${idx} ahead)`}</p>
        </div>
      </div>
      <div class="opacity-0 group-hover:opacity-100 transition-opacity">
        <span class="material-symbols-outlined text-slate-300">more_vert</span>
      </div>
    </div>
  `).join('');
}

async function callNext() {
  const res = await apiFetch('/doctor/tokens/_/next', { method: 'POST' });
  if (!res.success) return showAlert('alert-box', res.message);
  loadQueue();
}

function completeToken(id) {
  document.getElementById('recall-token-id').value = id;
  document.getElementById('recall-interval').value = '';
  document.getElementById('recall-modal').style.display = '';
}

async function submitComplete() {
  const id = document.getElementById('recall-token-id').value;
  const interval = document.getElementById('recall-interval').value;
  closeRecallModal();
  const res = await apiFetch(`/doctor/tokens/${id}/complete`, {
    method: 'PATCH',
    body: JSON.stringify({ recallInterval: interval || null }),
  });
  if (!res.success) return showAlert('alert-box', res.message);
  loadQueue();
}

function closeRecallModal() {
  document.getElementById('recall-modal').style.display = 'none';
}

async function skipToken(id) {
  const res = await apiFetch(`/doctor/tokens/${id}/skip`, { method: 'PATCH' });
  if (!res.success) return showAlert('alert-box', res.message);
  loadQueue();
}

function formatToken(t) {
  if (!t) return '';
  const slot = t.slot_time || '';
  const prefix = slot.startsWith('Evening') ? 'E-' : 'M-';
  return `${prefix}${t.token_number}`;
}

// Init
loadQueue();
// Auto-refresh every 30s
setInterval(loadQueue, 30000);
