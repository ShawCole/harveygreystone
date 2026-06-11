require('./_bootstrap');
const { Connector } = require('@google-cloud/cloud-sql-connector');
const { Pool } = require('pg');
const { SEED_DEALS } = require('./_seed');

let poolPromise = null;
let schemaReady = false;

async function buildPool() {
  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME,
    ipType: 'PUBLIC',
  });
  return new Pool({
    ...clientOpts,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    max: 1, // serverless: keep the per-instance connection count tiny
  });
}

function getPool() {
  if (!poolPromise) poolPromise = buildPool();
  return poolPromise;
}

async function ensureSchema() {
  if (schemaReady) return;
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deals     (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS tasks     (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS contacts  (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS investors (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
  `);
  // Seed the 15 real deals only when the table is empty.
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM deals');
  if (rows[0].n === 0) {
    const now = new Date().toISOString();
    for (const d of SEED_DEALS) {
      const payload = { ...d, createdDate: now };
      await pool.query('INSERT INTO deals (id, payload) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [d.id, payload]);
    }
  }
  schemaReady = true;
}

async function readAll() {
  const pool = await getPool();
  const [deals, tasks, contacts, investors] = await Promise.all([
    pool.query('SELECT payload FROM deals ORDER BY id'),
    pool.query('SELECT payload FROM tasks ORDER BY id'),
    pool.query('SELECT payload FROM contacts ORDER BY id'),
    pool.query('SELECT payload FROM investors ORDER BY id'),
  ]);
  return {
    deals: deals.rows.map((r) => r.payload),
    tasks: tasks.rows.map((r) => r.payload),
    contacts: contacts.rows.map((r) => r.payload),
    investors: investors.rows.map((r) => r.payload),
  };
}

// Transactional full-sync of one collection: upsert every row by id, delete rows
// whose id is absent from the incoming array.
async function syncTable(client, table, items) {
  if (!Array.isArray(items)) return;
  const ids = [];
  for (const item of items) {
    if (item == null || item.id == null) continue;
    ids.push(item.id);
    await client.query(
      `INSERT INTO ${table} (id, payload, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [item.id, item]
    );
  }
  if (ids.length) {
    await client.query(`DELETE FROM ${table} WHERE NOT (id = ANY($1::bigint[]))`, [ids]);
  } else {
    await client.query(`DELETE FROM ${table}`);
  }
}

async function writeAll({ deals, tasks, contacts, investors }) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await syncTable(client, 'deals', deals);
    await syncTable(client, 'tasks', tasks);
    await syncTable(client, 'contacts', contacts);
    if (investors !== undefined) await syncTable(client, 'investors', investors);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- single-deal helpers (used by the NCNDA / client-portal endpoints) ---

async function getDeal(id) {
  const pool = await getPool();
  const { rows } = await pool.query('SELECT payload FROM deals WHERE id = $1', [id]);
  return rows[0] ? rows[0].payload : null;
}

async function saveDeal(id, payload) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO deals (id, payload, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
    [id, payload]
  );
}

// Look up a deal by its client-portal token (stored at payload.ncnda.token).
async function findDealByToken(token) {
  if (!token) return null;
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT id, payload FROM deals WHERE payload->'ncnda'->>'token' = $1 LIMIT 1`,
    [token]
  );
  return rows[0] ? { id: Number(rows[0].id), payload: rows[0].payload } : null;
}

// Look up a deal by a finalized NCNDA certificate id (for public verification).
async function findDealByCertificate(certId) {
  if (!certId) return null;
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT id, payload FROM deals WHERE payload->'ncnda'->>'certificateId' = $1 LIMIT 1`,
    [certId]
  );
  return rows[0] ? { id: Number(rows[0].id), payload: rows[0].payload } : null;
}

module.exports = { getPool, ensureSchema, readAll, writeAll, getDeal, saveDeal, findDealByToken, findDealByCertificate };
