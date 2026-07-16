const pool = require('../config/db');

const folderModel = {
  async create({ name, ownerId, parentId }) {
    const { rows } = await pool.query(
      `INSERT INTO folders (name, owner_id, parent_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, ownerId, parentId || null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM folders WHERE id = $1 AND is_trashed = FALSE', [id]);
    return rows[0] || null;
  },

  async listChildren({ ownerId, parentId }) {
    const { rows } = await pool.query(
      `SELECT * FROM folders
       WHERE owner_id = $1 AND is_trashed = FALSE
         AND parent_id IS NOT DISTINCT FROM $2
       ORDER BY name ASC`,
      [ownerId, parentId || null]
    );
    return rows;
  },

  async rename(id, name) {
    const { rows } = await pool.query(
      'UPDATE folders SET name = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [id, name]
    );
    return rows[0];
  },

  async softDelete(id) {
    await pool.query('UPDATE folders SET is_trashed = TRUE, updated_at = now() WHERE id = $1', [id]);
  },

  /** Builds breadcrumb trail from root to the given folder. */
  async breadcrumbs(id) {
    const { rows } = await pool.query(
      `WITH RECURSIVE trail AS (
         SELECT id, name, parent_id FROM folders WHERE id = $1
         UNION ALL
         SELECT f.id, f.name, f.parent_id
         FROM folders f INNER JOIN trail t ON f.id = t.parent_id
       )
       SELECT id, name FROM trail`,
      [id]
    );
    return rows.reverse();
  },
};

module.exports = folderModel;
