const shareModel = require('../models/shareModel');
const fileModel = require('../models/fileModel');
const userModel = require('../models/userModel');
const auditModel = require('../models/auditModel');
const { asyncHandler } = require('../middleware/errorHandler');

const PERMISSIONS = ['view', 'comment', 'edit'];

const createShare = asyncHandler(async (req, res) => {
  const { fileId, email, permission = 'view', expiresAt, publicLink } = req.body;
  if (!PERMISSIONS.includes(permission)) {
    return res.status(400).json({ error: `Permission must be one of: ${PERMISSIONS.join(', ')}.` });
  }

  const file = await fileModel.findById(fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });
  if (file.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the owner can share this file.' });
  }

  if (publicLink) {
    const share = await shareModel.createPublicLink({
      fileId,
      sharedBy: req.user.id,
      permission,
      expiresAt,
    });
    await auditModel.log({
      actorId: req.user.id,
      action: 'share.create',
      targetType: 'file',
      targetId: fileId,
      metadata: { type: 'public_link', permission },
      ipAddress: req.ip,
    });
    return res.status(201).json({ share });
  }

  if (!email) return res.status(400).json({ error: 'An email address is required to share with a user.' });
  const target = await userModel.findByEmail(email.toLowerCase().trim());
  if (!target) return res.status(404).json({ error: 'No user found with that email.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot share a file with yourself.' });

  const share = await shareModel.createUserShare({
    fileId,
    sharedBy: req.user.id,
    sharedWith: target.id,
    permission,
    expiresAt,
  });

  await auditModel.log({
    actorId: req.user.id,
    action: 'share.create',
    targetType: 'file',
    targetId: fileId,
    metadata: { sharedWith: target.email, permission },
    ipAddress: req.ip,
  });

  res.status(201).json({ share });
});

const sharedWithMe = asyncHandler(async (req, res) => {
  const shares = await shareModel.sharedWithMe(req.user.id);
  res.json({ shares });
});

const sharedByMe = asyncHandler(async (req, res) => {
  const shares = await shareModel.sharedByMe(req.user.id);
  res.json({ shares });
});

const updatePermission = asyncHandler(async (req, res) => {
  const { permission } = req.body;
  if (!PERMISSIONS.includes(permission)) {
    return res.status(400).json({ error: `Permission must be one of: ${PERMISSIONS.join(', ')}.` });
  }
  const share = await shareModel.findById(req.params.id);
  if (!share) return res.status(404).json({ error: 'Share not found.' });
  if (share.shared_by !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the sharer can change permissions.' });
  }
  const updated = await shareModel.updatePermission(share.id, permission);
  await auditModel.log({
    actorId: req.user.id,
    action: 'share.permission_change',
    targetType: 'share',
    targetId: share.id,
    metadata: { permission },
    ipAddress: req.ip,
  });
  res.json({ share: updated });
});

const revoke = asyncHandler(async (req, res) => {
  const share = await shareModel.findById(req.params.id);
  if (!share) return res.status(404).json({ error: 'Share not found.' });
  if (share.shared_by !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the sharer can revoke this share.' });
  }
  await shareModel.revoke(share.id);
  await auditModel.log({
    actorId: req.user.id,
    action: 'share.revoke',
    targetType: 'share',
    targetId: share.id,
    ipAddress: req.ip,
  });
  res.json({ message: 'Share revoked.' });
});

/** Resolves a public share link -- no authentication required, but expired
 *  or missing tokens are rejected. */
const resolvePublicLink = asyncHandler(async (req, res) => {
  const share = await shareModel.findByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'This link is invalid or has expired.' });
  const file = await fileModel.findById(share.file_id);
  if (!file) return res.status(404).json({ error: 'The shared file no longer exists.' });
  res.json({ file, permission: share.permission });
});

module.exports = {
  createShare,
  sharedWithMe,
  sharedByMe,
  updatePermission,
  revoke,
  resolvePublicLink,
};
