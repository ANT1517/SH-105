/**
 * Idempotent Seed — Meera Demo State
 *
 * Inserts the canonical Meera fixture into a real PostgreSQL database.
 * Uses ON CONFLICT DO NOTHING so it is safe to run multiple times
 * without creating duplicates or altering existing data.
 *
 * Owned by Person B.
 * Do NOT hard-code totals — values come from meeraFixture.json.
 */

require('dotenv').config();
const { pool, checkDatabaseConnection, initSchema } = require('./db');
const fixture = require('../fixtures/meeraFixture.json');

// ─── Five canonical Money Pot Map pots ───────────────────────────────────────
// These are the ONLY pots that contribute to the ₹18,500 total.
// Business is tracked separately via the ledger and is NOT part of this seed.
const CANONICAL_POTS = [
  { pot_type: 'cash',           amount: fixture.cash },
  { pot_type: 'bank',           amount: fixture.bank },
  { pot_type: 'shg',            amount: fixture.shg },
  { pot_type: 'chit_committed', amount: fixture.chit_committed },
  { pot_type: 'post_office',    amount: fixture.post_office },
];

/**
 * Seeds the Meera demo user and her canonical financial state.
 * Idempotent: safe to run on a fresh OR already-seeded database.
 *
 * @param {object} client - Optional pg client for transactional use.
 *                          If omitted, uses the shared pool directly.
 */
async function seedMeera(client) {
  const exec = client
    ? (text, params) => client.query(text, params)
    : (text, params) => pool.query(text, params);

  // 1. Insert user — skip silently if already exists
  await exec(
    `INSERT INTO users (id, name, phone)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [fixture.user_id, 'Meera', null]
  );

  // 2. Insert five canonical pots — skip if already present
  for (const pot of CANONICAL_POTS) {
    await exec(
      `INSERT INTO pots (user_id, pot_type, amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, pot_type) DO NOTHING`,
      [fixture.user_id, pot.pot_type, pot.amount]
    );
  }

  // 3. Insert Education goal — skip if already present for this user
  await exec(
    `INSERT INTO goals (user_id, name, target_amount, saved_amount, is_active)
     SELECT $1::VARCHAR, $2::VARCHAR, $3, $4, true
     WHERE NOT EXISTS (
       SELECT 1 FROM goals WHERE user_id = $1::VARCHAR AND name = $2::VARCHAR
     )`,
    [fixture.user_id, fixture.goal.name, fixture.goal.target, fixture.goal.saved]
  );

  // 4. Insert initial ledger entry — skip if already present
  await exec(
    `INSERT INTO ledger_entries (user_id, activity, revenue, cost, profit, notes)
     SELECT $1::VARCHAR, $2::VARCHAR, $3, $4, $5, $6::TEXT
     WHERE NOT EXISTS (
       SELECT 1 FROM ledger_entries WHERE user_id = $1::VARCHAR AND activity = $2::VARCHAR
     )`,
    [
      fixture.user_id,
      fixture.business.activity,
      fixture.business.last_entry.revenue,
      fixture.business.last_entry.cost,
      fixture.business.last_entry.profit,
      'Initial seed entry'
    ]
  );

  return { seeded: true, user_id: fixture.user_id };
}

/**
 * Standalone runner — called directly via `node src/db/seed.js`
 */
async function runSeed() {
  const connected = await checkDatabaseConnection();
  if (!connected) {
    console.error('[Seed] PostgreSQL unreachable. Aborting seed.');
    process.exit(1);
  }
  await initSchema();
  await seedMeera();
  console.log('[Seed] Meera demo state seeded successfully.');
  await pool.end();
}

// Run if executed directly
if (require.main === module) {
  runSeed().catch(err => {
    console.error('[Seed] Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { seedMeera };
