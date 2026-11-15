const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const sql = fs.readFileSync(process.argv[2], 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    const r = await client.query(
      `select code, duration_hours, theory_days, practical_days from public.courses order by code`
    );
    console.table(r.rows);
    await client.query(`notify pgrst, 'reload schema'`);
  } catch (e) {
    await client.query('rollback');
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
