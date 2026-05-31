const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

code = code.replace(/function assignLeadToAgent\(notes, location\) \{/g, 'async function assignLeadToAgent(notes, location) {');
code = code.replace(/const assignment = assignLeadToAgent\(/g, 'const assignment = await assignLeadToAgent(');

fs.writeFileSync('server/index.js', code);
