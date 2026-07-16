const bcrypt = require('bcrypt');
const pool = require('../config/db');
const userModel = require('../models/userModel');
const auditModel = require('../models/auditModel');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../utils/tokens');
const { asyncHandler } = require('../middleware/errorHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ fullName, email, password }) {
  const errors = [];
  if (!fullName || fullName.trim().length < 2) errors.push('Full name is required.');
  if (!email || !EMAIL_RE.test(email)) errors.push('A valid email address is required.');
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
  return errors;
}

async function issueSession(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
    [user.id, hashToken(refreshToken), expiresAt]
  );

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  return accessToken;
}

const register = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;
  const errors = validateRegistration({ fullName, email, password });
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const existing = await userModel.findByEmail(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await userModel.create({
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
  });

  const accessToken = await issueSession(res, user);
  await auditModel.log({
    actorId: user.id,
    action: 'user.register',
    targetType: 'user',
    targetId: user.id,
    ipAddress: req.ip,
  });

  res.status(201).json({ user, accessToken });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const record = await userModel.findByEmail(email.toLowerCase().trim());
  if (!record || !record.is_active) {
    await auditModel.log({ action: 'user.login_failed', metadata: { email }, ipAddress: req.ip });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const passwordOk = await bcrypt.compare(password, record.password_hash);
  if (!passwordOk) {
    await auditModel.log({
      actorId: record.id,
      action: 'user.login_failed',
      ipAddress: req.ip,
    });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const { password_hash, ...user } = record;
  await userModel.updateLastLogin(user.id);
  const accessToken = await issueSession(res, user);

  await auditModel.log({ actorId: user.id, action: 'user.login', ipAddress: req.ip });
  res.json({ user, accessToken });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token provided.' });

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return res.status(401).json({ error: 'Refresh token invalid or expired.' });
  }

  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    `SELECT * FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND revoked = FALSE AND expires_at > now()`,
    [payload.sub, tokenHash]
  );
  if (!rows[0]) return res.status(401).json({ error: 'Refresh token has been revoked.' });

  const user = await userModel.findById(payload.sub);
  if (!user || !user.is_active) return res.status(401).json({ error: 'Account is not active.' });

  const accessToken = signAccessToken(user);
  res.json({ accessToken, user });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [hashToken(token)]);
  }
  res.clearCookie('refreshToken', { path: '/api/auth' });
  if (req.user) {
    await auditModel.log({ actorId: req.user.id, action: 'user.logout', ipAddress: req.ip });
  }
  res.json({ message: 'Logged out.' });
});

const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

module.exports = { register, login, refresh, logout, me };
