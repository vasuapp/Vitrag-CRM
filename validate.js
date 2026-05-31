const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const { JSDOM } = require('jsdom');

try {
  const dom = new JSDOM(html);
  console.log("HTML parsing successful.");
  // Let's check how many .page elements are parsed properly inside #page-content-container
  const container = dom.window.document.getElementById('page-content-container');
  if (container) {
    const pages = container.querySelectorAll('.page');
    console.log("Found " + pages.length + " .page elements directly inside container.");
    pages.forEach(p => console.log(p.id));
  }
} catch(e) {
  console.error("Parse error", e);
}
