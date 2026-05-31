const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// Replace hydrated string
html = html.replace(
  '<div class="card-sub">Hydrated with all 155 real listings parsed from Vj Inventoory dataset</div>',
  '<div class="card-sub" id="inventory-count-display"></div>'
);

// Add enquiry pagination wrapper
if (!html.includes('id="enquiry-pagination-wrapper"')) {
  html = html.replace(
    '                  <tbody id="enquiry-log-list-container">\n                    <!-- Enquiries loaded here -->\n                  </tbody>\n                </table>\n              </div>',
    '                  <tbody id="enquiry-log-list-container">\n                    <!-- Enquiries loaded here -->\n                  </tbody>\n                </table>\n              </div>\n              <div id="enquiry-pagination-wrapper"></div>'
  );
}

fs.writeFileSync('public/index.html', html);
