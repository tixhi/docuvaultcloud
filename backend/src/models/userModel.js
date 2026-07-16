const pool = require('../config/db');

const PUBLIC_COLUMNS = `
  id, full_name, email, role, avatar_url, storage_quota_mb,
  is_active, last_login_at, created_at, updated_at
`;

const userModel = {
  async findByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async findByIdWithPassword(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async create({ fullName, email, passwordHash, role = 'member' }) {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PUBLIC_COLUMNS}`,
      [fullName, email, passwordHash, role]
    );
    return rows[0];
  },

  async updateLastLogin(id) {
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
  },

  async updateProfile(id, { fullName, avatarUrl }) {
    const { rows } = await pool.query(
      `UPDATE users SET
         full_name = COALESCE($2, full_name),
         avatar_url = COALESCE($3, avatar_url),
         updated_at = now()
       WHERE id = $1
       RETURNING ${PUBLIC_COLUMNS}`,
      [id, fullName, avatarUrl]
    );
    return rows[0];
  },

  async updatePassword(id, passwordHash) {
    await pool.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [
      id,
      passwordHash,
    ]);
  },

  async setRole(id, role) {
    const { rows } = await pool.query(
      `UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
      [id, role]
    );
    return rows[0];
  },

  async setActive(id, isActive) {
    const { rows } = await pool.query(
      `UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
      [id, isActive]
    );
    return rows[0];
  },

  async list({ limit = 50, offset = 0, search = '' } = {}) {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users
       WHERE full_name ILIKE $3 OR email ILIKE $3
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset, `%${search}%`]
    );
    return rows;
  },

  /** Aggregate storage usage per user, used by the admin panel + profile page. */
  async storageUsage(userId) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used_bytes, COUNT(*)::int AS file_count
       FROM files WHERE owner_id = $1 AND is_trashed = FALSE`,
      [userId]
    );
    return rows[0];
  },
};

module.exports = userModel;
