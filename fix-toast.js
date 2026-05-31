const fs = require('fs');
let file = fs.readFileSync('public/index.js', 'utf8');

file = file.replace(/showToast\('Commercial segment property listed successfully.'\);/g, `showToast(editId ? 'Commercial segment property updated successfully.' : 'Commercial segment property listed successfully.');`);
file = file.replace(/showToast\('Rental segment property listed successfully.'\);/g, `showToast(editId ? 'Rental segment property updated successfully.' : 'Rental segment property listed successfully.');`);
file = file.replace(/showToast\('Secondary market property listed successfully.'\);/g, `showToast(editId ? 'Secondary market property updated successfully.' : 'Secondary market property listed successfully.');`);

fs.writeFileSync('public/index.js', file);
