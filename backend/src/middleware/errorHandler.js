/**
 * Centralized error handler -- keeps controllers free of repetitive
 * try/catch boilerplate (they call next(err) on failure) and ensures we
 * never leak stack traces to clients in production.
 */
const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  }

  const isProd = process.env.NODE_ENV === 'production';
  res.status(status).json({
    error: status >= 500 && isProd ? 'Internal server error.' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
}

/** Wraps an async route handler so rejected promises reach errorHandler. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { notFoundHandler, errorHandler, asyncHandler };
