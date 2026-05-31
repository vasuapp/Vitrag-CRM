const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

// 1. Add toggleSelectAllButton function
const toggleSelectAllLogic = `
window.toggleSelectAllButton = function(pane, btnElem) {
  const isSelected = btnElem.getAttribute('data-selected') === 'true';
  const newState = !isSelected;
  btnElem.setAttribute('data-selected', newState.toString());
  btnElem.innerHTML = newState ? '🔳 Deselect All' : '☑️ Select All';
  toggleAllRowCheckboxes(pane, newState);
};
`;

if (!code.includes('window.toggleSelectAllButton')) {
  code = code.replace(/window.toggleAllRowCheckboxes = function\(pane, checked\) {/, toggleSelectAllLogic + '\nwindow.toggleAllRowCheckboxes = function(pane, checked) {');
}

// 2. Add checkboxes to Inventory Resale Card View
code = code.replace(/<div class="inv-item" style="\$\{p.is_stale \? 'border: 1\.5px solid var\(--red\) !important; background: rgba\(192, 57, 43, 0\.08\) !important;' : ''\}">/g, 
  `<div class="inv-item" style="\${p.is_stale ? 'border: 1.5px solid var(--red) !important; background: rgba(192, 57, 43, 0.08) !important;' : ''}">\n        <div style="position: absolute; top: 12px; right: 12px; z-index: 10;"><input type="checkbox" class="row-checkbox-resale" value="\${p.id}" onchange="updateBulkSelectionState('resale')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()"></div>`);

// Wait, the row-checkbox class depends on the pane! In grid view render, properties is sliced, and the class is hardcoded?
// Ah! Let's check how Grid view is rendered. Is it specific to resale? No! It uses `row-checkbox-${pane}` but `pane` isn't available inside the map? Let's check the `renderProperties` code.
