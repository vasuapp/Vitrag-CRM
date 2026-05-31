const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

const oldNav = `window.navToSegment = function(segment) {
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
};`;

const newNav = `window.navToSegment = function(segment) {
  if (segment === 'enquiries') navToPage('enquiry');
  else if (segment === 'pipeline') navToPage('pipeline');
  else if (segment === 'bookings') navToPage('commissions');
  else if (segment === 'campaigns') navToPage('analytics');
};`;

code = code.replace(oldNav, newNav);
fs.writeFileSync('public/index.js', code);
