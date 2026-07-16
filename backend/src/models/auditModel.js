const pool = require('../config/db');

const auditModel = {
  async log({ actorId, action, targetType, targetId, metadata = {}, ipAddress }) {
    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [actorId || null, action, targetType || null, targetId || null, metadata, ipAddress || null]
    );
  },

  async list({ limit = 100, offset = 0, actorId, action, from, to } = {}) {
    const clauses = ['1=1'];
    const params = [];
    let idx = 1;

    if (actorId) {
      clauses.push(`actor_id = $${idx++}`);
      params.push(actorId);
    }
    if (action) {
      clauses.push(`action = $${idx++}`);
      params.push(action);
    }
    if (from) {
      clauses.push(`created_at >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      clauses.push(`created_at <= $${idx++}`);
      params.push(to);
    }

    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT a.*, u.full_name AS actor_name, u.email AS actor_email
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return rows;
  },

  async forUser(userId, limit = 50) {
    const { rows } = await pool.query(
      `SELECT * FROM audit_logs WHERE actor_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return rows;
  },
};

module.exports = auditModel;
