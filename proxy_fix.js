const fs = require('fs');

// 1. Add proxy endpoint to server/index.js
let serverJs = fs.readFileSync('server/index.js', 'utf8');

const proxyEndpoint = `
// Proxy endpoint to bypass CORS for Google Sheets
app.post('/api/system/proxy-gsheet', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    // Dynamically import node-fetch if available, otherwise rely on native fetch
    let fetchFn;
    if (typeof fetch === 'undefined') {
      try {
        fetchFn = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      } catch(e) {
        throw new Error("Native fetch not supported and node-fetch not installed.");
      }
    } else {
      fetchFn = fetch;
    }

    const response = await fetchFn(url);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const text = await response.text();
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

if (!serverJs.includes('/api/system/proxy-gsheet')) {
  serverJs = serverJs.replace(
    /app\.use\('\/api', /g,
    proxyEndpoint + '\napp.use(\'/api\', '
  );
  if (!serverJs.includes('/api/system/proxy-gsheet')) {
      // If the above regex didn't match, just append right after app.use(express.json())
      serverJs = serverJs.replace(
        /app\.use\(express\.json\(\)\);/,
        "app.use(express.json());\n" + proxyEndpoint
      );
  }
  fs.writeFileSync('server/index.js', serverJs);
}

// 2. Update frontend index.js to use the proxy
let clientJs = fs.readFileSync('public/index.js', 'utf8');

if (clientJs.includes('Papa.parse(exportUrl')) {
  const replacement = `
  showToast('Fetching data from Google Cloud...');
  
  fetch('/api/system/proxy-gsheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: exportUrl })
  })
  .then(res => {
    if (!res.ok) throw new Error('Failed to proxy GSheet');
    return res.text();
  })
  .then(csvText => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (!results.data || results.data.length === 0) {
          showToast('No data found in the provided Google Sheet.');
          return;
        }
        
        csvHeaders = results.meta.fields || [];
        parsedCSVData = results.data;
        
        showToast('Google Sheet successfully parsed.');
        renderCSVMapping();
      },
      error: function(err) {
        console.error("Parse Error:", err);
        showToast('Error parsing Google Sheet data.');
      }
    });
  })
  .catch(err => {
    console.error("Proxy Error:", err);
    showToast('Error reaching Google Sheet. Ensure the link is public ("Anyone with the link can view").');
  });
  `;

  // Find the exact block to replace
  clientJs = clientJs.replace(/showToast\('Fetching data from Google Cloud\.\.\.'\);\s*Papa\.parse\(exportUrl, \{[\s\S]*?download: true,[\s\S]*?header: true,[\s\S]*?skipEmptyLines: true,[\s\S]*?complete: function\(results\) \{[\s\S]*?if \(!results\.data \|\| results\.data\.length === 0\) \{[\s\S]*?showToast\('No data found in the provided Google Sheet\.'\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?csvHeaders = results\.meta\.fields \|\| \[\];[\s\S]*?parsedCSVData = results\.data;[\s\S]*?showToast\('Google Sheet successfully parsed\.'\);[\s\S]*?renderCSVMapping\(\);[\s\S]*?\},[\s\S]*?error: function\(err\) \{[\s\S]*?console\.error\("Parse Error:", err\);[\s\S]*?showToast\('Error parsing Google Sheet data\.'\);[\s\S]*?\}[\s\S]*?\}\);/m, replacement);
  
  fs.writeFileSync('public/index.js', clientJs);
}

