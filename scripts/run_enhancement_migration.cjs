const fs = require('fs');
const path = require('path');
const { Client } = require(path.join('c:/Users/Mine/source/repos/Capstone_Final/newsim-app/node_modules/pg'));

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

  const sqlPath = path.join(root, 'packages', 'database', 'migrations', '20261013_grading_attendance_rbac.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await client.query(sql);
    console.log('Migration applied successfully!');
    
    const r1 = await client.query('SELECT count(*) FROM practical_rubrics');
    console.log('Practical rubrics count:', r1.rows[0].count);
    const r2 = await client.query('SELECT count(*) FROM practical_rubric_criteria');
    console.log('Rubric criteria count:', r2.rows[0].count);
    const r3 = await client.query('SELECT count(*) FROM grading_policies');
    console.log('Grading policies count:', r3.rows[0].count);
    const r4 = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'attendance\'');
    console.log('Attendance columns:', r4.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
