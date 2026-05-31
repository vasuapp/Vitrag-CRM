const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

// Replace the segment box onclicks
code = code.replace(/onclick="navToPage\('enquiry'\)"/g, 'onclick="navToSegment(\'enquiries\')"');
code = code.replace(/onclick="navToPage\('pipeline'\)"/g, 'onclick="navToSegment(\'pipeline\')"');
code = code.replace(/onclick="navToPage\('commissions'\)"/g, 'onclick="navToSegment(\'bookings\')"');
code = code.replace(/onclick="navToPage\('analytics'\)"/g, 'onclick="navToSegment(\'campaigns\')"');

fs.writeFileSync('public/index.html', code);
