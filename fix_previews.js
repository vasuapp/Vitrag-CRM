const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

// Replace the Enquiries preview logic
const oldEnquiriesPreview = `      enquiriesPreview.innerHTML = enquiries.slice(0, 2).map(e => \`
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">• <strong>\${e.name}</strong> seeks \${e.project_type || '2 BHK'} in \${e.notes ? e.notes.split(',')[0].substring(0, 15) : 'Bangalore'}</div>
      \`).join('');`;
const newEnquiriesPreview = `      enquiriesPreview.innerHTML = enquiries.slice(0, 2).map(e => \`
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor:pointer;" onclick="event.stopPropagation(); showLeadDetails(\${e.id})">• <strong>\${e.name}</strong> seeks \${e.project_type || '2 BHK'} in \${e.notes ? e.notes.split(',')[0].substring(0, 15) : 'Bangalore'}</div>
      \`).join('');`;
code = code.replace(oldEnquiriesPreview, newEnquiriesPreview);

// Replace the Leads preview logic
const oldLeadsPreview = `      leadsPreview.innerHTML = activeLeads.slice(0, 2).map(l => \`
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">• <strong>\${l.name}</strong> - <span style="color:var(--gold-l); font-weight:600;">\${l.stage}</span></div>
      \`).join('');`;
const newLeadsPreview = `      leadsPreview.innerHTML = activeLeads.slice(0, 2).map(l => \`
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor:pointer;" onclick="event.stopPropagation(); showLeadDetails(\${l.id})">• <strong>\${l.name}</strong> - <span style="color:var(--gold-l); font-weight:600;">\${l.stage}</span></div>
      \`).join('');`;
code = code.replace(oldLeadsPreview, newLeadsPreview);

// Save back
fs.writeFileSync('public/index.js', code);
