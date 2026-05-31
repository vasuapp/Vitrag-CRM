const fs = require('fs');
let css = fs.readFileSync('public/index.css', 'utf8');

const oldMobileCss = `  /* Shrink Modals to fit screen */
  .modal-content {
    width: 95% !important;
    margin: 10px auto !important;
    padding: 15px !important;
    max-height: 90vh !important;
    overflow-y: auto !important;
  }`;

const newMobileCss = `  /* Shrink Modals to fit screen */
  .modal {
    width: 95% !important;
    max-width: 100% !important; /* Overrides inline style max-width: 800px */
    margin: 10px auto !important;
    padding: 15px !important;
    max-height: 90vh !important;
    overflow-y: auto !important;
  }
  
  /* Fallback for unwrapped tables inside modals */
  .modal table, table.tbl, table.spreadsheet {
    display: block !important;
    width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }

  /* Grid stacking */
  .grid3, .grid4, .form-row {
    grid-template-columns: 1fr !important;
  }

  /* Scrollable tabs */
  .tabs, .nav-tabs {
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar, .nav-tabs::-webkit-scrollbar {
    display: none;
  }
  .tab {
    white-space: nowrap !important;
  }
  
  /* Topbar stacking */
  .topbar-actions {
    flex-wrap: wrap !important;
    gap: 8px !important;
  }`;

css = css.replace(oldMobileCss, newMobileCss);
fs.writeFileSync('public/index.css', css);
