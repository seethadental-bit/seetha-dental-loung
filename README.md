# Seetha Dental Lounge — Queue Management System

Full-stack clinic queue and token management system with Admin, Doctor, and Patient roles.

---

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JS (no frameworks)
- **Backend**: Node.js + Express.js
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Email**: Brevo (transactional email API)
- **Hosting**: Railway

---

## Setup Instructions

### 1. Supabase Project

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the files in order:
   ```
   sql/schema.sql
   sql/policies.sql
   sql/seed.sql                          ← edit UUIDs first
   sql/migrations/002_atomic_booking.sql
   sql/migrations/003_slot_booking.sql
   sql/migrations/004_slot_limit.sql
   sql/migrations/002_recalls.sql
   ```
3. Copy your project URL, anon key, and service role key from **Project Settings → API**

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BREVO_API_KEY=your-brevo-api-key
SMTP_FROM=your-verified-sender@gmail.com
APP_URL=https://your-domain.up.railway.app
PORT=3000
```

> ⚠️ Never commit `.env` or expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

### 3. Install & Run

```bash
npm install
npm run dev      # development (nodemon)
npm start        # production
```

Open `http://localhost:3000`

---

## Creating the First Admin

1. Register a user via `/login.html?mode=register`
2. In Supabase SQL Editor, manually update their role:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = '<user-uuid>';
   ```

## Creating a Doctor

1. Log in as admin → Doctors → Add Doctor (creates auth + profile + doctor record in one step)

---

## Folder Structure

```
dental/
├── server.js               # Express entry point + cron job
├── config/supabaseClient.js
├── middleware/             # auth, role, error handlers
├── controllers/            # authController, adminController, doctorController, tokenController
├── routes/                 # REST routes per role
├── services/               # tokenService, recallService, emailService, auditService
├── utils/                  # validators, dateUtils, responseHelpers
├── public/                 # Static frontend (HTML, CSS, JS)
└── sql/                    # schema.sql, policies.sql, seed.sql, migrations/
```

---

## API Reference

| Method | Path | Role |
|--------|------|------|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| GET  | /api/auth/me | Any |
| GET  | /api/admin/dashboard | Admin |
| GET  | /api/admin/users | Admin |
| PATCH | /api/admin/users/:id/status | Admin |
| GET  | /api/admin/doctors | Admin |
| POST | /api/admin/doctors | Admin |
| PUT  | /api/admin/doctors/:id | Admin |
| PATCH | /api/admin/doctors/:id/availability | Admin |
| GET  | /api/admin/tokens | Admin |
| PATCH | /api/admin/tokens/:id/cancel | Admin |
| GET  | /api/admin/recalls | Admin |
| POST | /api/admin/recalls/trigger | Admin |
| GET  | /api/doctor/queue | Doctor |
| GET  | /api/doctor/current | Doctor |
| POST | /api/doctor/tokens/:id/next | Doctor |
| PATCH | /api/doctor/tokens/:id/skip | Doctor |
| PATCH | /api/doctor/tokens/:id/cancel | Doctor |
| PATCH | /api/doctor/tokens/:id/complete | Doctor |
| GET  | /api/patient/doctors | Patient |
| POST | /api/patient/book-token | Patient |
| GET  | /api/patient/my-tokens | Patient |
| GET  | /api/patient/my-token-status/:id | Patient |
| PATCH | /api/patient/tokens/:id/cancel | Patient |
| GET  | /api/patient/recall-info/:id | Patient |

---

## Token Status Lifecycle

```
waiting → called → in_progress → completed
       ↘ skipped
       ↘ cancelled (any stage)
```

---

## Recall System

Doctors can schedule follow-up reminders when completing a token:

1. **Doctor** marks token complete → selects recall interval (1 Week / 1 Month / 3 Months / 6 Months)
2. **Cron job** runs daily at 8:00 AM IST — sends branded email to patients whose recall is 7 days away
3. **Patient** clicks "Book Your Token" in the email → booking form opens with doctor pre-filled
4. On booking → recall status updates to `booked`
5. **Admin** monitors all recalls via Admin Panel → Recalls tab

Recall statuses: `pending` → `sent` → `booked` / `expired`

---

## Security Notes

- Service role key is **server-side only** — never sent to browser
- All role checks enforced in backend middleware, not just frontend
- Doctors can only access their own tokens (enforced in `transitionToken`)
- Patients can only cancel their own tokens
- Rate limiting: 200 requests per 15 minutes per IP (30 on auth endpoints)
- Helmet.js headers enabled

---

## Clinic Info

**Seetha Dental Lounge**  
Junction, Paravur, Kerala 691301  
📞 080753 33723 | Opens 9:30 AM  
*Clinic hours may vary on holidays.*
