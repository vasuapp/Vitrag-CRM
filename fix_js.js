const fs = require('fs');
let js = fs.readFileSync('public/index.js', 'utf8');

// 1. Update loadProperties to populate inventory-count-display
if (!js.includes('inventory-count-display')) {
  js = js.replace(
    /const filteredListings = data\.filter\(p => \{/,
    `const disp = document.getElementById('inventory-count-display');\n    if (disp) disp.innerHTML = \`Currently showing <strong>\${data.length}</strong> total properties from dataset\`;\n    \n    const filteredListings = data.filter(p => {`
  );
}

// 2. Update triggerBulkDelete to call loadDashboardData
if (!js.includes('if (table === \'properties\') { loadProperties(); loadDashboardData(); }')) {
  js = js.replace(
    /if \(table === 'properties'\) loadProperties\(\);/g,
    `if (table === 'properties') { loadProperties(); loadDashboardData(); }`
  );
  js = js.replace(
    /else if \(table === 'projects'\) loadProjects\(\);/g,
    `else if (table === 'projects') { loadProjects(); loadDashboardData(); }`
  );
}

// 3. Update renderPaginationBar signature
if (!js.includes('handlerName = \'changePropPage\'')) {
  js = js.replace(
    /function renderPaginationBar\(tab, currentPage, totalPages\) \{/g,
    `function renderPaginationBar(tab, currentPage, totalPages, handlerName = 'changePropPage') {`
  );
  js = js.replace(
    /onclick="changePropPage\('\$\{tab\}', \$\{currentPage - 1\}\)"/g,
    `onclick="\${handlerName}('\${tab}', \${currentPage - 1})"`
  );
  js = js.replace(
    /onclick="changePropPage\('\$\{tab\}', \$\{currentPage \+ 1\}\)"/g,
    `onclick="\${handlerName}('\${tab}', \${currentPage + 1})"`
  );
}

// 4. Add pagination to Projects & Leads
if (!js.includes('state.projPage')) {
  js = js.replace(
    /let state = \{/g,
    `let state = {\n  projPage: 1,\n  leadsPage: 1,`
  );
  
  const projPaginationFns = `
window.changeProjPage = function(tab, pageNum) {
  state.projPage = pageNum;
  loadProjects();
};

window.changeLeadsPage = function(tab, pageNum) {
  state.leadsPage = pageNum;
  loadEnquiries();
};
`;
  js = js.replace(
    /window\.changePropPage = changePropPage;/g,
    `window.changePropPage = changePropPage;\n${projPaginationFns}`
  );
  
  // Slicing in loadProjects
  js = js.replace(
    /const filteredData = state\.projects\.filter\(p => \{/g,
    `const filteredDataAll = state.projects.filter(p => {`
  );
  js = js.replace(
    /container\.innerHTML = filteredData\.map\(p => `/g,
    `const itemsPerPage = 50;
    const totalPages = Math.ceil(filteredDataAll.length / itemsPerPage) || 1;
    const startIdx = (state.projPage - 1) * itemsPerPage;
    const filteredData = filteredDataAll.slice(startIdx, startIdx + itemsPerPage);
    
    container.innerHTML = filteredData.map(p => \``
  );
  js = js.replace(
    /<\/tbody>\n\s*<\/table>\n\s*<\/div>\n\s*`;\n\s*\}/g,
    `</tbody>\n          </table>\n        </div>\n      \`;\n    }\n    container.innerHTML += renderPaginationBar('projects', state.projPage, totalPages, 'changeProjPage');`
  );
  
  // Slicing in loadEnquiries
  js = js.replace(
    /tbody\.innerHTML = data\.map\(l => \{/g,
    `const itemsPerPage = 50;
    const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
    const startIdx = (state.leadsPage - 1) * itemsPerPage;
    const pagedData = data.slice(startIdx, startIdx + itemsPerPage);
    
    const pagWrapper = document.getElementById('enquiry-pagination-wrapper');
    if (pagWrapper) pagWrapper.innerHTML = renderPaginationBar('leads', state.leadsPage, totalPages, 'changeLeadsPage');
    
    tbody.innerHTML = pagedData.map(l => {`
  );
}

fs.writeFileSync('public/index.js', js);
