const folderModel = require('../models/folderModel');
const fileModel = require('../models/fileModel');
const auditModel = require('../models/auditModel');
const { asyncHandler } = require('../middleware/errorHandler');

const create = asyncHandler(async (req, res) => {
  const { name, parentId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name is required.' });

  if (parentId) {
    const parent = await folderModel.findById(parentId);
    if (!parent || parent.owner_id !== req.user.id) {
      return res.status(400).json({ error: 'Parent folder not found.' });
    }
  }

  const folder = await folderModel.create({ name: name.trim(), ownerId: req.user.id, parentId });
  await auditModel.log({
    actorId: req.user.id,
    action: 'folder.create',
    targetType: 'folder',
    targetId: folder.id,
    metadata: { name: folder.name },
    ipAddress: req.ip,
  });
  res.status(201).json({ folder });
});

/** Returns both subfolders and files for a given folder (or root when
 *  `folderId` is omitted), plus breadcrumbs for the File Explorer UI. */
const contents = asyncHandler(async (req, res) => {
  const folderId = req.query.folderId === 'root' ? null : req.query.folderId;

  if (folderId) {
    const folder = await folderModel.findById(folderId);
    if (!folder || folder.owner_id !== req.user.id) {
      return res.status(404).json({ error: 'Folder not found.' });
    }
  }

  const [folders, files, breadcrumbs] = await Promise.all([
    folderModel.listChildren({ ownerId: req.user.id, parentId: folderId }),
    fileModel.list({ ownerId: req.user.id, folderId }),
    folderId ? folderModel.breadcrumbs(folderId) : Promise.resolve([]),
  ]);

  res.json({ folders, files, breadcrumbs });
});

const rename = asyncHandler(async (req, res) => {
  const folder = await folderModel.findById(req.params.id);
  if (!folder) return res.status(404).json({ error: 'Folder not found.' });
  if (folder.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You do not have permission to rename this folder.' });
  }
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'A new name is required.' });

  const updated = await folderModel.rename(folder.id, name.trim());
  await auditModel.log({
    actorId: req.user.id,
    action: 'folder.rename',
    targetType: 'folder',
    targetId: folder.id,
    metadata: { from: folder.name, to: name.trim() },
    ipAddress: req.ip,
  });
  res.json({ folder: updated });
});

const remove = asyncHandler(async (req, res) => {
  const folder = await folderModel.findById(req.params.id);
  if (!folder) return res.status(404).json({ error: 'Folder not found.' });
  if (folder.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You do not have permission to delete this folder.' });
  }

  await folderModel.softDelete(folder.id);
  await auditModel.log({
    actorId: req.user.id,
    action: 'folder.delete',
    targetType: 'folder',
    targetId: folder.id,
    metadata: { name: folder.name },
    ipAddress: req.ip,
  });
  res.json({ message: 'Folder deleted.' });
});

module.exports = { create, contents, rename, remove };
