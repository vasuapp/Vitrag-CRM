const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const adminReportEndpoint = `
// 3b. Admin Report Timeframe Endpoint
app.get('/api/dashboard/admin-report', async (req, res) => {
  try {
    const timeFilter = req.query.timeframe || 'Daily';
    let dateCondition = '';
    let propsDateCondition = '';
    let callsDateCondition = '';
    
    if (timeFilter === 'Daily') {
      dateCondition = "WHERE created_at >= NOW() - INTERVAL '1 day'";
      propsDateCondition = "AND created_at >= NOW() - INTERVAL '1 day'";
      callsDateCondition = "WHERE timestamp >= NOW() - INTERVAL '1 day'";
    } else if (timeFilter === 'Weekly') {
      dateCondition = "WHERE created_at >= NOW() - INTERVAL '7 days'";
      propsDateCondition = "AND created_at >= NOW() - INTERVAL '7 days'";
      callsDateCondition = "WHERE timestamp >= NOW() - INTERVAL '7 days'";
    } else if (timeFilter === 'Monthly') {
      dateCondition = "WHERE created_at >= NOW() - INTERVAL '30 days'";
      propsDateCondition = "AND created_at >= NOW() - INTERVAL '30 days'";
      callsDateCondition = "WHERE timestamp >= NOW() - INTERVAL '30 days'";
    } else if (timeFilter === 'Quarterly') {
      dateCondition = "WHERE created_at >= NOW() - INTERVAL '90 days'";
      propsDateCondition = "AND created_at >= NOW() - INTERVAL '90 days'";
      callsDateCondition = "WHERE timestamp >= NOW() - INTERVAL '90 days'";
    } else { // All Time
       dateCondition = "";
       propsDateCondition = "";
       callsDateCondition = "";
    }

    const leadsToday = (await db.query(\`SELECT COUNT(*) as count FROM leads \${dateCondition}\`)).rows[0].count;
    
    const activeSiteVisits = (await db.query(\`SELECT COUNT(*) as count FROM interaction_logs \${dateCondition ? dateCondition + " AND interaction_type = 'Site Visit'" : "WHERE interaction_type = 'Site Visit'"}\`)).rows[0].count;
    
    const totalCalls = (await db.query(\`SELECT COUNT(*) as count FROM telephony_calls \${callsDateCondition}\`)).rows[0].count + 
                       (await db.query(\`SELECT COUNT(*) as count FROM interaction_logs \${dateCondition ? dateCondition + " AND interaction_type = 'Phone Call'" : "WHERE interaction_type = 'Phone Call'"}\`)).rows[0].count;
    
    const activeProps = (await db.query(\`SELECT COUNT(*) as count FROM properties WHERE status = 'AVAILABLE' \${propsDateCondition}\`)).rows[0].count;

    res.json({
      leadsToday,
      activeSiteVisits,
      totalCalls,
      activeProps
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

code = code.replace("// 4. Smart Lists Data Endpoint", adminReportEndpoint + "\n// 4. Smart Lists Data Endpoint");
fs.writeFileSync('server/index.js', code);
