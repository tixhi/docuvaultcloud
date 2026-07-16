/**
 * Multer configuration. Files are buffered in memory (fine up to a few
 * hundred MB per MAX_UPLOAD_MB) and then handed to the storage abstraction
 * in utils/storage.js -- controllers never see multer internals directly.
 */
const multer = require('multer');

const maxMb = Number(process.env.MAX_UPLOAD_MB || 250);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 },
});

module.exports = upload;
