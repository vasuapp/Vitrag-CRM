const fs = require('fs');

// 1. Update CSS
let css = fs.readFileSync('public/index.css', 'utf8');
if (!css.includes('.inv-item { position: relative; }')) {
  css = css.replace(/\.inv-item \{/g, '.inv-item { position: relative;');
  css = css.replace(/\.card \{/g, '.card { position: relative;');
  fs.writeFileSync('public/index.css', css);
}

// 2. Update JS (Checkboxes on cards + toggleSelectAllButton)
let js = fs.readFileSync('public/index.js', 'utf8');

// Inject the toggleSelectAllButton function if not present
if (!js.includes('window.toggleSelectAllButton')) {
  js = js.replace(/window.toggleAllRowCheckboxes = function/g, `
window.toggleSelectAllButton = function(pane, btnElem) {
  const isSelected = btnElem.getAttribute('data-selected') === 'true';
  const newState = !isSelected;
  btnElem.setAttribute('data-selected', newState.toString());
  btnElem.innerHTML = newState ? '🔳 Deselect All' : '☑️ Select All';
  toggleAllRowCheckboxes(pane, newState);
};

window.toggleAllRowCheckboxes = function`);
}

// Replace resale card
js = js.replace(
  /<div class="inv-item" style="\$\{p\.is_stale \? 'border: 1\.5px solid var\(--red\) !important; background: rgba\(192, 57, 43, 0\.08\) !important;' : ''\}">/g,
  `<div class="inv-item" style="\${p.is_stale ? 'border: 1.5px solid var(--red) !important; background: rgba(192, 57, 43, 0.08) !important;' : ''}">\n        <div style="position: absolute; top: 12px; right: 12px; z-index: 10;"><input type="checkbox" class="row-checkbox-resale" value="\${p.id}" onchange="updateBulkSelectionState('resale')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()"></div>`
);

// Replace rental card
js = js.replace(
  /if \(state\.viewModes\.rental === 'card'\) \{\n\s*container\.innerHTML = slicedListings\.map\(p => `\n\s*<div class="inv-item">/g,
  `if (state.viewModes.rental === 'card') {\n    container.innerHTML = slicedListings.map(p => \`\n      <div class="inv-item">\n        <div style="position: absolute; top: 12px; right: 12px; z-index: 10;"><input type="checkbox" class="row-checkbox-rental" value="\${p.id}" onchange="updateBulkSelectionState('rental')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()"></div>`
);

// Replace commercial card
js = js.replace(
  /if \(state\.viewModes\.commercial === 'card'\) \{\n\s*container\.innerHTML = slicedListings\.map\(p => `\n\s*<div class="inv-item">/g,
  `if (state.viewModes.commercial === 'card') {\n    container.innerHTML = slicedListings.map(p => \`\n      <div class="inv-item">\n        <div style="position: absolute; top: 12px; right: 12px; z-index: 10;"><input type="checkbox" class="row-checkbox-commercial" value="\${p.id}" onchange="updateBulkSelectionState('commercial')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()"></div>`
);

// Replace projects card
js = js.replace(
  /<div class="card" style="background: linear-gradient\(135deg, rgba\(30, 42, 58, 0\.45\), rgba\(184, 134, 11, 0\.04\)\); cursor:pointer;" onclick="showProjectDetails\(\$\{p\.id\}\)">/g,
  `<div class="card" style="background: linear-gradient(135deg, rgba(30, 42, 58, 0.45), rgba(184, 134, 11, 0.04)); cursor:pointer;" onclick="showProjectDetails(\${p.id})">\n          <div style="position: absolute; top: 12px; right: 12px; z-index: 10;"><input type="checkbox" class="row-checkbox-projects" value="\${p.id}" onchange="updateBulkSelectionState('projects')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()"></div>`
);

fs.writeFileSync('public/index.js', js);

// 3. Update HTML buttons
let html = fs.readFileSync('public/index.html', 'utf8');

// Resale action bar
html = html.replace(
  /<button class="btn btn-ghost btn-sm active" id="toggle-resale-card"/g,
  `<button class="btn btn-primary btn-sm" style="background: var(--gold); border: none; margin-right: 10px;" onclick="toggleSelectAllButton('resale', this)">☑️ Select All</button>\n                    <button class="btn btn-ghost btn-sm active" id="toggle-resale-card"`
);

// Rental action bar
html = html.replace(
  /<button class="btn btn-ghost btn-sm active" id="toggle-rental-card"/g,
  `<button class="btn btn-primary btn-sm" style="background: var(--gold); border: none; margin-right: 10px;" onclick="toggleSelectAllButton('rental', this)">☑️ Select All</button>\n                    <button class="btn btn-ghost btn-sm active" id="toggle-rental-card"`
);

// Commercial action bar
html = html.replace(
  /<button class="btn btn-ghost btn-sm active" id="toggle-commercial-card"/g,
  `<button class="btn btn-primary btn-sm" style="background: var(--gold); border: none; margin-right: 10px;" onclick="toggleSelectAllButton('commercial', this)">☑️ Select All</button>\n                    <button class="btn btn-ghost btn-sm active" id="toggle-commercial-card"`
);

// Projects action bar
html = html.replace(
  /<button class="btn btn-ghost btn-sm active" id="toggle-projects-card"/g,
  `<button class="btn btn-primary btn-sm" style="background: var(--gold); border: none; margin-right: 10px;" onclick="toggleSelectAllButton('projects', this)">☑️ Select All</button>\n                  <button class="btn btn-ghost btn-sm active" id="toggle-projects-card"`
);

// Leads action bar
html = html.replace(
  /<button class="btn btn-ghost btn-sm" onclick="triggerImport\('leads'\)/g,
  `<button class="btn btn-primary btn-sm" style="background: var(--gold); border: none; margin-right: 10px;" onclick="toggleSelectAllButton('leads', this)">☑️ Select All</button>\n                  <button class="btn btn-ghost btn-sm" onclick="triggerImport('leads')"`
);

fs.writeFileSync('public/index.html', html);
