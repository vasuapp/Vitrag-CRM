const fs = require('fs');

const dbJsContent = `
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = path.join(__dirname, 'realpro_crm.db');
const sqlite = new Database(dbPath);

const db = {
  query: async (text, params = []) => {
    try {
      // Postgres syntax $1, $2, etc needs to be replaced with ? for SQLite, but ONLY if we are passing arrays
      // Actually, better-sqlite3 supports ? binding. We can just replace $1, $2, etc with ?
      let sqliteText = text.replace(/\\$\\d+/g, '?');
      
      // Handle INTERVAL logic used in Postgres queries
      // e.g. "NOW() - INTERVAL '1 day'" -> "datetime('now', '-1 day')"
      sqliteText = sqliteText.replace(/NOW\\(\\)\\s*-\\s*INTERVAL\\s*'(\\d+)\\s+days?'/g, "datetime('now', '-$1 day')");
      sqliteText = sqliteText.replace(/NOW\\(\\)\\s*-\\s*INTERVAL\\s*'(\\d+)\\s+day'/g, "datetime('now', '-$1 day')");
      
      const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.trim().toUpperCase().startsWith('WITH') || sqliteText.includes('RETURNING');
      
      if (isSelect) {
        const stmt = sqlite.prepare(sqliteText);
        const rows = stmt.all(params);
        return { rows: rows, rowCount: rows.length };
      } else {
        const stmt = sqlite.prepare(sqliteText);
        const info = stmt.run(params);
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

console.log("Database reverted to SQLite wrapper (better-sqlite3) for local testing.");

module.exports = db;
`;

fs.writeFileSync('server/db.js', dbJsContent.trim());
