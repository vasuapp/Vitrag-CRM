const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// Convert variable assignments for db.prepare
code = code.replace(/const (\w+) = db\.prepare\((.*?)\);/gs, (match, varName, queryContent) => {
   // queryContent can be a string literal or template literal
   return `const ${varName} = { run: async (...args) => {
        // If it's an INSERT, append RETURNING id
        let q = ${queryContent};
        if (q.trim().toUpperCase().startsWith('INSERT') && !q.includes('RETURNING')) {
            q += ' RETURNING id';
        }
        const r = await db.query(q, args);
        return { lastInsertRowid: r.rows[0] ? r.rows[0].id : null, changes: r.rowCount };
   }};\n`;
});

// Convert updateSync
// `const updateSync = db.prepare("UPDATE properties SET sync_status = ? WHERE id = ?");` -> caught above

// Convert any .transaction calls? pg doesn't have db.transaction.
// Does the codebase use db.transaction? Let's check.
fs.writeFileSync('server/index.js', code);
