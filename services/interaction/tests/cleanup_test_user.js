// Deletes the dedicated integration-test user; FK ON DELETE CASCADE removes its pots/transactions/audit rows.
// Refuses any id other than the test user.
const path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
require(path.join(root, 'node_modules', 'dotenv')).config({ path: path.join(root, '.env') });
const { Pool } = require(path.join(root, 'node_modules', 'pg'));

const TEST_USER = 'test_dev_a_integration';
if (process.argv[2] !== TEST_USER) { console.error('refusing: not the test user'); process.exit(2); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
pool.query('DELETE FROM users WHERE id = $1', [TEST_USER])
  .then(r => { console.log(`deleted ${r.rowCount} user row(s)`); return pool.end(); })
  .catch(e => { console.error(e.message); process.exit(1); });
