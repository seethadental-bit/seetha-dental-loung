const isProd = process.env.NODE_ENV === 'production';

// Centralized error handler — must be registered last in Express
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  // Always log full error server-side
  console.error(`[ERROR] ${req.method} ${req.path} →`, err);
  res.status(status).json({
    success: false,
    // In production, hide internal 500 details from clients
    message: isProd && status === 500 ? 'Internal server error' : (err.message || 'Internal server error')
  });
}

module.exports = { errorHandler };
