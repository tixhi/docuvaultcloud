const pool = require('../config/db');
const crypto = require('crypto');

const shareModel = {
  async createUserShare({ fileId, folderId, sharedBy, sharedWith, permission, expiresAt }) {
    const { rows } = await pool.query(
      `INSERT INTO shares (file_id, folder_id, shared_by, shared_with, permission, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [fileId || null, folderId || null, sharedBy, sharedWith, permission, expiresAt || null]
    );
    return rows[0];
  },

  async createPublicLink({ fileId, folderId, sharedBy, permission, expiresAt }) {
    const token = crypto.randomBytes(24).toString('base64url');
    const { rows } = await pool.query(
      `INSERT INTO shares (file_id, folder_id, shared_by, permission, public_token, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [fileId || null, folderId || null, sharedBy, permission, token, expiresAt || null]
    );
    return rows[0];
  },

  async findByToken(token) {
    const { rows } = await pool.query(
      `SELECT * FROM shares WHERE public_token = $1
         AND (expires_at IS NULL OR expires_at > now())`,
      [token]
    );
    return rows[0] || null;
  },

  /** Everything shared WITH a given user (their "Shared with me" view). */
  async sharedWithMe(userId) {
    const { rows } = await pool.query(
      `SELECT s.*, f.original_name, f.mime_type, f.size_bytes, u.full_name AS shared_by_name
       FROM shares s
       LEFT JOIN files f ON f.id = s.file_id
       LEFT JOIN users u ON u.id = s.shared_by
       WHERE s.shared_with = $1 AND (s.expires_at IS NULL OR s.expires_at > now())
       ORDER BY s.created_at DESC`,
      [userId]
    );
    return rows;
  },

  /** Everything a given user has shared out (owner's perspective). */
  async sharedByMe(userId) {
    const { rows } = await pool.query(
      `SELECT s.*, f.original_name, f.mime_type, u2.full_name AS shared_with_name, u2.email AS shared_with_email
       FROM shares s
       LEFT JOIN files f ON f.id = s.file_id
       LEFT JOIN users u2 ON u2.id = s.shared_with
       WHERE s.shared_by = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findAccessForFile(fileId, userId) {
    const { rows } = await pool.query(
      `SELECT * FROM shares WHERE file_id = $1 AND shared_with = $2
         AND (expires_at IS NULL OR expires_at > now())`,
      [fileId, userId]
    );
    return rows[0] || null;
  },

  async updatePermission(id, permission) {
    const { rows } = await pool.query('UPDATE shares SET permission = $2 WHERE id = $1 RETURNING *', [
      id,
      permission,
    ]);
    return rows[0];
  },

  async revoke(id) {
    await pool.query('DELETE FROM shares WHERE id = $1', [id]);
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM shares WHERE id = $1', [id]);
    return rows[0] || null;
  },
};

module.exports = shareModel;
