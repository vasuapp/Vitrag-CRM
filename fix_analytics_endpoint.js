const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// Find the rawStages part in /api/reports/analytics
const searchString = `    const rawStages = (await db.query("SELECT stage, COUNT(*) as count FROM leads GROUP BY stage")).rows;`;
const replacement = `
    const timeFilter = req.query.timeframe || 'All Time';
    let dateCondition = '';
    if (timeFilter === 'Daily') dateCondition = "WHERE created_at >= NOW() - INTERVAL '1 day'";
    if (timeFilter === 'Weekly') dateCondition = "WHERE created_at >= NOW() - INTERVAL '7 days'";
    if (timeFilter === 'Monthly') dateCondition = "WHERE created_at >= NOW() - INTERVAL '30 days'";
    if (timeFilter === 'Quarterly') dateCondition = "WHERE created_at >= NOW() - INTERVAL '90 days'";

    // 1. Stage breakdown
    const rawStages = (await db.query(\`SELECT stage, COUNT(*) as count FROM leads \${dateCondition} GROUP BY stage\`)).rows;

    // 1b. Source breakdown
    const rawSources = (await db.query(\`SELECT source, COUNT(*) as count FROM leads \${dateCondition} GROUP BY source\`)).rows;
`;

code = code.replace(searchString, replacement.trim());

// Also make sure to return sources
const returnString = `    res.json({
      stages: stagesMap,`;
const returnReplacement = `    res.json({
      sources: rawSources,
      stages: stagesMap,`;
code = code.replace(returnString, returnReplacement);

fs.writeFileSync('server/index.js', code);
