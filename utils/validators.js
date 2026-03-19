const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePhone(phone) {
  return PHONE_RE.test((phone || '').replace(/\s+/g, ''));
}

function validateEmail(email) {
  return EMAIL_RE.test((email || '').trim());
}

function validateRequired(obj, fields) {
  return fields.filter(f => !obj[f] || String(obj[f]).trim() === '');
}

module.exports = { validatePhone, validateEmail, validateRequired };
