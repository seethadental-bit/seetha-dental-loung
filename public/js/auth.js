// Shared auth utilities used across all pages

const API = '/api';

function getProfile() { return JSON.parse(localStorage.getItem('sdl_profile') || 'null'); }

function authHeaders() {
  return { 'Content-Type': 'application/json' }; // Cookies sent automatically
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: authHeaders(),
    ...options
  });
  
  if (res.status === 401 && !path.includes('/auth/login')) {
    logout();
    return { ok: false, success: false, message: 'Session expired' };
  }

  const json = await res.json().catch(() => ({ success: false, message: 'Invalid response' }));
  return { ok: res.ok, status: res.status, ...json };
}

function logout() {
  localStorage.removeItem('sdl_profile');
  // Call server to clear cookie
  fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' }).finally(() => {
    location.href = '/login.html';
  });
}

function showAlert(containerId, message, type = 'error') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const icons = {
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warn:    `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };
  const cls = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warn' ? 'warn' : 'info';
  el.innerHTML = `<div class="alert alert-${cls}" style="display:flex;align-items:center;gap:.5rem">${icons[cls] || icons.info}${message}</div>`;
  setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
}

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
}

// Redirect if not authenticated or wrong role
function requireAuth(expectedRole) {
  const profile = getProfile();
  if (!profile) { 
    // We don't have token in localStorage anymore, so we rely on profile
    // If the server rejects the request later, apiFetch will handle logout
    location.href = '/login.html'; 
    return false; 
  }
  if (expectedRole && profile.role !== expectedRole) {
    location.href = `/${profile.role}.html`;
    return false;
  }
  return true;
}

// ---- LOGIN / REGISTER (login.html only) ----
let _pendingEmail = null;

function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const otpStep = document.getElementById('otp-step');
  if (loginForm) loginForm.style.display = tab === 'login' ? '' : 'none';
  if (regForm) regForm.style.display = tab === 'register' ? '' : 'none';
  if (otpStep) otpStep.style.display = 'none';

  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-register');
  if (tabLogin) tabLogin.classList.toggle('auth-mode-active', tab === 'login');
  if (tabReg) tabReg.classList.toggle('auth-mode-active', tab === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span>';

  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value })
  });

  if (!res.success) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    return showAlert('alert-box', res.message);
  }

  // Profile is now enough; token is secure in httpOnly cookie
  localStorage.setItem('sdl_profile', JSON.stringify(res.data.profile));

  const role = res.data.profile.role;
  location.href = role === 'admin' ? '/admin.html' : role === 'doctor' ? '/doctor.html' : '/patient.html';
}

async function handleRegister(e) {
  e.preventDefault();

  const name     = document.getElementById('reg-name').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm')?.value;

  let valid = true;
  if (typeof fieldErr === 'function') {
    fieldErr('reg-name',     !name);
    fieldErr('reg-phone',    !/^[6-9]\d{9}$/.test(phone));
    fieldErr('reg-email',    !email || !email.includes('@'));
    fieldErr('reg-password', password.length < 6);
    if (confirm !== undefined) fieldErr('reg-confirm', password !== confirm);
    valid = name && /^[6-9]\d{9}$/.test(phone) && email.includes('@') && password.length >= 6 && (confirm === undefined || password === confirm);
  } else {
    if (confirm !== undefined && password !== confirm) {
      return showAlert('alert-box', 'Passwords do not match');
    }
  }
  if (!valid) return;

  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Sending OTP...';

  const res = await apiFetch('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ full_name: name, phone, email, password })
  });

  btn.disabled = false;
  btn.innerHTML = 'Create Account';

  if (!res.success) return showAlert('alert-box', res.message);

  _pendingEmail = email;
  document.getElementById('otp-hint').textContent = `We sent a 6-digit code to ${email}`;
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('otp-step').style.display = '';
  document.getElementById('alert-box').innerHTML = '';
  initOtpInputs();
}

function initOtpInputs() {
  const boxes = document.querySelectorAll('.otp-box');
  boxes.forEach((box, i) => {
    box.value = '';
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '');
      if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
    });
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      boxes.forEach((b, j) => { b.value = digits[j] || ''; });
      boxes[Math.min(digits.length, 5)].focus();
    });
  });
  boxes[0].focus();
}

async function handleOtpVerify() {
  const boxes = document.querySelectorAll('.otp-box');
  const otp = Array.from(boxes).map(b => b.value).join('');
  if (otp.length < 6) return showAlert('alert-box', 'Please enter the complete 6-digit code');

  const btn = document.getElementById('otp-btn');
  btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Verifying...';

  const res = await apiFetch('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: _pendingEmail, otp })
  });

  btn.disabled = false;
  btn.innerHTML = 'Verify & Create Account <span class="material-symbols-outlined text-sm">arrow_forward</span>';

  if (!res.success) {
    boxes.forEach(b => b.classList.add('border-red-400'));
    setTimeout(() => boxes.forEach(b => b.classList.remove('border-red-400')), 1000);
    return showAlert('alert-box', res.message);
  }

  showAlert('alert-box', 'Account created! Please sign in.', 'success');
  _pendingEmail = null;
  document.getElementById('otp-step').style.display = 'none';
  switchTab('login');
}

async function handleResendOtp() {
  if (!_pendingEmail) return;
  const btn = document.getElementById('resend-btn');
  btn.disabled = true; btn.textContent = 'Sending...';

  // Re-use the register form values to resend
  const name     = document.getElementById('reg-name')?.value.trim();
  const phone    = document.getElementById('reg-phone')?.value.trim();
  const password = document.getElementById('reg-password')?.value;

  const res = await apiFetch('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ full_name: name, phone, email: _pendingEmail, password })
  });

  btn.disabled = false; btn.textContent = 'Resend';
  showAlert('alert-box', res.success ? 'OTP resent!' : res.message, res.success ? 'success' : 'error');
  if (res.success) initOtpInputs();
}
