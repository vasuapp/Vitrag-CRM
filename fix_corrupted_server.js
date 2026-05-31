const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// The corruption injected the entire preceding file contents inside the template string.
// It looks like: VALUES (${dbCols.map((_, i) => `...huge text...` + (i + 1)).join(', ')})
code = code.replace(/VALUES \(\$\{dbCols\.map\(\(\_, i\) => [\s\S]*?\+ \(i \+ 1\)\)\.join\(', '\)\}\)/g, "VALUES (${dbCols.map((_, i) => '$' + (i + 1)).join(', ')})");

fs.writeFileSync('server/index.js', code);
console.log("Fix applied. Checking syntax...");
