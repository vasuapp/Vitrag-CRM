const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Please provide the DATABASE_URL environment variable.");
  console.error("Example: DATABASE_URL='postgresql://postgres:password@railway.app:5432/railway' node migrate_to_postgres.js");
  process.exit(1);
}

const pgPool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const sqlite = new Database(path.join(__dirname, 'server', 'realpro_crm.db'));

async function migrate() {
  console.log("Starting Data Migration from local SQLite to Railway PostgreSQL...");
  try {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'").all();
    
    for (const tableObj of tables) {
      const table = tableObj.name;
      console.log(`Migrating table: ${table}...`);
      
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      if (rows.length === 0) {
        console.log(`  -> 0 rows, skipping.`);
        continue;
      }
      
      // Get columns from first row
      const columns = Object.keys(rows[0]);
      
      // We will do batched inserts or just one by one
      let count = 0;
      for (const row of rows) {
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(c => row[c]);
        
        try {
          await pgPool.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
          count++;
        } catch(e) {
          if (e.code === '42P01') {
            console.error(`  -> Table ${table} does not exist on Postgres! Please restart the Railway app once so it initializes the tables, then try again.`);
            process.exit(1);
          } else if (e.code !== '23505') { // Ignore unique violations
             console.error(`  -> Error inserting row into ${table}:`, e.message);
          }
        }
      }
      
      // Update serial sequence
      try {
        const maxIdRes = await pgPool.query(`SELECT MAX(id) as max FROM ${table}`);
        const maxId = maxIdRes.rows[0].max;
        if (maxId) {
          await pgPool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), ${maxId})`);
        }
      } catch(e) {}
      
      console.log(`  -> Successfully migrated ${count} rows.`);
    }
    
    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    pgPool.end();
  }
}

migrate();
