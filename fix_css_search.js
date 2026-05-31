const fs = require('fs');
let css = fs.readFileSync('public/index.css', 'utf8');

const newCSS = `

/* ─── GLOBAL SEARCH DROPDOWN ─── */
.gs-result-item {
  padding: 10px 15px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gs-result-item:hover {
  background: rgba(184, 134, 11, 0.1);
  border-left: 3px solid var(--gold);
}
.gs-result-item:last-child {
  border-bottom: none;
}
.gs-category-header {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--gold-l);
  font-weight: 700;
  padding: 8px 15px;
  background: rgba(0,0,0,0.3);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

@media (max-width: 768px) {
  .topbar-search {
    margin: 10px 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    order: 3;
  }
}
`;

css += newCSS;
fs.writeFileSync('public/index.css', css);
