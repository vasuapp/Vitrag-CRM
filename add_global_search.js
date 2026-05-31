const fs = require('fs');
let js = fs.readFileSync('public/index.js', 'utf8');

const logic = `
// ------------------------------------------
// GLOBAL SEARCH LOGIC
// ------------------------------------------
let globalSearchTimeout = null;

window.performGlobalSearch = function() {
  const input = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('global-search-results');
  const query = input.value.trim();

  if (!query) {
    resultsContainer.style.display = 'none';
    return;
  }

  if (globalSearchTimeout) clearTimeout(globalSearchTimeout);
  
  globalSearchTimeout = setTimeout(async () => {
    try {
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--gold-l);"><i class="ti ti-loader" style="animation: spin 1s linear infinite;"></i> Searching...</div>';

      const [leadsRes, propsRes, projsRes] = await Promise.all([
        fetch(\`/api/leads?search=\${encodeURIComponent(query)}\`),
        fetch(\`/api/properties?search=\${encodeURIComponent(query)}\`),
        fetch(\`/api/projects?search=\${encodeURIComponent(query)}\`)
      ]);

      const leads = await leadsRes.json();
      const props = await propsRes.json();
      const projs = await projsRes.json();

      let html = '';
      
      if (leads.length > 0) {
        html += '<div class="gs-category-header"><i class="ti ti-users"></i> Leads</div>';
        leads.slice(0, 5).forEach(l => {
          html += \`
            <div class="gs-result-item" onclick="showLeadDetails(\${l.id}); document.getElementById('global-search-results').style.display='none';">
              <strong style="font-size:12.5px; color:#fff;">\${escapeQuote(l.name)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">\${escapeQuote(l.phone || '')} | \${escapeQuote(l.status)}</div>
            </div>
          \`;
        });
      }

      if (props.length > 0) {
        html += '<div class="gs-category-header"><i class="ti ti-building"></i> Inventory</div>';
        props.slice(0, 5).forEach(p => {
          html += \`
            <div class="gs-result-item" onclick="showPropertyDetails('\${p.prop_id}'); document.getElementById('global-search-results').style.display='none';">
              <strong style="font-size:12.5px; color:#fff;">\${escapeQuote(p.society)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">\${escapeQuote(p.location)} | \${escapeQuote(p.configuration)} | \${escapeQuote(p.price_raw)}</div>
            </div>
          \`;
        });
      }

      if (projs.length > 0) {
        html += '<div class="gs-category-header"><i class="ti ti-building-skyscraper"></i> Projects</div>';
        projs.slice(0, 3).forEach(p => {
          html += \`
            <div class="gs-result-item" onclick="navToSegment('projects'); setTimeout(()=> { document.getElementById('filter-proj-search').value='\${escapeQuote(p.project_name)}'; loadProjects(); }, 300); document.getElementById('global-search-results').style.display='none';">
              <strong style="font-size:12.5px; color:#fff;">\${escapeQuote(p.project_name)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">\${escapeQuote(p.builder_name)} | \${escapeQuote(p.location)}</div>
            </div>
          \`;
        });
      }

      if (!html) {
        html = '<div style="padding: 15px; text-align: center; color: var(--text-muted); font-size:12px;">No matching results found across the CRM.</div>';
      }

      resultsContainer.innerHTML = html;
    } catch(err) {
      console.error(err);
      resultsContainer.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--red); font-size:12px;">Error performing search.</div>';
    }
  }, 400);
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('global-search-results');
  const input = document.getElementById('global-search-input');
  if (container && input && !container.contains(e.target) && e.target !== input) {
    container.style.display = 'none';
  }
});
`;

js += '\n' + logic;
fs.writeFileSync('public/index.js', js);
