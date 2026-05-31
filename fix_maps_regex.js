const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// Replace standard map calls
code = code.replace(/leads\.map\(l => \{/g, 'await Promise.all(leads.map(async l => {');
code = code.replace(/properties\.map\(p => \{/g, 'await Promise.all(properties.map(async p => {');
code = code.replace(/listings\.map\(l => \{/g, 'await Promise.all(listings.map(async l => {');
code = code.replace(/projects\.map\(p => \{/g, 'await Promise.all(projects.map(async p => {');
code = code.replace(/network\.map\(a => \{/g, 'await Promise.all(network.map(async a => {');
code = code.replace(/campaigns\.map\(c => \{/g, 'await Promise.all(campaigns.map(async c => {');
code = code.replace(/proposals\.map\(prop => \{/g, 'await Promise.all(proposals.map(async prop => {');
code = code.replace(/agents\.map\(a => \{/g, 'await Promise.all(agents.map(async a => {');

// Fix closing tags for these specific assignments
// Because we wrapped it in await Promise.all(...), we must change the matching }); to }));
// It's much easier to find the block endings if we do it manually or via AST, but since AST can't parse yet,
// let's do a brute force syntax fix: find where 'const processedLeads = await Promise.all(leads.map...' ends.

fs.writeFileSync('server/index.js', code);
