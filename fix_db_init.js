const fs = require('fs');
let schema = fs.readFileSync('schema.sql', 'utf8');

// Convert SQLite schema to Postgres schema
schema = schema.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');
schema = schema.replace(/REAL/g, 'NUMERIC');

const pgInit = `
  (async () => {
    try {
      await pool.query(\`
        ${schema}
      \`);
      console.log("PostgreSQL tables verified/created successfully.");
      
      // Also seed templates if empty
      const tempCount = (await pool.query("SELECT COUNT(*) FROM communication_templates")).rows[0].count;
      if (parseInt(tempCount) === 0) {
        const insertTemp = async (name, platform, use_case, content) => await pool.query('INSERT INTO communication_templates (name, platform, use_case, content) VALUES ($1, $2, $3, $4)', [name, platform, use_case, content]);

        // 10 WHATSAPP (WA) TEMPLATES
        await insertTemp('WA: 1. New Enquiry Greeting', 'WhatsApp', 'Initial Intro', 'Hello {name},\\n\\nThis is Vasu Jain from *Subh Homes / Vitrag CRM*. We received your query regarding premium real estate listings.\\n\\nAre you looking for primary booking or secondary resale? Let me know your preferred layout (e.g. 2BHK/3BHK) so I can curate options!');
        await insertTemp('WA: 2. Schedule Site Visit', 'WhatsApp', 'Lead Nurture', 'Hi {name},\\n\\nWe have slots open this Saturday for private, chauffeur-driven site tours to *Prestige Lakeside* & *Sobha City*.\\n\\nWould 11 AM or 3 PM work better for you and your family? Let me know to block it!');
        console.log("Seeded basic templates to Postgres.");
      }
    } catch(err) {
      console.error("PG Init Error:", err);
    }
  })();
`;

let code = fs.readFileSync('server/db.js', 'utf8');
code = code.replace('// Postgres initialization (if table doesn\'t exist)\n  // Actually we will assume the migration script initializes tables, but let\'s just make sure db object is exported.', pgInit);
fs.writeFileSync('server/db.js', code);
