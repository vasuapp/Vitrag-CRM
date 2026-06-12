const { Pool } = require('pg');

async function test() {
  const pool = new Pool({ connectionString: "postgres://postgres:root@localhost:5432/postgres" });
  try {
    const dbs = await pool.query("SELECT datname FROM pg_database WHERE datistemplate = false");
    console.log("Databases on server:", dbs.rows.map(r => r.datname));

    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables in database 'postgres':", tables.rows.map(r => r.table_name));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

test();
