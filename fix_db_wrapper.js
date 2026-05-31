const fs = require('fs');
let file = fs.readFileSync('server/db.js', 'utf8');

file = file.replace(/query: \(text, params\) => pool\.query\(text, params\),/, `query: async (text, params) => {
    let actualParams = params || [];
    if (Array.isArray(params) && params.length === 1 && Array.isArray(params[0])) {
      actualParams = params[0];
    }
    
    let counter = 1;
    // Replace '?' with numbered $ variables, ignoring inside quotes is technically safer but simple regex usually works for this CRM
    // A simple replace is fine since CRM queries don't use '?' inside strings.
    const pgText = text.replace(/\\?/g, () => \`$\${counter++}\`);
    
    return pool.query(pgText, actualParams);
  },`);

fs.writeFileSync('server/db.js', file);
