const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

const jsAdditions = `
// === DYNAMIC DASHBOARD CHARTS & ROUTING ===

window.navToSegment = function(segment) {
  navToPage(segment === 'pipeline' ? 'pipeline' : (segment === 'enquiries' ? 'pipeline' : (segment === 'bookings' ? 'commissions' : 'analytics')));
  if (segment === 'enquiries') {
    // If we have a status filter dropdown on pipeline, set it to New
    setTimeout(() => {
      if (document.getElementById('pipe-status-filter')) {
        document.getElementById('pipe-status-filter').value = 'New';
        if (typeof filterPipeline === 'function') filterPipeline();
      }
    }, 500);
  }
};

window.routeToSource = function(sourceName) {
  navToPage('pipeline');
  setTimeout(() => {
    if (document.getElementById('pipe-source-filter')) {
      document.getElementById('pipe-source-filter').value = sourceName;
      if (typeof filterPipeline === 'function') filterPipeline();
    }
  }, 500);
};

window.routeToStage = function(stageName) {
  navToPage('pipeline');
  setTimeout(() => {
    if (document.getElementById('pipe-status-filter')) {
      document.getElementById('pipe-status-filter').value = stageName;
      if (typeof filterPipeline === 'function') filterPipeline();
    }
  }, 500);
};

window.renderDynamicCharts = async function() {
  try {
    const res = await fetch('/api/reports/analytics');
    const data = await res.json();
    
    // Render Source Breakdown
    if (data.sources && document.getElementById('chart-source-breakdown')) {
      const colors = ['var(--gold)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--amber)', 'var(--slate-light)'];
      let maxCount = Math.max(...data.sources.map(s => parseInt(s.count))) || 1;
      
      let html = '';
      data.sources.forEach((s, idx) => {
        let height = Math.max(15, (parseInt(s.count) / maxCount) * 80);
        let color = colors[idx % colors.length];
        html += \`<div class="chart-bar-wrap" style="cursor:pointer;" onclick="routeToSource('\${s.source}')">
                   <div class="chart-bar" style="height:\${height}px; background:\${color}" title="\${s.count} leads"></div>
                   <div class="chart-label">\${s.source || 'Other'}</div>
                 </div>\`;
      });
      if (!html) html = '<div style="color:var(--text-secondary); font-size:12px; margin-top:20px;">No source data available</div>';
      document.getElementById('chart-source-breakdown').innerHTML = html;
    }

    // Render Pipeline Health
    if (data.stages && document.getElementById('chart-pipeline-health')) {
       const stageOrder = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
       const colors = ['var(--slate-light)', 'var(--blue)', 'var(--amber)', 'var(--purple)', 'var(--green)', 'var(--red)'];
       let maxStageCount = Math.max(...Object.values(data.stages).map(c => parseInt(c))) || 1;
       
       let html = '';
       stageOrder.forEach((stage, idx) => {
         let count = data.stages[stage] || 0;
         let height = Math.max(15, (count / maxStageCount) * 80);
         html += \`<div class="chart-bar-wrap" style="cursor:pointer;" onclick="routeToStage('\${stage}')">
                    <div class="chart-bar" style="height:\${height}px; background:\${colors[idx]}" title="\${count} leads"></div>
                    <div class="chart-label">\${stage}</div>
                  </div>\`;
       });
       document.getElementById('chart-pipeline-health').innerHTML = html;
       // Link header
       const pipelineCardTitle = document.getElementById('chart-pipeline-health').parentElement.querySelector('.card-title');
       if (pipelineCardTitle && !pipelineCardTitle.hasAttribute('data-linked')) {
           pipelineCardTitle.setAttribute('data-linked', 'true');
           pipelineCardTitle.style.cursor = 'pointer';
           pipelineCardTitle.onclick = () => navToPage('pipeline');
       }
    }
  } catch(e) { console.error('Failed to load dynamic charts', e); }
};

window.loadAdminReport = async function() {
  try {
    const tf = document.getElementById('admin-timeframe').value;
    const res = await fetch(\`/api/dashboard/admin-report?timeframe=\${tf}\`);
    const data = await res.json();
    
    document.getElementById('report-leads-today').innerText = data.leadsToday || 0;
    document.getElementById('report-active-visits').innerText = data.activeSiteVisits || 0;
    document.getElementById('report-total-calls').innerText = data.totalCalls || 0;
    document.getElementById('report-total-props').innerText = data.activeProps || 0;
  } catch(e) { console.error('Failed to load admin report', e); }
};
`;

code = code.replace("async function loadDashboardData() {", jsAdditions + "\nasync function loadDashboardData() {");

const dashboardLoadCall = `
    renderCalendar();
    renderPropertyTimelines();
    hydrateSegmentPreviews();
    renderDynamicCharts();
    loadAdminReport();
  } catch (err) {`;
code = code.replace("    hydrateSegmentPreviews();\n  } catch (err) {", dashboardLoadCall);

fs.writeFileSync('public/index.js', code);
