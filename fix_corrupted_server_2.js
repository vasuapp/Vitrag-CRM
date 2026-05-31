const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

code = code.replace(/VALUES \(\$\{dbCols\.map\(\(\_, i\) => \`[\s\S]*?\+ \(i \+ 1\)\)\.join\(', '\)\}\)/g, "VALUES (${dbCols.map((_, i) => '$' + (i + 1)).join(', ')})");

fs.writeFileSync('server/index.js', code);
console.log("Fix applied. Checking syntax...");
