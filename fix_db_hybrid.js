const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');

const newWrapper = `
const path = require('path');
const fs = require('fs');

let db;

if (process.env.DATABASE_URL) {
  console.log("DATABASE_URL found. Connecting to PostgreSQL...");
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Railway and many managed Postgres services
  });

  db = {
    query: async (text, params) => {
      let actualParams = params || [];
      if (Array.isArray(params) && params.length === 1 && Array.isArray(params[0])) {
        actualParams = params[0];
      }
      let counter = 1;
      const pgText = text.replace(/\\?/g, () => \`$\${counter++}\`);
      return pool.query(pgText, actualParams);
    },
    pool: pool
  };
  
  // Postgres initialization (if table doesn't exist)
  // Actually we will assume the migration script initializes tables, but let's just make sure db object is exported.
  
} else {
  console.log("No DATABASE_URL found. Connecting to local SQLite...");
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, 'realpro_crm.db');
  const sqlite = new Database(dbPath);

  db = {
    query: async (text, params = []) => {
      try {
        let actualParams = params;
        if (Array.isArray(params) && params.length === 1 && Array.isArray(params[0])) {
          actualParams = params[0];
        }
        
        let sqliteText = text.replace(/\\$\\d+/g, '?');
        sqliteText = sqliteText.replace(/NOW\\(\\)\\s*-\\s*INTERVAL\\s*'(\\d+)\\s+days?'/g, "datetime('now', '-$1 day')");
        sqliteText = sqliteText.replace(/NOW\\(\\)\\s*-\\s*INTERVAL\\s*'(\\d+)\\s+day'/g, "datetime('now', '-$1 day')");
        
        if (sqliteText.includes('information_schema.columns')) {
          const match = sqliteText.match(/table_name\\s*=\\s*'([^']+)'/);
          if (match && match[1]) {
            const rows = sqlite.prepare(\`PRAGMA table_info('\${match[1]}')\`).all().map(r => ({ name: r.name }));
            return { rows: rows, rowCount: rows.length };
          }
        }
        
        const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.trim().toUpperCase().startsWith('WITH') || sqliteText.includes('RETURNING');
        
        if (isSelect) {
          const stmt = sqlite.prepare(sqliteText);
          const rows = stmt.all(actualParams);
          return { rows: rows, rowCount: rows.length };
        } else {
          const stmt = sqlite.prepare(sqliteText);
          const info = stmt.run(actualParams);
          return { rows: [], rowCount: info.changes };
        }
      } catch (err) {
        console.error("SQLite Query Error:", err, "Query:", text);
        throw err;
      }
    },
    prepare: (text) => sqlite.prepare(text),
    exec: (text) => sqlite.exec(text)
  };
}

module.exports = db;
`;

fs.writeFileSync('server/db.js', newWrapper.trim());
