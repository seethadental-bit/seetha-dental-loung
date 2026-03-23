require('dotenv').config();

// Fail fast if required env vars are missing
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) { console.error('Missing env vars:', missing.join(', ')); process.exit(1); }

const path       = require('path');
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const compression = require('compression');
const { errorHandler } = require('./middleware/errorMiddleware');

const isProd = process.env.NODE_ENV === 'production';
const app = express();

// Trust Railway's reverse proxy so req.ip is the real client IP
app.set('trust proxy', 1);

app.use(compression());

// Manual cookie parser middleware
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...value] = cookie.split('=');
      req.cookies[name.trim()] = value.join('=');
    });
  }
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc:     ["'self'", "data:", "blob:", "https://lh3.googleusercontent.com", "https://images.unsplash.com"],
      connectSrc: ["'self'", process.env.SUPABASE_URL, "https://cdnjs.cloudflare.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com", "https://r2cdn.perplexity.ai"],
      objectSrc:  ["'none'"],
      frameAncestors: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',')
  : (isProd ? [] : ['http://localhost:3000']);

app.use(cors({
  origin: isProd ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50kb' })); // prevent large payload attacks
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProd ? '1d' : 0,
  etag: true,
}));

// Stricter rate limit on auth endpoints
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests, please try again later.' } }));

// General API rate limit
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests, please try again later.' } }));

app.use('/api', require('./routes/index'));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[${isProd ? 'production' : 'development'}] Seetha Dental Lounge running on port ${PORT}`);
  console.log('[email] SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
  console.log('[email] SMTP_USER:', process.env.SMTP_USER || 'NOT SET');
  console.log('[email] SMTP_FROM:', process.env.SMTP_FROM || 'NOT SET');
  console.log('[email] APP_URL:', process.env.APP_URL || 'NOT SET');

  // Daily recall cron at 8:00 AM IST (2:30 AM UTC)
  const cron = require('node-cron');
  cron.schedule('30 2 * * *', () => {
    console.log('[recall] Running daily recall job...');
    require('./services/recallService').processDueRecalls();
  }, { timezone: 'UTC' });
});
