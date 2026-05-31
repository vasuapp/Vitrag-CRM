const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

const additions = `
  <!-- Mobile Nav Toggle -->
  <button class="mobile-nav-toggle" id="mobile-nav-toggle" style="display: none;" onclick="document.getElementById('sidebar').classList.toggle('mobile-open')">
    <i class="ti ti-menu-2"></i> Menu
  </button>

  <!-- CSV Mapping Modal -->
  <div id="modal-csv-mapping" class="modal">
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h2 style="font-weight: 800; color: var(--gold); margin: 0; font-size: 18px;">Map CSV Columns</h2>
        <span class="close" onclick="closeModal('modal-csv-mapping')">&times;</span>
      </div>
      <div style="font-size: 13px; color: #a19d94; margin-bottom: 15px;">
        Map the columns from your uploaded CSV to the correct CRM database fields.
      </div>
      
      <div id="csv-mapping-container" style="display: flex; flex-direction: column; gap: 10px; max-height: 50vh; overflow-y: auto;">
        <!-- Dynamic mapping rows go here -->
      </div>
      
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button class="btn btn-ghost" onclick="closeModal('modal-csv-mapping')">Cancel</button>
        <button class="btn btn-primary" onclick="submitCsvMapping()">Confirm & Import</button>
      </div>
    </div>
  </div>

  <!-- Toast alerts -->
`;

code = code.replace('  <!-- Toast alerts -->', additions);
fs.writeFileSync('public/index.html', code);
