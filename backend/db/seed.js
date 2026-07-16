/**
 * Seed script -- creates the first admin account.
 * Run with:  node db/seed.js
 *
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD from .env if present, otherwise
 * falls back to the defaults below (change immediately after first login).
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@docuvault.local';
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const fullName = process.env.ADMIN_NAME || 'System Administrator';

  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, storage_quota_mb)
     VALUES ($1, $2, $3, 'admin', 102400)
     ON CONFLICT (email) DO NOTHING`,
    [fullName, email, hash]
  );

  console.log(`Seed complete. Admin account: ${email} / ${password}`);
  console.log('Change this password immediately after first login.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
