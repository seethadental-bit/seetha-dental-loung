const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  requireTLS: true,
  connectionTimeout: 10000,
  greetingTimeout:   10000,
  socketTimeout:     15000,
  tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Seetha Dental Lounge" <${process.env.SMTP_FROM}>`;
const BRAND = '#003f87';
const APP_URL = process.env.APP_URL || 'https://seethadental.up.railway.app';

// ── Shared layout ────────────────────────────────────────────
function layout(preheader, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>Seetha Dental Lounge</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Preheader (hidden preview text) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;">
<tr><td align="center" style="padding:40px 16px;">

  <!-- Outer card -->
  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

    <!-- Top accent bar -->
    <tr>
      <td style="background:linear-gradient(90deg,#003f87 0%,#0066cc 50%,#0099ff 100%);height:5px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- Header -->
    <tr>
      <td style="background:#003f87;padding:36px 48px 32px;text-align:center;">
        <!-- Logo circle -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
          <tr>
            <td style="background:rgba(255,255,255,0.12);border-radius:50%;width:64px;height:64px;text-align:center;vertical-align:middle;">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:15px auto 0;">
                <path d="M12 2C9.5 2 7.5 3.5 6 3.5C4.5 3.5 3 2.5 3 2.5C3 2.5 2 4 2 7C2 10.5 3.5 12 4 14C4.5 16 4.5 22 6.5 22C8 22 8.5 18 10 17C10.6 16.6 11.3 16.5 12 16.5C12.7 16.5 13.4 16.6 14 17C15.5 18 16 22 17.5 22C19.5 22 19.5 16 20 14C20.5 12 22 10.5 22 7C22 4 21 2.5 21 2.5C21 2.5 19.5 3.5 18 3.5C16.5 3.5 14.5 2 12 2Z" fill="white" stroke="white" stroke-width="0.3"/>
              </svg>
            </td>
          </tr>
        </table>
        <h1 style="margin:0 0 6px;color:#ffffff;font-family:Georgia,serif;font-size:24px;font-weight:700;letter-spacing:0.5px;">Seetha Dental Lounge</h1>
        <p style="margin:0;color:rgba(255,255,255,0.6);font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Junction · Paravur · Kerala</p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:40px 48px 36px;font-family:Arial,sans-serif;">
        ${bodyHtml}
      </td>
    </tr>

    <!-- Divider -->
    <tr>
      <td style="padding:0 48px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-top:1px solid #e8ecf0;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:24px 48px 32px;text-align:center;font-family:Arial,sans-serif;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;">
          <tr>
            <td style="padding:0 16px;border-right:1px solid #dee2e6;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding-right:5px;vertical-align:middle;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.314-2.686-6-6-6z" stroke="#6c757d" stroke-width="2"/><circle cx="12" cy="8" r="2" stroke="#6c757d" stroke-width="2"/></svg>
                </td>
                <td style="color:#6c757d;font-size:11px;">Junction, Paravur, Kerala 691301</td>
              </tr></table>
            </td>
            <td style="padding:0 16px;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding-right:5px;vertical-align:middle;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </td>
                <td style="color:#6c757d;font-size:11px;">080753 33723</td>
              </tr></table>
            </td>
          </tr>
        </table>
        <p style="margin:0;color:#adb5bd;font-size:10px;line-height:1.6;">
          © ${new Date().getFullYear()} Seetha Dental Lounge. All rights reserved.<br/>
          <span style="color:#ced4da;">This email was sent because you have an account with us.</span>
        </p>
      </td>
    </tr>

    <!-- Bottom accent bar -->
    <tr>
      <td style="background:linear-gradient(90deg,#003f87 0%,#0066cc 50%,#0099ff 100%);height:4px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

// ── Welcome email ────────────────────────────────────────────
function welcomeHtml(name) {
  const body = `
    <!-- Hero -->
    <div style="text-align:center;padding:20px 0 32px;">
      <p style="margin:0 0 6px;color:#6c757d;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif;">Welcome to</p>
      <h1 style="margin:0 0 4px;color:#003f87;font-family:Georgia,serif;font-size:36px;font-weight:800;letter-spacing:-0.5px;line-height:1.15;">Clinical Serenity.</h1>
      <p style="margin:16px auto 0;color:#555;font-size:15px;line-height:1.8;max-width:420px;font-family:Arial,sans-serif;">Hi <strong>${name}</strong>, your account is ready. At Seetha Dental Lounge, we believe your journey to a healthier smile should be as relaxing as a visit to a luxury lounge.</p>
    </div>

    <!-- CTA button -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 36px;">
      <tr><td align="center">
        <a href="${APP_URL}/patient.html"
           style="display:inline-block;background:linear-gradient(135deg,#003f87 0%,#0056b3 100%);color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.3px;font-family:Arial,sans-serif;box-shadow:0 4px 16px rgba(0,63,135,0.25);">
          Login to your Dashboard &rarr;
        </a>
      </td></tr>
    </table>

    <!-- Bento 3-card grid -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 36px;">
      <tr>
        <!-- Card 1 -->
        <td width="33%" style="padding:0 8px 0 0;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:#f3f4f5;border-radius:12px;padding:24px 20px;">
              <div style="width:44px;height:44px;background:#c8dffd;border-radius:50%;text-align:center;margin-bottom:16px;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-top:11px;"><circle cx="12" cy="8" r="4" stroke="#4a6079" stroke-width="1.8"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="#4a6079" stroke-width="1.8" stroke-linecap="round"/><path d="M16 5l1.5 1.5L21 3" stroke="#4a6079" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <p style="margin:0 0 8px;color:#003f87;font-size:15px;font-weight:700;font-family:Arial,sans-serif;">Complete Profile</p>
              <p style="margin:0 0 20px;color:#6c757d;font-size:12px;line-height:1.6;font-family:Arial,sans-serif;">Keep your medical history up-to-date for a personalized care plan.</p>
              <p style="margin:0;color:#0056b3;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Step 01</p>
            </td></tr>
          </table>
        </td>
        <!-- Card 2 -->
        <td width="33%" style="padding:0 4px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:#f3f4f5;border-radius:12px;padding:24px 20px;">
              <div style="width:44px;height:44px;background:#00636c;border-radius:50%;text-align:center;margin-bottom:16px;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-top:11px;"><circle cx="12" cy="12" r="9" stroke="#7fdfec" stroke-width="1.8"/><path d="M12 7V12L15 15" stroke="#7fdfec" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <p style="margin:0 0 8px;color:#003f87;font-size:15px;font-weight:700;font-family:Arial,sans-serif;">Check Queue</p>
              <p style="margin:0 0 20px;color:#6c757d;font-size:12px;line-height:1.6;font-family:Arial,sans-serif;">View real-time waiting room status and know exactly when it's your turn.</p>
              <p style="margin:0;color:#0056b3;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Step 02</p>
            </td></tr>
          </table>
        </td>
        <!-- Card 3 -->
        <td width="33%" style="padding:0 0 0 8px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:#f3f4f5;border-radius:12px;padding:24px 20px;">
              <div style="width:44px;height:44px;background:#d7e2ff;border-radius:50%;text-align:center;margin-bottom:16px;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-top:11px;"><rect x="3" y="4" width="18" height="18" rx="3" stroke="#001a40" stroke-width="1.8"/><path d="M3 9H21" stroke="#001a40" stroke-width="1.8"/><path d="M8 2V6M16 2V6" stroke="#001a40" stroke-width="1.8" stroke-linecap="round"/><path d="M9 14l2 2 4-4" stroke="#001a40" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <p style="margin:0 0 8px;color:#003f87;font-size:15px;font-weight:700;font-family:Arial,sans-serif;">Book Visit</p>
              <p style="margin:0 0 20px;color:#6c757d;font-size:12px;line-height:1.6;font-family:Arial,sans-serif;">Schedule your next appointment or treatment session directly through our portal.</p>
              <p style="margin:0;color:#0056b3;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Step 03</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Sanctuary section -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f5;border-radius:12px;">
      <tr>
        <td style="padding:32px;">
          <h2 style="margin:0 0 12px;color:#003f87;font-family:Georgia,serif;font-size:22px;font-weight:700;">Your Sanctuary Awaits</h2>
          <p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.8;font-family:Arial,sans-serif;">We've redesigned the dental experience from the ground up. From the moment you step through our doors in Paravur, every detail is crafted for your peace of mind.</p>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 8px 0 0;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background:#ffffff;border-radius:20px;padding:8px 14px;">
                    <table cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="padding-right:6px;vertical-align:middle;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12l2 2 4-4" stroke="#003f87" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="#003f87" stroke-width="1.8"/></svg>
                      </td>
                      <td style="color:#444;font-size:11px;font-weight:600;font-family:Arial,sans-serif;">Advanced Clinical Technology</td>
                    </tr></table>
                  </td></tr>
                </table>
              </td>
              <td>
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background:#ffffff;border-radius:20px;padding:8px 14px;">
                    <table cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="padding-right:6px;vertical-align:middle;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8 6 4 8 4 13a8 8 0 0016 0c0-5-4-7-8-11z" stroke="#003f87" stroke-width="1.8" stroke-linejoin="round"/></svg>
                      </td>
                      <td style="color:#444;font-size:11px;font-weight:600;font-family:Arial,sans-serif;">Comfort-First Environment</td>
                    </tr></table>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
  return layout(`Welcome to Seetha Dental Lounge, ${name}! Your account is ready.`, body);
}

// ── Token confirmation email ─────────────────────────────────
function tokenBookingHtml({ name, tokenNumber, doctorName, bookingDate, slotTime, specialty }) {
  const slot = (slotTime || '').split('|')[1]?.trim() || slotTime || '—';
  const session = (slotTime || '').toLowerCase().includes('afternoon') ? 'Afternoon' : 'Morning';
  const sessionColor = session === 'Morning' ? '#0056b3' : '#6d28d9';
  const sessionBg    = session === 'Morning' ? '#eff6ff'  : '#f5f3ff';

  const body = `
    <!-- Greeting -->
    <h2 style="margin:0 0 8px;color:#003f87;font-family:Georgia,serif;font-size:28px;font-weight:700;">Appointment Confirmed</h2>
    <p style="margin:0 0 28px;color:#6c757d;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">Booking successful · ${bookingDate}</p>

    <p style="margin:0 0 28px;color:#444;font-size:15px;line-height:1.8;">
      Hi <strong>${name}</strong>, your appointment at <strong style="color:#003f87;">Seetha Dental Lounge</strong> has been confirmed. Please find your booking details below.
    </p>

    <!-- Token number hero -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#003f87;border-radius:12px;padding:28px;text-align:center;">
          <p style="margin:0 0 4px;color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif;">Your Token Number</p>
          <p style="margin:0 0 12px;color:#ffffff;font-size:64px;font-weight:900;font-family:Georgia,serif;letter-spacing:-3px;line-height:1;">${tokenNumber}</p>
          <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr><td style="background:rgba(255,255,255,0.15);border-radius:20px;padding:5px 18px;">
              <p style="margin:0;color:rgba(255,255,255,0.9);font-size:12px;font-weight:600;font-family:Arial,sans-serif;">${session} Session</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Details grid -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <!-- Doctor -->
        <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border:1px solid #e8ecf0;border-radius:10px;padding:16px 18px;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;"><tr>
                <td style="padding-right:8px;vertical-align:middle;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="4" stroke="#003f87" stroke-width="1.8"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="#003f87" stroke-width="1.8" stroke-linecap="round"/></svg>
                </td>
                <td style="color:#adb5bd;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">Specialist</td>
              </tr></table>
              <p style="margin:0;color:#003f87;font-size:14px;font-weight:700;font-family:Arial,sans-serif;">Dr. ${doctorName}</p>
              ${specialty ? `<p style="margin:3px 0 0;color:#6c757d;font-size:12px;font-family:Arial,sans-serif;">${specialty}</p>` : ''}
            </td></tr>
          </table>
        </td>
        <!-- Date -->
        <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border:1px solid #e8ecf0;border-radius:10px;padding:16px 18px;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;"><tr>
                <td style="padding-right:8px;vertical-align:middle;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="3" stroke="#003f87" stroke-width="1.8"/><path d="M3 9H21" stroke="#003f87" stroke-width="1.8"/><path d="M8 2V6M16 2V6" stroke="#003f87" stroke-width="1.8" stroke-linecap="round"/></svg>
                </td>
                <td style="color:#adb5bd;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">Date</td>
              </tr></table>
              <p style="margin:0;color:#003f87;font-size:14px;font-weight:700;font-family:Arial,sans-serif;">${bookingDate}</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Slot time -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr><td style="background:${sessionBg};border:1px solid ${sessionColor}30;border-radius:10px;padding:16px 18px;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;"><tr>
          <td style="padding-right:8px;vertical-align:middle;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="${sessionColor}" stroke-width="1.8"/><path d="M12 7V12L15 15" stroke="${sessionColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </td>
          <td style="color:#adb5bd;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">Slot Time</td>
        </tr></table>
        <p style="margin:0;color:${sessionColor};font-size:18px;font-weight:800;font-family:Arial,sans-serif;">${slot}</p>
      </td></tr>
    </table>

    <!-- Reminder box -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
      <tr><td style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:12px;vertical-align:top;padding-top:2px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 9v4M12 17h.01" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#f59e0b" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </td>
          <td style="color:#92400e;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;">
            <strong>Please arrive 10 minutes before your slot.</strong><br/>
            Bring any previous dental records or X-rays if available. Clinic opens at <strong>9:30 AM</strong>.
          </td>
        </tr></table>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <a href="${APP_URL}/patient.html"
           style="display:inline-block;background:#003f87;color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.3px;font-family:Arial,sans-serif;">
          Track Your Queue Position
        </a>
      </td></tr>
    </table>
  `;
  return layout(`Token #${tokenNumber} confirmed with Dr. ${doctorName} on ${bookingDate}.`, body);
}

// ── Send helpers ─────────────────────────────────────────────
async function sendWelcome({ to, name }) {
  if (!process.env.SMTP_HOST) { console.warn('[email] SMTP_HOST not set, skipping welcome email'); return; }
  if (!process.env.SMTP_FROM) { console.warn('[email] SMTP_FROM not set, skipping welcome email'); return; }
  try {
    const info = await transporter.sendMail({
      from: FROM, to,
      subject: `Welcome to Seetha Dental Lounge, ${name}!`,
      html: welcomeHtml(name),
    });
    console.log('[email] Welcome sent to', to, '| messageId:', info.messageId);
  } catch (err) {
    console.error('[email] Failed to send welcome to', to, '| error:', err.message);
  }
}

async function sendTokenConfirmation({ to, name, tokenNumber, doctorName, bookingDate, slotTime, specialty }) {
  if (!process.env.SMTP_HOST) { console.warn('[email] SMTP_HOST not set, skipping token confirmation'); return; }
  if (!process.env.SMTP_FROM) { console.warn('[email] SMTP_FROM not set, skipping token confirmation'); return; }
  try {
    const info = await transporter.sendMail({
      from: FROM, to,
      subject: `Token #${tokenNumber} Confirmed — Seetha Dental Lounge`,
      html: tokenBookingHtml({ name, tokenNumber, doctorName, bookingDate, slotTime, specialty }),
    });
    console.log('[email] Token confirmation sent to', to, '| messageId:', info.messageId);
  } catch (err) {
    console.error('[email] Failed to send token confirmation to', to, '| error:', err.message);
  }
}

async function sendOtpEmail({ to, name, otp }) {
  if (!process.env.SMTP_HOST) { console.warn('[email] SMTP_HOST not set, skipping OTP email'); return; }
  if (!process.env.SMTP_FROM) { console.warn('[email] SMTP_FROM not set, skipping OTP email'); return; }
  const body = `
    <div style="text-align:center;padding:20px 0 32px;">
      <p style="margin:0 0 6px;color:#6c757d;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Email Verification</p>
      <h1 style="margin:0 0 12px;color:#003f87;font-family:Georgia,serif;font-size:32px;font-weight:800;">Verify Your Email</h1>
      <p style="margin:0 auto 32px;color:#555;font-size:15px;line-height:1.8;max-width:400px;">Hi <strong>${name}</strong>, use the code below to complete your registration. It expires in <strong>10 minutes</strong>.</p>
      <div style="display:inline-block;background:#003f87;border-radius:16px;padding:28px 48px;margin-bottom:28px;">
        <p style="margin:0 0 6px;color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Your OTP Code</p>
        <p style="margin:0;color:#ffffff;font-size:52px;font-weight:900;font-family:Georgia,serif;letter-spacing:12px;line-height:1;">${otp}</p>
      </div>
      <p style="margin:0;color:#adb5bd;font-size:12px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
  try {
    const info = await transporter.sendMail({
      from: FROM, to,
      subject: `${otp} — Your Seetha Dental Lounge verification code`,
      html: layout(`Your verification code is ${otp}. Valid for 10 minutes.`, body),
    });
    console.log('[email] OTP sent to', to, '| messageId:', info.messageId);
  } catch (err) {
    console.error('[email] Failed to send OTP to', to, '| error:', err.message);
  }
}

module.exports = { sendWelcome, sendTokenConfirmation, sendOtpEmail };
