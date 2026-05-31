const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

const navLogic = `
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
  }
`;

// Find `function switchPage(pageId) {` and inject logic at the beginning
code = code.replace(/window\.switchPage = function\(pageId\) \{/, "window.switchPage = function(pageId) {\n" + navLogic);

fs.writeFileSync('public/index.js', code);
