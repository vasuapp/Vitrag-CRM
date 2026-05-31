const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// Fix the '?' param mapping to use '$' notation for Postgres compatibility
code = code.replace(
  /VALUES \(\$\{dbCols\.map\(\(\) => '\?'\)\.join\(', '\)\}\)/g,
  'VALUES (${dbCols.map((_, i) => `$` + (i + 1)).join(\', \')})'
);

fs.writeFileSync('server/index.js', code);
