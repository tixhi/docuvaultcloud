/**
 * Authentication middleware.
 * Expects `Authorization: Bearer <accessToken>`. On success attaches
 * `req.user = { id, role, email }` for downstream handlers / RBAC checks.
 */
const { verifyAccessToken } = require('../utils/tokens');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid access token.' });
  }
}

/** Optional auth -- used for public share links that may still recognize a
 *  logged-in user without requiring one. */
function authenticateOptional(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role, email: payload.email };
    } catch {
      // ignore -- treat as anonymous
    }
  }
  next();
}

module.exports = { authenticate, authenticateOptional };
