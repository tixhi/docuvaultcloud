const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const auditModel = require('../models/auditModel');
const { asyncHandler } = require('../middleware/errorHandler');

const updateMyProfile = asyncHandler(async (req, res) => {
  const { fullName, avatarUrl } = req.body;
  const user = await userModel.updateProfile(req.user.id, { fullName, avatarUrl });
  await auditModel.log({ actorId: req.user.id, action: 'user.update_profile', ipAddress: req.ip });
  res.json({ user });
});

const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  const record = await userModel.findByIdWithPassword(req.user.id);
  const ok = await bcrypt.compare(currentPassword || '', record.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

  const hash = await bcrypt.hash(newPassword, 12);
  await userModel.updatePassword(req.user.id, hash);
  res.json({ message: 'Password updated.' });
});

const myUsage = asyncHandler(async (req, res) => {
  const usage = await userModel.storageUsage(req.user.id);
  res.json(usage);
});

// ---- Admin-only below --------------------------------------------------

const listUsers = asyncHandler(async (req, res) => {
  const { search, limit, offset } = req.query;
  const users = await userModel.list({
    search,
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0,
  });
  res.json({ users });
});

const changeUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'manager', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  const user = await userModel.setRole(req.params.id, role);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  await auditModel.log({
    actorId: req.user.id,
    action: 'user.role_changed',
    targetType: 'user',
    targetId: user.id,
    metadata: { role },
    ipAddress: req.ip,
  });
  res.json({ user });
});

const setUserActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await userModel.setActive(req.params.id, Boolean(isActive));
  if (!user) return res.status(404).json({ error: 'User not found.' });
  await auditModel.log({
    actorId: req.user.id,
    action: 'user.deactivated',
    targetType: 'user',
    targetId: user.id,
    metadata: { isActive: Boolean(isActive) },
    ipAddress: req.ip,
  });
  res.json({ user });
});

module.exports = {
  updateMyProfile,
  changeMyPassword,
  myUsage,
  listUsers,
  changeUserRole,
  setUserActive,
};
