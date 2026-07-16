/**
 * PostgreSQL connection pool.
 * Every query in the app should go through `pool.query(...)` or a
 * transaction client acquired via `pool.connect()` -- never open ad hoc
 * connections elsewhere.
 */
const { Pool } = require('pg');

const useSSL = String(process.env.PGSSL).toLowerCase() === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Catches errors on idle clients so the whole process doesn't crash.
  // eslint-disable-next-line no-console
  console.error('[db] unexpected error on idle client', err);
});

module.exports = pool;
