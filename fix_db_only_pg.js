const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');

// Extract the CREATE TABLE queries and seed logic
const schemaMatch = code.match(/(CREATE TABLE[\s\S]+?)console\.log\("PostgreSQL tables verified\/created successfully\."\);/);
const schemaSQL = schemaMatch ? schemaMatch[1] : '';

const seedMatch = code.match(/\/\/ Also seed templates if empty[\s\S]+?console\.log\("Seeded basic templates to Postgres\."\);\n\s+\}/);
const seedSQL = seedMatch ? seedMatch[0] : '';

const newDBjs = `require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is missing.");
  console.error("The CRM now requires PostgreSQL. Please add DATABASE_URL to your .env file.");
  process.exit(1);
}

console.log("DATABASE_URL found. Connecting to PostgreSQL...");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Railway and many managed Postgres services
});

const db = {
  query: async (text, params) => {
    let actualParams = params || [];
    if (Array.isArray(params) && params.length === 1 && Array.isArray(params[0])) {
      actualParams = params[0];
    }
    let counter = 1;
    const pgText = text.replace(/\\?/g, () => \`$$\${counter++}\`);
    return pool.query(pgText, actualParams);
  },
  pool: pool
};

(async () => {
  try {
    await pool.query(\`${schemaSQL}\`);
    console.log("PostgreSQL tables verified/created successfully.");
    
    ${seedSQL}
  } catch(err) {
    console.error("PG Init Error:", err);
  }
})();

module.exports = db;
`;

fs.writeFileSync('server/db.js', newDBjs);
