const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');
console.log(code.substring(0, 500));
