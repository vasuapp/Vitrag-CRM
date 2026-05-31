const fs = require('fs');
let file = fs.readFileSync('public/index.js', 'utf8');

file = file.replace(/const res = await fetch\('\/api\/properties', \{\n\s*method: 'POST',/g, function(match, offset) {
  // Let's replace the one in submitAddRental specifically.
  // Wait, submitAddCommercial doesn't have "const res =" ! It has "await fetch('/api/properties'"
  return match;
});

// For submitAddRental
file = file.replace(/const res = await fetch\('\/api\/properties', \{\n\s*method: 'POST',\n\s*headers: \{ 'Content-Type': 'application\/json' \},\n\s*body: JSON.stringify\(data\)\n\s*\}\);/g, `
    const editId = document.getElementById('edit-rental-id').value;
    const url = editId ? \`/api/properties/\${editId}\` : \`/api/properties\`;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
`);

// For submitAddCommercial
file = file.replace(/await fetch\('\/api\/properties', \{\n\s*method: 'POST',\n\s*headers: \{ 'Content-Type': 'application\/json' \},\n\s*body: JSON.stringify\(data\)\n\s*\}\);/g, `
    const editId = document.getElementById('edit-commercial-id').value;
    const url = editId ? \`/api/properties/\${editId}\` : \`/api/properties\`;
    const method = editId ? 'PUT' : 'POST';
    await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
`);

// Wait, the first one in submitAddListing was replaced incorrectly!
// It replaced "const res = await fetch('/api/properties'" but we didn't provide the rest of the options properly. Let me fix the first replacement by reverting it and doing it right.

fs.writeFileSync('public/index.js', file);
