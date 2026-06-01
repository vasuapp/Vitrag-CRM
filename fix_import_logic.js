const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// Replace logic in /api/import-mapped/:table
code = code.replace(
/let val = recordObj\[col\];\s*if \(val === undefined \|\| val === null\) return '';\s*return val;/g,
`let val = recordObj[col];
          if (val === undefined || val === null || val === '') return null;
          return val;`
);

// Replace logic in /api/import/:table
code = code.replace(
/let val = row\[csvIdx\];\s*if \(val === undefined \|\| val === null\) return '';\s*return val;\s*\}\s*return '';/g,
`let val = row[csvIdx];
          if (val === undefined || val === null || val === '') return null;
          return val;
        }
        return null;`
);

fs.writeFileSync('server/index.js', code);
console.log("Fixed import mapping logic for PostgreSQL.");
