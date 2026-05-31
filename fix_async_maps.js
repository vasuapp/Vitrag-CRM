const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const mapRegexes = [
  { search: /const processedLeads = leads\.map\(l => \{/g, replace: 'const processedLeads = await Promise.all(leads.map(async l => {' },
  { search: /const matches = properties\.map\(p => \{/g, replace: 'const matches = await Promise.all(properties.map(async p => {' },
  { search: /const processedListings = listings\.map\(l => \{/g, replace: 'const processedListings = await Promise.all(listings.map(async l => {' },
  { search: /const processedProjects = projects\.map\(p => \{/g, replace: 'const processedProjects = await Promise.all(projects.map(async p => {' },
  { search: /const processedNetwork = network\.map\(a => \{/g, replace: 'const processedNetwork = await Promise.all(network.map(async a => {' },
  { search: /const formatted = campaigns\.map\(c => \{/g, replace: 'const formatted = await Promise.all(campaigns.map(async c => {' },
  { search: /const proposalsWithItems = proposals\.map\(prop => \{/g, replace: 'const proposalsWithItems = await Promise.all(proposals.map(async prop => {' },
  { search: /const agentsPerformance = agents\.map\(a => \{/g, replace: 'const agentsPerformance = await Promise.all(agents.map(async a => {' }
];

mapRegexes.forEach(({search, replace}) => {
  code = code.replace(search, replace);
});

// Fix Promise.all missing closing brackets!
// Since we replaced `const x = y.map(z => {`, the closing is `});`
// We need to change `});` to `}));` for those specific ones.
// That is harder with regex unless we know exactly where. 
// A safer way is to just do a regex replace on the entire block or write an AST transform.
