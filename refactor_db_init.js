const fs = require('fs');
let file = fs.readFileSync('server/db.js', 'utf8');

// Replace better-sqlite3 with pg
file = file.replace(/const Database = require\('better-sqlite3'\);/g, "const { Pool } = require('pg');");
// Remove sqlite db path logic
file = file.replace(/const dbDir = [\s\S]*?const db = new Database\(dbPath\);/g, `
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/realprocrm',
});

// Since pg query is async, we wrap the initialization in an async IIFE
const db = {
  query: (text, params) => pool.query(text, params),
  pool: pool
};
`);

file = file.replace(/console\.log\(\`Database connected successfully at: \$\{dbPath\}\`\);/, "console.log(`PostgreSQL database pool created.`);\n\n(async () => {");

// Replace AUTOINCREMENT with SERIAL
file = file.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');
// Replace sqlite db.exec syntax with await pool.query
file = file.replace(/db\.exec\(\`/g, 'await pool.query(`');

// Remove last insert temp runs
file = file.replace(/const insertTemp = db\.prepare\('INSERT INTO communication_templates \(title, type, category, content\) VALUES \(\?, \?, \?, \?\)'\);/g, `
  const insertTemp = async (title, type, category, content) => {
    await pool.query('INSERT INTO communication_templates (title, type, category, content) VALUES ($1, $2, $3, $4)', [title, type, category, content]);
  };
`);

file = file.replace(/insertTemp\.run\((.*?)\);/g, 'await insertTemp($1);');

// Wrap the seedData call
file = file.replace(/function seedData\(\) \{/g, 'async function seedData() {');
file = file.replace(/seedData\(\);/g, 'await seedData();');
file = file.replace(/module\.exports = db;/g, '})().catch(err => console.error("DB Init Error:", err));\n\nmodule.exports = db;');

fs.writeFileSync('server/db.js', file);
console.log('Refactored db.js');
