const pool = require('../config/db');

const fileModel = {
  async create({
    originalName,
    mimeType,
    sizeBytes,
    storageKey,
    storageDriver,
    checksum,
    ownerId,
    folderId,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO files
         (original_name, mime_type, size_bytes, storage_key, storage_driver,
          checksum_sha256, owner_id, folder_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [originalName, mimeType, sizeBytes, storageKey, storageDriver, checksum, ownerId, folderId || null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1 AND is_trashed = FALSE', [id]);
    return rows[0] || null;
  },

  /** Lists files owned by a user, optionally within a folder, with search/filter. */
  async list({ ownerId, folderId, search, mimeCategory, limit = 100, offset = 0, sort = 'created_at', dir = 'DESC' }) {
    const allowedSort = ['created_at', 'original_name', 'size_bytes', 'updated_at'];
    const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
    const sortDir = dir === 'ASC' ? 'ASC' : 'DESC';

    const clauses = ['owner_id = $1', 'is_trashed = FALSE'];
    const params = [ownerId];
    let idx = 2;

    if (folderId !== undefined) {
      clauses.push(`folder_id IS NOT DISTINCT FROM $${idx}`);
      params.push(folderId || null);
      idx += 1;
    }
    if (search) {
      clauses.push(`original_name ILIKE $${idx}`);
      params.push(`%${search}%`);
      idx += 1;
    }
    if (mimeCategory) {
      clauses.push(`mime_type ILIKE $${idx}`);
      params.push(`${mimeCategory}%`);
      idx += 1;
    }

    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT * FROM files WHERE ${clauses.join(' AND ')}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return rows;
  },

  async rename(id, name) {
    const { rows } = await pool.query(
      'UPDATE files SET original_name = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [id, name]
    );
    return rows[0];
  },

  async move(id, folderId) {
    const { rows } = await pool.query(
      'UPDATE files SET folder_id = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [id, folderId || null]
    );
    return rows[0];
  },

  async softDelete(id) {
    await pool.query('UPDATE files SET is_trashed = TRUE, updated_at = now() WHERE id = $1', [id]);
  },

  async restore(id) {
    await pool.query('UPDATE files SET is_trashed = FALSE, updated_at = now() WHERE id = $1', [id]);
  },

  async hardDelete(id) {
    await pool.query('DELETE FROM files WHERE id = $1', [id]);
  },

  async listTrashed(ownerId) {
    const { rows } = await pool.query(
      'SELECT * FROM files WHERE owner_id = $1 AND is_trashed = TRUE ORDER BY updated_at DESC',
      [ownerId]
    );
    return rows;
  },

  /** Storage usage breakdown by mime category, for dashboard charts. */
  async usageByCategory(ownerId) {
    const { rows } = await pool.query(
      `SELECT
         CASE
           WHEN mime_type LIKE 'image/%' THEN 'images'
           WHEN mime_type = 'application/pdf' THEN 'pdf'
           WHEN mime_type LIKE 'video/%' THEN 'video'
           WHEN mime_type LIKE 'text/%' OR mime_type LIKE '%word%' THEN 'documents'
           ELSE 'other'
         END AS category,
         COUNT(*)::int AS file_count,
         COALESCE(SUM(size_bytes), 0)::bigint AS total_bytes
       FROM files
       WHERE owner_id = $1 AND is_trashed = FALSE
       GROUP BY category`,
      [ownerId]
    );
    return rows;
  },

  async recentActivity(ownerId, limit = 10) {
    const { rows } = await pool.query(
      `SELECT id, original_name, mime_type, size_bytes, updated_at
       FROM files WHERE owner_id = $1 AND is_trashed = FALSE
       ORDER BY updated_at DESC LIMIT $2`,
      [ownerId, limit]
    );
    return rows;
  },
};

module.exports = fileModel;
