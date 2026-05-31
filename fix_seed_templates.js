const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');

// Replace the SQLite prepare/exec with pg queries for templates
const oldSeedTemplateStr = `
  db.exec("DELETE FROM communication_templates;");
  const insertTemp = db.prepare('INSERT INTO communication_templates (name, platform, use_case, content) VALUES (?, ?, ?, ?)');

  // 10 WHATSAPP (WA) TEMPLATES
  await insertTemp('WA: 1. New Enquiry Greeting', 'WhatsApp', 'Initial Intro', 'Hello {name},\\n\\nThis is Vasu Jain from *Subh Homes / Vitrag CRM*. We received your query regarding premium real estate listings.\\n\\nAre you looking for primary booking or secondary resale? Let me know your preferred layout (e.g. 2BHK/3BHK) so I can curate options!');
  await insertTemp('WA: 2. Schedule Site Visit', 'WhatsApp', 'Lead Nurture', 'Hi {name},\\n\\nWe have slots open this Saturday for private, chauffeur-driven site tours to *Prestige Lakeside* & *Sobha City*.\\n\\nWould 11 AM or 3 PM work better for you and your family? Let me know to block it!');
`;

const replaceWith = `
  await db.query("DELETE FROM communication_templates");
  const insertTemp = async (a,b,c,d) => await db.query('INSERT INTO communication_templates (name, platform, use_case, content) VALUES ($1, $2, $3, $4)', [a,b,c,d]);

  // 10 WHATSAPP (WA) TEMPLATES
  await insertTemp('WA: 1. New Enquiry Greeting', 'WhatsApp', 'Initial Intro', 'Hello {name},\\n\\nThis is Vasu Jain from *Subh Homes / Vitrag CRM*. We received your query regarding premium real estate listings.\\n\\nAre you looking for primary booking or secondary resale? Let me know your preferred layout (e.g. 2BHK/3BHK) so I can curate options!');
  await insertTemp('WA: 2. Schedule Site Visit', 'WhatsApp', 'Lead Nurture', 'Hi {name},\\n\\nWe have slots open this Saturday for private, chauffeur-driven site tours to *Prestige Lakeside* & *Sobha City*.\\n\\nWould 11 AM or 3 PM work better for you and your family? Let me know to block it!');
`;

code = code.replace(oldSeedTemplateStr, replaceWith);

// Also we need to replace the other calls to insertTemp if any
// But actually we just replaced the declaration, so the rest of the await insertTemp(...) calls in db.js will use the new async function automatically!
// Wait! I need to check if there are other sqlite commands.
const otherSqlite = `
  const checkCount = db.prepare('SELECT COUNT(*) as count FROM daily_checklist WHERE routine_date = ?').get(todayStr).count;
`;
const newCheckCount = `
  const checkCountRes = await db.query('SELECT COUNT(*) as count FROM daily_checklist WHERE routine_date = $1', [todayStr]);
  const checkCount = checkCountRes.rows[0].count;
`;
code = code.replace(otherSqlite, newCheckCount);

const otherSqlite2 = `
      const stmt = db.prepare('INSERT INTO daily_checklist (routine_date, task_desc, is_completed) VALUES (?, ?, 0)');
      for (const t of morningRoutines) stmt.run(todayStr, t);
`;
const newSqlite2 = `
      for (const t of morningRoutines) await db.query('INSERT INTO daily_checklist (routine_date, task_desc, is_completed) VALUES ($1, $2, 0)', [todayStr, t]);
`;
code = code.replace(otherSqlite2, newSqlite2);

fs.writeFileSync('server/db.js', code);
