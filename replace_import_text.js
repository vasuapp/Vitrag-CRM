const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace(/<button class="btn btn-ghost btn-sm" onclick="triggerImport\('properties'\)"><i class="ti ti-upload"><\/i> Import CSV<\/button>/g, '<button class="btn btn-ghost btn-sm" onclick="triggerImport(\'properties\')"><i class="ti ti-upload"></i> Import Dataset</button>');
html = html.replace(/<button class="btn btn-ghost btn-sm" onclick="triggerImport\('builder_projects'\)"><i class="ti ti-upload"><\/i> Import CSV<\/button>/g, '<button class="btn btn-ghost btn-sm" onclick="triggerImport(\'builder_projects\')"><i class="ti ti-upload"></i> Import Dataset</button>');
html = html.replace(/<button class="btn btn-ghost btn-sm" onclick="triggerImport\('leads'\)" style="padding: 4px 8px; font-size:11.5px;"><i class="ti ti-upload"><\/i> Import CSV<\/button>/g, '<button class="btn btn-ghost btn-sm" onclick="triggerImport(\'leads\')" style="padding: 4px 8px; font-size:11.5px;"><i class="ti ti-upload"></i> Import Dataset</button>');
fs.writeFileSync('public/index.html', html);
