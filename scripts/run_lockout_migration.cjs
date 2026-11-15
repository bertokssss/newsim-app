const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function run() {
  const root = 'c:/Users/Mine/source/repos/Capstone_Final/newsim-app';
  const env = { ...loadEnv(path.join(root, '.env')), ...loadEnv(path.join(root, '.env.local')) };
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  
  await client.connect();
  console.log('Connected to DB.');

  const sqlPath = path.join(root, 'packages', 'database', 'migrations', '20261016_auth_lockout_inactivity.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await client.query(sql);
    console.log('Lockout & inactivity migration applied successfully!');

    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('cumulative_failed_attempts', 'offense_level', 'suspension_reason', 'suspended_at', 'last_activity_at', 'failed_login_attempts', 'lockout_until')");
    console.table(res.rows);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
