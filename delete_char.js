const fs = require('fs');
let lines = fs.readFileSync('server/index.js', 'utf8').split('\n');

// Line 4537 is `    }` 
// Let's print lines 4535 to 4540
console.log(lines.slice(4535, 4541).join('\n'));

// If it's literally an extra `}`, let's remove it
if (lines[4536].trim() === '}') {
  lines[4536] = '';
}
fs.writeFileSync('server/index.js', lines.join('\n'));
