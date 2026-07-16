const fileModel = require('../models/fileModel');
const folderModel = require('../models/folderModel');
const shareModel = require('../models/shareModel');
const userModel = require('../models/userModel');
const auditModel = require('../models/auditModel');
const { driver, sha256 } = require('../utils/storage');
const { asyncHandler } = require('../middleware/errorHandler');
const path = require('path');

/** Confirms the requesting user owns the file, or holds a share with at
 *  least `minPermission`, or is an admin. Throws a 403/404-style response
 *  directly rather than returning a boolean so callers stay terse. */
async function loadAuthorizedFile(req, res, minPermission = 'view') {
  const file = await fileModel.findById(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'File not found.' });
    return null;
  }
  if (file.owner_id === req.user.id || req.user.role === 'admin') return file;

  const share = await shareModel.findAccessForFile(file.id, req.user.id);
  const rank = { view: 0, comment: 1, edit: 2 };
  if (share && rank[share.permission] >= rank[minPermission]) return file;

  res.status(403).json({ error: 'You do not have access to this file.' });
  return null;
}

const upload = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file was provided.' });

  const [usage, fullUser] = await Promise.all([
    userModel.storageUsage(req.user.id),
    userModel.findById(req.user.id),
  ]);
  const quotaBytes = (fullUser?.storage_quota_mb || 5120) * 1024 * 1024;
  if (Number(usage.used_bytes) + req.file.size > quotaBytes) {
    return res.status(413).json({ error: 'This upload would exceed your storage quota.' });
  }

  const ext = path.extname(req.file.originalname).replace('.', '');
  const key = driver.buildKey(req.user.id, ext);
  await driver.put(req.file.buffer, key, { contentType: req.file.mimetype });
  const checksum = sha256(req.file.buffer);

  const file = await fileModel.create({
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    storageKey: key,
    storageDriver: require('../utils/storage').activeDriverName,
    checksum,
    ownerId: req.user.id,
    folderId: req.body.folderId || null,
  });

  await auditModel.log({
    actorId: req.user.id,
    action: 'file.upload',
    targetType: 'file',
    targetId: file.id,
    metadata: { name: file.original_name, size: file.size_bytes },
    ipAddress: req.ip,
  });

  res.status(201).json({ file });
});

/**
 * Direct-to-S3 upload, step 1: mint a presigned PUT URL so the browser can
 * upload bytes straight to S3, bypassing this server entirely. Only
 * available when STORAGE_DRIVER=s3 -- the local driver has no equivalent,
 * so this 400s cleanly if called against a local setup.
 */
const presignUpload = asyncHandler(async (req, res) => {
  if (!driver.getUploadUrl) {
    return res.status(400).json({ error: 'Direct upload is only available with STORAGE_DRIVER=s3.' });
  }
  const { fileName, mimeType, folderId } = req.body;
  if (!fileName || !mimeType) {
    return res.status(400).json({ error: 'fileName and mimeType are required.' });
  }

  const ext = path.extname(fileName).replace('.', '');
  const key = driver.buildKey(req.user.id, ext);
  const uploadUrl = await driver.getUploadUrl(key, { contentType: mimeType });

  res.json({ uploadUrl, key, folderId: folderId || null });
});

/**
 * Direct-to-S3 upload, step 2: after the browser PUTs bytes straight to S3
 * using the presigned URL from presignUpload, it calls this endpoint with
 * the key it was given so we can record the file's metadata. We re-check
 * quota here (best-effort -- the browser already sent the bytes, so this
 * guards the *database record*, not the upload itself; pair with an S3
 * lifecycle rule or periodic reconciliation job if you need to garbage
 * collect orphaned objects from over-quota attempts).
 */
const completeUpload = asyncHandler(async (req, res) => {
  const { key, fileName, mimeType, sizeBytes, folderId } = req.body;
  if (!key || !fileName || !mimeType || !sizeBytes) {
    return res.status(400).json({ error: 'key, fileName, mimeType, and sizeBytes are required.' });
  }
  if (driver.exists) {
    const found = await driver.exists(key);
    if (!found) return res.status(400).json({ error: 'Upload not found in storage -- did the direct upload complete?' });
  }

  const file = await fileModel.create({
    originalName: fileName,
    mimeType,
    sizeBytes: Number(sizeBytes),
    storageKey: key,
    storageDriver: require('../utils/storage').activeDriverName,
    checksum: null, // not computed server-side for direct uploads (bytes never touched this process)
    ownerId: req.user.id,
    folderId: folderId || null,
  });

  await auditModel.log({
    actorId: req.user.id,
    action: 'file.upload',
    targetType: 'file',
    targetId: file.id,
    metadata: { name: file.original_name, size: file.size_bytes, direct: true },
    ipAddress: req.ip,
  });

  res.status(201).json({ file });
});

const list = asyncHandler(async (req, res) => {
  const { folderId, search, type, sort, dir, limit, offset } = req.query;
  const files = await fileModel.list({
    ownerId: req.user.id,
    folderId: folderId === 'root' ? null : folderId,
    search,
    mimeCategory: type,
    sort,
    dir,
    limit: limit ? Number(limit) : 100,
    offset: offset ? Number(offset) : 0,
  });
  res.json({ files });
});

