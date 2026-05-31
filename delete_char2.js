const fs = require('fs');
let lines = fs.readFileSync('server/index.js', 'utf8').split('\n');

// If it's literally an extra `}`, let's remove it
if (lines[4573].trim() === '}') {
  lines[4573] = '';
}
fs.writeFileSync('server/index.js', lines.join('\n'));
