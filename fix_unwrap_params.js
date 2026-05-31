const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');

const oldLine = `    try {
      // Postgres syntax`;

const newLine = `    try {
      let actualParams = params;
      if (Array.isArray(params) && params.length === 1 && Array.isArray(params[0])) {
        actualParams = params[0];
      }
      
      // Postgres syntax`;

code = code.replace(oldLine, newLine);
code = code.replace(/stmt\.all\(params\)/g, 'stmt.all(actualParams)');
code = code.replace(/stmt\.run\(params\)/g, 'stmt.run(actualParams)');

fs.writeFileSync('server/db.js', code);
