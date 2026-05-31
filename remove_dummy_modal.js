const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

const regex = /<!-- CSV Mapping Modal -->[\s\S]*?<\/div>\n  <\/div>/;
code = code.replace(regex, '');
fs.writeFileSync('public/index.html', code);
