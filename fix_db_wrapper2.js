const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');

const newWrapper = `
      // Mock information_schema for SQLite
      if (sqliteText.includes('information_schema.columns')) {
        const match = sqliteText.match(/table_name\\s*=\\s*'([^']+)'/);
        if (match && match[1]) {
          const rows = sqlite.prepare(\`PRAGMA table_info('\${match[1]}')\`).all().map(r => ({ name: r.name }));
          return { rows: rows, rowCount: rows.length };
        }
      }
      
      const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.trim().toUpperCase().startsWith('WITH') || sqliteText.includes('RETURNING');
`;

code = code.replace("const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.trim().toUpperCase().startsWith('WITH') || sqliteText.includes('RETURNING');", newWrapper);
fs.writeFileSync('server/db.js', code);
