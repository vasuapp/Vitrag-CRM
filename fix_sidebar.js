const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

// 1. Move Smart List
const smartListMatch = code.match(/(\s*<!-- SMART LIST COLLAPSIBLE MENU -->[\s\S]*?<\/details>\s*)\n\s*<div class="nav-item" data-page="daily">/);
if (smartListMatch) {
  const smartListBlock = smartListMatch[1];
  // Remove it from its current position
  code = code.replace(smartListBlock, '');
  
  // Insert it after <nav class="nav">
  code = code.replace('<nav class="nav">', '<nav class="nav">\n' + smartListBlock);
}

// 2. Change Lead Pipeline icon from ti-funnel to ti-timeline and ensure it looks prominent
code = code.replace(/<span class="icon"><i class="ti ti-funnel"><\/i><\/span><span>Lead Pipeline<\/span>/, '<span class="icon"><i class="ti ti-timeline"></i></span><span style="font-weight:700;">Lead Pipeline</span>');

fs.writeFileSync('public/index.html', code);
