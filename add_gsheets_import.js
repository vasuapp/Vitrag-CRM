const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

const logic = `
// ------------------------------------------
// GOOGLE SHEETS CLOUD IMPORT
// ------------------------------------------
window.importFromGoogleSheet = function() {
  const urlInput = document.getElementById('import-gsheets-url');
  const url = urlInput.value.trim();
  
  if (!url) {
    showToast('Please enter a Google Sheets URL.');
    return;
  }
  
  const match = url.match(/\\/d\\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    showToast('Invalid Google Sheets URL format. Make sure it contains /d/YOUR_ID');
    return;
  }
  
  const sheetId = match[1];
  const exportUrl = \`https://docs.google.com/spreadsheets/d/\${sheetId}/export?format=csv\`;
  
  showToast('Fetching data from Google Cloud...');
  
  Papa.parse(exportUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      if (!results.data || results.data.length === 0) {
        showToast('Sheet is empty or private. Please ensure "Anyone with the link can view" is enabled!');
        return;
      }
      showToast('Cloud data loaded successfully! Please map columns.');
      renderMappingUI(results.data, results.meta.fields);
    },
    error: function(err) {
      showToast('Error fetching sheet. Please ensure it is set to "Anyone with the link can view"!');
      console.error(err);
    }
  });
};
`;

code += '\n' + logic;
fs.writeFileSync('public/index.js', code);
