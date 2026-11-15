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
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' ORDER BY ordinal_position");
  console.log('Profiles columns:');
  console.table(res.rows);
  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
