/**
 * Storage abstraction layer.
 * ----------------------------------------------------------------------------
 * The rest of the app never touches the filesystem or S3 directly -- it only
 * calls the methods below. Two drivers ship today:
 *   - "local"  writes to disk (default, zero setup)
 *   - "s3"     writes to an S3 bucket using IAM credentials (see
 *              config/aws.js and utils/storage.s3.js)
 * Switch between them with STORAGE_DRIVER in .env -- no controller or route
 * code needs to change either way.
 *
 * Every driver implements:
 *   put(buffer, key, opts?)   -> Promise<{ key }>
 *   getStream(key)            -> Promise<ReadableStream>
 *   delete(key)               -> Promise<void>
 *   getLocalPath(key)         -> string | null (local-only convenience)
 * The S3 driver additionally implements getDownloadUrl / getUploadUrl
 * (presigned URLs) -- callers should feature-detect with `driver.getDownloadUrl?.`
 * rather than assuming every driver has them.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DRIVER = process.env.STORAGE_DRIVER || 'local';
const ROOT = path.resolve(process.env.LOCAL_STORAGE_PATH || './storage');

// ---------------------------------------------------------------------------
// Local disk driver
// ---------------------------------------------------------------------------
const localDriver = {
  async ensureRoot() {
    await fsp.mkdir(ROOT, { recursive: true });
  },

  /** Generates a collision-resistant storage key (no original filename in
   *  the key itself -- keeps the abstract pointer stable across renames). */
  buildKey(ownerId, ext) {
    const shard = crypto.randomBytes(2).toString('hex'); // simple 2-level sharding
    const fileId = crypto.randomUUID();
    return `${ownerId}/${shard}/${fileId}${ext ? '.' + ext : ''}`;
  },

  async put(buffer, key) {
    const fullPath = path.join(ROOT, key);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, buffer);
    return { key };
  },

  async getStream(key) {
    const fullPath = path.join(ROOT, key);
    return fs.createReadStream(fullPath);
  },

  async delete(key) {
    const fullPath = path.join(ROOT, key);
    await fsp.rm(fullPath, { force: true });
  },

  getLocalPath(key) {
    return path.join(ROOT, key);
  },
};

// ---------------------------------------------------------------------------
// Driver registry. The S3 driver (and its AWS SDK dependency) is required
// lazily so a purely local setup never needs AWS credentials configured.
// ---------------------------------------------------------------------------
const drivers = { local: localDriver };
if (DRIVER === 's3') {
  drivers.s3 = require('./storage.s3');
}

const driver = drivers[DRIVER];
if (!driver) {
  throw new Error(`Unknown STORAGE_DRIVER "${DRIVER}". Supported: "local", "s3".`);
}

driver.ensureRoot?.();

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = { driver, sha256, activeDriverName: DRIVER };
