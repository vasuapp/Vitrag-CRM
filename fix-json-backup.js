const fs = require('fs');
let jsFile = fs.readFileSync('public/index.js', 'utf8');

const newBackup = `window.triggerDbBackup = async () => {
  try {
    showToast('Generating comprehensive backup... Please wait.', 'info');
    const endpoints = [
      '/api/leads', '/api/properties', '/api/associates', 
      '/api/projects', '/api/templates', '/api/team', '/api/commissions'
    ];
    
    const data = {};
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        const key = ep.split('/').pop();
        if (res.ok) {
          data[key] = await res.json();
        }
      } catch (e) {
        console.error('Failed to fetch ' + ep, e);
      }
    }
    
    data.exported_at = new Date().toISOString();
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "REALPro_Comprehensive_Backup.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Comprehensive JSON backup successfully generated.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error generating comprehensive backup', 'error');
  }
};`;

jsFile = jsFile.replace(/window\.triggerDbBackup = async \(\) => \{[\s\S]*?\n\};/m, newBackup);
fs.writeFileSync('public/index.js', jsFile);

let htmlFile = fs.readFileSync('public/index.html', 'utf8');
htmlFile = htmlFile.replace(/📦 Leads Backup/g, '📦 Comprehensive JSON Backup');
fs.writeFileSync('public/index.html', htmlFile);
