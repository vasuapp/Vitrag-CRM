const fs = require('fs');
let file = fs.readFileSync('public/index.js', 'utf8');

// Fix submitAddListing
file = file.replace(/const editId = document\.getElementById\('edit-resale-id'\)\.value;\n\s*const url = editId \? `\/api\/properties\/\$\{editId\}\?force=\$\{reqForce\? 'true':'false'\}` : `\/api\/properties\?force=\$\{reqForce\? 'true':'false'\}`;\n\s*const method = editId \? 'PUT' : 'POST';\n\s*const res = await fetch\(url, \{\n\s*method: 'POST',/g, `const editId = document.getElementById('edit-resale-id').value;
    const url = editId ? \`/api/properties/\${editId}\` : \`/api/properties\`;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,`);

// Inside submitAddListing duplicate handler
file = file.replace(/const forceRes = await fetch\('\/api\/properties\?force=true', \{\n\s*method: 'POST',/g, `const forceRes = await fetch(editId ? \`/api/properties/\${editId}?force=true\` : '/api/properties?force=true', {
            method: method,`);

// submitAddRental duplicate handler
file = file.replace(/const forceRes = await fetch\('\/api\/properties\?force=true', \{\n\s*method: 'POST',\n\s*headers: \{ 'Content-Type': 'application\/json' \},\n\s*body: JSON.stringify\(data\)\n\s*\}\);\n\s*if \(forceRes\.ok\) \{\n\s*showToast\('Rental segment property listed \(Forced addition\)\.'\);/g, `const forceRes = await fetch(editId ? \`/api/properties/\${editId}?force=true\` : '/api/properties?force=true', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (forceRes.ok) {
            showToast(editId ? 'Rental segment property updated (Forced addition).' : 'Rental segment property listed (Forced addition).');`);

fs.writeFileSync('public/index.js', file);