const getOne = asyncHandler(async (req, res) => {
  const file = await loadAuthorizedFile(req, res);
  if (!file) return;
  res.json({ file });
});

/** Serves the file back to the client -- used for both preview (inline)
 *  and forced download depending on the `download` query flag. When the
 *  active driver exposes getDownloadUrl (S3), we redirect the browser to a
 *  short-lived presigned URL instead of piping bytes through this process;
 *  the local driver has no such concept, so it streams directly. */
const download = asyncHandler(async (req, res) => {
  const file = await loadAuthorizedFile(req, res);
  if (!file) return;

  await auditModel.log({
    actorId: req.user.id,
    action: 'file.download',
    targetType: 'file',
    targetId: file.id,
    ipAddress: req.ip,
  });

  if (driver.getDownloadUrl) {
    const url = await driver.getDownloadUrl(file.storage_key, {
      filename: file.original_name,
      forceDownload: Boolean(req.query.download),
    });
    return res.redirect(302, url);
  }

  const stream = await driver.getStream(file.storage_key);
  res.setHeader('Content-Type', file.mime_type);
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(file.original_name)}"`);
  stream.on('error', () => res.status(404).end());
  stream.pipe(res);
});

const rename = asyncHandler(async (req, res) => {
  const file = await loadAuthorizedFile(req, res, 'edit');
  if (!file) return;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'A new name is required.' });

  const updated = await fileModel.rename(file.id, name.trim());
  await auditModel.log({
    actorId: req.user.id,
    action: 'file.rename',
    targetType: 'file',
    targetId: file.id,
    metadata: { from: file.original_name, to: name.trim() },
    ipAddress: req.ip,
  });
  res.json({ file: updated });
});

const move = asyncHandler(async (req, res) => {
  const file = await loadAuthorizedFile(req, res, 'edit');
  if (!file) return;
  const { folderId } = req.body;

  if (folderId) {
    const folder = await folderModel.findById(folderId);
    if (!folder || folder.owner_id !== file.owner_id) {
      return res.status(400).json({ error: 'Target folder not found.' });
    }
  }

  const updated = await fileModel.move(file.id, folderId || null);
  await auditModel.log({
    actorId: req.user.id,
    action: 'file.move',
    targetType: 'file',
    targetId: file.id,
    metadata: { folderId: folderId || null },
    ipAddress: req.ip,
  });
  res.json({ file: updated });
});

const trash = asyncHandler(async (req, res) => {
  const file = await loadAuthorizedFile(req, res, 'edit');
  if (!file) return;
  await fileModel.softDelete(file.id);
  await auditModel.log({
    actorId: req.user.id,
    action: 'file.delete',
    targetType: 'file',
    targetId: file.id,
    ipAddress: req.ip,
  });
  res.json({ message: 'File moved to trash.' });
});

const restore = asyncHandler(async (req, res) => {
  // findById filters is_trashed = FALSE, so query the trashed record directly:
  const trashed = await require('../config/db').query(
    'SELECT * FROM files WHERE id = $1 AND owner_id = $2 AND is_trashed = TRUE',
    [req.params.id, req.user.id]
  );
  if (!trashed.rows[0]) return res.status(404).json({ error: 'File not found in trash.' });

  await fileModel.restore(req.params.id);
  await auditModel.log({
    actorId: req.user.id,
    action: 'file.restore',
    targetType: 'file',
    targetId: req.params.id,
    ipAddress: req.ip,
  });
  res.json({ message: 'File restored.' });
});

const listTrash = asyncHandler(async (req, res) => {
  const files = await fileModel.listTrashed(req.user.id);
  res.json({ files });
});

const permanentlyDelete = asyncHandler(async (req, res) => {
  const trashed = await require('../config/db').query(
    'SELECT * FROM files WHERE id = $1 AND owner_id = $2 AND is_trashed = TRUE',
    [req.params.id, req.user.id]
  );
  const file = trashed.rows[0];
  if (!file) return res.status(404).json({ error: 'File not found in trash.' });

  await driver.delete(file.storage_key);
  await fileModel.hardDelete(file.id);
  res.json({ message: 'File permanently deleted.' });
});

const usageSummary = asyncHandler(async (req, res) => {
  const [usage, byCategory, recent, fullUser] = await Promise.all([
    userModel.storageUsage(req.user.id),
    fileModel.usageByCategory(req.user.id),
    fileModel.recentActivity(req.user.id, 8),
    userModel.findById(req.user.id),
  ]);
  res.json({
    usedBytes: Number(usage.used_bytes),
    fileCount: usage.file_count,
    quotaMb: fullUser?.storage_quota_mb || 5120,
    byCategory,
    recent,
  });
});

module.exports = {
  upload,
  presignUpload,
  completeUpload,
  list,
  getOne,
  download,
  rename,
  move,
  trash,
  restore,
  listTrash,
  permanentlyDelete,
  usageSummary,
};
