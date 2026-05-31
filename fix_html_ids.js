const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

code = code.replace(
  '<div class="card-title"><i class="ti ti-funnel"></i> Lead Source Breakdown</div>',
  '<div class="card-title"><i class="ti ti-funnel"></i> Lead Source Breakdown</div>'
);
code = code.replace(
  '<div class="chart-wrap">\n                <div class="chart-bar-wrap"><div class="chart-bar" style="height:72px;background:var(--gold)"></div><div class="chart-label">WhatsApp</div></div>',
  '<div class="chart-wrap" id="chart-source-breakdown">\n                <div class="chart-bar-wrap"><div class="chart-bar" style="height:72px;background:var(--gold)"></div><div class="chart-label">WhatsApp</div></div>'
);

code = code.replace(
  '<div class="chart-wrap">\n                <div class="chart-bar-wrap"><div class="chart-bar" style="height:40px;background:var(--slate-light)"></div><div class="chart-label">Cold</div></div>',
  '<div class="chart-wrap" id="chart-pipeline-health">\n                <div class="chart-bar-wrap"><div class="chart-bar" style="height:40px;background:var(--slate-light)"></div><div class="chart-label">Cold</div></div>'
);

const adminHeader = '<div class="card-title"><i class="ti ti-chart-line"></i> Daily Operations Admin Report</div>';
const adminHeaderNew = `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <div class="card-title" style="margin-bottom:0;"><i class="ti ti-chart-line"></i> Admin Report</div>
                <select id="admin-timeframe" class="form-select" style="width:110px; font-size:10px; padding:2px; height:24px;" onchange="loadAdminReport()">
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="All Time">All Time</option>
                </select>
              </div>
`;
code = code.replace(adminHeader, adminHeaderNew.trim());

fs.writeFileSync('public/index.html', code);
