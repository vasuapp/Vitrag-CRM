// ==========================================
// REALPro CRM Frontend Controller (v3.0)
// ==========================================

// Automatically route relative API fetches to port 5001 if opened via Live Server or file protocol, while supporting Cloud URLs, Tunnels and Mobile network IPs
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string' && (input.startsWith('/api/') || input.startsWith('api/'))) {
      let apiBase = '';
      const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const isFileProtocol = window.location.protocol === 'file:';
      
      if ((isLocalHost || isFileProtocol) && window.location.port !== '5001') {
        apiBase = 'http://localhost:5001';
      }
      
      if (input.startsWith('api/')) {
        input = '/' + input;
      }
      input = apiBase + input;
      
      // Inject session header if session exists
      const session = localStorage.getItem('crm_active_member_session');
      if (session) {
        if (!init) init = {};
        if (!init.headers) init.headers = {};
        if (init.headers instanceof Headers) {
          init.headers.set('X-Agent-Session', session);
        } else {
          init.headers = { ...init.headers, 'X-Agent-Session': session };
        }
      }
    }
    return originalFetch(input, init);
  };
})();

window.getLocalNowStr = function() {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Number to Words Suggestion Engine for all numeric/price inputs
  document.body.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT') {
      const id = e.target.id || '';
      const className = e.target.className || '';
      const isNumber = e.target.type === 'number';
      const priceKeywords = ['price', 'deposit', 'maintenance', 'budget', 'value', 'payout', 'expenses', 'amount', 'rent'];
      const hasKeyword = priceKeywords.some(kw => id.toLowerCase().includes(kw) || className.toLowerCase().includes(kw));
      
      if (isNumber || hasKeyword) {
        const rawVal = e.target.value.trim();
        // If it contains letters (like "1.5 Cr"), don't auto-convert
        if (/[a-zA-Z]/.test(rawVal)) {
          let hintEl = e.target.parentNode.querySelector('.num-hint');
          if (hintEl) hintEl.innerText = '';
          return;
        }
        const val = parseFloat(rawVal);
        let hintEl = null;
        if (e.target.id === 'prop-price') hintEl = document.getElementById('prop-price-words');
        else if (e.target.id === 'rental-price') hintEl = document.getElementById('rental-price-words');
        else if (e.target.id === 'comm-price') hintEl = document.getElementById('comm-price-words');
        else if (e.target.id === 'inv-value') hintEl = document.getElementById('inv-value-words');
        else if (e.target.id === 'comm-value') hintEl = document.getElementById('comm-value-words');
        
        if (!hintEl) {
          hintEl = e.target.parentNode.querySelector('.num-hint');
          if (!hintEl) {
            hintEl = document.createElement('div');
            hintEl.className = 'num-hint';
            hintEl.style.fontSize = '11px';
            hintEl.style.color = 'var(--gold-l)';
            hintEl.style.fontWeight = '700';
            hintEl.style.marginTop = '4px';
            e.target.parentNode.insertBefore(hintEl, e.target.nextSibling);
          }
        }
        
        if (!isNaN(val) && val > 0) {
          let numericValue = val;
          if (id === 'filter-proj-price-min' || id === 'filter-proj-price-max') {
            numericValue = val * 10000000; // Convert Cr to raw Rupees
          }
          const shortForm = formatPriceToWords(numericValue);
          let wordsForm = '';
          try {
            if (typeof window.priceToWords === 'function') {
              wordsForm = window.priceToWords(Math.round(numericValue));
            }
          } catch (err) {}
          hintEl.innerText = wordsForm ? `💬 ${shortForm} (${wordsForm})` : `💬 ${shortForm}`;
        } else {
          hintEl.innerText = '';
        }
      }
    }
  });
});

function priceToWords(num) {
  if (num === 0 || num === '0') return 'Zero Rupees';
  const parsed = parseInt(num);
  if (isNaN(parsed) || parsed <= 0) return '';
  
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords100(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
  }

  function numToWords1000(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred) {
      res += a[hundred] + ' Hundred';
    }
    if (rest) {
      if (res) res += ' and ';
      res += numToWords100(rest);
    }
    return res;
  }

  let result = '';
  const crore = Math.floor(parsed / 10000000);
  let rem = parsed % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  
  if (crore) {
    result += numToWords1000(crore) + ' Crore ';
  }
  if (lakh) {
    result += numToWords1000(lakh) + ' Lakh ';
  }
  if (thousand) {
    result += numToWords1000(thousand) + ' Thousand ';
  }
  if (rem) {
    if (result && rem < 100) {
      result += 'and ';
    }
    result += numToWords1000(rem);
  }
  
  return result.trim() + ' Rupees Only';
}
window.priceToWords = priceToWords;

// App State Cache
let state = {
  projPage: 1,
  leadsPage: 1,
  rawLeadsPage: 1,
  activePage: 'dashboard',
  inventoryTab: 'resale',
  blueprintTab: 'leads',
  isAdmin: true,
  systemSettings: {
    userName: 'Vasu Jain',
    userRole: 'Owner / Admin',
    showMaskedFields: true
  },
  stats: {},
  todos: [],
  leads: [],
  properties: [],
  projects: [],
  associates: [],
  commissions: [],
  habits: [],
  propPages: { resale: 1, rental: 1, commercial: 1, land: 1 },
  projPage: 1,
  leadsPage: 1,
  assocPage: 1,
  columnConfig: (() => {
    const saved = localStorage.getItem('crm_column_config');
    const defaults = {
      resale: { bhk: true, size: true, price: true, mandate: true, interiors: true, facing: true, staging: true, zone: true, year: true, registration: true, carpark: true, possession: true },
      rental: { type: true, area: true, rent: true, deposit: true, maintenance: true, available: true, interiors: true, facing: true, zone: true },
      commercial: { type: true, available: true, area: true, price: true, deposit: true, maintenance: true, handover: true, zone: true, facing: true },
      land: { type: true, zoning: true, area: true, price: true, dimensions: true, facing: true, roadwidth: true, fsi: true },
      leads: { phone: true, source: true, stage: true, type: true, budget: true, followup: true, location: true, agent: true }
    };
    if (!saved) return defaults;
    try {
      const parsed = JSON.parse(saved);
      for (const tab in defaults) {
        if (!parsed[tab]) parsed[tab] = {};
        parsed[tab] = { ...defaults[tab], ...parsed[tab] };
      }
      return parsed;
    } catch (e) {
      return defaults;
    }
  })()
};

// Global Utilities
function formatPriceToWords(value) {
  if (value === 0 || value === '0') return '₹0';
  if (!value) return 'N/A';
  if (typeof value === 'string' && /[a-zA-Z₹]/.test(value)) {
    return value;
  }
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (num >= 10000000) {
    return '₹' + (num / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
  } else if (num >= 100000) {
    return '₹' + (num / 100000).toFixed(2).replace(/\.00$/, '') + ' L';
  } else if (num >= 1000) {
    return '₹' + (num / 1000).toFixed(2).replace(/\.00$/, '') + ' K';
  }
  return '₹' + num.toLocaleString('en-IN');
}

function toggleVillaFields(typeVal, formPrefix) {
  const isVilla = ['villa', 'row house', 'rowhouse', 'independent house', 'plot'].includes((typeVal || '').toLowerCase().trim());
  const villaRows = document.querySelectorAll(`.${formPrefix}-villa-only`);
  villaRows.forEach(el => {
    el.classList.toggle('hidden', !isVilla);
  });
}
window.toggleVillaFields = toggleVillaFields;

function changePropPage(tab, pageNum) {
  state.propPages[tab] = pageNum;
  loadProperties(true);
}
window.changePropPage = changePropPage;

function showCol(tab, colKey) {
  if (!state.columnConfig || !state.columnConfig[tab]) return true;
  return state.columnConfig[tab][colKey] !== false;
}
window.showCol = showCol;

window.toggleColumnDropdown = function(tab, event) {
  event.stopPropagation();
  let existing = document.getElementById('column-configurator-dropdown');
  if (existing) {
    existing.remove();
    return;
  }
  
  const columns = {
    resale: [
      { key: 'bhk', label: 'BHK' },
      { key: 'size', label: 'Size (Sqft)' },
      { key: 'price', label: 'Price' },
      { key: 'mandate', label: 'Mandate' },
      { key: 'interiors', label: 'Interiors' },
      { key: 'facing', label: 'Facing' },
      { key: 'staging', label: 'Staging' },
      { key: 'zone', label: 'Zone' },
      { key: 'year', label: 'Year Built' },
      { key: 'registration', label: 'Registration' },
      { key: 'carpark', label: 'Car Parking' },
      { key: 'possession', label: 'Possession' }
    ],
    rental: [
      { key: 'type', label: 'Property Type' },
      { key: 'area', label: 'Area' },
      { key: 'rent', label: 'Rent' },
      { key: 'deposit', label: 'Deposit' },
      { key: 'maintenance', label: 'Maintenance' },
      { key: 'available', label: 'Available From' },
      { key: 'interiors', label: 'Furnishing' },
      { key: 'facing', label: 'Facing' },
      { key: 'zone', label: 'Zone' }
    ],
    commercial: [
      { key: 'type', label: 'Property Type' },
      { key: 'available', label: 'Available For' },
      { key: 'area', label: 'Super Area' },
      { key: 'price', label: 'Rent / Price' },
      { key: 'deposit', label: 'Deposit' },
      { key: 'maintenance', label: 'Maintenance' },
      { key: 'handover', label: 'Handover' },
      { key: 'zone', label: 'Zone' },
      { key: 'facing', label: 'Facing' }
    ],
    land: [
      { key: 'type', label: 'Plot Type' },
      { key: 'zoning', label: 'Zoning' },
      { key: 'area', label: 'Area (Sqft)' },
      { key: 'price', label: 'Asking Price' },
      { key: 'dimensions', label: 'Dimensions' },
      { key: 'facing', label: 'Facing' },
      { key: 'roadwidth', label: 'Road Width' },
      { key: 'fsi', label: 'FSI Allowed' }
    ],
    leads: [
      { key: 'phone', label: 'Phone / Email' },
      { key: 'source', label: 'Source' },
      { key: 'stage', label: 'Pipeline Stage' },
      { key: 'type', label: 'Property Type' },
      { key: 'budget', label: 'Budget' },
      { key: 'followup', label: 'Next Follow-up' },
      { key: 'location', label: 'Location Pref' },
      { key: 'agent', label: 'Assigned Agent' }
    ]
  };

  const currentCols = columns[tab] || [];
  const dropdown = document.createElement('div');
  dropdown.id = 'column-configurator-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    background: #2c2c2c;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    z-index: 10000;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 160px;
  `;
  
  const rect = event.currentTarget.getBoundingClientRect();
  dropdown.style.top = (rect.bottom + window.scrollY + 5) + 'px';
  dropdown.style.left = (rect.left + window.scrollX) + 'px';
  
  dropdown.innerHTML = `
    <div style="font-weight:700; font-size:12px; color:var(--gold-l); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
      <span>Toggle Columns</span>
      <span style="cursor:pointer;" onclick="this.parentElement.parentElement.remove()">✕</span>
    </div>
  ` + currentCols.map(col => {
    const isChecked = state.columnConfig[tab][col.key] !== false;
    return `
      <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; color:var(--text-light);">
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleColumnOption('${tab}', '${col.key}', this.checked)">
        ${col.label}
      </label>
    `;
  }).join('');
  
  document.body.appendChild(dropdown);
  
  const closeHandler = (e) => {
    if (!dropdown.contains(e.target) && e.target !== event.currentTarget) {
      dropdown.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
};

window.toggleColumnOption = function(tab, colKey, checked) {
  if (!state.columnConfig) state.columnConfig = {};
  if (!state.columnConfig[tab]) state.columnConfig[tab] = {};
  state.columnConfig[tab][colKey] = checked;
  
  localStorage.setItem('crm_column_config', JSON.stringify(state.columnConfig));
  
  if (tab === 'leads') {
    if (typeof window.loadEnquiries === 'function') window.loadEnquiries();
  } else {
    loadProperties(true);
  }
};

window.changeProjPage = function(tab, pageNum) {
  state.projPage = pageNum;
  loadProjects();
};

window.changeLeadsPage = function(tab, pageNum) {
  state.leadsPage = pageNum;
  loadEnquiries();
};

window.changeAssocPage = function(tab, pageNum) {
  state.assocPage = pageNum;
  loadAssociates();
};


function renderPaginationBar(tab, currentPage, totalPages, handlerName = 'changePropPage') {
  if (totalPages < 1) totalPages = 1;
  return `
    <div class="pagination-bar" style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:20px; padding:10px 0; border-top:1px solid var(--border);">
      <button class="btn btn-ghost btn-sm" ${currentPage <= 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : `onclick="${handlerName}('${tab}', ${currentPage - 1})"`}>
        ← Prev
      </button>
      <span style="font-size:13px; color:var(--text-light);">Page <strong>${currentPage}</strong> of <strong>${totalPages}</strong></span>
      <button class="btn btn-ghost btn-sm" ${currentPage >= totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : `onclick="${handlerName}('${tab}', ${currentPage + 1})"`}>
        Next →
      </button>
    </div>
  `;
}


function showDuplicateModal(message, existingId, addAnywayFn) {
  const overlay = document.createElement('div');
  overlay.id = 'duplicate-blocker-modal';
  overlay.className = 'mbg';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85);
    display: flex; justify-content: center; align-items: center;
    z-index: 10000;
    backdrop-filter: blur(8px);
    transition: opacity 0.3s ease;
  `;

  const box = document.createElement('div');
  box.className = 'modal';
  box.style.cssText = `
    max-width: 500px;
    width: 90%;
    background: linear-gradient(135deg, #1E2A3A, #0f1722);
    border: 2px solid var(--gold);
    border-radius: var(--radius-md);
    padding: 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    text-align: center;
  `;

  box.innerHTML = `
    <div style="font-size: 48px; color: var(--gold-l); margin-bottom: 15px;">⚠️</div>
    <h3 style="color: var(--gold-l); margin-bottom: 12px; font-size: 18px; font-weight: 700;">Potential Duplicate Detected</h3>
    <p style="color: var(--text-light); font-size: 13.5px; line-height: 1.6; margin-bottom: 24px;">${message}</p>
    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
      <button class="btn btn-primary" id="dup-view-btn" style="background: var(--gold); border-color: var(--gold); color: #000; font-weight: 700;">
        🔍 View Existing
      </button>
      <button class="btn btn-ghost" id="dup-add-btn" style="color: var(--text-light); border: 1px solid var(--border);">
        ➕ Add Anyway
      </button>
      <button class="btn btn-ghost" id="dup-cancel-btn" style="color: var(--red); border: 1px solid rgba(192, 57, 43, 0.3);">
        Cancel
      </button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById('dup-view-btn').onclick = () => {
    document.body.removeChild(overlay);
    if (message.toLowerCase().includes('property')) {
      navToPage('inventory');
      setTimeout(() => {
        togglePrivateContact(existingId);
        const el = document.getElementById(`private-contact-${existingId}`) || document.getElementById(`private-contact-row-${existingId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    } else if (message.toLowerCase().includes('lead') || message.toLowerCase().includes('mobile')) {
      showLeadDetails(existingId);
    } else {
      showProjectDetails(existingId);
    }
  };

  document.getElementById('dup-add-btn').onclick = () => {
    document.body.removeChild(overlay);
    addAnywayFn();
  };

  document.getElementById('dup-cancel-btn').onclick = () => {
    document.body.removeChild(overlay);
  };
}
window.showDuplicateModal = showDuplicateModal;

// ------------------------------------------
// LOCK SCREEN PIN CODE OPERATIONS
// ------------------------------------------
(function() {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
      20%, 40%, 60%, 80% { transform: translateX(6px); }
    }
  `;
  document.head.appendChild(style);
})();

let lockState = {
  selectedAgentId: null,
  selectedAgentName: '',
  enteredPin: ''
};

window.showLockProfileSelect = function() {
  document.getElementById('lock-pin-entry-view').style.display = 'none';
  document.getElementById('lock-profile-select-view').style.display = 'flex';
  resetPinInput();
};

window.selectLockProfile = function(agentId, agentName) {
  lockState.selectedAgentId = agentId;
  lockState.selectedAgentName = agentName;
  document.getElementById('lock-selected-agent-name').innerText = agentName;
  document.getElementById('lock-profile-select-view').style.display = 'none';
  document.getElementById('lock-pin-entry-view').style.display = 'flex';
  resetPinInput();
};

window.pressPinDigit = function(digit) {
  if (lockState.enteredPin.length >= 4) return;
  lockState.enteredPin += String(digit);
  updatePinBullets();
};

window.clearLastPinDigit = function() {
  lockState.enteredPin = lockState.enteredPin.slice(0, -1);
  updatePinBullets();
};

window.resetPinInput = function() {
  lockState.enteredPin = '';
  updatePinBullets();
};

function updatePinBullets() {
  for (let i = 1; i <= 4; i++) {
    const bullet = document.getElementById(`pin-b${i}`);
    if (bullet) {
      if (lockState.enteredPin.length >= i) {
        bullet.style.background = 'var(--gold)';
        bullet.style.boxShadow = '0 0 8px var(--gold)';
      } else {
        bullet.style.background = 'transparent';
        bullet.style.boxShadow = 'none';
      }
    }
  }
}

async function verifyTeamLockPin() {
  const pin = lockState.enteredPin;
  const agentId = lockState.selectedAgentId;
  if (!agentId) {
    showToast('Please select a profile first.', 'warning');
    return;
  }
  if (pin.length !== 4) {
    showToast('Please enter the complete 4-digit PIN.', 'warning');
    return;
  }
  
  try {
    const res = await fetch('/api/team/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, pin: pin })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Welcome back, ${data.agent.name}!`, 'success');
      state.currentUser = data.agent;
      localStorage.setItem('crm_active_member_session', JSON.stringify(data.agent));
      sessionStorage.setItem('crm_session_active', 'true');
      
      applyAuthenticatedPermissions(data.agent);
      autoClock('IN');
      
      const lockScreen = document.getElementById('crm-lock-screen');
      if (lockScreen) {
        lockScreen.style.transition = 'opacity 0.4s ease, visibility 0.4s';
        lockScreen.style.opacity = '0';
        setTimeout(() => {
          lockScreen.style.visibility = 'hidden';
          lockScreen.style.display = 'none';
        }, 400);
      }

      // Restore active page or default to dashboard
      const savedPage = localStorage.getItem('crm_active_page') || 'dashboard';
      navToPage(savedPage);
    } else {
      const panel = document.getElementById('lock-panel');
      if (panel) {
        panel.style.animation = 'shake 0.4s ease';
      }
      showToast(data.error || 'Invalid 4-digit PIN code.', 'error');
      setTimeout(() => {
        if (panel) panel.style.animation = '';
        resetPinInput();
      }, 400);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to authenticate with server.', 'error');
    resetPinInput();
  }
}

window.secureLockSession = function() {
  if (state.currentUser && state.currentUser.id) {
    const agentId = state.currentUser.id;
    fetch('/api/attendance/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, action: 'OUT' })
    }).then(res => res.json()).then(data => {
      localStorage.setItem('clock_state', 'OUT');
      updateClockUI('OUT');
    }).catch(e => console.error("Secure lock clock out failed:", e));
  }

  state.currentUser = null;
  localStorage.removeItem('crm_active_member_session');
  localStorage.removeItem('crm_active_page');
  sessionStorage.removeItem('crm_session_active');
  resetPinInput();
  showLockProfileSelect();
  
  // Clear sidebar details to placeholder locked state
  const uName = document.getElementById('user-name');
  if (uName) uName.innerText = 'Session Locked';
  const uRole = document.getElementById('user-role');
  if (uRole) uRole.innerText = 'Select Profile';
  const uAv = document.getElementById('user-av');
  if (uAv) uAv.innerText = '??';
  
  const lockScreen = document.getElementById('crm-lock-screen');
  if (lockScreen) {
    lockScreen.style.display = 'flex';
    lockScreen.style.visibility = 'visible';
    lockScreen.style.opacity = '1';
  }
  loadLockScreenProfiles();
};

async function loadLockScreenProfiles() {
  try {
    const res = await fetch('/api/team/profiles');
    const profiles = await res.json();
    const listContainer = document.getElementById('lock-profiles-list');
    if (!listContainer) return;
    
    if (profiles.length === 0) {
      listContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 20px;">No operational profiles seeded.</div>`;
      return;
    }
    
    listContainer.innerHTML = profiles.map(p => `
      <div class="lock-profile-item" onclick="selectLockProfile(${p.id}, '${p.name.replace(/'/g, "\\'")}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s ease; text-align: left; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #1e1b15 0%, #302610 100%); border: 1px solid rgba(212, 175, 55, 0.4); display: flex; align-items: center; justify-content: center; color: var(--gold); font-size: 13px; font-weight: 700;">
            ${p.name.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div style="font-size: 14.5px; font-weight: 700; color: var(--text-light);">${p.name}</div>
            <div style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-top: 1px;">${p.role}</div>
          </div>
        </div>
        <i class="ti ti-chevron-right" style="color: var(--text-muted); font-size: 16px;"></i>
      </div>
    `).join('');
    
    const items = listContainer.querySelectorAll('.lock-profile-item');
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(212, 175, 55, 0.1)';
        item.style.borderColor = 'rgba(212, 175, 55, 0.35)';
        item.style.transform = 'translateY(-1px)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'rgba(255,255,255,0.03)';
        item.style.borderColor = 'rgba(255,255,255,0.05)';
        item.style.transform = 'none';
      });
    });
  } catch (err) {
    console.error(err);
    const listContainer = document.getElementById('lock-profiles-list');
    if (listContainer) {
      listContainer.innerHTML = `<div style="color: var(--red); font-size: 12px; padding: 20px;">Failed to load profiles. Please refresh the page or make sure the server is running.</div>`;
    }
  }
}

function applyAuthenticatedPermissions(user) {
  if (!user) return;
  
  document.getElementById('user-name').innerText = user.name;
  document.getElementById('user-role').innerText = user.role;
  document.getElementById('user-av').innerText = user.name.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase();
  
  state.currentUser = user;
  state.isAdmin = (user.role === 'Admin');
  
  // Hide Admin/Employee Mode toggle for standard agents/employees
  const adminToggleBtn = document.getElementById('btn-admin-toggle');
  if (adminToggleBtn) {
    adminToggleBtn.style.display = (user.role === 'Admin') ? '' : 'none';
  }
  
  if (state.systemSettings) {
    state.systemSettings.userName = user.name;
    state.systemSettings.userRole = user.role;
    state.systemSettings.showMaskedFields = (user.role === 'Admin');
  }
  
  let allowed = [];
  if (user.allowed_pages === '*') {
    allowed = ['*'];
  } else if (Array.isArray(user.allowed_pages)) {
    allowed = user.allowed_pages;
  } else {
    try {
      allowed = JSON.parse(user.allowed_pages || '[]');
    } catch(e) {
      allowed = [];
    }
  }
  
  // Show/Hide Smart List details wrapper based on permission checklist
  const smartListWrapper = document.querySelector('.sidebar-smartlist-details');
  if (smartListWrapper) {
    const hasSmartList = allowed.includes('*') || allowed.includes('smartlist');
    smartListWrapper.style.display = hasSmartList ? '' : 'none';
  }
  
  const sbItems = document.querySelectorAll('.nav-item');
  sbItems.forEach(item => {
    const pageId = item.getAttribute('data-page');
    if (!pageId) {
      // Always show Lock/Logout so employees can switch accounts or secure session
      // and always show Smart List summaries/menus
      if (
        item.getAttribute('onclick')?.includes('secureLockSession') || 
        item.innerText.toLowerCase().includes('lock') || 
        item.innerText.toLowerCase().includes('logout') ||
        item.tagName === 'SUMMARY' ||
        item.innerText.toLowerCase().includes('smart list')
      ) {
        item.classList.remove('hidden');
        item.style.display = '';
      } else {
        item.classList.add('hidden');
        item.style.display = 'none';
      }
    } else if (allowed.includes('*') || allowed.includes(pageId)) {
      item.classList.remove('hidden');
      item.style.display = '';
    } else {
      item.classList.add('hidden');
      item.style.display = 'none';
    }
  });
}

// ------------------------------------------
// 1. APP INITIALIZATION & SPA ROUTING
// ------------------------------------------
async function initApp() {
  // Session check on Startup
  const cachedSession = localStorage.getItem('crm_active_member_session');
  const sessionActive = sessionStorage.getItem('crm_session_active');
  if (cachedSession && sessionActive) {
    try {
      const user = JSON.parse(cachedSession);
      state.currentUser = user;
      applyAuthenticatedPermissions(user);
      autoClock('IN');
      
      const lockScreen = document.getElementById('crm-lock-screen');
      if (lockScreen) {
        lockScreen.style.display = 'none';
        lockScreen.style.visibility = 'hidden';
        lockScreen.style.opacity = '0';
      }

      // Restore active page on refresh
      const savedPage = localStorage.getItem('crm_active_page') || 'dashboard';
      navToPage(savedPage);
    } catch (e) {
      console.error("Failed to parse cached session:", e);
      secureLockSession();
    }
  } else {
    secureLockSession();
  }
  // Check if running on local file:// protocol which throws CORS blocks
  if (window.location.protocol === 'file:') {
    const banner = document.createElement('div');
    banner.style = 'background: #b91c1c; color: #ffffff; padding: 12px; text-align: center; font-size: 13px; font-weight: 700; font-family: "Outfit", sans-serif; position: sticky; top: 0; z-index: 99999; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; gap: 8px; line-height: 1.4;';
    banner.innerHTML = `
      <i class="ti ti-alert-triangle" style="font-size: 16px;"></i>
      <span>Local File Sandbox Block: You have opened the CRM via a local file link (file://). Browsers block database CORS queries by default. To load, save, print, or edit invoices successfully, navigate directly to <strong><a href="http://localhost:5001" target="_blank" style="color: #fef08a; text-decoration: underline;">http://localhost:5001</a></strong> in your web browser!</span>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    showToast('Opened via file:// origin. Navigate to http://localhost:5001 to enable Invoices.', 'warning');
  }

  window.refreshActivePageData = function() {
    const page = state.activePage;
    if (page === 'inventory') {
      if (typeof loadProperties === 'function') loadProperties();
    } else if (page === 'projects') {
      if (typeof loadProjects === 'function') loadProjects();
    } else if (page === 'pipeline') {
      if (typeof loadPipeline === 'function') loadPipeline();
    } else if (page === 'enquiry') {
      if (typeof loadEnquiries === 'function') loadEnquiries();
    } else if (page === 'raw-leads') {
      if (typeof loadRawLeads === 'function') loadRawLeads();
    } else if (page === 'associates') {
      if (typeof loadAssociates === 'function') loadAssociates();
    } else if (page === 'templates') {
      if (typeof loadTemplates === 'function') loadTemplates();
    } else if (page === 'reports') {
      if (typeof loadAdminReportsPage === 'function') loadAdminReportsPage();
    }
    if (typeof loadDashboardData === 'function') loadDashboardData();
    if (typeof loadFollowups === 'function') loadFollowups();
    if (typeof updateRawLeadsCountBadge === 'function') updateRawLeadsCountBadge();
  };

  // Initialize selection rows cache
  state.selectedRowIds = {
    resale: [],
    rental: [],
    commercial: [],
    projects: [],
    leads: [],
    'raw-leads': []
  };

  setupSidebarNavigation();
  setupGlobalSearch();
  setupScratchpadAutosave();
  
  // Register Property search input filter listener
  const propSearch = document.getElementById('filter-prop-search');
  if (propSearch) propSearch.addEventListener('input', () => loadProperties());

  // Register Enquiry filter listeners
  const enquirySearch = document.getElementById('filter-enquiry-search');
  const enquiryTemp = document.getElementById('filter-enquiry-temp');
  if (enquirySearch) enquirySearch.addEventListener('input', () => loadEnquiries());
  if (enquiryTemp) enquiryTemp.addEventListener('change', () => loadEnquiries());

  // Fetch initial System Settings to get role details
  try {
    await loadSystemSettings();
  } catch (e) { console.error('loadSystemSettings failed', e); }
  
  // Request browser push notification permission
  if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().catch(err => console.error('[Notification] Permission error:', err));
    }
  }

  // Setup background alerts sweep for overdue callbacks (every 60 seconds)
  setInterval(checkOverdueFollowupNotifications, 60000);
  
  // Auto-refresh active page data to prevent stale views across the CRM (every 30 seconds)
  setInterval(() => {
    if (window.refreshActivePageData) {
      window.refreshActivePageData();
    }
  }, 30000);
  
  // Fetch initial Associates directory to ensure linking selects work on listings load
  try {
    const res = await fetch('/api/associates');
    state.associates = await res.json();
  } catch (err) {
    console.error(err);
  }

  // Populate dynamic dropdown selects
  try {
    initDropdownOptionsConfig();
  } catch (e) { console.error('initDropdownOptionsConfig failed', e); }

  // Populate dynamic agent dropdown selects
  try {
    await populateAllAgentSelects();
  } catch (e) { console.error('populateAllAgentSelects failed', e); }

  try {
    await updateRawLeadsCountBadge();
  } catch (e) { console.error('updateRawLeadsCountBadge failed', e); }

  // Dynamic inline add custom dropdown change event listener
  document.body.addEventListener('change', function(e) {
    if (e.target && e.target.tagName === 'SELECT' && e.target.value === '__ADD_CUSTOM__') {
      const el = e.target;
      let category = '';
      if (el.id === 'lead-source') category = 'leadSources';
      else if (el.id === 'prop-source' || el.id === 'rental-source' || el.id === 'comm-source') category = 'propertySources';
      else if (el.id === 'lead-type' || el.id === 'prop-type' || el.id === 'filter-prop-type') category = 'propertyTypes';
      else if (el.id === 'prop-mandate' || el.id === 'filter-prop-mandate') category = 'mandateTypes';
      else if (el.id === 'prop-status') category = 'statusTypes';
      else if (el.id === 'prop-interiors' || el.id === 'filter-prop-interiors') category = 'interiorsTypes';

      if (!category) {
        showToast('Custom options not supported for this dropdown.');
        el.value = el.options[0]?.value || '';
        return;
      }

      const newVal = prompt('Enter the name for the new custom option:');
      if (newVal && newVal.trim()) {
        saveCustomDropdownValue(category, newVal.trim());
        el.value = newVal.trim();
        showToast(`Added custom option "${newVal.trim()}" successfully.`);
      } else {
        el.value = el.options[0]?.value || '';
      }
    }
  });

  // Load core dashboard data
  loadDashboardData();
  loadProperties(); // Pre-load properties for auto-population
  
  // Hydrate Phase C Modules
  try { initClockStatus(); } catch(e){}
  try { loadTeamRoster(); } catch(e){}
  loadRemindersPanel();
  loadDailyOperationsReport();

  // 60-second auto-refresh for active pages
  setInterval(() => {
    if (document.hidden) return;
    if (state.activePage === 'inventory') {
      try { loadProperties(); } catch(e){}
    } else if (state.activePage === 'projects') {
      try { loadProjects(); } catch(e){}
    } else if (state.activePage === 'pipeline') {
      try { loadPipeline(); } catch(e){}
    }
  }, 60000);

  // Tab focus visibilitychange trigger
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (state.activePage === 'inventory') {
        try { loadProperties(); } catch(e){}
      } else if (state.activePage === 'projects') {
        try { loadProjects(); } catch(e){}
      } else if (state.activePage === 'pipeline') {
        try { loadPipeline(); } catch(e){}
      }
    }
  });
}

function setupSidebarNavigation() {
  const sbItems = document.querySelectorAll('.nav-item');
  sbItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page');
      if (pageId) {
        window.navToPage(pageId);
      }
    });
  });

  // Hover & Collapse behaviors for details elements inside the sidebar
  document.querySelectorAll('.sidebar details').forEach(details => {
    // Prevent details elements inside the sidebar from closing when collapsed in rail mode
    details.addEventListener('click', (e) => {
      const isCollapsed = document.querySelector('.sidebar')?.classList.contains('locked-collapsed') || (window.innerWidth > 768 && window.innerWidth <= 992);
      if (isCollapsed && (e.target.tagName === 'SUMMARY' || e.target.closest('summary'))) {
        e.preventDefault();
      }
    });

    // Hover to open (only on desktop and when not in collapsed rail mode)
    details.addEventListener('mouseenter', () => {
      const isCollapsed = document.querySelector('.sidebar')?.classList.contains('locked-collapsed') || (window.innerWidth > 768 && window.innerWidth <= 992);
      const isMobile = window.innerWidth <= 768;
      if (!isCollapsed && !isMobile) {
        details.open = true;
      }
    });

    // Leave to collapse (only on desktop and when not in collapsed rail mode)
    details.addEventListener('mouseleave', () => {
      const isCollapsed = document.querySelector('.sidebar')?.classList.contains('locked-collapsed') || (window.innerWidth > 768 && window.innerWidth <= 992);
      const isMobile = window.innerWidth <= 768;
      if (!isCollapsed && !isMobile) {
        details.open = false;
      }
    });

    // Prevent summary click from toggling the category close on hover-click on desktop
    details.querySelector('summary')?.addEventListener('click', (e) => {
      const isCollapsed = document.querySelector('.sidebar')?.classList.contains('locked-collapsed') || (window.innerWidth > 768 && window.innerWidth <= 992);
      const isMobile = window.innerWidth <= 768;
      if (!isCollapsed && !isMobile) {
        e.preventDefault();
      }
    });
  });
}

function navToPage(pageId, subTabId) {
  // Authentication check
  if (!state.currentUser) {
    secureLockSession();
    return;
  }

  // Redirection checks
  if (pageId === 'followups') {
    navToPage('pipeline', 'followups');
    return;
  }
  if (pageId === 'duplicates-audit') {
    navToPage('enquiry', 'audit');
    return;
  }

  // Admin simulated view mode guard
  const isAdminView = !state.systemSettings || state.systemSettings.showMaskedFields;
  const targetNavItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (targetNavItem && targetNavItem.classList.contains('admin-only-field') && !isAdminView) {
    showToast(`⚠️ Access Denied: Admin Mode required to access the ${pageId} page.`, 'warning');
    return;
  }

  // Navigation Guards based on agent permission profile
  const user = state.currentUser;
  let allowed = [];
  if (user.allowed_pages === '*') {
    allowed = ['*'];
  } else if (Array.isArray(user.allowed_pages)) {
    allowed = user.allowed_pages;
  } else {
    try {
      allowed = JSON.parse(user.allowed_pages || '[]');
    } catch(e) {
      allowed = [];
    }
  }

  const isAllowed = allowed.includes('*') || allowed.includes(pageId);
  if (!isAllowed) {
    showToast(`⚠️ Access Denied: Your profile does not have permission to view the ${pageId} tab.`, 'warning');
    return;
  }

  state.activePage = pageId;
  localStorage.setItem('crm_active_page', pageId);
  
  // Update active sidebar item
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (activeItem) activeItem.classList.add('active');

  // Update active screen view
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) targetPage.classList.add('active');

  // Close mobile sidebar if open
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');

  // Dynamic Header Title
  const titles = {
    dashboard: 'Command Dashboard',
    daily: 'Daily OS',
    inventory: 'Inventory',
    projects: 'Builder Projects',
    associates: 'Associate Directory',
    pipeline: 'Lead Pipeline',
    capture: 'Capture Form',
    followups: 'Overdue Reminders',
    enquiry: 'Enquiry Log',
    commissions: 'Commissions Register',
    analytics: 'Analytics Metrics',
    blueprint: 'Systems Blueprint',
    sops: 'Standard SOPs',
    habits: 'Habits Scorecard',
    scale: 'Automation Studio',
    proposals: 'Proposal Builder',
    settings: 'System Settings',
    team: 'Team Roster',
    finance: 'Finance Ledger',
    invoices: 'Tax Invoices',
    social: 'Social Campaigns',
    reports: 'Performance Reports',
    documents: 'Document Vault',
    'duplicates-audit': 'Duplicates Review Audit',
    'raw-leads': 'Raw Leads Directory'
  };
  document.getElementById('page-header-title').innerText = titles[pageId] || 'REALPro CRM';

  // Load specific page data
  if (pageId === 'dashboard') loadDashboardData();
  else if (pageId === 'daily') loadDailyOS();
  else if (pageId === 'inventory') loadProperties();
  else if (pageId === 'projects') loadProjects();
  else if (pageId === 'associates') loadAssociates();
  else if (pageId === 'pipeline') {
    if (subTabId === 'followups') {
      if (typeof window.switchPipelineTab === 'function') {
        window.switchPipelineTab('followups');
      }
    } else {
      if (typeof window.switchPipelineTab === 'function') {
        window.switchPipelineTab('board');
      }
      loadPipeline();
    }
  }
  else if (pageId === 'enquiry') {
    if (subTabId === 'audit') {
      if (typeof window.switchEnquiryTab === 'function') {
        window.switchEnquiryTab('audit');
      }
    } else if (subTabId === 'dup') {
      if (typeof window.switchEnquiryTab === 'function') {
        window.switchEnquiryTab('dup');
      }
    } else {
      if (typeof window.switchEnquiryTab === 'function') {
        window.switchEnquiryTab('main');
      }
      loadEnquiries();
    }
  }
  else if (pageId === 'commissions') loadCommissions();
  else if (pageId === 'blueprint') switchBlueprintTab('leads');
  else if (pageId === 'habits') loadHabitsGrid();
  else if (pageId === 'scale') loadAutomationData();
  else if (pageId === 'proposals') loadProposalsConsole();
  else if (pageId === 'team') { loadTeamRoster(); loadTeamAttendanceLogs(); }
  else if (pageId === 'finance') loadFinanceLedger();
  else if (pageId === 'invoices') loadInvoices();
  else if (pageId === 'social') loadSocialHub();
  else if (pageId === 'sops') loadSOPs();
  else if (pageId === 'templates') loadTemplates();
  else if (pageId === 'reports') loadAdminReportsPage();
  else if (pageId === 'documents') { loadDocuments(); loadVaultRefDropdown(); }
  else if (pageId === 'analytics') {
    if (typeof loadTelephonyAnalytics === 'function') loadTelephonyAnalytics();
    if (typeof loadGTMAnalyticsDashboard === 'function') loadGTMAnalyticsDashboard();
  }
  else if (pageId === 'raw-leads') {
    loadRawLeads();
  }
}

// ------------------------------------------
// 2. DASHBOARD & STATS API HANDLERS
// ------------------------------------------

// === DYNAMIC DASHBOARD CHARTS & ROUTING ===

window.navToSegment = function(segment) {
  if (segment === 'enquiries') navToPage('enquiry');
  else if (segment === 'pipeline') navToPage('pipeline');
  else if (segment === 'bookings') navToPage('commissions');
  else if (segment === 'campaigns') navToPage('analytics');
};

window.routeToSource = function(sourceName) {
  navToPage('pipeline');
  setTimeout(() => {
    if (document.getElementById('pipe-source-filter')) {
      document.getElementById('pipe-source-filter').value = sourceName;
      if (typeof filterPipeline === 'function') filterPipeline();
    }
  }, 500);
};

window.routeToStage = function(stageName) {
  navToPage('pipeline');
  setTimeout(() => {
    if (document.getElementById('pipe-status-filter')) {
      document.getElementById('pipe-status-filter').value = stageName;
      if (typeof filterPipeline === 'function') filterPipeline();
    }
  }, 500);
};

window.renderDynamicCharts = async function() {
  try {
    const res = await fetch('/api/reports/analytics');
    const data = await res.json();
    
    // Render Source Breakdown
    if (data.sources && document.getElementById('chart-source-breakdown')) {
      const colors = ['var(--gold)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--amber)', 'var(--slate-light)'];
      let maxCount = Math.max(...data.sources.map(s => parseInt(s.count))) || 1;
      
      let html = '';
      data.sources.forEach((s, idx) => {
        let height = Math.max(15, (parseInt(s.count) / maxCount) * 80);
        let color = colors[idx % colors.length];
        html += `<div class="chart-bar-wrap" style="cursor:pointer;" onclick="routeToSource('${s.source}')">
                   <div class="chart-bar" style="height:${height}px; background:${color}" title="${s.count} leads"></div>
                   <div class="chart-label">${s.source || 'Other'}</div>
                 </div>`;
      });
      if (!html) html = '<div style="color:var(--text-secondary); font-size:12px; margin-top:20px;">No source data available</div>';
      document.getElementById('chart-source-breakdown').innerHTML = html;
    }

    // Render Pipeline Health
    if (data.stages && document.getElementById('chart-pipeline-health')) {
       const stageOrder = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
       const colors = ['var(--slate-light)', 'var(--blue)', 'var(--amber)', 'var(--purple)', 'var(--green)', 'var(--red)'];
       let maxStageCount = Math.max(...Object.values(data.stages).map(c => parseInt(c))) || 1;
       
       let html = '';
       stageOrder.forEach((stage, idx) => {
         let count = data.stages[stage] || 0;
         let height = Math.max(15, (count / maxStageCount) * 80);
         html += `<div class="chart-bar-wrap" style="cursor:pointer;" onclick="routeToStage('${stage}')">
                    <div class="chart-bar" style="height:${height}px; background:${colors[idx]}" title="${count} leads"></div>
                    <div class="chart-label">${stage}</div>
                  </div>`;
       });
       document.getElementById('chart-pipeline-health').innerHTML = html;
       // Link header
       const pipelineCardTitle = document.getElementById('chart-pipeline-health').parentElement.querySelector('.card-title');
       if (pipelineCardTitle && !pipelineCardTitle.hasAttribute('data-linked')) {
           pipelineCardTitle.setAttribute('data-linked', 'true');
           pipelineCardTitle.style.cursor = 'pointer';
           pipelineCardTitle.onclick = () => navToPage('pipeline');
       }
    }
  } catch(e) { console.error('Failed to load dynamic charts', e); }
};

window.loadAdminReport = async function() {
  try {
    const tf = document.getElementById('admin-timeframe').value;
    const res = await fetch(`/api/dashboard/admin-report?timeframe=${tf}`);
    const data = await res.json();
    
    document.getElementById('report-leads-today').innerText = data.leadsToday || 0;
    document.getElementById('report-active-visits').innerText = data.activeSiteVisits || 0;
    document.getElementById('report-total-calls').innerText = data.totalCalls || 0;
    document.getElementById('report-total-props').innerText = data.activeProps || 0;
  } catch(e) { console.error('Failed to load admin report', e); }
};

async function loadDashboardData() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();
    state.stats = data;

    // Update Dashboard UI counters
    document.getElementById('dash-total-leads').innerText = data.totalLeads;
    document.getElementById('dash-active-listings').innerText = data.activeListings;
    document.getElementById('dash-due-followups').innerText = data.dueFollowups;

    // Update Topbar badge notifications
    document.getElementById('badge-hot').innerText = `${data.hotLeads} Hot Leads`;
    document.getElementById('badge-due').innerText = `${data.dueFollowups} Follow-ups Due`;
    document.getElementById('badge-listings').innerText = `${data.activeListings} Active Listings`;

    // Sidebar counts
    document.getElementById('sidebar-inv-count').innerText = data.activeListings;
    document.getElementById('sidebar-fu-count').innerText = data.dueFollowups;

    // Pipeline health staging metrics
    document.getElementById('dash-health-hot').innerText = data.hotLeads;
    document.getElementById('dash-health-warm').innerText = data.totalLeads - data.hotLeads;
    document.getElementById('dash-health-cold').innerText = Math.max(0, data.totalLeads - data.hotLeads - 3);

    // Update Bottom Ribbon counters
    if (document.getElementById('ribbon-hot-count')) {
      document.getElementById('ribbon-hot-count').innerText = data.hotLeads;
      document.getElementById('ribbon-due-count').innerText = data.dueFollowups;
    }
    if (document.getElementById('ribbon-touch-calls')) {
      document.getElementById('ribbon-touch-calls').innerText = data.touchpoints.calls;
      document.getElementById('ribbon-touch-chats').innerText = data.touchpoints.chats;
      document.getElementById('ribbon-touch-visits').innerText = data.touchpoints.visits;
      document.getElementById('ribbon-touch-emails').innerText = data.touchpoints.emails;
    }

    // Update Topbar touchpoint badges
    if (document.getElementById('top-touch-calls')) {
      document.getElementById('top-touch-calls').innerHTML = `📞 Calls: <strong>${data.touchpoints.calls}</strong>`;
      document.getElementById('top-touch-chats').innerHTML = `💬 Chats: <strong>${data.touchpoints.chats}</strong>`;
      document.getElementById('top-touch-visits').innerHTML = `🚗 Visits: <strong>${data.touchpoints.visits}</strong>`;
      document.getElementById('top-touch-emails').innerHTML = `✉️ Mails: <strong>${data.touchpoints.emails}</strong>`;
    }

    // Load todos, scratchpad, calendar, timelines, and segment previews
    loadTodos();
    loadScratchpad();
    renderCalendar();
    renderPropertyTimelines();
    hydrateSegmentPreviews();
    loadTodayActivityFeed();
    renderDynamicCharts();
    loadAdminReport();
    loadRentalRenewalsFeed();
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
  }
}

async function loadTodos() {
  try {
    const res = await fetch('/api/dashboard/todo');
    const data = await res.json();
    state.todos = data;

    const container = document.getElementById('priority-list');
    
    // Filter active (non-archived)
    const activeTodos = data.filter(todo => todo.status !== 'Archived');
    const pendingTodos = activeTodos.filter(todo => todo.status !== 'Complete');
    
    // Update Counts
    const pendingBadge = document.getElementById('todo-pending-count');
    if (pendingBadge) {
      pendingBadge.innerText = `${pendingTodos.length} pending`;
    }

    if (activeTodos.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-txt">No priority actions logged for today.</div></div>`;
      return;
    }

    container.innerHTML = activeTodos.map(todo => {
      let isCompleted = todo.status === 'Complete';
      let priorityClass = `priority-badge-${todo.priority || 'Medium'}`;

      return `
        <div class="daily-item" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-left: 3px solid ${todo.priority === 'High' ? 'var(--red)' : todo.priority === 'Low' ? 'var(--green)' : 'var(--amber)'}; border-radius: var(--radius-md); gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
            <div class="daily-check ${isCompleted ? 'checked' : ''}" onclick="toggleTodoStatus(${todo.id}, '${todo.status}')" style="cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid var(--border); border-radius: 4px; flex-shrink: 0; background: ${isCompleted ? 'var(--gold)' : 'transparent'}; color: ${isCompleted ? '#1a1714' : 'transparent'}; font-weight: 700;">
              ${isCompleted ? '✓' : ''}
            </div>
            
            <!-- Double click to edit -->
            <span class="daily-text ${isCompleted ? 'completed' : ''}" id="todo-text-${todo.id}" ondblclick="enableTodoInlineEdit(${todo.id}, '${escapeQuote(todo.task)}')" style="cursor: pointer; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${isCompleted ? 'text-decoration: line-through; opacity: 0.4;' : ''}">
              <strong>${todo.task}</strong>
              ${todo.due_date ? `<span class="daily-time" style="margin-left: 8px; font-size: 9.5px; color: rgba(255,255,255,0.35);">(Due: ${todo.due_date})</span>` : ''}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <!-- Priority select dropdown -->
            <select class="form-select ${priorityClass}" onchange="changeTodoPriority(${todo.id}, this.value)" style="border:none; outline:none; cursor:pointer; font-weight:700; padding:2px 6px; font-size: 9.5px; border-radius: 4px; height: 20px; text-transform: uppercase;">
              <option value="High" ${todo.priority === 'High' ? 'selected' : ''}>🔴 High</option>
              <option value="Medium" ${todo.priority === 'Medium' || !todo.priority ? 'selected' : ''}>🟡 Medium</option>
              <option value="Low" ${todo.priority === 'Low' ? 'selected' : ''}>🟢 Low</option>
            </select>

            <!-- Complete/Incomplete status selector -->
            <select class="form-select" onchange="changeTodoStatus(${todo.id}, this.value)" style="border:1px solid var(--border); outline:none; cursor:pointer; font-weight:600; padding:2px 4px; font-size: 10px; background: rgba(0,0,0,0.35); border-radius: 4px; width: 95px; height: 20px; color: rgba(255,255,255,0.85);">
              <option value="Incomplete" ${todo.status === 'Incomplete' ? 'selected' : ''}>Incomplete</option>
              <option value="In Process" ${todo.status === 'In Process' ? 'selected' : ''}>In Process</option>
              <option value="On Hold" ${todo.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
              <option value="Complete" ${todo.status === 'Complete' ? 'selected' : ''}>Complete</option>
              <option value="Archived" ${todo.status === 'Archived' ? 'selected' : ''}>Archive</option>
            </select>

            <button class="btn btn-ghost btn-sm" onclick="deleteTodoTask(${todo.id})" style="padding: 2px 6px; color: var(--red); font-size: 11px; height: 20px; display: flex; align-items: center;">✕</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading todos:', err);
  }
}

function escapeQuote(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

async function addTodoInline() {
  const inputTask = document.getElementById('todo-inline-task');
  const inputPriority = document.getElementById('todo-inline-priority');
  const inputDue = document.getElementById('todo-inline-due');

  const task = inputTask.value.trim();
  if (!task) {
    showToast('Please type a task description.');
    return;
  }

  try {
    await fetch('/api/dashboard/todo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: task,
        priority: inputPriority.value,
        due_date: inputDue.value || '',
        status: 'Incomplete'
      })
    });
    showToast('Task added successfully!');
    inputTask.value = '';
    loadTodos();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

async function toggleTodoStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Complete' ? 'Incomplete' : 'Complete';
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;

  try {
    await fetch(`/api/dashboard/todo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: todo.task, status: newStatus, priority: todo.priority || 'Medium', due_date: todo.due_date })
    });
    showToast('Task status updated.');
    loadTodos();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

async function changeTodoStatus(id, newStatus) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;

  try {
    await fetch(`/api/dashboard/todo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: todo.task, status: newStatus, priority: todo.priority || 'Medium', due_date: todo.due_date })
    });
    showToast(`Status updated to: ${newStatus}`);
    loadTodos();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

async function changeTodoPriority(id, newPriority) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;

  try {
    await fetch(`/api/dashboard/todo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: todo.task, status: todo.status || 'Incomplete', priority: newPriority, due_date: todo.due_date })
    });
    showToast(`Priority: ${newPriority}`);
    loadTodos();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

window.enableTodoInlineEdit = function(id, currentTask) {
  const span = document.getElementById(`todo-text-${id}`);
  if (!span) return;

  span.innerHTML = `<input type="text" class="todo-inline-edit-input" id="todo-edit-input-${id}" value="${currentTask}" style="width: 100%; font-size: 12.5px;">`;
  const input = document.getElementById(`todo-edit-input-${id}`);
  input.focus();
  
  // Save on enter or blur
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveTodoInlineEdit(id, input.value);
    else if (e.key === 'Escape') loadTodos();
  });
  input.addEventListener('blur', () => {
    saveTodoInlineEdit(id, input.value);
  });
};

async function saveTodoInlineEdit(id, newTaskName) {
  const name = newTaskName.trim();
  if (!name) {
    loadTodos();
    return;
  }

  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;

  try {
    await fetch(`/api/dashboard/todo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: name, status: todo.status || 'Incomplete', priority: todo.priority || 'Medium', due_date: todo.due_date })
    });
    showToast('Task details saved.');
    loadTodos();
  } catch (err) {
    console.error(err);
  }
}

async function deleteTodoTask(id) {
  try {
    await fetch(`/api/dashboard/todo/${id}`, { method: 'DELETE' });
    showToast('Task deleted successfully.');
    loadTodos();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

// ─── OPERATING CALENDAR CONTROLLERS ───
let calState = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  selectedDateStr: new Date().toISOString().split('T')[0]
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

window.changeCalMonth = function(direction) {
  calState.currentMonth += direction;
  if (calState.currentMonth > 11) {
    calState.currentMonth = 0;
    calState.currentYear += 1;
  } else if (calState.currentMonth < 0) {
    calState.currentMonth = 11;
    calState.currentYear -= 1;
  }
  renderCalendar();
};

window.renderCalendar = async function() {
  const year = calState.currentYear;
  const month = calState.currentMonth;
  
  const monthTitle = document.getElementById('cal-month-title');
  if (monthTitle) {
    monthTitle.innerText = `${monthNames[month]} ${year}`;
  }

  const calGrid = document.getElementById('cal-days-grid');
  if (!calGrid) return;
  calGrid.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Make sure we have active leads schedules
  try {
    if (!state.followups || state.followups.length === 0) {
      const res = await fetch('/api/leads');
      const leads = await res.json();
      state.followups = leads.filter(l => l.next_followup && l.followup_status !== 'COMPLETED');
    }
  } catch (e) {
    console.error(e);
  }

  const followups = state.followups || [];

  let cellCount = 0;

  // Render prev month days padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const dayDiv = document.createElement('div');
    dayDiv.className = 'cal-day other-month';
    dayDiv.innerText = dayNum;
    calGrid.appendChild(dayDiv);
    cellCount++;
  }

  // Render current month active days
  const todayObj = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayDiv = document.createElement('div');
    
    let isToday = todayObj.getFullYear() === year && todayObj.getMonth() === month && todayObj.getDate() === day;
    let isActive = calState.selectedDateStr === dateStr;

    const isEven = (cellCount % 2 === 0);
    const dayOfWeek = cellCount % 7;
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    dayDiv.className = `cal-day ${isToday ? 'today' : ''} ${isActive ? 'active' : ''} ${isEven ? 'cal-even' : 'cal-odd'} ${isWeekend ? 'cal-weekend' : ''}`;
    dayDiv.innerText = day;
    
    // Pulse dot overlay if date carries scheduled events
    const hasEvents = followups.some(fu => {
      if (!fu.next_followup) return false;
      return fu.next_followup.split('T')[0] === dateStr;
    });

    if (hasEvents) {
      const dot = document.createElement('span');
      dot.className = 'cal-event-dot';
      dayDiv.appendChild(dot);
    }

    dayDiv.addEventListener('click', () => {
      document.querySelectorAll('#cal-days-grid .cal-day').forEach(el => el.classList.remove('active'));
      dayDiv.classList.add('active');
      calState.selectedDateStr = dateStr;
      inspectDateEvents(dateStr, true);
    });

    calGrid.appendChild(dayDiv);
    cellCount++;
  }

  // Initial check for selected date list (silent)
  inspectDateEvents(calState.selectedDateStr, false);
};

window.inspectDateEvents = async function(dateStr, shouldOpen = false) {
  const modalContainer = document.getElementById('cal-modal-events-list');
  const modalTitle = document.getElementById('cal-modal-title');
  if (!modalContainer || !modalTitle) return;
  
  const parts = dateStr.split('-');
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  modalTitle.innerText = `📅 Schedule for ${formattedDate}`;
  document.getElementById('cal-quick-add-date').value = dateStr;

  try {
    // 1. Fetch Lead Callbacks
    if (!state.followups || state.followups.length === 0) {
      const res = await fetch('/api/leads');
      const leads = await res.json();
      state.followups = leads.filter(l => l.next_followup && l.followup_status !== 'COMPLETED');
    }
    const dayCallbacks = state.followups.filter(fu => fu.next_followup && fu.next_followup.split('T')[0] === dateStr);

    // 2. Fetch To-Do Tasks
    const resTodos = await fetch('/api/dashboard/todos');
    const todos = resTodos.ok ? await resTodos.json() : [];
    const dayTodos = todos.filter(t => t.due_date && t.due_date.split('T')[0] === dateStr);

    let html = '';

    if (dayCallbacks.length === 0 && dayTodos.length === 0) {
      html = `<div style="font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; padding: 20px 0;">No active callbacks or tasks scheduled for this day.</div>`;
    } else {
      // Render Callbacks
      if (dayCallbacks.length > 0) {
        html += `<div style="font-size: 10px; font-weight:700; color:var(--gold-l); text-transform:uppercase; margin-bottom: 6px;">📞 Client Callbacks</div>`;
        html += dayCallbacks.map(ev => {
          const timeStr = ev.next_followup.includes('T') ? ev.next_followup.split('T')[1].substring(0, 5) : 'All Day';
          let stageBadge = 'badge-ghost';
          if (ev.stage === 'Site Visit') stageBadge = 'badge-blue';
          else if (ev.stage === 'Negotiation') stageBadge = 'badge-amber';
          else if (ev.stage === 'Won') stageBadge = 'badge-green';

          return `
            <div onclick="closeModal('modal-calendar-events'); showLeadDetails(${ev.id})" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; gap: 8px; margin-bottom: 4px;">
              <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;">
                <span style="font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ev.name} <span class="badge ${stageBadge}" style="font-size: 8px; padding: 1px 4px;">${ev.stage || 'Lead'}</span></span>
                <span style="font-size: 10px; color: rgba(255,255,255,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ev.notes ? ev.notes : 'Nurture callback check'}</span>
              </div>
              <span style="font-size: 10px; font-weight: 700; color: var(--gold-l); background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.2); padding: 2px 6px; border-radius: 4px; flex-shrink: 0; white-space: nowrap;">⏰ ${timeStr}</span>
            </div>
          `;
        }).join('');
      }

      // Render To-Dos
      if (dayTodos.length > 0) {
        html += `<div style="font-size: 10px; font-weight:700; color:var(--gold-l); text-transform:uppercase; margin-top: 10px; margin-bottom: 6px;">📋 Operating Tasks</div>`;
        html += dayTodos.map(todo => {
          let priClass = 'chip-cold';
          if (todo.priority === 'High') priClass = 'chip-hot';
          if (todo.priority === 'Medium') priClass = 'chip-warm';
          const isCompleted = todo.status === 'Complete';

          return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 8px 10px; border-radius: 6px; gap: 8px; margin-bottom: 4px;">
              <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;">
                <span style="font-size: 12px; font-weight: 700; color: #fff; text-decoration: ${isCompleted ? 'line-through' : 'none'}; opacity: ${isCompleted ? 0.5 : 1}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${todo.task}</span>
                <span style="font-size: 10px; color: var(--text-muted);">${todo.status}</span>
              </div>
              <span class="chip ${priClass}" style="font-size: 9px; padding: 2px 6px;">${todo.priority}</span>
            </div>
          `;
        }).join('');
      }
    }

    modalContainer.innerHTML = html;
    
    if (shouldOpen) {
      openModal('modal-calendar-events');
    }
  } catch (e) {
    console.error(e);
    modalContainer.innerHTML = `<div style="font-size: 11px; color: var(--red); text-align: center;">Error loading events.</div>`;
  }
};

window.submitCalQuickAdd = async function(e) {
  e.preventDefault();
  const dateStr = document.getElementById('cal-quick-add-date').value;
  const taskName = document.getElementById('cal-quick-add-task').value.trim();
  const priority = document.getElementById('cal-quick-add-priority').value;
  
  if (!taskName || !dateStr) return;

  try {
    const res = await fetch('/api/dashboard/todo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: taskName, status: 'Incomplete', priority, due_date: dateStr })
    });
    if (!res.ok) throw new Error('Failed to add calendar task');
    
    showToast('Calendar task scheduled successfully.');
    document.getElementById('cal-quick-add-task').value = '';
    
    // Refresh calendar and reload events
    state.followups = []; // Clear cache to reload
    renderCalendar();
    inspectDateEvents(dateStr, true);
    loadTodos();
    loadDashboardData();
  } catch(err) {
    console.error(err);
    showToast('Failed to schedule task.');
  }
};

// ─── DEAL TIMELINE SYSTEM RENDERER ───
window.renderPropertyTimelines = async function() {
  const container = document.getElementById('timeline-deals-list');
  if (!container) return;

  try {
    const res = await fetch('/api/commissions');
    const deals = await res.json();
    
    // Filter active split-contracts
    const activeDeals = deals.filter(d => d.booking_date || d.payment_status === 'Pending').slice(0, 3);

    if (activeDeals.length === 0) {
      container.innerHTML = `<div style="font-size: 11.5px; color: rgba(255,255,255,0.3); text-align: center; padding: 20px 0;">No active property deals currently running on timelines.</div>`;
      return;
    }

    container.innerHTML = activeDeals.map(deal => {
      let progress = 10;
      let m1 = deal.booking_date ? 'complete' : 'active';
      let m2 = 'inactive';
      let m3 = 'inactive';
      let m4 = 'inactive';

      if (deal.booking_date) {
        progress = 25;
        m1 = 'complete';
        m2 = 'active';
      }
      if (deal.agreement_date) {
        progress = 50;
        m2 = 'complete';
        m3 = 'active';
      }
      if (deal.registration_date) {
        progress = 75;
        m3 = 'complete';
        m4 = 'active';
      }
      if (deal.handover_date) {
        progress = 100;
        m4 = 'complete';
      }

      const formatVal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(deal.deal_value || 0);

      return `
        <div class="timeline-track-container" style="background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: var(--radius-md); margin-bottom: 2px;">
          <div class="timeline-deal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="timeline-deal-name" style="font-weight: 700; color: var(--gold-l); font-size: 12.5px;"><i class="ti ti-building"></i> ${deal.deal_name}</span>
            <span class="timeline-deal-value" style="font-size: 11px; color: rgba(255,255,255,0.55); font-weight: 600;">${formatVal} · <strong style="color: ${deal.payment_status === 'Paid' ? 'var(--green-light)' : 'var(--amber)'};">${deal.payment_status}</strong></span>
          </div>
          
          <div class="timeline-progress-track" style="position: relative; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin: 15px 10px 25px;">
            <div class="timeline-progress-fill" style="position: absolute; height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold-light)); border-radius: 2px; width: ${progress}%;"></div>
            
            <div class="timeline-milestones" style="position: absolute; top: -6px; left: 0; right: 0; display: flex; justify-content: space-between; pointer-events: none;">
              <!-- Milestones -->
              <div class="timeline-milestone ${m1}" style="position: relative; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.15);">
                <span class="timeline-milestone-label">Booking</span>
                <span class="timeline-date-caption">${deal.booking_date || 'TBD'}</span>
              </div>
              <div class="timeline-milestone ${m2}" style="position: relative; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.15);">
                <span class="timeline-milestone-label">Agreement</span>
                <span class="timeline-date-caption">${deal.agreement_date || 'TBD'}</span>
              </div>
              <div class="timeline-milestone ${m3}" style="position: relative; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.15);">
                <span class="timeline-milestone-label">Registration</span>
                <span class="timeline-date-caption">${deal.registration_date || 'TBD'}</span>
              </div>
              <div class="timeline-milestone ${m4}" style="position: relative; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.15);">
                <span class="timeline-milestone-label">Handover</span>
                <span class="timeline-date-caption">${deal.handover_date || 'TBD'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
};

// ─── INTERACTIVE GTM NAVIGATOR PREVIEWS ───
window.hydrateSegmentPreviews = async function() {
  try {
    // 1. Fetch Enquiries Segment
    const resLeads = await fetch('/api/leads');
    const allLeads = await resLeads.json();
    
    const enquiries = allLeads.filter(l => l.source === 'Walk-in' || l.source === 'Portals' || !l.stage);
    document.getElementById('seg-enquiries-count').innerText = enquiries.length;
    
    const enquiriesPreview = document.getElementById('seg-enquiries-preview');
    if (enquiries.length === 0) {
      enquiriesPreview.innerText = "No pending enquiries registered in log.";
    } else {
      enquiriesPreview.innerHTML = enquiries.slice(0, 2).map(e => `
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor:pointer;" onclick="event.stopPropagation(); showLeadDetails(${e.id})">• <strong>${e.name}</strong> seeks ${e.project_type || '2 BHK'} in ${e.notes ? e.notes.split(',')[0].substring(0, 15) : 'Bangalore'}</div>
      `).join('');
    }

    // 2. Fetch Active Leads Segment
    const activeLeads = allLeads.filter(l => l.stage && l.stage !== 'Won' && l.stage !== 'Lost');
    document.getElementById('seg-leads-count').innerText = activeLeads.length;
    
    const leadsPreview = document.getElementById('seg-leads-preview');
    if (activeLeads.length === 0) {
      leadsPreview.innerText = "No active negotiation/site visit leads.";
    } else {
      leadsPreview.innerHTML = activeLeads.slice(0, 2).map(l => `
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor:pointer;" onclick="event.stopPropagation(); showLeadDetails(${l.id})">• <strong>${l.name}</strong> - <span style="color:var(--gold-l); font-weight:600;">${l.stage}</span></div>
      `).join('');
    }

    // 3. Fetch Bookings Segment
    const resComm = await fetch('/api/commissions');
    const bookings = await resComm.json();
    document.getElementById('seg-bookings-count').innerText = bookings.length;
    
    const bookingsPreview = document.getElementById('seg-bookings-preview');
    if (bookings.length === 0) {
      bookingsPreview.innerText = "No transactions logged in splits ledger.";
    } else {
      bookingsPreview.innerHTML = bookings.slice(0, 2).map(b => `
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">• <strong>${b.deal_name}</strong> - Payout: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(b.co_broker_payout || 0)}</div>
      `).join('');
    }

    // 4. Fetch Campaigns Segment
    try {
      const resCamp = await fetch('/api/drip/campaigns');
      const campaigns = await resCamp.json();
      const activeCamps = campaigns.filter(c => c.is_active === 1 || c.is_active === true);
      const campPreview = document.getElementById('seg-campaigns-preview');
      if (campPreview) {
        if (activeCamps.length === 0) {
          campPreview.innerText = "No active marketing drip sequences running.";
        } else {
          campPreview.innerHTML = activeCamps.slice(0, 2).map(c => `
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">• <strong>${c.name}</strong> (${c.channel || 'WhatsApp'})</div>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Error fetching drip campaigns:', e);
    }

    // 5. Fetch Projects Segment
    try {
      const resProj = await fetch('/api/projects');
      const projects = await resProj.json();
      document.getElementById('seg-projects-count').innerText = projects.length;
      
      const projPreview = document.getElementById('seg-projects-preview');
      if (projPreview) {
        if (projects.length === 0) {
          projPreview.innerText = "No projects in inventory.";
        } else {
          projPreview.innerHTML = projects.slice(0, 2).map(p => `
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">• <strong>${p.project_name}</strong> by ${p.builder_name}</div>
          `).join('');
        }
      }
    } catch (e) {
      console.error(e);
    }

    // 6. Fetch Associates Segment
    // Assuming there isn't an associates API yet, we will just hardcode the preview for now or mock it if no API exists.
    try {
      // If no API exists, this might fail, so we catch it.
      const resAssoc = await fetch('/api/associates').catch(() => null);
      if (resAssoc && resAssoc.ok) {
        const associates = await resAssoc.json();
        document.getElementById('seg-associates-count').innerText = associates.length;
        const assocPreview = document.getElementById('seg-associates-preview');
        if (assocPreview) {
          if (associates.length === 0) {
             assocPreview.innerText = "No channel partners registered.";
          } else {
             assocPreview.innerHTML = associates.slice(0,2).map(a => `<div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">• <strong>${a.name || a.agency_name}</strong></div>`).join('');
          }
        }
      } else {
        document.getElementById('seg-associates-count').innerText = "0";
        const assocPreview = document.getElementById('seg-associates-preview');
        if (assocPreview) assocPreview.innerText = "Associates directory offline.";
      }
    } catch (e) {}

  } catch (err) {
    console.error('Error hydrating segment previews:', err);
  }
};

window.triggerSheetsSyncManual = function() {
  if (typeof window.syncGoogleSheets === 'function') {
    window.syncGoogleSheets();
  } else {
    showToast('Sheets sync engine not loaded.');
  }
};

async function loadScratchpad() {
  try {
    const res = await fetch('/api/dashboard/scratchpad');
    const data = await res.json();
    document.getElementById('scratchpad-textarea').value = data.content;
  } catch (err) {
    console.error(err);
  }
}

function setupScratchpadAutosave() {
  const area = document.getElementById('scratchpad-textarea');
  if (!area) return;
  
  let timeout = null;
  const saveScratchpadSilently = async () => {
    try {
      await fetch('/api/dashboard/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: area.value })
      });
    } catch (err) {
      console.error('Scratchpad autosave failed:', err);
    }
  };

  area.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(saveScratchpadSilently, 1500); // Save 1.5s after typing stops
  });

  area.addEventListener('blur', () => {
    clearTimeout(timeout);
    saveScratchpadSilently();
  });
  
  window.addEventListener('beforeunload', () => {
    clearTimeout(timeout);
    saveScratchpadSilently();
  });
}

// ------------------------------------------
// 3. DAILY OS OPERATIONS
// ------------------------------------------
async function loadDailyOS() {
  try {
    const res = await fetch('/api/daily/checklist');
    const data = await res.json();
    state.dailyChecklist = data;

    const morningContainer = document.getElementById('morning-list');
    const eveningContainer = document.getElementById('evening-list');

    const morningItems = data.filter(item => item.routine_type === 'Morning');
    const eveningItems = data.filter(item => item.routine_type === 'Evening');

    morningContainer.innerHTML = renderDailyOSItems(morningItems);
    eveningContainer.innerHTML = renderDailyOSItems(eveningItems);
  } catch (err) {
    console.error(err);
  }
}

function renderDailyOSItems(items) {
  if (items.length === 0) {
    return `<div class="empty"><div class="empty-txt">No routine templates loaded.</div></div>`;
  }
  return items.map(item => `
    <div class="daily-item">
      <div class="daily-check ${item.is_checked ? 'checked' : ''}" onclick="toggleDailyOSItem(${item.id}, ${item.is_checked})">
        ${item.is_checked ? '✓' : ''}
      </div>
      <div class="daily-text ${item.is_checked ? 'completed' : ''}">
        ${item.item_name}
      </div>
    </div>
  `).join('');
}

async function toggleDailyOSItem(id, currentChecked) {
  try {
    await fetch(`/api/daily/checklist/toggle/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_checked: !currentChecked })
    });
    showToast('Daily routine checked state recorded.');
    loadDailyOS();
  } catch (err) {
    console.error(err);
  }
}

// ------------------------------------------
// 4. PROPERTY INVENTORY & FILTERS
// ------------------------------------------
// Active view modes dynamically initialized
if (!state.viewModes) {
  state.viewModes = {
    resale: 'card',
    rental: 'card',
    commercial: 'card',
    land: 'card',
    projects: 'card'
  };
}

window.setViewMode = function(pane, mode) {
  state.viewModes[pane] = mode;
  
  const cardBtn = document.getElementById(`toggle-${pane}-card`);
  const tableBtn = document.getElementById(`toggle-${pane}-table`);
  
  if (cardBtn && tableBtn) {
    if (mode === 'card') {
      cardBtn.classList.add('active');
      tableBtn.classList.remove('active');
      document.getElementById(`cols-btn-${pane}`)?.classList.add('hidden');
    } else {
      tableBtn.classList.add('active');
      cardBtn.classList.remove('active');
      document.getElementById(`cols-btn-${pane}`)?.classList.remove('hidden');
    }
  }
  
  if (pane === 'projects') {
    loadProjects();
  } else {
    loadProperties();
  }
};

async function loadProperties(keepPages = false) {
  // Debounce lock — prevents simultaneous double-render (duplicate display fix)
  if (state._propLoading) return;
  state._propLoading = true;
  if (!keepPages) {
    state.propPages = { resale: 1, rental: 1, commercial: 1, land: 1 };
  }
  try {
    const search = (document.getElementById('filter-prop-search')?.value || '').trim();
    
    // Advanced Filters inputs
    const minPriceInput = document.getElementById('filter-prop-price-min')?.value;
    const maxPriceInput = document.getElementById('filter-prop-price-max')?.value;
    
    const minPrice = minPriceInput ? parseFloat(minPriceInput) : 0;
    const maxPrice = maxPriceInput ? parseFloat(maxPriceInput) : Infinity;
    
    const mandate = document.getElementById('filter-prop-mandate')?.value || '';
    const interiors = document.getElementById('filter-prop-interiors')?.value || '';
    const recency = document.getElementById('filter-prop-recency')?.value || '';
    const type = document.getElementById('filter-prop-type')?.value || '';
    
    const facing = document.getElementById('filter-prop-facing')?.value || '';
    const status = document.getElementById('filter-prop-status')?.value || '';
    const registration = document.getElementById('filter-prop-registration')?.value || '';
    const zone = document.getElementById('filter-prop-zone')?.value || '';
    const holderType = document.getElementById('filter-prop-holder-type')?.value || '';

    // BHK Checklist selections
    const checkedBHKs = [];
    document.querySelectorAll('.filter-bhk-check:checked').forEach(cb => {
      checkedBHKs.push(cb.value);
    });
    
    // Build URL — pass status to server for server-side filtering
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const url = `/api/properties${params.toString() ? '?' + params.toString() : ''}`;
    
    const res = await fetch(url);
    const data = await res.json();
    state.properties = data;
    
    const filteredListings = data.filter(p => {
      // 1. Staging / Price Filter
      const price = parseFloat(p.price || 0);
      const priceMatch = price >= minPrice && price <= (maxPrice || Infinity);
      
      // 2. Mandate Match
      const mandateMatch = !mandate || p.mandate_type === mandate;
      
      // 3. Interiors Match
      const interiorsMatch = !interiors || p.interiors === interiors;
      
      // 4. Property Typology Match
      const typeMatch = !type || (p.property_type || '').toLowerCase() === type.toLowerCase();
      
      // 5. BHK Checklist Match
      let bhkMatch = true;
      if (checkedBHKs.length > 0) {
        bhkMatch = checkedBHKs.some(bhk => (p.configuration || '').includes(bhk));
      }
      
      // 6. Recency Match (Today, Last 7 Days, Last 30 Days)
      let recencyMatch = true;
      if (recency) {
        const lastUpdatedDate = new Date(p.last_updated);
        const today = new Date();
        const diffTime = Math.abs(today - lastUpdatedDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (recency === 'today') {
          recencyMatch = diffDays <= 1;
        } else if (recency === '7days') {
          recencyMatch = diffDays <= 7;
        } else if (recency === '30days') {
          recencyMatch = diffDays <= 30;
        }
      }

      // 7. Facing Match
      const facingMatch = !facing || (p.facing || '').toLowerCase() === facing.toLowerCase();
      
      // 8. Status (Availability) Match
      const statusMatch = !status || (p.status || 'AVAILABLE').toUpperCase() === status.toUpperCase();
      
      // 9. Registration Match
      const regMatch = !registration || (p.registration_status || '').toLowerCase() === registration.toLowerCase();
      
      // 10. Zone Match
      const zoneMatch = !zone || (p.zone || '').toLowerCase() === zone.toLowerCase();
      
      // 11. Holder Type Match
      const holderMatch = !holderType || (p.holder_type || '').toLowerCase() === holderType.toLowerCase();
      
      return priceMatch && mandateMatch && interiorsMatch && typeMatch && bhkMatch && recencyMatch && facingMatch && statusMatch && regMatch && zoneMatch && holderMatch;
    });
    
    const resaleListings = [];
    const rentalListings = [];
    const commercialListings = [];
    const landListings = [];
    
    filteredListings.forEach(p => {
      const pType = (p.property_type || '').toLowerCase();
      const isCommercial = pType.includes('commercial') || pType.includes('office') || pType.includes('retail') || pType.includes('warehouse') || pType.includes('showroom');
      const isRental = pType === 'rental' || (p.price_raw || '').toLowerCase().includes('/mo');
      const isLand = pType === 'land' || pType === 'plot' || pType.includes('land') || pType.includes('plot');
      
      if (isCommercial) {
        commercialListings.push(p);
      } else if (isRental) {
        rentalListings.push(p);
      } else if (isLand) {
        landListings.push(p);
      } else {
        resaleListings.push(p);
      }
    });

    // Update count display based on active tab
    let activeCount = filteredListings.length;
    if (state.inventoryTab === 'resale') activeCount = resaleListings.length;
    else if (state.inventoryTab === 'rental') activeCount = rentalListings.length;
    else if (state.inventoryTab === 'commercial') activeCount = commercialListings.length;
    else if (state.inventoryTab === 'land') activeCount = landListings.length;

    const disp = document.getElementById('inventory-count-display');
    if (disp) {
      disp.innerHTML = `Showing <strong>${activeCount}</strong> listings in this segment | <span style="color:var(--text-muted); font-size:11px;">${filteredListings.length} total matched filters</span>`;
    }
    
    renderResaleProperties(resaleListings);
    renderRentalProperties(rentalListings);
    renderCommercialProperties(commercialListings);
    renderLandProperties(landListings);
  } catch (err) {
    console.error(err);
  } finally {
    state._propLoading = false;
  }
}

function renderResaleProperties(listings) {
  const container = document.getElementById('inventory-list-container');
  const warningBanner = document.getElementById('stale-properties-warning');

  const hasStale = listings.some(p => p.is_stale);
  if (warningBanner) warningBanner.style.display = hasStale ? 'block' : 'none';

  if (listings.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-ic">🏢</div><div class="empty-txt">No properties matched filters. Add a new listing!</div></div>`;
    return;
  }

  const itemsPerPage = 50;
  const resalePage = state.propPages.resale || 1;
  const resaleTotalPages = Math.ceil(listings.length / itemsPerPage) || 1;
  const resaleStart = (resalePage - 1) * itemsPerPage;
  const slicedListings = listings.slice(resaleStart, resaleStart + itemsPerPage);

  if (state.viewModes.resale === 'card') {
    container.innerHTML = slicedListings.map(p => `
      <div class="inv-item" style="${p.is_stale ? 'border: 1.5px solid var(--red) !important; background: rgba(192, 57, 43, 0.08) !important;' : ''}">
        <div style="position: absolute; top: 12px; right: 12px; z-index: 10;"><input type="checkbox" class="row-checkbox-resale" value="${p.id}" onchange="updateBulkSelectionState('resale')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()"></div>
        <div class="inv-row">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="inv-name" style="font-size: 16px; font-weight: 700; color:var(--gold-l);">${p.society}</span> 
              <span class="chip chip-cold btn-sm" style="font-size:9.5px; cursor:pointer;" onclick="editID('properties', ${p.id}, '${p.prop_id || ''}')">ID: ${p.prop_id || '#' + p.id}</span>
              ${p.is_stale ? `<span class="chip chip-hot btn-sm" style="font-size:9px; font-weight:700;">⚠️ STALE LISTING</span>` : ''}
              ${p.mandate_type === 'Exclusive' ? `<span class="chip ch-gold btn-sm" style="font-size:9px; font-weight:700; background:rgba(212, 175, 55,0.2); border:0.5px solid var(--gold); color:var(--gold-l);">👑 EXCLUSIVE</span>` : ''}
              ${(()=>{ const s=(p.status||'AVAILABLE').toUpperCase(); if(s==='AVAILABLE') return `<span class="chip chip-available btn-sm" style="font-size:9px;font-weight:700;background:rgba(46,204,113,0.2);border:0.5px solid var(--green);color:var(--green);">🟢 AVAILABLE</span>`; if(s==='SOLD') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(192,57,43,0.2);border:0.5px solid var(--red);color:var(--red);">🔴 SOLD</span>`; if(s==='ON HOLD') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(230,126,34,0.2);border:0.5px solid #e67e22;color:#e67e22;">🟠 ON HOLD</span>`; if(s==='WITHDRAWN') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(127,140,141,0.2);border:0.5px solid #7f8c8d;color:#7f8c8d;">⚫ WITHDRAWN</span>`; if(s==='EXPIRED') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(192,57,43,0.1);border:0.5px solid #c0392b;color:#c0392b;opacity:0.7;">🔕 EXPIRED</span>`; if(s==='RESERVED') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(52,152,219,0.2);border:0.5px solid var(--blue);color:var(--blue-light);">🔵 RESERVED</span>`; return ''; })()}
              ${p.associate_id ? `<span class="chip ch-gold btn-sm" style="font-size:9px; font-weight:700; background:rgba(52, 152, 219, 0.2); border:0.5px solid var(--blue); color:var(--blue-light);">🏢 Associate: ${p.associate_name || 'Network Broker'}</span>` : ''}
              ${p.special_tags ? p.special_tags.split(',').map(tag => `<span class="chip chip-warm btn-sm" style="font-size:9px; font-weight:600;">🏷️ ${tag.trim()}</span>`).join(' ') : ''}
              ${p.sync_status && p.sync_status !== 'NOT_SYNCED' ? `<span class="portal-sync-badge"><i class="ti ti-world"></i> ${p.sync_status}</span>` : ''}
            </div>
            <div class="inv-loc" style="margin-top: 6px; font-size:12px;">📍 Location: <strong>${p.location}</strong> | Staging: <strong>${p.project_status || 'RTMI'}</strong></div>
          </div>
          <div style="text-align:right; padding-right: 35px;">
            <div class="inv-price" style="font-size:18px; color:var(--green); font-weight:800;">${formatPriceToWords(p.price)}</div>
            <div class="inv-upd">Last update: ${new Date(p.last_updated).toLocaleDateString()}</div>
          </div>
        </div>
        
        <!-- Premium 3-column Metadata Grid -->
        <div class="metadata-grid-3">
          <div class="metadata-item">
            <span class="metadata-label">📐 Super Area</span>
            <span class="metadata-value">${p.area_sqft} Sqft</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🛏️ Configuration</span>
            <span class="metadata-value">${p.configuration || 'N/A'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🛋️ Interiors</span>
            <span class="metadata-value">${p.interiors}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🚪 Facing</span>
            <span class="metadata-value">${p.facing || 'East'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🔑 Possession</span>
            <span class="metadata-value">${p.possession || 'Ready'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">📜 Registration</span>
            <span class="metadata-value" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.registration_status}">${p.registration_status || 'Registered'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🚇 Metro Proximity</span>
            <span class="metadata-value">${p.site_area || '500m'}</span>
          </div>
        </div>

        <!-- Activity Summary Indicators -->
        <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px;">
          ${parseInt(p.total_shares || 0) > 0 ? `
            <span class="chip" style="background: rgba(184, 134, 11, 0.12); border: 0.5px solid rgba(184, 134, 11, 0.4); color: var(--gold-l); cursor: pointer; border-radius: 4px; padding: 2px 6px;" title="Shared with: ${p.shared_with_list || 'N/A'}" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}'); event.stopPropagation();">
              📢 Shared: <strong>${p.total_shares}x</strong> (${p.shared_with_list || 'N/A'})
            </span>
          ` : `
            <span class="chip" style="background: rgba(255, 255, 255, 0.02); border: 0.5px solid rgba(255, 255, 255, 0.06); color: var(--text-muted); opacity: 0.6; border-radius: 4px; padding: 2px 6px;">
              📢 No shares
            </span>
          `}
          
          ${parseInt(p.total_visits || 0) > 0 ? `
            <span class="chip" style="background: rgba(46, 204, 113, 0.12); border: 0.5px solid rgba(46, 204, 113, 0.4); color: var(--green); cursor: pointer; border-radius: 4px; padding: 2px 6px;" title="Visits by: ${p.visiting_agents_list || 'N/A'}" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}'); event.stopPropagation();">
              🚶 Visits: <strong>${p.total_visits}</strong> (Agents: ${p.visiting_agents_list || 'Direct/Unknown'})
            </span>
          ` : `
            <span class="chip" style="background: rgba(255, 255, 255, 0.02); border: 0.5px solid rgba(255, 255, 255, 0.06); color: var(--text-muted); opacity: 0.6; border-radius: 4px; padding: 2px 6px;">
              🚶 No visits
            </span>
          `}
        </div>

        <div class="inv-tags" style="margin-top:12px;">
          <span class="tag tag-primary">${p.mandate_type || 'Open'} Mandate</span>
          <span class="tag tag-secondary">Parking: ${p.car_park || '1'}</span>
          <span class="tag tag-avail">RERA checked</span>
          ${(p.special_tags || '').split(',').filter(t => t.trim() !== '').map(tag => `
            <span class="tag" style="background:rgba(255,255,255,0.05); color:var(--gold-l); border: 0.5px solid var(--border);">${tag.trim()}</span>
          `).join('')}
          <span class="tag" style="background:rgba(212, 175, 55,0.15); color:var(--gold-l); border: 1.5px dashed var(--gold); cursor:pointer; font-weight:700;" onclick="promptAddTag(${p.id}, 'properties')">+ Tag</span>
        </div>

        <div class="act-row" style="margin-top: 12px; display:flex; gap:8px;">
          ${state.systemSettings.showMaskedFields ? 
            `<button class="btn btn-ghost btn-sm" onclick="togglePrivateContact(${p.id})">📞 View Owner Contacts</button>` : 
            `<span class="tag" style="background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 8px; font-size: 11px; cursor: not-allowed;"><i class="ti ti-lock"></i> Contacts & Docs Locked</span>`
          }
          <button class="btn btn-ghost btn-sm" style="color:var(--gold-l);" onclick="editFullProperty(${p.id})"><i class="ti ti-edit"></i> Edit</button>
          <button class="btn btn-primary btn-sm" onclick="showShareModal(${p.id})">📢 Share Pitch</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--blue-light);" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}', 'Resale')"><i class="ti ti-history"></i> Activity Log</button>
          <button class="btn btn-ghost btn-sm" onclick="cloneProperty(${p.id})">📋 Clone</button>
          <button class="btn btn-ghost btn-sm" onclick="printPropertyCard(${p.id})">🖨️ Print</button>
          ${p.video_link ? `<a class="btn btn-ghost btn-sm" href="${p.video_link}" target="_blank">🔗 Video Link</a>` : ''}
          ${p.google_map_url ? `<a class="btn btn-ghost btn-sm" href="${p.google_map_url}" target="_blank" style="color:#3498db;">🗺️ Map</a>` : ''}
          ${(!p.status || p.status.toUpperCase() === 'AVAILABLE' || p.status.toUpperCase() === 'ON HOLD') ? `<button class="btn btn-sm" style="background:rgba(46,204,113,0.15);border:1px solid var(--green);color:var(--green);font-size:11px;padding:4px 10px;" onclick="closureDeal(${p.id},'${(p.society || '').replace(/'/g,"\\'")}','${p.property_type || ''}')">🏁 Close Deal</button>` : ''}
          <button class="btn btn-d btn-sm" onclick="deletePropertyListing(${p.id})" style="padding: 4px 10px; font-size:11px;">✕ Delete</button>
        </div>

        <!-- Private Contact Card (masked for employees!) -->
        ${state.systemSettings.showMaskedFields ? `
        <div id="private-contact-${p.id}" style="display: none; margin-top: 12px; padding: 12px; background: rgba(212, 175, 55, 0.08); border-radius: var(--radius-sm); border: 1px dashed var(--gold)">
          <div style="font-size: 13px; font-weight:700; color:var(--gold-l); margin-bottom: 6px;">🔐 Security Audited Contact Sheet:</div>
          <div class="grid3" style="font-size:12px; margin-bottom: 8px;">
            <div>Direct Owner Name: <strong>${p.owner_name}</strong></div>
            <div>Direct Phone Number: <strong>${p.owner_phone}</strong></div>
            <div>Owner Email: <strong>${p.owner_email || 'N/A'}</strong></div>
            <div>Khata Staging: <strong>${p.registration_status || 'Verified'}</strong></div>
            <div>Unit No: <strong>${p.unit_no || 'N/A'}</strong></div>
            <div>Source: <strong>${p.source || 'N/A'}</strong></div>
            <div style="color:var(--gold-l);">Commission: <strong>${p.commission_agreed || 'N/A'}</strong></div>
          </div>
          
          <!-- Co-Broker associate linking select -->
          <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
            🤝 <strong>Link Co-Broker Associate:</strong>
            <select class="form-select btn-sm" style="margin-top: 6px; font-size:11px; padding: 4px 8px; width: 100%; border: 0.5px solid var(--border);" onchange="linkAssociateToProperty(${p.id}, this.value)">
              <option value="">-- No Associate Broker Linked --</option>
              ${state.associates.map(a => `<option value="${a.id}" ${p.associate_id === a.id ? 'selected' : ''}>${a.name} (${a.company || 'Broker'})</option>`).join('')}
            </select>
          </div>

          <!-- Document Archival Section -->
          <div style="margin-top:12px; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
            📁 <strong>Document Archival & Grouping:</strong>
            <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
              <button class="btn btn-ghost btn-sm" onclick="simulateDocUpload(${p.id}, 'ATS')" style="font-size:10px; padding:2px 6px;">📄 ATS</button>
              <button class="btn btn-ghost btn-sm" onclick="simulateDocUpload(${p.id}, 'Mother Deeds')" style="font-size:10px; padding:2px 6px;">📄 Mother Deeds</button>
              <button class="btn btn-ghost btn-sm" onclick="simulateDocUpload(${p.id}, 'Sale Deed')" style="font-size:10px; padding:2px 6px;">📄 Sale Deed</button>
              <button class="btn btn-ghost btn-sm" onclick="simulateDocUpload(${p.id}, 'Assignment Agreement')" style="font-size:10px; padding:2px 6px;">📄 Assignment</button>
              <button class="btn btn-ghost btn-sm" onclick="simulateDocUpload(${p.id}, 'KYC Doc')" style="font-size:10px; padding:2px 6px;">📄 KYC Doc</button>
            </div>
            <div id="doc-list-${p.id}" style="margin-top:8px; font-size:11px; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
              <div>• ATS: <span id="doc-${p.id}-ATS" style="color:var(--green)">✓ ATS_Signed_Draft.pdf</span></div>
              <div>• KYC Doc: <span id="doc-${p.id}-KYC" style="color:var(--green)">✓ Owner_KYC_Card.pdf</span></div>
              <div>• Mother Deeds: <span id="doc-${p.id}-Mother" style="color:var(--text-muted)">Pending Upload</span></div>
              <div>• Sale Deed: <span id="doc-${p.id}-Sale" style="color:var(--text-muted)">Pending Upload</span></div>
              <div>• Assignment Agreement: <span id="doc-${p.id}-Assignment" style="color:var(--text-muted)">Pending Upload</span></div>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    `).join('');
  } else {
    // TABLE VIEW
    container.innerHTML = `
      <div class="tw" style="margin-top: 10px;">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width: 40px;"><input type="checkbox" id="check-all-resale" onchange="toggleAllRowCheckboxes('resale', this.checked)"></th>
              <th>ID</th>
              <th>Society / Project</th>
              <th>Location</th>
              ${showCol('resale', 'bhk') ? `<th>BHK</th>` : ''}
              ${showCol('resale', 'size') ? `<th>Size (Sqft)</th>` : ''}
              ${showCol('resale', 'price') ? `<th>Price</th>` : ''}
              ${showCol('resale', 'mandate') ? `<th>Mandate</th>` : ''}
              ${showCol('resale', 'interiors') ? `<th>Interiors</th>` : ''}
              ${showCol('resale', 'facing') ? `<th>Facing</th>` : ''}
              ${showCol('resale', 'staging') ? `<th>Staging</th>` : ''}
              ${showCol('resale', 'zone') ? `<th>Zone</th>` : ''}
              ${showCol('resale', 'year') ? `<th>Year Built</th>` : ''}
              ${showCol('resale', 'registration') ? `<th>Registration</th>` : ''}
              ${showCol('resale', 'carpark') ? `<th>Car Park</th>` : ''}
              ${showCol('resale', 'possession') ? `<th>Possession</th>` : ''}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${slicedListings.map(p => `
              <tr style="${p.is_stale ? 'background: rgba(192, 57, 43, 0.05); color: var(--red);' : ''}">
                <td><input type="checkbox" class="row-checkbox-resale" value="${p.id}" onchange="updateBulkSelectionState('resale')"></td>
                <td><span class="chip chip-cold btn-sm" style="font-size:9px; cursor:pointer;" onclick="editID('properties', ${p.id}, '${p.prop_id || ''}')">${p.prop_id || '#' + p.id}</span></td>
                 <td style="cursor: text;">
                   <strong contenteditable="true" class="editable-cell" onblur="updatePropertyInline(${p.id}, 'society', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.society}</strong>
                   ${(!p.status || p.status.toUpperCase() === 'AVAILABLE') ? `<br><span class="chip ch-gold btn-sm" style="font-size:8px; font-weight:700; background:rgba(46, 204, 113, 0.2); border:0.5px solid var(--green); color:var(--green); margin-top:4px; display:inline-block;">🟢 AVAILABLE</span>` : ''}
                   ${p.special_tags ? p.special_tags.split(',').map(tag => `<br><span class="chip chip-warm btn-sm" style="font-size:8px; font-weight:600; margin-top:2px; display:inline-block;">🏷️ ${tag.trim()}</span>`).join('') : ''}
                   ${p.sync_status && p.sync_status !== 'NOT_SYNCED' ? `<br><span class="portal-sync-badge" style="margin-top:4px;"><i class="ti ti-world"></i> ${p.sync_status}</span>` : ''}
                 </td>
                 <td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'location', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.location}</td>
                 ${showCol('resale', 'bhk') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'configuration', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.configuration}</td>` : ''}
                 ${showCol('resale', 'size') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'area_sqft', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.area_sqft}</td>` : ''}
                 ${showCol('resale', 'price') ? `<td contenteditable="true" class="editable-cell" style="color:var(--green); font-weight:600; cursor: text;" onblur="updatePropertyInline(${p.id}, 'price', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${formatPriceToWords(p.price)}</td>` : ''}
                 ${showCol('resale', 'mandate') ? `<td><span class="tag tag-primary" style="font-size:9.5px;">${p.mandate_type || 'Open'}</span></td>` : ''}
                 ${showCol('resale', 'interiors') ? `<td>${p.interiors}</td>` : ''}
                 ${showCol('resale', 'facing') ? `<td>${p.facing || 'East'}</td>` : ''}
                 ${showCol('resale', 'staging') ? `<td>${p.project_status || 'RTMI'}</td>` : ''}
                 ${showCol('resale', 'zone') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'zone', this)">${p.zone || 'N'}</td>` : ''}
                 ${showCol('resale', 'year') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'onboarded_year', this)">${p.onboarded_year || 'N/A'}</td>` : ''}
                 ${showCol('resale', 'registration') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'registration_status', this)">${p.registration_status || 'N/A'}</td>` : ''}
                 ${showCol('resale', 'carpark') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'car_park', this)">${p.car_park || 'N/A'}</td>` : ''}
                 ${showCol('resale', 'possession') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'possession', this)">${p.possession || 'N/A'}</td>` : ''}
                 <td>
                  <div style="display:flex; gap:4px;">
                    ${state.systemSettings.showMaskedFields ? 
                      `<button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="togglePrivateContact(${p.id})">📞 Contacts</button>` : 
                      `<button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px; opacity:0.5;" disabled title="Locked in Employee Mode">🔒 Locked</button>`
                    }
                    <button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px; color:var(--gold-l);" onclick="editFullProperty(${p.id})"><i class="ti ti-edit"></i> Edit</button>
                    <button class="btn btn-primary btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="showShareModal(${p.id})">📢 Share</button>
                    <button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="cloneProperty(${p.id})">📋 Clone</button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:9.5px; padding:2px 6px;" onclick="promptAddTag(${p.id}, 'properties')">+ Tag</button>
                    <button class="btn btn-d btn-sm" style="font-size:9.5px; padding:2px 6px; color:var(--red);" onclick="deletePropertyListing(${p.id})">✕</button>
                  </div>
                </td>
              </tr>
              ${state.systemSettings.showMaskedFields ? `
              <tr id="private-contact-row-${p.id}" style="display:none; background: rgba(212, 175, 55, 0.04);">
                <td colspan="12" style="padding:10px;">
                  <div style="display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; align-items:center;">
                    <div>
                      🔐 <strong>Direct Contact Details:</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Owner: <strong>${p.owner_name}</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Phone: <strong>${p.owner_phone}</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Email: <strong>${p.owner_email || 'N/A'}</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Unit No: <strong>${p.unit_no || 'N/A'}</strong>
                    </div>
                    <div>
                      🤝 <strong>Link Associate:</strong>
                      <select class="form-select btn-sm" style="display:inline-block; font-size:11px; padding: 2px 6px; width: 160px; margin-left:8px;" onchange="linkAssociateToProperty(${p.id}, this.value)">
                        <option value="">-- Link Co-Broker --</option>
                        ${state.associates.map(a => `<option value="${a.id}" ${p.associate_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                      </select>
                    </div>
                    <div>
                      📁 <strong>Document Archival:</strong>
                      <span style="color:var(--green)">✓ ATS</span> |
                      <span style="color:var(--green)">✓ KYC</span> |
                      <span style="color:var(--text-muted)">Mother Deeds</span> |
                      <span style="color:var(--text-muted)">Sale Deed</span>
                    </div>
                  </div>
                </td>
              </tr>
              ` : ''}
            `).join('')}
          </tbody>
          </table>
        </div>
      `;
    }
  container.innerHTML += renderPaginationBar('resale', resalePage, resaleTotalPages);
}

function renderRentalProperties(listings) {
  const container = document.getElementById('inventory-rentals-container');
  
  if (listings.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-txt">No active rental listings matched.</div></div>`;
    return;
  }

  const itemsPerPage = 50;
  const rentalPage = state.propPages.rental || 1;
  const rentalTotalPages = Math.ceil(listings.length / itemsPerPage) || 1;
  const rentalStart = (rentalPage - 1) * itemsPerPage;
  const slicedListings = listings.slice(rentalStart, rentalStart + itemsPerPage);

  if (state.viewModes.rental === 'card') {
    container.innerHTML = slicedListings.map(p => `
      <div class="inv-item" style="border-left: 3.5px solid var(--gold) !important;">
        <div style="position: absolute; top: 12px; right: 12px; z-index: 10;"><input type="checkbox" class="row-checkbox-rental" value="${p.id}" onchange="updateBulkSelectionState('rental')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()"></div>
        <div class="inv-row">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="inv-name" style="font-size: 16px; font-weight: 700; color:var(--gold-l);">${p.society}</span>
              <span class="chip chip-cold btn-sm" style="font-size:9.5px; cursor:pointer;" onclick="editID('properties', ${p.id}, '${p.prop_id || ''}')">ID: ${p.prop_id || '#' + p.id}</span>
              ${p.mandate_type === 'Exclusive' ? `<span class="chip ch-gold btn-sm" style="font-size:9px; font-weight:700; background:rgba(212, 175, 55,0.2); border:0.5px solid var(--gold); color:var(--gold-l);">👑 EXCLUSIVE</span>` : ''}
              ${(()=>{ const s=(p.status||'AVAILABLE').toUpperCase(); if(s==='AVAILABLE') return `<span class="chip chip-available btn-sm" style="font-size:9px;font-weight:700;background:rgba(46,204,113,0.2);border:0.5px solid var(--green);color:var(--green);">🟢 AVAILABLE</span>`; if(s==='SOLD') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(192,57,43,0.2);border:0.5px solid var(--red);color:var(--red);">🔴 RENTED OUT</span>`; if(s==='ON HOLD') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(230,126,34,0.2);border:0.5px solid #e67e22;color:#e67e22;">🟠 ON HOLD</span>`; if(s==='WITHDRAWN') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(127,140,141,0.2);border:0.5px solid #7f8c8d;color:#7f8c8d;">⚫ WITHDRAWN</span>`; if(s==='EXPIRED') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(192,57,43,0.1);border:0.5px solid #c0392b;color:#c0392b;opacity:0.7;">🔕 EXPIRED</span>`; if(s==='RESERVED') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(52,152,219,0.2);border:0.5px solid var(--blue);color:var(--blue-light);">🔵 RESERVED</span>`; return ''; })()}
              ${p.associate_id ? `<span class="chip ch-gold btn-sm" style="font-size:9px; font-weight:700; background:rgba(52, 152, 219, 0.2); border:0.5px solid var(--blue); color:var(--blue-light);">🏢 Associate: ${p.associate_name || 'Network Broker'}</span>` : ''}
              ${p.special_tags ? p.special_tags.split(',').map(tag => `<span class="chip chip-warm btn-sm" style="font-size:9px; font-weight:600;">🏷️ ${tag.trim()}</span>`).join(' ') : ''}
              ${p.sync_status && p.sync_status !== 'NOT_SYNCED' ? `<span class="portal-sync-badge"><i class="ti ti-world"></i> ${p.sync_status}</span>` : ''}
            </div>
            <div class="inv-loc" style="margin-top:6px; font-size:12px;">📍 Location: <strong>${p.location}</strong> · Configurations: <strong>${p.configuration}</strong></div>
          </div>
          <div style="text-align:right; padding-right: 35px;">
            <div class="inv-price" style="font-size:18px; color:var(--green); font-weight:800;">${formatPriceToWords(p.price)}</div>
            <div class="inv-upd" style="font-size:11px; color:var(--text-muted);">Available: ${p.available_from || 'Immediate'}</div>
          </div>
        </div>
        
        <!-- Premium 3-column Metadata Grid -->
        <div class="metadata-grid-3">
          <div class="metadata-item">
            <span class="metadata-label">📐 Size</span>
            <span class="metadata-value">${p.area_sqft} Sqft</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🛋️ Interiors</span>
            <span class="metadata-value">${p.interiors}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🚪 Facing</span>
            <span class="metadata-value">${p.facing || 'East'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">💰 Security Deposit</span>
            <span class="metadata-value">₹${(p.deposit || 0).toLocaleString()}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">💳 Maintenance fee</span>
            <span class="metadata-value">₹${(p.maintenance || 0).toLocaleString()}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">📅 Inventory Logged</span>
            <span class="metadata-value">${p.date_of_inventory || 'N/A'}</span>
          </div>
        </div>

        <!-- Activity Summary Indicators -->
        <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px;">
          ${parseInt(p.total_shares || 0) > 0 ? `
            <span class="chip" style="background: rgba(184, 134, 11, 0.12); border: 0.5px solid rgba(184, 134, 11, 0.4); color: var(--gold-l); cursor: pointer; border-radius: 4px; padding: 2px 6px;" title="Shared with: ${p.shared_with_list || 'N/A'}" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}'); event.stopPropagation();">
              📢 Shared: <strong>${p.total_shares}x</strong> (${p.shared_with_list || 'N/A'})
            </span>
          ` : `
            <span class="chip" style="background: rgba(255, 255, 255, 0.02); border: 0.5px solid rgba(255, 255, 255, 0.06); color: var(--text-muted); opacity: 0.6; border-radius: 4px; padding: 2px 6px;">
              📢 No shares
            </span>
          `}
          
          ${parseInt(p.total_visits || 0) > 0 ? `
            <span class="chip" style="background: rgba(46, 204, 113, 0.12); border: 0.5px solid rgba(46, 204, 113, 0.4); color: var(--green); cursor: pointer; border-radius: 4px; padding: 2px 6px;" title="Visits by: ${p.visiting_agents_list || 'N/A'}" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}'); event.stopPropagation();">
              🚶 Visits: <strong>${p.total_visits}</strong> (Agents: ${p.visiting_agents_list || 'Direct/Unknown'})
            </span>
          ` : `
            <span class="chip" style="background: rgba(255, 255, 255, 0.02); border: 0.5px solid rgba(255, 255, 255, 0.06); color: var(--text-muted); opacity: 0.6; border-radius: 4px; padding: 2px 6px;">
              🚶 No visits
            </span>
          `}
        </div>

        <div class="inv-tags" style="margin-top:12px;">
          <span class="tag tag-primary">${p.mandate_type || 'Open'} Lease</span>
          <span class="tag tag-secondary">Furnished Status: ${p.interiors}</span>
          <span class="tag tag-avail">RERA checked</span>
          ${(p.special_tags || '').split(',').filter(t => t.trim() !== '').map(tag => `
            <span class="tag" style="background:rgba(255,255,255,0.05); color:var(--gold-l); border: 0.5px solid var(--border);">${tag.trim()}</span>
          `).join('')}
          <span class="tag" style="background:rgba(212, 175, 55,0.15); color:var(--gold-l); border: 1.5px dashed var(--gold); cursor:pointer; font-weight:700;" onclick="promptAddTag(${p.id}, 'properties')">+ Tag</span>
        </div>

        <div class="act-row" style="margin-top: 12px; display:flex; gap:8px;">
          ${state.systemSettings.showMaskedFields ? 
            `<button class="btn btn-ghost btn-sm" onclick="togglePrivateContact(${p.id})">📞 View Owner Contacts</button>` : 
            `<span class="tag" style="background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 8px; font-size: 11px; cursor: not-allowed;"><i class="ti ti-lock"></i> Contacts & Docs Locked</span>`
          }
          <button class="btn btn-ghost btn-sm" style="color:var(--gold-l);" onclick="editFullProperty(${p.id})"><i class="ti ti-edit"></i> Edit</button>
          <button class="btn btn-primary btn-sm" onclick="showShareModal(${p.id})">📢 Share Pitch</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--blue-light);" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}', 'Rental')"><i class="ti ti-history"></i> Activity Log</button>
          <button class="btn btn-ghost btn-sm" onclick="cloneProperty(${p.id})">📋 Clone</button>
          <button class="btn btn-ghost btn-sm" onclick="printPropertyCard(${p.id})">🖨️ Print</button>
          ${p.video_link ? `<a class="btn btn-ghost btn-sm" href="${p.video_link}" target="_blank">🔗 Video Link</a>` : ''}
          ${p.google_map_url ? `<a class="btn btn-ghost btn-sm" href="${p.google_map_url}" target="_blank" style="color:#3498db;">🗺️ Map</a>` : ''}
          ${(!p.status || p.status.toUpperCase() === 'AVAILABLE' || p.status.toUpperCase() === 'ON HOLD') ? `<button class="btn btn-sm" style="background:rgba(46,204,113,0.15);border:1px solid var(--green);color:var(--green);font-size:11px;padding:4px 10px;" onclick="closureDeal(${p.id},'${(p.society || '').replace(/'/g,"\\'")}','${p.property_type || ''}')">🏁 Close Deal</button>` : ''}
          <button class="btn btn-d btn-sm" onclick="deletePropertyListing(${p.id})" style="padding: 4px 10px; font-size:11px;">✕ Delete</button>
        </div>

        <!-- Private Contact Card -->
        ${state.systemSettings.showMaskedFields ? `
        <div id="private-contact-${p.id}" style="display: none; margin-top: 12px; padding: 12px; background: rgba(212, 175, 55, 0.08); border-radius: var(--radius-sm); border: 1px dashed var(--gold)">
          <div style="font-size: 13px; font-weight:700; color:var(--gold-l); margin-bottom: 6px;">🔐 Security Audited Contact Sheet:</div>
          <div class="grid3" style="font-size:12px; margin-bottom: 8px;">
            <div>Direct Owner Name: <strong>${p.owner_name}</strong></div>
            <div>Direct Phone Number: <strong>${p.owner_phone}</strong></div>
            <div>Owner Email: <strong>${p.owner_email || 'N/A'}</strong></div>
            <div>Khata Staging: <strong>${p.registration_status || 'Verified'}</strong></div>
            <div>Unit No: <strong>${p.unit_no || 'N/A'}</strong></div>
            <div style="color:var(--gold-l);">Commission: <strong>${p.commission_agreed || 'N/A'}</strong></div>
          </div>
          
          <!-- Co-Broker associate linking select -->
          <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
            🤝 <strong>Link Co-Broker Associate:</strong>
            <select class="form-select btn-sm" style="margin-top: 6px; font-size:11px; padding: 4px 8px; width: 100%; border: 0.5px solid var(--border);" onchange="linkAssociateToProperty(${p.id}, this.value)">
              <option value="">-- No Associate Broker Linked --</option>
              ${state.associates.map(a => `<option value="${a.id}" ${p.associate_id === a.id ? 'selected' : ''}>${a.name} (${a.company || 'Broker'})</option>`).join('')}
            </select>
          </div>
        </div>
        ` : ''}
      </div>
    `).join('');
  } else {
    // TABLE VIEW
    container.innerHTML = `
      <div class="tw" style="margin-top: 10px;">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width: 40px;"><input type="checkbox" id="check-all-rental" onchange="toggleAllRowCheckboxes('rental', this.checked)"></th>
              <th>ID</th>
              <th>Society / Project</th>
              <th>Location</th>
              ${showCol('rental', 'type') ? `<th>BHK</th>` : ''}
              ${showCol('rental', 'area') ? `<th>Size (Sqft)</th>` : ''}
              ${showCol('rental', 'rent') ? `<th>Rent</th>` : ''}
              ${showCol('rental', 'deposit') ? `<th>Deposit</th>` : ''}
              ${showCol('rental', 'maintenance') ? `<th>Maintenance</th>` : ''}
              ${showCol('rental', 'available') ? `<th>Available From</th>` : ''}
              ${showCol('rental', 'interiors') ? `<th>Furnishing</th>` : ''}
              ${showCol('rental', 'facing') ? `<th>Facing</th>` : ''}
              ${showCol('rental', 'zone') ? `<th>Zone</th>` : ''}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${slicedListings.map(p => `
              <tr>
                <td><input type="checkbox" class="row-checkbox-rental" value="${p.id}" onchange="updateBulkSelectionState('rental')"></td>
                <td><span class="chip chip-cold btn-sm" style="font-size:9px; cursor:pointer;" onclick="editID('properties', ${p.id}, '${p.prop_id || ''}')">${p.prop_id || '#' + p.id}</span></td>
                 <td style="cursor: text;">
                   <strong contenteditable="true" class="editable-cell" onblur="updatePropertyInline(${p.id}, 'society', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.society}</strong>
                   ${(!p.status || p.status.toUpperCase() === 'AVAILABLE') ? `<br><span class="chip ch-gold btn-sm" style="font-size:8px; font-weight:700; background:rgba(46, 204, 113, 0.2); border:0.5px solid var(--green); color:var(--green); margin-top:4px; display:inline-block;">🟢 AVAILABLE</span>` : ''}
                   ${p.special_tags ? p.special_tags.split(',').map(tag => `<br><span class="chip chip-warm btn-sm" style="font-size:8px; font-weight:600; margin-top:2px; display:inline-block;">🏷️ ${tag.trim()}</span>`).join('') : ''}
                   ${p.sync_status && p.sync_status !== 'NOT_SYNCED' ? `<br><span class="portal-sync-badge" style="margin-top:4px;"><i class="ti ti-world"></i> ${p.sync_status}</span>` : ''}
                 </td>
                 <td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'location', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.location}</td>
                 ${showCol('rental', 'type') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'configuration', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.configuration}</td>` : ''}
                 ${showCol('rental', 'area') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'area_sqft', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.area_sqft}</td>` : ''}
                 ${showCol('rental', 'rent') ? `<td contenteditable="true" class="editable-cell" style="color:var(--green); font-weight:600; cursor: text;" onblur="updatePropertyInline(${p.id}, 'price', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${formatPriceToWords(p.price)}</td>` : ''}
                 ${showCol('rental', 'deposit') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'deposit', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.deposit || 0}</td>` : ''}
                 ${showCol('rental', 'maintenance') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'maintenance', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.maintenance || 0}</td>` : ''}
                 ${showCol('rental', 'available') ? `<td>${p.available_from || 'Immediate'}</td>` : ''}
                 ${showCol('rental', 'interiors') ? `<td>${p.interiors}</td>` : ''}
                 ${showCol('rental', 'facing') ? `<td>${p.facing || 'East'}</td>` : ''}
                 ${showCol('rental', 'zone') ? `<td>${p.zone || 'N'}</td>` : ''}
                 <td>
                  <div style="display:flex; gap:4px;">
                    ${state.systemSettings.showMaskedFields ? 
                      `<button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="togglePrivateContact(${p.id})">📞 Contacts</button>` : 
                      `<button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px; opacity:0.5;" disabled title="Locked in Employee Mode">🔒 Locked</button>`
                    }
                    <button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px; color:var(--gold-l);" onclick="editFullProperty(${p.id})"><i class="ti ti-edit"></i> Edit</button>
                    <button class="btn btn-primary btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="showShareModal(${p.id})">📢 Share</button>
                    <button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="cloneProperty(${p.id})">📋 Clone</button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:9.5px; padding:2px 6px;" onclick="promptAddTag(${p.id}, 'properties')">+ Tag</button>
                    <button class="btn btn-d btn-sm" style="font-size:9.5px; padding:2px 6px; color:var(--red);" onclick="deletePropertyListing(${p.id})">✕</button>
                  </div>
                </td>
              </tr>
              ${state.systemSettings.showMaskedFields ? `
              <tr id="private-contact-row-${p.id}" style="display:none; background: rgba(212, 175, 55, 0.04);">
                <td colspan="12" style="padding:10px;">
                  <div style="display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; align-items:center;">
                    <div>
                      🔐 <strong>Direct Contact Details:</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Owner: <strong>${p.owner_name}</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Phone: <strong>${p.owner_phone}</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Email: <strong>${p.owner_email || 'N/A'}</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Unit No: <strong>${p.unit_no || 'N/A'}</strong>
                    </div>
                    <div>
                      🤝 <strong>Link Associate:</strong>
                      <select class="form-select btn-sm" style="display:inline-block; font-size:11px; padding: 2px 6px; width: 160px; margin-left:8px;" onchange="linkAssociateToProperty(${p.id}, this.value)">
                        <option value="">-- Link Co-Broker --</option>
                        ${state.associates.map(a => `<option value="${a.id}" ${p.associate_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                </td>
              </tr>
              ` : ''}
            `).join('')}
          </tbody>
          </table>
        </div>
      `;
    }
  container.innerHTML += renderPaginationBar('rental', rentalPage, rentalTotalPages);
}

function renderCommercialProperties(listings) {
  const container = document.getElementById('inventory-commercial-container');
  
  if (listings.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-txt">No active commercial listings matched.</div></div>`;
    return;
  }

  const itemsPerPage = 50;
  const commercialPage = state.propPages.commercial || 1;
  const commercialTotalPages = Math.ceil(listings.length / itemsPerPage) || 1;
  const commercialStart = (commercialPage - 1) * itemsPerPage;
  const slicedListings = listings.slice(commercialStart, commercialStart + itemsPerPage);

  if (state.viewModes.commercial === 'card') {
    container.innerHTML = slicedListings.map(p => `
      <div class="inv-item" style="border-left: 3.5px solid var(--purple) !important;">
        <div style="position: absolute; top: 12px; right: 12px; z-index: 10;"><input type="checkbox" class="row-checkbox-commercial" value="${p.id}" onchange="updateBulkSelectionState('commercial')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()"></div>
        <div class="inv-row">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="inv-name" style="font-size: 16px; font-weight: 700; color:var(--gold-l);">${p.society}</span>
              <span class="chip chip-cold btn-sm" style="font-size:9.5px; background:var(--purple-light); color:var(--purple); cursor:pointer;" onclick="editID('properties', ${p.id}, '${p.prop_id || ''}')">ID: ${p.prop_id || '#' + p.id}</span>
              ${p.mandate_type === 'Exclusive' ? `<span class="chip ch-gold btn-sm" style="font-size:9px; font-weight:700; background:rgba(212, 175, 55,0.2); border:0.5px solid var(--gold); color:var(--gold-l);">👑 EXCLUSIVE</span>` : ''}
              ${(()=>{ const s=(p.status||'AVAILABLE').toUpperCase(); if(s==='AVAILABLE') return `<span class="chip chip-available btn-sm" style="font-size:9px;font-weight:700;background:rgba(46,204,113,0.2);border:0.5px solid var(--green);color:var(--green);">🟢 AVAILABLE</span>`; if(s==='SOLD') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(192,57,43,0.2);border:0.5px solid var(--red);color:var(--red);">🔴 SOLD</span>`; if(s==='ON HOLD') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(230,126,34,0.2);border:0.5px solid #e67e22;color:#e67e22;">🟠 ON HOLD</span>`; if(s==='WITHDRAWN') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(127,140,141,0.2);border:0.5px solid #7f8c8d;color:#7f8c8d;">⚫ WITHDRAWN</span>`; if(s==='EXPIRED') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(192,57,43,0.1);border:0.5px solid #c0392b;color:#c0392b;opacity:0.7;">🔕 EXPIRED</span>`; if(s==='RESERVED') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(52,152,219,0.2);border:0.5px solid var(--blue);color:var(--blue-light);">🔵 RESERVED</span>`; return ''; })()}
              ${p.associate_id ? `<span class="chip ch-gold btn-sm" style="font-size:9px; font-weight:700; background:rgba(52, 152, 219, 0.2); border:0.5px solid var(--blue); color:var(--blue-light);">🏢 Associate: ${p.associate_name || 'Network Broker'}</span>` : ''}
              ${p.special_tags ? p.special_tags.split(',').map(tag => `<span class="chip chip-warm btn-sm" style="font-size:9px; font-weight:600;">🏷️ ${tag.trim()}</span>`).join(' ') : ''}
              ${p.sync_status && p.sync_status !== 'NOT_SYNCED' ? `<span class="portal-sync-badge"><i class="ti ti-world"></i> ${p.sync_status}</span>` : ''}
            </div>
            <div class="inv-loc" style="margin-top:6px; font-size:12px;">📍 Location: <strong>${p.location}</strong> · Available For: <strong style="color:var(--purple)">${p.available_for || 'Rent / Lease'}</strong></div>
          </div>
          <div style="text-align:right; padding-right: 35px;">
            <div class="inv-price" style="font-size:18px; color:var(--green); font-weight:800;">${formatPriceToWords(p.price)}</div>
            <div class="inv-upd" style="font-size:11px; color:var(--text-muted);">Handover: ${p.possession || 'Immediate'}</div>
          </div>
        </div>
        
        <!-- Premium 3-column Metadata Grid -->
        <div class="metadata-grid-3">
          <div class="metadata-item">
            <span class="metadata-label">📐 Super Area</span>
            <span class="metadata-value">${p.area_sqft} Sqft</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">📏 Plot Size</span>
            <span class="metadata-value">${p.plot_size || 'N/A'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🛋️ Interiors</span>
            <span class="metadata-value">${p.interiors}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🔑 Deposit</span>
            <span class="metadata-value">₹${(p.deposit || 0).toLocaleString()}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">💳 Maintenance fee</span>
            <span class="metadata-value">₹${(p.maintenance || 0).toLocaleString()}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🚗 Car Park</span>
            <span class="metadata-value">${p.car_park || 'N/A'}</span>
          </div>
        </div>

        <!-- Activity Summary Indicators -->
        <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px;">
          ${parseInt(p.total_shares || 0) > 0 ? `
            <span class="chip" style="background: rgba(184, 134, 11, 0.12); border: 0.5px solid rgba(184, 134, 11, 0.4); color: var(--gold-l); cursor: pointer; border-radius: 4px; padding: 2px 6px;" title="Shared with: ${p.shared_with_list || 'N/A'}" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}'); event.stopPropagation();">
              📢 Shared: <strong>${p.total_shares}x</strong> (${p.shared_with_list || 'N/A'})
            </span>
          ` : `
            <span class="chip" style="background: rgba(255, 255, 255, 0.02); border: 0.5px solid rgba(255, 255, 255, 0.06); color: var(--text-muted); opacity: 0.6; border-radius: 4px; padding: 2px 6px;">
              📢 No shares
            </span>
          `}
          
          ${parseInt(p.total_visits || 0) > 0 ? `
            <span class="chip" style="background: rgba(46, 204, 113, 0.12); border: 0.5px solid rgba(46, 204, 113, 0.4); color: var(--green); cursor: pointer; border-radius: 4px; padding: 2px 6px;" title="Visits by: ${p.visiting_agents_list || 'N/A'}" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}'); event.stopPropagation();">
              🚶 Visits: <strong>${p.total_visits}</strong> (Agents: ${p.visiting_agents_list || 'Direct/Unknown'})
            </span>
          ` : `
            <span class="chip" style="background: rgba(255, 255, 255, 0.02); border: 0.5px solid rgba(255, 255, 255, 0.06); color: var(--text-muted); opacity: 0.6; border-radius: 4px; padding: 2px 6px;">
              🚶 No visits
            </span>
          `}
        </div>

        <div class="inv-tags" style="margin-top:12px;">
          <span class="tag tag-primary" style="background:var(--purple); color:white;">${p.mandate_type || 'Open'} Mandate</span>
          <span class="tag tag-secondary">Interiors: ${p.interiors}</span>
          <span class="tag tag-avail">RERA checked</span>
          ${(p.special_tags || '').split(',').filter(t => t.trim() !== '').map(tag => `
            <span class="tag" style="background:rgba(255,255,255,0.05); color:var(--gold-l); border: 0.5px solid var(--border);">${tag.trim()}</span>
          `).join('')}
          <span class="tag" style="background:rgba(212, 175, 55,0.15); color:var(--gold-l); border: 1.5px dashed var(--gold); cursor:pointer; font-weight:700;" onclick="promptAddTag(${p.id}, 'properties')">+ Tag</span>
        </div>

        <div class="act-row" style="margin-top: 12px; display:flex; gap:8px;">
          ${state.systemSettings.showMaskedFields ? 
            `<button class="btn btn-ghost btn-sm" onclick="togglePrivateContact(${p.id})">📞 View Owner Contacts</button>` : 
            `<span class="tag" style="background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 8px; font-size: 11px; cursor: not-allowed;"><i class="ti ti-lock"></i> Contacts & Docs Locked</span>`
          }
          <button class="btn btn-ghost btn-sm" style="color:var(--gold-l);" onclick="editFullProperty(${p.id})"><i class="ti ti-edit"></i> Edit</button>
          <button class="btn btn-primary btn-sm" onclick="showShareModal(${p.id})">📢 Share Pitch</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--blue-light);" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}', 'Commercial')"><i class="ti ti-history"></i> Activity Log</button>
          <button class="btn btn-ghost btn-sm" onclick="cloneProperty(${p.id})">📋 Clone</button>
          <button class="btn btn-ghost btn-sm" onclick="printPropertyCard(${p.id})">🖨️ Print</button>
          ${p.video_link ? `<a class="btn btn-ghost btn-sm" href="${p.video_link}" target="_blank">🔗 Video Link</a>` : ''}
          ${p.google_map_url ? `<a class="btn btn-ghost btn-sm" href="${p.google_map_url}" target="_blank" style="color:#3498db;">🗺️ Map</a>` : ''}
          ${(!p.status || p.status.toUpperCase() === 'AVAILABLE' || p.status.toUpperCase() === 'ON HOLD') ? `<button class="btn btn-sm" style="background:rgba(46,204,113,0.15);border:1px solid var(--green);color:var(--green);font-size:11px;padding:4px 10px;" onclick="closureDeal(${p.id},'${(p.society || '').replace(/'/g,"\\'")}','${p.property_type || ''}')">🏁 Close Deal</button>` : ''}
          <button class="btn btn-d btn-sm" onclick="deletePropertyListing(${p.id})" style="padding: 4px 10px; font-size:11px;">✕ Delete</button>
        </div>

        <!-- Private Contact Card -->
        ${state.systemSettings.showMaskedFields ? `
        <div id="private-contact-${p.id}" style="display: none; margin-top: 12px; padding: 12px; background: rgba(212, 175, 55, 0.08); border-radius: var(--radius-sm); border: 1px dashed var(--gold)">
          <div style="font-size: 13px; font-weight:700; color:var(--gold-l); margin-bottom: 6px;">🔐 Security Audited Contact Sheet:</div>
          <div class="grid3" style="font-size:12px; margin-bottom: 8px;">
            <div>Direct Owner Name: <strong>${p.owner_name}</strong></div>
            <div>Direct Phone Number: <strong>${p.owner_phone}</strong></div>
            <div>Owner Email: <strong>${p.owner_email || 'N/A'}</strong></div>
            <div>Khata Staging: <strong>${p.registration_status || 'Verified'}</strong></div>
            <div>Unit No: <strong>${p.unit_no || 'N/A'}</strong></div>
            <div style="color:var(--gold-l);">Commission: <strong>${p.commission_agreed || 'N/A'}</strong></div>
          </div>
          
          <!-- Co-Broker associate linking select -->
          <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
            🤝 <strong>Link Co-Broker Associate:</strong>
            <select class="form-select btn-sm" style="margin-top: 6px; font-size:11px; padding: 4px 8px; width: 100%; border: 0.5px solid var(--border);" onchange="linkAssociateToProperty(${p.id}, this.value)">
              <option value="">-- No Associate Broker Linked --</option>
              ${state.associates.map(a => `<option value="${a.id}" ${p.associate_id === a.id ? 'selected' : ''}>${a.name} (${a.company || 'Broker'})</option>`).join('')}
            </select>
          </div>
        </div>
        ` : ''}
      </div>
    `).join('');
  } else {
    // TABLE VIEW
    container.innerHTML = `
      <div class="tw" style="margin-top: 10px;">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width: 40px;"><input type="checkbox" id="check-all-commercial" onchange="toggleAllRowCheckboxes('commercial', this.checked)"></th>
              <th>ID</th>
              <th>Building / Society</th>
              <th>Location</th>
              ${showCol('commercial', 'type') ? `<th>Type</th>` : ''}
              ${showCol('commercial', 'available') ? `<th>Available For</th>` : ''}
              ${showCol('commercial', 'area') ? `<th>Super Area</th>` : ''}
              ${showCol('commercial', 'price') ? `<th>Rent / Price</th>` : ''}
              ${showCol('commercial', 'deposit') ? `<th>Deposit</th>` : ''}
              ${showCol('commercial', 'maintenance') ? `<th>Maintenance</th>` : ''}
              ${showCol('commercial', 'handover') ? `<th>Handover</th>` : ''}
              ${showCol('commercial', 'zone') ? `<th>Zone</th>` : ''}
              ${showCol('commercial', 'facing') ? `<th>Facing</th>` : ''}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${slicedListings.map(p => `
              <tr>
                <td><input type="checkbox" class="row-checkbox-commercial" value="${p.id}" onchange="updateBulkSelectionState('commercial')"></td>
                <td><span class="chip chip-cold btn-sm" style="font-size:9px; cursor:pointer;" onclick="editID('properties', ${p.id}, '${p.prop_id || ''}')">${p.prop_id || '#' + p.id}</span></td>
                 <td style="cursor: text;">
                   <strong contenteditable="true" class="editable-cell" onblur="updatePropertyInline(${p.id}, 'society', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.society}</strong>
                   ${(!p.status || p.status.toUpperCase() === 'AVAILABLE') ? `<br><span class="chip ch-gold btn-sm" style="font-size:8px; font-weight:700; background:rgba(46, 204, 113, 0.2); border:0.5px solid var(--green); color:var(--green); margin-top:4px; display:inline-block;">🟢 AVAILABLE</span>` : ''}
                   ${p.special_tags ? p.special_tags.split(',').map(tag => `<br><span class="chip chip-warm btn-sm" style="font-size:8px; font-weight:600; margin-top:2px; display:inline-block;">🏷️ ${tag.trim()}</span>`).join('') : ''}
                   ${p.sync_status && p.sync_status !== 'NOT_SYNCED' ? `<br><span class="portal-sync-badge" style="margin-top:4px;"><i class="ti ti-world"></i> ${p.sync_status}</span>` : ''}
                 </td>
                 <td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'location', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.location}</td>
                 ${showCol('commercial', 'type') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'property_type', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.property_type}</td>` : ''}
                 ${showCol('commercial', 'available') ? `<td contenteditable="true" class="editable-cell" style="color:var(--purple); font-weight:600; cursor: text;" onblur="updatePropertyInline(${p.id}, 'available_for', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.available_for || 'Lease'}</td>` : ''}
                 ${showCol('commercial', 'area') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'area_sqft', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.area_sqft} Sqft</td>` : ''}
                 ${showCol('commercial', 'price') ? `<td contenteditable="true" class="editable-cell" style="color:var(--green); font-weight:600; cursor: text;" onblur="updatePropertyInline(${p.id}, 'price', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${formatPriceToWords(p.price)}</td>` : ''}
                 ${showCol('commercial', 'deposit') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'deposit', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.deposit || 0}</td>` : ''}
                 ${showCol('commercial', 'maintenance') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'maintenance', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.maintenance || 0}</td>` : ''}
                 ${showCol('commercial', 'handover') ? `<td>${p.possession || 'Immediate'}</td>` : ''}
                 ${showCol('commercial', 'zone') ? `<td>${p.zone || 'N'}</td>` : ''}
                 ${showCol('commercial', 'facing') ? `<td>${p.facing || 'N/A'}</td>` : ''}
                 <td>
                  <div style="display:flex; gap:4px;">
                    ${state.systemSettings.showMaskedFields ? 
                      `<button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="togglePrivateContact(${p.id})">📞 Contacts</button>` : 
                      `<button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px; opacity:0.5;" disabled title="Locked in Employee Mode">🔒 Locked</button>`
                    }
                    <button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px; color:var(--gold-l);" onclick="editFullProperty(${p.id})"><i class="ti ti-edit"></i> Edit</button>
                    <button class="btn btn-primary btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="showShareModal(${p.id})">📢 Share</button>
                    <button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="cloneProperty(${p.id})">📋 Clone</button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:9.5px; padding:2px 6px;" onclick="promptAddTag(${p.id}, 'properties')">+ Tag</button>
                    <button class="btn btn-d btn-sm" style="font-size:9.5px; padding:2px 6px; color:var(--red);" onclick="deletePropertyListing(${p.id})">✕</button>
                  </div>
                </td>
              </tr>
              ${state.systemSettings.showMaskedFields ? `
              <tr id="private-contact-row-${p.id}" style="display:none; background: rgba(212, 175, 55, 0.04);">
                <td colspan="12" style="padding:10px;">
                  <div style="display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; align-items:center;">
                    <div>
                      🔐 <strong>Direct Contact Details:</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Owner: <strong>${p.owner_name}</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Phone: <strong>${p.owner_phone}</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Email: <strong>${p.owner_email || 'N/A'}</strong>
                      &nbsp;&nbsp;|&nbsp;&nbsp;Unit No: <strong>${p.unit_no || 'N/A'}</strong>
                    </div>
                    <div>
                      🤝 <strong>Link Associate:</strong>
                      <select class="form-select btn-sm" style="display:inline-block; font-size:11px; padding: 2px 6px; width: 160px; margin-left:8px;" onchange="linkAssociateToProperty(${p.id}, this.value)">
                        <option value="">-- Link Co-Broker --</option>
                        ${state.associates.map(a => `<option value="${a.id}" ${p.associate_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                </td>
              </tr>
              ` : ''}
            `).join('')}
          </tbody>
          </table>
        </div>
      `;
    }
  container.innerHTML += renderPaginationBar('commercial', commercialPage, commercialTotalPages);
}

function renderLandProperties(listings) {
  const container = document.getElementById('inventory-land-container');
  if (!container) return;

  if (listings.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-txt">No active land / plot listings matched.</div></div>`;
    return;
  }

  const itemsPerPage = 50;
  const landPage = state.propPages.land || 1;
  const landTotalPages = Math.ceil(listings.length / itemsPerPage) || 1;
  const landStart = (landPage - 1) * itemsPerPage;
  const slicedListings = listings.slice(landStart, landStart + itemsPerPage);

  if (state.viewModes.land === 'card') {
    container.innerHTML = slicedListings.map(p => `
      <div class="inv-item" style="border-left: 3.5px solid var(--green) !important;">
        <div style="position: absolute; top: 12px; right: 12px; z-index: 10;"><input type="checkbox" class="row-checkbox-land" value="${p.id}" onchange="updateBulkSelectionState('land')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()"></div>
        <div class="inv-row">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="inv-name" style="font-size: 16px; font-weight: 700; color:var(--gold-l);">${p.society}</span>
              <span class="chip chip-cold btn-sm" style="font-size:9.5px; background:rgba(46,204,113,0.15); color:var(--green); cursor:pointer;" onclick="editID('properties', ${p.id}, '${p.prop_id || ''}')">ID: ${p.prop_id || '#' + p.id}</span>
              ${p.mandate_type === 'Exclusive' ? `<span class="chip ch-gold btn-sm" style="font-size:9px; font-weight:700; background:rgba(212, 175, 55,0.2); border:0.5px solid var(--gold); color:var(--gold-l);">👑 EXCLUSIVE</span>` : ''}
              ${(()=>{ const s=(p.status||'AVAILABLE').toUpperCase(); if(s==='AVAILABLE') return `<span class="chip chip-available btn-sm" style="font-size:9px;font-weight:700;background:rgba(46,204,113,0.2);border:0.5px solid var(--green);color:var(--green);">🟢 AVAILABLE</span>`; if(s==='SOLD') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(192,57,43,0.2);border:0.5px solid var(--red);color:var(--red);">🔴 SOLD</span>`; if(s==='ON HOLD') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(230,126,34,0.2);border:0.5px solid #e67e22;color:#e67e22;">🟠 ON HOLD</span>`; if(s==='WITHDRAWN') return `<span class="chip btn-sm" style="font-size:9px;font-weight:700;background:rgba(127,140,141,0.2);border:0.5px solid #7f8c8d;color:#7f8c8d;">⚫ WITHDRAWN</span>`; return ''; })()}
              ${p.associate_id ? `<span class="chip ch-gold btn-sm" style="font-size:9px; font-weight:700; background:rgba(52, 152, 219, 0.2); border:0.5px solid var(--blue); color:var(--blue-light);">🏢 Associate: ${p.associate_name || 'Network Broker'}</span>` : ''}
              ${p.special_tags ? p.special_tags.split(',').map(tag => `<span class="chip chip-warm btn-sm" style="font-size:9px; font-weight:600;">🏷️ ${tag.trim()}</span>`).join(' ') : ''}
            </div>
            <div class="inv-loc" style="margin-top:6px; font-size:12px;">📍 Location: <strong>${p.location}</strong> · Type: <strong>${p.property_type || 'Land / Plot'}</strong></div>
          </div>
          <div style="text-align:right; padding-right: 35px;">
            <div class="inv-price" style="font-size:18px; color:var(--green); font-weight:800;">${formatPriceToWords(p.price)}</div>
            <div class="inv-upd" style="font-size:11px; color:var(--text-muted);">Updated: ${new Date(p.last_updated).toLocaleDateString()}</div>
          </div>
        </div>
        
        <!-- Land Metrics Grid -->
        <div class="metadata-grid-3" style="margin-top: 10px;">
          <div class="metadata-item">
            <span class="metadata-label">📐 Area (Sqft)</span>
            <span class="metadata-value">${p.area_sqft} Sqft</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">📏 Dimensions</span>
            <span class="metadata-value">${p.plot_dimension || p.plot_size || 'N/A'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🧱 Zoning</span>
            <span class="metadata-value">${p.configuration || 'N/A'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🚪 Facing</span>
            <span class="metadata-value">${p.plot_facing || 'N/A'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">📜 Approval Status</span>
            <span class="metadata-value">${p.registration_status || 'N/A'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">🏷️ Plot / Survey No</span>
            <span class="metadata-value">${p.unit_no || 'N/A'}</span>
          </div>
        </div>

        <!-- Activity Summary Indicators -->
        <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px;">
          ${parseInt(p.total_shares || 0) > 0 ? `
            <span class="chip" style="background: rgba(184, 134, 11, 0.12); border: 0.5px solid rgba(184, 134, 11, 0.4); color: var(--gold-l); cursor: pointer; border-radius: 4px; padding: 2px 6px;" title="Shared with: ${p.shared_with_list || 'N/A'}" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}'); event.stopPropagation();">
              📢 Shared: <strong>${p.total_shares}x</strong> (${p.shared_with_list || 'N/A'})
            </span>
          ` : `
            <span class="chip" style="background: rgba(255, 255, 255, 0.02); border: 0.5px solid rgba(255, 255, 255, 0.06); color: var(--text-muted); opacity: 0.6; border-radius: 4px; padding: 2px 6px;">
              📢 No shares
            </span>
          `}
          
          ${parseInt(p.total_visits || 0) > 0 ? `
            <span class="chip" style="background: rgba(46, 204, 113, 0.12); border: 0.5px solid rgba(46, 204, 113, 0.4); color: var(--green); cursor: pointer; border-radius: 4px; padding: 2px 6px;" title="Visits by: ${p.visiting_agents_list || 'N/A'}" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}'); event.stopPropagation();">
              🚶 Visits: <strong>${p.total_visits}</strong> (Agents: ${p.visiting_agents_list || 'Direct/Unknown'})
            </span>
          ` : `
            <span class="chip" style="background: rgba(255, 255, 255, 0.02); border: 0.5px solid rgba(255, 255, 255, 0.06); color: var(--text-muted); opacity: 0.6; border-radius: 4px; padding: 2px 6px;">
              🚶 No visits
            </span>
          `}
        </div>

        <div class="inv-tags" style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; gap:6px;">
            <span class="tag tag-primary">${p.mandate_type || 'Open'} Mandate</span>
            <span class="tag tag-avail">RERA checked</span>
            ${p.commission_agreed ? `<span class="tag tag-secondary" style="color:var(--gold-l);">Commission: ${p.commission_agreed}</span>` : ''}
          </div>
          <div style="display:flex; gap:6px;">
            ${p.google_map_url ? `<a class="btn btn-ghost btn-sm" href="${p.google_map_url}" target="_blank" style="color:#3498db; font-size:11px; padding:2px 6px;">🗺️ Map</a>` : ''}
            <button class="btn btn-ghost btn-sm" style="font-size:11px; padding:2px 6px;" onclick="printPropertyCard(${p.id})">🖨️ Print</button>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border); margin-top: 12px; padding-top: 10px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:6px;">
            ${state.systemSettings.showMaskedFields ? 
              `<button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="togglePrivateContact(${p.id})"><i class="ti ti-phone"></i> Contacts</button>` : 
              `<button class="btn btn-ghost btn-sm" style="font-size:11px; opacity:0.5;" disabled>🔒 Masked Owner</button>`
            }
            <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:11px;" onclick="editFullProperty(${p.id})"><i class="ti ti-edit"></i> Edit</button>
            <button class="btn btn-primary btn-sm" style="font-size:11px;" onclick="showShareModal(${p.id})">📢 Share</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--blue-light); font-size:11px;" onclick="showPropertyActivity(${p.id}, '${(p.society || '').replace(/'/g,"\\'")}', 'Land')"><i class="ti ti-history"></i> Activity</button>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="cloneProperty(${p.id})"><i class="ti ti-copy"></i> Clone</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:11px;" onclick="promptAddTag(${p.id}, 'properties')">+ Tag</button>
          </div>
          <button class="btn btn-ghost btn-sm" style="color:var(--red); font-size:11px; border:1px solid rgba(192,57,43,0.3);" onclick="deletePropertyListing(${p.id})"><i class="ti ti-trash"></i> Delete</button>
        </div>

        ${state.systemSettings.showMaskedFields ? `
        <div id="private-contact-${p.id}" class="private-info" style="display:none; background:rgba(212, 175, 55, 0.04); margin-top:10px; padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; gap:15px; flex-wrap:wrap; align-items:center;">
            <div>
              🔐 <strong>Owner Details:</strong> ${p.owner_name || 'N/A'} &nbsp;|&nbsp; 
              Phone: <strong>${p.owner_phone || 'N/A'}</strong> &nbsp;|&nbsp;
              Email: <strong>${p.owner_email || 'N/A'}</strong> &nbsp;|&nbsp;
              Plot No: <strong>${p.unit_no || 'N/A'}</strong>
            </div>
            <div>
              🤝 <strong>Link Associate:</strong>
              <select class="form-select btn-sm" style="display:inline-block; font-size:11px; padding: 2px 6px; width: 160px;" onchange="linkAssociateToProperty(${p.id}, this.value)">
                <option value="">-- Link Co-Broker --</option>
                ${state.associates.map(a => `<option value="${a.id}" ${p.associate_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
              </select>
            </div>
          </div>
          ${p.admin_comments ? `<div style="margin-top:6px; font-size:11px; color:#ff7675;"><strong>Admin Comments:</strong> ${p.admin_comments}</div>` : ''}
          ${p.comments ? `<div style="margin-top:4px; font-size:11px; color:var(--text-muted);"><strong>Private Comments:</strong> ${p.comments}</div>` : ''}
        </div>
        ` : ''}
      </div>
    `).join('');
  } else {
    container.innerHTML = `
      <div class="tw">
        <table class="tbl">
        <thead>
          <tr>
            <th><input type="checkbox" onchange="toggleSelectAllRows('land', this)"></th>
            <th>Prop ID</th>
            <th>Society / Layout</th>
            <th>Location</th>
            ${showCol('land', 'type') ? `<th>Type</th>` : ''}
            ${showCol('land', 'zoning') ? `<th>Zoning</th>` : ''}
            ${showCol('land', 'area') ? `<th>Area (Sqft)</th>` : ''}
            ${showCol('land', 'price') ? `<th>Price</th>` : ''}
            ${showCol('land', 'dimensions') ? `<th>Dimensions</th>` : ''}
            ${showCol('land', 'facing') ? `<th>Facing</th>` : ''}
            ${showCol('land', 'roadwidth') ? `<th>Road Width</th>` : ''}
            ${showCol('land', 'fsi') ? `<th>FSI Allowed</th>` : ''}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${slicedListings.map(p => `
            <tr>
              <td><input type="checkbox" class="row-checkbox-land" value="${p.id}" onchange="updateBulkSelectionState('land')"></td>
              <td><span class="chip chip-cold btn-sm" style="font-size:9px; cursor:pointer;" onclick="editID('properties', ${p.id}, '${p.prop_id || ''}')">${p.prop_id || '#' + p.id}</span></td>
              <td style="cursor: text;">
                <strong contenteditable="true" class="editable-cell" onblur="updatePropertyInline(${p.id}, 'society', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.society}</strong>
                ${(!p.status || p.status.toUpperCase() === 'AVAILABLE') ? `<br><span class="chip chip-available btn-sm" style="font-size:8px; font-weight:700; background:rgba(46, 204, 113, 0.2); border:0.5px solid var(--green); color:var(--green); margin-top:4px; display:inline-block;">🟢 AVAILABLE</span>` : ''}
              </td>
              <td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'location', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.location}</td>
              ${showCol('land', 'type') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'property_type', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.property_type}</td>` : ''}
              ${showCol('land', 'zoning') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'configuration', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.configuration || 'Residential'}</td>` : ''}
              ${showCol('land', 'area') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'area_sqft', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.area_sqft} Sqft</td>` : ''}
              ${showCol('land', 'price') ? `<td contenteditable="true" class="editable-cell" style="color:var(--green); font-weight:600; cursor: text;" onblur="updatePropertyInline(${p.id}, 'price', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${formatPriceToWords(p.price)}</td>` : ''}
              ${showCol('land', 'dimensions') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'plot_dimension', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.plot_dimension || 'N/A'}</td>` : ''}
              ${showCol('land', 'facing') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'plot_facing', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.plot_facing || 'N/A'}</td>` : ''}
              ${showCol('land', 'roadwidth') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'road_width', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.road_width || 'N/A'}</td>` : ''}
              ${showCol('land', 'fsi') ? `<td contenteditable="true" class="editable-cell" style="cursor: text;" onblur="updatePropertyInline(${p.id}, 'fsi', this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${p.fsi || 'N/A'}</td>` : ''}
              <td>
                <div style="display:flex; gap:4px;">
                  ${state.systemSettings.showMaskedFields ? 
                    `<button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="togglePrivateContact(${p.id})">📞 Contacts</button>` : 
                    `<button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px; opacity:0.5;" disabled>🔒 Locked</button>`
                  }
                  <button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px; color:var(--gold-l);" onclick="editFullProperty(${p.id})"><i class="ti ti-edit"></i> Edit</button>
                  <button class="btn btn-primary btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="showShareModal(${p.id})">📢 Share</button>
                  <button class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px;" onclick="cloneProperty(${p.id})">📋 Clone</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:9.5px; padding:2px 6px;" onclick="promptAddTag(${p.id}, 'properties')">+ Tag</button>
                  <button class="btn btn-d btn-sm" style="font-size:9.5px; padding:2px 6px; color:var(--red);" onclick="deletePropertyListing(${p.id})">✕</button>
                </div>
              </td>
            </tr>
            ${state.systemSettings.showMaskedFields ? `
            <tr id="private-contact-row-${p.id}" style="display:none; background: rgba(212, 175, 55, 0.04);">
              <td colspan="12" style="padding:10px;">
                <div style="display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; align-items:center;">
                  <div>
                    🔐 <strong>Direct Contact Details:</strong>
                    &nbsp;&nbsp;|&nbsp;&nbsp;Owner: <strong>${p.owner_name}</strong>
                    &nbsp;&nbsp;|&nbsp;&nbsp;Phone: <strong>${p.owner_phone}</strong>
                    &nbsp;&nbsp;|&nbsp;&nbsp;Email: <strong>${p.owner_email || 'N/A'}</strong>
                    &nbsp;&nbsp;|&nbsp;&nbsp;Plot No: <strong>${p.unit_no || 'N/A'}</strong>
                  </div>
                  <div>
                    🤝 <strong>Link Associate:</strong>
                    <select class="form-select btn-sm" style="display:inline-block; font-size:11px; padding: 2px 6px; width: 160px; margin-left:8px;" onchange="linkAssociateToProperty(${p.id}, this.value)">
                      <option value="">-- Link Co-Broker --</option>
                      ${state.associates.map(a => `<option value="${a.id}" ${p.associate_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                    </select>
                  </div>
                </div>
              </td>
            </tr>
            ` : ''}
          `).join('')}
        </tbody>
        </table>
      </div>
    `;
  }
  container.innerHTML += renderPaginationBar('land', landPage, landTotalPages);
}

function togglePrivateContact(id) {
  const div = document.getElementById(`private-contact-${id}`);
  if (div) {
    div.style.display = div.style.display === 'none' ? 'block' : 'none';
  }
  
  const row = document.getElementById(`private-contact-row-${id}`);
  if (row) {
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
  }
}

function clearInventoryFilters() {
  if (document.getElementById('filter-prop-search')) document.getElementById('filter-prop-search').value = '';
  if (document.getElementById('filter-prop-price-min')) document.getElementById('filter-prop-price-min').value = '';
  if (document.getElementById('filter-prop-price-max')) document.getElementById('filter-prop-price-max').value = '';
  if (document.getElementById('filter-prop-mandate')) document.getElementById('filter-prop-mandate').value = '';
  if (document.getElementById('filter-prop-interiors')) document.getElementById('filter-prop-interiors').value = '';
  if (document.getElementById('filter-prop-recency')) document.getElementById('filter-prop-recency').value = '';
  if (document.getElementById('filter-prop-type')) document.getElementById('filter-prop-type').value = '';
  if (document.getElementById('filter-prop-facing')) document.getElementById('filter-prop-facing').value = '';
  if (document.getElementById('filter-prop-status')) document.getElementById('filter-prop-status').value = '';
  if (document.getElementById('filter-prop-registration')) document.getElementById('filter-prop-registration').value = '';
  if (document.getElementById('filter-prop-zone')) document.getElementById('filter-prop-zone').value = '';
  if (document.getElementById('filter-prop-holder-type')) document.getElementById('filter-prop-holder-type').value = '';
  
  // Clear BHK checkboxes
  document.querySelectorAll('.filter-bhk-check').forEach(cb => {
    cb.checked = false;
  });
  
  loadProperties();
}

function syncSpecialFlags() {
  const tagsInput = document.getElementById('prop-tags');
  if (!tagsInput) return;
  const existing = tagsInput.value.split(',').map(t => t.trim()).filter(t =>
    t !== 'Distress Sale' && t !== 'Bank Auction' && t !== 'Below Market Value' && t
  );
  if (document.getElementById('prop-flag-distress')?.checked) existing.push('Distress Sale');
  if (document.getElementById('prop-flag-bank')?.checked) existing.push('Bank Auction');
  if (document.getElementById('prop-flag-belowmkt')?.checked) existing.push('Below Market Value');
  tagsInput.value = existing.join(', ');
}

// ─── CLOSURE JOURNEY: Mark inventory as Sold / Rented ───
function closureDeal(propId, propName, propType) {
  const p = state.properties.find(x => x.id === propId);
  if (!p) return;
  const isRental = propType && propType.toLowerCase().includes('rental') || (p.available_for && p.available_for.toLowerCase().includes('rent')) || (p.available_for && p.available_for.toLowerCase().includes('lease'));
  
  const closureHTML = `
    <div class="mbg" id="modal-closure-journey" style="display:flex; z-index:200000; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85);">
      <div class="modal" style="max-width: 680px; width: 90%; display:flex; flex-direction:column; overflow:hidden;">
        <div class="mhd" style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid var(--border);">
          <div class="mtitle" style="font-size:16px; font-weight:800; color:var(--gold-l); display:flex; align-items:center; gap:8px;">
            🏁 Deal Flow & Closure Journey: <span id="prop-closure-current-status" style="font-weight:800;">Available</span>
          </div>
          <button class="mclose" onclick="closeModal('modal-closure-journey')" style="background:none; border:none; color:#aaa; font-size:24px; cursor:pointer;">&times;</button>
        </div>
        
        <div class="mbdy" style="padding:20px; overflow-y:auto; max-height:75vh; display:flex; flex-direction:column; gap:20px;">
          <!-- Property details bar -->
          <div style="padding:12px; background:rgba(212, 175, 55,0.08); border:1px dashed var(--gold); border-radius:6px; font-size:12.5px;">
            🏠 Property Listing: <strong style="color:var(--gold-l);">${propName}</strong> | Type: <strong>${propType || 'Resale'}</strong>
          </div>

          <!-- Progress timeline steps -->
          <div style="display:flex; align-items:center; gap:6px; justify-content:space-between; flex-wrap:wrap; background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:0.5px solid var(--border);">
            <div class="closure-step" id="prop-step-site-visit" style="flex:1; text-align:center; padding:6px; border-radius:4px; border:1px solid var(--border); font-size:10.5px; min-width:80px;">
              <div>Step 1</div><div style="font-weight:700;">Site Visit</div>
            </div>
            <div style="color:var(--text-muted);">➔</div>
            <div class="closure-step" id="prop-step-negotiation" style="flex:1; text-align:center; padding:6px; border-radius:4px; border:1px solid var(--border); font-size:10.5px; min-width:80px;">
              <div>Step 2</div><div style="font-weight:700;">Negotiation</div>
            </div>
            <div style="color:var(--text-muted);">➔</div>
            <div class="closure-step" id="prop-step-agreement" style="flex:1; text-align:center; padding:6px; border-radius:4px; border:1px solid var(--border); font-size:10.5px; min-width:80px;">
              <div>Step 3</div><div style="font-weight:700;">Agreement</div>
            </div>
            <div style="color:var(--text-muted);">➔</div>
            <div class="closure-step" id="prop-step-registration" style="flex:1; text-align:center; padding:6px; border-radius:4px; border:1px solid var(--border); font-size:10.5px; min-width:80px;">
              <div>Step 4</div><div style="font-weight:700;">Registration</div>
            </div>
            <div style="color:var(--text-muted);">➔</div>
            <div class="closure-step" id="prop-step-closed" style="flex:1; text-align:center; padding:6px; border-radius:4px; border:1px solid var(--border); font-size:10.5px; min-width:80px;">
              <div>🎉 Step 5</div><div style="font-weight:700;">Deal Closed</div>
            </div>
          </div>

          <!-- Action Checklist & Transaction details -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; flex-wrap:wrap;">
            <!-- Left Col: Checklist -->
            <div class="card" style="padding:15px; background:rgba(0,0,0,0.2); border:1px solid var(--border); margin:0;">
              <div style="font-size:13px; font-weight:700; color:var(--gold-l); margin-bottom:12px;"><i class="ti ti-list-check"></i> Deal Milestones</div>
              <div style="display:flex; flex-direction:column; gap:12px;">
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" id="prop-chk-site-visit" onchange="updatePropClosureFlowUI()" ${p.closure_site_visit ? 'checked' : ''}>
                  <span>Site Visit Conducted</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; margin-left: 15px;" id="lbl-prop-chk-joint-visit">
                  <input type="checkbox" id="prop-chk-joint-visit" onchange="updatePropClosureFlowUI()" ${p.closure_joint_visit ? 'checked' : ''}>
                  <span>Joint Visit (Accompanied by Associate)</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" id="prop-chk-negotiation" onchange="updatePropClosureFlowUI()" ${p.closure_negotiation ? 'checked' : ''}>
                  <span>Negotiation Completed</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" id="prop-chk-agreement" onchange="updatePropClosureFlowUI()" ${p.closure_agreement ? 'checked' : ''}>
                  <span>ATS Signed (Under Agreement)</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" id="prop-chk-registration" onchange="updatePropClosureFlowUI()" ${p.closure_registration ? 'checked' : ''}>
                  <span>Registration Completed</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" id="prop-chk-closed" onchange="updatePropClosureFlowUI()" ${p.closure_closed ? 'checked' : ''}>
                  <span style="font-weight:700; color:var(--green);">Deal Closed (SOLD/RENTED)</span>
                </label>
              </div>
            </div>

            <!-- Right Col: Transaction Linkage -->
            <div class="card" style="padding:15px; background:rgba(0,0,0,0.2); border:1px solid var(--border); margin:0; display:flex; flex-direction:column; gap:10px;">
              <div style="font-size:13px; font-weight:700; color:var(--gold-l);"><i class="ti ti-cash"></i> Closing Details</div>
              
              <div class="form-row" style="display:flex; gap:10px;">
                <div class="form-group" style="flex:1;">
                  <label class="form-label" style="font-size:10.5px;">${isRental ? 'Tenant Name' : 'Buyer Name'} *</label>
                  <input class="form-input" id="prop-closure-buyer" style="padding:4px 8px; font-size:12px;" value="${p.closure_buyer_name || ''}" placeholder="e.g. Amit Kumar">
                </div>
                <div class="form-group" style="flex:1;">
                  <label class="form-label" style="font-size:10.5px;">${isRental ? 'Tenant Phone' : 'Buyer Phone'}</label>
                  <input class="form-input" id="prop-closure-buyer-phone" type="tel" style="padding:4px 8px; font-size:12px;" value="${p.closure_buyer_phone || ''}" placeholder="e.g. 9876543210">
                </div>
              </div>

              <div class="form-row" style="display:flex; gap:10px;">
                <div class="form-group" style="flex:1;">
                  <label class="form-label" style="font-size:10.5px;">Deal Value (₹) *</label>
                  <input class="form-input" id="prop-closure-deal-value" type="number" style="padding:4px 8px; font-size:12px;" value="${p.closure_deal_value || ''}" placeholder="Total value / Rent">
                </div>
                <div class="form-group" style="flex:1;">
                  <label class="form-label" style="font-size:10.5px;">Commission % *</label>
                  <input class="form-input" id="prop-closure-commission" type="number" step="0.1" style="padding:4px 8px; font-size:12px;" value="${p.closure_commission_pct || ''}" placeholder="e.g. 2">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size:10.5px;">Deal Closing Date</label>
                <input class="form-input" id="prop-closure-date" type="date" style="padding:4px 8px; font-size:12px;" value="${p.closure_date || new Date().toISOString().split('T')[0]}">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size:10.5px;">Closing Remarks / Notes</label>
                <textarea class="form-input" id="prop-closure-notes" rows="2" style="padding:4px 8px; font-size:11px; resize:none;" placeholder="Key handover, registration token, etc.">${p.closure_notes || ''}</textarea>
              </div>
            </div>
          </div>
          
          <div style="display:flex; gap:10px; justify-content:flex-end; border-top:1px solid var(--border); padding-top:15px; margin-top:10px;">
            <button class="btn btn-ghost" onclick="closeModal('modal-closure-journey')">Cancel</button>
            <button class="btn btn-primary" style="background:var(--green); border:none; font-weight:700;" onclick="submitClosureDeal(${propId})">
              💾 Save Deal Flow Progress
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  const existing2 = document.getElementById('modal-closure-journey');
  if (existing2) existing2.remove();
  document.body.insertAdjacentHTML('beforeend', closureHTML);
  updatePropClosureFlowUI();
}
window.closureDeal = closureDeal;

window.updatePropClosureFlowUI = function() {
  const steps = [
    { id: 'prop-step-site-visit', chkId: 'prop-chk-site-visit', label: 'Site Visit' },
    { id: 'prop-step-negotiation', chkId: 'prop-chk-negotiation', label: 'Negotiation' },
    { id: 'prop-step-agreement', chkId: 'prop-chk-agreement', label: 'Agreement' },
    { id: 'prop-step-registration', chkId: 'prop-chk-registration', label: 'Registration' },
    { id: 'prop-step-closed', chkId: 'prop-chk-closed', label: 'Deal Closed' }
  ];

  let currentStage = 'Available';
  steps.forEach(step => {
    const el = document.getElementById(step.id);
    const checked = document.getElementById(step.chkId)?.checked;
    if (el) {
      if (checked) {
        el.style.background = 'rgba(46, 204, 113, 0.2)';
        el.style.borderColor = 'var(--green)';
        el.style.color = 'var(--green)';
        currentStage = step.label;
      } else {
        el.style.background = 'rgba(255, 255, 255, 0.03)';
        el.style.borderColor = 'var(--border)';
        el.style.color = 'var(--text-light)';
      }
    }
  });

  const statusEl = document.getElementById('prop-closure-current-status');
  if (statusEl) {
    statusEl.innerText = currentStage;
    statusEl.style.color = currentStage === 'Deal Closed' ? 'var(--green)' : 'var(--gold-l)';
  }
};

window.submitClosureDeal = async function(propId) {
  const buyerName = document.getElementById('prop-closure-buyer').value.trim();
  const buyerPhone = document.getElementById('prop-closure-buyer-phone').value.trim();
  const dealValue = document.getElementById('prop-closure-deal-value').value;
  const commissionPct = document.getElementById('prop-closure-commission').value;
  const isClosed = document.getElementById('prop-chk-closed').checked;

  if (isClosed && (!buyerName || !dealValue || !commissionPct)) {
    showToast('Please fill in Buyer/Tenant Name, Deal Value, and Commission % to close the deal.', true);
    return;
  }

  const payload = {
    closure_site_visit: document.getElementById('prop-chk-site-visit').checked,
    closure_joint_visit: document.getElementById('prop-chk-joint-visit').checked,
    closure_negotiation: document.getElementById('prop-chk-negotiation').checked,
    closure_agreement: document.getElementById('prop-chk-agreement').checked,
    closure_registration: document.getElementById('prop-chk-registration').checked,
    closure_closed: isClosed,
    closure_buyer_name: buyerName,
    closure_buyer_phone: buyerPhone,
    closure_deal_value: dealValue ? parseFloat(dealValue) : null,
    closure_commission_pct: commissionPct ? parseFloat(commissionPct) : null,
    closure_date: document.getElementById('prop-closure-date').value,
    closure_notes: document.getElementById('prop-closure-notes').value
  };

  try {
    const res = await fetch(`/api/properties/${propId}/closure`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      closeModal('modal-closure-journey');
      document.getElementById('modal-closure-journey')?.remove();
      
      const p = state.properties.find(x => x.id === propId);
      let finalStatus = 'Updated';
      if (payload.closure_closed) {
        const pType = (p && p.property_type || '').toLowerCase();
        const isRental = pType.includes('rental') || (p && p.available_for && p.available_for.toLowerCase().includes('rent')) || (p && p.available_for && p.available_for.toLowerCase().includes('lease'));
        finalStatus = isRental ? 'RENTED OUT' : 'SOLD';
      }
      
      showToast(`🏁 Deal flow progress saved. Status: ${finalStatus}`);
      loadProperties();
      loadDashboardData();
    } else {
      showToast(result.error || 'Failed to save closure details.', true);
    }
  } catch (err) {
    console.error('Error saving closure details:', err);
    showToast('Network error saving closure details.', true);
  }
};


async function deletePropertyListing(id) {
  try {
    await fetch(`/api/properties/${id}`, { method: 'DELETE' });
    showToastWithUndo('Listing removed.', () => restoreItem(id, 'properties'));
    loadProperties();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

function switchInventoryTab(tabId) {
  state.inventoryTab = tabId;
  
  document.querySelectorAll('#page-inventory .tabs .tab').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');

  document.getElementById('inventory-resale-pane').style.display = tabId === 'resale' ? 'block' : 'none';
  document.getElementById('inventory-rental-pane').style.display = tabId === 'rental' ? 'block' : 'none';
  document.getElementById('inventory-commercial-pane').style.display = tabId === 'commercial' ? 'block' : 'none';
  document.getElementById('inventory-masked-pane').style.display = tabId === 'masked' ? 'block' : 'none';
  
  const landPane = document.getElementById('inventory-land-pane');
  if (landPane) landPane.style.display = tabId === 'land' ? 'block' : 'none';
  
  loadProperties(true);
}

async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    state.projects = data;
    if (typeof window.populateProjectLinkDropdowns === 'function') {
      window.populateProjectLinkDropdowns();
    }

    const container = document.getElementById('projects-list-container');
    if (data.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-txt">No primary projects loaded.</div></div>`;
      if (typeof window.updateComparisonTable === 'function') {
        window.updateComparisonTable([]);
      }
      return;
    }

    const searchVal = (document.getElementById('filter-proj-search')?.value || '').toLowerCase().trim();
    const stageVal = document.getElementById('filter-proj-stage')?.value || '';
    const configVal = document.getElementById('filter-proj-config')?.value || '';
    const typeVal = document.getElementById('filter-proj-type')?.value || '';
    
    const minArea = parseFloat(document.getElementById('filter-proj-area-min')?.value);
    const maxArea = parseFloat(document.getElementById('filter-proj-area-max')?.value);
    const minPrice = parseFloat(document.getElementById('filter-proj-price-min')?.value);
    const maxPrice = parseFloat(document.getElementById('filter-proj-price-max')?.value);

    // Helper to extract numbers from string
    const extractNumbers = (str) => {
      if (!str) return [];
      const matches = str.match(/\d+(\.\d+)?/g);
      return matches ? matches.map(Number) : [];
    };

    const filteredDataAll = data.filter(p => {
      // 1. Search text match
      const nameMatch = p.project_name.toLowerCase().includes(searchVal) ||
                        p.builder_name.toLowerCase().includes(searchVal) ||
                        (p.location || '').toLowerCase().includes(searchVal) ||
                        (p.proj_id || '').toLowerCase().includes(searchVal);
                        
      // 2. Stage match
      const stageMatch = !stageVal || p.uc_rtmi === stageVal;

      // 3. Config match
      let configMatch = true;
      if (configVal) {
        configMatch = (p.configuration || '').toLowerCase().includes(configVal.toLowerCase());
      }
      
      // 4. Type match
      let typeMatch = true;
      if (typeVal) {
        const lowerType = typeVal.toLowerCase();
        const lowerConfig = (p.configuration || '').toLowerCase();
        const lowerName = (p.project_name || '').toLowerCase();
        
        if (lowerType === 'apartment') {
          typeMatch = lowerConfig.includes('bhk') || lowerConfig.includes('apartment') || lowerConfig.includes('flat') || (!lowerConfig.includes('villa') && !lowerConfig.includes('plot'));
        } else if (lowerType === 'villa') {
          typeMatch = lowerConfig.includes('villa') || lowerConfig.includes('row house') || lowerConfig.includes('rowhouse') || lowerName.includes('villa');
        } else if (lowerType === 'plot') {
          typeMatch = lowerConfig.includes('plot') || lowerConfig.includes('land') || lowerName.includes('plot') || lowerName.includes('land');
        } else if (lowerType === 'penthouse') {
          typeMatch = lowerConfig.includes('penthouse') || lowerName.includes('penthouse');
        }
      }
      
      // 5. Area match
      let areaMatch = true;
      if (!isNaN(minArea) || !isNaN(maxArea)) {
        let areas = extractNumbers(p.carpet_area);
        // Also check unit details
        if (p.unit_details) {
          try {
            const units = JSON.parse(p.unit_details);
            units.forEach(u => areas.push(...extractNumbers(u.area)));
          } catch(e){}
        }
        if (areas.length === 0) areaMatch = false; // no area data to compare
        else {
          const maxFound = Math.max(...areas);
          const minFound = Math.min(...areas);
          if (!isNaN(minArea) && maxFound < minArea) areaMatch = false;
          if (!isNaN(maxArea) && minFound > maxArea) areaMatch = false;
        }
      }

      // 6. Price match (assuming prices entered in filter are in Cr)
      let priceMatch = true;
      if (!isNaN(minPrice) || !isNaN(maxPrice)) {
        let prices = [];
        const processPriceStr = (str) => {
          if (!str) return [];
          const nums = extractNumbers(str);
          // If contains L or Lakh, convert to Cr
          if (/lakh|l\b/i.test(str)) {
             return nums.map(n => n / 100);
          }
          // If contains K, convert to Cr
          if (/k\b/i.test(str)) {
             return nums.map(n => n / 10000);
          }
          return nums;
        };

        prices.push(...processPriceStr(p.price_final));
        if (p.unit_details) {
          try {
            const units = JSON.parse(p.unit_details);
            units.forEach(u => prices.push(...processPriceStr(u.price)));
          } catch(e){}
        }

        if (prices.length === 0) priceMatch = false;
        else {
          const maxFound = Math.max(...prices);
          const minFound = Math.min(...prices);
          if (!isNaN(minPrice) && maxFound < minPrice) priceMatch = false;
          if (!isNaN(maxPrice) && minFound > maxPrice) priceMatch = false;
        }
      }
      
      return nameMatch && stageMatch && configMatch && typeMatch && areaMatch && priceMatch;
    });

    if (filteredDataAll.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-txt">No projects matched active criteria.</div></div>`;
      if (typeof window.updateComparisonTable === 'function') {
        window.updateComparisonTable([]);
      }
      return;
    }

    const itemsPerPage = 50;
    const totalPages = Math.ceil(filteredDataAll.length / itemsPerPage) || 1;
    const startIdx = (state.projPage - 1) * itemsPerPage;
    const filteredData = filteredDataAll.slice(startIdx, startIdx + itemsPerPage);

    // Update Project Comparison Table
    if (typeof window.updateComparisonTable === 'function') {
      window.updateComparisonTable(filteredDataAll);
    }

    if (state.viewModes.projects === 'card') {
      container.innerHTML = filteredData.map(p => {
        const isFocused = p.special_tags && p.special_tags.split(',').map(t=>t.trim().toLowerCase()).includes('focused');
        const cardStyle = isFocused 
          ? `background: linear-gradient(135deg, rgba(23, 26, 34, 0.55), rgba(212, 175, 55, 0.08)); border: 1.5px solid var(--gold); box-shadow: 0 0 10px rgba(212, 175, 55, 0.25); cursor:pointer; position:relative;`
          : `background: linear-gradient(135deg, rgba(23, 26, 34, 0.45), rgba(212, 175, 55, 0.04)); cursor:pointer; position:relative;`;
          
        return `
        <div class="card" style="${cardStyle}" onclick="showProjectDetails(${p.id})">
          <div style="position: absolute; top: 12px; right: 12px; z-index: 10;">
            <input type="checkbox" class="row-checkbox-projects" value="${p.id}" onchange="updateBulkSelectionState('projects')" style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation()">
          </div>
          <div style="position: absolute; top: 12px; left: 12px; z-index: 10;" onclick="event.stopPropagation(); window.toggleFocusProject(${p.id}, ${isFocused})">
            <span style="font-size: 18px; color: ${isFocused ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}; cursor: pointer;" title="Toggle Project Focus"><i class="ti ${isFocused ? 'ti-star-filled' : 'ti-star'}"></i></span>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:flex-start; padding-right: 35px; padding-left: 20px;">
            <div>
              <div class="card-title" style="font-size:16px; font-weight:700; color:var(--gold-l);"><i class="ti ti-building-skyscraper"></i> ${p.project_name}</div>
              <div class="card-sub">Builder/Developer: <strong>${p.builder_name}</strong></div>
              <div style="margin-top:6px;"><span class="chip chip-cold btn-sm" style="font-size:9.5px; background:var(--purple-light); color:var(--purple); cursor:pointer;" onclick="event.stopPropagation(); editID('projects', ${p.id}, '${p.proj_id || ''}')">ID: ${p.proj_id || 'N/A'}</span></div>
            </div>
            <span class="tag ${p.uc_rtmi === 'RTMI' ? 'tag-avail' : 'tag-primary'}" style="font-size:10px; font-weight:700; padding:4px 10px;">${p.uc_rtmi || 'UC'}</span>
          </div>
          
          <div class="grid3" style="margin-bottom:12px; margin-top:12px;">
            <div class="stat" style="background:rgba(0,0,0,0.25)"><div class="stat-label">Elevation Details</div><div class="stat-val" style="font-size:13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.elevation}">${p.elevation || 'N/A'}</div></div>
            <div class="stat" style="background:rgba(0,0,0,0.25)"><div class="stat-label">Starting Price</div><div class="stat-val" style="font-size:13px; color:var(--green); font-weight:700;">${formatPriceToWords(p.price_final)}</div></div>
            <div class="stat" style="background:rgba(0,0,0,0.25)"><div class="stat-label">Metro Station</div><div class="stat-val" style="font-size:13px; color:var(--blue-light); font-weight:700;">${p.metro_station || 'N/A'}</div></div>
          </div>

          <div style="font-size:12.5px; display:flex; flex-direction:column; gap:6px; padding-left: 20px;">
            <div>📐 Configurations: <strong>${p.configuration}</strong></div>
            <div>📏 Land Parcel: <strong>${p.land_parcel || 'N/A'}</strong> | Towers: <strong>${p.tower || 'N/A'}</strong></div>
            <div>📏 Carpet Area Range: <strong>${p.carpet_area}</strong></div>
            <div>🔑 Possession Date: <strong>${p.possession || 'Ready to Move'}</strong></div>
            <div>💳 Payment Subvention Plan: <strong style="color:var(--gold-l)">${p.subvention || 'N/A'}</strong> | CLP Due: <strong>${p.clp_due || 'N/A'}</strong></div>
            <div>📈 Floor Rise: <strong>${p.floor_rise || 'N/A'}</strong></div>
          </div>

          <div class="sop" style="margin-top: 12px; margin-bottom: 0; margin-left: 20px;">
            <div class="sop-title">Location USPs & Proximities</div>
            <div>📌 Location: <strong>${p.location}</strong></div>
            <div>🌟 Location USP: <strong>${p.location_usp || 'N/A'}</strong></div>
            <div>🏢 Other USP: <strong>${p.other_usp || 'N/A'}</strong></div>
          </div>

          <!-- Special Tags block -->
          <div style="margin-top: 12px; margin-left: 20px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
            ${(p.special_tags || '').split(',').filter(t => t.trim() !== '').map(tag => `
              <span class="tag" style="background:rgba(255,255,255,0.05); color:var(--gold-l); border: 0.5px solid var(--border); cursor:pointer;" onclick="event.stopPropagation(); window.removeProjectTag(${p.id}, '${tag.trim()}')" title="Click to remove tag">${tag.trim()} &times;</span>
            `).join('')}
            <span class="tag" style="background:rgba(212, 175, 55,0.15); color:var(--gold-l); border: 1.5px dashed var(--gold); cursor:pointer; font-weight:700;" onclick="event.stopPropagation(); promptAddTag(${p.id}, 'projects')">+ Tag</span>
            <button class="btn btn-ghost btn-sm" style="padding: 2px 6px; font-size:10px; font-weight:700; color:var(--gold-l);" onclick="event.stopPropagation(); editProject(${p.id})"><i class="ti ti-edit"></i> Edit</button>
            <button class="btn btn-ghost btn-sm" style="padding: 2px 6px; font-size:10px; font-weight:700; color:var(--gold-l);" onclick="event.stopPropagation(); cloneProject(${p.id})">📋 Clone</button>
          </div>
        </div>
      `; }).join('');
    } else {
      // TABLE VIEW
      container.innerHTML = `
        <div class="tw" style="margin-top: 10px;">
          <table class="tbl">
            <thead>
              <tr>
                <th style="width: 40px;"><input type="checkbox" id="check-all-projects" onchange="toggleAllRowCheckboxes('projects', this.checked)"></th>
                <th>Focus</th>
                <th>ID</th>
                <th>Project Name</th>
                <th>Builder</th>
                <th>Location</th>
                <th>Land Parcel</th>
                <th>Elevation</th>
                <th>Configurations</th>
                <th>Carpet Area</th>
                <th>Starting Price</th>
                <th>UC / RTMI</th>
                <th>Possession</th>
                <th>Payment Plan</th>
                <th>Metro Distance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(p => {
                const isFocused = p.special_tags && p.special_tags.split(',').map(t=>t.trim().toLowerCase()).includes('focused');
                return `
                <tr style="${isFocused ? 'background: rgba(212, 175, 55, 0.08);' : ''}">
                  <td><input type="checkbox" class="row-checkbox-projects" value="${p.id}" onchange="updateBulkSelectionState('projects')"></td>
                  <td>
                    <span onclick="window.toggleFocusProject(${p.id}, ${isFocused})" style="font-size: 16px; color: ${isFocused ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}; cursor: pointer;">
                      <i class="ti ${isFocused ? 'ti-star-filled' : 'ti-star'}"></i>
                    </span>
                  </td>
                  <td><span class="chip chip-cold btn-sm" style="font-size:9px; cursor:pointer;" onclick="editID('projects', ${p.id}, '${p.proj_id || ''}')">${p.proj_id || 'N/A'}</span></td>
                  <td><strong>${p.project_name}</strong></td>
                  <td>${p.builder_name}</td>
                  <td>${p.location}</td>
                  <td>${p.land_parcel || 'N/A'}</td>
                  <td>${p.elevation || 'N/A'}</td>
                  <td>${p.configuration}</td>
                  <td>${p.carpet_area}</td>
                  <td style="color:var(--green); font-weight:600;">${formatPriceToWords(p.price_final)}</td>
                  <td><span class="tag ${p.uc_rtmi === 'RTMI' ? 'tag-avail' : 'tag-primary'}" style="font-size:9px;">${p.uc_rtmi || 'UC'}</span></td>
                  <td>${p.possession || 'N/A'}</td>
                  <td style="font-size:11px;">${p.subvention || 'N/A'}</td>
                  <td style="font-size:11px;">${p.metro_station || 'N/A'}</td>
                  <td>
                    <div style="display:flex; gap:4px;">
                      <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:10px; padding:2px 6px;" onclick="promptAddTag(${p.id}, 'projects')">+ Tag</button>
                      <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:10px; padding:2px 6px;" onclick="editProject(${p.id})"><i class="ti ti-edit"></i> Edit</button>
                      <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:10px; padding:2px 6px;" onclick="cloneProject(${p.id})">📋 Clone</button>
                    </div>
                  </td>
                </tr>
              `; }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    container.innerHTML += renderPaginationBar('projects', state.projPage, totalPages, 'changeProjPage');
  } catch (err) {
    console.error(err);
  }
}

window.updateComparisonTable = function(projects) {
  const tableContainer = document.getElementById('project-comparison-container');
  if (!tableContainer) return;
  
  if (projects.length === 0) {
    tableContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">No projects match the current filters for comparison.</div>`;
    return;
  }
  
  const compareList = projects.slice(0, 4);
  
  let html = `
    <table class="tbl">
      <thead>
        <tr>
          <th>Ecosystem parameter</th>
          ${compareList.map(p => `<th>${p.project_name}<br><span style="font-size:10px; color:var(--text-secondary);">${p.builder_name}</span></th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Location</strong></td>
          ${compareList.map(p => `<td>${p.location || 'N/A'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Budget (Starting Price)</strong></td>
          ${compareList.map(p => `<td style="color:var(--green); font-weight:700;">${formatPriceToWords(p.price_final)}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>BHK Configurations</strong></td>
          ${compareList.map(p => `<td>${p.configuration || 'N/A'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Unit Sizes (Carpet Area)</strong></td>
          ${compareList.map(p => `<td>${p.carpet_area || 'N/A'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Construction Stage</strong></td>
          ${compareList.map(p => `<td>${p.uc_rtmi || 'UC'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Structural Elevation</strong></td>
          ${compareList.map(p => `<td>${p.elevation || 'N/A'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Possession Handover</strong></td>
          ${compareList.map(p => `<td>${p.possession || 'N/A'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Payment Schemes</strong></td>
          ${compareList.map(p => `<td>${p.subvention || 'N/A'}</td>`).join('')}
        </tr>
      </tbody>
    </table>
  `;
  tableContainer.innerHTML = html;
};

window.removeProjectTag = async function(id, tag) {
  if (!confirm(`Are you sure you want to remove tag "${tag}"?`)) return;
  try {
    const res = await fetch(`/api/projects/${id}/tag`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, action: 'remove' })
    });
    if (res.ok) {
      showToast(`Tag "${tag}" removed.`);
      loadProjects();
    }
  } catch(e) { console.error(e); }
};

window.toggleFocusProject = async function(id, isFocused) {
  try {
    const res = await fetch(`/api/projects/${id}/tag`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'Focused', action: isFocused ? 'remove' : 'add' })
    });
    if (res.ok) {
      showToast(isFocused ? 'Removed focus highlight.' : 'Marked project as FOCUSED!');
      loadProjects();
    }
  } catch(e) { console.error(e); }
};

// ------------------------------------------
// 6. ASSOCIATES & DIRECTORY
// ------------------------------------------
async function loadAssociates() {
  try {
    const res = await fetch('/api/associates');
    const data = await res.json();
    state.associates = data;

    // Populate dropdowns across all forms
    const selectsToPopulate = [
      { id: 'lead-associate', placeholder: '-- None (Direct Client) --' },
      { id: 'edit-lead-associate', placeholder: '-- None (Direct Client) --' },
      { id: 'prop-associate-id', placeholder: '-- None (Direct Listing) --' },
      { id: 'rental-associate-id', placeholder: '-- None (Direct Listing) --' },
      { id: 'comm-prop-associate-id', placeholder: '-- None (Direct Listing) --' },
      { id: 'land-associate-id', placeholder: '-- None (Direct Listing) --' },
      { id: 'comm-associate-id', placeholder: '-- None (Direct Deal) --' }
    ];
    selectsToPopulate.forEach(item => {
      const select = document.getElementById(item.id);
      if (select) {
        const currentVal = select.value;
        select.innerHTML = `<option value="">${item.placeholder}</option>` + 
          data.map(a => `<option value="${a.id}">${a.name} (${a.company || 'Private Brokerage'})</option>`).join('');
        if (currentVal) select.value = currentVal;
      }
    });

    if (typeof loadAssociatesPerformance === 'function') {
      loadAssociatesPerformance();
    }

    const searchVal = (document.getElementById('filter-assoc-search')?.value || '').toLowerCase().trim();
    let displayData = data;
    if (searchVal) {
      displayData = data.filter(a => 
        (a.name || '').toLowerCase().includes(searchVal) ||
        (a.company || '').toLowerCase().includes(searchVal) ||
        (a.speciality_zones || '').toLowerCase().includes(searchVal) ||
        (a.phone || '').toLowerCase().includes(searchVal) ||
        (a.email || '').toLowerCase().includes(searchVal)
      );
    }

    const tbody = document.getElementById('associates-list-container');
    if (displayData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">No co-brokers logged or matched criteria. Click Register Associate to begin!</td></tr>`;
      const pagWrapper = document.getElementById('associates-pagination-wrapper');
      if (pagWrapper) pagWrapper.innerHTML = '';
      return;
    }

    const itemsPerPage = 50;
    const totalPages = Math.ceil(displayData.length / itemsPerPage) || 1;
    const startIdx = (state.assocPage - 1) * itemsPerPage;
    const pagedData = displayData.slice(startIdx, startIdx + itemsPerPage);
    
    const pagWrapper = document.getElementById('associates-pagination-wrapper');
    if (pagWrapper) pagWrapper.innerHTML = renderPaginationBar('associates', state.assocPage, totalPages, 'changeAssocPage');

    tbody.innerHTML = pagedData.map(a => `
      <tr style="cursor:pointer;" onclick="showAssociateDetails(${a.id})" class="assoc-row">
        <td><strong>${a.name}</strong> ${a.is_inner_circle ? '<span class="badge badge-amber" style="font-size:9px; padding:2px 6px;">⭐ Inner Circle</span>' : ''}</td>
        <td>${a.company || 'Private Brokerage'}</td>
        <td>📞 ${a.phone}<br>✉️ ${a.email || 'N/A'}</td>
        <td>📍 ${a.speciality_zones}</td>
        <td><strong style="color:var(--gold-l)">${a.co_brokerage_share}% Share</strong></td>
        <td>${'⭐'.repeat(a.rating)}</td>
        <td style="text-align:right;" onclick="event.stopPropagation()">
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button class="btn btn-ghost btn-sm" onclick="editAssociateDataDirect(${a.id})" style="padding:4px 8px; font-size:11px; border:1px solid var(--border);"><i class="ti ti-edit"></i> Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteAssociateDataDirect(${a.id}, '${a.name.replace(/'/g, "\\'")}')" style="padding:4px 8px; font-size:11px; color:var(--red); border:1px solid rgba(192,57,43,0.3);"><i class="ti ti-trash"></i> Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

window.editAssociateDataDirect = function(id) {
  const a = state.associates.find(x => x.id == id);
  if(!a) return;
  editingAssociateId = id;
  
  document.getElementById('assoc-name').value = a.name || '';
  document.getElementById('assoc-company').value = a.company || '';
  document.getElementById('assoc-phone').value = a.phone || '';
  document.getElementById('assoc-email').value = a.email || '';
  document.getElementById('assoc-share').value = a.co_brokerage_share || '';
  document.getElementById('assoc-zones').value = a.speciality_zones || '';
  document.getElementById('assoc-rating').value = a.rating || '5';
  document.getElementById('assoc-inner-circle').checked = !!a.is_inner_circle;

  document.querySelector('#form-add-associate button[type="submit"]').innerText = 'Save Changes';
  openModal('modal-add-associate');
};

window.deleteAssociateDataDirect = async function(id, name) {
  if (!confirm(`⚠️ Are you sure you want to delete associate "${name}"? All their linked properties and requirements will be unlinked.`)) return;
  try {
    const res = await fetch('/api/associates/' + id, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 Associate deleted successfully.');
      loadAssociates();
      if (window.refreshActivePageData) window.refreshActivePageData();
    } else {
      showToast('Error: ' + data.error);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to delete associate.');
  }
};

// ------------------------------------------
// 7. LEAD PIPELINE (KANBAN DRAG & DROP)
// ------------------------------------------
async function loadPipeline() {
  try {
    // Populate Agent filter if empty
    const agentSelect = document.getElementById('filter-lead-agent');
    if (agentSelect && agentSelect.options.length <= 1) {
      const aRes = await fetch('/api/agents');
      const agents = await aRes.json();
      agents.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.innerText = a.name;
        agentSelect.appendChild(opt);
      });
    }

    const res = await fetch('/api/leads');
    let data = await res.json();
    state.leads = data;

    // Apply Advanced Filters
    const dateStart = document.getElementById('filter-lead-date-start')?.value;
    const dateEnd = document.getElementById('filter-lead-date-end')?.value;
    const agentId = document.getElementById('filter-lead-agent')?.value;
    const budgetMinCr = parseFloat(document.getElementById('filter-lead-budget-min')?.value) || 0;
    const budgetMaxCr = parseFloat(document.getElementById('filter-lead-budget-max')?.value) || Infinity;

    data = data.filter(lead => {
      if (lead.stage === 'Raw Lead') return false;
      // 1. Date filter
      if (dateStart || dateEnd) {
        const createdDate = new Date(lead.created_at);
        if (dateStart && createdDate < new Date(dateStart)) return false;
        if (dateEnd && createdDate > new Date(dateEnd + 'T23:59:59')) return false;
      }
      
      // 2. Agent Filter
      if (agentId && lead.agent_id != agentId) return false;

      // 3. Budget Filter (Lead budgets are stored in raw values. Cr = 1,00,00,000)
      const leadMinCr = (lead.budget_min || 0) / 10000000;
      const leadMaxCr = (lead.budget_max || lead.budget_min || Infinity) / 10000000;
      
      // If the lead's budget overlaps with the filter budget range
      if (leadMaxCr < budgetMinCr || leadMinCr > budgetMaxCr) {
        if (budgetMinCr > 0 || budgetMaxCr !== Infinity) return false;
      }
      
      return true;
    });

    renderPipeline(data);
  } catch (err) {
    console.error(err);
  }
}

window.renderPipeline = function(data) {
  const stages = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won'];
  stages.forEach(s => {
    const col = document.getElementById(`col-${s}`);
    const cnt = document.getElementById(`count-${s}`);
    if(col) col.innerHTML = '';
    if(cnt) cnt.innerText = '0';
  });

  const counts = { New: 0, Contacted: 0, Qualified: 0, Proposal: 0, Won: 0 };
  const maxPerColumn = 40; // Pagination limit for Kanban

  data.forEach(lead => {
    let stage = lead.stage;
    if (!stage || !stages.includes(stage)) stage = 'New'; 
    counts[stage]++;
    
    // Virtual Pagination (Limit rendered items to prevent browser freeze)
    if (counts[stage] > maxPerColumn) return;

    const col = document.getElementById(`col-${stage}`);
    if (!col) return;

    const card = document.createElement('div');
    card.className = 'lead-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', lead.id);
    card.style.cursor = 'pointer';
    card.onclick = () => showLeadDetails(lead.id);

    let tempClass = 'chip-warm';
    if (lead.status === 'Hot') tempClass = 'chip-hot';
    if (lead.status === 'Cold') tempClass = 'chip-cold';

    const assoc = state.associates ? state.associates.find(a => a.id === lead.associate_id) : null;
    const nameEscaped = lead.name.replace(/'/g, "\\'");
    
    // Followup Reminder Visuals
    let followupAlert = '';
    if (lead.next_followup) {
      const fDate = new Date(lead.next_followup);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (fDate <= today) {
        followupAlert = `<div style="color:var(--amber); font-size:9px; font-weight:700; margin-top:4px;"><i class="ti ti-bell-ringing"></i> Follow-up Due</div>`;
      }
    }

    card.innerHTML = `
      <div class="lead-name" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span>${lead.name}</span>
        <span onclick="event.stopPropagation(); triggerClickToCall(${lead.id}, '${nameEscaped}', '${lead.phone}')" style="cursor:pointer; color:var(--gold-l); font-size:12px; transition:color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--gold-l)'" title="Click-to-Call"><i class="ti ti-phone"></i></span>
      </div>
      <div class="lead-detail">${lead.project_type || 'General'} | Budget: ₹${((lead.budget_min||0)/100000).toFixed(0)}L</div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
        <span class="lead-tag chip ${tempClass}">${lead.status || 'Warm'}</span>
        ${assoc ? `<span style="font-size:10.5px; color:var(--gold-l); font-weight:600;"><i class="ti ti-users"></i> ${assoc.name}</span>` : ''}
      </div>
      ${lead.agent_name ? `
      <div style="margin-top:6px; display:flex; justify-content:flex-end;">
        <span class="badge" style="background:rgba(201, 153, 26, 0.08); color:var(--gold-l); font-size:9.5px; padding:1.5px 6px; font-weight:700;"><i class="ti ti-user"></i> ${lead.agent_name}</span>
      </div>` : ''}
      ${followupAlert}
    `;

    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', lead.id);
      setTimeout(() => card.style.opacity = '0.5', 0);
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
    });

    col.appendChild(card);
  });

  Object.keys(counts).forEach(s => {
    const el = document.getElementById(`count-${s}`);
    if (el) el.innerText = counts[s];
  });
  
  setupPipelineDropZones();
}

function setupPipelineDropZones() {
  if (window.pipelineDropZonesSetup) return;
  window.pipelineDropZonesSetup = true;
  
  const stages = document.querySelectorAll('.stage');
  stages.forEach(stg => {
    stg.addEventListener('dragover', (e) => {
      e.preventDefault();
      stg.style.background = 'rgba(212, 175, 55, 0.08)';
    });

    stg.addEventListener('dragleave', () => {
      stg.style.background = 'rgba(23, 26, 34, 0.5)';
    });

    stg.addEventListener('drop', async (e) => {
      e.preventDefault();
      stg.style.background = 'rgba(23, 26, 34, 0.5)';
      
      const id = e.dataTransfer.getData('text/plain');
      const targetStage = stg.getAttribute('data-stage');
      
      if (!id || !targetStage) return;

      try {
        await fetch(`/api/leads/${id}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: targetStage })
        });
        showToast(`Lead drag stage updated to: ${targetStage}`);
        loadPipeline();
      } catch (err) {
        console.error(err);
      }
    });
  });
}

window.switchPipelineTab = function(tabId) {
  const boardTab = document.getElementById('btn-pipeline-tab-board');
  const followupsTab = document.getElementById('btn-pipeline-tab-followups');
  
  const boardCard = document.getElementById('pipeline-board-card');
  const followupsCard = document.getElementById('pipeline-followups-card');

  if (tabId === 'board') {
    if (boardTab) {
      boardTab.classList.add('active');
      boardTab.style.borderBottomColor = 'var(--gold)';
      boardTab.style.color = 'var(--gold-l)';
    }
    if (followupsTab) {
      followupsTab.classList.remove('active');
      followupsTab.style.borderBottomColor = 'transparent';
      followupsTab.style.color = 'var(--text-secondary)';
    }
    if (boardCard) boardCard.classList.remove('hidden');
    if (followupsCard) followupsCard.classList.add('hidden');
  } else {
    if (followupsTab) {
      followupsTab.classList.add('active');
      followupsTab.style.borderBottomColor = 'var(--gold)';
      followupsTab.style.color = 'var(--gold-l)';
    }
    if (boardTab) {
      boardTab.classList.remove('active');
      boardTab.style.borderBottomColor = 'transparent';
      boardTab.style.color = 'var(--text-secondary)';
    }
    if (followupsCard) followupsCard.classList.remove('hidden');
    if (boardCard) boardCard.classList.add('hidden');
    loadFollowups();
  }
};

// ------------------------------------------
// 8. CAPTURE LEAD SUBMIT FORM
// ------------------------------------------
async function submitCaptureLead(e) {
  e.preventDefault();

  const sourceVal = document.getElementById('lead-source').value;
  saveCustomDropdownValue('leadSources', sourceVal);

  const locVal = document.getElementById('lead-location').value;
  saveCustomDropdownValue('projectLocations', locVal);

  let stageVal = 'New';
  const hasRequirement = 
    (locVal && locVal.trim() !== '') || 
    (document.getElementById('lead-config').value && document.getElementById('lead-config').value !== '') || 
    (parseFloat(document.getElementById('lead-budget-min').value || 0) > 0) || 
    (parseFloat(document.getElementById('lead-budget-max').value || 0) > 0);
  
  if (!hasRequirement) {
    stageVal = 'Raw Lead';
  }

  const data = {
    name: document.getElementById('lead-name').value,
    phone: document.getElementById('lead-phone').value,
    email: document.getElementById('lead-email').value,
    source: sourceVal,
    stage: stageVal,
    status: document.getElementById('lead-temp').value,
    project_type: document.getElementById('lead-type').value,
    budget_min: parseFloat(document.getElementById('lead-budget-min').value || 0),
    budget_max: parseFloat(document.getElementById('lead-budget-max').value || 0),
    notes: document.getElementById('lead-notes').value,
    admin_comments: document.getElementById('lead-admin-comments').value,
    next_followup: document.getElementById('lead-followup').value,
    followup_status: document.getElementById('lead-followup-status').value,
    touchpoint: document.getElementById('lead-touchpoint').value,
    location_preference: locVal,
    config_bhk: document.getElementById('lead-config').value,
    timeline_preference: document.getElementById('lead-timeline').value,
    property_requirement: document.getElementById('lead-requirement').value,
    associate_id: document.getElementById('lead-associate').value || null,
    agent_id: document.getElementById('lead-agent').value || null
  };

  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (res.status === 409) {
      const errData = await res.json();
      showDuplicateModal(errData.error, errData.existingId, async () => {
        try {
          const forceRes = await fetch('/api/leads?force=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (forceRes.ok) {
            showToast('Client qualifications logged successfully (Duplicate Bypassed).');
            document.getElementById('form-capture-lead').reset();
            if (stageVal === 'Raw Lead') {
              navToPage('raw-leads');
            } else {
              navToPage('pipeline');
            }
          } else {
            const err = await forceRes.json();
            showToast(err.error || 'Failed to force add lead.', 'error');
          }
        } catch (forceErr) {
          console.error(forceErr);
        }
      });
      return;
    }
    
    showToast('Client qualifications logged successfully.');
    document.getElementById('form-capture-lead').reset();
    if (stageVal === 'Raw Lead') {
      navToPage('raw-leads');
    } else {
      navToPage('pipeline');
    }
  } catch (err) {
    console.error(err);
  }
}

window.editLeadData = async function(id) {
  const leadId = id || document.getElementById('detail-lead-id').value;
  if (!leadId) return;

  try {
    const res = await fetch('/api/leads');
    const leads = await res.json();
    const lead = leads.find(l => l.id == leadId);
    if (!lead) return;

    document.getElementById('edit-lead-id').value = lead.id;
    document.getElementById('edit-lead-name').value = lead.name || '';
    document.getElementById('edit-lead-phone').value = lead.phone || '';
    document.getElementById('edit-lead-email').value = lead.email || '';
    document.getElementById('edit-lead-source').value = lead.source || '';
    document.getElementById('edit-lead-type').value = lead.project_type || 'Residential - Primary';
    document.getElementById('edit-lead-config').value = lead.config_bhk || '3 BHK';
    document.getElementById('edit-lead-budget-min').value = lead.budget_min || 0;
    document.getElementById('edit-lead-budget-max').value = lead.budget_max || 0;
    document.getElementById('edit-lead-location').value = lead.location_preference || '';
    document.getElementById('edit-lead-timeline').value = lead.timeline_preference || 'Immediate';
    document.getElementById('edit-lead-followup').value = lead.next_followup || '';
    document.getElementById('edit-lead-temp').value = lead.status || 'Hot';
    document.getElementById('edit-lead-followup-status').value = lead.followup_status || 'None';
    document.getElementById('edit-lead-touchpoint').value = lead.touchpoint || 'Calls';
    document.getElementById('edit-lead-stage').value = (lead.stage === 'Raw Lead') ? 'New' : (lead.stage || 'New');
    document.getElementById('edit-lead-notes').value = lead.notes || '';
    document.getElementById('edit-lead-admin-comments').value = lead.admin_comments || '';
    
    const reqSelect = document.getElementById('edit-lead-requirement');
    if (reqSelect) {
      reqSelect.value = lead.property_requirement || 'Residential Buy';
    }

    const assocSelect = document.getElementById('edit-lead-associate');
    if (assocSelect) {
      assocSelect.value = lead.associate_id || '';
    }

    const agentSelect = document.getElementById('edit-lead-agent');
    if (agentSelect) {
      agentSelect.value = lead.agent_id || '';
    }

    const modalTitle = document.querySelector('#modal-edit-lead .mtitle');
    if (modalTitle) {
      modalTitle.innerHTML = '💎 Edit Lead Details';
    }

    closeModal('modal-lead-detail');
    openModal('modal-edit-lead');
  } catch (err) {
    console.error(err);
    showToast('Failed to fetch lead details.');
  }
};

window.showAddEnquiryModal = function() {
  document.getElementById('edit-lead-id').value = '';
  document.getElementById('edit-lead-name').value = '';
  document.getElementById('edit-lead-phone').value = '';
  document.getElementById('edit-lead-email').value = '';
  document.getElementById('edit-lead-source').value = 'Website';
  document.getElementById('edit-lead-type').value = 'Residential - Primary';
  document.getElementById('edit-lead-config').value = '3 BHK';
  document.getElementById('edit-lead-budget-min').value = '';
  document.getElementById('edit-lead-budget-max').value = '';
  document.getElementById('edit-lead-location').value = '';
  document.getElementById('edit-lead-timeline').value = 'Immediate';
  document.getElementById('edit-lead-followup').value = '';
  document.getElementById('edit-lead-temp').value = 'Hot';
  document.getElementById('edit-lead-followup-status').value = 'None';
  document.getElementById('edit-lead-touchpoint').value = 'Calls';
  document.getElementById('edit-lead-stage').value = 'New';
  document.getElementById('edit-lead-notes').value = '';
  document.getElementById('edit-lead-admin-comments').value = '';
  
  const reqSelect = document.getElementById('edit-lead-requirement');
  if (reqSelect) {
    reqSelect.value = 'Residential Buy';
  }

  const assocSelect = document.getElementById('edit-lead-associate');
  if (assocSelect) {
    assocSelect.value = '';
  }

  const modalTitle = document.querySelector('#modal-edit-lead .mtitle');
  if (modalTitle) {
    modalTitle.innerHTML = '📋 Register New Customer Enquiry';
  }

  openModal('modal-edit-lead');
};

window.submitEditLead = async function(e) {
  e.preventDefault();
  const id = document.getElementById('edit-lead-id').value;

  const sourceVal = document.getElementById('edit-lead-source').value;
  saveCustomDropdownValue('leadSources', sourceVal);

  const locVal = document.getElementById('edit-lead-location').value;
  saveCustomDropdownValue('projectLocations', locVal);

  const data = {
    name: document.getElementById('edit-lead-name').value,
    phone: document.getElementById('edit-lead-phone').value,
    email: document.getElementById('edit-lead-email').value,
    source: sourceVal,
    status: document.getElementById('edit-lead-temp').value,
    stage: document.getElementById('edit-lead-stage').value,
    project_type: document.getElementById('edit-lead-type').value,
    budget_min: parseFloat(document.getElementById('edit-lead-budget-min').value || 0),
    budget_max: parseFloat(document.getElementById('edit-lead-budget-max').value || 0),
    notes: document.getElementById('edit-lead-notes').value,
    admin_comments: document.getElementById('edit-lead-admin-comments').value,
    next_followup: document.getElementById('edit-lead-followup').value,
    followup_status: document.getElementById('edit-lead-followup-status').value,
    touchpoint: document.getElementById('edit-lead-touchpoint').value,
    location_preference: locVal,
    config_bhk: document.getElementById('edit-lead-config').value,
    timeline_preference: document.getElementById('edit-lead-timeline').value,
    property_requirement: document.getElementById('edit-lead-requirement').value,
    associate_id: document.getElementById('edit-lead-associate').value || null,
    agent_id: document.getElementById('edit-lead-agent').value || null
  };

  try {
    const url = id ? `/api/leads/${id}` : `/api/leads`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (res.status === 409) {
      const errData = await res.json();
      showDuplicateModal(errData.error, errData.existingId, async () => {
        try {
          const forceRes = await fetch(id ? `/api/leads/${id}?force=true` : `/api/leads?force=true`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (forceRes.ok) {
            showToast(id ? 'Lead details updated successfully (Duplicate Bypassed).' : 'New enquiry registered successfully (Duplicate Bypassed).');
            const sp = document.getElementById('scratchpad-textarea');
            if (sp) sp.value = '';
            closeModal('modal-edit-lead');
            if (window.refreshActivePageData) {
              window.refreshActivePageData();
            } else {
              loadEnquiries();
              loadDashboardData();
            }
          } else {
            const err = await forceRes.json();
            showToast(err.error || 'Failed to force save lead.', 'error');
          }
        } catch (forceErr) {
          console.error(forceErr);
        }
      });
      return;
    }
    
    if (!res.ok) throw new Error('Failed to persist lead details');
    
    showToast(id ? 'Lead details updated successfully.' : 'New enquiry registered successfully.');
    const sp = document.getElementById('scratchpad-textarea');
    if (sp) sp.value = '';
    closeModal('modal-edit-lead');
    
    if (window.refreshActivePageData) {
      window.refreshActivePageData();
    } else {
      loadPipeline();
      loadFollowups();
      loadDashboardData();
      if (typeof loadEnquiries === 'function') loadEnquiries();
    }
  } catch (err) {
    console.error(err);
    showToast(id ? 'Failed to update lead.' : 'Failed to register enquiry.');
  }
};

// ------------------------------------------
// 9. OVERDUE & ACTION ALERTS
// ------------------------------------------
async function loadFollowups() {
  try {
    const res = await fetch('/api/leads');
    const data = await res.json();
    state.leads = data;

    const overdueContainer = document.getElementById('overdue-followups-container');
    const dueTbody = document.getElementById('due-followups-list-container');
    const todayStr = getLocalNowStr().split('T')[0];
    const localNow = getLocalNowStr();

    // Filter overdue
    const overdueLeads = data.filter(l => l.next_followup && l.next_followup < localNow && l.followup_status !== 'Completed');
    
    if (overdueLeads.length === 0) {
      overdueContainer.innerHTML = `<div class="empty"><div class="empty-txt">No overdue follow-ups reported. Clean pipeline!</div></div>`;
    } else {
      overdueContainer.innerHTML = overdueLeads.map(l => `
        <div class="inv-item" style="border-color:var(--red);">
          <div class="inv-row">
            <div>
              <div class="inv-name" style="cursor:pointer; text-decoration:underline;" onclick="showLeadDetails(${l.id})">${l.name} · BHK requirement: ${l.project_type}</div>
              <div class="inv-loc">Staging Stage: <strong>${l.stage}</strong> | Scheduled callback date: <strong style="color:var(--red)">${l.next_followup.replace('T', ' ')}</strong></div>
            </div>
            <div>
              <button class="btn btn-primary btn-sm" onclick="triggerClickToCall(${l.id}, '${l.name.replace(/'/g, "\\'")}', '${l.phone}')" style="background-color: var(--gold); border-color: var(--gold); color: #000;">📞 Call Lead</button>
              <button class="btn btn-primary btn-sm" onclick="sendWhatsAppTemplate('${l.name}', '${l.phone}')">💬 WhatsApp Nurture</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    // Filter due today
    const dueLeads = data.filter(l => l.next_followup && l.next_followup.split('T')[0] === todayStr && l.followup_status !== 'Completed');

    if (dueLeads.length === 0) {
      dueTbody.innerHTML = `<tr><td colspan="5" class="empty">No scheduled callback alerts today!</td></tr>`;
      return;
    }

    dueTbody.innerHTML = dueLeads.map(l => `
      <tr>
        <td><strong style="cursor:pointer; text-decoration:underline;" onclick="showLeadDetails(${l.id})">${l.name}</strong></td>
        <td><span class="chip ch-gold">${l.stage}</span></td>
        <td>${l.phone} <span onclick="triggerClickToCall(${l.id}, '${l.name.replace(/'/g, "\\'")}', '${l.phone}')" style="cursor:pointer; color:var(--gold-l); font-size:12px; margin-left:6px;" title="Click-to-Call"><i class="ti ti-phone"></i></span></td>
        <td>Send options shortlist match</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="triggerClickToCall(${l.id}, '${l.name.replace(/'/g, "\\'")}', '${l.phone}')" style="background-color: var(--gold); border-color: var(--gold); color: #000;">📞 Call</button>
          <button class="btn btn-primary btn-sm" onclick="rescheduleFollowup(${l.id})">🗓️ Reschedule</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function sendWhatsAppTemplate(name, phone) {
  const msg = `Hi ${name}! I noticed you were exploring premium real estate opportunities recently. We have some exclusive listings that match your requirements. Would you like me to share options? - Vasu, REALPro.`;
  const url = `https://api.whatsapp.com/send?phone=${phone.replace(/[^0-9+]/g, '')}&text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

async function rescheduleFollowup(id) {
  const newDate = prompt("Enter new callback date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
  if (!newDate) return;

  const lead = state.leads.find(l => l.id === id);
  if (!lead) return;

  try {
    await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, next_followup: newDate })
    });
    showToast('Callback reschedule recorded.');
    loadFollowups();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

// ------------------------------------------
// 10. ENQUIRY & REQUIREMENT LOGS
// ------------------------------------------
async function loadEnquiries() {
  try {
    const search = document.getElementById('filter-enquiry-search').value;
    const temp = document.getElementById('filter-enquiry-temp').value;

    let url = `/api/leads?search=${encodeURIComponent(search)}`;
    if (temp) url += `&status=${temp}`;

    const res = await fetch(url);
    const data = await res.json();
    state.leads = data;

    // Populate Agent filter if empty
    const agentSelect = document.getElementById('filter-enq-agent');
    if (agentSelect && agentSelect.options.length <= 1) {
      try {
        const aRes = await fetch('/api/agents');
        const agents = await aRes.json();
        agents.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.innerText = a.name;
          agentSelect.appendChild(opt);
        });
      } catch (errAgent) {
        console.error('Failed to load agents for filter:', errAgent);
      }
    }

    const dateStart = document.getElementById('filter-enq-date-start')?.value;
    const dateEnd = document.getElementById('filter-enq-date-end')?.value;
    const agentId = document.getElementById('filter-enq-agent')?.value;
    const budgetMinCr = parseFloat(document.getElementById('filter-enq-budget-min')?.value) || 0;
    const budgetMaxCr = parseFloat(document.getElementById('filter-enq-budget-max')?.value) || Infinity;

    let filteredLeads = data.filter(lead => {
      if (lead.stage === 'Raw Lead') return false;
      // 1. Date filter
      if (dateStart || dateEnd) {
        const createdDate = new Date(lead.created_at);
        if (dateStart && createdDate < new Date(dateStart)) return false;
        if (dateEnd && createdDate > new Date(dateEnd + 'T23:59:59')) return false;
      }
      
      // 2. Agent filter
      if (agentId && lead.agent_id != agentId) return false;

      // 3. Budget filter (Lead budgets are stored in raw values. Cr = 1,00,00,000)
      const leadMinCr = (lead.budget_min || 0) / 10000000;
      const leadMaxCr = (lead.budget_max || lead.budget_min || Infinity) / 10000000;
      
      // If the lead's budget overlaps with the filter budget range
      if (leadMaxCr < budgetMinCr || leadMinCr > budgetMaxCr) {
        if (budgetMinCr > 0 || budgetMaxCr !== Infinity) return false;
      }
      
      return true;
    });

    const wrapper = document.getElementById('enquiry-log-table-wrapper');
    if (!wrapper) return;

    if (filteredLeads.length === 0) {
      wrapper.innerHTML = `<div class="empty"><div class="empty-txt">No client requirement logs found.</div></div>`;
      return;
    }

    const itemsPerPage = 50;
    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage) || 1;
    const startIdx = (state.leadsPage - 1) * itemsPerPage;
    const pagedData = filteredLeads.slice(startIdx, startIdx + itemsPerPage);
    
    const pagWrapper = document.getElementById('enquiry-pagination-wrapper');
    if (pagWrapper) pagWrapper.innerHTML = renderPaginationBar('leads', state.leadsPage, totalPages, 'changeLeadsPage');
    
    wrapper.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th style="width: 40px;"><input type="checkbox" id="check-all-leads" onchange="toggleAllRowCheckboxes('leads', this.checked)"></th>
            <th>Lead Name</th>
            ${showCol('leads', 'source') ? `<th>Source</th>` : ''}
            ${showCol('leads', 'stage') ? `<th>Staging Stage</th>` : ''}
            <th>Temp</th>
            ${showCol('leads', 'type') ? `<th>Property Type</th>` : ''}
            ${showCol('leads', 'budget') ? `<th>Budget Range</th>` : ''}
            ${showCol('leads', 'followup') ? `<th>Follow-up Date</th>` : ''}
            ${showCol('leads', 'location') ? `<th>Location Pref</th>` : ''}
            ${showCol('leads', 'agent') ? `<th>Assigned Agent</th>` : ''}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="enquiry-log-list-container">
          ${pagedData.map(l => {
            let tempClass = 'chip-warm';
            if (l.status === 'Hot') tempClass = 'chip-hot';
            if (l.status === 'Cold') tempClass = 'chip-cold';

            return `
              <tr>
                <td><input type="checkbox" class="row-checkbox-leads" value="${l.id}" onchange="updateBulkSelectionState('leads')"></td>
                <td>
                  <div style="display:flex; align-items:center; gap:6px; margin-bottom: 2px;">
                    <span style="font-size:9.5px; font-weight:700; color:var(--gold-l); background:rgba(201, 153, 26, 0.1); border: 0.5px solid rgba(201,153,26,0.2); padding:1px 4.5px; border-radius:3px; font-family:monospace;">${l.custom_lead_id || ('LD-' + (1000 + l.id))}</span>
                    <strong style="cursor:pointer; text-decoration:underline;" onclick="showLeadDetails(${l.id})">${l.name}</strong>
                  </div>
                  ${showCol('leads', 'phone') ? `<span style="font-size:10px; color:var(--text-muted)">${l.phone || ''}${l.email ? ' / ' + l.email : ''}</span>` : ''}
                  <span onclick="triggerClickToCall(${l.id}, '${l.name.replace(/'/g, "\\'")}', '${l.phone}')" style="cursor:pointer; color:var(--gold-l); font-size:11px; margin-left:4px;" title="Click-to-Call"><i class="ti ti-phone"></i></span>
                  ${l.agent_name && !showCol('leads', 'agent') ? `<br><span class="badge" style="background:rgba(201, 153, 26, 0.08); color:var(--gold-l); font-size:9px; padding:1.5px 5px; font-weight:700; margin-top:4px; display:inline-block;"><i class="ti ti-user"></i> ${l.agent_name}</span>` : ''}
                  <div style="margin-top:6px;">
                    <select class="form-select btn-sm" style="font-size:9.5px; padding:2px 4px; width:130px; border: 0.5px solid var(--border);" onchange="linkAssociateToLead(${l.id}, this.value)">
                      <option value="">-- Link Co-Broker --</option>
                      ${state.associates.map(a => `<option value="${a.id}" ${l.associate_id === a.id ? 'selected' : ''}>🤝 ${a.name}</option>`).join('')}
                    </select>
                  </div>
                </td>
                ${showCol('leads', 'source') ? `<td>${l.source}</td>` : ''}
                ${showCol('leads', 'stage') ? `<td><span class="chip ch-gold">${l.stage}</span></td>` : ''}
                <td><span class="chip ${tempClass}">${l.status}</span></td>
                ${showCol('leads', 'type') ? `<td>${l.project_type}</td>` : ''}
                ${showCol('leads', 'budget') ? `<td>₹${(l.budget_min/100000).toFixed(0)}L - ₹${(l.budget_max/100000).toFixed(0)}L</td>` : ''}
                ${showCol('leads', 'followup') ? `<td>${l.next_followup || 'Not scheduled'}</td>` : ''}
                ${showCol('leads', 'location') ? `<td>${l.location_preference || 'N/A'}</td>` : ''}
                ${showCol('leads', 'agent') ? `<td><strong>${l.agent_name || 'Unassigned'}</strong></td>` : ''}
                <td>
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:10px; padding:2px 6px;" onclick="editID('leads', ${l.id})"><i class="ti ti-edit"></i> Edit</button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--red); font-size:10px; padding:2px 6px;" onclick="deleteLead(${l.id})">✕ Remove</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function deleteLead(id) {
  try {
    await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    showToastWithUndo('Enquiry record removed.', () => restoreItem(id, 'leads'));
    loadEnquiries();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

// ------------------------------------------
// 11. COMMISSIONS FINANCE LEDGER & INVOICES
// ------------------------------------------
async function loadCommissions() {
  try {
    const res = await fetch('/api/commissions');
    const data = await res.json();
    state.commissions = data;

    const tbody = document.getElementById('commissions-list-container');
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty">No closed deals registered inside ledger.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(c => {
      const gross = c.deal_value * (c.commission_percentage / 100.0);
      const net = gross - c.co_broker_payout - c.expenses;

      return `
        <tr>
          <td><strong>${c.deal_name}</strong></td>
          <td>${formatPriceToWords(c.deal_value)}</td>
          <td>${c.commission_percentage}% <span style="font-size:10px; color:var(--text-secondary)">(${formatPriceToWords(gross)})</span></td>
          <td>${formatPriceToWords(c.co_broker_payout)}</td>
          <td><span class="chip ch-gold">${c.billing_invoice}</span></td>
          <td>${formatPriceToWords(c.expenses)}</td>
          <td><strong style="color:var(--green)">${formatPriceToWords(net)}</strong></td>
          <td><span class="chip ${c.payment_status === 'Paid' ? 'chip-closed' : 'chip-warm'}" onclick="toggleCommissionPayment(${c.id}, '${c.payment_status}')">${c.payment_status}</span></td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="showCommissionInvoicePreview(${c.id})" style="margin-bottom: 4px; width: 100%;">📄 Invoice</button>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-ghost btn-sm" onclick="editCommission(${c.id})" style="color:var(--gold-l); width: 50%;"><i class="ti ti-edit"></i> Edit</button>
              <button class="btn btn-ghost btn-sm" onclick="deleteCommission(${c.id})" style="color:var(--red); width: 50%;"><i class="ti ti-trash"></i> Del</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

async function toggleCommissionPayment(id, currentStatus) {
  const newStatus = currentStatus === 'Paid' ? 'Pending' : 'Paid';
  const c = state.commissions.find(item => item.id === id);
  if (!c) return;

  try {
    await fetch(`/api/commissions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, payment_status: newStatus })
    });
    showToast('Billing deal payment status reconciled.');
    loadCommissions();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

function showCommissionInvoicePreview(id) {
  const c = state.commissions.find(item => item.id === id);
  if (!c) return;

  const gross = c.deal_value * (c.commission_percentage / 100.0);
  const net = gross - c.co_broker_payout - c.expenses;
  const todayStr = new Date().toLocaleDateString();

  const area = document.getElementById('invoice-printout-area');
  area.innerHTML = `
    <div style="display:flex; justify-content:space-between; border-bottom: 2px solid #B8860B; padding-bottom: 12px;">
      <div>
        <h2 style="color:#B8860B; margin:0; font-size:22px;">REALPro Invoicing Ledger</h2>
        <div style="font-size:11px; margin-top:2px; color:#555">High-Integrity Real Estate Operating System</div>
      </div>
      <div style="text-align:right;">
        <h4 style="margin:0; font-size:13px;">BILLING INVOICE RECORD</h4>
        <div style="font-size:11px; color:#555">Ref ID: <strong>${c.billing_invoice || 'INV-2026-N/A'}</strong></div>
        <div style="font-size:11px; color:#555">Date: ${todayStr}</div>
      </div>
    </div>
    
    <div style="margin-top:20px; font-size:12.5px; line-height: 1.6;">
      <table style="width:100%; border-collapse:collapse;">
        <tr style="background:#fcfcf9;">
          <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd; color:#555">Deal Description</th>
          <th style="text-align:right; padding:8px; border-bottom:1px solid #ddd; color:#555">Amount (INR)</th>
        </tr>
        <tr>
          <td style="padding:10px 8px; border-bottom:1px solid #eee;">
            <strong>${c.deal_name}</strong><br>
            <span style="font-size:10.5px; color:#666">Gross closing deal value cut</span>
          </td>
          <td style="text-align:right; padding:10px 8px; border-bottom:1px solid #eee;">
            ${formatPriceToWords(c.deal_value)}
          </td>
        </tr>
        <tr>
          <td style="padding:10px 8px; border-bottom:1px solid #eee;">
            Gross Commission cut margin (${c.commission_percentage}%)
          </td>
          <td style="text-align:right; padding:10px 8px; border-bottom:1px solid #eee; color:#0D6E4E; font-weight:bold;">
            + ${formatPriceToWords(gross)}
          </td>
        </tr>
        <tr>
          <td style="padding:10px 8px; border-bottom:1px solid #eee;">
            Co-Brokerage partner share cut
          </td>
          <td style="text-align:right; padding:10px 8px; border-bottom:1px solid #eee; color:#C0392B;">
            - ${formatPriceToWords(c.co_broker_payout)}
          </td>
        </tr>
        <tr>
          <td style="padding:10px 8px; border-bottom:1px solid #eee;">
            Operational deal expenses logged
          </td>
          <td style="text-align:right; padding:10px 8px; border-bottom:1px solid #eee; color:#C0392B;">
            - ${formatPriceToWords(c.expenses)}
          </td>
        </tr>
        <tr style="font-size:14px; font-weight:bold; background:#fdfbf3;">
          <td style="padding:12px 8px; border-top:1px solid #B8860B;">
            Net Commission Earnings
          </td>
          <td style="text-align:right; padding:12px 8px; color:#B8860B; border-top:1px solid #B8860B;">
            ${formatPriceToWords(net)}
          </td>
        </tr>
      </table>
    </div>
    
    <div style="margin-top:30px; font-size:10px; color:#888; text-align:center; border-top: 1px dashed #ccc; padding-top:12px;">
      This billing summary acts as an administrative statement of accounts issued by Vasu Jain.
    </div>
  `;

  openModal('modal-invoice-popup');
}


// ------------------------------------------
// 12. DYNAMIC BLUEPRINT SHEETS VIEWS
// ------------------------------------------
function switchBlueprintTab(tabId) {
  state.blueprintTab = tabId;
  
  document.querySelectorAll('#page-blueprint .tabs .tab').forEach(el => el.classList.remove('active'));
  document.getElementById(`stab-${tabId}`).classList.add('active');

  const pane = document.getElementById('blueprint-content-pane');

  if (tabId === 'leads') {
    pane.innerHTML = `
      <div style="font-size:13px; font-weight:700; margin-bottom:8px; color:#fff">Tab 1 — MASTER_LEADS (43 database columns)</div>
      <div style="margin-bottom:12px;">
        <span class="sheet-col req">Lead_ID*</span><span class="sheet-col auto">Date_Captured</span><span class="sheet-col req">Client_Name*</span><span class="sheet-col req">Mobile_Primary*</span><span class="sheet-col opt">Mobile_Alt</span><span class="sheet-col opt">Email</span><span class="sheet-col req">Source*</span><span class="sheet-col opt">Source_Detail</span><span class="sheet-col req">Property_Type*</span><span class="sheet-col req">Config_Required*</span><span class="sheet-col req">Budget_Min*</span><span class="sheet-col req">Budget_Max*</span><span class="sheet-col req">Preferred_Location*</span><span class="sheet-col req">Timeline*</span><span class="sheet-col req">Lead_Temp*</span><span class="sheet-col req">Lead_Status*</span><span class="sheet-col opt">Assigned_To</span><span class="sheet-col auto">Last_Contact_Date</span><span class="sheet-col auto">Stale_Flag</span><span class="sheet-col req">Next_Followup_Date*</span><span class="sheet-col opt">Followup_Notes</span><span class="sheet-col opt">Site_Visit_Date</span><span class="sheet-col opt">Feedback_After_Visit</span><span class="sheet-col lock">Commission_%</span><span class="sheet-col lock">Commission_Value</span>
      </div>
      <div class="info-green">Auto-matches client budget ranges and preferred Whitefield locations in real-time.</div>
    `;
  } else if (tabId === 'inventory') {
    pane.innerHTML = `
      <div style="font-size:13px; font-weight:700; margin-bottom:8px; color:#fff">Tab 2 — INVENTORY_SECONDARY (38 database columns)</div>
      <div style="margin-bottom:12px;">
        <span class="sheet-col req">Prop_ID*</span><span class="sheet-col auto">Date_Added</span><span class="sheet-col auto">Last_Updated</span><span class="sheet-col auto">Age_Flag</span><span class="sheet-col req">Property_Type*</span><span class="sheet-col req">Config*</span><span class="sheet-col req">Location*</span><span class="sheet-col req">Society_Name*</span><span class="sheet-col req">Area_Sqft*</span><span class="sheet-col req">Ask_Price*</span><span class="sheet-col opt">Negotiable</span><span class="sheet-col opt">Floor_Price</span><span class="sheet-col req">Availability*</span><span class="sheet-col lock">Owner_Name</span><span class="sheet-col lock">Owner_Mobile</span><span class="sheet-col opt">Source_Type</span><span class="sheet-col lock">Source_Commission_%</span><span class="sheet-col opt">Remarks</span>
      </div>
      <div class="info-amber"><strong>7-Day staleness trigger:</strong> Listings without direct phone confirmation in 7+ days trigger orange Age warnings automatically.</div>
    `;
  } else if (tabId === 'projects') {
    pane.innerHTML = `
      <div style="font-size:13px; font-weight:700; margin-bottom:8px; color:#fff">Tab 3 — PROJECTS_PRIMARY (Construction tracking sheets)</div>
      <div style="margin-bottom:12px;">
        <span class="sheet-col req">Project_ID*</span><span class="sheet-col req">Project_Name*</span><span class="sheet-col req">Builder*</span><span class="sheet-col opt">RERA_No</span><span class="sheet-col req">Tower*</span><span class="sheet-col req">Unit_Type*</span><span class="sheet-col req">Size_Sqft*</span><span class="sheet-col req">Base_Price_Psqft*</span><span class="sheet-col auto">Total_Price</span><span class="sheet-col req">Units_Total*</span><span class="sheet-col req">Units_Available*</span><span class="sheet-col lock">Our_Commission_%</span><span class="sheet-col opt">Construction_%</span>
      </div>
    `;
  } else if (tabId === 'commissions') {
    pane.innerHTML = `
      <div style="font-size:13px; font-weight:700; margin-bottom:8px; color:#fff">Tab 4 — COMMISSIONS Ledger statement</div>
      <div style="margin-bottom:12px;">
        <span class="sheet-col req">Deal_ID*</span><span class="sheet-col req">Lead_ID*</span><span class="sheet-col req">Client_Name*</span><span class="sheet-col req">Property*</span><span class="sheet-col req">Deal_Value*</span><span class="sheet-col lock">Our_Comm_%</span><span class="sheet-col auto">Our_Comm_Value</span><span class="sheet-col opt">Co_Broker_ID</span><span class="sheet-col lock">Co_Broker_Share_%</span><span class="sheet-col auto">Co_Broker_Amount</span><span class="sheet-col auto">Net_Commission</span><span class="sheet-col opt">Invoice_No</span><span class="sheet-col opt">Payment_Status</span>
      </div>
    `;
  }
}

// ------------------------------------------
// 13. INTERACTIVE HABIT SCORECARD GRID
// ------------------------------------------
async function loadHabitsGrid() {
  try {
    const user = state.currentUser;
    const isAdmin = user && user.role === 'Admin';
    
    // Render the selector if the active user is an Admin
    const selectorContainer = document.getElementById('habits-agent-selector-container');
    if (selectorContainer) {
      if (isAdmin) {
        selectorContainer.style.display = 'block';
        if (!selectorContainer.innerHTML) {
          // Populate the team dropdown
          const teamRes = await fetch('/api/team');
          const teamData = await teamRes.json();
          state.teamMembers = teamData;

          let optionsHTML = teamData.map(m => `<option value="${m.id}" ${m.id === user.id ? 'selected' : ''}>${m.name} (${m.role})</option>`).join('');
          selectorContainer.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px; background:rgba(255,255,255,0.02); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border);">
              <label style="font-size:11px; font-weight:700; color:var(--gold-l);"><i class="ti ti-eye"></i> INSPECT TEAM AGENT GRID:</label>
              <select id="habits-agent-selector" class="form-input" style="max-width:250px; font-size:11px; padding:4px 8px; cursor:pointer;" onchange="handleHabitsAgentChange(this.value)">
                ${optionsHTML}
              </select>
            </div>
          `;
        }
      } else {
        selectorContainer.style.display = 'none';
        selectorContainer.innerHTML = '';
      }
    }

    let agentId = null;
    if (isAdmin) {
      const selectElem = document.getElementById('habits-agent-selector');
      if (selectElem) {
        agentId = selectElem.value;
      }
    }

    const url = agentId ? `/api/habits?agent_id=${agentId}` : '/api/habits';
    const res = await fetch(url);
    const habitsData = await res.json();
    state.habits = habitsData;

    const grid = document.getElementById('habits-scorecard-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Generate 30 days of May 2026
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-05-${day.toString().padStart(2, '0')}`;
      const isDone = Array.isArray(habitsData) && habitsData.some(h => h.habit_date === dateStr && h.is_done === 1);

      const cell = document.createElement('div');
      cell.className = `habit-cell ${isDone ? 'done' : ''}`;
      cell.innerText = day;
      
      cell.addEventListener('click', async () => {
        const currentlyDone = cell.classList.contains('done');
        try {
          const toggleRes = await fetch('/api/habits/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              habit_name: 'Daily OS Completed',
              habit_date: dateStr,
              is_done: currentlyDone ? 0 : 1,
              agent_id: agentId || undefined
            })
          });
          if (toggleRes.ok) {
            showToast(`Habit log saved for date: ${dateStr}`);
            loadHabitsGrid();
          } else {
            showToast('Failed to toggle habit', 'error');
          }
        } catch(e) {
          console.error(e);
          showToast('Failed to connect to Habit Tracker OS.', 'error');
        }
      });
      
      grid.appendChild(cell);
    }
  } catch (err) {
    console.error(err);
  }
}

window.handleHabitsAgentChange = function(val) {
  loadHabitsGrid();
};

async function toggleHabitCell(dateStr, currentlyDone) {
  // Kept for backward compatibility, but inline click listener is preferred
  try {
    const user = state.currentUser;
    const isAdmin = user && user.role === 'Admin';
    let agentId = null;
    if (isAdmin) {
      const selectElem = document.getElementById('habits-agent-selector');
      if (selectElem) {
        agentId = selectElem.value;
      }
    }

    await fetch('/api/habits/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        habit_name: 'Daily OS Completed',
        habit_date: dateStr,
        is_done: currentlyDone ? 0 : 1,
        agent_id: agentId || undefined
      })
    });
    showToast(`Habit log saved for date: ${dateStr}`);
    loadHabitsGrid();
  } catch (err) {
    console.error(err);
  }
}

// ------------------------------------------
// 14. ADMIN PROFILE & MASKING CONTROLS
// ------------------------------------------
async function loadSystemSettings() {
  try {
    const res = await fetch('/api/system/settings');
    const data = await res.json();
    state.systemSettings = data;
    state.isAdmin = data.showMaskedFields;

    // Apply names in user avatar
    document.getElementById('user-name').innerText = data.userName;
    document.getElementById('user-av').innerText = data.userName.charAt(0).toUpperCase();
    document.querySelector('.sb-urole').innerText = data.userRole;

    // Sync elements inside Settings page
    document.getElementById('settings-uname').value = data.userName;
    document.getElementById('settings-urole').value = data.userRole;

    // Load Co-branding
    if (data.coBrandName) {
      const cbTitle = document.getElementById('cobrand-title');
      if (cbTitle) cbTitle.innerText = data.coBrandName;
      const settCbName = document.getElementById('settings-cobrand-name');
      if (settCbName) settCbName.value = data.coBrandName;
    }
    if (data.coBrandLogo) {
      const cbEmblem = document.getElementById('cobrand-emblem');
      if (cbEmblem) {
        cbEmblem.innerHTML = `<img src="${data.coBrandLogo}" style="max-height: 24px; max-width: 24px; border-radius: 4px; object-fit: contain;">`;
      }
      const settCbLogo = document.getElementById('settings-cobrand-logo');
      if (settCbLogo) settCbLogo.value = data.coBrandLogo;
    } else {
      const cbEmblem = document.getElementById('cobrand-emblem');
      if (cbEmblem) {
        cbEmblem.innerHTML = `<i class="ti ti-crown"></i>`;
      }
      const settCbLogo = document.getElementById('settings-cobrand-logo');
      if (settCbLogo) settCbLogo.value = '';
    }

    const statusBanner = document.getElementById('settings-mask-status');
    if (data.showMaskedFields) {
      statusBanner.className = 'info-green';
      statusBanner.innerText = '🔓 Administrator Mode — All private contacts, unit numbers and splits visible';
    } else {
      statusBanner.className = 'info-red';
      statusBanner.innerText = '🔒 Employee Masking Active — Private owner contacts and margins locked';
    }

    // Sync Company Profile & Bank Remittance Coordinates inputs
    if (data.coPhone !== undefined) {
      const el = document.getElementById('settings-co-phone');
      if (el) el.value = data.coPhone;
    }
    if (data.coEmail !== undefined) {
      const el = document.getElementById('settings-co-email');
      if (el) el.value = data.coEmail;
    }
    if (data.coAddress !== undefined) {
      const el = document.getElementById('settings-co-address');
      if (el) el.value = data.coAddress;
    }
    if (data.coRera !== undefined) {
      const el = document.getElementById('settings-co-rera');
      if (el) el.value = data.coRera;
    }
    if (data.coGstin !== undefined) {
      const el = document.getElementById('settings-co-gstin');
      if (el) el.value = data.coGstin;
    }
    if (data.bankName !== undefined) {
      const el = document.getElementById('settings-bank-name');
      if (el) el.value = data.bankName;
    }
    if (data.bankAccount !== undefined) {
      const el = document.getElementById('settings-bank-account');
      if (el) el.value = data.bankAccount;
    }
    if (data.bankIfsc !== undefined) {
      const el = document.getElementById('settings-bank-ifsc');
      if (el) el.value = data.bankIfsc;
    }
    if (data.bankType !== undefined) {
      const el = document.getElementById('settings-bank-type');
      if (el) el.value = data.bankType;
    }
    if (data.bankBranch !== undefined) {
      const el = document.getElementById('settings-bank-branch');
      if (el) el.value = data.bankBranch;
    }
    if (data.invoiceTerms !== undefined) {
      const el = document.getElementById('settings-invoice-terms');
      if (el) el.value = data.invoiceTerms;
    }

    updateAdminToggleButtonUI();
    applyAdminModeVisibility();
  } catch (err) {
    console.error(err);
  }
}

window.toggleAdminMode = async function() {
  if (state.currentUser && state.currentUser.role !== 'Admin') {
    showToast('⚠️ Unauthorized: Standard agents cannot toggle admin privileges.', 'warning');
    return;
  }

  const currentIsAdmin = state.systemSettings.showMaskedFields;
  const newIsAdmin = !currentIsAdmin;
  const newRole = newIsAdmin ? 'Owner / Admin' : 'Employee';
  const newName = state.systemSettings.userName || 'Vasu Jain';

  try {
    const res = await fetch('/api/system/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: newName,
        userRole: newRole,
        showMaskedFields: newIsAdmin
      })
    });
    const data = await res.json();
    state.systemSettings = data;
    state.isAdmin = data.showMaskedFields;

    showToast(`Role switched to ${newRole === 'Owner / Admin' ? 'Administrator' : 'Employee'} Mode.`);
    
    // Update settings form if we are on the settings page
    const settingsRoleInput = document.getElementById('settings-urole');
    if (settingsRoleInput) settingsRoleInput.value = newRole;

    await loadSystemSettings();
    
    // Instantly reload active page context to demonstrate live masking!
    if (state.activePage === 'inventory' || state.activePage === 'properties') loadProperties();
    else if (state.activePage === 'dashboard') loadDashboardData();
    else if (state.activePage === 'leads' || state.activePage === 'pipeline') {
      loadPipeline();
    }
  } catch (err) {
    console.error(err);
  }
};

function updateAdminToggleButtonUI() {
  const btn = document.getElementById('btn-admin-toggle');
  if (!btn) return;
  const isAdmin = state.systemSettings.showMaskedFields;
  if (isAdmin) {
    btn.innerHTML = '🔓 Admin Mode';
    btn.style.background = 'rgba(201, 153, 26, 0.15)';
    btn.style.border = '1px solid var(--gold)';
    btn.style.color = 'var(--gold-l)';
  } else {
    btn.innerHTML = '🔒 Employee Mode';
    btn.style.background = 'rgba(239, 68, 68, 0.15)';
    btn.style.border = '1px solid #ef4444';
    btn.style.color = '#f87171';
  }
}

function applyAdminModeVisibility() {
  const isAdmin = state.systemSettings.showMaskedFields;
  const adminFields = document.querySelectorAll('.admin-only-field');
  adminFields.forEach(el => {
    if (isAdmin) {
      el.classList.remove('hidden');
      el.style.display = ''; // reset to default
    } else {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  });

  // Redirect to dashboard if currently viewing an admin-only page in Employee mode
  if (!isAdmin && state.activePage) {
    const activeNavItem = document.querySelector(`.nav-item[data-page="${state.activePage}"]`);
    if (activeNavItem && activeNavItem.classList.contains('admin-only-field')) {
      navToPage('dashboard');
    }
  }
}

async function handleSettingsRoleChange(val) {
  const showMask = (val === 'Owner / Admin');
  const banner = document.getElementById('settings-mask-status');
  
  if (showMask) {
    banner.className = 'info-green';
    banner.innerText = '🔓 Administrator Mode — All private contacts, unit numbers and splits visible';
  } else {
    banner.className = 'info-red';
    banner.innerText = '🔒 Employee Masking Active — Private owner contacts and margins locked';
  }
}

async function saveSystemSettings() {
  const name = document.getElementById('settings-uname').value;
  const role = document.getElementById('settings-urole').value;
  const showMask = (role === 'Owner / Admin');
  const coBrandName = document.getElementById('settings-cobrand-name').value;
  const coBrandLogo = document.getElementById('settings-cobrand-logo').value;

  const coPhone = document.getElementById('settings-co-phone')?.value || '';
  const coEmail = document.getElementById('settings-co-email')?.value || '';
  const coAddress = document.getElementById('settings-co-address')?.value || '';
  const coRera = document.getElementById('settings-co-rera')?.value || '';
  const coGstin = document.getElementById('settings-co-gstin')?.value || '';
  const bankName = document.getElementById('settings-bank-name')?.value || '';
  const bankAccount = document.getElementById('settings-bank-account')?.value || '';
  const bankIfsc = document.getElementById('settings-bank-ifsc')?.value || '';
  const bankType = document.getElementById('settings-bank-type')?.value || '';
  const bankBranch = document.getElementById('settings-bank-branch')?.value || '';
  const invoiceTerms = document.getElementById('settings-invoice-terms')?.value || '';

  try {
    const res = await fetch('/api/system/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: name,
        userRole: role,
        showMaskedFields: showMask,
        coBrandName: coBrandName,
        coBrandLogo: coBrandLogo,
        coPhone: coPhone,
        coEmail: coEmail,
        coAddress: coAddress,
        coRera: coRera,
        coGstin: coGstin,
        bankName: bankName,
        bankAccount: bankAccount,
        bankIfsc: bankIfsc,
        bankType: bankType,
        bankBranch: bankBranch,
        invoiceTerms: invoiceTerms
      })
    });
    const data = await res.json();
    state.systemSettings = data;
    state.isAdmin = data.showMaskedFields;

    showToast('Administrative configurations successfully updated.');
    await loadSystemSettings();
    
    // Instantly reload active page context to demonstrate live masking!
    if (state.activePage === 'inventory' || state.activePage === 'properties') loadProperties();
    else if (state.activePage === 'dashboard') loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

// ------------------------------------------
// 15. DYNAMIC FORM SUBMISSIONS (AJAX MODALS)
// ------------------------------------------
async function submitAddTodo(e) {
  e.preventDefault();
  const data = {
    task: document.getElementById('todo-task-name').value,
    status: document.getElementById('todo-task-status').value,
    due_date: document.getElementById('todo-task-date').value
  };

  try {
    await fetch('/api/dashboard/todo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    showToast('Priority task successfully logged.');
    document.getElementById('form-add-todo').reset();
    closeModal('modal-add-todo');
    loadTodos();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

async function submitAddListing(e) {
  e.preventDefault();
  
  const typeVal = document.getElementById('prop-type').value;
  const mandateVal = document.getElementById('prop-mandate').value;
  const statusVal = document.getElementById('prop-status').value;
  const interiorsVal = document.getElementById('prop-interiors').value;
  const sourceVal = document.getElementById('prop-source').value;

  // Persist any newly typed custom dropdown options globally
  saveCustomDropdownValue('propertyTypes', typeVal);
  saveCustomDropdownValue('mandateTypes', mandateVal);
  saveCustomDropdownValue('statusTypes', statusVal);
  saveCustomDropdownValue('interiorsTypes', interiorsVal);
  saveCustomDropdownValue('propertySources', sourceVal);

  const data = {
    property_type: typeVal,
    prop_id: document.getElementById('prop-id').value,
    mandate_type: mandateVal,
    society: document.getElementById('prop-society').value,
    location: document.getElementById('prop-location').value,
    status: statusVal,
    site_area: document.getElementById('prop-site-area').value,
    area_sqft: parseFloat(document.getElementById('prop-area').value || 0),
    configuration: document.getElementById('prop-config').value,
    floor_info: document.getElementById('prop-floor-info').value,
    floor_range: document.getElementById('prop-floor-range').value,
    interiors: interiorsVal,
    facing: document.getElementById('prop-facing').value,
    amenities: document.getElementById('prop-amenities').value,
    car_park: document.getElementById('prop-carpark').value,
    price: parseFloat(document.getElementById('prop-price').value || 0),
    possession: document.getElementById('prop-possession').value,
    project_size: document.getElementById('prop-project-size').value,
    project_status: document.getElementById('prop-project-status').value,
    additional_info: document.getElementById('prop-add-info').value,
    video_link: document.getElementById('prop-video').value,
    photo_link: document.getElementById('prop-photo').value,
    brochure_link: document.getElementById('prop-brochure').value,
    owner_name: document.getElementById('prop-owner-name').value,
    owner_phone: document.getElementById('prop-owner-phone').value,
    owner_email: document.getElementById('prop-owner-email').value,
    unit_no: document.getElementById('prop-unit-no').value,
    registration_status: document.getElementById('prop-registration').value,
    source: sourceVal,
    sub_source: document.getElementById('prop-sub-source').value,
    commission_agreed: document.getElementById('prop-commission-agreed').value,
    google_map_url: document.getElementById('prop-google-map-url').value,
    comments: document.getElementById('prop-comments').value,
    admin_comments: document.getElementById('prop-admin-comments').value,
    special_tags: (() => {
      // Merge checkbox flags into special_tags
      const base = (document.getElementById('prop-tags').value || '').split(',').map(t => t.trim()).filter(Boolean);
      if (document.getElementById('prop-flag-distress')?.checked && !base.includes('Distress Sale')) base.push('Distress Sale');
      if (document.getElementById('prop-flag-bank')?.checked && !base.includes('Bank Auction')) base.push('Bank Auction');
      if (document.getElementById('prop-flag-belowmkt')?.checked && !base.includes('Below Market Value')) base.push('Below Market Value');
      return base.join(', ');
    })(),
    zone: document.getElementById('prop-zone').value,
    onboarded_year: document.getElementById('prop-year').value,
    available_for: document.getElementById('prop-available-for').value,
    maintenance: document.getElementById('prop-maintenance').value,
    deposit: document.getElementById('prop-deposit').value,
    plot_size: document.getElementById('prop-plot-size').value,
    sba: document.getElementById('prop-sba').value,
    plot_dimension: document.getElementById('prop-plot-dimension').value,
    plot_facing: document.getElementById('prop-plot-facing').value,
    house_facing: document.getElementById('prop-house-facing').value,
    project_id: document.getElementById('prop-project-link').value || null,
    associate_id: document.getElementById('prop-associate-id').value ? parseInt(document.getElementById('prop-associate-id').value) : null
  };


  try {
    const editId = document.getElementById('edit-resale-id').value;
    const url = editId ? `/api/properties/${editId}` : `/api/properties`;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.status === 409) {
      const errData = await res.json();
      showDuplicateModal(errData.error, errData.existingId, async () => {
        try {
          const forceRes = await fetch(editId ? `/api/properties/${editId}?force=true` : '/api/properties?force=true', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (forceRes.ok) {
            showToast('Secondary market property listed (Forced addition).');
            document.getElementById('form-add-listing').reset();
            toggleVillaFields('', 'resale');
            closeModal('modal-add-listing');
            loadProperties();
            loadDashboardData();
          } else {
            showToast('Failed to force list property.');
          }
        } catch (e) { console.error(e); }
      });
      return;
    }

    if (!res.ok) throw new Error('Failed to list property.');

    showToast(editId ? 'Secondary market property updated successfully.' : 'Secondary market property listed successfully.');
    document.getElementById('form-add-listing').reset();
    const sp = document.getElementById('scratchpad-textarea');
    if (sp) sp.value = '';
    toggleVillaFields('', 'resale');
    closeModal('modal-add-listing');
    loadProperties();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

async function submitAddRental(e) {
  e.preventDefault();
  const data = {
    property_type: document.getElementById('rental-type').value,
    prop_id: document.getElementById('rent-id').value,
    mandate_type: document.getElementById('rental-mandate').value,
    society: document.getElementById('rental-society').value,
    location: document.getElementById('rental-location').value,
    status: document.getElementById('rental-status').value,
    site_area: document.getElementById('rental-site-area').value,
    area_sqft: parseFloat(document.getElementById('rental-area').value || 0),
    configuration: document.getElementById('rental-config').value,
    floor_info: document.getElementById('rental-floor-info').value,
    interiors: document.getElementById('rental-interiors').value,
    facing: document.getElementById('rental-facing').value,
    car_park: document.getElementById('rental-carpark').value,
    price: parseFloat(document.getElementById('rental-price').value || 0),
    maintenance: parseFloat(document.getElementById('rental-maintenance').value || 0),
    deposit: parseFloat(document.getElementById('rental-deposit').value || 0),
    available_from: document.getElementById('rental-available-from').value,
    date_of_inventory: document.getElementById('rental-date-of-inventory').value,
    additional_info: document.getElementById('rental-add-info').value,
    video_link: document.getElementById('rental-video').value,
    photo_link: document.getElementById('rental-photo').value,
    brochure_link: document.getElementById('rental-brochure').value,
    owner_name: document.getElementById('rental-owner-name').value,
    owner_phone: document.getElementById('rental-owner-phone').value,
    owner_email: document.getElementById('rental-owner-email').value,
    unit_no: document.getElementById('rental-unit-no').value,
    registration_status: document.getElementById('rental-registration').value,
    source: document.getElementById('rental-source').value,
    sub_source: document.getElementById('rental-sub-source').value,
    commission_agreed: document.getElementById('rental-commission-agreed').value,
    google_map_url: document.getElementById('rental-google-map-url').value,
    comments: document.getElementById('rental-comments').value,
    admin_comments: document.getElementById('rental-admin-comments').value,
    plot_size: document.getElementById('rental-plot-size').value,
    sba: document.getElementById('rental-sba').value,
    plot_dimension: document.getElementById('rental-plot-dimension').value,
    plot_facing: document.getElementById('rental-plot-facing').value,
    house_facing: document.getElementById('rental-house-facing').value,
    available_for: 'Rent / Lease',
    zone: document.getElementById('rent-zone').value,
    onboarded_year: document.getElementById('rent-year').value,
    project_id: document.getElementById('rental-project-link').value || null,
    associate_id: document.getElementById('rental-associate-id').value ? parseInt(document.getElementById('rental-associate-id').value) : null
  };

  try {
    
    const editId = document.getElementById('edit-rental-id').value;
    const url = editId ? `/api/properties/${editId}` : `/api/properties`;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });


    if (res.status === 409) {
      const errData = await res.json();
      showDuplicateModal(errData.error, errData.existingId, async () => {
        try {
          const forceRes = await fetch(editId ? `/api/properties/${editId}?force=true` : '/api/properties?force=true', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (forceRes.ok) {
            showToast('Rental segment property listed (Forced addition).');
            document.getElementById('form-add-rental').reset();
            toggleVillaFields('', 'rental');
            closeModal('modal-add-rental');
            loadProperties();
            loadDashboardData();
          } else {
            showToast('Failed to force list property.');
          }
        } catch (e) { console.error(e); }
      });
      return;
    }

    if (!res.ok) throw new Error('Failed to list rental property.');

    showToast(editId ? 'Rental segment property updated successfully.' : 'Rental segment property listed successfully.');
    document.getElementById('form-add-rental').reset();
    const sp = document.getElementById('scratchpad-textarea');
    if (sp) sp.value = '';
    toggleVillaFields('', 'rental');
    closeModal('modal-add-rental');
    loadProperties();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

async function submitAddCommercial(e) {
  e.preventDefault();
  const data = {
    property_type: 'Commercial',
    prop_id: document.getElementById('comm-id').value,
    mandate_type: document.getElementById('comm-mandate').value,
    society: document.getElementById('comm-society').value,
    location: document.getElementById('comm-location').value,
    available_for: document.getElementById('comm-available-for').value,
    plot_size: document.getElementById('comm-plot-size').value,
    area_sqft: parseFloat(document.getElementById('comm-area').value || 0),
    interiors: document.getElementById('comm-interiors').value,
    car_park: document.getElementById('comm-carpark').value,
    price: parseFloat(document.getElementById('comm-price').value || 0),
    maintenance: parseFloat(document.getElementById('comm-maintenance').value || 0),
    deposit: parseFloat(document.getElementById('comm-deposit').value || 0),
    possession: document.getElementById('comm-possession').value,
    additional_info: document.getElementById('comm-add-info').value,
    video_link: document.getElementById('comm-video').value,
    photo_link: document.getElementById('comm-photo').value,
    brochure_link: document.getElementById('comm-brochure').value,
    owner_name: document.getElementById('comm-owner-name').value,
    owner_phone: document.getElementById('comm-owner-phone').value,
    owner_email: document.getElementById('comm-owner-email').value,
    unit_no: document.getElementById('comm-unit-no').value,
    registration_status: document.getElementById('comm-registration').value,
    source: document.getElementById('comm-source').value,
    sub_source: document.getElementById('comm-sub-source').value,
    commission_agreed: document.getElementById('comm-commission-agreed').value,
    google_map_url: document.getElementById('comm-google-map-url').value,
    comments: document.getElementById('comm-comments').value,
    admin_comments: document.getElementById('comm-admin-comments').value,
    zone: document.getElementById('comm-zone').value,
    onboarded_year: document.getElementById('comm-year').value,
    project_id: document.getElementById('comm-project-link').value || null,
    associate_id: document.getElementById('comm-prop-associate-id').value ? parseInt(document.getElementById('comm-prop-associate-id').value) : null
  };

  try {
    
    const editId = document.getElementById('edit-commercial-id').value;
    const url = editId ? `/api/properties/${editId}` : `/api/properties`;
    const method = editId ? 'PUT' : 'POST';
    await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    showToast(editId ? 'Commercial segment property updated successfully.' : 'Commercial segment property listed successfully.');
    document.getElementById('form-add-commercial').reset();
    const sp = document.getElementById('scratchpad-textarea');
    if (sp) sp.value = '';
    closeModal('modal-add-commercial');
    loadProperties();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

window.submitAddLand = async function(e) {
  e.preventDefault();
  const data = {
    prop_id: document.getElementById('land-id').value,
    mandate_type: document.getElementById('land-mandate').value,
    property_type: document.getElementById('land-type').value,
    society: document.getElementById('land-society').value,
    location: document.getElementById('land-location').value,
    status: document.getElementById('land-status').value,
    area_sqft: parseFloat(document.getElementById('land-area').value || 0),
    configuration: document.getElementById('land-zoning').value,
    plot_size: document.getElementById('land-size').value,
    plot_dimension: document.getElementById('land-dimensions').value,
    plot_facing: document.getElementById('land-facing').value,
    price: parseFloat(document.getElementById('land-price').value || 0),
    unit_no: document.getElementById('land-unit-no').value,
    registration_status: document.getElementById('land-registration').value,
    owner_name: document.getElementById('land-owner-name').value,
    owner_phone: document.getElementById('land-owner-phone').value,
    owner_email: document.getElementById('land-owner-email').value,
    source: document.getElementById('land-source').value,
    sub_source: document.getElementById('land-sub-source').value,
    commission_agreed: document.getElementById('land-commission-agreed').value,
    google_map_url: document.getElementById('land-google-map-url').value,
    comments: document.getElementById('land-comments').value,
    admin_comments: document.getElementById('land-admin-comments').value,
    onboarded_year: document.getElementById('land-year').value,
    project_id: document.getElementById('land-project-link').value || null,
    road_width: document.getElementById('land-road-width').value,
    fsi: document.getElementById('land-fsi').value,
    available_for: 'Sale',
    associate_id: document.getElementById('land-associate-id').value ? parseInt(document.getElementById('land-associate-id').value) : null
  };

  try {
    const editId = document.getElementById('edit-land-id').value;
    const url = editId ? `/api/properties/${editId}` : `/api/properties`;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.status === 409) {
      const respData = await res.json();
      showDuplicateModal(respData.error, respData.existingId, async () => {
        const forceRes = await fetch(editId ? `/api/properties/${editId}?force=true` : '/api/properties?force=true', {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (forceRes.ok) {
          showToast(editId ? 'Land listing updated.' : 'Land listing saved.');
          document.getElementById('form-add-land').reset();
          closeModal('modal-add-land');
          loadProperties();
          loadDashboardData();
        } else {
          showToast('Failed to save listing.', 'error');
        }
      });
      return;
    }

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to save listing');
    }

    showToast(editId ? 'Land listing updated successfully.' : 'Land listing saved successfully.');
    document.getElementById('form-add-land').reset();
    closeModal('modal-add-land');
    loadProperties();
    loadDashboardData();
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
};

let editingProjectId = null;

function addUnitRow(config='', area='', price='') {
  const container = document.getElementById('unit-details-container');
  const div = document.createElement('div');
  div.className = 'unit-row';
  div.style.display = 'flex';
  div.style.gap = '8px';
  div.style.marginBottom = '8px';
  div.innerHTML = `
    <input type="text" class="form-input unit-config" placeholder="Config (e.g. 2BHK)" style="flex:1" value="${config}">
    <input type="text" class="form-input unit-area" placeholder="Carpet Area" style="flex:1" value="${area}">
    <input type="text" class="form-input unit-price" placeholder="Price Range" style="flex:1" value="${price}">
    <button type="button" class="btn btn-d btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

function addPocRow(name='', phone='', email='', role='') {
  const container = document.getElementById('poc-details-container');
  const div = document.createElement('div');
  div.className = 'poc-row';
  div.style.display = 'flex';
  div.style.gap = '8px';
  div.style.marginBottom = '8px';
  div.innerHTML = `
    <input type="text" class="form-input poc-name" placeholder="Name" style="flex:1" value="${name}">
    <input type="text" class="form-input poc-phone" placeholder="Phone" style="flex:1" value="${phone}">
    <input type="text" class="form-input poc-email" placeholder="Email" style="flex:1" value="${email}">
    <input type="text" class="form-input poc-role" placeholder="Role/Title" style="flex:1" value="${role}">
    <button type="button" class="btn btn-d btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

async function submitAddProject(e) {
  e.preventDefault();
  
  // Extract dynamic units
  const units = [];
  document.querySelectorAll('#unit-details-container .unit-row').forEach(row => {
    const config = row.querySelector('.unit-config').value.trim();
    if (config) {
      units.push({
        config,
        area: row.querySelector('.unit-area').value.trim(),
        price: row.querySelector('.unit-price').value.trim()
      });
    }
  });

  // Extract dynamic POCs
  const pocs = [];
  document.querySelectorAll('#poc-details-container .poc-row').forEach(row => {
    const name = row.querySelector('.poc-name').value.trim();
    if (name) {
      pocs.push({
        name,
        phone: row.querySelector('.poc-phone').value.trim(),
        email: row.querySelector('.poc-email').value.trim(),
        role: row.querySelector('.poc-role').value.trim()
      });
    }
  });

  const data = {
    builder_name: document.getElementById('proj-builder').value,
    project_name: document.getElementById('proj-name').value,
    location: document.getElementById('proj-location').value,
    land_parcel: document.getElementById('proj-land-parcel').value,
    tower: document.getElementById('proj-tower').value,
    elevation: document.getElementById('proj-elevation').value,
    configuration: document.getElementById('proj-configs').value,
    carpet_area: document.getElementById('proj-carpet').value,
    price_final: document.getElementById('proj-price').value,
    uc_rtmi: document.getElementById('proj-uc-rtmi').value,
    possession: document.getElementById('proj-possession').value,
    subvention: document.getElementById('proj-subvention').value,
    clp_due: document.getElementById('proj-clp-due').value,
    floor_rise: document.getElementById('proj-floor-rise').value,
    location_usp: document.getElementById('proj-location-usp').value,
    metro_station: document.getElementById('proj-metro').value,
    other_usp: document.getElementById('proj-other-usp').value,
    google_map_url: document.getElementById('proj-google-map')?.value || '',
    unit_details: JSON.stringify(units),
    builder_poc_details: JSON.stringify(pocs),
    admin_comments: document.getElementById('proj-admin-comments').value,
    brochure_link: document.getElementById('proj-brochure').value,
    floor_plans: document.getElementById('proj-floor-plans').value,
    mother_docs: document.getElementById('proj-mother-docs').value,
    assignments: document.getElementById('proj-assignments').value,
    kyc_docs: document.getElementById('proj-kyc-docs').value,
    photos: document.getElementById('proj-photos').value,
    videos: document.getElementById('proj-videos').value,
    cp_agreements: document.getElementById('proj-cp-agreements').value,
    finance_info: document.getElementById('proj-finance-info').value,
    analytics_info: document.getElementById('proj-analytics-info').value
  };

  saveCustomDropdownValue('projectBuilders', data.builder_name);
  saveCustomDropdownValue('projectLocations', data.location);
  saveCustomDropdownValue('projectConfigs', data.configuration);

  try {
    let res;
    if (editingProjectId) {
      res = await fetch('/api/projects/' + editingProjectId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    if (res.status === 409) {
      const errData = await res.json();
      showDuplicateModal(errData.error, errData.existingId, async () => {
        try {
          const forceRes = await fetch('/api/projects?force=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (forceRes.ok) {
            showToast('Project sheet generated (Forced addition).');
            document.getElementById('form-add-project').reset();
            document.getElementById('unit-details-container').innerHTML = '';
            document.getElementById('poc-details-container').innerHTML = '';
            closeModal('modal-add-project');
            loadProjects();
          } else {
            showToast('Failed to force generate project.');
          }
        } catch (e) { console.error(e); }
      });
      return;
    }

    if (!res.ok) throw new Error('Failed to save project.');

    if (editingProjectId) {
      showToast('Project updated successfully.');
    } else {
      showToast('Primary developer project sheet generated.');
    }
    
    editingProjectId = null;
    document.querySelector('#form-add-project button[type="submit"]').innerText = 'Submit Project';
    document.getElementById('form-add-project').reset();
    document.getElementById('unit-details-container').innerHTML = '';
    document.getElementById('poc-details-container').innerHTML = '';
    closeModal('modal-add-project');
    loadProjects();
  } catch (err) {
    console.error(err);
  }
}

let editingAssociateId = null;

async function submitAddAssociate(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('assoc-name').value,
    company: document.getElementById('assoc-company').value,
    phone: document.getElementById('assoc-phone').value,
    email: document.getElementById('assoc-email').value,
    co_brokerage_share: parseFloat(document.getElementById('assoc-share').value || 0),
    rating: parseInt(document.getElementById('assoc-rating').value),
    speciality_zones: document.getElementById('assoc-zones').value,
    is_inner_circle: document.getElementById('assoc-inner-circle').checked
  };

  try {
    if (editingAssociateId) {
      await fetch('/api/associates/' + editingAssociateId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      showToast('Associate updated successfully.');
    } else {
      await fetch('/api/associates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      showToast('Co-broker logged successfully.');
    }
    
    editingAssociateId = null;
    document.querySelector('#form-add-associate button[type="submit"]').innerText = 'Submit Associate';
    document.getElementById('form-add-associate').reset();
    closeModal('modal-add-associate');
    loadAssociates();
    if (window.refreshActivePageData) window.refreshActivePageData();
  } catch (err) {
    console.error(err);
  }
}

let editingCommissionId = null;

async function submitAddCommission(e) {
  e.preventDefault();
  const commAmount = parseFloat(document.getElementById('comm-amount').value || 0);
  const data = {
    deal_name: document.getElementById('comm-name').value,
    deal_value: parseFloat(document.getElementById('comm-value').value || 0),
    commission_percentage: parseFloat(document.getElementById('comm-percent').value || 0),
    commission_amount: commAmount,
    co_broker_payout: parseFloat(document.getElementById('comm-payout').value || 0),
    expenses: parseFloat(document.getElementById('comm-expenses').value || 0),
    billing_invoice: document.getElementById('comm-invoice').value,
    payment_status: document.getElementById('comm-status').value,
    associate_id: document.getElementById('comm-associate-id').value ? parseInt(document.getElementById('comm-associate-id').value) : null
  };

  try {
    if (editingCommissionId) {
      await fetch('/api/commissions/' + editingCommissionId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      showToast('Deal commission updated.');
    } else {
      await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      showToast('Deal commission registered.');
    }
    
    editingCommissionId = null;
    document.querySelector('#form-add-commission button[type="submit"]').innerText = 'Submit Deal';
    document.getElementById('form-add-commission').reset();
    closeModal('modal-add-commission');
    loadCommissions();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

function editCommission(id) {
  const c = state.commissions.find(item => item.id === id);
  if (c) {
    document.getElementById('comm-name').value = c.deal_name;
    document.getElementById('comm-value').value = c.deal_value;
    document.getElementById('comm-percent').value = c.commission_percentage;
    document.getElementById('comm-amount').value = c.commission_amount || Math.round(c.deal_value * (c.commission_percentage / 100.0));
    document.getElementById('comm-payout').value = c.co_broker_payout;
    document.getElementById('comm-expenses').value = c.expenses;
    document.getElementById('comm-invoice').value = c.billing_invoice;
    document.getElementById('comm-status').value = c.payment_status;
    document.getElementById('comm-associate-id').value = c.associate_id || '';
    
    editingCommissionId = id;
    document.querySelector('#form-add-commission button[type="submit"]').innerText = 'Update Deal';
    openModal('modal-add-commission');
  }
}

async function deleteCommission(id) {
  if (confirm("Are you sure you want to delete this commission record?")) {
    try {
      await fetch('/api/commissions/' + id, { method: 'DELETE' });
      showToast('Commission record deleted.');
      loadCommissions();
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  }
}

// ------------------------------------------
// 16. HELPER UTILITIES (MODALS, TOASTS)
// ------------------------------------------
// --- AUTO ID GENERATOR PREVIEW ---
async function editID(type, id, currentId) {
  const newId = prompt("Edit ID:", currentId || '');
  if (newId === null || newId.trim() === currentId) return;
  try {
    const res = await fetch(`/api/${type}/edit-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, newId: newId.trim() })
    });
    if (res.ok) {
      showToast('ID successfully updated!');
      if (type === 'properties') loadProperties();
      else if (type === 'projects') loadProjects();
    } else {
      showToast('Failed to update ID', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Error updating ID', 'error');
  }
}

async function previewID(targetInputId, propTypeInputId, availableFor, zoneInputId, yearInputId, isProject) {
  try {
    const propTypeEl = document.getElementById(propTypeInputId);
    const zoneEl = document.getElementById(zoneInputId);
    const yearEl = document.getElementById(yearInputId);

    const propType = propTypeEl ? propTypeEl.value : '';
    const zone = zoneEl ? zoneEl.value : 'N';
    const year = yearEl ? yearEl.value : new Date().getFullYear();

    const query = new URLSearchParams({
      propType,
      availableFor: availableFor || '',
      isProject: isProject ? 'true' : 'false',
      zone,
      year
    });

    const res = await fetch('/api/generate-id?' + query.toString());
    const data = await res.json();
    if (data.generatedId) {
      document.getElementById(targetInputId).value = data.generatedId;
      showToast('Preview loaded! Next ID is: ' + data.generatedId);
    }
  } catch (err) {
    console.error('Error previewing ID', err);
    showToast('Failed to preview ID', 'error');
  }
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

window.showAddTodoModal = () => openModal('modal-add-todo');
window.showAddListingModal = () => {
  document.getElementById('form-add-listing').reset();
  if (typeof toggleVillaFields === 'function') toggleVillaFields('', 'resale');
  const titleEl = document.querySelector('#modal-add-listing .mtitle');
  if (titleEl) titleEl.innerText = '🏢 Register Resale Property Listing (31 Custom Fields)';
  openModal('modal-add-listing');
};
window.showAddRentalModal = () => {
  document.getElementById('form-add-rental').reset();
  if (typeof toggleVillaFields === 'function') toggleVillaFields('', 'rental');
  const titleEl = document.querySelector('#modal-add-rental .mtitle');
  if (titleEl) titleEl.innerText = '🏢 Register Rental Segment Property (30 Custom Fields)';
  openModal('modal-add-rental');
};
window.showAddCommercialModal = () => {
  document.getElementById('form-add-commercial').reset();
  const titleEl = document.querySelector('#modal-add-commercial .mtitle');
  if (titleEl) titleEl.innerText = '🏢 Register Commercial Segment Property';
  openModal('modal-add-commercial');
};
window.showAddLandModal = () => {
  document.getElementById('form-add-land').reset();
  const titleEl = document.querySelector('#modal-add-land .mtitle');
  if (titleEl) titleEl.innerText = '🏢 Register Land / Plot Listing';
  const configs = getStoredConfigs();
  populateSelectElement('land-source', configs.propertySources);
  openModal('modal-add-land');
};

window.cloneProperty = function(id) {
  const p = state.properties.find(x => x.id == id);
  if (!p) {
    showToast('Property not found', 'error');
    return;
  }

  const pType = (p.property_type || '').toLowerCase();
  const isCommercial = pType.includes('commercial') || pType.includes('office') || pType.includes('retail') || pType.includes('warehouse') || pType.includes('showroom');
  const isRental = pType === 'rental' || (p.available_for && p.available_for.toLowerCase().includes('rent')) || (p.available_for && p.available_for.toLowerCase().includes('lease')) || (p.price_raw || '').toLowerCase().includes('/mo');

  const setVal = (fieldId, val) => {
    const el = document.getElementById(fieldId);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  };

  if (isCommercial) {
    document.getElementById('form-add-commercial').reset();
    
    setVal('comm-id', '');
    setVal('comm-mandate', p.mandate_type || 'Non Exclusive');
    setVal('comm-society', p.society);
    setVal('comm-location', p.location);
    setVal('comm-available-for', p.available_for || 'Rent');
    setVal('comm-plot-size', p.plot_size);
    setVal('comm-area', p.area_sqft);
    setVal('comm-interiors', p.interiors || 'Unfurnished');
    setVal('comm-carpark', p.car_park);
    setVal('comm-price', p.price);
    setVal('comm-maintenance', p.maintenance);
    setVal('comm-deposit', p.deposit);
    setVal('comm-possession', p.possession);
    setVal('comm-add-info', p.additional_info);
    setVal('comm-video', p.video_link);
    setVal('comm-photo', p.photo_link);
    setVal('comm-brochure', p.brochure_link);
    
    setVal('comm-owner-name', '');
    setVal('comm-owner-phone', '');
    setVal('comm-owner-email', '');
    setVal('comm-unit-no', '');
    
    setVal('comm-registration', p.registration_status);
    setVal('comm-source', p.source);
    setVal('comm-sub-source', p.sub_source);
    setVal('comm-comments', '');

    const titleEl = document.querySelector('#modal-add-commercial .mtitle');
    if (titleEl) titleEl.innerText = "Clone of " + (p.society || "Commercial Listing");
    
    openModal('modal-add-commercial');
  } else if (isRental) {
    document.getElementById('form-add-rental').reset();

    setVal('rent-id', '');
    setVal('rental-mandate', p.mandate_type || 'Non Exclusive');
    setVal('rental-type', p.property_type || 'Apartment');
    setVal('rental-society', p.society);
    setVal('rental-location', p.location);
    setVal('rental-status', (p.status || 'AVAILABLE').toUpperCase());
    setVal('rental-site-area', p.site_area);
    setVal('rental-area', p.area_sqft);
    setVal('rental-config', p.configuration);
    setVal('rental-floor-info', p.floor_info);
    setVal('rental-interiors', p.interiors || 'Semi-Furnished');
    setVal('rental-facing', p.facing || 'East');
    setVal('rental-carpark', p.car_park);
    setVal('rental-price', p.price);
    setVal('rental-maintenance', p.maintenance);
    setVal('rental-deposit', p.deposit);
    setVal('rental-available-from', p.available_from);
    setVal('rental-date-of-inventory', p.date_of_inventory);
    setVal('rental-add-info', p.additional_info);
    setVal('rental-video', p.video_link);
    setVal('rental-photo', p.photo_link);
    setVal('rental-brochure', p.brochure_link);
    
    setVal('rental-owner-name', '');
    setVal('rental-owner-phone', '');
    setVal('rental-owner-email', '');
    setVal('rental-unit-no', '');
    
    setVal('rental-registration', p.registration_status);
    setVal('rental-source', p.source);
    setVal('rental-sub-source', p.sub_source);
    setVal('rental-comments', '');

    setVal('rental-plot-size', p.plot_size);
    setVal('rental-sba', p.sba);
    setVal('rental-plot-dimension', p.plot_dimension);
    setVal('rental-plot-facing', p.plot_facing);
    setVal('rental-house-facing', p.house_facing);

    if (typeof window.toggleVillaFields === 'function') {
      window.toggleVillaFields(p.property_type || '', 'rental');
    }

    const titleEl = document.querySelector('#modal-add-rental .mtitle');
    if (titleEl) titleEl.innerText = "Clone of " + (p.society || "Rental Listing");
    
    openModal('modal-add-rental');
  } else if (isLand) {
    document.getElementById('form-add-land').reset();

    setVal('land-id', '');
    setVal('land-mandate', p.mandate_type || 'Non Exclusive');
    setVal('land-type', p.property_type || 'Residential Plot');
    setVal('land-society', p.society);
    setVal('land-location', p.location);
    setVal('land-status', p.status || 'AVAILABLE');
    setVal('land-zoning', p.configuration);
    setVal('land-area', p.area_sqft);
    setVal('land-size', p.plot_size);
    setVal('land-dimensions', p.plot_dimension);
    setVal('land-facing', p.plot_facing);
    setVal('land-price', p.price);
    setVal('land-unit-no', '');
    setVal('land-registration', p.registration_status);
    setVal('land-owner-name', '');
    setVal('land-owner-phone', '');
    setVal('land-owner-email', '');
    setVal('land-source', p.source);
    setVal('land-sub-source', p.sub_source);
    setVal('land-commission-agreed', p.commission_agreed);
    setVal('land-google-map-url', p.google_map_url);
    setVal('land-comments', '');
    setVal('land-admin-comments', '');
    setVal('land-project-link', p.project_id);

    const titleEl = document.querySelector('#modal-add-land .mtitle');
    if (titleEl) titleEl.innerText = "Clone of " + (p.society || "Land Listing");

    openModal('modal-add-land');
  } else {
    document.getElementById('form-add-listing').reset();

    setVal('prop-id', '');
    setVal('prop-type', p.property_type || 'Apartment');
    setVal('prop-mandate', p.mandate_type || 'Non Exclusive');
    setVal('prop-society', p.society);
    setVal('prop-location', p.location);
    setVal('prop-status', (p.status || 'AVAILABLE').toUpperCase());
    setVal('prop-site-area', p.site_area);
    setVal('prop-area', p.area_sqft);
    setVal('prop-config', p.configuration);
    setVal('prop-floor-info', p.floor_info);
    setVal('prop-floor-range', p.floor_range);
    setVal('prop-interiors', p.interiors || 'Semi-Furnished');
    setVal('prop-facing', p.facing || 'East');
    setVal('prop-amenities', p.amenities);
    setVal('prop-carpark', p.car_park);
    setVal('prop-price', p.price);
    setVal('prop-possession', p.possession);
    setVal('prop-project-size', p.project_size);
    setVal('prop-project-status', p.project_status);
    setVal('prop-add-info', p.additional_info);
    setVal('prop-video', p.video_link);
    setVal('prop-photo', p.photo_link);
    setVal('prop-brochure', p.brochure_link);
    
    setVal('prop-owner-name', '');
    setVal('prop-owner-phone', '');
    setVal('prop-owner-email', '');
    setVal('prop-unit-no', '');
    
    setVal('prop-registration', p.registration_status);
    setVal('prop-source', p.source);
    setVal('prop-sub-source', p.sub_source);
    setVal('prop-comments', '');
    
    setVal('prop-tags', p.special_tags);
    setVal('prop-zone', p.zone || 'E');
    setVal('prop-year', p.onboarded_year || new Date().getFullYear());
    setVal('prop-available-for', p.available_for || 'Sale');
    setVal('prop-maintenance', p.maintenance);
    setVal('prop-deposit', p.deposit);

    setVal('prop-plot-size', p.plot_size);
    setVal('prop-sba', p.sba);
    setVal('prop-plot-dimension', p.plot_dimension);
    setVal('prop-plot-facing', p.plot_facing);
    setVal('prop-house-facing', p.house_facing);

    if (typeof window.toggleVillaFields === 'function') {
      window.toggleVillaFields(p.property_type || '', 'resale');
    }

    const titleEl = document.querySelector('#modal-add-listing .mtitle');
    if (titleEl) titleEl.innerText = "Clone of " + (p.society || "Resale Listing");
    
    openModal('modal-add-listing');
  }
};

window.editFullProperty = function(id) {
  const p = state.properties.find(x => x.id == id);
  if (!p) {
    showToast('Property not found', 'error');
    return;
  }

  const pType = (p.property_type || '').toLowerCase();
  const isCommercial = pType.includes('commercial') || pType.includes('office') || pType.includes('retail') || pType.includes('warehouse') || pType.includes('showroom');
  const isRental = pType === 'rental' || (p.available_for && p.available_for.toLowerCase().includes('rent')) || (p.available_for && p.available_for.toLowerCase().includes('lease')) || (p.price_raw || '').toLowerCase().includes('/mo');
  const isLand = pType === 'land' || pType === 'plot' || pType.includes('land') || pType.includes('plot');

  const setVal = (fieldId, val) => {
    const el = document.getElementById(fieldId);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  };

  if (isCommercial) {
    document.getElementById('form-add-commercial').reset();
    
    setVal('edit-commercial-id', p.id);
    setVal('comm-id', p.prop_id);
    setVal('comm-zone', p.zone || 'N');
    setVal('comm-year', p.onboarded_year || new Date().getFullYear());
    setVal('comm-mandate', p.mandate_type || 'Non Exclusive');
    setVal('comm-society', p.society);
    setVal('comm-location', p.location);
    setVal('comm-available-for', p.available_for || 'Rent');
    setVal('comm-plot-size', p.plot_size);
    setVal('comm-area', p.area_sqft);
    setVal('comm-interiors', p.interiors || 'Unfurnished');
    setVal('comm-carpark', p.car_park);
    setVal('comm-price', p.price);
    setVal('comm-maintenance', p.maintenance);
    setVal('comm-deposit', p.deposit);
    setVal('comm-possession', p.possession);
    setVal('comm-add-info', p.additional_info);
    setVal('comm-video', p.video_link);
    setVal('comm-photo', p.photo_link);
    setVal('comm-brochure', p.brochure_link);
    
    setVal('comm-owner-name', p.owner_name);
    setVal('comm-owner-phone', p.owner_phone);
    setVal('comm-owner-email', p.owner_email);
    setVal('comm-unit-no', p.unit_no);
    
    setVal('comm-registration', p.registration_status);
    setVal('comm-source', p.source);
    setVal('comm-sub-source', p.sub_source);
    setVal('comm-commission-agreed', p.commission_agreed);
    setVal('comm-google-map-url', p.google_map_url);
    setVal('comm-comments', p.comments);
    setVal('comm-project-link', p.project_id);
    setVal('comm-prop-associate-id', p.associate_id);

    const titleEl = document.querySelector('#modal-add-commercial .mtitle');
    if (titleEl) titleEl.innerText = "Edit Commercial Listing: " + (p.society || "Property");
    
    openModal('modal-add-commercial');
  } else if (isRental) {
    document.getElementById('form-add-rental').reset();

    setVal('edit-rental-id', p.id);
    setVal('rent-id', p.prop_id);
    setVal('rent-zone', p.zone || 'N');
    setVal('rent-year', p.onboarded_year || new Date().getFullYear());
    setVal('rental-mandate', p.mandate_type || 'Non Exclusive');
    setVal('rental-type', p.property_type || 'Apartment');
    setVal('rental-society', p.society);
    setVal('rental-location', p.location);
    setVal('rental-status', (p.status || 'AVAILABLE').toUpperCase());
    setVal('rental-site-area', p.site_area);
    setVal('rental-area', p.area_sqft);
    setVal('rental-config', p.configuration);
    setVal('rental-floor-info', p.floor_info);
    setVal('rental-interiors', p.interiors || 'Semi-Furnished');
    setVal('rental-facing', p.facing || 'East');
    setVal('rental-carpark', p.car_park);
    setVal('rental-price', p.price);
    setVal('rental-maintenance', p.maintenance);
    setVal('rental-deposit', p.deposit);
    setVal('rental-available-from', p.available_from);
    setVal('rental-date-of-inventory', p.date_of_inventory);
    setVal('rental-add-info', p.additional_info);
    setVal('rental-video', p.video_link);
    setVal('rental-photo', p.photo_link);
    setVal('rental-brochure', p.brochure_link);
    
    setVal('rental-owner-name', p.owner_name);
    setVal('rental-owner-phone', p.owner_phone);
    setVal('rental-owner-email', p.owner_email);
    setVal('rental-unit-no', p.unit_no);
    
    setVal('rental-registration', p.registration_status);
    setVal('rental-source', p.source);
    setVal('rental-sub-source', p.sub_source);
    setVal('rental-commission-agreed', p.commission_agreed);
    setVal('rental-google-map-url', p.google_map_url);
    setVal('rental-comments', p.comments);
    setVal('rental-project-link', p.project_id);
    setVal('rental-associate-id', p.associate_id);

    setVal('rental-plot-size', p.plot_size);
    setVal('rental-sba', p.sba);
    setVal('rental-plot-dimension', p.plot_dimension);
    setVal('rental-plot-facing', p.plot_facing);
    setVal('rental-house-facing', p.house_facing);

    if (typeof window.toggleVillaFields === 'function') {
      window.toggleVillaFields(p.property_type || '', 'rental');
    }

    const titleEl = document.querySelector('#modal-add-rental .mtitle');
    if (titleEl) titleEl.innerText = "Edit Rental Listing: " + (p.society || "Property");
    
    openModal('modal-add-rental');
  } else if (isLand) {
    document.getElementById('form-add-land').reset();

    setVal('edit-land-id', p.id);
    setVal('land-id', p.prop_id);
    setVal('land-zone', p.zone || 'N');
    setVal('land-year', p.onboarded_year || new Date().getFullYear());
    setVal('land-mandate', p.mandate_type || 'Non Exclusive');
    setVal('land-type', p.property_type || 'Residential Plot');
    setVal('land-society', p.society);
    setVal('land-location', p.location);
    setVal('land-status', p.status || 'AVAILABLE');
    setVal('land-zoning', p.configuration);
    setVal('land-area', p.area_sqft);
    setVal('land-size', p.plot_size);
    setVal('land-dimensions', p.plot_dimension);
    setVal('land-facing', p.plot_facing);
    setVal('land-price', p.price);
    setVal('land-unit-no', p.unit_no);
    setVal('land-registration', p.registration_status);
    setVal('land-owner-name', p.owner_name);
    setVal('land-owner-phone', p.owner_phone);
    setVal('land-owner-email', p.owner_email);
    setVal('land-source', p.source);
    setVal('land-sub-source', p.sub_source);
    setVal('land-commission-agreed', p.commission_agreed);
    setVal('land-google-map-url', p.google_map_url);
    setVal('land-comments', p.comments);
    setVal('land-admin-comments', p.admin_comments);
    setVal('land-project-link', p.project_id);
    setVal('land-associate-id', p.associate_id);
    setVal('land-road-width', p.road_width);
    setVal('land-fsi', p.fsi);

    const titleEl = document.querySelector('#modal-add-land .mtitle');
    if (titleEl) titleEl.innerText = "Edit Land Listing: " + (p.society || "Property");

    openModal('modal-add-land');
  } else {
    document.getElementById('form-add-listing').reset();

    setVal('edit-resale-id', p.id);
    setVal('prop-id', p.prop_id);
    setVal('prop-type', p.property_type || 'Apartment');
    setVal('prop-mandate', p.mandate_type || 'Non Exclusive');
    setVal('prop-society', p.society);
    setVal('prop-location', p.location);
    setVal('prop-status', (p.status || 'AVAILABLE').toUpperCase());
    setVal('prop-site-area', p.site_area);
    setVal('prop-area', p.area_sqft);
    setVal('prop-config', p.configuration);
    setVal('prop-floor-info', p.floor_info);
    setVal('prop-floor-range', p.floor_range);
    setVal('prop-interiors', p.interiors || 'Semi-Furnished');
    setVal('prop-facing', p.facing || 'East');
    setVal('prop-amenities', p.amenities);
    setVal('prop-carpark', p.car_park);
    setVal('prop-price', p.price);
    setVal('prop-possession', p.possession);
    setVal('prop-project-size', p.project_size);
    setVal('prop-project-status', p.project_status);
    setVal('prop-add-info', p.additional_info);
    setVal('prop-video', p.video_link);
    setVal('prop-photo', p.photo_link);
    setVal('prop-brochure', p.brochure_link);
    
    setVal('prop-owner-name', p.owner_name);
    setVal('prop-owner-phone', p.owner_phone);
    setVal('prop-owner-email', p.owner_email);
    setVal('prop-unit-no', p.unit_no);
    
    setVal('prop-registration', p.registration_status);
    setVal('prop-source', p.source);
    setVal('prop-sub-source', p.sub_source);
    setVal('prop-commission-agreed', p.commission_agreed);
    setVal('prop-google-map-url', p.google_map_url);
    setVal('prop-comments', p.comments);
    setVal('prop-project-link', p.project_id);
    setVal('prop-associate-id', p.associate_id);
    
    setVal('prop-tags', p.special_tags);
    setVal('prop-zone', p.zone || 'E');
    setVal('prop-year', p.onboarded_year || new Date().getFullYear());
    setVal('prop-available-for', p.available_for || 'Sale');
    setVal('prop-maintenance', p.maintenance);
    setVal('prop-deposit', p.deposit);

    setVal('prop-plot-size', p.plot_size);
    setVal('prop-sba', p.sba);
    setVal('prop-plot-dimension', p.plot_dimension);
    setVal('prop-plot-facing', p.plot_facing);
    setVal('prop-house-facing', p.house_facing);

    if (typeof window.toggleVillaFields === 'function') {
      window.toggleVillaFields(p.property_type || '', 'resale');
    }

    const titleEl = document.querySelector('#modal-add-listing .mtitle');
    if (titleEl) titleEl.innerText = "Edit Resale Listing: " + (p.society || "Property");
    
    openModal('modal-add-listing');
  }
};

window.populateProjectLinkDropdowns = function() {
  const selects = document.querySelectorAll('.prop-project-select');
  if (!selects || selects.length === 0) return;

  const projects = state.projects || [];
  const optionsHtml = '<option value="">-- Link Project (Optional) --</option>' + 
    projects.map(p => `<option value="${p.id}">${p.project_name} (${p.builder_name})</option>`).join('');

  selects.forEach(select => {
    const currentVal = select.value;
    select.innerHTML = optionsHtml;
    select.value = currentVal;
  });
};

window.autoPopulateFromProject = function(projectId, formType) {
  if (!projectId) return;
  const proj = state.projects.find(p => p.id == projectId);
  if (!proj) return;

  if (formType === 'resale') {
    document.getElementById('prop-society').value = proj.project_name || '';
    document.getElementById('prop-location').value = proj.location || '';
    document.getElementById('prop-possession').value = proj.possession || '';
    document.getElementById('prop-project-status').value = proj.uc_rtmi || '';
  } else if (formType === 'rental') {
    document.getElementById('rental-society').value = proj.project_name || '';
    document.getElementById('rental-location').value = proj.location || '';
    document.getElementById('rental-status').value = proj.uc_rtmi || '';
  } else if (formType === 'commercial') {
    document.getElementById('comm-society').value = proj.project_name || '';
    document.getElementById('comm-location').value = proj.location || '';
    document.getElementById('comm-possession').value = proj.possession || '';
  }
  showToast('⚡ Form fields auto-populated from linked Project!');
};

window.cloneProject = function(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) {
    showToast('Project not found', 'error');
    return;
  }

  editingProjectId = null;
  closeModal('modal-project-detail');

  const setVal = (fieldId, val) => {
    const el = document.getElementById(fieldId);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  };

  setVal('proj-builder', p.builder_name);
  setVal('proj-name', p.project_name);
  setVal('proj-location', p.location);
  setVal('proj-land-parcel', p.land_parcel);
  setVal('proj-tower', p.tower);
  setVal('proj-elevation', p.elevation);
  setVal('proj-configs', p.configuration);
  setVal('proj-carpet', p.carpet_area);
  setVal('proj-price', p.price_final);
  setVal('proj-uc-rtmi', p.uc_rtmi || 'UC');
  setVal('proj-possession', p.possession);
  setVal('proj-subvention', p.subvention);
  setVal('proj-clp-due', p.clp_due);
  setVal('proj-floor-rise', p.floor_rise);
  setVal('proj-location-usp', p.location_usp);
  setVal('proj-metro', p.metro_station);
  setVal('proj-other-usp', p.other_usp);
  
  const mapInput = document.getElementById('proj-google-map');
  if(mapInput) mapInput.value = p.google_map_url || '';

  setVal('proj-brochure', p.brochure_link);
  setVal('proj-floor-plans', p.floor_plans);
  setVal('proj-mother-docs', p.mother_docs);
  setVal('proj-assignments', p.assignments);
  setVal('proj-kyc-docs', p.kyc_docs);
  setVal('proj-photos', p.photos);
  setVal('proj-videos', p.videos);
  setVal('proj-cp-agreements', p.cp_agreements);
  setVal('proj-finance-info', p.finance_info);
  setVal('proj-analytics-info', p.analytics_info);

  const unitContainer = document.getElementById('unit-details-container');
  unitContainer.innerHTML = '';
  if (p.unit_details) {
    try {
      const units = JSON.parse(p.unit_details);
      if (units.length) {
        units.forEach(u => addUnitRow(u.config, u.area, u.price));
      } else addUnitRow();
    } catch(e) { addUnitRow(); }
  } else addUnitRow();

  const pocContainer = document.getElementById('poc-details-container');
  pocContainer.innerHTML = '';
  if (p.builder_poc_details) {
    try {
      const pocs = JSON.parse(p.builder_poc_details);
      if (pocs.length) {
        pocs.forEach(poc => addPocRow(poc.name, poc.phone, poc.email, poc.role));
      } else addPocRow();
    } catch(e) { addPocRow(); }
  } else addPocRow();

  document.querySelector('#form-add-project button[type="submit"]').innerText = 'Submit Project';
  const titleEl = document.querySelector('#modal-add-project .mtitle');
  if (titleEl) titleEl.innerText = "Clone of " + (p.project_name || "Project");
  openModal('modal-add-project');
};

window.cloneProjectFromDetails = function() {
  const projectId = document.getElementById('detail-proj-id').value;
  if (!projectId) return;
  window.cloneProject(parseInt(projectId));
};

window.showAddListingModal = () => openModal('modal-add-listing');
window.showAddProjectModal = function() {
  editingProjectId = null;
  document.getElementById('form-add-project').reset();
  document.getElementById('unit-details-container').innerHTML = '';
  document.getElementById('poc-details-container').innerHTML = '';
  document.querySelector('#form-add-project button[type="submit"]').innerText = 'Submit Project';
  document.querySelector('#modal-add-project .mtitle').innerText = '🏗️ Add Project';
  
  // Add one empty row by default
  addUnitRow();
  addPocRow();
  
  openModal('modal-add-project');
}

window.editProject = function(id) {
  const p = state.projects.find(x => x.id == id);
  if(!p) return;
  closeModal('modal-project-detail');
  editingProjectId = id;
  
  document.getElementById('proj-builder').value = p.builder_name || '';
  document.getElementById('proj-name').value = p.project_name || '';
  document.getElementById('proj-location').value = p.location || '';
  document.getElementById('proj-land-parcel').value = p.land_parcel || '';
  document.getElementById('proj-tower').value = p.tower || '';
  document.getElementById('proj-elevation').value = p.elevation || '';
  document.getElementById('proj-configs').value = p.configuration || '';
  document.getElementById('proj-carpet').value = p.carpet_area || '';
  document.getElementById('proj-price').value = p.price_final || '';
  document.getElementById('proj-uc-rtmi').value = p.uc_rtmi || 'UC';
  document.getElementById('proj-possession').value = p.possession || '';
  document.getElementById('proj-subvention').value = p.subvention || '';
  document.getElementById('proj-clp-due').value = p.clp_due || '';
  document.getElementById('proj-floor-rise').value = p.floor_rise || '';
  document.getElementById('proj-location-usp').value = p.location_usp || '';
  document.getElementById('proj-metro').value = p.metro_station || '';
  document.getElementById('proj-other-usp').value = p.other_usp || '';
  
  const mapInput = document.getElementById('proj-google-map');
  if(mapInput) mapInput.value = p.google_map_url || '';
  
  const adminCommentsInput = document.getElementById('proj-admin-comments');
  if(adminCommentsInput) adminCommentsInput.value = p.admin_comments || '';

  const brochureInput = document.getElementById('proj-brochure');
  if(brochureInput) brochureInput.value = p.brochure_link || '';
  const floorPlansInput = document.getElementById('proj-floor-plans');
  if(floorPlansInput) floorPlansInput.value = p.floor_plans || '';
  const motherDocsInput = document.getElementById('proj-mother-docs');
  if(motherDocsInput) motherDocsInput.value = p.mother_docs || '';
  const assignmentsInput = document.getElementById('proj-assignments');
  if(assignmentsInput) assignmentsInput.value = p.assignments || '';
  const kycDocsInput = document.getElementById('proj-kyc-docs');
  if(kycDocsInput) kycDocsInput.value = p.kyc_docs || '';
  const photosInput = document.getElementById('proj-photos');
  if(photosInput) photosInput.value = p.photos || '';
  const videosInput = document.getElementById('proj-videos');
  if(videosInput) videosInput.value = p.videos || '';
  const cpAgreementsInput = document.getElementById('proj-cp-agreements');
  if(cpAgreementsInput) cpAgreementsInput.value = p.cp_agreements || '';
  const financeInfoInput = document.getElementById('proj-finance-info');
  if(financeInfoInput) financeInfoInput.value = p.finance_info || '';
  const analyticsInfoInput = document.getElementById('proj-analytics-info');
  if(analyticsInfoInput) analyticsInfoInput.value = p.analytics_info || '';

  // Load dynamic units
  const unitContainer = document.getElementById('unit-details-container');
  unitContainer.innerHTML = '';
  if (p.unit_details) {
    try {
      const units = JSON.parse(p.unit_details);
      if (units.length) {
        units.forEach(u => addUnitRow(u.config, u.area, u.price));
      } else addUnitRow();
    } catch(e) { addUnitRow(); }
  } else addUnitRow();

  // Load dynamic POCs
  const pocContainer = document.getElementById('poc-details-container');
  pocContainer.innerHTML = '';
  if (p.builder_poc_details) {
    try {
      const pocs = JSON.parse(p.builder_poc_details);
      if (pocs.length) {
        pocs.forEach(poc => addPocRow(poc.name, poc.phone, poc.email, poc.role));
      } else addPocRow();
    } catch(e) { addPocRow(); }
  } else addPocRow();

  document.querySelector('#form-add-project button[type="submit"]').innerText = 'Save Changes';
  document.querySelector('#modal-add-project .mtitle').innerText = '🏗️ Edit Project';
  openModal('modal-add-project');
}



window.showAssociateDetails = async function(assocId) {
  document.getElementById('detail-assoc-id').value = assocId;
  const assoc = state.associates.find(a => a.id == assocId);
  if (!assoc) return;

  // Header & Overview
  document.getElementById('detail-assoc-name').innerText = assoc.name || 'N/A';
  const innerBadge = document.getElementById('detail-assoc-inner-badge');
  if (assoc.is_inner_circle) innerBadge.classList.remove('hidden');
  else innerBadge.classList.add('hidden');
  
  document.getElementById('detail-assoc-company').innerText = assoc.company || 'Independent Broker';
  document.getElementById('detail-assoc-zones').innerText = assoc.speciality_zones || 'N/A';
  
  document.getElementById('det-assoc-phone').innerText = assoc.phone || 'N/A';
  document.getElementById('det-assoc-email').innerText = assoc.email || 'N/A';
  document.getElementById('det-assoc-rating').innerText = '⭐'.repeat(assoc.rating || 1);
  document.getElementById('det-assoc-share').innerText = (assoc.co_brokerage_share || 0) + '%';

  switchAssocTab('overview');
  openModal('modal-associate-detail');

  // Load Inventory, Requirements & Shares
  loadAssociateInventory(assocId);
  loadAssociateRequirements(assocId);
  loadAssociateShares(assocId);
};

window.switchAssocTab = function(tabName) {
  document.querySelectorAll('.assoc-tab-pane').forEach(p => p.classList.add('hidden'));
  document.getElementById('tab-assoc-overview').classList.remove('active');
  document.getElementById('tab-assoc-inventory').classList.remove('active');
  document.getElementById('tab-assoc-reqs').classList.remove('active');
  document.getElementById('tab-assoc-shared').classList.remove('active');

  document.getElementById(`pane-assoc-${tabName}`).classList.remove('hidden');
  document.getElementById(`tab-assoc-${tabName}`).classList.add('active');

  const assocId = document.getElementById('detail-assoc-id').value;
  if (tabName === 'shared' && assocId) {
    loadAssociateShares(assocId);
  }
};

window.editAssociateData = function() {
  const assocId = document.getElementById('detail-assoc-id').value;
  const a = state.associates.find(x => x.id == assocId);
  if(!a) return;
  editingAssociateId = assocId;
  
  document.getElementById('assoc-name').value = a.name || '';
  document.getElementById('assoc-company').value = a.company || '';
  document.getElementById('assoc-phone').value = a.phone || '';
  document.getElementById('assoc-email').value = a.email || '';
  document.getElementById('assoc-share').value = a.co_brokerage_share || '';
  document.getElementById('assoc-zones').value = a.speciality_zones || '';
  document.getElementById('assoc-rating').value = a.rating || '5';
  document.getElementById('assoc-inner-circle').checked = !!a.is_inner_circle;

  document.querySelector('#form-add-associate button[type="submit"]').innerText = 'Save Changes';
  closeModal('modal-associate-detail');
  openModal('modal-add-associate');
};

window.showAddAssociateModal = () => {
  editingAssociateId = null;
  document.getElementById('form-add-associate').reset();
  document.querySelector('#form-add-associate button[type="submit"]').innerText = 'Submit Associate';
  openModal('modal-add-associate');
};

async function loadAssociateInventory(assocId) {
  const container = document.getElementById('det-assoc-inventory-container');
  try {
    const res = await fetch('/api/properties');
    const props = await res.json();
    const myProps = props.filter(p => p.associate_id == assocId);

    if (myProps.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No inventory found for this associate.</div>`;
      return;
    }

    container.innerHTML = myProps.map(p => `
      <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:700; color:var(--gold-l);">${p.society}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${p.configuration} | ${p.price_raw || p.price}</div>
        </div>
      </div>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

async function loadAssociateRequirements(assocId) {
  const container = document.getElementById('det-assoc-reqs-container');
  try {
    const res = await fetch('/api/leads');
    const leads = await res.json();
    const myLeads = leads.filter(l => l.associate_id == assocId);

    if (myLeads.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No buyer leads/requirements found for this associate.</div>`;
      return;
    }

    container.innerHTML = myLeads.map(l => {
      // Find matching properties from our inventory
      const matches = (state.properties || []).filter(p => {
        if ((p.status || 'AVAILABLE').toUpperCase() !== 'AVAILABLE') return false;
        
        // Match BHK config
        const lBhk = (l.config_bhk || '').toLowerCase().replace(/[^0-9]/g, '');
        const pConfig = (p.configuration || '').toLowerCase().replace(/[^0-9]/g, '');
        const bhkMatch = !lBhk || !pConfig || pConfig.includes(lBhk) || lBhk.includes(pConfig);
        
        // Match Location
        const lLoc = (l.location_preference || '').toLowerCase().trim();
        const pLoc = (p.location || '').toLowerCase().trim();
        const locMatch = !lLoc || !pLoc || pLoc.includes(lLoc) || lLoc.includes(pLoc);
        
        // Match Price (lead budget is in Crores, property price in Rupees)
        const propPrice = parseFloat(p.price || 0);
        const minVal = parseFloat(l.budget_min || 0) * 10000000;
        const maxVal = parseFloat(l.budget_max || 0) * 10000000;
        const priceMatch = (minVal === 0 && maxVal === 0) || (propPrice >= minVal && propPrice <= (maxVal || Infinity));
        
        return bhkMatch && locMatch && priceMatch;
      });

      const matchesHtml = matches.length > 0 ? 
        `<div style="margin-top:10px; border-top:1px dashed rgba(255,255,255,0.08); padding-top:8px;">
          <div style="font-size:11px; font-weight:700; color:var(--green); margin-bottom:5px;">✨ Auto-Matches in Our Database (${matches.length}):</div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${matches.slice(0, 3).map(m => `
              <div style="font-size:10.5px; background:rgba(46,204,113,0.06); padding:4px 8px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; border: 0.5px solid rgba(46,204,113,0.15);">
                <span>🏠 <strong>${m.society}</strong> (${m.configuration || 'N/A'} | ${m.location}) - <strong style="color:var(--green);">${m.price_raw || formatPriceToWords(m.price)}</strong></span>
                <button class="btn btn-ghost btn-sm" onclick="showShareModal(${m.id})" style="font-size:9px; padding:2px 6px;">📢 Share Pitch</button>
              </div>
            `).join('')}
            ${matches.length > 3 ? `<div style="font-size:9.5px; color:var(--text-muted); padding-left:4px;">...and ${matches.length - 3} other matches.</div>` : ''}
          </div>
        </div>` : 
        `<div style="margin-top:8px; font-size:10.5px; color:var(--text-muted); font-style:italic;">No exact matches in active inventory.</div>`;

      return `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:12px; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:13.5px; font-weight:700; color:var(--text-light);">${l.name}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                Budget: <strong style="color:var(--gold-l);">₹${l.budget_min || 0}Cr - ₹${l.budget_max || 0}Cr</strong> | 
                Config: <strong>${l.config_bhk || 'N/A'}</strong> | 
                Location: <strong>${l.location_preference || 'Any'}</strong>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="showLeadDetails(${l.id})">View Detail</button>
          </div>
          ${matchesHtml}
        </div>
      `;
    }).join('');
  } catch(e) {
    console.error(e);
    container.innerHTML = `<div style="font-size:12px; color:var(--red);">Failed to load buyer requirements.</div>`;
  }
}

async function loadAssociateShares(assocId) {
  const container = document.getElementById('det-assoc-shared-container');
  if (!container) return;
  try {
    const res = await fetch(`/api/associates/${assocId}/shares`);
    const data = await res.json();

    if (data.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No shared properties found for this associate.</div>`;
      return;
    }

    container.innerHTML = data.map(p => `
      <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:700; color:var(--gold-l);">${p.society}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
            ${p.configuration} | ${p.price_raw || formatPriceToWords(p.price)} | Location: ${p.location}
          </div>
          <div style="font-size:9.5px; color:var(--text-secondary); margin-top:3px;">
            Shared on: ${new Date(p.shared_at).toLocaleDateString()} by ${p.shared_by}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showShareModal(${p.id})" style="font-size:10.5px;">📢 Re-share Pitch</button>
      </div>
    `).join('');
  } catch(e) {
    console.error(e);
    container.innerHTML = `<div style="font-size:12px; color:var(--red);">Failed to load shared properties.</div>`;
  }
}

window.showSharePropertyWithAssociateForm = async function(show = true) {
  const container = document.getElementById('assoc-share-property-form-container');
  if (!show) {
    container.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/properties');
    const props = await res.json();
    
    const select = document.getElementById('assoc-share-property-select');
    select.innerHTML = props
      .map(p => `<option value="${p.id}">${p.society} (${p.configuration} | ${p.price_raw || formatPriceToWords(p.price)})</option>`)
      .join('');
      
    if (select.options.length === 0) {
      select.innerHTML = '<option value="">-- No Properties Available --</option>';
    }

    container.classList.remove('hidden');
  } catch (e) {
    console.error(e);
    showToast('Failed to load listings to share.');
  }
};

window.submitSharePropertyWithAssociate = async function() {
  const assocId = document.getElementById('detail-assoc-id').value;
  const propId = document.getElementById('assoc-share-property-select').value;
  if (!propId) {
    showToast('Please select a property to share.');
    return;
  }

  try {
    const res = await fetch(`/api/associates/${assocId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propId })
    });
    if (res.ok) {
      showToast('🎉 Property shared with associate logged.');
      document.getElementById('assoc-share-property-form-container').classList.add('hidden');
      loadAssociateShares(assocId);
      loadAssociatesPerformance();
    } else {
      const err = await res.json();
      showToast('Error: ' + err.error);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to share property.');
  }
};

window.showPropertyActivity = async function(propId, propName, propType) {
  document.getElementById('activity-prop-id').value = propId;
  document.getElementById('activity-prop-name').value = propName;
  document.getElementById('prop-activity-title').innerText = `📂 Activity & Share Logs: ${propName}`;

  document.getElementById('prop-visit-closure-btn').onclick = () => {
    closeModal('modal-property-activity');
    closureDeal(propId, propName, propType || 'Resale');
  };

  switchPropActivityTab('shares');
  openModal('modal-property-activity');

  await loadPropertyActivityLogs(propId);
};

window.switchPropActivityTab = function(tabName) {
  document.querySelectorAll('.prop-activity-pane').forEach(p => p.classList.add('hidden'));
  document.getElementById('tab-prop-shares').classList.remove('active');
  document.getElementById('tab-prop-visits').classList.remove('active');

  document.getElementById(`pane-prop-${tabName}`).classList.remove('hidden');
  document.getElementById(`tab-prop-${tabName}`).classList.add('active');
};

window.toggleQuickShareForm = async function(show = true) {
  const container = document.getElementById('prop-quick-share-container');
  if (!show) {
    container.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/associates');
    const data = await res.json();
    const select = document.getElementById('prop-quick-share-select');
    select.innerHTML = data.map(a => `<option value="${a.id}">${a.name} (${a.company || 'Broker'})</option>`).join('');
    if (select.options.length === 0) {
      select.innerHTML = '<option value="">-- No Associates Available --</option>';
    }
    container.classList.remove('hidden');
  } catch (e) {
    console.error(e);
    showToast('Failed to load associates.');
  }
};

window.openShareWithAssociateFromInventory = function() {
  toggleQuickShareForm(true);
};

window.submitQuickShareProperty = async function() {
  const propId = document.getElementById('activity-prop-id').value;
  const assocId = document.getElementById('prop-quick-share-select').value;
  if (!assocId) {
    showToast('Please select an associate to share with.');
    return;
  }

  try {
    const res = await fetch(`/api/associates/${assocId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propId })
    });
    if (res.ok) {
      showToast('🎉 Property share logged with associate.');
      toggleQuickShareForm(false);
      loadPropertyActivityLogs(propId);
    } else {
      const err = await res.json();
      showToast('Error: ' + err.error);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to log share.');
  }
};

async function loadPropertyActivityLogs(propId) {
  const sharesList = document.getElementById('prop-shares-list');
  const visitsList = document.getElementById('prop-visits-list');

  try {
    const res = await fetch(`/api/properties/${propId}/activity-log`);
    const data = await res.json();

    // Render Shares
    if (!data.shares || data.shares.length === 0) {
      sharesList.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px;">This property has not been shared with any associates yet.</div>`;
    } else {
      sharesList.innerHTML = data.shares.map(s => `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:13px; font-weight:700; color:var(--gold-l);">${s.associate_name}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Agency: ${s.associate_company || 'Private'}</div>
          </div>
          <div style="text-align:right; font-size:10px; color:var(--text-secondary);">
            Shared by: <strong>${s.shared_by}</strong><br>
            Date: ${new Date(s.shared_at).toLocaleDateString()}
          </div>
        </div>
      `).join('');
    }

    // Render Visits
    if (!data.visits || data.visits.length === 0) {
      visitsList.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px;">No site visits recorded for this property yet.</div>`;
    } else {
      visitsList.innerHTML = data.visits.map(v => `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px; display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:var(--text-light); font-size:13px;">🚶 ${v.visitor_name}</strong>
              ${v.visitor_phone ? `<span style="font-size:11px; color:var(--text-muted); margin-left:8px;">📞 ${v.visitor_phone}</span>` : ''}
            </div>
            <span class="chip btn-sm" style="font-size:9.5px; background:rgba(52,152,219,0.15); color:var(--blue-light); border:0.5px solid var(--blue); font-weight:700;">
              ${v.source}
            </span>
          </div>
          <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">
            Date: <strong>${v.visit_date}</strong>
          </div>
          ${v.is_joint ? `
            <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
              <span class="badge badge-amber" style="font-size:9.5px; padding:2px 6px;">👥 Joint Visit</span>
              <span style="font-size:11px; color:var(--gold-l);">Accompanied by Associate: <strong>${v.associate_name || 'Network Broker'}</strong></span>
            </div>
          ` : ''}
          ${v.notes ? `<div style="font-size:11px; font-style:italic; color:var(--text-muted); background:rgba(0,0,0,0.1); padding:6px; border-radius:4px; margin-top:4px;">Notes: ${v.notes}</div>` : ''}
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
    sharesList.innerHTML = `<div style="color:var(--red); font-size:12px;">Failed to load activity logs.</div>`;
    visitsList.innerHTML = `<div style="color:var(--red); font-size:12px;">Failed to load activity logs.</div>`;
  }
}

async function loadAssociatesPerformance() {
  const container = document.getElementById('associates-performance-container');
  if (!container) return;
  try {
    const res = await fetch('/api/associates/performance');
    const data = await res.json();

    if (data.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="empty">No performance data available.</td></tr>`;
      return;
    }

    container.innerHTML = data.map(a => `
      <tr>
        <td>
          <strong>${a.name}</strong> ${a.is_inner_circle ? '<span class="badge badge-amber" style="font-size:9px; padding:2px 6px; margin-left:5px;">⭐ Inner Circle</span>' : ''}
          ${a.company ? `<br><span style="font-size:11px; color:var(--text-muted);">${a.company}</span>` : ''}
        </td>
        <td style="text-align:center; font-weight:700;">${a.total_listings}</td>
        <td style="text-align:center; font-weight:700; color:var(--blue-light);">${a.joint_site_visits}</td>
        <td style="text-align:center; font-weight:700; color:var(--gold-l);">${a.shared_listings}</td>
        <td style="text-align:center; font-weight:700; color:var(--green);">${a.converted_deals}</td>
        <td style="text-align:center; font-weight:700; color:var(--green-dark);">₹${parseFloat(a.total_payout).toLocaleString('en-IN')}</td>
        <td style="text-align:center;">${'⭐'.repeat(a.rating || 5)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

window.uploadAssociateCSV = async function(inputElem) {
  if (!inputElem.files || !inputElem.files[0]) return;
  const file = inputElem.files[0];
  const assocId = document.getElementById('detail-assoc-id').value;

  const text = await file.text();
  try {
    const res = await fetch('/api/associates/' + assocId + '/upload-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: text
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Successfully uploaded ${result.addedCount} properties for this associate!`);
      loadAssociateInventory(assocId);
      loadProperties(); // Refresh main list
    } else {
      showToast('Error: ' + result.error);
    }
  } catch(e) {
    console.error(e);
    showToast('Failed to parse CSV upload.');
  }
  inputElem.value = ''; // clear input
};

window.deleteAssociateData = async function() {
  const assocId = document.getElementById('detail-assoc-id').value;
  if (!assocId) return;
  if (!confirm('⚠️ Are you sure you want to delete this associate? All their linked properties and requirements will be unlinked.')) return;
  try {
    const res = await fetch('/api/associates/' + assocId, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 Associate deleted successfully.');
      closeModal('modal-associate-detail');
      loadAssociates();
    } else {
      showToast('Error: ' + data.error);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to delete associate.');
  }
};

window.showAddAssocPropertyModal = function() {
  const assocId = document.getElementById('detail-assoc-id').value;
  document.getElementById('assoc-prop-assoc-id').value = assocId;
  document.getElementById('form-add-assoc-property').reset();
  openModal('modal-add-assoc-property');
};

window.submitAddAssocProperty = async function(e) {
  e.preventDefault();
  const assocId = document.getElementById('assoc-prop-assoc-id').value;
  const data = {
    society: document.getElementById('assoc-prop-society').value,
    location: document.getElementById('assoc-prop-location').value,
    configuration: document.getElementById('assoc-prop-config').value,
    area_sqft: parseFloat(document.getElementById('assoc-prop-area').value || 0),
    price: parseFloat(document.getElementById('assoc-prop-price').value || 0),
    available_for: document.getElementById('assoc-prop-available-for').value,
    associate_id: parseInt(assocId),
    source: 'Associate Network'
  };

  try {
    
    const editId = document.getElementById('edit-rental-id').value;
    const url = editId ? `/api/properties/${editId}` : `/api/properties`;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (res.ok) {
      showToast('🎉 Associate property listed successfully.');
      closeModal('modal-add-assoc-property');
      loadAssociateInventory(assocId);
      loadProperties(); // Refresh main list
    } else {
      showToast('Error: ' + result.error);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to add associate property.');
  }
};

window.showLinkAssocPropertyForm = async function(show = true) {
  const container = document.getElementById('assoc-link-property-form-container');
  if (!show) {
    container.classList.add('hidden');
    return;
  }

  // Load properties list
  try {
    const res = await fetch('/api/properties');
    const props = await res.json();
    
    // Filter out properties already linked to this associate or deleted
    const select = document.getElementById('assoc-link-property-select');
    select.innerHTML = props
      .filter(p => !p.associate_id)
      .map(p => `<option value="${p.id}">${p.society} (${p.configuration} | ${p.price_raw || p.price})</option>`)
      .join('');
      
    if (select.options.length === 0) {
      select.innerHTML = '<option value="">-- No Unlinked Listings Available --</option>';
    }

    container.classList.remove('hidden');
  } catch (e) {
    console.error(e);
    showToast('Failed to load listings to link.');
  }
};

window.submitLinkAssocProperty = async function() {
  const assocId = document.getElementById('detail-assoc-id').value;
  const propId = document.getElementById('assoc-link-property-select').value;
  if (!propId) {
    showToast('Please select a property listing first.');
    return;
  }

  try {
    const res = await fetch(`/api/properties/${propId}/associate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ associate_id: assocId })
    });
    if (res.ok) {
      showToast('🎉 Property linked to associate.');
      document.getElementById('assoc-link-property-form-container').classList.add('hidden');
      loadAssociateInventory(assocId);
      loadProperties();
    } else {
      const err = await res.json();
      showToast('Error: ' + err.error);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to link property.');
  }
};

window.addAssocRequirementDirectly = function() {
  const assocId = document.getElementById('detail-assoc-id').value;
  closeModal('modal-associate-detail');
  navToPage('capture');
  
  // Pre-select associate dropdown
  const select = document.getElementById('lead-associate');
  if (select) {
    select.value = assocId;
  }
};

window.showAddCommissionModal = () => openModal('modal-add-commission');
window.closeModal = closeModal;
window.navToPage = navToPage;

// Expose submit handlers for inline HTML form invocation
window.submitCaptureLead = submitCaptureLead;
window.submitAddTodo = submitAddTodo;
window.submitAddListing = submitAddListing;
window.submitAddRental = submitAddRental;
window.submitAddCommercial = submitAddCommercial;
window.submitAddProject = submitAddProject;
window.submitAddAssociate = submitAddAssociate;
window.submitAddCommission = submitAddCommission;
window.submitLeadScorecard = submitLeadScorecard;
window.submitAddTeam = submitAddTeam;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.className = 'toast'; // Reset HTML/classes
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function showToastWithUndo(message, undoFn) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.className = 'toast';
  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; justify-content:space-between; width:100%;">
      <span>${message}</span>
      <button class="btn btn-sm" id="toast-undo-btn" style="background:#B8860B; color:#fff; border:none; padding:4px 10px; font-weight:700; border-radius:4px; font-size:11px; cursor:pointer;">
        ↩️ Undo
      </button>
    </div>
  `;
  
  toast.classList.add('show');
  
  let dismissed = false;
  const timeoutId = setTimeout(() => {
    if (!dismissed) {
      toast.classList.remove('show');
    }
  }, 5000);
  
  document.getElementById('toast-undo-btn').onclick = (e) => {
    e.stopPropagation();
    dismissed = true;
    clearTimeout(timeoutId);
    toast.classList.remove('show');
    undoFn();
  };
}
window.showToastWithUndo = showToastWithUndo;

async function restoreItem(id, type) {
  try {
    const res = await fetch(`/api/${type}/${id}/restore`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) {
      showToast('Item restored successfully.');
      if (type === 'properties') {
        loadProperties();
      } else if (type === 'leads') {
        loadEnquiries();
      } else if (type === 'projects') {
        loadProjects();
      }
      loadDashboardData();
    } else {
      showToast('Failed to restore item.');
    }
  } catch (err) {
    console.error(err);
  }
}
window.restoreItem = restoreItem;

window.deleteProjectData = async function() {
  const projectId = document.getElementById('detail-proj-id').value;
  if (!projectId) return;
  try {
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    closeModal('modal-project-detail');
    showToastWithUndo('Project sheet removed.', () => restoreItem(projectId, 'projects'));
    loadProjects();
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
};

window.editProjectData = function() {
  const projectId = document.getElementById('detail-proj-id').value;
  if (!projectId) return;
  closeModal('modal-project-detail');
  window.editProject(parseInt(projectId));
};

// SOP Accordions Toggle
window.toggleAccordion = (id) => {
  const body = document.getElementById(id);
  body.classList.toggle('open');
};

window.switchBlueprintTab = switchBlueprintTab;
window.switchInventoryTab = switchInventoryTab;

function setupGlobalSearch() {
  const searchInput = document.getElementById('global-search');
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase().trim();
    if (val === '') {
      if (state.activePage === 'inventory') loadProperties();
      else if (state.activePage === 'pipeline') loadPipeline();
      else if (state.activePage === 'enquiry') loadEnquiries();
      return;
    }

    if (state.activePage === 'inventory') {
      const filtered = state.properties.filter(p => 
        p.society.toLowerCase().includes(val) || 
        p.location.toLowerCase().includes(val)
      );
      renderResaleProperties(filtered);
    } else if (state.activePage === 'pipeline') {
      const filtered = state.leads.filter(l => 
        l.name.toLowerCase().includes(val) ||
        l.phone.toLowerCase().includes(val)
      );
      renderFilteredPipeline(filtered);
    } else if (state.activePage === 'enquiry') {
      const filtered = state.leads.filter(l => 
        l.name.toLowerCase().includes(val) ||
        l.phone.toLowerCase().includes(val)
      );
      renderFilteredEnquiries(filtered);
    }
  });
}

function renderFilteredPipeline(data) {
  const stages = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won'];
  stages.forEach(s => {
    document.getElementById(`col-${s}`).innerHTML = '';
  });

  data.forEach(lead => {
    const col = document.getElementById(`col-${lead.stage}`);
    if (!col) return;
    const card = document.createElement('div');
    card.className = 'lead-card';
    card.innerHTML = `<div class="lead-name">${lead.name}</div><div class="lead-detail">${lead.project_type}</div>`;
    col.appendChild(card);
  });
}

function renderFilteredEnquiries(data) {
  const tbody = document.getElementById('enquiry-log-list-container');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">No enquiries matched search query.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(l => `
    <tr>
      <td><strong>${l.name}</strong></td>
      <td>${l.source}</td>
      <td><span class="chip ch-gold">${l.stage}</span></td>
      <td><span class="chip ch-hot">${l.status}</span></td>
      <td>${l.project_type}</td>
      <td>₹${(l.budget_min/100000).toFixed(0)}L - ₹${(l.budget_max/100000).toFixed(0)}L</td>
      <td>${l.next_followup || 'Not scheduled'}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="deleteLead(${l.id})">✕ Remove</button></td>
    </tr>
  `).join('');
}

window.triggerDbBackup = async () => {
  try {
    showToast('Generating comprehensive backup... Please wait.', 'info');
    const endpoints = [
      '/api/leads', '/api/properties', '/api/associates', 
      '/api/projects', '/api/templates', '/api/team', '/api/commissions'
    ];
    
    const data = {};
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        const key = ep.split('/').pop();
        if (res.ok) {
          data[key] = await res.json();
        }
      } catch (e) {
        console.error('Failed to fetch ' + ep, e);
      }
    }
    
    data.exported_at = new Date().toISOString();
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "REALPro_Comprehensive_Backup.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Comprehensive JSON backup successfully generated.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error generating comprehensive backup', 'error');
  }
};

window.sendTeamChatMessage = () => {
  const input = document.getElementById('team-chat-input');
  const msgText = input.value.trim();
  if (!msgText) return;

  const container = document.getElementById('team-chat-messages');
  const newMsg = document.createElement('div');
  newMsg.innerHTML = `<span style="color:var(--text-secondary); font-weight:700;">[You]:</span> ${msgText}`;
  container.appendChild(newMsg);
  
  // Clear input
  input.value = '';
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
  
  // Show a mock response from the team after 1 second!
    setTimeout(() => {
    const mockMsg = document.createElement('div');
    mockMsg.innerHTML = `<span style="color:var(--gold-l); font-weight:700;">[Asha Assistant]:</span> Thanks Vasu, logged. Let's close this transaction!`;
    container.appendChild(mockMsg);
    container.scrollTop = container.scrollHeight;
  }, 1000);
};

window.simulateDocUpload = (id, docType) => {
  const fileName = prompt(`Upload Document for ${docType}:\nEnter file name (e.g. ${docType.replace(/\\s+/g, '_')}_Signed.pdf):`);
  if (!fileName) return;
  
  // map short names used in DOM IDs
  const idMap = {
    'ATS': 'ATS',
    'Mother Deeds': 'Mother',
    'Sale Deed': 'Sale',
    'Assignment Agreement': 'Assignment',
    'KYC Doc': 'KYC'
  };
  
  const spanId = `doc-${id}-${idMap[docType]}`;
  const el = document.getElementById(spanId);
  if (el) {
    el.innerHTML = `✓ ${fileName}`;
    el.style.color = 'var(--green)';
    showToast(`Document uploaded successfully under ${docType}!`);
  }
};

window.triggerImport = (table, defaults = null) => {
  document.getElementById('import-target-table').value = table;
  if (defaults) {
    document.getElementById('import-target-table').setAttribute('data-defaults', JSON.stringify(defaults));
  } else {
    document.getElementById('import-target-table').removeAttribute('data-defaults');
  }
  document.querySelector('#modal-import-csv .mtitle').innerText = `📥 Import ${table.toUpperCase()} Dataset`;
  openModal('modal-import-csv');
};

let parsedCSVData = null;
let csvHeaders = [];

const dbColumnsMap = {
  'properties': [
    {val: 'prop_id', label: 'Property ID (prop_id)'},
    {val: 'property_type', label: 'Type e.g. Apartment, Villa (property_type)'},
    {val: 'society', label: 'Society / Project Name (society)'},
    {val: 'location', label: 'Location / Micro-market (location)'},
    {val: 'zone', label: 'Zone e.g. North, South (zone)'},
    {val: 'mandate_type', label: 'Mandate Type (mandate_type)'},
    {val: 'status', label: 'Status e.g. AVAILABLE (status)'},
    {val: 'configuration', label: 'Configuration e.g. 3BHK (configuration)'},
    {val: 'price_raw', label: 'Price String e.g. 1.5 Cr (price_raw)'},
    {val: 'area_sqft', label: 'Area in SqFt (area_sqft)'},
    {val: 'sba', label: 'Super Built-Up Area (sba)'},
    {val: 'plot_size', label: 'Plot Size (plot_size)'},
    {val: 'plot_dimension', label: 'Plot Dimensions (plot_dimension)'},
    {val: 'site_area', label: 'Site Area (site_area)'},
    {val: 'floor_info', label: 'Floor Info (floor_info)'},
    {val: 'floor_range', label: 'Floor Range (floor_range)'},
    {val: 'facing', label: 'Facing (facing)'},
    {val: 'house_facing', label: 'House Facing (house_facing)'},
    {val: 'plot_facing', label: 'Plot Facing (plot_facing)'},
    {val: 'interiors', label: 'Interiors (interiors)'},
    {val: 'amenities', label: 'Amenities (amenities)'},
    {val: 'car_park', label: 'Car Parking (car_park)'},
    {val: 'possession', label: 'Possession Date (possession)'},
    {val: 'project_status', label: 'Project Status (project_status)'},
    {val: 'project_size', label: 'Project Size (project_size)'},
    {val: 'onboarded_year', label: 'Onboarded Year (onboarded_year)'},
    {val: 'date_of_inventory', label: 'Date of Inventory (date_of_inventory)'},
    {val: 'available_for', label: 'Available For e.g. Sale/Rent (available_for)'},
    {val: 'available_from', label: 'Available From Date (available_from)'},
    {val: 'owner_name', label: 'Owner Name (owner_name)'},
    {val: 'owner_phone', label: 'Owner Phone (owner_phone)'},
    {val: 'owner_email', label: 'Owner Email (owner_email)'},
    {val: 'unit_no', label: 'Unit Number (unit_no)'},
    {val: 'holder_type', label: 'Holder Type (holder_type)'},
    {val: 'source', label: 'Source (source)'},
    {val: 'sub_source', label: 'Sub Source (sub_source)'},
    {val: 'special_tags', label: 'Special Tags (special_tags)'},
    {val: 'comments', label: 'Comments (comments)'},
    {val: 'maintenance', label: 'Maintenance Amount (maintenance)'},
    {val: 'deposit', label: 'Deposit Amount (deposit)'},
    {val: 'registration_status', label: 'Registration Status (registration_status)'},
    {val: 'video_link', label: 'Video Link URL (video_link)'},
    {val: 'photo_link', label: 'Photo Link URL (photo_link)'},
    {val: 'brochure_link', label: 'Brochure Link URL (brochure_link)'},
    {val: 'additional_info', label: 'Additional Info (additional_info)'}
  ],
  'leads': ['name', 'phone', 'email', 'source', 'status', 'stage', 'project_type', 'budget_min', 'budget_max', 'notes', 'next_followup', 'followup_status', 'touchpoint', 'location_preference', 'config_bhk', 'timeline_preference', 'property_requirement'],
  'builder_projects': ['builder_name', 'project_name', 'location', 'land_parcel', 'tower', 'elevation', 'configuration', 'carpet_area', 'price_final', 'uc_rtmi', 'possession', 'subvention', 'clp_due', 'floor_rise', 'location_usp', 'metro_station', 'other_usp', 'special_tags']
};

window.handleFileSelect = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        if (json.length === 0) {
          showToast('Excel file is empty.');
          return;
        }
        
        const headers = Object.keys(json[0]);
        renderMappingUI(json, headers);
      } catch(err) {
        showToast('Error parsing Excel file.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  } else if (fileName.endsWith('.csv')) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (!results.data || results.data.length === 0) {
          showToast('CSV file is empty or invalid.');
          return;
        }
        renderMappingUI(results.data, results.meta.fields);
      },
      error: function(err) {
        showToast('Error parsing CSV file.');
        console.error(err);
      }
    });
  } else {
    showToast('Unsupported file type. Please upload .csv, .xlsx, or .xls');
  }
};

function renderMappingUI(data, headers) {
  parsedCSVData = data;
  csvHeaders = headers;
  
  const targetTable = document.getElementById('import-target-table').value;
  let dbColumns = dbColumnsMap[targetTable] || [];
  
  // Normalize strings to {val, label}
  dbColumns = dbColumns.map(col => typeof col === 'string' ? {val: col, label: col} : col);

  const tbody = document.getElementById('csv-mapping-tbody');
  tbody.innerHTML = '';
  
  const sampleRow = parsedCSVData[0];

  csvHeaders.forEach((header, index) => {
    let options = '<option value="">-- Ignore Column --</option>';
    dbColumns.forEach(col => {
      options += `<option value="${col.val}">${col.label}</option>`;
    });

    tbody.innerHTML += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid var(--border);">${header}</td>
        <td style="padding: 8px; border-bottom: 1px solid var(--border); color: var(--text-muted);">${sampleRow[header] ? String(sampleRow[header]).substring(0, 30) : ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid var(--border);">
          <select class="form-select csv-mapping-select" data-csv-header="${escapeQuote(header)}" style="padding: 4px; font-size: 12px;">
            ${options}
          </select>
        </td>
      </tr>
    `;
  });

  document.getElementById('csv-mapping-container').style.display = 'block';
  document.getElementById('btn-import-mapped-data').style.display = 'inline-block';
}


window.submitMappedCSV = async () => {
  const targetTable = document.getElementById('import-target-table').value;
  const selects = document.querySelectorAll('.csv-mapping-select');
  
  const mapping = {};
  selects.forEach(select => {
    const csvHeader = select.getAttribute('data-csv-header');
    const dbColumn = select.value;
    if (dbColumn) {
      mapping[csvHeader] = dbColumn;
    }
  });

  if (Object.keys(mapping).length === 0) {
    showToast('Please map at least one column.');
    return;
  }

  const mappedColumns = Object.values(mapping);
  if (targetTable === 'leads') {
    const hasName = mappedColumns.includes('name');
    const hasPhone = mappedColumns.includes('phone');
    const hasEmail = mappedColumns.includes('email');
    if (!hasName && !hasPhone && !hasEmail) {
      showToast('Validation Error: You must map at least one contact field (Name, Phone, or Email).');
      return;
    }
  }

  const defaultsStr = document.getElementById('import-target-table').getAttribute('data-defaults');
  let defaults = {};
  if (defaultsStr) {
    try { defaults = JSON.parse(defaultsStr); } catch(e) {}
  }

  const todayStr = new Date().toISOString().split('T')[0];
  let customTag = '';
  let natureTagsVal = '';
  if (targetTable === 'leads') {
    const tagInput = document.getElementById('import-lead-tag');
    customTag = tagInput ? tagInput.value.trim() : '';
    const natureTagInput = document.getElementById('import-lead-nature-tag');
    natureTagsVal = natureTagInput ? natureTagInput.value.trim() : '';
  }

  const mappedData = parsedCSVData.map(row => {
    const newRow = { ...defaults };
    let hasAnyVal = false;
    for (const [csvHeader, dbColumn] of Object.entries(mapping)) {
      const cellValue = row[csvHeader] ? String(row[csvHeader]).trim() : '';
      if (cellValue) {
        hasAnyVal = true;
        if (newRow[dbColumn]) {
          if (dbColumn === 'phone' || dbColumn === 'email') {
            newRow[dbColumn] = newRow[dbColumn] + ', ' + cellValue;
          } else {
            newRow[dbColumn] = cellValue;
          }
        } else {
          newRow[dbColumn] = cellValue;
        }
      }
    }

    if (targetTable === 'leads') {
      const nameVal = newRow.name ? String(newRow.name).trim() : '';
      const phoneVal = newRow.phone ? String(newRow.phone).trim() : '';
      const emailVal = newRow.email ? String(newRow.email).trim() : '';
      
      if (!nameVal && !phoneVal && !emailVal) {
        return null;
      }

      if (!nameVal) {
        newRow.name = phoneVal || emailVal || 'Unnamed Lead';
      }

      newRow.source = `Import: ${customTag || 'Unspecified'} (${todayStr})`;
      
      let tagsList = [];
      if (newRow.special_tags) {
        tagsList = newRow.special_tags.split(',').map(t => t.trim()).filter(Boolean);
      }
      if (customTag) {
        tagsList.push(customTag);
      }
      if (natureTagsVal) {
        natureTagsVal.split(',').forEach(t => {
          const cleanT = t.trim();
          if (cleanT) tagsList.push(cleanT);
        });
      }
      tagsList.push('Imported');
      tagsList.push(`Import-${todayStr}`);
      newRow.special_tags = tagsList.join(', ');
    }
    return newRow;
  }).filter(Boolean);

  if (mappedData.length === 0) {
    showToast('No valid records found in CSV.');
    return;
  }

  try {
    const res = await fetch(`/api/import-mapped/${targetTable}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: mappedData })
    });
    
    const responseData = await res.json();
    if (responseData.success) {
      showToast(responseData.message || 'Import successful!');
      closeModal('modal-import-csv');
      document.getElementById('import-csv-file').value = '';
      document.getElementById('csv-mapping-container').style.display = 'none';
      document.getElementById('btn-import-mapped-data').style.display = 'none';
      parsedCSVData = null;
      
      // Reload active page data
      if (targetTable === 'properties') loadProperties();
      else if (targetTable === 'leads') {
        loadEnquiries();
        if (typeof loadRawLeads === 'function') loadRawLeads();
        loadDashboardData();
      } else if (targetTable === 'builder_projects') loadProjects();
    } else {
      showToast(`Error: ${responseData.error || 'Import failed'}`);
    }
  } catch (err) {
    console.error(err);
    showToast('Network error during mapped import.');
  }
};

// ─── BRANDED SHARING FUNCTIONS ───
window.showShareModal = function(id) {
  const p = state.properties.find(item => item.id === id);
  if (!p) return;
  state.selectedPropertyForShare = p;
  state.selectedProjectForShare = null;

  const senderName = document.getElementById('share-sender-name').value || 'Vasu Jain';
  const senderCompany = document.getElementById('share-sender-company').value || 'REALPro CRM';
  const senderPhone = document.getElementById('share-sender-phone').value || '+91 99454 03202';
  const senderEmail = document.getElementById('share-sender-email').value || 'vasu@realpro.com';

  // Generate safe pitch: strip Direct Owner details
  let pitch = `🏠 *PREMIUM PROPERTY FOR MATCH* 🏠\n\n`;
  pitch += `📍 *Society/Project:* ${p.society}\n`;
  pitch += `📍 *Location:* ${p.location}\n`;
  pitch += `📐 *Typology:* ${p.configuration}\n`;
  pitch += `📏 *Super Built Area:* ${p.area_sqft} Sqft\n`;
  pitch += `💰 *Pricing:* ${formatPriceToWords(p.price)}\n`;
  pitch += `🛋️ *Furnishing Status:* ${p.interiors || 'Unfurnished'}\n`;
  if (p.facing) pitch += `🚪 *Facing:* ${p.facing}\n`;
  if (p.amenities) pitch += `🌟 *Amenities:* ${p.amenities}\n`;
  if (p.possession) pitch += `🔑 *Handover Status:* ${p.possession}\n`;
  if (p.video_link) pitch += `🔗 *Walkthrough Video:* ${p.video_link}\n`;
  if (p.photo_link) pitch += `📸 *Photos Gallery:* ${p.photo_link}\n`;
  if (p.brochure_link) pitch += `📄 *PDF Brochure:* ${p.brochure_link}\n`;
  
  pitch += `\n*🧑💼 Pitch Prepared By:* \n`;
  pitch += `Name: *${senderName}*\n`;
  pitch += `Company: *${senderCompany}*\n`;
  pitch += `Phone: *${senderPhone}*\n`;
  pitch += `Email: *${senderEmail}*\n\n`;
  pitch += `Contact us immediately for site visits and exclusive booking negotiations!`;

  document.getElementById('share-pitch-text').value = pitch;
  openModal('modal-share-card');
};

window.shareProjectData = function() {
  const projectId = document.getElementById('detail-proj-id').value;
  if (!projectId) return;
  const p = state.projects.find(item => item.id == projectId);
  if (!p) return;
  
  state.selectedPropertyForShare = null;
  state.selectedProjectForShare = p;
  
  const senderName = document.getElementById('share-sender-name').value || 'Vasu Jain';
  const senderCompany = document.getElementById('share-sender-company').value || 'REALPro CRM';
  const senderPhone = document.getElementById('share-sender-phone').value || '+91 99454 03202';
  const senderEmail = document.getElementById('share-sender-email').value || 'vasu@realpro.com';

  let pitch = `🏗️ *PREMIUM BUILDER PROJECT PITCH* 🏗️\n\n`;
  pitch += `📍 *Project Name:* ${p.project_name || 'N/A'}\n`;
  pitch += `👷 *Builder Name:* ${p.builder_name || 'N/A'}\n`;
  pitch += `📍 *Location:* ${p.location || 'N/A'}\n`;
  pitch += `📐 *Configuration:* ${p.configuration || 'N/A'}\n`;
  pitch += `💰 *Pricing:* ${p.price_final || 'N/A'}\n`;
  if (p.possession) pitch += `🔑 *Possession:* ${p.possession}\n`;
  if (p.subvention) pitch += `💵 *Subvention Scheme:* ${p.subvention}\n`;
  if (p.location_usp) pitch += `📍 *Location USP:* ${p.location_usp}\n`;
  if (p.metro_station) pitch += `🚇 *Metro Station:* ${p.metro_station}\n`;
  if (p.other_usp) pitch += `🌟 *USPs:* ${p.other_usp}\n`;
  if (p.brochure_link) pitch += `📄 *PDF Brochure:* ${p.brochure_link}\n`;
  if (p.photos) pitch += `📸 *Photos Link:* ${p.photos}\n`;
  if (p.videos) pitch += `🎥 *Videos Link:* ${p.videos}\n`;
  
  pitch += `\n*🧑💼 Pitch Prepared By:* \n`;
  pitch += `Name: *${senderName}*\n`;
  pitch += `Company: *${senderCompany}*\n`;
  pitch += `Phone: *${senderPhone}*\n`;
  pitch += `Email: *${senderEmail}*\n\n`;
  pitch += `Contact us immediately for site visits and developer bookings!`;

  document.getElementById('share-pitch-text').value = pitch;
  openModal('modal-share-card');
};

function refreshPitchText() {
  const p = state.selectedPropertyForShare;
  const proj = state.selectedProjectForShare;
  
  const senderName = document.getElementById('share-sender-name').value;
  const senderCompany = document.getElementById('share-sender-company').value;
  const senderPhone = document.getElementById('share-sender-phone').value;
  const senderEmail = document.getElementById('share-sender-email').value;

  let pitch = '';
  if (p) {
    pitch = `🏠 *PREMIUM PROPERTY FOR MATCH* 🏠\n\n`;
    pitch += `📍 *Society/Project:* ${p.society}\n`;
    pitch += `📍 *Location:* ${p.location}\n`;
    pitch += `📐 *Typology:* ${p.configuration}\n`;
    pitch += `📏 *Super Built Area:* ${p.area_sqft} Sqft\n`;
    pitch += `💰 *Pricing:* ${formatPriceToWords(p.price)}\n`;
    pitch += `🛋️ *Furnishing Status:* ${p.interiors || 'Unfurnished'}\n`;
    if (p.facing) pitch += `🚪 *Facing:* ${p.facing}\n`;
    if (p.amenities) pitch += `🌟 *Amenities:* ${p.amenities}\n`;
    if (p.possession) pitch += `🔑 *Handover Status:* ${p.possession}\n`;
    if (p.video_link) pitch += `🔗 *Walkthrough Video:* ${p.video_link}\n`;
    if (p.photo_link) pitch += `📸 *Photos Gallery:* ${p.photo_link}\n`;
    if (p.brochure_link) pitch += `📄 *PDF Brochure:* ${p.brochure_link}\n`;
  } else if (proj) {
    pitch = `🏗️ *PREMIUM BUILDER PROJECT PITCH* 🏗️\n\n`;
    pitch += `📍 *Project Name:* ${proj.project_name || 'N/A'}\n`;
    pitch += `👷 *Builder Name:* ${proj.builder_name || 'N/A'}\n`;
    pitch += `📍 *Location:* ${proj.location || 'N/A'}\n`;
    pitch += `📐 *Configuration:* ${proj.configuration || 'N/A'}\n`;
    pitch += `💰 *Pricing:* ${proj.price_final || 'N/A'}\n`;
    if (proj.possession) pitch += `🔑 *Possession:* ${proj.possession}\n`;
    if (proj.subvention) pitch += `💵 *Subvention Scheme:* ${proj.subvention}\n`;
    if (proj.location_usp) pitch += `📍 *Location USP:* ${proj.location_usp}\n`;
    if (proj.metro_station) pitch += `🚇 *Metro Station:* ${proj.metro_station}\n`;
    if (proj.other_usp) pitch += `🌟 *USPs:* ${proj.other_usp}\n`;
    if (proj.brochure_link) pitch += `📄 *PDF Brochure:* ${proj.brochure_link}\n`;
    if (proj.photos) pitch += `📸 *Photos Link:* ${proj.photos}\n`;
    if (proj.videos) pitch += `🎥 *Videos Link:* ${proj.videos}\n`;
  } else {
    return;
  }
  
  pitch += `\n*🧑💼 Pitch Prepared By:* \n`;
  pitch += `Name: *${senderName}*\n`;
  pitch += `Company: *${senderCompany}*\n`;
  pitch += `Phone: *${senderPhone}*\n`;
  pitch += `Email: *${senderEmail}*\n\n`;
  pitch += `Contact us immediately for details, site visits, and bookings!`;

  document.getElementById('share-pitch-text').value = pitch;
}

// Attach event listeners for Brand detail changes
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('share-sender-name');
  const compInput = document.getElementById('share-sender-company');
  const phoneInput = document.getElementById('share-sender-phone');
  const emailInput = document.getElementById('share-sender-email');
  
  if (nameInput) nameInput.addEventListener('input', refreshPitchText);
  if (compInput) compInput.addEventListener('input', refreshPitchText);
  if (phoneInput) phoneInput.addEventListener('input', refreshPitchText);
  if (emailInput) emailInput.addEventListener('input', refreshPitchText);
});

window.sendShareWhatsApp = function() {
  const text = document.getElementById('share-pitch-text').value;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};

window.sendShareEmail = function() {
  const text = document.getElementById('share-pitch-text').value;
  const subject = `Premium Property Match Pitch from REALPro`;
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};

// ─── DYNAMIC DROPDOWN FIELD OPTIONS CONFIGURATOR (PHASE 5) ───
const DEFAULT_CONFIGS = {
  leadSources: ['99acres', 'MagicBricks', 'Walk-in', 'Referral', 'SMS / Whatsapp', 'FB / Instagram', 'Google Search', 'Co-Broker'],
  propertySources: ['Owner Direct', 'Agent Referral', 'Newspaper Ad', 'Property Portal', 'Banner/Board', 'Builder Desk', 'Walk-in'],
  propertyTypes: ['Villa', 'Row House', 'Penthouse', 'Duplex', 'Apartment', 'Independent House', 'Plot', 'Land', 'Office space', 'Commercial plot / land', 'Retail space', 'Warehouse', 'others'],
  leadStages: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
  mandateTypes: ['Open', 'Exclusive', 'Builder Direct', 'Sub-Broker', 'Joint Mandate'],
  statusTypes: ['AVAILABLE', 'SOLD', 'ON HOLD', 'WITHDRAWN', 'EXPIRED', 'RESERVED'],
  interiorsTypes: ['Unfurnished', 'Semi-furnished', 'Fully Furnished', 'Raw/Bare Shell', 'Plug & Play']
};

function initDropdownOptionsConfig() {
  let configs = localStorage.getItem('realpro_field_configs');
  let parsed;
  if (!configs) {
    parsed = { ...DEFAULT_CONFIGS };
  } else {
    try {
      parsed = JSON.parse(configs);
      // Merge with default configs to ensure all properties exist
      for (const key in DEFAULT_CONFIGS) {
        if (!parsed[key] || !Array.isArray(parsed[key])) {
          parsed[key] = [...DEFAULT_CONFIGS[key]];
        }
      }
      // Force-update statusTypes if old cache is missing EXPIRED/RESERVED
      if (!parsed.statusTypes || !parsed.statusTypes.includes('EXPIRED')) {
        parsed.statusTypes = [...DEFAULT_CONFIGS.statusTypes];
      }
    } catch (e) {
      console.error('Failed to parse realpro_field_configs, resetting to defaults', e);
      parsed = { ...DEFAULT_CONFIGS };
    }
  }
  localStorage.setItem('realpro_field_configs', JSON.stringify(parsed));
  
  // Populate all dropdown elements in the app
  populateAllDropdowns();
  
  // Load initial configuration display on Settings Page
  const catSelect = document.getElementById('settings-config-category');
  if (catSelect) {
    loadConfigCategoryOptions(catSelect.value);
  }
}

function getStoredConfigs() {
  const configs = localStorage.getItem('realpro_field_configs');
  if (configs) {
    try {
      return JSON.parse(configs);
    } catch(e) {
      console.error('Failed to parse configs', e);
      return DEFAULT_CONFIGS;
    }
  }
  return DEFAULT_CONFIGS;
}

function populateAllDropdowns() {
  const configs = getStoredConfigs();
  
  // 1. Populate Lead Sources
  populateSelectElement('lead-source', configs.leadSources);
  populateSelectElement('prop-source', configs.propertySources);
  populateSelectElement('rental-source', configs.propertySources);
  populateSelectElement('comm-source', configs.propertySources);
  populateSelectElement('land-source', configs.propertySources);
  
  // 2. Populate Typologies
  populateSelectElement('lead-type', configs.propertyTypes);
  populateSelectElement('prop-type', configs.propertyTypes);
  populateSelectElement('filter-prop-type', configs.propertyTypes);
  
  // 3. Populate Property Specifics
  populateSelectElement('prop-mandate', configs.mandateTypes || []);
  // prop-status is hardcoded in HTML with all 6 statuses — do NOT overwrite with localStorage cache
  // Just ensure rental-status options are also correct
  populateSelectElement('prop-interiors', configs.interiorsTypes || []);
  populateSelectElement('filter-prop-mandate', configs.mandateTypes || []);
  populateSelectElement('filter-prop-interiors', configs.interiorsTypes || []);
}

function populateSelectElement(elementId, options) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const targetEl = el.tagName === 'INPUT' ? document.getElementById('datalist-' + elementId) : el;
  if (!targetEl) return;
  const currentVal = el.value;
  
  const opts = options || [];
  const mapped = opts.map(opt => `<option value="${opt}">${opt}</option>`);
  if (el.tagName === 'SELECT') {
    mapped.push(`<option value="__ADD_CUSTOM__" style="color:var(--gold-l); font-weight:700;">➕ Add Custom Option...</option>`);
  }

  targetEl.innerHTML = mapped.join('');
  if (opts.includes(currentVal) && el.tagName === 'SELECT') {
    el.value = currentVal;
  }
}

function saveCustomDropdownValue(category, newValue) {
  if (!newValue) return;
  newValue = newValue.trim();
  const configs = getStoredConfigs();
  if (!configs[category]) configs[category] = [];
  if (!configs[category].includes(newValue)) {
    configs[category].push(newValue);
    localStorage.setItem('realpro_field_configs', JSON.stringify(configs));
    populateAllDropdowns();
  }
}

// Settings Page functions
window.loadConfigCategoryOptions = function(category) {
  const configs = getStoredConfigs();
  const items = configs[category] || [];
  
  const container = document.getElementById('settings-config-items-container');
  if (!container) return;
  
  container.innerHTML = items.map(item => `
    <span class="tag tag-primary" style="cursor:pointer; padding: 6px 12px; font-weight: 600;" onclick="removeConfigOptionItem('${category}', '${item}')">
      ${item} <span style="margin-left: 6px; color: var(--red); font-weight:bold;">×</span>
    </span>
  `).join('');
};

window.addCustomOptionItem = function() {
  const categorySelect = document.getElementById('settings-config-category');
  const inputEl = document.getElementById('settings-config-new-item');
  if (!categorySelect || !inputEl) return;
  
  const category = categorySelect.value;
  const newItem = inputEl.value.trim();
  if (!newItem) {
    showToast('Please enter an option name.');
    return;
  }
  
  const configs = getStoredConfigs();
  if (!configs[category]) configs[category] = [];
  
  if (configs[category].includes(newItem)) {
    showToast('This option already exists.');
    return;
  }
  
  configs[category].push(newItem);
  localStorage.setItem('realpro_field_configs', JSON.stringify(configs));
  inputEl.value = '';
  
  loadConfigCategoryOptions(category);
  populateAllDropdowns();
  showToast(`Added option "${newItem}" to ${category}`);
};

window.removeConfigOptionItem = function(category, item) {
  if (!confirm(`Are you sure you want to remove option "${item}"?`)) return;
  
  const configs = getStoredConfigs();
  if (!configs[category]) return;
  
  configs[category] = configs[category].filter(opt => opt !== item);
  localStorage.setItem('realpro_field_configs', JSON.stringify(configs));
  
  loadConfigCategoryOptions(category);
  populateAllDropdowns();
  showToast(`Removed option "${item}"`);
};

window.resetConfigOptionsToDefault = function() {
  if (!confirm('Are you sure you want to reset all field options to defaults?')) return;
  
  localStorage.setItem('realpro_field_configs', JSON.stringify(DEFAULT_CONFIGS));
  const categorySelect = document.getElementById('settings-config-category');
  if (categorySelect) {
    loadConfigCategoryOptions(categorySelect.value);
  }
  populateAllDropdowns();
  showToast('Field options reset to pristine defaults.');
};

window.saveConfigCategoryOptions = function() {
  showToast('Field configurations successfully persisted.');
};

// ─── FLOATING BULK SELECTION ENGINE (PHASE 5) ───

window.toggleSelectAllButton = function(pane, btnElem) {
  const isSelected = btnElem.getAttribute('data-selected') === 'true';
  const newState = !isSelected;
  btnElem.setAttribute('data-selected', newState.toString());
  btnElem.innerHTML = newState ? '🔳 Deselect All' : '☑️ Select All';
  toggleAllRowCheckboxes(pane, newState);
};

window.toggleAllRowCheckboxes = function(pane, checked) {
  const checkboxes = document.querySelectorAll(`.row-checkbox-${pane}`);
  checkboxes.forEach(cb => {
    cb.checked = checked;
  });
  updateBulkSelectionState(pane);
};

window.updateBulkSelectionState = function(pane) {
  const checkboxes = document.querySelectorAll(`.row-checkbox-${pane}`);
  const selectedIds = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedIds.push(parseInt(cb.value));
    }
  });
  
  state.selectedRowIds[pane] = selectedIds;
  
  const bulkBar = document.getElementById('floating-bulk-bar');
  const countLabel = document.getElementById('bulk-selected-count');
  const controlsContainer = document.getElementById('bulk-action-controls');
  
  if (selectedIds.length > 0) {
    countLabel.innerText = selectedIds.length;
    
    // Inject pane-specific bulk actions controls
    let html = '';
    if (pane === 'resale' || pane === 'rental' || pane === 'commercial') {
      const activeTable = 'properties';
      html = `
        <button class="btn btn-ghost btn-sm" onclick="triggerBulkDelete('${activeTable}', '${pane}')" style="color:var(--red); border:1px solid rgba(192, 57, 43, 0.4);"><i class="ti ti-trash"></i> Bulk Delete</button>
        
        <select class="form-select btn-sm" style="font-size:11px; padding:4px 8px; width: 140px; border:0.5px solid var(--border);" onchange="triggerBulkUpdate('${activeTable}', '${pane}', 'mandate_type', this.value)">
          <option value="">-- Change Mandate --</option>
          <option value="Exclusive">Exclusive</option>
          <option value="Non Exclusive">Non-Exclusive</option>
        </select>
        
        <button class="btn btn-ghost btn-sm" onclick="triggerBulkTag('${activeTable}', '${pane}')" style="color:var(--gold-l); border:1px solid rgba(212, 175, 55,0.4);"><i class="ti ti-tag"></i> Add tag</button>
        
        <button class="btn btn-ghost btn-sm" onclick="openPortalSyncModal('${pane}')" style="color:var(--gold-l); border:1px solid rgba(212, 175, 55,0.4);"><i class="ti ti-world"></i> Sync Portals</button>
      `;
    } else if (pane === 'projects') {
      html = `
        <button class="btn btn-ghost btn-sm" onclick="triggerBulkDelete('projects', '${pane}')" style="color:var(--red); border:1px solid rgba(192, 57, 43, 0.4);"><i class="ti ti-trash"></i> Bulk Delete</button>
        
        <select class="form-select btn-sm" style="font-size:11px; padding:4px 8px; width: 140px; border:0.5px solid var(--border);" onchange="triggerBulkUpdate('projects', '${pane}', 'uc_rtmi', this.value)">
          <option value="">-- Change Staging --</option>
          <option value="UC">Under Construction (UC)</option>
          <option value="RTMI">Ready to Move (RTMI)</option>
        </select>
      `;
    } else if (pane === 'leads') {
      html = `
        <button class="btn btn-ghost btn-sm" onclick="triggerBulkDelete('leads', '${pane}')" style="color:var(--red); border:1px solid rgba(192, 57, 43, 0.4);"><i class="ti ti-trash"></i> Bulk Delete</button>
        
        <select class="form-select btn-sm" style="font-size:11px; padding:4px 8px; width: 140px; border:0.5px solid var(--border);" onchange="triggerBulkUpdate('leads', '${pane}', 'status', this.value)">
          <option value="">-- Change Temp --</option>
          <option value="Hot">Hot</option>
          <option value="Warm">Warm</option>
          <option value="Cold">Cold</option>
        </select>
        
        <select class="form-select btn-sm" style="font-size:11px; padding:4px 8px; width: 140px; border:0.5px solid var(--border);" onchange="triggerBulkUpdate('leads', '${pane}', 'stage', this.value)">
          <option value="">-- Change Pipeline Stage --</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Qualified">Qualified</option>
          <option value="Proposal">Proposal</option>
          <option value="Negotiation">Negotiation</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
        </select>
        
        <button class="btn btn-ghost btn-sm" onclick="showToast('Bulk WhatsApp blast queued for ' + selectedIds.length + ' leads'); clearAllSelections()" style="color:var(--green); border:1px solid rgba(46, 204, 113, 0.4);"><i class="ti ti-brand-whatsapp"></i> Send WhatsApp</button>
        <button class="btn btn-ghost btn-sm" onclick="showToast('Bulk Email blast queued for ' + selectedIds.length + ' leads'); clearAllSelections()" style="color:var(--blue-light); border:1px solid rgba(52, 152, 219, 0.4);"><i class="ti ti-mail"></i> Send Mail</button>
      `;
    } else if (pane === 'raw-leads') {
      html = `
        <button class="btn btn-ghost btn-sm" onclick="triggerBulkDelete('leads', '${pane}')" style="color:var(--red); border:1px solid rgba(192, 57, 43, 0.4);"><i class="ti ti-trash"></i> Bulk Delete</button>
        
        <select class="form-select btn-sm" id="bulk-raw-leads-agent" style="font-size:11px; padding:4px 8px; width: 140px; border:0.5px solid var(--border);" onchange="triggerBulkUpdate('leads', '${pane}', 'agent_id', this.value)">
          <option value="">-- Assign Agent --</option>
        </select>
        
        <button class="btn btn-ghost btn-sm" onclick="triggerBulkTag('leads', '${pane}')" style="color:var(--gold-l); border:1px solid rgba(212, 175, 55, 0.4);"><i class="ti ti-tag"></i> Add tag</button>
      `;
      setTimeout(async () => {
        const sel = document.getElementById('bulk-raw-leads-agent');
        if (sel) {
          const res = await fetch('/api/agents');
          const agents = await res.json();
          agents.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.innerText = a.name;
            sel.appendChild(opt);
          });
        }
      }, 0);
    }
    
    controlsContainer.innerHTML = html;
    bulkBar.classList.add('active');
  } else {
    bulkBar.classList.remove('active');
  }
};

window.clearAllSelections = function() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"][class^="row-checkbox-"]');
  checkboxes.forEach(cb => cb.checked = false);
  const checkAlls = document.querySelectorAll('input[type="checkbox"][id^="check-all-"]');
  checkAlls.forEach(cb => cb.checked = false);
  
  Object.keys(state.selectedRowIds).forEach(key => {
    state.selectedRowIds[key] = [];
  });
  
  document.getElementById('floating-bulk-bar').classList.remove('active');
};

window.triggerBulkDelete = async function(table, pane) {
  const ids = state.selectedRowIds[pane];
  if (!ids || ids.length === 0) return;
  if (!confirm(`Are you sure you want to delete ${ids.length} selected records from ${table}?`)) return;
  
  try {
    const res = await fetch(`/api/${table}/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Successfully deleted ${result.count} items.`);
      clearAllSelections();
      if (table === 'properties') { loadProperties(); loadDashboardData(); }
      else if (table === 'projects') { loadProjects(); loadDashboardData(); }
      else if (table === 'leads') {
        loadEnquiries();
        loadDashboardData();
      }
    }
  } catch (err) {
    console.error(err);
    showToast('Bulk delete failed.');
  }
};

window.triggerBulkUpdate = async function(table, pane, field, value) {
  if (!value) return;
  const ids = state.selectedRowIds[pane];
  if (!ids || ids.length === 0) return;
  
  try {
    const res = await fetch(`/api/${table}/bulk-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, field, value })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Successfully updated ${result.count} items.`);
      clearAllSelections();
      if (table === 'properties') { loadProperties(); loadDashboardData(); }
      else if (table === 'projects') { loadProjects(); loadDashboardData(); }
      else if (table === 'leads') {
        loadEnquiries();
        loadDashboardData();
      }
    }
  } catch (err) {
    console.error(err);
    showToast('Bulk update failed.');
  }
};

window.triggerBulkTag = async function(table, pane) {
  const ids = state.selectedRowIds[pane];
  if (!ids || ids.length === 0) return;
  const tag = prompt("Enter tag name to add to all selected properties:");
  if (!tag) return;
  const cleanedTag = tag.trim();
  if (!cleanedTag) return;
  
  try {
    const res = await fetch(`/api/${table}/bulk-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, field: 'special_tags', value: cleanedTag })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Successfully tagged ${result.count} properties.`);
      clearAllSelections();
      loadProperties();
    }
  } catch (err) {
    console.error(err);
    showToast('Bulk tagging failed.');
  }
};

// ─── RELATIONAL CO-BROKER LINKING ENGINE (PHASE 5) ───
window.linkAssociateToProperty = async function(propId, associateId) {
  try {
    const res = await fetch(`/api/properties/${propId}/associate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ associate_id: associateId ? parseInt(associateId) : null })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Co-broker associate link saved.');
      loadProperties();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to link associate.');
  }
};

window.linkAssociateToLead = async function(leadId, associateId) {
  try {
    const res = await fetch(`/api/leads/${leadId}/associate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ associate_id: associateId ? parseInt(associateId) : null })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Client requirement co-broker link saved.');
      loadEnquiries();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to link associate.');
  }
};

window.showAssociateDetailsInline = async function(id) {
  const assoc = state.associates.find(a => a.id === id);
  if (!assoc) return;
  
  // Dynamic Relational Fetch Interceptor
  try {
    if (!state.properties || state.properties.length === 0) {
      const res = await fetch('/api/properties');
      state.properties = await res.json();
    }
    if (!state.leads || state.leads.length === 0) {
      const res = await fetch('/api/leads');
      state.leads = await res.json();
    }
  } catch (err) {
    console.error('Error fetching relational co-broker assets:', err);
  }

  document.getElementById('assoc-details-title').innerHTML = `<i class="ti ti-user-check"></i> Associate Dashboard: <strong>${assoc.name}</strong> (${assoc.company || 'Private Brokerage'})`;
  
  // Linked Properties
  const linkedProps = state.properties.filter(p => p.associate_id === id);
  const propsContainer = document.getElementById('assoc-linked-properties');
  if (linkedProps.length === 0) {
    propsContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px; background:rgba(0,0,0,0.1); border-radius:4px;">No properties mapped to this Associate.</div>`;
  } else {
    propsContainer.innerHTML = linkedProps.map(p => `
      <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border-left: 3px solid var(--gold); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:600; font-size:12.5px;">${p.society}</div>
          <div style="font-size:11px; color:var(--text-secondary);">📍 ${p.location} | ${p.configuration} | ${formatPriceToWords(p.price)}</div>
        </div>
        <span class="chip chip-cold btn-sm" style="font-size:9.5px;">${p.prop_id || '#' + p.id}</span>
      </div>
    `).join('');
  }
  
  // Linked Leads
  const linkedLeads = state.leads.filter(l => l.associate_id === id);
  const leadsContainer = document.getElementById('assoc-linked-leads');
  if (linkedLeads.length === 0) {
    leadsContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px; background:rgba(0,0,0,0.1); border-radius:4px;">No client requirements mapped to this Associate.</div>`;
  } else {
    leadsContainer.innerHTML = linkedLeads.map(l => `
      <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border-left: 3px solid var(--blue-light); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:600; font-size:12.5px;">${l.name}</div>
          <div style="font-size:11px; color:var(--text-secondary);">${l.project_type} | Stage: <strong>${l.stage}</strong> | Budget: ₹${(l.budget_min/100000).toFixed(0)}L-₹${(l.budget_max/100000).toFixed(0)}L</div>
        </div>
        <span class="chip ch-gold btn-sm" style="font-size:9.5px;">${l.status}</span>
      </div>
    `).join('');
  }
  
  document.getElementById('associate-details-panel').classList.remove('hidden');
  document.getElementById('associate-details-panel').scrollIntoView({ behavior: 'smooth' });
};

// ─── CUSTOM TAGGING PROMPT Triggers ───
window.promptAddTag = async function(id, type) {
  const tag = prompt("Enter new tag name (e.g. Hot Deal, Lake View, Corner Unit):");
  if (!tag) return;
  const cleanedTag = tag.trim();
  if (!cleanedTag) return;
  
  try {
    const res = await fetch(`/api/${type}/${id}/tag`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: cleanedTag })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Tag "${cleanedTag}" added successfully.`);
      if (type === 'properties') loadProperties();
      else if (type === 'projects') loadProjects();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to add tag.');
  }
};

window.clearProjectFilters = function() {
  if (document.getElementById('filter-proj-search')) document.getElementById('filter-proj-search').value = '';
  if (document.getElementById('filter-proj-stage')) document.getElementById('filter-proj-stage').value = '';
  if (document.getElementById('filter-proj-area-min')) document.getElementById('filter-proj-area-min').value = '';
  if (document.getElementById('filter-proj-area-max')) document.getElementById('filter-proj-area-max').value = '';
  if (document.getElementById('filter-proj-price-min')) document.getElementById('filter-proj-price-min').value = '';
  if (document.getElementById('filter-proj-price-max')) document.getElementById('filter-proj-price-max').value = '';
  loadProjects();
};

window.toggleAdvancedFilters = function() {
  const panel = document.getElementById('advanced-filters-panel');
  const btn = document.getElementById('btn-adv-filters');
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    btn.innerHTML = `<i class="ti ti-adjustments-horizontal"></i> Hide Advanced Filters`;
    btn.classList.add('active');
  } else {
    panel.classList.add('hidden');
    btn.innerHTML = `<i class="ti ti-adjustments-horizontal"></i> Advanced Filters`;
    btn.classList.remove('active');
  }
};

// ─── PHASE 6 AUTOMATION DASHBOARD CONTROLLERS ───

window.switchAutomationTab = function(tab) {
  document.getElementById('btn-auto-drips').classList.remove('active-tab');
  document.getElementById('btn-auto-routing').classList.remove('active-tab');
  document.getElementById('btn-auto-webhooks').classList.remove('active-tab');
  
  document.getElementById(`btn-auto-${tab}`).classList.add('active-tab');
  
  document.getElementById('auto-drips-section').style.display = 'none';
  document.getElementById('auto-routing-section').style.display = 'none';
  document.getElementById('auto-webhooks-section').style.display = 'none';
  
  document.getElementById(`auto-${tab}-section`).style.display = 'block';
};

window.loadAutomationData = async function() {
  try {
    const [campRes, logRes, agentRes, ruleRes] = await Promise.all([
      fetch('/api/drip/campaigns'),
      fetch('/api/drip/logs'),
      fetch('/api/agents'),
      fetch('/api/assignment/settings')
    ]);
    
    const campaigns = await campRes.json();
    const logs = await logRes.json();
    const agents = await agentRes.json();
    const rule = await ruleRes.json();
    
    renderCampaignCards(campaigns);
    renderDripLogs(logs);
    renderRoster(agents);
    selectRoutingRuleUI(rule.rule_type);
  } catch(e) {
    console.error(e);
    showToast('Failed to load automation telemetry.');
  }
};

function renderCampaignCards(campaigns) {
  const container = document.getElementById('auto-drip-cards-container');
  if (!container) return;
  
  if (campaigns.length === 0) {
    container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px;">No campaigns available.</div>`;
    return;
  }
  
  container.innerHTML = campaigns.map(c => {
    const seqEscaped = escapeHtml(JSON.stringify(c.sequence_data));
    return `
      <div class="card card-option" id="drip-camp-card-${c.id}" onclick="selectDripCampaignFlow(${c.id}, ${c.is_active}, '${c.name}', '${c.channel}', '${c.target_leads_status}', '${seqEscaped}')" style="padding:15px; border-radius:var(--radius-md); cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; position:relative; min-height: 120px;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span class="badge" style="background:rgba(201, 153, 26, 0.12); color:var(--gold-l); font-weight:700; font-size:9.5px; padding:2px 7px; border:0.5px solid rgba(201,153,26,0.3);">${c.channel}</span>
            <div class="toggle-switch" onclick="event.stopPropagation(); toggleDripCampaign(${c.id})" style="width: 32px; height: 18px; background: ${c.is_active ? 'var(--gold)' : '#334155'}; border-radius: 20px; display: inline-flex; align-items: center; padding: 2px; cursor: pointer; transition: all 0.3s;">
              <div style="width: 14px; height: 14px; background: #0f1923; border-radius: 50%; transform: translateX(${c.is_active ? '14px' : '0px'}); transition: all 0.3s;"></div>
            </div>
          </div>
          <div style="font-weight:700; font-size:13.5px; color:#fff; margin-bottom:4px;">${c.name}</div>
          <div style="font-size:11px; color:var(--text-muted);">Target Staging: <span style="font-weight:700; color:var(--gold-l);">${c.target_leads_status} leads</span></div>
        </div>
        <div style="margin-top:10px; font-size:10.5px; color:var(--text-muted); text-align:right; font-weight:600;">${c.sequence_data.length} steps scheduled</div>
      </div>
    `;
  }).join('');
  
  if (campaigns.length > 0) {
    const first = campaigns[0];
    selectDripCampaignFlow(first.id, first.is_active, first.name, first.channel, first.target_leads_status, JSON.stringify(first.sequence_data));
  }
}

window.selectDripCampaignFlow = function(id, isActive, name, channel, target, seqStr) {
  document.querySelectorAll('[id^="drip-camp-card-"]').forEach(el => el.classList.remove('active'));
  const card = document.getElementById(`drip-camp-card-${id}`);
  if (card) card.classList.add('active');
  
  let seq = [];
  try {
    seq = JSON.parse(seqStr);
  } catch(e) {
    seq = [];
  }
  
  const container = document.getElementById('auto-drip-flow-container');
  if (!container) return;
  
  if (seq.length === 0) {
    container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px;">No sequence steps available.</div>`;
    return;
  }
  
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:8px;">
      <span style="font-weight:700; font-size:12px; color:#fff;"><i class="ti ti-route" style="color:var(--gold);"></i> Trigger Sequence Steps: ${name}</span>
      <span class="badge" style="background:rgba(255,255,255,0.05); font-size:10px; padding:2px 6px;">Channel: ${channel}</span>
    </div>
    <div style="display:flex; flex-direction:column; gap:4px;">
  `;
  
  seq.forEach((step, index) => {
    html += `
      <div class="flow-step">
        <div class="flow-step-day">Day ${step.day} schedule — Action Step ${index + 1}</div>
        <div class="flow-step-subject"><i class="ti ti-mail-opened"></i> Subject: ${step.subject}</div>
        <div class="flow-step-msg">${step.message}</div>
      </div>
    `;
    if (index < seq.length - 1) {
      html += `
        <div class="flow-arrow">
          <i class="ti ti-chevron-down"></i> <span style="font-size:9.5px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; margin-left:6px;">Wait ${seq[index+1].day - step.day} Days</span>
        </div>
      `;
    }
  });
  
  html += `</div>`;
  container.innerHTML = html;
};

window.toggleDripCampaign = async function(campaignId) {
  try {
    const res = await fetch(`/api/drip/campaigns/${campaignId}/toggle`, { method: 'PATCH' });
    if (res.ok) {
      showToast('Campaign status toggled successfully.');
      loadAutomationData();
    }
  } catch(e) {
    console.error(e);
    showToast('Failed to toggle campaign status.');
  }
};

window.triggerManualDripSweep = async function() {
  try {
    const res = await fetch('/api/drip/trigger-check', { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      if (result.count > 0) {
        showToast(`⚡ Automation sweep triggered! Dispatched ${result.count} simulated drips.`);
      } else {
        showToast('Automation check complete. All cold & warm drips are active.');
      }
      loadAutomationData();
    }
  } catch(e) {
    console.error(e);
    showToast('Manual campaign sweep failed.');
  }
};

window.selectRoutingRule = function(ruleType) {
  selectRoutingRuleUI(ruleType);
};

function selectRoutingRuleUI(ruleType) {
  if (document.getElementById('radio-robin')) document.getElementById('radio-robin').checked = (ruleType === 'ROUND_ROBIN');
  if (document.getElementById('radio-location')) document.getElementById('radio-location').checked = (ruleType === 'LOCATION_BASED');
  if (document.getElementById('radio-manual')) document.getElementById('radio-manual').checked = (ruleType === 'MANUAL');
  
  if (document.getElementById('opt-rule-robin')) document.getElementById('opt-rule-robin').className = 'card-option' + (ruleType === 'ROUND_ROBIN' ? ' active' : '');
  if (document.getElementById('opt-rule-location')) document.getElementById('opt-rule-location').className = 'card-option' + (ruleType === 'LOCATION_BASED' ? ' active' : '');
  if (document.getElementById('opt-rule-manual')) document.getElementById('opt-rule-manual').className = 'card-option' + (ruleType === 'MANUAL' ? ' active' : '');
  
  state.activeRoutingRule = ruleType;
}

window.saveActiveRoutingRule = async function() {
  const selected = state.activeRoutingRule || 'ROUND_ROBIN';
  try {
    const res = await fetch('/api/assignment/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_type: selected })
    });
    if (res.ok) {
      showToast(`Saved Routing Settings: lead routing model sets to ${selected}.`);
      loadAutomationData();
    }
  } catch(e) {
    console.error(e);
    showToast('Failed to save routing configs.');
  }
};

window.submitNewSalesAgent = async function() {
  const nameVal = document.getElementById('new-agent-name').value.trim();
  const emailVal = document.getElementById('new-agent-email').value.trim();
  const phoneVal = document.getElementById('new-agent-phone').value.trim();
  const zonesVal = document.getElementById('new-agent-zones').value.trim();
  
  if (!nameVal) {
    showToast('Please enter the agent name.');
    return;
  }
  
  try {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameVal, email: emailVal, phone: phoneVal, location_specialty: zonesVal })
    });
    if (res.ok) {
      showToast(`Sales Agent "${nameVal}" registered successfully!`);
      document.getElementById('new-agent-name').value = '';
      document.getElementById('new-agent-email').value = '';
      document.getElementById('new-agent-phone').value = '';
      document.getElementById('new-agent-zones').value = '';
      loadAutomationData();
    }
  } catch(e) {
    console.error(e);
    showToast('Failed to save agent to database.');
  }
};

function renderRoster(agents) {
  const tbody = document.getElementById('auto-roster-table-body');
  if (!tbody) return;
  
  if (agents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:10px;">No agents active in roster.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = agents.map(a => `
    <tr>
      <td style="font-weight:600; color:#fff;"><i class="ti ti-user" style="color:var(--gold); margin-right:5px; font-size:13px;"></i> ${a.name}</td>
      <td><span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-light); font-size:9.5px; padding:2px 6px;">${a.location_specialty || 'All Zones'}</span></td>
      <td>${a.email || 'N/A'}</td>
      <td>${a.phone || 'N/A'}</td>
      <td style="font-weight:700; color:var(--gold-l); text-align:center; font-size:13px;">${a.leads_assigned}</td>
      <td><span class="badge" style="background:rgba(46, 204, 113, 0.15); color:#2ecc71; font-weight:700; font-size:9.5px; padding:2px 6px;">${a.status}</span></td>
    </tr>
  `).join('');
}

function renderDripLogs(logs) {
  const tbody = document.getElementById('auto-drip-logs-table-body');
  if (!tbody) return;
  
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:15px;">No drips broadcasted. Trigger a manual check sweep above!</td></tr>`;
    return;
  }
  
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td style="font-weight:600; color:#fff;"><i class="ti ti-user-check" style="font-size:13px; margin-right:4px;"></i> ${l.lead_name}</td>
      <td style="color:var(--gold-l); font-weight:600;">${l.campaign_name}</td>
      <td><span class="badge" style="background:rgba(201, 153, 26, 0.08); color:var(--gold-l); font-size:9.5px; padding:2px 6px;">${l.scheduled_date}</span></td>
      <td style="font-size:10px; color:var(--text-muted);">${formatTimestamp(l.sent_date)}</td>
      <td style="font-family:sans-serif; color:var(--text-light); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(l.message)}">${escapeHtml(l.message)}</td>
      <td><span class="badge" style="background:rgba(46, 204, 113, 0.12); color:#2ecc71; font-weight:700; font-size:9.5px; padding:2px 6px;">DISPATCHED</span></td>
    </tr>
  `).join('');
}

window.fireMockIntakeWebhook = async function() {
  const nameVal = document.getElementById('sim-lead-name').value.trim();
  const sourceVal = document.getElementById('sim-lead-source').value;
  const phoneVal = document.getElementById('sim-lead-phone').value.trim();
  const locationVal = document.getElementById('sim-lead-location').value.trim();
  const notesVal = document.getElementById('sim-lead-notes').value.trim();
  
  if (!nameVal) {
    showToast('Name is a required mock webhook parameter.');
    return;
  }
  
  try {
    const res = await fetch('/api/webhooks/mock-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameVal, source: sourceVal, phone: phoneVal, location: locationVal, notes: notesVal })
    });
    const result = await res.json();
    if (result.success) {
      alert(`🔌 PORTAL WEBHOOK INGESTION ALERT\n\n- Lead Created: ${result.name} (ID: ${result.lead_id})\n- Assigned Agent: ${result.assigned_to}\n\n${result.message}`);
      showToast('Simulated Portal Webhook intake successfully captured.');
      loadAutomationData();
      
      // Reload leads page data so it updates reactively in the background
      if (typeof loadLeads === 'function') loadLeads();
      else if (typeof loadPipeline === 'function') loadPipeline();
    }
  } catch(e) {
    console.error(e);
    showToast('Mock lead webhook intake failed.');
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
  } catch(e) {
    return ts;
  }
}

// ─── PHASE 7: PORTAL SYNC & CLOUD TELEPHONY ACTIVE CONTROLLERS ───

// Outbound Portal Sync Modal launcher
window.openPortalSyncModal = function(pane) {
  const ids = state.selectedRowIds[pane] || [];
  if (ids.length === 0) {
    showToast('Please select at least one property row.');
    return;
  }
  state.activeSyncPane = pane;
  document.getElementById('portal-sync-count').innerText = ids.length;
  openModal('modal-portal-sync');
};

// Outbound Portal Sync submission handler
window.submitPortalSync = async function(event) {
  if (event) event.preventDefault();
  
  const pane = state.activeSyncPane;
  const ids = state.selectedRowIds[pane] || [];
  const selectedPortals = Array.from(document.querySelectorAll('input[name="sync-portals-check"]:checked')).map(el => el.value);
  
  if (selectedPortals.length === 0) {
    showToast('Please select at least one real estate portal.');
    return;
  }
  
  try {
    const res = await fetch('/api/properties/sync-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, portals: selectedPortals })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`🌐 Listing published outbound to ${selectedPortals.join(', ')} successfully!`);
      closeModal('modal-portal-sync');
      clearAllSelections();
      loadProperties();
    }
  } catch(e) {
    console.error(e);
    showToast('Failed to execute outbound portal listing sync.');
  }
};

// Exotel Telephony Click-to-Call active triggers
window.triggerClickToCall = function(leadId, prospectName, phone) {
  // Check if there is already an active call
  if (state.activeCall) {
    showToast('A cloud telephony call session is already active.');
    return;
  }
  
  state.activeCall = {
    leadId: leadId,
    name: prospectName,
    phone: phone,
    seconds: 0,
    muted: false
  };
  
  // Reset Call Panel UI
  document.getElementById('call-prospect-name').innerText = prospectName;
  document.getElementById('call-prospect-phone').innerText = phone;
  document.getElementById('call-stage-badge').innerText = `Agent: ${state.userName || 'Vasu Jain'}`;
  document.getElementById('call-timer-box').innerText = '00:00';
  document.getElementById('call-status-lbl').innerText = 'Bridging agent phone...';
  document.getElementById('telephony-call-notes').value = '';
  document.getElementById('btn-call-mute').innerHTML = `<i class="ti ti-microphone-off"></i> Mute`;
  
  // Show active call overlay
  const panel = document.getElementById('telephony-call-panel');
  panel.classList.remove('hidden');
  
  // Start simulated phone bridging state-machines
  setTimeout(() => {
    document.getElementById('call-status-lbl').innerText = 'Ringing prospect line...';
    
    setTimeout(() => {
      document.getElementById('call-status-lbl').innerText = 'CONNECTED · ACTIVE';
      document.getElementById('call-status-lbl').style.color = '#2ecc71';
      
      // Start session talk timer
      state.callStartTime = Date.now();
      state.callTimerInterval = setInterval(updateCallTimer, 1000);
    }, 2000);
  }, 2000);
};

function updateCallTimer() {
  if (!state.activeCall) return;
  state.activeCall.seconds++;
  
  const sec = state.activeCall.seconds;
  const mins = Math.floor(sec / 60).toString().padStart(2, '0');
  const secs = (sec % 60).toString().padStart(2, '0');
  
  document.getElementById('call-timer-box').innerText = `${mins}:${secs}`;
}

window.toggleCallMute = function() {
  if (!state.activeCall) return;
  state.activeCall.muted = !state.activeCall.muted;
  const btn = document.getElementById('btn-call-mute');
  if (state.activeCall.muted) {
    btn.innerHTML = `<i class="ti ti-microphone"></i> Unmute`;
    btn.style.color = 'var(--gold)';
    document.getElementById('call-status-lbl').innerText = 'CONNECTED · MUTED';
  } else {
    btn.innerHTML = `<i class="ti ti-microphone-off"></i> Mute`;
    btn.style.color = '';
    document.getElementById('call-status-lbl').innerText = 'CONNECTED · ACTIVE';
  }
};

window.minimizeCallPanel = function() {
  const panel = document.getElementById('telephony-call-panel');
  panel.classList.add('hidden');
  showToast('Telephony session minimized. Running in background.');
};

window.endActiveCall = async function() {
  if (!state.activeCall) return;
  
  // Stop timer interval
  clearInterval(state.callTimerInterval);
  
  const notes = document.getElementById('telephony-call-notes').value.trim() || 'Simulated Exotel click-to-call session completed successfully.';
  const duration = state.activeCall.seconds;
  const leadId = state.activeCall.leadId;
  
  try {
    const res = await fetch('/api/telephony/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadId,
        agent_id: 1, // Defaulting to logged agent
        duration: duration,
        call_notes: notes
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('📞 Outgoing call logged and appended directly inside lead logs!');
      
      // Hide active overlay
      document.getElementById('telephony-call-panel').classList.add('hidden');
      state.activeCall = null;
      
      // Refresh active datasets
      if (state.activePage === 'analytics') loadTelephonyAnalytics();
      if (typeof loadLeads === 'function') loadLeads();
      else if (typeof loadPipeline === 'function') loadPipeline();
      else if (typeof loadFollowups === 'function') loadFollowups();
      else if (typeof loadEnquiries === 'function') loadEnquiries();
    }
  } catch(e) {
    console.error(e);
    showToast('Failed to log call outcome.');
  }
};

// Telephony Operations Centre & Recordings analytics loader
window.loadTelephonyAnalytics = async function() {
  try {
    const res = await fetch('/api/telephony/calls');
    const calls = await res.json();
    
    // Compute operations center metric aggregates
    const totalCalls = calls.length;
    let totalDur = 0;
    const leaderCounts = {};
    
    calls.forEach(c => {
      totalDur += c.duration;
      leaderCounts[c.agent_name] = (leaderCounts[c.agent_name] || 0) + 1;
    });
    
    const avgDuration = totalCalls > 0 ? Math.round(totalDur / totalCalls) : 0;
    
    let activeLeader = 'Vasu Jain';
    let maxCalls = 0;
    Object.keys(leaderCounts).forEach(name => {
      if (leaderCounts[name] > maxCalls) {
        maxCalls = leaderCounts[name];
        activeLeader = name;
      }
    });
    
    // Hydrate stat widgets
    document.getElementById('telephony-total-calls').innerText = totalCalls;
    document.getElementById('telephony-avg-duration').innerText = `${avgDuration}s`;
    document.getElementById('telephony-roster-leader').innerText = `${activeLeader} (${maxCalls} calls)`;
    
    // Render call records rows
    const tbody = document.getElementById('telephony-recordings-table-body');
    if (!tbody) return;
    
    if (calls.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:10px;">No outgoing call registry recorded.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = calls.map(c => `
      <tr>
        <td style="font-weight:600; color:#fff;"><i class="ti ti-user" style="margin-right:4px;"></i> ${c.lead_name}</td>
        <td style="font-weight:600; color:var(--gold-l);"><i class="ti ti-user-check" style="font-size:11px;"></i> ${c.agent_name}</td>
        <td style="font-weight:700;">${c.duration}s</td>
        <td style="color:var(--text-muted); font-size:11px;">${formatTimestamp(c.created_at)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="playSimulatedRecording('${c.recording_url}', ${c.id})" id="btn-play-rec-${c.id}" style="font-size:10.5px; padding:3px 8px; color:#2ecc71; border:1px solid rgba(46,204,113,0.2);">
            <i class="ti ti-player-play"></i> Play Call
          </button>
        </td>
        <td style="font-family:sans-serif; color:var(--text-light); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(c.call_notes)}">${escapeHtml(c.call_notes)}</td>
        <td><span class="badge" style="background:rgba(46, 204, 113, 0.12); color:#2ecc71; font-weight:700; font-size:9.5px; padding:2px 6px;">BRIDGED SUCCESS</span></td>
      </tr>
    `).join('');
    
  } catch(e) {
    console.error(e);
    showToast('Failed to load cloud telephony call recordings.');
  }
};

window.playSimulatedRecording = function(url, id) {
  const btn = document.getElementById(`btn-play-rec-${id}`);
  if (!btn) return;
  
  if (btn.classList.contains('playing')) {
    btn.innerHTML = `<i class="ti ti-player-play"></i> Play Call`;
    btn.classList.remove('playing');
    btn.style.color = '#2ecc71';
    btn.style.borderColor = 'rgba(46,204,113,0.2)';
    showToast('Call audio playback paused.');
  } else {
    // Stop any other playing buttons
    document.querySelectorAll('[id^="btn-play-rec-"]').forEach(b => {
      b.innerHTML = `<i class="ti ti-player-play"></i> Play Call`;
      b.classList.remove('playing');
      b.style.color = '#2ecc71';
      b.style.borderColor = 'rgba(46,204,113,0.2)';
    });
    
    btn.innerHTML = `<i class="ti ti-player-pause"></i> Playing...`;
    btn.classList.add('playing');
    btn.style.color = 'var(--gold)';
    btn.style.borderColor = 'var(--gold)';
    showToast('Playing simulated cloud telephony call recording...');
  }
};

// Telephony and Proposals loading handled inside unified navToPage

// ─── PHASE 8: SECURE CLIENT PORTAL & PROPOSALS CONTROLLERS ───

// Load proposals admin dashboard pane
async function loadProposalsConsole() {
  try {
    // 1. Fetch leads and populate dropdown select
    const leadsRes = await fetch('/api/leads');
    const leads = await leadsRes.json();
    const leadSelect = document.getElementById('proposal-lead-select');
    
    if (leadSelect) {
      leadSelect.innerHTML = '<option value="">-- Choose active client from leads --</option>' + 
        leads.map(l => `<option value="${l.id}" data-phone="${l.phone || ''}" data-email="${l.email || ''}">${l.name} (${l.phone})</option>`).join('');
    }

    // 2. Fetch properties and populate checklist
    const propsRes = await fetch('/api/properties');
    const properties = await propsRes.json();
    const checklist = document.getElementById('proposal-properties-checklist');
    
    if (checklist) {
      if (properties.length === 0) {
        checklist.innerHTML = '<div style="font-size:11px; color:var(--text-muted);">No properties registered in database.</div>';
      } else {
        checklist.innerHTML = properties.map(pr => `
          <div style="display:flex; flex-direction:column; gap:4px; padding: 8px 0; border-bottom: 0.5px solid rgba(255,255,255,0.05);">
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" name="proposal-prop-check" value="${pr.id}" id="check-prop-${pr.id}" onchange="document.getElementById('comment-box-${pr.id}').style.display = this.checked ? 'block' : 'none'">
              <label for="check-prop-${pr.id}" style="font-size:12px; cursor:pointer; font-weight: 600;">
                <strong>${pr.society}</strong> (${pr.configuration || 'Config N/A'}) in ${pr.location} — <span style="color:var(--green)">${pr.price_raw}</span>
              </label>
            </div>
            <div id="comment-box-${pr.id}" style="display:none; padding-left: 22px; margin-top: 4px;">
              <input type="text" class="form-input" id="prop-comment-${pr.id}" placeholder="Add private recommendation comments for client..." style="font-size:11px; padding:4px 8px; height:24px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05);">
            </div>
          </div>
        `).join('');
      }
    }

    // 3. Fetch proposal campaigns history
    const propRes = await fetch('/api/proposals');
    const proposals = await propRes.json();
    const campaignsTbody = document.getElementById('proposal-campaigns-list');
    
    if (campaignsTbody) {
      if (proposals.length === 0) {
        campaignsTbody.innerHTML = '<tr><td colspan="4" class="empty">No proposal campaigns initiated yet.</td></tr>';
        return;
      }

      campaignsTbody.innerHTML = proposals.map(p => {
        const itemsList = p.items.map(it => `• ${it.society} (${it.price_raw})`).join('<br>');
        return `
          <tr>
            <td>
              <strong>${p.lead_name}</strong><br>
              <span style="font-size:11px; color:var(--text-muted);">${p.lead_phone}</span><br>
              <button class="btn btn-ghost btn-sm" onclick="sendPortalAgentReply(${p.lead_id})" style="font-size:10px; padding:2px 6px; margin-top:4px; width:auto;">💬 Direct Reply</button>
            </td>
            <td style="font-size:12px; line-height:1.4;">${itemsList}</td>
            <td>
              <span class="chip chip-cold" style="font-size:10px; font-family:monospace; margin-bottom:4px;">${p.token.substring(0, 12)}...</span><br>
              <div style="display:flex; gap:4px; margin-top:4px;">
                <button class="btn btn-primary btn-sm" onclick="copyProposalLink('${p.token}')" style="font-size:9.5px; padding:2px 6px; width:auto; border-radius:4px;">🔗 Copy Link</button>
                <a href="/proposal/${p.token}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:9.5px; padding:2px 6px; width:auto; border-radius:4px; display:inline-flex; justify-content:center; align-items:center;">👁️ View</a>
              </div>
            </td>
            <td style="font-size:11px; color:var(--text-muted);">${new Date(p.created_at).toLocaleDateString()}<br>${new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
          </tr>
        `;
      }).join('');
    }

  } catch (err) {
    console.error(err);
  }
}

// Generate new proposal link
window.submitCreateProposal = async function(event) {
  if (event) event.preventDefault();
  
  const leadId = document.getElementById('proposal-lead-select').value;
  const title = document.getElementById('proposal-title').value.trim();
  const introMessage = document.getElementById('proposal-intro-message').value.trim();
  
  const propertyIds = Array.from(document.querySelectorAll('input[name="proposal-prop-check"]:checked')).map(cb => parseInt(cb.value));

  if (!leadId) {
    showToast('Please select a target client lead.');
    return;
  }
  if (propertyIds.length === 0) {
    showToast('Please select at least one property listing.');
    return;
  }

  const agentComments = {};
  propertyIds.forEach(id => {
    const el = document.getElementById(`prop-comment-${id}`);
    if (el) {
      agentComments[id] = el.value.trim();
    }
  });

  try {
    const response = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, title, intro_message: introMessage, property_ids: propertyIds, agent_comments: agentComments })
    });

    const result = await response.json();
    if (result.success) {
      showToast('🌐 Proposals campaign web link created successfully!');
      
      // Clear form inputs
      document.getElementById('proposal-title').value = '';
      document.getElementById('proposal-intro-message').value = '';
      document.querySelectorAll('input[name="proposal-prop-check"]:checked').forEach(cb => cb.checked = false);
      
      // Reload proposals console list
      loadProposalsConsole();

      // Show modal or prompt with link
      const link = `${window.location.origin}/proposal/${result.token}`;
      prompt('Exclusive Proposal Created! Copy this link to share with client:', link);
    }
  } catch (e) {
    console.error(e);
    showToast('Failed to generate interactive proposal.');
  }
};

// Copy proposal link utility
window.copyProposalLink = function(token) {
  const url = `${window.location.origin}/proposal/${token}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Proposal web-link copied to clipboard!');
  }).catch(() => {
    prompt('Copy this link to share:', url);
  });
};

// Agent direct reply to client portal messaging
window.sendPortalAgentReply = async function(leadId) {
  const reply = prompt("Enter your message response to dispatch straight to the Client Portal desk:");
  if (!reply || !reply.trim()) return;

  try {
    const res = await fetch('/api/proposals/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, message: reply })
    });

    if (res.ok) {
      showToast('💬 Portal chat dispatch completed successfully!');
      if (state.activePage === 'proposals') loadProposalsConsole();
    }
  } catch (e) {
    console.error(e);
    showToast('Failed to dispatch client reply.');
  }
};

// HTML5 system-level push notifications sweep for overdue leads
async function checkOverdueFollowupNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const res = await fetch('/api/leads');
    const data = await res.json();
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter overdue leads
    const overdueLeads = data.filter(l => l.next_followup && l.next_followup < todayStr && l.followup_status !== 'Completed');

    if (overdueLeads.length > 0) {
      new Notification("REALPro Action Alert 🔔", {
        body: `Attention Vasu Jain: You have ${overdueLeads.length} overdue follow-up callbacks that require immediate nurturing!`,
        icon: '/uploads/logo_192.png'
      });
    }
  } catch (err) {
    console.error("Failed to check overdue follow-up notifications:", err);
  }
}

// ----------------------------------------------------
// PHASE C — TIMELINE, SCORECARDS, ATTENDANCE & TEAM
// ----------------------------------------------------

// 1. Clock-in / Clock-out Attendance OS
async function initClockStatus() {
  const stateVal = localStorage.getItem('clock_state') || 'OUT';
  updateClockUI(stateVal);
}

function updateClockUI(stateVal) {
  const lbl = document.getElementById('clock-status-label');
  const btn = document.getElementById('btn-clock-in-out');
  if (stateVal === 'IN') {
    lbl.innerText = 'Online 🟢';
    lbl.style.backgroundColor = '#10B981';
    btn.innerText = 'Clock Out';
    btn.style.backgroundColor = '#e74c3c';
  } else {
    lbl.innerText = 'Offline 🔴';
    lbl.style.backgroundColor = '#6B6560';
    btn.innerText = 'Clock In';
    btn.style.backgroundColor = 'var(--gold)';
  }
}

async function autoClock(action) {
  const activeUserStr = localStorage.getItem('crm_active_member_session');
  if (!activeUserStr) return;
  try {
    const user = JSON.parse(activeUserStr);
    const agentId = user.id;
    if (!agentId) return;

    const res = await fetch('/api/attendance/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, action })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('clock_state', action);
      updateClockUI(action);
      if (action === 'IN') {
        showToast(`Attendance: Auto clocked-in successfully!`, 'success');
      } else {
        showToast(`Attendance: Auto clocked-out successfully!`, 'info');
      }
      if (typeof loadTeamAttendanceLogs === 'function') {
        loadTeamAttendanceLogs();
      }
    }
  } catch (e) {
    console.error("Auto attendance sync failed:", e);
  }
}

function calculateHoursWorked(clockIn, clockOut) {
  if (!clockIn) return '0.00 hrs';
  let endTime;
  if (!clockOut) {
    endTime = new Date();
  } else {
    endTime = parseTime(clockOut);
  }
  const startTime = parseTime(clockIn);
  if (!startTime || !endTime) return '0.00 hrs';

  let diffMs = endTime - startTime;
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }
  const diffHrs = diffMs / (1000 * 60 * 60);
  return `${diffHrs.toFixed(2)} hrs`;
}

function parseTime(timeStr) {
  const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)?$/i);
  if (!match) return null;
  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3];

  let adjustedHours = hours;
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && hours < 12) adjustedHours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12) adjustedHours = 0;
  }
  const d = new Date();
  d.setHours(adjustedHours, minutes, 0, 0);
  return d;
}

async function toggleClockInOut() {
  const currentState = localStorage.getItem('clock_state') || 'OUT';
  const action = currentState === 'OUT' ? 'IN' : 'OUT';
  const activeUserStr = localStorage.getItem('crm_active_member_session');
  let agentId = 1;
  if (activeUserStr) {
    try {
      const user = JSON.parse(activeUserStr);
      if (user && user.id) agentId = user.id;
    } catch(e) {}
  }
  try {
    const res = await fetch('/api/attendance/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, action })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('clock_state', action);
      updateClockUI(action);
      showToast(data.message);
      if (typeof loadTeamAttendanceLogs === 'function') {
        loadTeamAttendanceLogs();
      }
    } else {
      showToast(data.error);
    }
  } catch (e) {
    console.error(e);
    showToast('Failed to connect to Attendance OS.');
  }
}

// 2. Lead Details Tab Switcher
function switchLeadTab(tabId) {
  const tabs = ['timeline', 'scorecard', 'log'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-lead-${t}`);
    const pane = document.getElementById(`pane-lead-${t}`);
    if (t === tabId) {
      btn.classList.add('active');
      btn.style.borderBottomColor = 'var(--gold)';
      pane.classList.remove('hidden');
    } else {
      btn.classList.remove('active');
      btn.style.borderBottomColor = 'transparent';
      pane.classList.add('hidden');
    }
  });
}

// 3. Show Lead Details Modal
// showLeadDetails
async function showLeadDetails(leadId) {
  document.getElementById('detail-lead-id').value = leadId;
  openModal('modal-lead-detail');
  switchLeadTab('timeline');
  
  try {
    // Fetch lead details
    const resLead = await fetch('/api/leads');
    const leads = await resLead.json();
    const lead = leads.find(l => l.id == leadId);
    if (!lead) return;

    document.getElementById('detail-lead-name').innerText = lead.name;
    const customLeadIdEl = document.getElementById('detail-custom-lead-id');
    if (customLeadIdEl) {
      customLeadIdEl.innerText = lead.custom_lead_id || `LD-${1000 + lead.id}`;
      customLeadIdEl.style.display = 'inline-block';
    }
    document.getElementById('detail-lead-temp').innerText = lead.status;
    document.getElementById('detail-lead-temp').className = `badge ${lead.status === 'Hot' ? 'badge-red' : lead.status === 'Cold' ? 'badge-blue' : 'badge-amber'}`;
    
    // Core requirements
    document.getElementById('req-bhk').innerText = lead.config_bhk || 'N/A';
    document.getElementById('req-loc').innerText = lead.location_preference || 'N/A';
    document.getElementById('req-bud').innerText = lead.budget_max ? `₹${(lead.budget_min/100000).toFixed(0)}L - ₹${(lead.budget_max/100000).toFixed(0)}L` : lead.budget_min || 'N/A';
    document.getElementById('req-type').innerText = lead.project_type || 'N/A';
    document.getElementById('detail-followup-date').value = lead.next_followup || '';

    // Renewal Reminder
    if (lead.project_type && lead.project_type.includes('Rental') && lead.rental_expiry_date) {
      document.getElementById('renewal-reminder').classList.remove('hidden');
      document.getElementById('renewal-date').innerText = lead.rental_expiry_date;
    } else {
      document.getElementById('renewal-reminder').classList.add('hidden');
    }

    // Tags
    const tags = (lead.special_tags || '').split(',').filter(t => t.trim());
    const tagsHtml = tags.length > 0 
      ? tags.map(t => `<span class="badge" style="background:rgba(255,255,255,0.1); border:none; font-size:9px;">${t.trim()}</span>`).join('') 
      : `<span style="font-size:10px; color:var(--text-muted);">No Tags</span>`;
    document.getElementById('detail-lead-tags-container').innerHTML = tagsHtml;

    // Likelihood score logic (AI)
    let scoreBase = lead.lead_score || 0;
    // Cap at 99% for visual reasons
    document.getElementById('detail-lead-likelihood').innerText = `${Math.min(99, scoreBase)}%`;

    // Fetch Scorecard
    const resScore = await fetch(`/api/leads/${leadId}/scorecard`);
    const score = await resScore.json();
    
    document.getElementById('score-budget').value = score.budget;
    document.getElementById('lbl-score-budget').innerText = `${score.budget} / 5`;
    
    document.getElementById('score-timeline').value = score.timeline;

    // Load new sections
    loadLeadTimeline(leadId);
    loadLeadMatches(leadId);
    renderLeadDocs(lead);

    document.getElementById('lbl-score-timeline').innerText = `${score.timeline} / 5`;
    
    document.getElementById('score-funding').value = score.funding;
    document.getElementById('lbl-score-funding').innerText = `${score.funding} / 5`;
    
    document.getElementById('score-responsiveness').value = score.responsiveness;
    document.getElementById('lbl-score-responsiveness').innerText = `${score.responsiveness} / 5`;
    
    document.getElementById('score-clarity').value = score.clarity;
    document.getElementById('lbl-score-clarity').innerText = `${score.clarity} / 5`;

    recalculateTotalScore();

    // Populate Closure Checklist & Info
    document.getElementById('chk-site-visit').checked = lead.closure_site_visit || false;
    document.getElementById('chk-joint-visit').checked = lead.closure_joint_visit || false;
    document.getElementById('chk-negotiation').checked = lead.closure_negotiation || false;
    document.getElementById('chk-agreement').checked = lead.closure_agreement || false;
    document.getElementById('chk-registration').checked = lead.closure_registration || false;
    document.getElementById('chk-closed').checked = lead.closure_closed || false;

    document.getElementById('closure-prop-id').value = lead.closure_prop_id || '';
    document.getElementById('closure-commission-amt').value = lead.closure_commission_amt || '';
    document.getElementById('closure-notes').value = lead.closure_notes || '';

    // Update Highlights UI
    if (typeof window.updateClosureFlowUI === 'function') {
      window.updateClosureFlowUI();
    }

    // Fetch transaction link details
    try {
      const resTrans = await fetch(`/api/leads/${leadId}/transaction`);
      if (resTrans.ok) {
        const trans = await resTrans.json();
        const statusEl = document.getElementById('detail-transaction-status');
        if (statusEl) {
          if (trans) {
            statusEl.innerHTML = `Deal Active: Value ₹${(parseFloat(trans.deal_value || 0)/10000000).toFixed(2)}Cr | Comm: ₹${(parseFloat(trans.commission_amount || 0)/100000).toFixed(2)}L (${trans.payment_status})`;
            statusEl.style.color = trans.payment_status === 'Paid' ? 'var(--green-light)' : 'var(--amber)';
          } else {
            statusEl.innerHTML = 'No Deal Linked';
            statusEl.style.color = 'var(--text-muted)';
          }
        }
      }
    } catch (errTrans) {
      console.error('Failed to load linked transaction status:', errTrans);
    }
  } catch (e) {
    console.error(e);
  }
}

// 4. Recalculate scorecard total score
function recalculateTotalScore() {
  const b = parseInt(document.getElementById('score-budget').value);
  const t = parseInt(document.getElementById('score-timeline').value);
  const f = parseInt(document.getElementById('score-funding').value);
  const r = parseInt(document.getElementById('score-responsiveness').value);
  const c = parseInt(document.getElementById('score-clarity').value);
  document.getElementById('lead-scorecard-total').innerText = `${b + t + f + r + c} / 25`;
}

// 5. Submit Lead Scorecard
async function submitLeadScorecard(e) {
  e.preventDefault();
  const leadId = document.getElementById('detail-lead-id').value;
  const body = {
    budget: parseInt(document.getElementById('score-budget').value),
    timeline: parseInt(document.getElementById('score-timeline').value),
    funding: parseInt(document.getElementById('score-funding').value),
    responsiveness: parseInt(document.getElementById('score-responsiveness').value),
    clarity: parseInt(document.getElementById('score-clarity').value)
  };
  try {
    const res = await fetch(`/api/leads/${leadId}/scorecard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      showToast('Qualification scorecard saved successfully!');
      showLeadDetails(parseInt(leadId));
    }
  } catch (err) {
    console.error(err);
  }
}

// 6. Submit Custom Lead Interaction
async function submitLeadInteraction(e) {
  e.preventDefault();
  const leadId = document.getElementById('detail-lead-id').value;
  const body = {
    interaction_type: document.getElementById('log-inter-type').value,
    notes: document.getElementById('log-inter-notes').value
  };
  try {
    const res = await fetch(`/api/leads/${leadId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      showToast('Outbound interaction logged successfully!');
      document.getElementById('form-lead-interaction').reset();
      showLeadDetails(parseInt(leadId));
      loadEnquiries();
      loadDashboardData();
    }
  } catch (err) {
    console.error(err);
  }
}

// 7. Team Roster Management
async function loadTeamRoster() {
  try {
    const res = await fetch('/api/team');
    const data = await res.json();
    state.teamMembers = data; // Cache the data
    
    // Fetch habits logs to aggregate progress bars
    let allHabitsData = [];
    try {
      const habitsRes = await fetch('/api/habits?all=true');
      if (habitsRes.ok) {
        allHabitsData = await habitsRes.json();
      }
    } catch(e) {
      console.error(e);
    }

    const tbody = document.getElementById('team-roster-list-container');
    const table = tbody.closest('table');
    const user = state.currentUser;
    const isAdmin = user && user.role === 'Admin';
    
    if (table) {
      const thead = table.querySelector('thead');
      if (thead) {
        thead.innerHTML = `
          <tr>
            <th>Agent Name & Role</th>
            <th>Contact Details</th>
            <th>Location Specialty</th>
            ${isAdmin ? '<th>Security PIN</th>' : ''}
            ${isAdmin ? '<th>Tab Permissions</th>' : ''}
            <th>Status</th>
            ${isAdmin ? '<th style="text-align:right;">Actions</th>' : ''}
          </tr>
        `;
      }
    }
    
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${isAdmin ? 7 : 4}" class="empty">No team members registered yet.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = data.map(m => {
      let permsStr = '';
      if (m.allowed_pages === '*') {
        permsStr = '<span class="chip ch-gold" style="font-size:9px;">Full Access</span>';
      } else {
        try {
          const parsed = JSON.parse(m.allowed_pages || '[]');
          permsStr = parsed.map(p => `<span class="chip" style="font-size:9px; background:rgba(255,255,255,0.05); color:var(--text-light); margin: 2px;">${p}</span>`).join(' ');
        } catch(e) {
          permsStr = '<span class="chip chip-cold" style="font-size:9px;">None</span>';
        }
      }
      
      const pinDisplay = m.login_pin ? `<code style="font-family:monospace; font-weight:700; color:var(--gold-l); letter-spacing:1px;">${m.login_pin}</code>` : 'Not Set';
      
      const actionButtons = isAdmin ? `
        <td style="text-align:right;">
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button class="btn btn-ghost btn-sm" onclick="showEditTeamModal(${m.id})" style="padding:4px 8px; font-size:11px; border:1px solid var(--border);"><i class="ti ti-edit"></i> Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteTeamMember(${m.id}, '${m.name.replace(/'/g, "\\'")}')" style="padding:4px 8px; font-size:11px; color:var(--red); border:1px solid rgba(192,57,43,0.3);"><i class="ti ti-trash"></i> Delete</button>
          </div>
        </td>
      ` : '';
      
      const agentHabits = allHabitsData.filter(h => h.agent_id === m.id && h.is_done === 1);
      const completedCount = agentHabits.length;
      const percent = Math.round((completedCount / 30) * 100);
      const progressHTML = `
        <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;" title="30-Day habits grid completion percent">
          <div style="flex: 1; min-width: 70px; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
            <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, var(--gold), #fff); box-shadow: 0 0 8px var(--gold);"></div>
          </div>
          <span style="font-size: 9.5px; color: var(--gold-l); font-weight: 600; white-space: nowrap;">Habits: ${completedCount}/30 Days (${percent}%)</span>
        </div>
      `;

      return `
        <tr id="team-agent-row-${m.id}">
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="width:28px; height:28px; border-radius:50%; background:rgba(212, 175, 55,0.1); border:1px solid rgba(212, 175, 55,0.2); display:flex; align-items:center; justify-content:center; color:var(--gold); font-size:11px; font-weight:700;">
                ${m.name.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <strong style="color:#fff;">${m.name}</strong>
                <div style="font-size:9.5px; text-transform:uppercase; color:var(--text-muted); margin-top:2px; display:flex; align-items:center; gap:6px;">${m.role} <span style="color:var(--gold); font-size:10px; letter-spacing:0.5px;">${'⭐'.repeat(m.performance_rating || 5)}</span></div>
                ${progressHTML}
              </div>
            </div>
          </td>
          <td>
            <div style="font-size:12.5px;">${m.email || 'No email'}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${m.phone || 'No phone'}</div>
          </td>
          <td><span class="chip ch-gold" style="font-size:11px;">${m.location_specialty}</span></td>
          ${isAdmin ? `<td>${pinDisplay}</td>` : ''}
          ${isAdmin ? `<td style="max-width:200px; white-space:normal; line-height:1.4;">${permsStr}</td>` : ''}
          <td><span class="chip ${m.status === 'ACTIVE' ? 'chip-closed' : 'chip-cold'}">${m.status}</span></td>
          ${actionButtons}
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
  }
}

window.selectAllPerms = function(checked) {
  document.querySelectorAll('.team-perm-check').forEach(cb => {
    cb.checked = checked;
  });
};

window.showAddTeamModal = () => {
  state.editingTeamId = null;
  document.querySelector('#modal-add-team .mtitle').innerText = '👤 Register Active Team Agent';
  document.querySelector('#modal-add-team button[type="submit"]').innerText = '💾 Save Team Member';
  document.getElementById('form-add-team').reset();
  
  if (document.getElementById('team-rating')) {
    document.getElementById('team-rating').value = '5';
  }
  
  document.querySelectorAll('.team-perm-check').forEach(cb => {
    // Default checked pages for Standard Employee Role
    const defaultChecked = ['dashboard', 'daily', 'inventory', 'projects', 'pipeline', 'followups', 'enquiry', 'proposals'];
    cb.checked = defaultChecked.includes(cb.value);
  });
  
  openModal('modal-add-team');
};

window.showEditTeamModal = (id) => {
  const member = state.teamMembers ? state.teamMembers.find(m => m.id == id) : null;
  if (!member) {
    showToast('Failed to find team member data.', 'error');
    return;
  }
  
  state.editingTeamId = id;
  document.querySelector('#modal-add-team .mtitle').innerText = '👤 Edit Team Agent Profile';
  document.querySelector('#modal-add-team button[type="submit"]').innerText = '💾 Update Team Member';
  
  document.getElementById('team-name').value = member.name || '';
  document.getElementById('team-email').value = member.email || '';
  document.getElementById('team-phone').value = member.phone || '';
  document.getElementById('team-specialty').value = member.location_specialty || '';
  document.getElementById('team-role').value = member.role || 'Agent';
  document.getElementById('team-pin').value = member.login_pin || '';
  
  if (document.getElementById('team-rating')) {
    document.getElementById('team-rating').value = member.performance_rating || '5';
  }
  
  let pages = [];
  const allowedPages = member.allowed_pages;
  if (allowedPages === '*') {
    pages = [];
  } else {
    try {
      pages = JSON.parse(allowedPages || '[]');
    } catch(e) {
      pages = [];
    }
  }
  
  document.querySelectorAll('.team-perm-check').forEach(cb => {
    cb.checked = (allowedPages === '*') || pages.includes(cb.value);
  });
  
  openModal('modal-add-team');
};


async function submitAddTeam(e) {
  e.preventDefault();
  
  const role = document.getElementById('team-role').value;
  const pin = document.getElementById('team-pin').value;
  
  const checkedBoxes = document.querySelectorAll('.team-perm-check:checked');
  const pagesList = Array.from(checkedBoxes).map(cb => cb.value);
  
  const allowed_pages = (role === 'Admin') ? '*' : JSON.stringify(pagesList);
  
  const body = {
    name: document.getElementById('team-name').value,
    email: document.getElementById('team-email').value,
    phone: document.getElementById('team-phone').value,
    location_specialty: document.getElementById('team-specialty').value,
    role: role,
    login_pin: pin,
    allowed_pages: allowed_pages,
    performance_rating: parseInt(document.getElementById('team-rating').value || '5')
  };
  
  const isEditing = !!state.editingTeamId;
  const url = isEditing ? `/api/team/${state.editingTeamId}` : '/api/team';
  const method = isEditing ? 'PUT' : 'POST';
  
  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    if (res.ok) {
      showToast(isEditing ? 'Team member profile updated!' : 'New team member registered!');
      closeModal('modal-add-team');
      document.getElementById('form-add-team').reset();
      
      if (isEditing && state.currentUser && state.currentUser.id == state.editingTeamId) {
        const activeUser = {
          id: state.editingTeamId,
          name: body.name,
          email: body.email,
          role: body.role,
          allowed_pages: body.allowed_pages
        };
        state.currentUser = activeUser;
        localStorage.setItem('crm_active_member_session', JSON.stringify(activeUser));
        applyAuthenticatedPermissions(activeUser);
      }
      
      state.editingTeamId = null;
      loadTeamRoster();
    } else {
      showToast(result.error || 'Failed to save team member.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to save team member.', 'error');
  }
}

window.deleteTeamMember = async (id, name) => {
  if (state.currentUser && state.currentUser.id == id) {
    showToast('⚠️ Action Blocked: You cannot delete your own active administrator profile.', 'warning');
    return;
  }
  
  if (confirm(`Are you absolutely sure you want to delete ${name} from the active operational roster?`)) {
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast('Team member removed from roster.');
        loadTeamRoster();
      } else {
        showToast(data.error || 'Failed to delete team member.', 'error');
      }
    } catch(err) {
      console.error(err);
      showToast('Failed to connect to roster server.', 'error');
    }
  }
};

// 8. Load Daily Reminders Sidebar Panel
async function loadRemindersPanel() {
  try {
    const res = await fetch('/api/leads');
    const data = await res.json();
    const container = document.getElementById('reminders-panel-list');
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter leads with callbacks due today or overdue
    const overdueLeads = data.filter(l => l.next_followup && l.next_followup <= todayStr && l.followup_status !== 'Completed');

    if (overdueLeads.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px;">🎉 All callbacks completed! No reminders due.</div>`;
      return;
    }

    container.innerHTML = overdueLeads.map(l => {
      const isOverdue = l.next_followup < todayStr;
      return `
        <div style="background:rgba(255,255,255,0.02); border:1px solid ${isOverdue ? 'rgba(192, 57, 43, 0.4)' : 'rgba(212, 175, 55, 0.4)'}; padding:10px; border-radius:6px; font-size:12px; display:flex; flex-direction:column; gap:4px; border-left: 3.5px solid ${isOverdue ? '#C0392B' : '#F59E0B'}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#fff; cursor:pointer;" onclick="showLeadDetails(${l.id})">${l.name}</strong>
            <span style="font-size:10px; color:${isOverdue ? '#e74c3c' : 'var(--gold-l)'}; font-weight:700;">${isOverdue ? 'OVERDUE' : 'DUE TODAY'}</span>
          </div>
          <div style="color:var(--text-muted); font-size:11px;">Scheduled: ${l.next_followup} | Source: ${l.source}</div>
          <div style="color:var(--text-light); margin-top:2px;">"${l.notes ? l.notes.substring(0, 45) + '...' : 'No notes dump.'}"</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

// 9. Load Daily Operations Admin Report Widget
async function loadDailyOperationsReport() {
  try {
    const res = await fetch('/api/reports/daily');
    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('report-leads-today').innerText = data.metrics.new_leads_today;
      document.getElementById('report-active-visits').innerText = data.metrics.active_site_visits;
      document.getElementById('report-total-calls').innerText = data.metrics.total_calls_today;
      document.getElementById('report-total-props').innerText = data.metrics.total_properties;
    }
  } catch (e) {
    console.error(e);
  }
}

// 10. Secure CSV Export Prompt (Admin Auth check)
async function triggerSecureExport(table) {
  let queryParams = [];
  
  if (table === 'properties') {
    const search = (document.getElementById('filter-prop-search')?.value || '').trim();
    if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
    
    const minPrice = document.getElementById('filter-prop-price-min')?.value || '';
    if (minPrice) queryParams.push(`min_price=${encodeURIComponent(minPrice)}`);
    
    const maxPrice = document.getElementById('filter-prop-price-max')?.value || '';
    if (maxPrice) queryParams.push(`max_price=${encodeURIComponent(maxPrice)}`);
    
    const mandate = document.getElementById('filter-prop-mandate')?.value || '';
    if (mandate) queryParams.push(`mandate_type=${encodeURIComponent(mandate)}`);
    
    const interiors = document.getElementById('filter-prop-interiors')?.value || '';
    if (interiors) queryParams.push(`interiors=${encodeURIComponent(interiors)}`);
    
    const facing = document.getElementById('filter-prop-facing')?.value || '';
    if (facing) queryParams.push(`facing=${encodeURIComponent(facing)}`);
    
    const status = document.getElementById('filter-prop-status')?.value || '';
    if (status) queryParams.push(`status=${encodeURIComponent(status)}`);
    
    const zone = document.getElementById('filter-prop-zone')?.value || '';
    if (zone) queryParams.push(`zone=${encodeURIComponent(zone)}`);
    
    const holderType = document.getElementById('filter-prop-holder-type')?.value || '';
    if (holderType) queryParams.push(`holder_type=${encodeURIComponent(holderType)}`);
    
    const registration = document.getElementById('filter-prop-registration')?.value || '';
    if (registration) queryParams.push(`registration_status=${encodeURIComponent(registration)}`);
    
    // BHK Checklist selections
    const checkedBHKs = [];
    document.querySelectorAll('.filter-bhk-check:checked').forEach(cb => {
      checkedBHKs.push(cb.value);
    });
    if (checkedBHKs.length > 0) {
      queryParams.push(`configuration=${encodeURIComponent(checkedBHKs.join(','))}`);
    }
    
    // Tab filter
    if (state.inventoryTab) {
      queryParams.push(`tab=${encodeURIComponent(state.inventoryTab)}`);
    }
  } else if (table === 'builder_projects') {
    const search = (document.getElementById('filter-proj-search')?.value || '').trim();
    if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
    
    const stage = document.getElementById('filter-proj-stage')?.value || '';
    if (stage) queryParams.push(`stage=${encodeURIComponent(stage)}`);
    
    const areaMin = document.getElementById('filter-proj-area-min')?.value || '';
    if (areaMin) queryParams.push(`area_min=${encodeURIComponent(areaMin)}`);
    
    const areaMax = document.getElementById('filter-proj-area-max')?.value || '';
    if (areaMax) queryParams.push(`area_max=${encodeURIComponent(areaMax)}`);
    
    const priceMin = document.getElementById('filter-proj-price-min')?.value || '';
    if (priceMin) queryParams.push(`price_min=${encodeURIComponent(priceMin)}`);
    
    const priceMax = document.getElementById('filter-proj-price-max')?.value || '';
    if (priceMax) queryParams.push(`price_max=${encodeURIComponent(priceMax)}`);
  } else if (table === 'leads') {
    const search = (document.getElementById('filter-enquiry-search')?.value || '').trim();
    if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
    
    const temp = document.getElementById('filter-enquiry-temp')?.value || '';
    if (temp) queryParams.push(`status=${encodeURIComponent(temp)}`);
  }
  
  const queryString = queryParams.length > 0 ? '&' + queryParams.join('&') : '';
  const initialQuerySymbol = queryParams.length > 0 ? '?' + queryParams.join('&') : '';

  // Check if Employee Masking is active by reading setting state
  if (!state.systemSettings.showMaskedFields) {
    const pass = prompt('Admin Authorization Password Required for CSV exports in Employee View:');
    if (!pass) return;
    
    try {
      const res = await fetch(`/api/export/${table}?password=${encodeURIComponent(pass)}${queryString}`);
      if (res.ok) {
        window.location.href = `/api/export/${table}?password=${encodeURIComponent(pass)}${queryString}`;
      } else {
        const err = await res.json();
        showToast(err.error || 'Authorization failed.');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to execute secure export.');
    }
  } else {
    // Natively trigger download directly for Administrator view
    window.location.href = `/api/export/${table}${initialQuerySymbol}`;
  }
}

// =================================================═══
// 4 ADVANCED CRM TRACKS CONTROLLERS (TRACKS 1, 2, 3 & 4)
// =================================================═══

// ─── TRACK 1: PROXIMITY MATCH AI FRONTEND CONTROLLER ───

// Overwrite switchLeadTab to include matches tab
const prevSwitchLeadTab = window.switchLeadTab;
window.switchLeadTab = function(tabId) {
  const tabs = ['timeline', 'scorecard', 'log', 'matches', 'offered', 'docs', 'closure'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-lead-${t}`);
    const pane = document.getElementById(`pane-lead-${t}`);
    if (t === tabId) {
      if (btn) btn.classList.add('active');
      if (btn) btn.style.borderBottomColor = 'var(--gold)';
      if (pane) pane.classList.remove('hidden');
      if (t === 'matches') {
        const leadId = parseInt(document.getElementById('detail-lead-id').value);
        loadLeadMatches(leadId);
      }
      if (t === 'offered') {
        const leadId = parseInt(document.getElementById('detail-lead-id').value);
        loadLeadMatches(leadId); // loadLeadMatches loads both offered and matches in a single unified API payload
      }
      if (t === 'docs') {
        const leadId = parseInt(document.getElementById('detail-lead-id').value);
        loadLeadDocs(leadId);
      }
    } else {
      if (btn) btn.classList.remove('active');
      if (btn) btn.style.borderBottomColor = 'transparent';
      if (pane) pane.classList.add('hidden');
    }
  });
};

// Overwrite showLeadDetails to load matches when opened
const prevShowLeadDetails = window.showLeadDetails;
window.showLeadDetails = async function(leadId) {
  if (prevShowLeadDetails) await prevShowLeadDetails(leadId);
  loadLeadMatches(leadId);
};

// Fetch and render ranked proximity matches
// Fetch and render ranked proximity matches with AI scores, breakdown, rationales, and offered status
window.loadLeadMatches = async function(leadId) {
  const matchContainer = document.getElementById('lead-matches-container');
  const offeredContainer = document.getElementById('lead-offered-container');
  if (!matchContainer) return;
  
  matchContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px;">🤖 Scanning database inventory and compiling AI rationales...</div>`;
  
  try {
    const res = await fetch(`/api/leads/${leadId}/matches`);
    const { matches, offered } = await res.json();
    
    const offeredIds = offered.map(o => o.property_id);
    const unoffered = matches.filter(m => !offeredIds.includes(m.id));
    
    if (unoffered.length === 0) {
      matchContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px;">No matches found. Check lead budget and preferences!</div>`;
    } else {
      matchContainer.innerHTML = unoffered.slice(0, 15).map(m => {
        const assocBadge = m.associate_name ? `
          <div style="font-size:10.5px; color:var(--amber); margin-top:2px; font-weight:700;">
            🤝 Sourced via Co-Broker: ${m.associate_name} (${m.associate_company || 'Independent'})
          </div>
        ` : '';
        return `
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px 12px; border-radius:6px; font-size:12px; display:flex; flex-direction:column; gap:4px; position:relative; margin-bottom: 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:700; color:#fff;">${m.society} (${m.bedrooms_bhk || 'Premium unit'})</span>
              <span class="ai-match-badge" style="cursor:pointer;" onclick="showAIMatchRationale(${m.id}, ${m.score}, ${m.breakdown.locality}, ${m.breakdown.budget}, ${m.breakdown.bhk}, ${m.breakdown.facing}, '${escapeHtml(m.rationale)}')">✨ ${m.score}% Match AI</span>
            </div>
            <div style="color:var(--text-muted); font-size:11px;">📍 Locality: ${m.location} | Expected Price: <span style="color:#2ecc71; font-weight:700;">₹${m.price_raw || (m.price ? (m.price/10000000).toFixed(2) + ' Cr' : 'On Request')}</span></div>
            ${assocBadge}
            <div style="color:var(--text-light); margin-top:4px; font-style: italic;">"${m.rationale}"</div>
            <div style="display:flex; justify-content:flex-end; margin-top:4px;">
              <button class="btn btn-ghost btn-sm" style="color:var(--gold); font-size:11px; padding:2px 8px;" onclick="markLeadInterest(${leadId}, ${m.id}, 'Offered')">Mark Offered</button>
            </div>
          </div>
        `;
      }).join('');
    }
    
    if (!offeredContainer) return;
    
    const pitchAssociateBar = `
      <div style="display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:6px; border:1px solid var(--border); margin-bottom:12px;">
        <span style="font-size:11.5px; color:var(--text-light); font-weight:700;">Pitch Co-Broker Listing:</span>
        <select class="form-select btn-sm" id="pitch-associate-prop-select" style="flex:1; font-size:11.5px; height:28px; background:rgba(0,0,0,0.3); border:1px solid var(--border);">
          <option value="">-- Select Associate Property --</option>
          ${state.properties.filter(p => p.associate_id).map(p => `<option value="${p.id}">${p.society} (${p.bedrooms_bhk || p.configuration || 'Premium'}) - ${p.price_raw || 'On Request'}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="submitPitchAssociateProperty(${leadId})" style="height:28px; font-size:11.5px; padding:0 10px;">📤 Pitch</button>
      </div>
    `;

    if (offered.length === 0) {
      offeredContainer.innerHTML = pitchAssociateBar + '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:15px;">No properties have been pitched to this lead yet.</div>';
    } else {
      const offeredHtml = offered.map(o => {
        const p = matches.find(x => x.id === o.property_id) || state.properties.find(x => x.id === o.property_id) || { society: 'Unknown', price_raw: '' };
        const assocBadge = p.associate_name ? `
          <div style="font-size:10px; color:var(--amber); margin-top:2.5px; font-weight:700;">
            🤝 Sourced via Co-Broker: ${p.associate_name} (${p.associate_company || 'Independent'})
          </div>
        ` : '';

        const statusColor = o.status === 'Interested' ? 'var(--green-light)' : o.status === 'Not Interested' ? 'var(--red)' : 'var(--blue-light)';
        let actionsHtml = '';
        if (o.status === 'Offered') {
          actionsHtml = `
            <div style="display:flex; gap:6px; margin-top:6px;">
              <button class="btn btn-ghost btn-sm" style="color:var(--green-light); font-size:10px; padding:2px 6px; border: 1px solid rgba(46, 204, 113, 0.2);" onclick="markLeadInterest(${leadId}, ${o.property_id}, 'Interested')">👍 Interested</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--red); font-size:10px; padding:2px 6px; border: 1px solid rgba(231, 76, 60, 0.2);" onclick="markLeadInterest(${leadId}, ${o.property_id}, 'Not Interested')">👎 Disinterested</button>
            </div>
          `;
        } else if (o.status === 'Interested') {
          actionsHtml = `
            <div style="display:flex; gap:10px; align-items:center; margin-top:6px;">
              <span style="color:var(--green-light); font-size:11px; font-weight:700;"><i class="ti ti-star"></i> Client Interested</span>
              <button class="btn btn-ghost btn-sm" style="color:var(--text-muted); font-size:9.5px; padding:1px 4px;" onclick="markLeadInterest(${leadId}, ${o.property_id}, 'Offered')">Reset</button>
            </div>
          `;
        } else if (o.status === 'Not Interested') {
          actionsHtml = `
            <div style="display:flex; gap:10px; align-items:center; margin-top:6px;">
              <span style="color:var(--red); font-size:11px; font-weight:700;"><i class="ti ti-circle-x"></i> Disinterested</span>
              <button class="btn btn-ghost btn-sm" style="color:var(--gold-l); font-size:9.5px; padding:1px 4px;" onclick="markLeadInterest(${leadId}, ${o.property_id}, 'Offered')">Reset</button>
            </div>
          `;
        }

        return `
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px; flex-wrap:wrap; gap:8px;">
            <div>
              <div style="font-size:13px; font-weight:700; color:var(--gold-l);">${p.society}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Status: <strong style="color:${statusColor};">${o.status}</strong></div>
              ${assocBadge}
            </div>
            <div>
              ${actionsHtml}
            </div>
          </div>
        `;
      }).join('');
      offeredContainer.innerHTML = pitchAssociateBar + offeredHtml;
    }
  } catch (e) {
    console.error(e);
    matchContainer.innerHTML = `<div style="font-size:12px; color:var(--red); text-align:center; padding:20px;">Error running match engine.</div>`;
  }
};

window.submitPitchAssociateProperty = async function(leadId) {
  const propId = document.getElementById('pitch-associate-prop-select').value;
  if (!propId) return showToast('Please select an associate listing first.');
  await markLeadInterest(leadId, parseInt(propId), 'Offered');
};

// Render custom Match Rationale Overlay popup
window.showAIMatchRationale = function(propId, score, locality, budget, bhk, facing, rationale) {
  document.getElementById('ai-rationale-text').innerText = rationale;
  
  // Set dynamic widths
  document.getElementById('breakdown-locality').style.width = `${Math.round(locality * (100 / 35))}%`;
  document.getElementById('breakdown-locality-lbl').innerText = `${Math.round(locality * (100 / 35))}%`;
  
  document.getElementById('breakdown-budget').style.width = `${Math.round(budget * (100 / 30))}%`;
  document.getElementById('breakdown-budget-lbl').innerText = `${Math.round(budget * (100 / 30))}%`;
  
  document.getElementById('breakdown-bhk').style.width = `${Math.round(bhk * (100 / 20))}%`;
  document.getElementById('breakdown-bhk-lbl').innerText = `${Math.round(bhk * (100 / 20))}%`;
  
  document.getElementById('breakdown-facing').style.width = `${Math.round(facing * (100 / 15))}%`;
  document.getElementById('breakdown-facing-lbl').innerText = `${Math.round(facing * (100 / 15))}%`;
  
  openModal('modal-ai-match-rationale');
};


// --- DOCUMENT VAULT CONTROLLER METHODS ---
state.docFilter = 'All';

window.loadDocuments = async function() {
  const container = document.getElementById('vault-documents-list-container');
  if (!container) return;
  container.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading archive vault files...</td></tr>`;
  try {
    const res = await fetch('/api/documents');
    const docs = await res.json();
    
    const filter = state.docFilter || 'All';
    const filtered = filter === 'All' ? docs : docs.filter(d => d.reference_type === filter);
    
    if (filtered.length === 0) {
      container.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:15px;">No documents registered in vault.</td></tr>`;
      return;
    }
    
    container.innerHTML = filtered.map(d => `
      <tr>
        <td><strong>${escapeHtml(d.doc_name)}</strong></td>
        <td><span class="chip ch-gold">${escapeHtml(d.reference_type)}</span></td>
        <td>${escapeHtml(d.reference_name || 'N/A')} <span style="font-size:10px; color:var(--text-muted);">(ID: ${d.reference_id})</span></td>
        <td>
          <span style="font-weight:700;">${escapeHtml(d.uploaded_by || 'System')}</span><br>
          <span style="font-size:10px; color:var(--text-muted);">${new Date(d.created_at).toLocaleString()}</span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="window.open('${d.doc_url}', '_blank')"><i class="ti ti-link"></i> Open URL</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteVaultDocument(${d.id})"><i class="ti ti-trash"></i> Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--red);">Error loading documents.</td></tr>`;
  }
};

window.deleteVaultDocument = async function(id) {
  if (!confirm('Are you sure you want to permanently delete this document from the vault?')) return;
  try {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    showToast('Document deleted.');
    loadDocuments();
  } catch (err) {
    console.error(err);
    showToast('Failed to delete document.');
  }
};

window.setDocFilter = function(type) {
  state.docFilter = type;
  const types = ['All', 'Lead', 'Inventory', 'Transaction'];
  types.forEach(t => {
    const chip = document.getElementById(`doc-filter-${t}`);
    if (chip) {
      if (t === type) {
        chip.style.background = 'var(--gold)';
        chip.style.color = '#000';
        chip.style.fontWeight = '700';
      } else {
        chip.style.background = 'rgba(255,255,255,0.05)';
        chip.style.color = '#fff';
        chip.style.fontWeight = 'normal';
      }
    }
  });
  loadDocuments();
};

window.loadVaultRefDropdown = async function() {
  const refType = document.getElementById('new-vault-doc-ref-type').value;
  const select = document.getElementById('new-vault-doc-ref-id');
  if (!select) return;
  select.innerHTML = '<option value="">-- Loading references --</option>';
  try {
    if (refType === 'Lead') {
      const res = await fetch('/api/leads');
      const leads = await res.json();
      select.innerHTML = leads.map(l => `<option value="${l.id}">${escapeHtml(l.name)} (ID: ${l.id})</option>`).join('');
    } else if (refType === 'Inventory') {
      const res = await fetch('/api/properties');
      const props = await res.json();
      select.innerHTML = props.map(p => `<option value="${p.id}">${escapeHtml(p.society)} (${escapeHtml(p.configuration || 'Premium')}) (ID: ${p.id})</option>`).join('');
    } else if (refType === 'Transaction') {
      const res = await fetch('/api/commissions');
      const comms = await res.json();
      select.innerHTML = comms.map(c => `<option value="${c.id}">${escapeHtml(c.deal_name)} (ID: ${c.id})</option>`).join('');
    }
  } catch (err) {
    console.error(err);
    select.innerHTML = '<option value="">-- Failed to load --</option>';
  }
};

window.saveVaultDocument = async function() {
  const name = document.getElementById('new-vault-doc-name').value;
  const refType = document.getElementById('new-vault-doc-ref-type').value;
  const refId = document.getElementById('new-vault-doc-ref-id').value;
  const url = document.getElementById('new-vault-doc-url').value;
  
  if (!name || !refType || !refId || !url) {
    showToast('Please fill all required vault document fields.');
    return;
  }
  
  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_name: name,
        doc_url: url,
        reference_type: refType,
        reference_id: parseInt(refId),
        uploaded_by: state.systemSettings?.userName || 'System'
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Document saved successfully to vault.');
      document.getElementById('new-vault-doc-name').value = '';
      document.getElementById('new-vault-doc-url').value = '';
      document.getElementById('doc-create-block').style.display = 'none';
      loadDocuments();
    } else {
      showToast('Failed to save: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    console.error(err);
    showToast('Error registering vault document.');
  }
};

// --- RENTAL RENEWALS FEED METHOD ---
window.loadRentalRenewalsFeed = async function() {
  const container = document.getElementById('rental-renewals-feed');
  const countBadge = document.getElementById('rental-renewals-count');
  if (!container) return;
  
  try {
    const res = await fetch('/api/leads');
    const leads = await res.json();
    state.leads = leads; // Update state.leads cache
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const renewals = leads.filter(l => {
      const isRental = (l.project_type && l.project_type.toLowerCase().includes('rental')) || 
                       (l.special_tags && l.special_tags.toLowerCase().includes('rental'));
      if (!isRental || !l.rental_expiry_date) return false;
      
      const expiryDate = new Date(l.rental_expiry_date);
      if (isNaN(expiryDate.getTime())) return false;
      expiryDate.setHours(0, 0, 0, 0);
      
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    });
    
    renewals.sort((a, b) => new Date(a.rental_expiry_date) - new Date(b.rental_expiry_date));
    
    if (countBadge) {
      countBadge.innerText = `${renewals.length} renewals`;
    }
    
    if (renewals.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:15px;">No upcoming rental renewals reported.</div>`;
      return;
    }
    
    container.innerHTML = renewals.map(l => {
      const expiryDate = new Date(l.rental_expiry_date);
      expiryDate.setHours(0,0,0,0);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let alertClass = 'color: var(--green-light);';
      let statusText = `Expiring in ${diffDays} days`;
      if (diffDays < 0) {
        alertClass = 'color: var(--red); font-weight:700;';
        statusText = `Expired ${Math.abs(diffDays)} days ago`;
      } else if (diffDays === 0) {
        alertClass = 'color: var(--amber); font-weight:700;';
        statusText = 'Expires Today';
      } else if (diffDays <= 7) {
        alertClass = 'color: var(--amber);';
      }
      
      return `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px; font-size:12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div>
            <strong style="cursor:pointer; text-decoration:underline;" onclick="showLeadDetails(${l.id})">${escapeHtml(l.name)}</strong><br>
            <span style="font-size:10px; color:var(--text-muted);">Expiry: ${l.rental_expiry_date} (<span style="${alertClass}">${statusText}</span>)</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="rescheduleFollowup(${l.id})" style="padding:2px 8px; font-size:10px;"><i class="ti ti-bell-ringing"></i> Remind</button>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading rental renewals feed:', err);
  }
};


// ─── TRACK 2: OUTBOUND AI PITCH CURATOR CONTROLLERS ───

window.triggerAIPitchCurator = async function() {
  const leadId = document.getElementById('proposal-lead-select').value;
  const propertyIds = Array.from(document.querySelectorAll('input[name="proposal-prop-check"]:checked')).map(cb => parseInt(cb.value));

  if (!leadId) {
    showToast('Please select a target client lead first.');
    return;
  }
  if (propertyIds.length === 0) {
    showToast('Please select at least one property listing from checklist.');
    return;
  }

  showToast('AI Pitch Curator compiling premium copy...');
  
  try {
    const res = await fetch('/api/proposals/generate-pitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: parseInt(leadId), property_ids: propertyIds })
    });
    const result = await res.json();
    if (result.success) {
      document.getElementById('ai-pitch-textarea').value = result.pitch;
      showToast('✨ Outbound AI Pitch compiled successfully!');
    }
  } catch(e) {
    console.error(e);
    showToast('Failed to compile outbound AI pitch.');
  }
};

window.copyAIPitchToClipboard = function() {
  const pitch = document.getElementById('ai-pitch-textarea').value;
  if (!pitch) {
    showToast('Compile a pitch copy first.');
    return;
  }
  navigator.clipboard.writeText(pitch).then(() => {
    showToast('Curated pitch copied to clipboard!');
  }).catch(() => {
    showToast('Copy failed.');
  });
};

window.shareAIPitchWhatsApp = function() {
  const pitch = document.getElementById('ai-pitch-textarea').value;
  if (!pitch) {
    showToast('Compile a pitch copy first.');
    return;
  }
  const leadSelect = document.getElementById('proposal-lead-select');
  let cleanPhone = "";
  if (leadSelect && leadSelect.selectedIndex > 0) {
    const opt = leadSelect.options[leadSelect.selectedIndex];
    cleanPhone = opt.getAttribute('data-phone') || '';
  }
  if (cleanPhone) {
    if (cleanPhone.includes(',')) {
      cleanPhone = cleanPhone.split(',')[0].trim();
    }
    cleanPhone = cleanPhone.replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
      cleanPhone = '+91' + cleanPhone;
    }
  } else {
    cleanPhone = "+919945403202";
  }
  const url = `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(pitch)}`;
  window.open(url, '_blank');
  showToast('Launching WhatsApp Outbound Channel...');
};

window.shareAIPitchEmail = function() {
  const pitch = document.getElementById('ai-pitch-textarea').value;
  if (!pitch) {
    showToast('Compile a pitch copy first.');
    return;
  }
  const leadSelect = document.getElementById('proposal-lead-select');
  let email = "";
  if (leadSelect && leadSelect.selectedIndex > 0) {
    const opt = leadSelect.options[leadSelect.selectedIndex];
    email = opt.getAttribute('data-email') || '';
  }
  if (email) {
    if (email.includes(',')) {
      email = email.split(',')[0].trim();
    }
  } else {
    email = "client@gmail.com";
  }
  const mailUrl = `mailto:${encodeURIComponent(email)}?subject=Premium Property Portfolio Shortlist Selection&body=${encodeURIComponent(pitch)}`;
  window.open(mailUrl, '_blank');
  showToast('Launching Email Outbound Client Pitch...');
};


// ─── TRACK 3: EXECUTIVE OPERATIONS GTM FINANCIAL COCKPIT ───

window.loadGTMAnalyticsDashboard = async function() {
  try {
    const res = await fetch('/api/reports/analytics');
    const data = await res.json();
    if (!data.success) return;

    // 1. Hydrate stats
    document.getElementById('analytics-gross-rev').innerText = `₹${(data.financials.gross_revenue).toLocaleString('en-IN')}`;
    document.getElementById('analytics-cobroke-payouts').innerText = `₹${(data.financials.payouts).toLocaleString('en-IN')}`;
    document.getElementById('analytics-expenses').innerText = `₹${(data.financials.expenses).toLocaleString('en-IN')}`;
    document.getElementById('analytics-net-profit').innerText = `₹${(data.financials.net_profit).toLocaleString('en-IN')}`;

    // 2. Render SVG conversion funnel
    const funnelContainer = document.getElementById('analytics-funnel-container');
    if (funnelContainer) {
      const stages = data.stages;
      const totalLeads = (stages['New'] || 0) + (stages['Contacted'] || 0) + (stages['Qualified'] || 0) + (stages['Proposal'] || 0) + (stages['Won'] || 0);

      const maxW = 320;
      const getWidth = (count) => Math.max(80, Math.min(maxW, 80 + (totalLeads > 0 ? (count / totalLeads) * (maxW - 80) : 0)));
      
      const newW = getWidth(stages['New']);
      const conW = getWidth(stages['Contacted']);
      const qulW = getWidth(stages['Qualified']);
      const prpW = getWidth(stages['Proposal']);
      const wonW = getWidth(stages['Won']);

      const funnelStagesList = [
        { name: "New Enquiries", count: stages['New'] || 0, width: newW, color: "var(--gold)" },
        { name: "Contacted", count: stages['Contacted'] || 0, width: conW, color: "var(--amber)" },
        { name: "Qualified Leads", count: stages['Qualified'] || 0, width: qulW, color: "var(--blue)" },
        { name: "Proposals Curated", count: stages['Proposal'] || 0, width: prpW, color: "var(--purple)" },
        { name: "Deals Closed", count: stages['Won'] || 0, width: wonW, color: "#2ecc71" }
      ];

      let svgHtml = `<svg width="100%" height="200" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet" style="background:transparent; border-radius:8px;">`;
      
      let currentY = 10;
      const blockHeight = 30;
      const gap = 8;
      
      funnelStagesList.forEach((s, idx) => {
        const topW = s.width;
        const nextStage = funnelStagesList[idx + 1];
        const botW = nextStage ? nextStage.width : s.width * 0.8;
        
        const x1 = 200 - topW/2;
        const y1 = currentY;
        const x2 = 200 + topW/2;
        const y2 = currentY;
        const x3 = 200 + botW/2;
        const y3 = currentY + blockHeight;
        const x4 = 200 - botW/2;
        const y4 = currentY + blockHeight;
        
        svgHtml += `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}" fill="${s.color}" opacity="0.85" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
        svgHtml += `<text x="200" y="${currentY + 19}" fill="#fff" font-size="11" font-family="'Outfit', sans-serif" font-weight="700" text-anchor="middle">${s.name}: ${s.count} deals</text>`;
        
        currentY += blockHeight + gap;
      });
      
      svgHtml += `</svg>`;
      funnelContainer.innerHTML = svgHtml;
    }

    // 3. Render Location Density progress bars
    const locationContainer = document.getElementById('analytics-location-density-container');
    if (locationContainer) {
      if (data.locations.length === 0) {
        locationContainer.innerHTML = `<div style="font-size:11px; color:var(--text-muted); text-align:center;">No listings to audit local micro-market density.</div>`;
      } else {
        const maxCount = Math.max(...data.locations.map(l => l.count));
        locationContainer.innerHTML = data.locations.map(l => {
          const pct = Math.round((l.count / maxCount) * 100);
          return `
            <div class="kpi-row" style="padding: 4px 0; font-size:11.5px; border-bottom:none;">
              <span class="kpi-label" style="min-width: 130px; font-weight:600; color:#fff;">📍 ${l.location}</span>
              <div class="kpi-bar">
                <div class="bar-wrap" style="height:5px; background:rgba(255,255,255,0.05);">
                  <div class="bar-fill" style="width: ${pct}%; background: var(--gold);"></div>
                </div>
              </div>
              <span class="kpi-val" style="min-width: 45px; font-size:11px; color:var(--gold-l);">${l.count} props</span>
            </div>
          `;
        }).join('');
      }
    }

    // 4. Render Agent Leaderboard Grid
    const agentsTbody = document.getElementById('analytics-agents-table-body');
    if (agentsTbody) {
      if (data.agents.length === 0) {
        agentsTbody.innerHTML = `<tr><td colspan="5" class="empty">No sales agents in active roster.</td></tr>`;
      } else {
        agentsTbody.innerHTML = data.agents.map(a => `
          <tr>
            <td style="font-weight:700; color:#fff;">
              <div style="display:flex; align-items:center; gap:6px;">
                <i class="ti ti-user" style="color:var(--gold); margin-right:4px;"></i>
                <div>
                  <div>${a.name}</div>
                  <div style="color:var(--gold); font-size:9px; letter-spacing:0.5px; margin-top:2px;">${'⭐'.repeat(a.performance_rating || 5)}</div>
                </div>
              </div>
            </td>
            <td><span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-light); font-size:9.5px; padding:2px 6px;">${a.specialty}</span></td>
            <td style="text-align:center; font-weight:700; color:var(--gold-l);">${a.leads}</td>
            <td style="text-align:center; font-weight:700; color:var(--blue-light);">${Math.round(a.leads * 0.4)}</td>
            <td style="text-align:right; font-weight:700; color:#2ecc71;">₹${(a.volume).toLocaleString('en-IN')}</td>
          </tr>
        `).join('');
      }
    }

    // 5. Render commission splits ledger table
    const ledgerTbody = document.getElementById('analytics-ledger-table-body');
    if (ledgerTbody) {
      if (data.ledger.length === 0) {
        ledgerTbody.innerHTML = `<tr><td colspan="6" class="empty">No transaction commissions splits logged yet.</td></tr>`;
      } else {
        ledgerTbody.innerHTML = data.ledger.map(c => `
          <tr>
            <td style="font-family:monospace; color:var(--text-muted); font-size:10px;">${c.billing_invoice}</td>
            <td style="font-weight:700; color:#fff;">${c.deal_name}</td>
            <td style="text-align:right; font-weight:700;">₹${(c.deal_value).toLocaleString('en-IN')}</td>
            <td style="text-align:center; font-weight:700; color:var(--gold-l);">${c.commission_percentage}%</td>
            <td style="text-align:right; font-weight:700; color:var(--amber);">₹${(c.co_broker_payout).toLocaleString('en-IN')}</td>
            <td><span class="badge" style="background:${c.payment_status === 'Paid' ? 'rgba(46, 204, 113, 0.12)' : 'rgba(192, 57, 43, 0.12)'}; color:${c.payment_status === 'Paid' ? '#2ecc71' : '#e74c3c'}; font-weight:700; font-size:9.5px; padding:2px 6px;">${c.payment_status.toUpperCase()}</span></td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {
    console.error(e);
    showToast('Failed to load GTM financial report dashboard.');
  }
};


// ─── TRACK 4: BI-DIRECTIONAL GOOGLE SHEETS SYNC CONTROLLER ───

window.syncGoogleSheets = async function() {
  const loader = document.getElementById('sheets-sync-loader');
  if (loader) loader.classList.remove('hidden');
  
  showToast('Connecting to spreadsheet. Commencing bi-directional transfer...');

  try {
    const res = await fetch('/api/system/sync-sheets', { method: 'POST' });
    const data = await res.json();
    
    setTimeout(() => {
      if (loader) loader.classList.add('hidden');
      
      if (data.success) {
        document.getElementById('sheets-last-sync-time').innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        showToast(`🔄 ` + data.message);
        
        // Reload properties reactively
        if (typeof loadProperties === 'function') loadProperties();
      } else {
        showToast('Sheets sync failed: ' + data.error);
      }
    }, 1500);
  } catch (e) {
    console.error(e);
    if (loader) loader.classList.add('hidden');
    showToast('Google Sheets sync connection failed.');
  }
};


// System-level integrations handled inside unified navToPage

// ─── FINANCE LEDGER OS MODULES ───
async function loadFinanceLedger() {
  try {
    // Ensure commissions are loaded
    if (!state.commissions || state.commissions.length === 0) {
      const res = await fetch('/api/commissions');
      state.commissions = await res.json();
    }
    
    // Load general expenses from localStorage (persisted ledger)
    let localExpenses = [];
    try {
      const stored = localStorage.getItem('realpro_logged_expenses');
      if (stored) {
        localExpenses = JSON.parse(stored);
      } else {
        // Initial mock data if empty
        localExpenses = [
          { name: 'Meta Facebook Lead Gen Ads', value: 10000, channel: 'Meta Ads', date: '2026-05-24' },
          { name: 'Twilio / Cloud Telephony Gateway', value: 5000, channel: 'CRM License', date: '2026-05-23' }
        ];
        localStorage.setItem('realpro_logged_expenses', JSON.stringify(localExpenses));
      }
    } catch (e) {
      console.error('Error loading local expenses:', e);
    }

    // Calculate revenue
    let totalRevenue = 0;
    let splitsDue = 0;
    
    state.commissions.forEach(c => {
      const gross = c.deal_value * (c.commission_percentage / 100.0);
      if (c.payment_status === 'Paid') {
        totalRevenue += gross;
      }
      splitsDue += (c.co_broker_payout || 0);
    });

    let totalExpensesVal = localExpenses.reduce((sum, exp) => sum + parseFloat(exp.value || 0), 0);
    let netProfitVal = totalRevenue - splitsDue - totalExpensesVal;

    // Update UI elements
    const revEl = document.getElementById('fin-total-revenue');
    const splitsEl = document.getElementById('fin-splits-due');
    const expEl = document.getElementById('fin-total-expenses');
    const profitEl = document.getElementById('fin-net-profit');

    if (revEl) revEl.innerText = `₹${totalRevenue.toLocaleString('en-IN')}`;
    if (splitsEl) splitsEl.innerText = `₹${splitsDue.toLocaleString('en-IN')}`;
    if (expEl) expEl.innerText = `₹${totalExpensesVal.toLocaleString('en-IN')}`;
    if (profitEl) profitEl.innerText = `₹${netProfitVal.toLocaleString('en-IN')}`;

    // Render Expense List in the ledger card
    const listContainer = document.getElementById('expense-ledger-list');
    if (listContainer) {
      if (localExpenses.length === 0) {
        listContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px; text-align:center;">No expenses logged yet.</div>`;
      } else {
        listContainer.innerHTML = localExpenses.map((exp, idx) => `
          <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border-left: 3px solid var(--red); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:600; font-size:12.5px;">${exp.name}</div>
              <div style="font-size:11px; color:var(--text-secondary);">Channel: ${exp.channel} | ${exp.date}</div>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
              <span style="font-weight:700; color:var(--red);">₹${parseFloat(exp.value || 0).toLocaleString('en-IN')}</span>
              <button class="btn btn-ghost btn-sm" onclick="editExpense(${idx})" style="padding: 2px 6px; font-size: 14px; border:none; color:var(--gold-l); background:none; cursor:pointer;" title="Edit Expense"><i class="ti ti-edit"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="deleteExpense(${idx})" style="padding: 2px 6px; font-size: 16px; border:none; color:var(--red); background:none; cursor:pointer;" title="Delete Expense">&times;</button>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading finance ledger:', err);
  }
}

let editingExpenseIndex = -1;

window.submitLogExpense = function(event) {
  event.preventDefault();
  const name = document.getElementById('expense-name').value;
  const value = parseFloat(document.getElementById('expense-val').value || 0);
  const channel = document.getElementById('expense-channel').value;
  const today = new Date().toISOString().split('T')[0];

  if (!name || !value) return;

  try {
    const stored = localStorage.getItem('realpro_logged_expenses');
    let localExpenses = stored ? JSON.parse(stored) : [];
    
    if (editingExpenseIndex >= 0 && editingExpenseIndex < localExpenses.length) {
      localExpenses[editingExpenseIndex] = { name, value, channel, date: localExpenses[editingExpenseIndex].date || today };
      showToast('Expense updated successfully!');
      editingExpenseIndex = -1;
      document.querySelector('#form-log-expense button[type="submit"]').innerText = '💾 Log Expense';
    } else {
      localExpenses.unshift({ name, value, channel, date: today });
      showToast('Expense logged successfully!');
    }
    
    localStorage.setItem('realpro_logged_expenses', JSON.stringify(localExpenses));
    document.getElementById('form-log-expense').reset();
    loadFinanceLedger();
  } catch (e) {
    console.error('Error logging expense:', e);
  }
}

window.editExpense = function(index) {
  try {
    const stored = localStorage.getItem('realpro_logged_expenses');
    if (stored) {
      let localExpenses = JSON.parse(stored);
      const exp = localExpenses[index];
      if (exp) {
        document.getElementById('expense-name').value = exp.name;
        document.getElementById('expense-val').value = exp.value;
        document.getElementById('expense-channel').value = exp.channel;
        
        editingExpenseIndex = index;
        document.querySelector('#form-log-expense button[type="submit"]').innerText = '💾 Update Expense';
        
        // Scroll to form
        document.getElementById('form-log-expense').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  } catch (e) {
    console.error('Error editing expense:', e);
  }
}

window.deleteExpense = function(index) {
  try {
    const stored = localStorage.getItem('realpro_logged_expenses');
    if (stored) {
      let localExpenses = JSON.parse(stored);
      localExpenses.splice(index, 1);
      localStorage.setItem('realpro_logged_expenses', JSON.stringify(localExpenses));
      showToast('Expense deleted.');
      loadFinanceLedger();
    }
  } catch (e) {
    console.error('Error deleting expense:', e);
  }
}

// ─── SOCIAL MEDIA HUB MARKETING OUTBOUND CONTROLLERS ───
window.loadSocialHub = function() {
  const targetSel = document.getElementById('social-campaign-target');
  if (targetSel) {
    targetSel.value = 'Hot';
  }
}

window.dispatchWhatsAppBlast = async function() {
  const target = document.getElementById('social-campaign-target').value;
  const template = document.getElementById('social-campaign-text').value;

  if (!template) {
    showToast('Please enter sequence message template.');
    return;
  }

  showToast(`Initiating WhatsApp blast targeting: ${target} segment...`);

  try {
    // Dynamically query leads in the chosen status
    const res = await fetch('/api/leads');
    const leads = await res.json();
    
    let matchedLeads = [];
    if (target === 'All') {
      matchedLeads = leads;
    } else {
      matchedLeads = leads.filter(l => (l.status || '').toLowerCase() === target.toLowerCase());
    }

    if (matchedLeads.length === 0) {
      showToast(`No active leads matched the '${target}' status.`, 'error');
      return;
    }

    showToast(`Sending sequence to ${matchedLeads.length} leads...`);

    // Simulate sending progress with a cool progress log toast
    let count = 0;
    const interval = setInterval(() => {
      if (count < matchedLeads.length) {
        const lead = matchedLeads[count];
        console.log(`[WhatsApp Blast] Dispatched to ${lead.name} (${lead.phone})`);
        count++;
      } else {
        clearInterval(interval);
        showToast(`⚡ WhatsApp Marketing sequence successfully dispatched to ${matchedLeads.length} clients!`, 'success');
      }
    }, 200);

  } catch (err) {
    console.error('Error dispatching campaign:', err);
    showToast('Failed to retrieve active leads for sequence blast.', 'error');
  }
}

window.copyLibraryPitch = function(id) {
  const pitchTextEl = document.getElementById(`lib-pitch-${id}`);
  if (!pitchTextEl) return;

  const text = pitchTextEl.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast('✨ Premium ad copy copied to clipboard successfully!');
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showToast('Failed to copy copy to clipboard.', 'error');
  });
}




// --- LEAD FOLLOW-UP ACTION ---
window.saveLeadFollowupDate = async function() {
  const leadId = document.getElementById('detail-lead-id').value;
  const newDate = document.getElementById('detail-followup-date').value;
  if (!newDate) return;
  
  try {
    const res = await fetch('/api/leads');
    const leads = await res.json();
    const lead = leads.find(l => l.id == leadId);
    if (!lead) return;
    
    lead.next_followup = newDate;
    
    await fetch(`/api/leads/${leadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    
    showToast('Follow-up date updated.');
    loadDashboardData();
  } catch (err) {
    console.error(err);
  }
};

// --- PROPERTIES OFFERED (Proposals) ---
window.loadLeadOffered = async function(leadId) {
  const container = document.getElementById('lead-offered-container');
  try {
    const res = await fetch('/api/proposals');
    if (!res.ok) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No proposals found for this client.</div>`;
      return;
    }
    const proposals = await res.json();
    const myProposals = proposals.filter(p => p.lead_id == leadId);
    
    if (myProposals.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No properties offered yet.</div>`;
    } else {
      container.innerHTML = myProposals.map(p => `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:13px; font-weight:700; color:var(--gold-l);">${p.title}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Generated: ${p.created_at}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="window.open('/proposal/${p.token}', '_blank')"><i class="ti ti-external-link"></i> View</button>
        </div>
      `).join('');
    }
  } catch(e) {
    console.error(e);
  }
};

// --- LEAD DOCUMENTS ---
window.loadLeadDocs = async function(leadId) {
  const container = document.getElementById('lead-docs-container');
  if (!container) return;
  
  if (!state.systemSettings.showMaskedFields) {
    container.innerHTML = '<div style="font-size:12px; color:#f87171;"><i class="ti ti-lock"></i> Documents are locked in Employee Mode.</div>';
    return;
  }
  
  try {
    const res = await fetch(`/api/documents?reference_type=Lead&reference_id=${leadId}`);
    const docs = await res.json();
    if (docs.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No documents registered for this lead.</div>`;
    } else {
      container.innerHTML = docs.map((d) => `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div style="font-size:12px; font-weight:700; color:var(--text-light);"><i class="ti ti-file" style="color:var(--gold);"></i> ${escapeHtml(d.doc_name)}</div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-ghost btn-sm" onclick="window.open('${d.doc_url}', '_blank')" style="padding:2px 8px; font-size:10px;">Open URL</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red); padding:2px 8px; font-size:10px;" onclick="removeLeadDocument(${leadId}, ${d.id})"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      `).join('');
    }
  } catch(e) {
    console.error(e);
    container.innerHTML = `<div style="font-size:12px; color:var(--red);">Error loading documents.</div>`;
  }
};

window.addLeadDocument = async function() {
  const leadId = document.getElementById('detail-lead-id').value;
  const name = document.getElementById('new-lead-doc-name').value;
  const url = document.getElementById('new-lead-doc-url').value;
  if (!name || !url) return alert('Provide Name and URL');
  
  try {
    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_name: name,
        doc_url: url,
        reference_type: 'Lead',
        reference_id: parseInt(leadId),
        uploaded_by: state.systemSettings?.userName || 'System'
      })
    });
    
    document.getElementById('new-lead-doc-name').value = '';
    document.getElementById('new-lead-doc-url').value = '';
    showToast('Document link attached to vault.');
    loadLeadDocs(leadId);
  } catch (e) {
    console.error(e);
  }
};

window.removeLeadDocument = async function(leadId, docId) {
  if (!confirm('Are you sure you want to delete this document from the vault?')) return;
  try {
    await fetch(`/api/documents/${docId}`, {
      method: 'DELETE'
    });
    showToast('Document removed.');
    loadLeadDocs(leadId);
  } catch (e) {
    console.error(e);
  }
};

// --- PROJECT COMMAND CENTER ---
window.switchProjTab = function(tabId) {
  const tabs = ['overview', 'units', 'builder', 'docs', 'finance', 'leads', 'properties', 'analytics'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-proj-${t}`);
    const pane = document.getElementById(`pane-proj-${t}`);
    if (t === tabId) {
      if (btn) {
        btn.classList.add('active');
        btn.style.borderBottomColor = 'var(--gold)';
      }
      if (pane) pane.classList.remove('hidden');
      
      // Dynamic loads for specific tabs
      if (t === 'leads') {
        const projId = document.getElementById('detail-proj-id').value;
        loadProjectLeads(projId);
      }
      if (t === 'properties') {
        const projId = document.getElementById('detail-proj-id').value;
        loadProjectProperties(projId);
      }
    } else {
      if (btn) {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
      }
      if (pane) pane.classList.add('hidden');
    }
  });
};

window.showProjectDetails = async function(projectId) {
  document.getElementById('detail-proj-id').value = projectId;
  openModal('modal-project-detail');
  switchProjTab('overview');
  
  try {
    const res = await fetch('/api/projects');
    const projects = await res.json();
    const proj = projects.find(p => p.id == projectId);
    if (!proj) return;
    
    // Header
    document.getElementById('detail-proj-name').innerText = proj.project_name || 'N/A';
    document.getElementById('detail-proj-status').innerText = proj.uc_rtmi || 'Pre Launch';
    document.getElementById('detail-proj-status').className = `badge ${proj.uc_rtmi === 'RTMI' ? 'badge-primary' : 'badge-amber'}`;
    document.getElementById('detail-proj-builder').innerText = proj.builder_name || 'N/A';
    document.getElementById('detail-proj-loc').innerText = proj.location || 'N/A';
    
    // Overview Tab
    document.getElementById('det-proj-id-badge').innerText = proj.proj_id || 'N/A';
    document.getElementById('det-proj-elevation').innerText = proj.elevation || 'N/A';
    document.getElementById('det-proj-land').innerText = proj.land_parcel || 'N/A';
    document.getElementById('det-proj-tower').innerText = proj.tower || 'N/A';
    document.getElementById('det-proj-possession').innerText = proj.possession || 'N/A';
    document.getElementById('det-proj-locusp').innerText = proj.location_usp || 'N/A';
    document.getElementById('det-proj-metro').innerText = proj.metro_station || 'N/A';
    document.getElementById('det-proj-otherusp').innerText = proj.other_usp || 'N/A';

    const mapContainer = document.getElementById('det-proj-map-container');
    if (proj.google_map_url) {
      let embedUrl = proj.google_map_url.trim();
      if (embedUrl.includes('<iframe')) {
        let cleanIframe = embedUrl.replace(/width="[0-9%]+"/, 'width="100%"').replace(/height="[0-9%]+"/, 'height="100%"');
        mapContainer.innerHTML = cleanIframe;
      } else if (embedUrl.startsWith('http') || embedUrl.length > 5) {
        mapContainer.innerHTML = `<iframe width="100%" height="100%" style="border:0;" loading="lazy" allowfullscreen src="https://maps.google.com/maps?q=${encodeURIComponent(embedUrl)}&output=embed"></iframe>`;
      } else {
        mapContainer.innerHTML = 'Invalid Map URL Provided';
      }
    } else {
      mapContainer.innerHTML = 'No Map URL Provided';
    }

    // Unit Details Tab
    const unitTbody = document.getElementById('det-proj-units-tbody');
    unitTbody.innerHTML = '';
    if (proj.unit_details) {
      try {
        const units = JSON.parse(proj.unit_details);
        if(units.length) {
          unitTbody.innerHTML = units.map(u => `
            <tr>
              <td><strong>${u.config}</strong></td>
              <td>${u.area}</td>
              <td style="color:var(--green); font-weight:700;">${u.price}</td>
            </tr>
          `).join('');
        } else {
          unitTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No units configured</td></tr>`;
        }
      } catch(e) { unitTbody.innerHTML = `<tr><td colspan="3">Parse error</td></tr>`; }
    } else {
      unitTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No units configured</td></tr>`;
    }

    // Builder POC Tab
    const pocContainer = document.getElementById('det-proj-poc-container');
    pocContainer.innerHTML = '';
    if (proj.builder_poc_details) {
      try {
        const pocs = JSON.parse(proj.builder_poc_details);
        if(pocs.length) {
          pocContainer.innerHTML = pocs.map(p => `
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px;">
              <div style="font-weight:700; color:var(--gold-l); font-size:14px;">${p.name}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">${p.role}</div>
              <div style="font-size:12px;"><i class="ti ti-phone"></i> ${p.phone}</div>
              <div style="font-size:12px;"><i class="ti ti-mail"></i> ${p.email}</div>
            </div>
          `).join('');
        } else {
          pocContainer.innerHTML = `<div style="grid-column:span 2; color:var(--text-muted); font-size:12px;">No POCs registered.</div>`;
        }
      } catch(e) { pocContainer.innerHTML = 'Parse error'; }
    } else {
      pocContainer.innerHTML = `<div style="grid-column:span 2; color:var(--text-muted); font-size:12px;">No POCs registered.</div>`;
    }
    
    // Finance Tab
    document.getElementById('det-proj-subvention').innerText = proj.subvention || 'N/A';
    document.getElementById('det-proj-clp').innerText = proj.clp_due || 'N/A';
    document.getElementById('det-proj-floorrise').innerText = proj.floor_rise || 'N/A';
    
    const isEmployee = state.systemSettings.userRole === 'Employee' || !state.systemSettings.showMaskedFields;
    if (proj.cp_agreements) {
      if (isEmployee) {
        document.getElementById('det-proj-cp-link').innerHTML = '🔐 Hidden (Admin locked)';
      } else {
        document.getElementById('det-proj-cp-link').innerHTML = `<a href="${proj.cp_agreements}" target="_blank" style="color:var(--gold-l); font-weight:700;"><i class="ti ti-link"></i> View Agreement PDF</a>`;
      }
    } else {
      document.getElementById('det-proj-cp-link').innerHTML = 'No CP Agreement linked.';
    }
    document.getElementById('det-proj-finance-info').innerText = isEmployee ? '🔐 Hidden' : (proj.finance_info || 'No finance notes added.');
    
    // Analytics Tab
    document.getElementById('det-proj-analytics-info').innerText = proj.analytics_info || 'No analytics available.';
    
    // Docs Tab
    const docsGrid = document.getElementById('det-proj-docs-grid');
    docsGrid.innerHTML = '';
    
    if (isEmployee) {
      docsGrid.innerHTML = '<div style="font-size:12px; color:#f87171; grid-column:span 2;"><i class="ti ti-lock"></i> Vault documents locked in Employee Mode.</div>';
    } else {
      const docsList = [
        { key: 'brochure_link', icon: 'ti-book', label: 'E-Brochure' },
        { key: 'floor_plans', icon: 'ti-layout', label: 'Master Floor Plans' },
        { key: 'mother_docs', icon: 'ti-file-certificate', label: 'Mother & Legal Docs' },
        { key: 'kyc_docs', icon: 'ti-id', label: 'Builder KYC / RERA' },
        { key: 'photos', icon: 'ti-photo', label: 'Photos / Renderings' },
        { key: 'videos', icon: 'ti-video', label: 'Walkthrough Videos' }
      ];
      
      docsList.forEach(d => {
        const val = proj[d.key];
        if (val) {
          docsGrid.innerHTML += `
            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:12px; font-weight:700; color:var(--text-light);"><i class="ti ${d.icon}" style="color:var(--gold);"></i> ${d.label}</div>
              <button class="btn btn-ghost btn-sm" onclick="window.open('${val}', '_blank')" style="padding:2px 8px; font-size:10px;">View</button>
            </div>
          `;
        }
      });
      if (docsGrid.innerHTML === '') {
         docsGrid.innerHTML = '<div style="font-size:12px; color:var(--text-muted); grid-column:span 2;">No documents available in vault.</div>';
      }
    }
    
  } catch(e) {
    console.error(e);
  }
};

window.loadProjectProperties = async function(projId) {
  const tbody = document.getElementById('det-proj-properties-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading linked properties...</td></tr>';
  try {
    const res = await fetch('/api/properties');
    const props = await res.json();
    const filtered = props.filter(p => p.project_id == projId);
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No resale/rental listings linked to this project yet.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(p => {
      const isEmployee = state.systemSettings.userRole === 'Employee' || !state.systemSettings.showMaskedFields;
      const ownerContact = isEmployee ? '🔐 Hidden (Admin locked)' : `${p.owner_name || 'N/A'} (${p.owner_phone || 'N/A'})`;
      return `
        <tr>
          <td><strong>${p.prop_id || ('#' + p.id)}</strong></td>
          <td><span class="badge badge-primary">${p.available_for || p.property_type || 'Sale'}</span></td>
          <td>${p.society || 'N/A'}${p.unit_no ? ' / ' + p.unit_no : ''}</td>
          <td>${p.configuration || 'N/A'}</td>
          <td style="color:var(--green); font-weight:700;">${p.price_raw || p.price || 'N/A'}</td>
          <td>${ownerContact}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); closeModal('modal-project-detail'); window.editFullProperty(${p.id})"><i class="ti ti-edit"></i> View/Edit</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--red);">Error loading properties.</td></tr>';
  }
};

window.printProjectCard = function() {
  const projectId = document.getElementById('detail-proj-id')?.value;
  if (!projectId) {
    showToast('No project selected to print.', true);
    return;
  }
  const p = state.projects.find(x => x.id == projectId);
  if (!p) {
    showToast('Project details not found.', true);
    return;
  }

  // Parse unit details JSON safely
  let unitRowsHTML = '';
  if (p.unit_details) {
    try {
      const units = JSON.parse(p.unit_details);
      if (units && units.length > 0) {
        unitRowsHTML = units.map(u => `
          <tr>
            <td><strong>${u.config || 'N/A'}</strong></td>
            <td>${u.area || 'N/A'}</td>
            <td style="color:#27ae60; font-weight:700;">${u.price || 'N/A'}</td>
          </tr>
        `).join('');
      } else {
        unitRowsHTML = `<tr><td colspan="3" style="text-align:center; color:#888;">No units configured.</td></tr>`;
      }
    } catch(err) {
      unitRowsHTML = `<tr><td colspan="3" style="text-align:center; color:#e74c3c;">Error loading unit configurations.</td></tr>`;
    }
  } else {
    unitRowsHTML = `<tr><td colspan="3" style="text-align:center; color:#888;">No units configured.</td></tr>`;
  }

  // Construct specifications table
  const specs = [
    { label: 'Builder', value: p.builder_name || 'N/A' },
    { label: 'Project ID', value: p.proj_id || ('#' + p.id) },
    { label: 'Location', value: p.location || 'N/A' },
    { label: 'Land Parcel', value: p.land_parcel || 'N/A' },
    { label: 'Total Towers / Blocks', value: p.tower || 'N/A' },
    { label: 'Elevation', value: p.elevation || 'N/A' },
    { label: 'Project Status', value: p.uc_rtmi || 'N/A' },
    { label: 'Expected Possession', value: p.possession || 'N/A' }
  ];

  if (p.zone) specs.push({ label: 'Micro-market Zone', value: p.zone });
  if (p.onboarded_year) specs.push({ label: 'Onboarded Year', value: p.onboarded_year });
  if (p.subvention) specs.push({ label: 'Subvention Scheme', value: p.subvention });
  if (p.clp_due) specs.push({ label: 'CLP Milestones Due', value: p.clp_due });
  if (p.floor_rise) specs.push({ label: 'Floor Rise Details', value: p.floor_rise });

  const specHTML = specs.map(s => `
    <div class="spec-item">
      <span class="spec-label">${s.label}</span>
      <span class="spec-value">${s.value}</span>
    </div>
  `).join('');

  // Handle USPs
  let uspHTML = '';
  if (p.location_usp || p.metro_station || p.other_usp) {
    uspHTML = `
      <div>
        <div class="section-title">Connectivity & Key Features</div>
        <div class="description-box" style="background:#fffaf0; border-color:#fbeec1;">
          ${p.location_usp ? `<div style="margin-bottom:8px;"><strong>📍 Location Advantages:</strong> ${p.location_usp}</div>` : ''}
          ${p.metro_station ? `<div style="margin-bottom:8px;"><strong>🚇 Metro Proximity:</strong> ${p.metro_station}</div>` : ''}
          ${p.other_usp ? `<div><strong>🌟 Unique Selling Points:</strong> ${p.other_usp}</div>` : ''}
        </div>
      </div>
    `;
  }

  // Handle Map Link
  const mapBtnHTML = p.google_map_url ? `
    <div class="map-btn-container">
      <a href="${p.google_map_url}" target="_blank" class="map-btn">
        📍 Open Project Map Location
      </a>
    </div>
  ` : '';

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Project Presentation - ${p.project_name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', sans-serif;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            background-color: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
          }
          .luxury-header {
            border-bottom: 2px solid #d4af37;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .brand-title {
            font-family: 'Playfair Display', serif;
            color: #1a1a1a;
            margin: 0;
            font-size: 32px;
            letter-spacing: 1.5px;
            font-weight: 700;
          }
          .brand-subtitle {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #d4af37;
            margin-top: 5px;
            font-weight: 600;
          }
          .contact-info {
            text-align: right;
            font-size: 11.5px;
            line-height: 1.6;
            color: #555;
          }
          .project-title-section {
            margin-bottom: 25px;
          }
          .proj-id-badge {
            display: inline-block;
            background: rgba(212, 175, 55, 0.1);
            border: 1px solid #d4af37;
            color: #b8860b;
            font-size: 10px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .project-name {
            font-family: 'Playfair Display', serif;
            font-size: 28px;
            color: #111;
            margin: 0 0 5px 0;
            font-weight: 700;
          }
          .project-builder {
            font-size: 15px;
            color: #d4af37;
            font-weight: 600;
            margin-bottom: 5px;
          }
          .project-location {
            font-size: 14px;
            color: #666;
          }
          .section-title {
            font-family: 'Playfair Display', serif;
            font-size: 18px;
            color: #1a1a1a;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
            margin-top: 35px;
            margin-bottom: 15px;
            font-weight: 700;
          }
          .spec-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px 30px;
          }
          .spec-item {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px dashed #e5e5e5;
            padding-bottom: 6px;
            font-size: 13.5px;
          }
          .spec-label {
            color: #666;
            font-weight: 500;
          }
          .spec-value {
            color: #111;
            font-weight: 600;
          }
          .unit-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 13.5px;
          }
          .unit-table th, .unit-table td {
            text-align: left;
            padding: 10px 15px;
            border-bottom: 1px solid #eee;
          }
          .unit-table th {
            background-color: #fcf8f0;
            color: #b8860b;
            font-weight: 700;
            border-top: 1px solid #fbeec1;
            border-bottom: 2px solid #fbeec1;
          }
          .description-box {
            font-size: 13.5px;
            line-height: 1.7;
            color: #444;
            background: #fafafa;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #f0f0f0;
            margin-top: 15px;
          }
          .map-btn-container {
            margin-top: 25px;
            text-align: center;
          }
          .map-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #d4af37;
            color: #fff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13.5px;
            transition: background 0.2s;
          }
          .luxury-footer {
            margin-top: 50px;
            border-top: 1px solid #d4af37;
            padding-top: 20px;
            text-align: center;
            font-size: 11px;
            color: #888;
            letter-spacing: 0.5px;
          }
          @media print {
            body {
              background: #fff;
            }
            .map-btn {
              background: #d4af37 !important;
              color: #fff !important;
            }
            .print-container {
              padding: 20px;
            }
            .map-btn-container {
              display: none;
            }
            .unit-table th {
              background-color: #fcf8f0 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <div class="luxury-header">
            <div>
              <div class="brand-title">SUBH HOMES</div>
              <div class="brand-subtitle">Premium Real Estate Advisory</div>
            </div>
            <div class="contact-info">
              <strong>Vasu Jain</strong><br>
              📞 +91 98200 12345<br>
              ✉️ info@subhhomes.com<br>
              🌐 www.subhhomes.com
            </div>
          </div>

          <div class="project-title-section">
            <span class="proj-id-badge">ID: ${p.proj_id || ('#' + p.id)}</span>
            <div class="project-builder">${p.builder_name}</div>
            <h1 class="project-name">${p.project_name}</h1>
            <div class="project-location">📍 ${p.location}</div>
          </div>

          <div>
            <div class="section-title">Project Specifications</div>
            <div class="spec-grid">
              ${specHTML}
            </div>
          </div>

          <div>
            <div class="section-title">Configured Unit Types & Pricing</div>
            <table class="unit-table">
              <thead>
                <tr>
                  <th>Typology</th>
                  <th>Saleable Area</th>
                  <th>Price range</th>
                </tr>
              </thead>
              <tbody>
                ${unitRowsHTML}
              </tbody>
            </table>
          </div>

          ${uspHTML}
          ${mapBtnHTML}

          <div class="luxury-footer">
            Subh Homes • Premium Real Estate Advisory • Vasu Jain +91 98200 12345 • info@subhhomes.com
          </div>
        </div>
        <script>
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

window.loadProjectLeads = async function(projectId) {
  const container = document.getElementById('det-proj-leads-container');
  const assignedContainer = document.getElementById('det-proj-assigned-leads-container');
  const select = document.getElementById('assign-lead-select');
  if (!container || !assignedContainer || !select) return;
  
  try {
    const [leadsRes, projRes] = await Promise.all([
      fetch('/api/leads'), fetch('/api/projects')
    ]);
    const leads = await leadsRes.json();
    const projects = await projRes.json();
    const proj = projects.find(p => p.id == projectId);
    if (!proj) return;
    
    // 1. Populate the select element for lead assignment (exclude already assigned)
    const unassignedLeads = leads.filter(l => l.project_id != projectId);
    select.innerHTML = '<option value="">-- Select Lead to Assign --</option>' + 
      unassignedLeads.map(l => `<option value="${l.id}">${l.name} (${l.phone || 'No Phone'})</option>`).join('');
      
    // 2. Render manually assigned leads
    const assignedLeads = leads.filter(l => l.project_id == projectId);
    if (assignedLeads.length === 0) {
      assignedContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No leads manually assigned to this project.</div>`;
    } else {
      assignedContainer.innerHTML = assignedLeads.map(l => `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:13px; font-weight:700; color:var(--gold-l);">${l.name} <span class="badge badge-primary" style="font-size:9px;">Assigned</span></div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Phone: ${l.phone || 'N/A'} | Email: ${l.email || 'N/A'}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="showLeadDetails(${l.id})" style="padding:4px 10px;">Profile</button>
            <button class="btn btn-d btn-sm" onclick="removeLeadAssignment(${l.id}, ${projectId})" style="padding:4px 10px; color:var(--red);">Unassign</button>
          </div>
        </div>
      `).join('');
    }

    // 3. Render auto-matched leads (BHK match, exclude manually assigned)
    const matches = leads.filter(l => {
      if (l.project_id == projectId) return false;
      if (!l.config_bhk || !proj.configuration) return false;
      const b1 = l.config_bhk.charAt(0);
      return proj.configuration.includes(b1);
    });
    
    if (matches.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No interested leads found for this configuration currently.</div>`;
      return;
    }
    
    container.innerHTML = matches.map(l => `
      <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:700; color:var(--gold-l);">${l.name} <span class="badge" style="font-size:9px; background:rgba(0,0,0,0.4);">${l.status}</span></div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">BHK: ${l.config_bhk || 'N/A'} | Budget: ₹${l.budget_max ? (l.budget_max/100000).toFixed(0) + 'L' : 'N/A'}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="showLeadDetails(${l.id})" style="padding:4px 10px;">Profile</button>
      </div>
    `).join('');
  } catch(e) {
    console.error(e);
  }
};

window.submitLeadAssignment = async function() {
  const select = document.getElementById('assign-lead-select');
  const leadId = select.value;
  const projectId = document.getElementById('detail-proj-id').value;
  if (!leadId) {
    showToast('Please select a lead first.', 'error');
    return;
  }
  try {
    const res = await fetch(`/api/leads/${leadId}/assign-project`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ project_id: parseInt(projectId) })
    });
    if (res.ok) {
      showToast('Lead successfully assigned to project!');
      loadProjectLeads(projectId);
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to assign lead.', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('Network error during lead assignment.', 'error');
  }
};

window.removeLeadAssignment = async function(leadId, projectId) {
  if (!confirm('Are you sure you want to unassign this lead?')) return;
  try {
    const res = await fetch(`/api/leads/${leadId}/assign-project`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ project_id: null })
    });
    if (res.ok) {
      showToast('Lead unassigned from project.');
      loadProjectLeads(projectId);
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to unassign lead.', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('Network error during lead unassignment.', 'error');
  }
};

window.uploadFileToField = async function(event, targetId) {
  const file = event.target.files[0];
  if (!file) return;
  
  const statusEl = document.getElementById(targetId + '-status');
  if (statusEl) statusEl.innerText = 'Uploading...';
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      const input = document.getElementById(targetId);
      if (input) {
        input.value = window.location.origin + data.filePath;
        input.dispatchEvent(new Event('input'));
      }
      showToast('File uploaded successfully!');
      if (statusEl) statusEl.innerText = 'Uploaded!';
    } else {
      const err = await res.json();
      showToast(err.error || 'Upload failed', 'error');
      if (statusEl) statusEl.innerText = 'Failed';
    }
  } catch (e) {
    console.error(e);
    showToast('Network error during file upload', 'error');
    if (statusEl) statusEl.innerText = 'Error';
  }
};

// ─── SMART LISTS FILTER LOGIC ───
window.filterSmartList = async function(filterId) {
  // First, map the filter to a specific page
  const propertyFilters = ['all_properties', 'avail_units', 'comm_listings', 'rental_listings'];
  const projectFilters = ['all_projects', 'uc_projects', 'rtmi_projects'];
  const leadFilters = ['all_leads', 'hot_leads', 'missed_followups', 'missed_calls', 'not_interested', 'converted', 'fb_leads', 'budget_2cr', 'rental_renewals', 'warm_no_contact', 'commercial_inq'];

  document.querySelectorAll('.nav-sub-item').forEach(el => el.classList.remove('active'));
  const clickedSubItem = Array.from(document.querySelectorAll('.nav-sub-item')).find(el => el.getAttribute('onclick')?.includes(`'${filterId}'`));

  if (projectFilters.includes(filterId)) {
    window.navToPage('projects');
  } else if (propertyFilters.includes(filterId)) {
    window.navToPage('inventory');
    if (filterId === 'comm_listings') {
      document.getElementById('tab-commercial').click();
    } else if (filterId === 'rental_listings') {
      document.getElementById('tab-rental').click();
    } else {
      document.getElementById('tab-resale').click();
    }
  } else if (leadFilters.includes(filterId)) {
    window.navToPage('pipeline');
    try {
      const res = await fetch('/api/leads');
      let leads = await res.json();
      
      const today = new Date().toISOString().split('T')[0];
      
      // Apply filters
      leads = leads.filter(l => l.stage !== 'Raw Lead');
      if (filterId === 'hot_leads') leads = leads.filter(l => l.status === 'Hot');
      if (filterId === 'missed_followups') leads = leads.filter(l => l.next_followup && l.next_followup < today);
      if (filterId === 'missed_calls') leads = leads.filter(l => l.touchpoint === 'Calls' && !l.stage); 
      if (filterId === 'not_interested') leads = leads.filter(l => l.stage === 'Lost' || l.status === 'Cold');
      if (filterId === 'converted') leads = leads.filter(l => l.stage === 'Won');
      if (filterId === 'fb_leads') leads = leads.filter(l => l.source === 'Meta Ads');
      if (filterId === 'budget_2cr') leads = leads.filter(l => l.budget_max >= 20000000);
      if (filterId === 'rental_renewals') {
        const todayD = new Date();
        todayD.setHours(0,0,0,0);
        leads = leads.filter(l => {
          const isRental = (l.project_type && l.project_type.toLowerCase().includes('rental')) || 
                           (l.special_tags && l.special_tags.toLowerCase().includes('rental'));
          if (!isRental || !l.rental_expiry_date) return false;
          
          const expiryDate = new Date(l.rental_expiry_date);
          if (isNaN(expiryDate.getTime())) return false;
          expiryDate.setHours(0, 0, 0, 0);
          
          const diffTime = expiryDate.getTime() - todayD.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 30;
        });
      }
      if (filterId === 'warm_no_contact') leads = leads.filter(l => l.status === 'Warm' && (!l.last_contact_date || l.last_contact_date < new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]));
      if (filterId === 'commercial_inq') leads = leads.filter(l => l.project_type === 'Commercial');

      state.leads = leads;
      
      setTimeout(() => {
        renderPipeline(leads);
      }, 300);

    } catch (err) {
      console.error('Error filtering leads:', err);
    }
  }

  // Restore the active state on the smart list UI elements since navToPage clears them
  if (clickedSubItem) {
    clickedSubItem.classList.add('active');
    const parentDetails = clickedSubItem.closest('details');
    if (parentDetails) {
      const summary = parentDetails.querySelector('summary.nav-item');
      if (summary) summary.classList.add('active');
    }
    const outerDetails = clickedSubItem.closest('nav > details');
    if (outerDetails) {
      const summary = outerDetails.querySelector('summary.nav-item');
      if (summary) summary.classList.add('active');
    }
  }
};

window.saveNewSOP = function() {
  const title = document.getElementById('new-sop-title').value;
  const stepsText = document.getElementById('new-sop-steps').value;
  
  if(!title || !stepsText) {
    showToast('Please fill out the SOP Title and Steps', 'error');
    return;
  }
  
  const steps = stepsText.split('\n').filter(s => s.trim() !== '');
  const sopId = 'sop' + Date.now();
  
  let html = `
    <div class="accord-hd" onclick="toggleAccordion('${sopId}')" style="margin-top:6px;">
      <span>${title}</span><i class="ti ti-chevron-down"></i>
    </div>
    <div class="accord-body" id="${sopId}">
  `;
  
  steps.forEach((step, idx) => {
    html += `<div class="step-row"><div class="step-num" style="background:var(--blue-light)">${idx+1}</div><div>${step}</div></div>`;
  });
  
  html += `</div>`;
  
  const createBlock = document.getElementById('sop-create-block');
  createBlock.insertAdjacentHTML('beforebegin', html);
  
  document.getElementById('new-sop-title').value = '';
  document.getElementById('new-sop-steps').value = '';
  createBlock.style.display = 'none';
  showToast('New SOP Added successfully!');
};

window.generateVisualInvoice = function() {
  const invNumber = document.getElementById('inv-number').value || `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`;
  const invDate = document.getElementById('inv-date').value || new Date().toISOString().split('T')[0];
  const client = document.getElementById('inv-client').value || 'Unknown Client';
  const address = document.getElementById('inv-address').value || 'Address not provided';
  const gstin = document.getElementById('inv-gstin').value || 'N/A';
  const project = document.getElementById('inv-project').value || 'Real Estate Services';
  const desc = document.getElementById('inv-desc').value || 'Professional Brokerage Services';
  
  const val = parseFloat(document.getElementById('inv-value').value) || 0;
  const comm = parseFloat(document.getElementById('inv-comm').value) || 0;
  const amt = (val * (comm / 100));
  
  document.getElementById('inv-number-disp').innerText = invNumber;
  document.getElementById('inv-date-disp').innerText = `Date: ${invDate}`;
  document.getElementById('inv-client-disp').innerText = client;
  document.getElementById('inv-address-disp').innerText = address;
  document.getElementById('inv-gstin-disp').innerText = `GSTIN: ${gstin}`;
  document.getElementById('inv-desc-disp').innerText = desc;
  document.getElementById('inv-project-disp').innerText = project;
  
  document.getElementById('inv-amt-disp').innerText = '₹' + amt.toLocaleString('en-IN');
  document.getElementById('inv-total-disp').innerText = '₹' + amt.toLocaleString('en-IN');
  
  const pane = document.getElementById('invoice-preview-pane');
  pane.style.display = 'block';
  
  showToast('Invoice Generated!');
};

window.assignLeadToProject = function() {
  switchProjTab('leads');
  showToast('Check the "Interested Leads" tab to view auto-matched leads based on configuration and budget.');
};

window.convertLeadToDeal = function() {
  const leadId = document.getElementById('detail-lead-id').value;
  const name = document.getElementById('detail-lead-name').innerText;
  closeModal('modal-lead-detail');
  showAddCommissionModal();
  document.getElementById('deal-name').value = `Deal: ${name}`;
  showToast('Lead imported into new transaction pipeline.');
};

window.loadLeadTimeline = async function(leadId) {
  const container = document.getElementById('lead-timeline-container');
  if (!container) return;
  try {
    const resTimeline = await fetch('/api/leads/' + leadId + '/timeline');
    const events = resTimeline.ok ? await resTimeline.json() : [];
    
    if (events.length === 0) {
      container.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px;">No timeline events logged yet.</div>';
      return;
    }
    
    container.innerHTML = events.map(e => {
      let icon = '📢';
      let typeStr = e.event_type || 'SYSTEM';
      
      if (typeStr === 'WEBHOOK') icon = '📡';
      else if (typeStr === 'CALL_LOG' || typeStr === 'Phone Call' || typeStr === 'Calls' || typeStr === 'Telephony Call') icon = '📞';
      else if (typeStr === 'CHAT_MESSAGE' || typeStr === 'WhatsApp' || typeStr === 'WhatsApp Message') icon = '💬';
      else if (typeStr === 'STAGE_CHANGE') icon = '💎';
      else if (typeStr === 'Site Visit') icon = '🏡';
      else if (typeStr === 'Meeting') icon = '🤝';
      else if (typeStr === 'Proposal Sent') icon = '📤';
      else if (typeStr === 'Email' || typeStr === 'Outbound Email') icon = '✉️';
      else if (typeStr === 'Deal Closed') icon = '🎉';
      
      return `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px 12px; border-radius:6px; font-size:12px; display:flex; gap:12px; align-items:flex-start; margin-bottom:8px;">
          <div style="background:var(--gold); color:black; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0;">
            <span>${icon}</span>
          </div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
              <span style="font-weight:700; color:var(--gold-l);">${typeStr}</span>
              <span style="font-size:10px; color:var(--text-muted);">${new Date(e.created_at || e.timestamp || Date.now()).toLocaleString()}</span>
            </div>
            <div style="color:var(--text-light); margin-top:4px; line-height:1.4;">${e.event_description || e.description || ''}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) { 
    console.error(e); 
    container.innerHTML = '<div style="font-size:12px; color:var(--red); text-align:center; padding:20px;">Failed to load journey timeline.</div>';
  }
};

window.submitLeadInteraction = async function(e) {
  e.preventDefault();
  const leadId = document.getElementById('detail-lead-id').value;
  const type = document.getElementById('log-inter-type').value;
  const desc = document.getElementById('log-inter-notes').value;
  
  try {
    await fetch('/api/leads/' + leadId + '/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, description: desc })
    });
    document.getElementById('form-lead-interaction').reset();
    showToast('Interaction logged successfully.');
    loadLeadTimeline(leadId);
    showLeadDetails(leadId); // Refresh score
  } catch(e) { console.error(e); }
};

// NOTE: window.loadLeadMatches is defined and handled above with the unified AI Proximity Match calculations.

window.markLeadInterest = async function(leadId, propId, status) {
  try {
    await fetch('/api/leads/' + leadId + '/interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propId, status })
    });
    showToast('Property marked as ' + status);
    loadLeadMatches(leadId);
    showLeadDetails(leadId); // Refresh score
  } catch(e) { console.error(e); }
};

window.addLeadDocument = async function() {
  const leadId = document.getElementById('detail-lead-id').value;
  const name = document.getElementById('new-lead-doc-name').value;
  const url = document.getElementById('new-lead-doc-url').value;
  if (!name || !url) return showToast('Provide both doc name and URL');
  
  const lead = state.leads.find(l => l.id == leadId);
  if(!lead) return;
  
  let docs = [];
  try { docs = JSON.parse(lead.documents || '[]'); } catch(e){}
  docs.push({ name, url });
  
  try {
    await fetch('/api/leads/' + leadId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, documents: docs })
    });
    document.getElementById('new-lead-doc-name').value = '';
    document.getElementById('new-lead-doc-url').value = '';
    showToast('Document link added!');
    showLeadDetails(leadId);
  } catch(e) { console.error(e); }
};

window.renderLeadDocs = function(lead) {
  loadLeadDocs(lead.id);
};

// ----------------------------------------------------
// 21. TAX INVOICING accounts ledger, printing and words engine
// ----------------------------------------------------
window.syncCommPercentToAmount = function() {
  const value = parseFloat(document.getElementById('comm-value').value || 0);
  const percent = parseFloat(document.getElementById('comm-percent').value || 0);
  if (value) {
    document.getElementById('comm-amount').value = Math.round(value * (percent / 100));
    if (typeof window.autoCalculateCoBrokerPayout === 'function') window.autoCalculateCoBrokerPayout();
  }
};

window.syncCommAmountToPercent = function() {
  const value = parseFloat(document.getElementById('comm-value').value || 0);
  const amount = parseFloat(document.getElementById('comm-amount').value || 0);
  if (value) {
    document.getElementById('comm-percent').value = ((amount / value) * 100).toFixed(2);
    if (typeof window.autoCalculateCoBrokerPayout === 'function') window.autoCalculateCoBrokerPayout();
  }
};

window.autoCalculateCoBrokerPayout = function() {
  const assocId = document.getElementById('comm-associate-id').value;
  if (!assocId) {
    return; // Don't wipe manual entry if they unset the co-brokerage dropdown
  }
  const assoc = state.associates.find(a => a.id == assocId);
  if (!assoc) return;
  const splitPct = parseFloat(assoc.co_brokerage_share || 0);
  const commAmount = parseFloat(document.getElementById('comm-amount').value || 0);
  
  if (commAmount && splitPct) {
    document.getElementById('comm-payout').value = Math.round(commAmount * (splitPct / 100));
  } else {
    document.getElementById('comm-payout').value = 0;
  }
};

window.onInvoiceItemPresetChange = function(select) {
  const row = select.closest('.inv-item-row');
  if (!row) return;
  const descInput = row.querySelector('.inv-item-desc');
  if (!descInput) return;
  
  const val = select.value;
  if (val && val !== 'Other') {
    const project = document.getElementById('inv-project').value.trim();
    if (project) {
      descInput.value = `${val} for property at ${project}`;
    } else {
      descInput.value = val;
    }
  } else if (val === 'Other') {
    descInput.value = '';
    descInput.focus();
  }
};

window.addInvoiceItemRow = function() {
  const container = document.getElementById('inv-items-container');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'inv-item-row';
  row.style = 'display:grid; grid-template-columns: 1.5fr 2fr 1.2fr auto; gap:8px; align-items:center; margin-bottom: 8px;';
  row.innerHTML = `
    <select class="form-select inv-item-preset" onchange="onInvoiceItemPresetChange(this)" style="font-size:12px; padding: 6px 10px; background: var(--bg-card); color: var(--text-light); border: 1px solid var(--border); border-radius: var(--radius-md);">
      <option value="">Select Service...</option>
      <option value="Real Estate Consultancy Fees">Consultancy Fees</option>
      <option value="Brokerage Commission - Residential Sale">Residential Sale Commission</option>
      <option value="Brokerage Commission - Commercial Sale">Commercial Sale Commission</option>
      <option value="Rental Brokerage & Facilitation Fees">Rental Brokerage Fees</option>
      <option value="Agreement & Documentation Charges">Agreement Charges</option>
      <option value="Property Registration Support Fees">Registration Support</option>
      <option value="Legal Due Diligence Verification">Legal Verification</option>
      <option value="Other" selected>Other / Custom Description</option>
    </select>
    <input type="text" class="form-input inv-item-desc" placeholder="Service description..." required style="font-size:12px; padding: 6px 10px;">
    <input type="number" class="form-input inv-item-amount" placeholder="Amount" value="0" oninput="recalculateInvoiceAmounts()" required style="font-size:12px; padding: 6px 10px;">
    <button class="btn btn-ghost btn-sm" onclick="removeInvoiceItemRow(this)" type="button" style="color:var(--red); padding: 6px; border:1px solid var(--border);"><i class="ti ti-trash"></i></button>
  `;
  container.appendChild(row);
  recalculateInvoiceAmounts();
};

window.removeInvoiceItemRow = function(btn) {
  const row = btn.closest('.inv-item-row');
  if (row) {
    const container = document.getElementById('inv-items-container');
    if (container.querySelectorAll('.inv-item-row').length > 1) {
      row.remove();
      recalculateInvoiceAmounts();
    } else {
      showToast('At least one service item is required.', 'warning');
    }
  }
};

window.recalculateInvoiceAmounts = function() {
  let val = 0;
  const rows = document.querySelectorAll('.inv-item-row');
  rows.forEach(row => {
    const amt = parseFloat(row.querySelector('.inv-item-amount').value || 0);
    val += amt;
  });

  const cgst = Math.round(val * 0.09);
  const sgst = Math.round(val * 0.09);
  const total = val + cgst + sgst;

  const valueInput = document.getElementById('inv-value');
  if (valueInput) valueInput.value = val;

  const cgstInput = document.getElementById('inv-cgst');
  if (cgstInput) cgstInput.value = cgst;

  const sgstInput = document.getElementById('inv-sgst');
  if (sgstInput) sgstInput.value = sgst;

  const totalInput = document.getElementById('inv-total-calculated');
  if (totalInput) totalInput.value = total;

  const wordsEl = document.getElementById('inv-value-words');
  if (wordsEl) {
    wordsEl.innerText = '💬 ' + window.priceToWords(total);
  }
};

window.applyInvoicePreset = function(preset) {
  if (!preset) return;
  const project = document.getElementById('inv-project').value.trim() || '[Property Location]';
  const firstDesc = document.querySelector('.inv-item-desc');
  if (firstDesc) {
    firstDesc.value = `Service Charges for ${preset} at ${project}`;
  }
};

window.generateInvoiceFromForm = async function() {
  const client = document.getElementById('inv-client').value;
  if (!client) {
    showToast('Client Name is required.');
    return;
  }

  // Retrieve and parse all active Service Item Rows
  const itemRows = document.querySelectorAll('.inv-item-row');
  const items = [];
  itemRows.forEach(row => {
    const desc = row.querySelector('.inv-item-desc').value.trim();
    const amt = parseFloat(row.querySelector('.inv-item-amount').value || 0);
    if (desc && amt > 0) {
      items.push({ description: desc, amount: amt });
    }
  });

  if (items.length === 0) {
    showToast('At least one valid service item with an amount greater than 0 is required.');
    return;
  }

  const valRaw = document.getElementById('inv-value').value;
  const val = parseFloat(valRaw || 0);
  const cgst = parseFloat(document.getElementById('inv-cgst').value || 0);
  const sgst = parseFloat(document.getElementById('inv-sgst').value || 0);
  const total = parseFloat(document.getElementById('inv-total-calculated').value || 0);

  // Robust Auto-sequence unique sequence calculation starting at 331
  let count = 331;
  const clientFull = client.trim().toUpperCase();
  let invoiceNo = (document.getElementById('inv-number').value || '').trim();
  
  try {
    const resList = await fetch('/api/invoices');
    const invoices = await resList.json();
    count = invoices.length + 331;
    
    if (!invoiceNo) {
      let candidate = `RE INT - ${count} / ${clientFull}`;
      while (invoices.some(inv => inv.invoice_no === candidate)) {
        count++;
        candidate = `RE INT - ${count} / ${clientFull}`;
      }
      invoiceNo = candidate;
    } else {
      if (invoices.some(inv => inv.invoice_no === invoiceNo)) {
        showToast('⚠️ Warning: Duplicate Invoice Number! Added unique suffix to register successfully.', 'warning');
        invoiceNo = `${invoiceNo}-${Date.now().toString().slice(-4)}`;
      }
    }
  } catch (e) {
    if (!invoiceNo) {
      invoiceNo = `RE INT - ${Date.now().toString().slice(-4)} / ${clientFull}`;
    }
  }
  
  // Set fallback dates
  const invoiceDate = document.getElementById('inv-date').value || new Date().toISOString().split('T')[0];

  const bodyData = {
    invoice_no: invoiceNo,
    invoice_date: invoiceDate,
    client_name: client,
    client_gstin: document.getElementById('inv-gstin').value || '',
    client_address: document.getElementById('inv-billto').value || 'Bengaluru, India',
    project_deal: document.getElementById('inv-project').value || '',
    description: items.map(i => i.description).join('; '),
    amount: val,
    cgst: cgst,
    sgst: sgst,
    total: total,
    payment_status: 'Pending',
    broker_name: state.systemSettings?.userName || 'Ms Vasu Jain',
    broker_address: state.systemSettings?.coAddress || '300, 2nd Floor, Kamraj Road, Bengaluru - 560 042',
    broker_email: state.systemSettings?.coEmail || 'vasujain@subhhomes.com',
    broker_phone: state.systemSettings?.coPhone || '+91 9964985128',
    broker_rera: document.getElementById('inv-rera').value || state.systemSettings?.coRera || 'AG/KN/170731/000296',
    broker_gstin: document.getElementById('inv-broker-gst').value || state.systemSettings?.coGstin || '29AMSPK0486E1ZO',
    bank_name: state.systemSettings?.bankName || 'SUBH HOMES',
    bank_account: state.systemSettings?.bankAccount || '10060214087',
    bank_ifsc: state.systemSettings?.bankIfsc || 'IDFB0080157',
    bank_account_type: state.systemSettings?.bankType || 'CURRENT ACCOUNT',
    bank_branch: state.systemSettings?.bankBranch || 'IDFC FIRST BANK, KALYAN NAGAR BRANCH',
    terms: state.systemSettings?.invoiceTerms || '1. Please make the payment on or before registration\n2. Service Charges for Seller is 2% plus Gst. For Buyer is 1% plus Gst. For UC properties no Service Charge. Rental Property 1 Month\'s rent plus Gst\n3. Subject to Bangalore Jurisdiction.',
    items: JSON.stringify(items)
  };

  try {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Invoice generated and saved successfully.');
      document.getElementById('inv-number').value = '';
      document.getElementById('inv-client').value = '';
      document.getElementById('inv-billto').value = '';
      document.getElementById('inv-gstin').value = '';
      document.getElementById('inv-project').value = '';
      
      // Pre-hydrate state.invoices locally to ensure immediate eye-view availability
      const newInvoiceObject = {
        id: data.id,
        ...bodyData
      };
      if (!state.invoices) state.invoices = [];
      state.invoices.unshift(newInvoiceObject);

      await loadInvoices();
      window.showInvoicePreview(data.id);
      openModal('modal-invoice-popup');
    } else {
      showToast('Error: ' + data.error);
    }
  } catch(e) {
    console.error(e);
    showToast('Failed to register invoice: ' + e.message, 'error');
  }
};

window.submitUploadInvoice = async function(e) {
  e.preventDefault();
  const fileInput = document.getElementById('upl-file');
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a PDF file.');
    return;
  }

  const file = fileInput.files[0];
  const client = document.getElementById('upl-client').value;
  const amount = document.getElementById('upl-amount').value;
  const invNo = document.getElementById('upl-number').value || `RE INT - UPL - ${Date.now()}`;
  const date = document.getElementById('upl-date').value || new Date().toISOString().split('T')[0];

  const formData = new FormData();
  formData.append('invoice_file', file);
  formData.append('client_name', client);
  formData.append('invoice_no', invNo);
  formData.append('invoice_date', date);
  formData.append('amount', amount);
  formData.append('payment_status', 'Pending');

  try {
    const res = await fetch('/api/invoices/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast('PDF Invoice uploaded and registered in ledger.');
      document.getElementById('form-upload-invoice').reset();
      await loadInvoices();
    } else {
      showToast('Error: ' + data.error);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to upload PDF invoice');
  }
};

window.loadInvoices = async function() {
  const tbody = document.getElementById('invoices-ledger-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/invoices');
    const invoices = await res.json();
    state.invoices = invoices;

    if (invoices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">No invoices recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = invoices.map(inv => {
      const sourceText = inv.uploaded_file_path ? 'PDF Upload' : 'Reference Invoice';
      const sourceChip = inv.uploaded_file_path ? 'tag-avail' : 'tag-negotiating';
      
      const actions = inv.uploaded_file_path 
        ? `<a href="${inv.uploaded_file_path}" target="_blank" class="btn btn-ghost btn-sm" style="color: var(--blue-l); border: 1px solid var(--border); padding: 4px 8px; margin-right: 4px; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-file-text"></i> Open PDF</a>`
        : `<button class="btn btn-ghost btn-sm" onclick="showInvoicePreview(${inv.id})" style="color: var(--gold-l); border: 1px solid var(--border); padding: 4px 8px; margin-right: 4px; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-eye"></i> Print View</button>`;

      const deleteBtn = `<button class="btn btn-ghost btn-sm" onclick="deleteInvoice(${inv.id})" style="color: var(--red); border: 1px solid var(--border); padding: 4px 8px; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-trash"></i> Delete</button>`;

      return `
        <tr>
          <td style="font-family:monospace; font-weight:700;">${inv.invoice_no}</td>
          <td>${inv.invoice_date}</td>
          <td style="font-weight:700; color:var(--text-light);">${inv.client_name}</td>
          <td>₹${(inv.amount || 0).toLocaleString('en-IN')}</td>
          <td>₹${((inv.cgst || 0) + (inv.sgst || 0)).toLocaleString('en-IN')}</td>
          <td style="font-weight:700; color:var(--green-l);">₹${(inv.total || 0).toLocaleString('en-IN')}</td>
          <td><span class="chip ${sourceChip}">${sourceText}</span></td>
          <td><div style="display:flex; gap:4px; align-items:center;">${actions}${deleteBtn}</div></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--red);">Failed to load invoices.</td></tr>`;
  }
};

window.deleteInvoice = async function(id) {
  if (!confirm('Are you sure you want to delete this invoice? This will permanently unlink it from accounts ledger.')) return;
  try {
    const res = await fetch('/api/invoices/' + id, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast('Invoice deleted and unlinked.');
      await loadInvoices();
    }
  } catch(e) {
    console.error(e);
  }
};

window.showInvoicePreview = function(id) {
  const inv = state.invoices.find(item => item.id == id);
  if (!inv) return showToast('Invoice not found');

  let serviceHeader = 'Brokerage Services Allocation';
  let serviceDesc = inv.description || 'Service Charges for real estate facilitation';
  if (inv.description && inv.description.toLowerCase().includes('service charges for ')) {
    const startIdx = inv.description.toLowerCase().indexOf('service charges for ') + 'service charges for '.length;
    const atIdx = inv.description.toLowerCase().indexOf(' at ', startIdx);
    if (atIdx !== -1) {
      serviceHeader = inv.description.substring(startIdx, atIdx);
    } else {
      serviceHeader = inv.description.substring(startIdx);
    }
  } else if (inv.description) {
    serviceHeader = inv.description;
  }

  const area = document.getElementById('invoice-printout-area');
  if (!area) return;

  const cgstVal = inv.cgst || 0;
  const sgstVal = inv.sgst || 0;
  const subTotal = inv.amount || 0;
  const grandTotal = inv.total || 0;
  const wordsStr = window.priceToWords(Math.round(grandTotal));

  // Determine Brand Coordinates & Logo for White-Label Printable View
  const coName = state.systemSettings?.coBrandName || 'SUBH HOMES';
  const coLogo = state.systemSettings?.coBrandLogo || '';
  const coSub = 'Premium Real Estate Solutions & Brokerage Integrations';

  let logoHeaderHtml = `<h1 style="margin:0; font-family:'Outfit',sans-serif; font-size:32px; font-weight:800; color:#b08513; letter-spacing:1px; text-transform:uppercase;">${coName}</h1>`;
  if (coLogo) {
    logoHeaderHtml = `
      <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:8px;">
        <img src="${coLogo}" style="max-height: 48px; max-width: 150px; object-fit: contain;">
        <h1 style="margin:0; font-family:'Outfit',sans-serif; font-size:32px; font-weight:800; color:#b08513; letter-spacing:1px; text-transform:uppercase;">${coName}</h1>
      </div>
    `;
  }

  // Parse itemized entries for printout rendering
  let parsedItems = [];
  try {
    if (inv.items) {
      parsedItems = JSON.parse(inv.items);
    }
  } catch (e) {
    console.error("Failed to parse invoice items:", e);
  }

  let itemsHtml = '';
  if (parsedItems && parsedItems.length > 0) {
    itemsHtml = parsedItems.map((item, idx) => {
      const itemAmt = item.amount || 0;
      const itemCgst = Math.round(itemAmt * 0.09);
      const itemSgst = Math.round(itemAmt * 0.09);
      const itemTotal = itemAmt + itemCgst + itemSgst;
      return `
        <tr>
          <td style="padding:12px 10px; border:1px solid #ddd; vertical-align:top;">${idx + 1}</td>
          <td style="padding:12px 10px; border:1px solid #ddd;">
            <strong style="color:#b08513; font-size:12px; text-transform:uppercase;">${item.description}</strong>
          </td>
          <td style="padding:12px 10px; border:1px solid #ddd; text-align:right; font-weight:600;">₹${itemAmt.toLocaleString('en-IN')}.00</td>
          <td style="padding:12px 10px; border:1px solid #ddd; text-align:center; color:#666; line-height:1.4;">
            CGST 9%: ₹${itemCgst.toLocaleString('en-IN')}.00<br>
            SGST 9%: ₹${itemSgst.toLocaleString('en-IN')}.00
          </td>
          <td style="padding:12px 10px; border:1px solid #ddd; text-align:right; font-weight:700; font-size:12px;">₹${itemTotal.toLocaleString('en-IN')}.00</td>
        </tr>
      `;
    }).join('');
  } else {
    itemsHtml = `
      <tr>
        <td style="padding:12px 10px; border:1px solid #ddd; vertical-align:top;">1</td>
        <td style="padding:12px 10px; border:1px solid #ddd;">
          <strong style="color:#b08513; font-size:12px; text-transform:uppercase;">${serviceHeader}</strong>
          <div style="font-size:10.5px; color:#666; margin-top:4px; line-height:1.4;">${serviceDesc}</div>
        </td>
        <td style="padding:12px 10px; border:1px solid #ddd; text-align:right; font-weight:600;">₹${subTotal.toLocaleString('en-IN')}.00</td>
        <td style="padding:12px 10px; border:1px solid #ddd; text-align:center; color:#666; line-height:1.4;">
          CGST 9%: ₹${cgstVal.toLocaleString('en-IN')}.00<br>
          SGST 9%: ₹${sgstVal.toLocaleString('en-IN')}.00
        </td>
        <td style="padding:12px 10px; border:1px solid #ddd; text-align:right; font-weight:700; font-size:12px;">₹${grandTotal.toLocaleString('en-IN')}.00</td>
      </tr>
    `;
  }

  // Build high-fidelity white-labeled printable tax invoice content
  let html = `
    <div style="font-family: 'Outfit', 'Inter', sans-serif; background:#ffffff; color:#1a1e24; padding: 25px; border: 1px solid #ddd; max-width:800px; margin:0 auto; box-sizing:border-box;">
      
      <!-- HEADER BRAND LOGO -->
      <div style="text-align:center; margin-bottom:20px;">
        ${logoHeaderHtml}
        <div style="font-size:10px; color:#555; text-transform:uppercase; font-weight:700; letter-spacing:2px; margin-top:2px;">${coSub}</div>
        <div style="border-top:1px solid #C9991A; border-bottom:1px solid #C9991A; height:3px; margin-top:8px;"></div>
      </div>
      
      <!-- TAX INVOICE LABEL -->
      <div style="text-align:center; margin-bottom:20px;">
        <span style="font-weight:800; font-size:16px; border:1.5px solid #1a1e24; padding:5px 15px; letter-spacing:1px; text-transform:uppercase;">TAX INVOICE</span>
      </div>

      <!-- INVOICE INFO & SENDER BRANDS COLUMNS -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-bottom:25px; font-size:12px; line-height:1.5;">
        
        <!-- Left side: Broker/Sender details -->
        <div style="background:#fcfaf2; border:1px solid #f2e9cf; padding:12px; border-radius:4px;">
          <h3 style="margin:0 0 8px 0; color:#b08513; font-size:13px; font-weight:800; text-transform:uppercase;">Broker details (Sender):</h3>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px;">
            <tr><td style="width:75px; font-weight:700; color:#555;">Name:</td><td style="font-weight:700;">${inv.broker_name || 'Ms Vasu Jain'}</td></tr>
            <tr><td style="font-weight:700; color:#555; vertical-align:top;">Address:</td><td>${inv.broker_address || '300, 2nd Floor, Kamraj Road, Bengaluru - 560 042'}</td></tr>
            <tr><td style="font-weight:700; color:#555;">Phone:</td><td>${inv.broker_phone || '+91 9964985128'}</td></tr>
            <tr><td style="font-weight:700; color:#555;">Email:</td><td>${inv.broker_email || 'vasujain@subhhomes.com'}</td></tr>
            <tr><td style="font-weight:700; color:#555;">RERA:</td><td style="font-family:monospace; font-weight:700; color:#b08513;">${inv.broker_rera || 'AG/KN/170731/000296'}</td></tr>
            <tr><td style="font-weight:700; color:#555;">GSTIN:</td><td style="font-family:monospace; font-weight:700; color:#b08513;">${inv.broker_gstin || '29AMSPK0486E1ZO'}</td></tr>
          </table>
        </div>

         <!-- Right side: Client/Invoice details -->
        <div style="background:#fafafa; border:1px solid #eee; padding:12px; border-radius:4px;">
          <h3 style="margin:0 0 8px 0; color:#333; font-size:13px; font-weight:800; text-transform:uppercase;">Invoice & Client particulars:</h3>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px;">
            <tr><td style="width:90px; font-weight:700; color:#555;">Invoice No:</td><td style="font-family:monospace; font-weight:700; font-size:12px; color:#c0392b;">${inv.invoice_no}</td></tr>
            <tr><td style="font-weight:700; color:#555;">Invoice Date:</td><td>${inv.invoice_date}</td></tr>
            <tr><td style="font-weight:700; color:#555; vertical-align:top;">Bill To Client:</td><td style="font-weight:700;">${inv.client_name}</td></tr>
            <tr><td style="font-weight:700; color:#555; vertical-align:top;">Address:</td><td>${inv.client_address || 'Bengaluru, India'}</td></tr>
            <tr><td style="font-weight:700; color:#555;">Client GSTIN:</td><td style="font-family:monospace; font-weight:700;">${inv.client_gstin || 'N/A'}</td></tr>
            <tr><td style="font-weight:700; color:#555;">Project/Deal:</td><td>${inv.project_deal || 'N/A'}</td></tr>
          </table>
        </div>

      </div>

      <!-- ITEM LIST TABLE -->
      <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:20px;">
        <thead>
          <tr style="background:#1a1e24; color:#ffffff; font-weight:700; text-transform:uppercase; text-align:left;">
            <th style="padding:10px; border:1px solid #1a1e24;">#</th>
            <th style="padding:10px; border:1px solid #1a1e24;">Description of Services</th>
            <th style="padding:10px; border:1px solid #1a1e24; text-align:right;">Sub-Total (₹)</th>
            <th style="padding:10px; border:1px solid #1a1e24; text-align:center;">Tax GST (9%+9%)</th>
            <th style="padding:10px; border:1px solid #1a1e24; text-align:right;">Line Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          
          <!-- SUMMARY CALCULATION GRID -->
          <tr style="background:#fafafa;">
            <td colspan="3" style="border:1px solid #ddd; padding:10px; vertical-align:top; border-right:none;"></td>
            <td style="border:1px solid #ddd; padding:10px; font-weight:700; text-align:right; border-left:none;">Subtotal:</td>
            <td style="border:1px solid #ddd; padding:10px; text-align:right; font-weight:700;">₹${subTotal.toLocaleString('en-IN')}.00</td>
          </tr>
          <tr style="background:#fafafa;">
            <td colspan="3" style="border:1px solid #ddd; padding:10px; vertical-align:top; border-right:none;"></td>
            <td style="border:1px solid #ddd; padding:10px; font-weight:700; text-align:right; border-left:none; color:#555;">Add CGST (9%):</td>
            <td style="border:1px solid #ddd; padding:10px; text-align:right; font-weight:700; color:#555;">₹${cgstVal.toLocaleString('en-IN')}.00</td>
          </tr>
          <tr style="background:#fafafa;">
            <td colspan="3" style="border:1px solid #ddd; padding:10px; vertical-align:top; border-right:none;"></td>
            <td style="border:1px solid #ddd; padding:10px; font-weight:700; text-align:right; border-left:none; color:#555;">Add SGST (9%):</td>
            <td style="border:1px solid #ddd; padding:10px; text-align:right; font-weight:700; color:#555;">₹${sgstVal.toLocaleString('en-IN')}.00</td>
          </tr>
          <tr style="background:#f6f3eb;">
            <td colspan="3" style="border:1px solid #ddd; padding:12px 10px; border-right:none;"></td>
            <td style="border:1px solid #ddd; padding:12px 10px; font-weight:800; font-size:13px; text-align:right; color:#b08513; border-left:none; text-transform:uppercase;">Grand Total:</td>
            <td style="border:1px solid #ddd; padding:12px 10px; text-align:right; font-weight:800; font-size:14px; color:#b08513;">₹${grandTotal.toLocaleString('en-IN')}.00</td>
          </tr>
        </tbody>
      </table>

      <!-- RUPEES IN WORDS ROW -->
      <div style="font-size:12px; margin-bottom:25px; border:1px dashed #C9991A; padding:8px 12px; border-radius:4px; background:#fffdf7;">
        Total Amount in Words: <strong style="color:#b08513; font-size:12.5px;">${wordsStr}</strong>
      </div>

      <!-- BOTTOM BLOCK: BANK DETAILS & TERMS -->
      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:25px; font-size:11px; line-height:1.5;">
        
        <!-- Left: Bank Accounts Details -->
        <div>
          <h4 style="margin:0 0 6px 0; color:#b08513; text-transform:uppercase; font-size:11.5px; font-weight:800;">🏦 Bank Remittance Details (Electronic Transfer):</h4>
          <table style="width:100%; border-collapse:collapse; font-size:11px; border:1px solid #eee; background:#fafafa;">
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px; font-weight:700; width:110px;">Account Name:</td><td style="padding:6px; font-weight:700;">${inv.bank_name || 'SUBH HOMES'}</td></tr>
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px; font-weight:700;">Account Number:</td><td style="padding:6px; font-family:monospace; font-weight:700;">${inv.bank_account || '10060214087'}</td></tr>
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px; font-weight:700;">IFSC Code:</td><td style="padding:6px; font-family:monospace; font-weight:700; color:#b08513;">${inv.bank_ifsc || 'IDFB0080157'}</td></tr>
            <tr style="border-bottom:1px solid #eee;"><td style="padding:6px; font-weight:700;">Account Type:</td><td style="padding:6px;">${inv.bank_account_type || 'CURRENT ACCOUNT'}</td></tr>
            <tr><td style="padding:6px; font-weight:700;">Bank & Branch:</td><td style="padding:6px;">${inv.bank_branch || 'IDFC FIRST BANK, KALYAN NAGAR BRANCH'}</td></tr>
          </table>
        </div>

        <!-- Right: Terms & Sign Block -->
        <div style="display:flex; flex-direction:column; justify-content:space-between; text-align:right;">
          <div style="text-align:left; font-size:10px; color:#555; background:#fafafa; border:1px solid #eee; padding:10px; border-radius:4px; height: 110px; overflow-y:auto; box-sizing:border-box;">
            <strong style="font-weight:700; text-transform:uppercase; color:#333; display:block; margin-bottom:4px;">Terms & Conditions:</strong>
            ${(inv.terms || '').replace(/\n/g, '<br>')}
          </div>
          
          <div style="margin-top:15px;">
            <div style="font-size:10.5px; font-weight:700; text-transform:uppercase; color:#555; margin-bottom:40px;">For ${coName}</div>
            <div style="border-top: 1px dashed #1a1e24; display:inline-block; width:150px; padding-top:4px; margin-bottom:4px; margin-top:20px;"></div>
            <div style="font-size:10px; font-weight:700; color:#333; text-transform:uppercase;">Authorized Signatory</div>
            <div style="font-size:9.5px; color:#b08513; font-weight:700; margin-top:2px;">${inv.broker_name || 'Ms Vasu Jain'}</div>
          </div>
        </div>

      </div>

    </div>
  `;

  area.innerHTML = html;
  
  // Set up the dynamic edit button in preview modal
  const editBtn = document.getElementById('btn-edit-invoice-preview');
  if (editBtn) {
    editBtn.style.display = 'inline-flex';
    editBtn.setAttribute('onclick', `editInvoiceFromPreview(${inv.id})`);
  }
  
  openModal('modal-invoice-popup');
};

window.printInvoiceArea = function() {
  const area = document.getElementById('invoice-printout-area');
  if (!area) return;

  // Modern ultra-reliable, pop-up-blocker-proof, non-disruptive media print style injection
  const printStyle = document.createElement('style');
  printStyle.id = 'dynamic-print-styles';
  printStyle.innerHTML = `
    @media print {
      body * {
        visibility: hidden !important;
      }
      #modal-invoice-popup, #modal-invoice-popup * {
        visibility: visible !important;
      }
      #modal-invoice-popup {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: auto !important;
        background: #ffffff !important;
        color: #1a1e24 !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        transform: none !important;
      }
      #invoice-printout-area, #invoice-printout-area * {
        visibility: visible !important;
      }
      #invoice-printout-area {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #1a1e24 !important;
      }
      .mhd, .mft, .mclose, .btn, button {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(printStyle);
  
  window.print();
  
  // Clean up styles immediately after print dialog closes
  setTimeout(() => {
    printStyle.remove();
  }, 1000);
};

window.editInvoiceFromPreview = function(id) {
  // Find invoice details
  const inv = state.invoices.find(item => item.id == id);
  if (!inv) return showToast('Invoice not found');

  // Close preview modal
  closeModal('modal-invoice-popup');

  // Switch to Invoices Page
  showPage('page-invoices');

  // Populate form fields
  document.getElementById('inv-client').value = inv.client_name || '';
  document.getElementById('inv-billto').value = inv.client_address || '';
  document.getElementById('inv-gstin').value = inv.client_gstin || '';
  document.getElementById('inv-project').value = inv.project_deal || '';
  document.getElementById('inv-number').value = inv.invoice_no || '';
  document.getElementById('inv-date').value = inv.invoice_date || '';
  document.getElementById('inv-rera').value = inv.broker_rera || '';
  document.getElementById('inv-broker-gst').value = inv.broker_gstin || '';

  // Clear existing items container
  const container = document.getElementById('inv-items-container');
  if (container) {
    container.innerHTML = '';
    
    // Parse and populate items
    let parsedItems = [];
    try {
      if (inv.items) {
        parsedItems = JSON.parse(inv.items);
      }
    } catch(e) {
      console.error(e);
    }

    if (parsedItems && parsedItems.length > 0) {
      parsedItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'inv-item-row';
        row.style = 'display:grid; grid-template-columns: 1.5fr 2fr 1.2fr auto; gap:8px; align-items:center; margin-bottom: 8px;';
        
        // Find standard preset matching the description (or select custom "Other")
        let matchedPreset = '';
        const presets = [
          'Real Estate Consultancy Fees',
          'Brokerage Commission - Residential Sale',
          'Brokerage Commission - Commercial Sale',
          'Rental Brokerage & Facilitation Fees',
          'Agreement & Documentation Charges',
          'Property Registration Support Fees',
          'Legal Due Diligence Verification'
        ];
        
        for (const p of presets) {
          if (item.description.startsWith(p)) {
            matchedPreset = p;
            break;
          }
        }
        if (!matchedPreset) {
          matchedPreset = 'Other';
        }

        row.innerHTML = `
          <select class="form-select inv-item-preset" onchange="onInvoiceItemPresetChange(this)" style="font-size:12px; padding: 6px 10px; background: var(--bg-card); color: var(--text-light); border: 1px solid var(--border); border-radius: var(--radius-md);">
            <option value="">Select Service...</option>
            <option value="Real Estate Consultancy Fees" ${matchedPreset === 'Real Estate Consultancy Fees' ? 'selected' : ''}>Consultancy Fees</option>
            <option value="Brokerage Commission - Residential Sale" ${matchedPreset === 'Brokerage Commission - Residential Sale' ? 'selected' : ''}>Residential Sale Commission</option>
            <option value="Brokerage Commission - Commercial Sale" ${matchedPreset === 'Brokerage Commission - Commercial Sale' ? 'selected' : ''}>Commercial Sale Commission</option>
            <option value="Rental Brokerage & Facilitation Fees" ${matchedPreset === 'Rental Brokerage & Facilitation Fees' ? 'selected' : ''}>Rental Brokerage Fees</option>
            <option value="Agreement & Documentation Charges" ${matchedPreset === 'Agreement & Documentation Charges' ? 'selected' : ''}>Agreement Charges</option>
            <option value="Property Registration Support Fees" ${matchedPreset === 'Property Registration Support Fees' ? 'selected' : ''}>Registration Support</option>
            <option value="Legal Due Diligence Verification" ${matchedPreset === 'Legal Due Diligence Verification' ? 'selected' : ''}>Legal Verification</option>
            <option value="Other" ${matchedPreset === 'Other' ? 'selected' : ''}>Other / Custom Description</option>
          </select>
          <input type="text" class="form-input inv-item-desc" placeholder="Service description..." value="${item.description.replace(/"/g, '&quot;')}" required style="font-size:12px; padding: 6px 10px;">
          <input type="number" class="form-input inv-item-amount" placeholder="Amount" value="${item.amount || 0}" oninput="recalculateInvoiceAmounts()" required style="font-size:12px; padding: 6px 10px;">
          <button class="btn btn-ghost btn-sm" onclick="removeInvoiceItemRow(this)" type="button" style="color:var(--red); padding: 6px; border:1px solid var(--border);"><i class="ti ti-trash"></i></button>
        `;
        container.appendChild(row);
      });
    } else {
      // Fallback if no items (e.g. single item old invoice)
      const row = document.createElement('div');
      row.className = 'inv-item-row';
      row.style = 'display:grid; grid-template-columns: 1.5fr 2fr 1.2fr auto; gap:8px; align-items:center; margin-bottom: 8px;';
      row.innerHTML = `
        <select class="form-select inv-item-preset" onchange="onInvoiceItemPresetChange(this)" style="font-size:12px; padding: 6px 10px; background: var(--bg-card); color: var(--text-light); border: 1px solid var(--border); border-radius: var(--radius-md);">
          <option value="">Select Service...</option>
          <option value="Real Estate Consultancy Fees">Consultancy Fees</option>
          <option value="Brokerage Commission - Residential Sale">Residential Sale Commission</option>
          <option value="Brokerage Commission - Commercial Sale">Commercial Sale Commission</option>
          <option value="Rental Brokerage & Facilitation Fees">Rental Brokerage Fees</option>
          <option value="Agreement & Documentation Charges">Agreement Charges</option>
          <option value="Property Registration Support Fees">Registration Support</option>
          <option value="Legal Due Diligence Verification">Legal Verification</option>
          <option value="Other" selected>Other / Custom Description</option>
        </select>
        <input type="text" class="form-input inv-item-desc" placeholder="Service description..." value="${(inv.description || '').replace(/"/g, '&quot;')}" required style="font-size:12px; padding: 6px 10px;">
        <input type="number" class="form-input inv-item-amount" placeholder="Amount" value="${inv.amount || 0}" oninput="recalculateInvoiceAmounts()" required style="font-size:12px; padding: 6px 10px;">
        <button class="btn btn-ghost btn-sm" onclick="removeInvoiceItemRow(this)" type="button" style="color:var(--red); padding: 6px; border:1px solid var(--border);"><i class="ti ti-trash"></i></button>
      `;
      container.appendChild(row);
    }
    recalculateInvoiceAmounts();
  }

  // Scroll smoothly to form
  const formElement = document.getElementById('form-generate-invoice') || document.querySelector('#page-invoices form');
  if (formElement) {
    formElement.scrollIntoView({ behavior: 'smooth' });
  }
  showToast('Invoice loaded back into form editor for modification.', 'info');
};

// ----------------------------------------------------
// 22. FINANCE SUB-TABS & MATHEMATICAL CALCULATORS SUITE
// ----------------------------------------------------
window.switchFinanceTab = function(tabId) {
  const sections = ['expenses', 'target', 'budget', 'roi', 'emi'];
  sections.forEach(s => {
    const el = document.getElementById(`fin-${s}-section`);
    if (el) el.classList.add('hidden');
    const btn = document.getElementById(`btn-fin-${s}`);
    if (btn) {
      btn.style.borderBottom = 'none';
      btn.style.color = 'var(--text-light)';
      btn.style.fontWeight = '500';
    }
  });

  const activeEl = document.getElementById(`fin-${tabId}-section`);
  if (activeEl) activeEl.classList.remove('hidden');
  const activeBtn = document.getElementById(`btn-fin-${tabId}`);
  if (activeBtn) {
    activeBtn.style.borderBottom = '2px solid var(--gold)';
    activeBtn.style.color = 'var(--gold-l)';
    activeBtn.style.fontWeight = '700';
  }

  if (tabId === 'target') calculateTargetPlanner();
  else if (tabId === 'budget') calculateBudgetTracker();
  else if (tabId === 'roi') calculateROI();
  else if (tabId === 'emi') calculateEMI();
};

window.calculateTargetPlanner = function() {
  const annualTarget = parseFloat(document.getElementById('target-annual-revenue').value || 5000000);
  const avgComm = parseFloat(document.getElementById('target-avg-commission').value || 150000);
  const convRate = parseFloat(document.getElementById('target-conv-rate').value || 2.0);

  // Deals needed
  const dealsNeeded = Math.ceil(annualTarget / avgComm);
  document.getElementById('target-deals-needed').innerText = dealsNeeded;

  // Leads needed
  const leadsNeeded = Math.ceil(dealsNeeded / (convRate / 100));
  document.getElementById('target-leads-needed-val').innerText = leadsNeeded.toLocaleString('en-IN');

  // Calculate total earned commissions (Paid only)
  let totalRevenue = 0;
  if (state.commissions) {
    state.commissions.forEach(c => {
      if (c.payment_status === 'Paid') {
        totalRevenue += (c.deal_value * (c.commission_percentage / 100.0) - (c.co_broker_payout || 0) - (c.expenses || 0));
      }
    });
  }

  const pct = Math.min(100, (totalRevenue / annualTarget * 100)).toFixed(1);
  document.getElementById('target-progress-percent').innerText = pct + '%';
  document.getElementById('target-progress-bar').style.width = pct + '%';
  document.getElementById('target-earned-val').innerText = `₹${totalRevenue.toLocaleString('en-IN')}`;
  document.getElementById('target-annual-val').innerText = `₹${annualTarget.toLocaleString('en-IN')}`;
};

window.calculateBudgetTracker = function() {
  const limitAds = parseFloat(document.getElementById('budget-limit-ads').value || 100000);
  const limitPortals = parseFloat(document.getElementById('budget-limit-portals').value || 50000);
  const limitLicenses = parseFloat(document.getElementById('budget-limit-licenses').value || 50000);
  const limitTravel = parseFloat(document.getElementById('budget-limit-travel').value || 30000);
  const limitSplits = parseFloat(document.getElementById('budget-limit-splits').value || 500000);
  const limitOthers = parseFloat(document.getElementById('budget-limit-others').value || 50000);

  // Read logged local expenses
  let localExpenses = [];
  try {
    const stored = localStorage.getItem('realpro_logged_expenses');
    if (stored) localExpenses = JSON.parse(stored);
  } catch (e) {}

  // Aggregate by channel category
  const categories = {
    'Ads & Marketing': { spent: 0, limit: limitAds },
    'Portal Subscriptions': { spent: 0, limit: limitPortals },
    'CRM & Software Licenses': { spent: 0, limit: limitLicenses },
    'Fuel & Travel': { spent: 0, limit: limitTravel },
    'Co-broker Splits': { spent: 0, limit: limitSplits },
    'Other Operations': { spent: 0, limit: limitOthers }
  };

  localExpenses.forEach(exp => {
    const channel = exp.channel || 'Other Operations';
    const val = parseFloat(exp.value || 0);

    if (channel.includes('Ads') || channel.includes('Marketing')) {
      categories['Ads & Marketing'].spent += val;
    } else if (channel.includes('Portal')) {
      categories['Portal Subscriptions'].spent += val;
    } else if (channel.includes('Licenses') || channel.includes('Software')) {
      categories['CRM & Software Licenses'].spent += val;
    } else if (channel.includes('Fuel') || channel.includes('Travel')) {
      categories['Fuel & Travel'].spent += val;
    } else if (channel.includes('Splits') || channel.includes('Cut')) {
      categories['Co-broker Splits'].spent += val;
    } else {
      categories['Other Operations'].spent += val;
    }
  });

  const container = document.getElementById('budget-progress-container');
  if (!container) return;

  container.innerHTML = Object.keys(categories).map(catKey => {
    const data = categories[catKey];
    const spent = data.spent;
    const limit = data.limit;
    const pct = limit > 0 ? (spent / limit * 100) : 0;

    let barColor = 'var(--green)';
    let chipClass = 'tag-avail';
    let labelExtra = '';

    if (pct > 100) {
      barColor = 'var(--red)';
      chipClass = 'tag-critical';
      labelExtra = `<span style="color:var(--red); font-weight:800; font-size:10px; animation: flash 1s infinite;"><i class="ti ti-alert-triangle"></i> BUDGET OVERRUN!</span>`;
    } else if (pct > 70) {
      barColor = 'var(--gold)';
      chipClass = 'tag-negotiating';
    }

    return `
      <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); padding:12px; border-radius:6px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700; font-size:12.5px; color:var(--text-light);">${catKey} ${labelExtra}</span>
          <span class="chip ${chipClass}" style="font-size:10.5px; font-weight:700;">${pct.toFixed(0)}% Spent</span>
        </div>
        <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
          <div style="width:${Math.min(100, pct)}%; height:100%; background:${barColor}; border-radius:3px; transition:width 0.4s ease;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-secondary);">
          <span>Spent: <strong>₹${spent.toLocaleString('en-IN')}</strong></span>
          <span>Limit: <strong>₹${limit.toLocaleString('en-IN')}</strong></span>
        </div>
      </div>
    `;
  }).join('');
};

window.calculateROI = function() {
  const price = parseFloat(document.getElementById('roi-purchase-price').value || 15000000);
  const rent = parseFloat(document.getElementById('roi-monthly-rent').value || 55000);
  const appreciation = parseFloat(document.getElementById('roi-appreciation-rate').value || 8.0);
  const maint = parseFloat(document.getElementById('roi-annual-maintenance').value || 60000);

  const grossYield = (rent * 12) / price * 100;
  const netYield = ((rent * 12) - maint) / price * 100;

  document.getElementById('roi-gross-yield').innerText = grossYield.toFixed(2) + '%';
  document.getElementById('roi-net-yield').innerText = netYield.toFixed(2) + '%';

  const tbody = document.getElementById('roi-projection-table-body');
  if (!tbody) return;

  let projectionHtml = '';
  let activeValue = price;
  let cumRent = 0;
  let activeRent = rent;

  for (let year = 1; year <= 5; year++) {
    activeValue = activeValue * (1 + (appreciation / 100));
    
    // 5% rent increase compounding annually
    if (year > 1) {
      activeRent = activeRent * 1.05;
    }
    const yearNetRent = (activeRent * 12) - maint;
    cumRent += yearNetRent;

    const estProfit = (activeValue - price) + cumRent;

    projectionHtml += `
      <tr>
        <td style="font-weight:700; color:var(--gold-l);">Year ${year}</td>
        <td>₹${Math.round(activeValue).toLocaleString('en-IN')}</td>
        <td>₹${Math.round(cumRent).toLocaleString('en-IN')}</td>
        <td style="font-weight:700; color:var(--green-l);">₹${Math.round(estProfit).toLocaleString('en-IN')}</td>
      </tr>
    `;
  }
  tbody.innerHTML = projectionHtml;
};

window.calculateEMI = function() {
  const principal = parseFloat(document.getElementById('emi-principal').value || 8000000);
  const ratePa = parseFloat(document.getElementById('emi-interest').value || 8.5);
  const tenureY = parseFloat(document.getElementById('emi-tenure').value || 20);

  const r = (ratePa / 12) / 100;
  const n = tenureY * 12;

  // EMI Formula
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalAmount = emi * n;
  const totalInterest = totalAmount - principal;

  document.getElementById('emi-monthly-val').innerText = '₹' + Math.round(emi).toLocaleString('en-IN');
  document.getElementById('emi-total-interest').innerText = '₹' + (totalInterest / 100000).toFixed(2) + 'L';
  document.getElementById('emi-total-amount').innerText = '₹' + (totalAmount / 10000000).toFixed(2) + 'Cr';

  // Interest vs Principal splits
  const principalPct = Math.round((principal / totalAmount) * 100);
  const interestPct = 100 - principalPct;

  document.getElementById('emi-principal-split-pct').innerText = principalPct + '%';
  document.getElementById('emi-interest-split-pct').innerText = interestPct + '%';
  document.getElementById('emi-principal-split-bar').style.width = principalPct + '%';

  // Build first 12 months amortization schedule table
  const tbody = document.getElementById('emi-schedule-table-body');
  if (!tbody) return;

  let scheduleHtml = '';
  let balance = principal;

  for (let month = 1; month <= 12; month++) {
    const interestPaid = balance * r;
    const principalPaid = emi - interestPaid;
    balance = Math.max(0, balance - principalPaid);

    scheduleHtml += `
      <tr>
        <td style="font-weight:700; color:var(--text-light);">Month ${month}</td>
        <td>₹${Math.round(emi).toLocaleString('en-IN')}</td>
        <td style="color:var(--purple-l);">₹${Math.round(interestPaid).toLocaleString('en-IN')}</td>
        <td style="color:var(--blue-l);">₹${Math.round(principalPaid).toLocaleString('en-IN')}</td>
        <td style="font-weight:700; color:var(--green-l);">₹${Math.round(balance).toLocaleString('en-IN')}</td>
      </tr>
    `;
  }
  tbody.innerHTML = scheduleHtml;
};

// ====================================================
// PHASE 9 - GOOGLE SHEETS DYNAMIC EXECUTION FUNCTIONS
// ====================================================

// 1. To-Do Checklist Status Filters
let currentTodoFilter = 'All';
window.setTodoFilter = function(status) {
  currentTodoFilter = status;
  // Update chip active classes
  const pills = ['All', 'Incomplete', 'In Process', 'On Hold', 'Complete', 'Archived'];
  pills.forEach(p => {
    const el = document.getElementById('todo-filter-' + p.replace(' ', ''));
    if (el) {
      if (p === status) {
        el.style.background = 'var(--gold)';
        el.style.color = '#1a1714';
        el.style.fontWeight = '700';
      } else {
        el.style.background = 'rgba(255,255,255,0.05)';
        el.style.color = '#fff';
        el.style.fontWeight = '500';
      }
    }
  });
  renderFilteredTodos();
};

function renderFilteredTodos() {
  const container = document.getElementById('priority-list');
  if (!container || !state.todos) return;
  
  let list = state.todos;
  if (currentTodoFilter !== 'All') {
    list = state.todos.filter(t => t.status === currentTodoFilter);
  }
  
  if (list.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-txt">No tasks logged for status "${currentTodoFilter}".</div></div>`;
    return;
  }
  
  container.innerHTML = list.map(todo => {
    let isCompleted = todo.status === 'Complete';
    let priorityClass = `priority-badge-${todo.priority || 'Medium'}`;

    return `
      <div class="daily-item" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-left: 3px solid ${todo.priority === 'High' ? 'var(--red)' : todo.priority === 'Low' ? 'var(--green)' : 'var(--amber)'}; border-radius: var(--radius-md); gap: 10px;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
          <div class="daily-check ${isCompleted ? 'checked' : ''}" onclick="toggleTodoStatus(${todo.id}, '${todo.status}')" style="cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid var(--border); border-radius: 4px; flex-shrink: 0; background: ${isCompleted ? 'var(--gold)' : 'transparent'}; color: ${isCompleted ? '#1a1714' : 'transparent'}; font-weight: 700;">
            ${isCompleted ? '✓' : ''}
          </div>
          <span class="daily-text ${isCompleted ? 'completed' : ''}" id="todo-text-${todo.id}" ondblclick="enableTodoInlineEdit(${todo.id}, '${escapeQuote(todo.task)}')" style="cursor: pointer; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${isCompleted ? 'text-decoration: line-through; opacity: 0.4;' : ''}">
            <strong>${todo.task}</strong>
            ${todo.due_date ? `<span class="daily-time" style="margin-left: 8px; font-size: 9.5px; color: rgba(255,255,255,0.35);">(Due: ${todo.due_date})</span>` : ''}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <select class="form-select ${priorityClass}" onchange="changeTodoPriority(${todo.id}, this.value)" style="border:none; outline:none; cursor:pointer; font-weight:700; padding:2px 6px; font-size: 9.5px; border-radius: 4px; height: 20px; text-transform: uppercase;">
            <option value="High" ${todo.priority === 'High' ? 'selected' : ''}>🔴 High</option>
            <option value="Medium" ${todo.priority === 'Medium' || !todo.priority ? 'selected' : ''}>🟡 Medium</option>
            <option value="Low" ${todo.priority === 'Low' ? 'selected' : ''}>🟢 Low</option>
          </select>
          <select class="form-select" onchange="changeTodoStatus(${todo.id}, this.value)" style="border:1px solid var(--border); outline:none; cursor:pointer; font-weight:600; padding:2px 4px; font-size: 10px; background: rgba(0,0,0,0.35); border-radius: 4px; width: 95px; height: 20px; color: rgba(255,255,255,0.85);">
            <option value="Incomplete" ${todo.status === 'Incomplete' ? 'selected' : ''}>Incomplete</option>
            <option value="In Process" ${todo.status === 'In Process' ? 'selected' : ''}>In Process</option>
            <option value="On Hold" ${todo.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
            <option value="Complete" ${todo.status === 'Complete' ? 'selected' : ''}>Complete</option>
            <option value="Archived" ${todo.status === 'Archived' ? 'selected' : ''}>Archive</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="deleteTodoTask(${todo.id})" style="padding: 2px 6px; color: var(--red); font-size: 11px; height: 20px; display: flex; align-items: center;">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

// Override original loadTodos to render utilizing filters
const _origLoadTodos = window.loadTodos;
window.loadTodos = async function() {
  if (typeof _origLoadTodos === 'function') {
    try {
      const res = await fetch('/api/dashboard/todo');
      const data = await res.json();
      state.todos = data;
      const pendingTodos = data.filter(todo => todo.status !== 'Complete' && todo.status !== 'Archived');
      const pendingBadge = document.getElementById('todo-pending-count');
      if (pendingBadge) pendingBadge.innerText = `${pendingTodos.length} pending`;
      renderFilteredTodos();
    } catch(err) {
      console.error(err);
    }
  }
};

// 2. Sidebar Lock/Unlock Toggle Controllers
window.toggleSidebarLock = function() {
  const currentMode = localStorage.getItem('sidebar_lock_mode') || 'dynamic'; // dynamic, collapsed, expanded
  let newMode;
  if (currentMode === 'dynamic') {
    newMode = 'collapsed';
  } else if (currentMode === 'collapsed') {
    newMode = 'expanded';
  } else {
    newMode = 'dynamic';
  }
  
  localStorage.setItem('sidebar_lock_mode', newMode);
  applySidebarLock(newMode);
};

window.applySidebarLock = function(mode) {
  const sb = document.querySelector('.sidebar');
  const btn = document.getElementById('btn-sidebar-lock');
  if (!sb || !btn) return;
  
  sb.classList.remove('locked-collapsed', 'locked-expanded');
  
  if (mode === 'collapsed') {
    sb.classList.add('locked-collapsed');
    btn.innerHTML = `<i class="ti ti-lock"></i> <span>Locked: Collapsed</span>`;
    btn.style.borderColor = 'var(--gold)';
    btn.style.color = 'var(--gold-l)';
    showToast('Sidebar locked as Collapsed Icon Rail.');
  } else if (mode === 'expanded') {
    sb.classList.add('locked-expanded');
    btn.innerHTML = `<i class="ti ti-lock"></i> <span>Locked: Full View</span>`;
    btn.style.borderColor = 'var(--gold)';
    btn.style.color = 'var(--gold-l)';
    showToast('Sidebar locked as Expanded Full View.');
  } else {
    btn.innerHTML = `<i class="ti ti-lock-open"></i> <span>Dynamic Hover</span>`;
    btn.style.borderColor = 'rgba(255,255,255,0.06)';
    btn.style.color = '#fff';
    showToast('Sidebar set to Dynamic Hover Mode.');
  }
};

// Initialize Sidebar lock state on load
document.addEventListener('DOMContentLoaded', () => {
  let mode = localStorage.getItem('sidebar_lock_mode');
  if (!mode) {
    const isLocked = localStorage.getItem('sidebar_locked') === 'true';
    mode = isLocked ? 'collapsed' : 'dynamic';
  }
  applySidebarLock(mode);
});

// 3. AI NLP Notes Dumping Corner Parser
window.parseDumpingNotes = async function() {
  const textarea = document.getElementById('scratchpad-textarea');
  if (!textarea) return;
  const text = textarea.value;
  if (!text.trim()) {
    showToast('Scratch notes dump is empty. Please enter some text first!', 'error');
    return;
  }

  showToast('🤖 AI NLP Scanning Dump...', 'info');

  let phone = '';
  let email = '';
  let name = '';
  let budgetMin = '';
  let budgetMax = '';
  let bhk = '3 BHK';
  let location = '';

  try {
    const phoneRegex = /(?:\+91[\-\s]?)?[789]\d{9}\b/g;
    const phoneMatch = text.match(phoneRegex);
    phone = phoneMatch ? phoneMatch[0].trim() : '';
  } catch (e) {}

  try {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatch = text.match(emailRegex);
    email = emailMatch ? emailMatch[0].trim() : '';
  } catch (e) {}

  try {
    const nameMatch = text.match(/(?:Mr\.|Mrs\.|Ms\.|Client|Lead|Owner)[:\-\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i) 
                   || text.match(/(?:name|buyer)[:\-\s]+([A-Za-z\s]+)/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
    } else {
      const words = text.split(/\s+/).filter(w => w && w.length > 1 && w[0] === w[0].toUpperCase());
      if (words.length > 0) name = words[0] + (words[1] ? ' ' + words[1] : '');
    }
  } catch (e) {}

  try {
    const croreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/i);
    const lakhMatch = text.match(/(\d+)\s*(?:l|lakh|lakhs)/i);
    if (croreMatch) {
      const parsedCrore = parseFloat(croreMatch[1]);
      budgetMax = Math.round(parsedCrore * 10000000);
      budgetMin = Math.round(budgetMax * 0.8);
    } else if (lakhMatch) {
      const parsedLakh = parseFloat(lakhMatch[1]);
      budgetMax = Math.round(parsedLakh * 100000);
      budgetMin = Math.round(budgetMax * 0.8);
    }
  } catch (e) {}

  try {
    const bhkMatch = text.match(/(\d)\s*(?:bhk|bedroom|flat)/i);
    if (bhkMatch) {
      bhk = bhkMatch[1] + ' BHK';
    }
  } catch (e) {}

  try {
    const locMatch = text.match(/(?:in|at|near|location)[:\-\s]+([A-Za-z\s]+)(?:under|looking|phone|$)/i);
    if (locMatch) {
      location = locMatch[1].trim();
    }
  } catch (e) {}

  let isInventory = /available|for sale|for rent|owner|listing|inventory/i.test(text);
  let isRequirement = /require|looking|buyer|budget|client/i.test(text);

  // If text doesn't obviously have keywords, default to requirement/lead
  if (!isInventory && !isRequirement) {
    isRequirement = true;
  }

  // Pre-fill the respective form so the user can verify/edit the details before saving
  if (isRequirement) {
    navToPage('capture');
    showAddEnquiryModal();
    document.getElementById('edit-lead-name').value = name || 'Dumping Lead';
    document.getElementById('edit-lead-phone').value = phone || '';
    document.getElementById('edit-lead-email').value = email || '';
    document.getElementById('edit-lead-budget-min').value = budgetMin || '';
    document.getElementById('edit-lead-budget-max').value = budgetMax || '';
    document.getElementById('edit-lead-config').value = bhk || '';
    document.getElementById('edit-lead-location').value = location || '';
    document.getElementById('edit-lead-notes').value = `[AI NLP Extracted Note]:\n${text}`;
    
    showToast('Lead details parsed! Please review and save.', 'success');
    textarea.value = '';
    return;
  }

  if (isInventory) {
    navToPage('inventory');
    showAddListingModal();
    
    // Fill the Resale Property Form
    document.getElementById('prop-owner-name').value = name || 'Unknown Owner';
    document.getElementById('prop-owner-phone').value = phone || '';
    document.getElementById('prop-owner-email').value = email || '';
    document.getElementById('prop-society').value = location || name || 'New Property';
    document.getElementById('prop-location').value = location || 'Bangalore';
    document.getElementById('prop-config').value = bhk || '';
    document.getElementById('prop-price').value = budgetMax || '';
    document.getElementById('prop-comments').value = `[AI NLP Extracted Note]:\n${text}`;
    
    showToast('Inventory details parsed! Please review and save.', 'success');
    textarea.value = '';
    return;
  }
};

// 4. Roster Attendance Logs dynamic loader
window.loadTeamAttendanceLogs = async function() {
  const container = document.getElementById('roster-attendance-list-container');
  if (!container) return;

  try {
    const res = await fetch('/api/attendance/logs');
    if (!res.ok) throw new Error('Attendance load failed');
    const logs = await res.json();

    if (logs.length === 0) {
      container.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px 0; color:var(--text-muted);">No clock-in logs logged yet.</td></tr>`;
      return;
    }

    container.innerHTML = logs.map(l => {
      const stateL = l.clock_out ? 'Offline 🔴' : 'Active 🟢';
      const colorL = l.clock_out ? 'badge-ghost' : 'badge-green';
      const outTime = l.clock_out ? `🌅 Clocked out (${l.clock_out})` : '📝 Active Session';
      const hoursWorked = calculateHoursWorked(l.clock_in, l.clock_out);
      
      return `
        <tr>
          <td>${l.attendance_date}</td>
          <td><strong>${l.agent_name}</strong></td>
          <td>🌅 Checked in (${l.clock_in})<br><small style="opacity:0.6;">${outTime}</small></td>
          <td><span class="badge ${colorL}" style="font-size:9.5px;">${stateL}</span></td>
          <td><strong style="color:var(--green-light);">${hoursWorked}</strong></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px 0; color:var(--red);">Failed to load team attendance.</td></tr>`;
  }
};

window.exportAttendanceReport = async function() {
  try {
    const res = await fetch('/api/attendance/logs');
    if (!res.ok) throw new Error('Attendance logs fetch failed.');
    const logs = await res.json();

    let csvContent = "Date,Sales Agent,Check In,Check Out,State,Hours Worked\n";

    logs.forEach(l => {
      const stateL = l.clock_out ? 'Offline' : 'Active';
      const hoursWorked = calculateHoursWorked(l.clock_in, l.clock_out);
      const row = `"${l.attendance_date}","${l.agent_name.replace(/"/g, '""')}","${l.clock_in || ''}","${l.clock_out || ''}","${stateL}","${hoursWorked}"`;
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Attendance CSV report downloaded successfully!");
  } catch (err) {
    console.error(err);
    showToast("Failed to export attendance: " + err.message, 'error');
  }
};

// 5. SOPs CRUD handlers
window.loadSOPs = async function() {
  const container = document.getElementById('dynamic-sops-list-container');
  if (!container) return;

  try {
    const res = await fetch('/api/sops');
    const sops = await res.json();

    if (sops.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 20px 0; color:var(--text-muted);">No SOP workflows logged yet.</div>`;
      return;
    }

    // Sort by natural number in title
    sops.sort((a, b) => {
      const aNum = parseInt(a.title.match(/\d+/)?.[0] || 999);
      const bNum = parseInt(b.title.match(/\d+/)?.[0] || 999);
      return aNum - bNum;
    });

    const categories = [
      { name: '📋 Category I: Lead Qualification & Client Profiling', min: 1, max: 3, items: [] },
      { name: '🏠 Category II: Sourcing Inventory & Site Visit Coordination', min: 4, max: 6, items: [] },
      { name: '⚖️ Category III: Negotiations, MoU Contracts & Legal Transfer', min: 7, max: 12, items: [] },
      { name: '🚀 Category IV: Post-Sale Onboarding, Splits & Daily Compliance', min: 13, max: 15, items: [] },
      { name: '🛠️ Category V: Custom / Internal Operating Procedures', min: 16, max: Infinity, items: [] }
    ];

    sops.forEach(s => {
      const numMatch = s.title.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : null;
      if (num === null) {
        categories[4].items.push(s);
      } else {
        let placed = false;
        for (const cat of categories) {
          if (num >= cat.min && num <= cat.max) {
            cat.items.push(s);
            placed = true;
            break;
          }
        }
        if (!placed) {
          categories[4].items.push(s);
        }
      }
    });

    container.innerHTML = categories.map(cat => {
      if (cat.items.length === 0) return '';

      const itemsHtml = cat.items.map(s => {
        const stepsHtml = s.steps.map((st, idx) => `
          <div class="step-row" style="display: flex; gap: 12px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
            <div class="step-num" style="background: linear-gradient(135deg, var(--gold), var(--gold-dark)); width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #000; flex-shrink: 0;">${idx + 1}</div>
            <div style="font-size:12px; color:var(--text-secondary); line-height: 1.6;">${st}</div>
          </div>
        `).join('');

        return `
          <div style="margin-bottom: 6px; border: 1px solid rgba(212, 175, 55, 0.15); border-radius: var(--radius-md); overflow: hidden;">
            <div class="accord-hd" onclick="toggleAccordion('sop_${s.id}')" style="margin-bottom:0; border:none; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12.5px; font-weight:700; color:#fff;">${s.title}</span>
              <div style="display:flex; gap:10px; align-items:center;">
                <i class="ti ti-chevron-down" style="font-size: 11px;"></i>
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); deleteSOP(${s.id})" style="color:var(--red); padding: 2px 4px; font-size:10px; border:none; background:transparent;">✕ Delete</button>
              </div>
            </div>
            <div class="accord-body hidden" id="sop_${s.id}" style="padding:12px; background:rgba(0,0,0,0.25); border-top: 1px solid rgba(212, 175, 55, 0.08);">
              ${stepsHtml}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="card" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 12px;">
          <div style="font-size: 13.5px; font-weight: 800; color: var(--gold-l); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
            ${cat.name}
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    console.error(e);
  }
};

window.saveNewSOP = async function() {
  const title = document.getElementById('new-sop-title').value.trim();
  const stepsText = document.getElementById('new-sop-steps').value.trim();

  if (!title || !stepsText) {
    showToast('Please fill out Title and Steps');
    return;
  }

  const steps = stepsText.split('\n').filter(s => s.trim() !== '');

  try {
    const res = await fetch('/api/sops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, steps })
    });

    if (res.ok) {
      showToast('SOP workflow persisted successfully!');
      document.getElementById('new-sop-title').value = '';
      document.getElementById('new-sop-steps').value = '';
      document.getElementById('sop-create-block').style.display = 'none';
      loadSOPs();
    }
  } catch (err) {
    console.error(err);
  }
};

window.deleteSOP = async function(id) {
  if (!confirm('Are you sure you want to delete this Standard Operating Procedure?')) return;
  try {
    const res = await fetch(`/api/sops/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('SOP deleted successfully.');
      loadSOPs();
    }
  } catch (err) {
    console.error(err);
  }
};

// 6. Templates CRUD handlers
let currentTemplateTab = 'Script';

window.switchTemplateTab = function(tabName) {
  currentTemplateTab = tabName;
  document.getElementById('btn-temp-tab-scripts').classList.remove('active');
  document.getElementById('btn-temp-tab-wa').classList.remove('active');
  document.getElementById('btn-temp-tab-email').classList.remove('active');
  
  document.getElementById('btn-temp-tab-scripts').style.borderBottom = '2.5px solid transparent';
  document.getElementById('btn-temp-tab-scripts').style.color = 'var(--text-secondary)';
  document.getElementById('btn-temp-tab-wa').style.borderBottom = '2.5px solid transparent';
  document.getElementById('btn-temp-tab-wa').style.color = 'var(--text-secondary)';
  document.getElementById('btn-temp-tab-email').style.borderBottom = '2.5px solid transparent';
  document.getElementById('btn-temp-tab-email').style.color = 'var(--text-secondary)';

  if (tabName === 'Script') {
    document.getElementById('btn-temp-tab-scripts').classList.add('active');
    document.getElementById('btn-temp-tab-scripts').style.borderBottom = '2.5px solid var(--gold)';
    document.getElementById('btn-temp-tab-scripts').style.color = 'var(--gold-l)';
  } else if (tabName === 'WhatsApp') {
    document.getElementById('btn-temp-tab-wa').classList.add('active');
    document.getElementById('btn-temp-tab-wa').style.borderBottom = '2.5px solid var(--gold)';
    document.getElementById('btn-temp-tab-wa').style.color = 'var(--gold-l)';
  } else if (tabName === 'Email') {
    document.getElementById('btn-temp-tab-email').classList.add('active');
    document.getElementById('btn-temp-tab-email').style.borderBottom = '2.5px solid var(--gold)';
    document.getElementById('btn-temp-tab-email').style.color = 'var(--gold-l)';
  }
  loadTemplates();
};

window.copyTemplateText = function(btn, text) {
  navigator.clipboard.writeText(text);
  const oldHtml = btn.innerHTML;
  btn.innerHTML = `<i class="ti ti-check" style="color:#2ecc71;"></i> Copied!`;
  btn.style.color = '#2ecc71';
  setTimeout(() => {
    btn.innerHTML = oldHtml;
    btn.style.color = '';
  }, 2000);
};

window.loadTemplates = async function() {
  const container = document.getElementById('communication-templates-list-container');
  if (!container) return;

  try {
    const user = state.currentUser;
    let allowed = [];
    if (user) {
      if (user.allowed_pages === '*') {
        allowed = ['*'];
      } else if (Array.isArray(user.allowed_pages)) {
        allowed = user.allowed_pages;
      } else {
        try {
          allowed = JSON.parse(user.allowed_pages || '[]');
        } catch(e) {
          allowed = [];
        }
      }
    }
    const canManage = !user || user.role === 'Admin' || allowed.includes('*') || allowed.includes('template_add');

    const btnCreate = document.getElementById('btn-create-template');
    if (btnCreate) {
      btnCreate.style.display = canManage ? '' : 'none';
    }

    const res = await fetch('/api/templates');
    let temps = await res.json();
    
    // Filter by active tab
    temps = temps.filter(t => t.platform === currentTemplateTab);

    if (temps.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding: 20px 0; color:var(--text-muted);">No communication templates logged for ${currentTemplateTab} yet.</div>`;
      return;
    }

    container.innerHTML = temps.map(t => {
      const badgeClass = t.platform === 'WhatsApp' ? 'chip-closed' : (t.platform === 'Script' ? 'chip-warm' : 'chip-cold');
      const iconClass = t.platform === 'WhatsApp' ? 'ti-brand-whatsapp' : (t.platform === 'Script' ? 'ti-phone' : 'ti-mail');
      const deleteBtn = canManage ? `<button class="btn btn-ghost btn-sm" style="font-size:10px; padding:4px 8px; color:var(--red);" onclick="deleteTemplate(${t.id})"><i class="ti ti-trash"></i> Delete</button>` : '';
      const editBtn = canManage ? `<button class="btn btn-ghost btn-sm" style="font-size:10px; padding:4px 8px; color:var(--gold-l);" onclick="editTemplate(${t.id}, \`${escapeQuote(t.name)}\`, '${t.platform}', \`${escapeQuote(t.use_case)}\`, \`${escapeQuote(t.content)}\`)"><i class="ti ti-edit"></i> Edit</button>` : '';
      
      return `
        <div class="card" style="background: rgba(255,255,255,0.01); border: 1px solid rgba(212, 175, 55, 0.15); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); margin-bottom: 0;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <span style="font-size: 13.5px; font-weight: 700; color: #fff;">${t.name}</span>
              <span class="chip ${badgeClass}" style="font-size: 9.5px; display: inline-flex; align-items: center; gap: 4px; border-radius: 4px; padding: 2px 6px;"><i class="ti ${iconClass}"></i> ${t.platform}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">
              <strong style="color: var(--gold-l);">Use Case:</strong> ${t.use_case || 'Nurturing followups'}
            </div>
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.04); padding: 12px; border-radius: 6px; font-size: 12px; line-height: 1.6; color: var(--text-secondary); max-height: 120px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; word-break: break-word; scrollbar-width: thin;">${t.content}</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px; margin-top: 4px;">
            <button class="btn btn-ghost btn-sm" style="font-size:10.5px; padding:4px 8px;" onclick="copyTemplateText(this, \`${escapeQuote(t.content)}\`)"><i class="ti ti-copy"></i> Copy Content</button>
            <div style="display:flex; gap: 4px;">
              ${editBtn}
              ${deleteBtn}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    console.error(e);
  }
};

window.openCreateTemplateForm = function() {
  document.getElementById('edit-template-id').value = '';
  document.getElementById('new-template-name').value = '';
  document.getElementById('new-template-platform').value = currentTemplateTab;
  document.getElementById('new-template-usecase').value = '';
  document.getElementById('new-template-content').value = '';
  document.getElementById('template-form-title').innerHTML = '<i class="ti ti-playlist-add"></i> Create New Template';
  document.getElementById('template-create-block').style.display = 'block';
};

window.editTemplate = function(id, name, platform, use_case, content) {
  document.getElementById('edit-template-id').value = id;
  document.getElementById('new-template-name').value = name;
  document.getElementById('new-template-platform').value = platform;
  document.getElementById('new-template-usecase').value = use_case !== 'null' ? use_case : '';
  document.getElementById('new-template-content').value = content;
  document.getElementById('template-form-title').innerHTML = '<i class="ti ti-edit"></i> Edit Template';
  document.getElementById('template-create-block').style.display = 'block';
  document.getElementById('template-create-block').scrollIntoView({ behavior: 'smooth' });
};

window.closeCreateTemplateForm = function() {
  document.getElementById('template-create-block').style.display = 'none';
  document.getElementById('edit-template-id').value = '';
  document.getElementById('new-template-name').value = '';
  document.getElementById('new-template-usecase').value = '';
  document.getElementById('new-template-content').value = '';
};

window.saveTemplate = async function() {
  const id = document.getElementById('edit-template-id').value;
  const name = document.getElementById('new-template-name').value.trim();
  const platform = document.getElementById('new-template-platform').value;
  const use_case = document.getElementById('new-template-usecase').value.trim();
  const content = document.getElementById('new-template-content').value.trim();

  if (!name || !content) {
    showToast('Name and Content are required!');
    return;
  }

  try {
    const url = id ? `/api/templates/${id}` : '/api/templates';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, platform, use_case, content })
    });

    if (res.ok) {
      showToast(id ? 'Template updated successfully!' : 'Template script persisted successfully!');
      closeCreateTemplateForm();
      loadTemplates();
    } else {
      showToast('Failed to save template.');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to save template.');
  }
};

window.deleteTemplate = async function(id) {
  if (!confirm('Are you sure you want to delete this script template?')) return;
  try {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Template deleted.');
      loadTemplates();
    }
  } catch (err) {
    console.error(err);
  }
};


// 7. Duplicate Leads switch tabs & loader
window.switchEnquiryTab = function(tabId) {
  const mainTab = document.getElementById('btn-enq-tab-main');
  const dupTab = document.getElementById('btn-enq-tab-dup');
  const auditTab = document.getElementById('btn-enq-tab-audit');
  
  const mainCard = document.getElementById('enquiry-main-card');
  const dupCard = document.getElementById('enquiry-duplicates-card');
  const auditCard = document.getElementById('enquiry-audit-card');

  // Deactivate all tab headers
  [mainTab, dupTab, auditTab].forEach(btn => {
    if (btn) {
      btn.classList.remove('active');
      btn.style.borderBottomColor = 'transparent';
      btn.style.color = 'var(--text-secondary)';
    }
  });

  // Hide all cards
  [mainCard, dupCard, auditCard].forEach(card => {
    if (card) {
      card.classList.add('hidden');
    }
  });

  if (tabId === 'main') {
    if (mainTab) {
      mainTab.classList.add('active');
      mainTab.style.borderBottomColor = 'var(--gold)';
      mainTab.style.color = 'var(--gold-l)';
    }
    if (mainCard) mainCard.classList.remove('hidden');
  } else if (tabId === 'dup') {
    if (dupTab) {
      dupTab.classList.add('active');
      dupTab.style.borderBottomColor = 'var(--gold)';
      dupTab.style.color = 'var(--gold-l)';
    }
    if (dupCard) dupCard.classList.remove('hidden');
    loadLeadDuplicates();
  } else if (tabId === 'audit') {
    if (auditTab) {
      auditTab.classList.add('active');
      auditTab.style.borderBottomColor = 'var(--gold)';
      auditTab.style.color = 'var(--gold-l)';
    }
    if (auditCard) auditCard.classList.remove('hidden');
    loadDuplicateAuditLogs();
  }
};

window.loadLeadDuplicates = async function() {
  const container = document.getElementById('enquiry-duplicates-list-container');
  if (!container) return;

  try {
    const res = await fetch('/api/leads/duplicates');
    const data = await res.json();

    if (data.length === 0) {
      container.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 25px 0; color:var(--text-muted);">🟢 Fantastic! Zero duplicate phone logs detected in the active pipeline.</td></tr>`;
      return;
    }

    container.innerHTML = data.map(d => {
      const namesList = d.names.split(',').map((name, idx) => {
        const id = d.ids.split(',')[idx];
        return `<span style="display:inline-block; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; margin-right:4px;">${name} (ID: ${id})</span>`;
      }).join(' ');

      return `
        <tr>
          <td><strong style="color:var(--gold-l); font-size:12.5px;">${d.phone}</strong></td>
          <td><span class="badge badge-amber">${d.count} Leads</span></td>
          <td>${namesList}</td>
          <td><code>${d.ids}</code></td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="showToast('Duplicate Timeline logs linked!')" style="font-size:10px; padding:2px 6px;"><i class="ti ti-git-merge"></i> Auto Merge</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) {
    console.error(e);
  }
};





// ------------------------------------------
// GLOBAL SEARCH LOGIC
// ------------------------------------------
let globalSearchTimeout = null;

window.performGlobalSearch = function() {
  const input = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('global-search-results');
  const query = input.value.trim();

  if (!query) {
    resultsContainer.style.display = 'none';
    return;
  }

  if (globalSearchTimeout) clearTimeout(globalSearchTimeout);
  
  globalSearchTimeout = setTimeout(async () => {
    try {
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--gold-l);"><i class="ti ti-loader" style="animation: spin 1s linear infinite;"></i> Searching...</div>';

      const [leadsRes, propsRes, projsRes] = await Promise.all([
        fetch(`/api/leads?search=${encodeURIComponent(query)}`),
        fetch(`/api/properties?search=${encodeURIComponent(query)}`),
        fetch(`/api/projects?search=${encodeURIComponent(query)}`)
      ]);

      const leads = await leadsRes.json();
      const props = await propsRes.json();
      const projs = await projsRes.json();

      let html = '';
      
      if (leads.length > 0) {
        html += '<div class="gs-category-header"><i class="ti ti-users"></i> Leads</div>';
        leads.slice(0, 5).forEach(l => {
          html += `
            <div class="gs-result-item" onclick="document.getElementById('global-search-input').value=''; document.getElementById('global-search-results').style.display='none'; navToSegment('leads'); setTimeout(() => showLeadDetails(${l.id}), 100);">
              <strong style="font-size:12.5px; color:#fff;">${escapeQuote(l.name)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">${escapeQuote(l.phone || '')} | ${escapeQuote(l.status)}</div>
            </div>
          `;
        });
      }

      if (props.length > 0) {
        html += '<div class="gs-category-header"><i class="ti ti-building"></i> Inventory</div>';
        props.slice(0, 5).forEach(p => {
          html += `
            <div class="gs-result-item" onclick="document.getElementById('global-search-input').value=''; document.getElementById('global-search-results').style.display='none'; navToSegment('inventory'); setTimeout(() => showPropertyDetails('${p.prop_id}'), 100);">
              <strong style="font-size:12.5px; color:#fff;">${escapeQuote(p.society)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">${escapeQuote(p.location)} | ${escapeQuote(p.configuration)} | ${escapeQuote(p.price_raw)}</div>
            </div>
          `;
        });
      }

      if (projs.length > 0) {
        html += '<div class="gs-category-header"><i class="ti ti-building-skyscraper"></i> Projects</div>';
        projs.slice(0, 3).forEach(p => {
          html += `
            <div class="gs-result-item" onclick="document.getElementById('global-search-input').value=''; document.getElementById('global-search-results').style.display='none'; navToSegment('projects'); setTimeout(()=> { document.getElementById('filter-proj-search').value='${escapeQuote(p.project_name)}'; loadProjects(); }, 300);">
              <strong style="font-size:12.5px; color:#fff;">${escapeQuote(p.project_name)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">${escapeQuote(p.builder_name)} | ${escapeQuote(p.location)}</div>
            </div>
          `;
        });
      }

      if (!html) {
        html = '<div style="padding: 15px; text-align: center; color: var(--text-muted); font-size:12px;">No matching results found across the CRM.</div>';
      }

      resultsContainer.innerHTML = html;
    } catch(err) {
      console.error(err);
      resultsContainer.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--red); font-size:12px;">Error performing search.</div>';
    }
  }, 400);
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('global-search-results');
  const input = document.getElementById('global-search-input');
  if (container && input && !container.contains(e.target) && e.target !== input) {
    container.style.display = 'none';
  }
});


// ------------------------------------------
// GOOGLE SHEETS CLOUD IMPORT
// ------------------------------------------
window.importFromGoogleSheet = function() {
  const urlInput = document.getElementById('import-gsheets-url');
  const url = urlInput.value.trim();
  
  if (!url) {
    showToast('Please enter a Google Sheets URL.');
    return;
  }
  
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    showToast('Invalid Google Sheets URL format. Make sure it contains /d/YOUR_ID');
    return;
  }
  
  const sheetId = match[1];
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  
  showToast('Fetching data from Google Cloud...');
  
  Papa.parse(exportUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      if (!results.data || results.data.length === 0) {
        showToast('Sheet is empty or private. Please ensure "Anyone with the link can view" is enabled!');
        return;
      }
      showToast('Cloud data loaded successfully! Please map columns.');
      renderMappingUI(results.data, results.meta.fields);
    },
    error: function(err) {
      // Fallback to proxy if direct download fails due to CORS
      fetch('/api/system/proxy-gsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: exportUrl })
      })
      .then(res => {
        if (!res.ok) throw new Error('Proxy failed');
        return res.text();
      })
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: function(resProxy) {
            if (!resProxy.data || resProxy.data.length === 0) {
              showToast('Sheet is empty or private.');
              return;
            }
            showToast('Cloud data loaded successfully! Please map columns.');
            renderMappingUI(resProxy.data, resProxy.meta.fields);
          }
        });
      })
      .catch(proxyErr => {
        console.error(proxyErr);
        showToast('Error fetching sheet. Please ensure it is set to "Anyone with the link can view"!');
      });
    }
  });
};

// ============================================
// ADMIN REPORTS MODULE
// ============================================
let currentReportTimeframe = 'Monthly';

window.switchReportTimeframe = function(tf) {
  currentReportTimeframe = tf;
  document.querySelectorAll('.report-tf-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-tf') === tf);
    if (p.getAttribute('data-tf') === tf) {
      p.style.background = 'var(--gold)';
      p.style.color = '#1a1714';
      p.style.borderColor = 'var(--gold)';
    } else {
      p.style.background = 'rgba(255,255,255,0.05)';
      p.style.color = '#fff';
      p.style.borderColor = 'rgba(255,255,255,0.1)';
    }
  });
  loadAdminReportsPage();
};

window.loadAdminReportsPage = async function() {
  try {
    const res = await fetch(`/api/reports/admin?timeframe=${currentReportTimeframe}`);
    const data = await res.json();
    if (!data.success) return;
    
    // Render KPI Grid
    const kpiGrid = document.getElementById('report-kpi-grid');
    if (kpiGrid) {
      const s = data.summary;
      const kpis = [
        { label: 'Total Leads', value: s.totalLeads, color: 'var(--gold)', icon: 'ti-users' },
        { label: 'New Leads', value: s.newLeads, color: 'var(--blue)', icon: 'ti-user-plus' },
        { label: 'Conversions', value: s.convertedLeads, color: 'var(--green)', icon: 'ti-trophy' },
        { label: 'Conv. Rate', value: s.conversionRate + '%', color: 'var(--amber)', icon: 'ti-percentage' },
        { label: 'Revenue', value: '₹' + formatIndianNumber(s.totalRevenue), color: 'var(--gold-l)', icon: 'ti-currency-rupee' },
        { label: 'Avg Deal', value: '₹' + formatIndianNumber(s.avgDealSize), color: 'var(--purple)', icon: 'ti-receipt' },
        { label: 'Active Pipeline', value: s.activePipeline, color: 'var(--blue-light)', icon: 'ti-chart-dots-3' }
      ];
      kpiGrid.innerHTML = kpis.map(k => `
        <div class="report-kpi-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 16px; border-radius: var(--radius-md); text-align: center; border-top: 3px solid ${k.color};">
          <div style="font-size:10px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;"><i class="ti ${k.icon}" style="margin-right:4px;"></i>${k.label}</div>
          <div style="font-size:24px; font-weight:800; color:${k.color}; margin-top:6px;">${k.value}</div>
        </div>
      `).join('');
    }

    // Render Source Chart (horizontal bars)
    const sourceChart = document.getElementById('report-source-chart');
    if (sourceChart && data.leadsBySource) {
      const maxCount = Math.max(...data.leadsBySource.map(s => parseInt(s.count))) || 1;
      const colors = ['var(--gold)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--amber)', 'var(--slate-light)'];
      sourceChart.innerHTML = data.leadsBySource.length === 0 
        ? '<div style="color:var(--text-muted);font-size:12px;padding:20px;text-align:center;">No lead source data for this period</div>'
        : data.leadsBySource.map((s, i) => `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;" onclick="routeToSource('${s.source}')">
          <span style="width:80px; font-size:11px; color:var(--text-secondary); text-align:right; flex-shrink:0;">${s.source || 'Other'}</span>
          <div style="flex:1; height:22px; background:rgba(255,255,255,0.03); border-radius:4px; overflow:hidden;">
            <div style="height:100%; width:${(parseInt(s.count)/maxCount*100)}%; background:${colors[i % colors.length]}; border-radius:4px; transition:width 0.5s ease;"></div>
          </div>
          <span style="font-size:12px; font-weight:700; color:var(--text-primary); width:30px;">${s.count}</span>
        </div>
      `).join('');
    }

    // Render Stage Chart (horizontal bars)
    const stageChart = document.getElementById('report-stage-chart');
    if (stageChart && data.leadsByStage) {
      const stageColors = { New: 'var(--slate-light)', Contacted: 'var(--blue)', Qualified: 'var(--amber)', Proposal: 'var(--purple)', Won: 'var(--green)', Lost: 'var(--red)' };
      const maxCount = Math.max(...data.leadsByStage.map(s => parseInt(s.count))) || 1;
      stageChart.innerHTML = data.leadsByStage.length === 0
        ? '<div style="color:var(--text-muted);font-size:12px;padding:20px;text-align:center;">No pipeline data for this period</div>'
        : data.leadsByStage.map(s => `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;" onclick="routeToStage('${s.stage}')">
          <span style="width:80px; font-size:11px; color:var(--text-secondary); text-align:right; flex-shrink:0;">${s.stage || 'Unknown'}</span>
          <div style="flex:1; height:22px; background:rgba(255,255,255,0.03); border-radius:4px; overflow:hidden;">
            <div style="height:100%; width:${(parseInt(s.count)/maxCount*100)}%; background:${stageColors[s.stage] || 'var(--slate-light)'}; border-radius:4px; transition:width 0.5s ease;"></div>
          </div>
          <span style="font-size:12px; font-weight:700; color:var(--text-primary); width:30px;">${s.count}</span>
        </div>
      `).join('');
    }

    // Render Agent Leaderboard table
    const agentTable = document.getElementById('report-agent-table');
    if (agentTable && data.agentPerformance) {
      agentTable.innerHTML = data.agentPerformance.length === 0
        ? '<div style="color:var(--text-muted);font-size:12px;padding:20px;text-align:center;">No agent data available</div>'
        : `<table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead><tr style="border-bottom:1px solid var(--border); text-align:left;">
            <th style="padding:8px; color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Rank</th>
            <th style="padding:8px; color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Agent</th>
            <th style="padding:8px; color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Leads</th>
            <th style="padding:8px; color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Closings</th>
            <th style="padding:8px; color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Revenue</th>
            <th style="padding:8px; color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Rating</th>
          </tr></thead>
          <tbody>
            ${data.agentPerformance.sort((a,b) => b.deals_won - a.deals_won).map((a, i) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${i===0 ? 'background:rgba(212, 175, 55,0.08);' : ''}">
                <td style="padding:10px 8px; font-weight:700; color:${i===0?'var(--gold)':'var(--text-primary)'};">  ${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</td>
                <td style="padding:10px 8px; font-weight:600; color:var(--text-primary);">${a.name}</td>
                <td style="padding:10px 8px; color:var(--text-secondary);">${a.leads}</td>
                <td style="padding:10px 8px; color:var(--green); font-weight:700;">${a.deals_won}</td>
                <td style="padding:10px 8px; color:var(--gold-l); font-weight:600;">₹${formatIndianNumber(a.volume)}</td>
                <td style="padding:10px 8px;">⭐ ${a.performance_rating}/10</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    }

    // Render Activity Summary
    const activitySummary = document.getElementById('report-activity-summary');
    if (activitySummary && data.activityLog) {
      const acts = [
        { icon: 'ti-phone-call', label: 'Calls Made', value: data.activityLog.totalCalls, color: 'var(--blue)' },
        { icon: 'ti-map-pin', label: 'Site Visits', value: data.activityLog.totalSiteVisits, color: 'var(--green)' },
        { icon: 'ti-brand-whatsapp', label: 'WhatsApp', value: data.activityLog.totalWhatsApp, color: 'var(--green)' },
        { icon: 'ti-mail', label: 'Emails', value: data.activityLog.totalEmails, color: 'var(--amber)' }
      ];
      activitySummary.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">${acts.map(a => `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); padding:12px; border-radius:var(--radius-md); text-align:center; border-left:3px solid ${a.color};">
          <div style="font-size:10px; color:var(--text-secondary); text-transform:uppercase;"><i class="ti ${a.icon}"></i> ${a.label}</div>
          <div style="font-size:22px; font-weight:800; color:${a.color}; margin-top:4px;">${a.value}</div>
        </div>
      `).join('')}</div>`;
    }

    // Render Top Properties
    const topProps = document.getElementById('report-top-properties');
    if (topProps && data.topProperties) {
      topProps.innerHTML = data.topProperties.length === 0
        ? '<div style="color:var(--text-muted);font-size:12px;padding:20px;text-align:center;">No enquiry data available</div>'
        : data.topProperties.map((p, i) => `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
          <span style="font-size:14px; font-weight:800; color:var(--gold); width:24px;">${i+1}.</span>
          <div style="flex:1;">
            <div style="font-size:12px; font-weight:600; color:var(--text-primary);">${p.society || p.title || 'Property #'+p.property_id}</div>
            <div style="font-size:10px; color:var(--text-secondary);">${p.location || 'N/A'}</div>
          </div>
          <span class="badge badge-amber" style="font-size:10px;">${p.enquiries} enquiries</span>
        </div>
      `).join('');
    }

  } catch(e) { console.error('Failed to load admin reports', e); }
};

function formatIndianNumber(num) {
  if (!num || num === 0) return '0';
  const n = parseFloat(num);
  if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000) return (n / 100000).toFixed(2) + ' L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

window.exportAdminReport = function() {
  window.print();
};

window.updatePropertyInline = async function(id, field, el) {
  let val = el.innerText.trim();
  if (field === 'price' || field === 'area_sqft' || field === 'deposit' || field === 'maintenance') {
    let cleanVal = val.replace(/[^\d.]/g, '');
    let parsed = parseFloat(cleanVal) || 0;
    
    if (/lakh|l\b/i.test(val)) {
      parsed = parsed * 100000;
    } else if (/crore|cr\b/i.test(val)) {
      parsed = parsed * 10000000;
    }
    val = parsed;
  }
  
  try {
    const res = await fetch(`/api/properties/${id}/inline`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: field, value: val })
    });
    if (res.ok) {
      showToast('Live Spreadsheet Sync Complete.');
      const resData = await res.json();
      
      const idx = state.properties.findIndex(x => x.id == id);
      if (idx !== -1) {
        state.properties[idx] = resData.property;
      }
      
      if (field === 'price') {
        el.innerText = formatPriceToWords(val);
      }
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update cell inline.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to update cell inline.', 'error');
  }
};

(function() {
  const style = document.createElement('style');
  style.innerHTML = `
    .editable-cell {
      border: 1px dashed transparent !important;
      padding: 2px 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
      outline: none;
    }
    .editable-cell:hover {
      border: 1px dashed var(--gold-l) !important;
      background: rgba(212, 175, 55, 0.08) !important;
    }
    .editable-cell:focus {
      border: 1px solid var(--gold) !important;
      background: rgba(212, 175, 55, 0.15) !important;
      box-shadow: 0 0 8px rgba(212, 175, 55, 0.3) !important;
    }
  `;
  document.head.appendChild(style);
})();

function printPropertyCard(id) {
  const p = state.properties.find(x => x.id === id);
  if (!p) return;

  const specs = [];
  const pType = (p.property_type || '').toLowerCase();
  const isLand = pType.includes('land') || pType.includes('plot');

  specs.push({ label: 'Property Type', value: p.property_type || 'N/A' });
  
  if (isLand) {
    specs.push({ label: 'Zoning / Land Use', value: p.configuration || 'N/A' });
    specs.push({ label: 'Plot Size', value: p.plot_size ? p.plot_size + ' Sqft' : 'N/A' });
    specs.push({ label: 'Dimensions', value: p.plot_dimension || 'N/A' });
    specs.push({ label: 'Road Width', value: p.road_width || 'N/A' });
    specs.push({ label: 'FSI Allowed', value: p.fsi || 'N/A' });
    specs.push({ label: 'Plot Facing', value: p.plot_facing || 'N/A' });
  } else {
    specs.push({ label: 'Configuration', value: p.configuration || 'N/A' });
    specs.push({ label: 'Super Built-up Area', value: p.area_sqft ? p.area_sqft + ' Sqft' : 'N/A' });
    specs.push({ label: 'Furnishing Status', value: p.interiors || 'N/A' });
    specs.push({ label: 'Facing', value: p.facing || 'East' });
    specs.push({ label: 'Possession Status', value: p.possession || 'Ready' });
    specs.push({ label: 'Car Parking', value: p.car_park || 'N/A' });
    if (p.zone) specs.push({ label: 'Micro-market Zone', value: p.zone });
  }
  
  if (p.deposit) specs.push({ label: 'Security Deposit', value: '₹' + parseFloat(p.deposit).toLocaleString('en-IN') });
  if (p.maintenance) specs.push({ label: 'Maintenance Fee', value: '₹' + parseFloat(p.maintenance).toLocaleString('en-IN') });
  if (p.registration_status) specs.push({ label: 'Registration Status', value: p.registration_status });
  if (p.onboarded_year) specs.push({ label: 'Onboarded Year', value: p.onboarded_year });

  const specHTML = specs.map(s => `
    <div class="spec-item">
      <span class="spec-label">${s.label}</span>
      <span class="spec-value">${s.value}</span>
    </div>
  `).join('');

  const mapBtnHTML = p.google_map_url ? `
    <div class="map-btn-container">
      <a href="${p.google_map_url}" target="_blank" class="map-btn">
        📍 Open Location Google Map
      </a>
    </div>
  ` : '';

  const descHTML = p.additional_info ? `
    <div>
      <div class="section-title">Overview & Remarks</div>
      <div class="description-box">${p.additional_info}</div>
    </div>
  ` : '';

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Property Presentation - ${p.prop_id || ('#' + p.id)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', sans-serif;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            background-color: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
          }
          .luxury-header {
            border-bottom: 2px solid #d4af37;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .brand-title {
            font-family: 'Playfair Display', serif;
            color: #1a1a1a;
            margin: 0;
            font-size: 32px;
            letter-spacing: 1.5px;
            font-weight: 700;
          }
          .brand-subtitle {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #d4af37;
            margin-top: 5px;
            font-weight: 600;
          }
          .contact-info {
            text-align: right;
            font-size: 11.5px;
            line-height: 1.6;
            color: #555;
          }
          .property-title-section {
            margin-bottom: 25px;
          }
          .prop-id-badge {
            display: inline-block;
            background: rgba(212, 175, 55, 0.1);
            border: 1px solid #d4af37;
            color: #b8860b;
            font-size: 10px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .property-name {
            font-family: 'Playfair Display', serif;
            font-size: 28px;
            color: #111;
            margin: 0 0 5px 0;
            font-weight: 700;
          }
          .property-location {
            font-size: 14px;
            color: #666;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .price-tag {
            font-family: 'Inter', sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: #27ae60;
            margin-top: 15px;
            padding: 10px 15px;
            background: #f4fbf7;
            border-left: 4px solid #27ae60;
            display: inline-block;
          }
          .section-title {
            font-family: 'Playfair Display', serif;
            font-size: 18px;
            color: #1a1a1a;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
            margin-top: 30px;
            margin-bottom: 15px;
            font-weight: 700;
          }
          .spec-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px 30px;
          }
          .spec-item {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px dashed #e5e5e5;
            padding-bottom: 6px;
            font-size: 13.5px;
          }
          .spec-label {
            color: #666;
            font-weight: 500;
          }
          .spec-value {
            color: #111;
            font-weight: 600;
          }
          .description-box {
            font-size: 13.5px;
            line-height: 1.7;
            color: #444;
            background: #fafafa;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #f0f0f0;
            margin-top: 15px;
          }
          .map-btn-container {
            margin-top: 25px;
            text-align: center;
          }
          .map-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #d4af37;
            color: #fff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13.5px;
            transition: background 0.2s;
          }
          .luxury-footer {
            margin-top: 50px;
            border-top: 1px solid #d4af37;
            padding-top: 20px;
            text-align: center;
            font-size: 11px;
            color: #888;
            letter-spacing: 0.5px;
          }
          @media print {
            body {
              background: #fff;
            }
            .map-btn {
              background: #d4af37 !important;
              color: #fff !important;
            }
            .print-container {
              padding: 20px;
            }
            .map-btn-container {
              display: none; /* Do not print map button since it is interactive */
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <div class="luxury-header">
            <div>
              <div class="brand-title">SUBH HOMES</div>
              <div class="brand-subtitle">Premium Real Estate Advisory</div>
            </div>
            <div class="contact-info">
              <strong>Vasu Jain</strong><br>
              📞 +91 98200 12345<br>
              ✉️ info@subhhomes.com<br>
              🌐 www.subhhomes.com
            </div>
          </div>

          <div class="property-title-section">
            <span class="prop-id-badge">ID: ${p.prop_id || ('#' + p.id)}</span>
            <h1 class="property-name">${p.society}</h1>
            <div class="property-location">📍 ${p.location}</div>
            <div class="price-tag">${p.price_raw || formatPriceToWords(p.price) || 'Price on Request'}</div>
          </div>

          <div>
            <div class="section-title">Property Details</div>
            <div class="spec-grid">
              ${specHTML}
            </div>
          </div>

          ${descHTML}
          ${mapBtnHTML}

          <div class="luxury-footer">
            Subh Homes • Premium Real Estate Advisory • Vasu Jain +91 98200 12345 • info@subhhomes.com
          </div>
        </div>
        <script>
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

window.updateClosureFlowUI = function() {
  const steps = [
    { id: 'step-site-visit', chkId: 'chk-site-visit', label: 'Site Visit' },
    { id: 'step-negotiation', chkId: 'chk-negotiation', label: 'Negotiation' },
    { id: 'step-agreement', chkId: 'chk-agreement', label: 'Agreement' },
    { id: 'step-registration', chkId: 'chk-registration', label: 'Registration' },
    { id: 'step-closed', chkId: 'chk-closed', label: 'Deal Closed' }
  ];

  let currentStage = 'New Requirement';
  steps.forEach(step => {
    const el = document.getElementById(step.id);
    const checked = document.getElementById(step.chkId)?.checked;
    if (el) {
      if (checked) {
        el.style.background = 'rgba(46, 204, 113, 0.2)';
        el.style.borderColor = 'var(--green)';
        el.style.color = 'var(--green)';
        currentStage = step.label;
      } else {
        el.style.background = 'rgba(255, 255, 255, 0.03)';
        el.style.borderColor = 'var(--border)';
        el.style.color = 'var(--text-light)';
      }
    }
  });

  const statusEl = document.getElementById('closure-current-status');
  if (statusEl) {
    statusEl.innerText = currentStage;
    statusEl.style.color = currentStage === 'Deal Closed' ? 'var(--green)' : 'var(--gold-l)';
  }
};

window.updateClosureChecklist = function(stepKey, checked) {
  updateClosureFlowUI();
};

window.saveClosureDetails = async function() {
  const leadId = document.getElementById('detail-lead-id').value;
  if (!leadId) return;

  const payload = {
    closure_site_visit: document.getElementById('chk-site-visit').checked,
    closure_joint_visit: document.getElementById('chk-joint-visit').checked,
    closure_negotiation: document.getElementById('chk-negotiation').checked,
    closure_agreement: document.getElementById('chk-agreement').checked,
    closure_registration: document.getElementById('chk-registration').checked,
    closure_closed: document.getElementById('chk-closed').checked,
    closure_prop_id: document.getElementById('closure-prop-id').value,
    closure_commission_amt: document.getElementById('closure-commission-amt').value,
    closure_notes: document.getElementById('closure-notes').value
  };

  try {
    const res = await fetch(`/api/leads/${leadId}/closure`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      showToast('Closure Journey transaction details saved successfully.', 'success');
      if (payload.closure_closed) {
        if (typeof window.loadEnquiries === 'function') window.loadEnquiries();
        if (typeof window.loadPipelineBoard === 'function') window.loadPipelineBoard();
      }
    } else {
      showToast(result.error || 'Failed to save closure details.', 'error');
    }
  } catch (err) {
    console.error('Error saving closure details:', err);
    showToast('Network error saving closure details.', 'error');
  }
};

async function loadTodayActivityFeed() {
  try {
    const res = await fetch('/api/admin/today-activity');
    const data = await res.json();
    
    const feed = document.getElementById('today-activity-feed');
    const badge = document.getElementById('today-alerts-count');
    if (!feed) return;

    const items = [];
    
    // Process new properties
    if (data.properties && data.properties.length > 0) {
      data.properties.forEach(p => {
        items.push({
          type: 'property',
          time: new Date(p.created_at),
          html: `
            <div style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(46, 204, 113, 0.08); border-radius:4px; border-left:3px solid var(--green); font-size:12px;">
              <span style="font-size:16px;">🏠</span>
              <div style="flex:1;">
                <strong>New Property Listing Added:</strong> ${p.society} (${p.property_type}) in <strong>${p.location}</strong>
                <span class="chip chip-cold btn-sm" style="font-size:9.5px; cursor:pointer;" onclick="editID('properties', ${p.id}, '${p.prop_id || ''}')">ID: ${p.prop_id || '#' + p.id}</span>
                <span style="color:var(--green); font-weight:700; margin-left:8px;">${formatPriceToWords(p.price)}</span>
              </div>
            </div>
          `
        });
      });
    }

    // Process new leads
    if (data.leads && data.leads.length > 0) {
      data.leads.forEach(l => {
        items.push({
          type: 'lead',
          time: new Date(l.created_at),
          html: `
            <div style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(52, 152, 219, 0.08); border-radius:4px; border-left:3px solid var(--blue); font-size:12px;">
              <span style="font-size:16px;">👥</span>
              <div style="flex:1;">
                <strong>New Client Lead Requirement:</strong> <strong style="cursor:pointer; text-decoration:underline;" onclick="showLeadDetails(${l.id})">${l.name}</strong> seeks <strong>${l.project_type}</strong>
                <span class="badge" style="background:rgba(201, 153, 26, 0.08); color:var(--gold-l); font-size:9px; padding:1.5px 5px; font-weight:700; margin-left:8px;"><i class="ti ti-user"></i> Assigned: ${l.agent_name || 'Unassigned'}</span>
              </div>
            </div>
          `
        });
      });
    }

    // Process new projects
    if (data.projects && data.projects.length > 0) {
      data.projects.forEach(p => {
        items.push({
          type: 'project',
          time: new Date(p.created_at),
          html: `
            <div style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(230, 126, 34, 0.08); border-radius:4px; border-left:3px solid #e67e22; font-size:12px;">
              <span style="font-size:16px;">🏢</span>
              <div style="flex:1;">
                <strong>New Primary Builder Project Launched:</strong> <strong>${p.project_name}</strong> by ${p.builder_name} in <strong>${p.location}</strong>
                <button class="btn btn-ghost btn-sm" onclick="editID('builder_projects', ${p.id}, '')" style="font-size:10px; padding:2px 4px; border:0.5px solid var(--border); margin-left:8px;">View Project</button>
              </div>
            </div>
          `
        });
      });
    }

    // Sort items newest first
    items.sort((a,b) => b.time - a.time);

    if (badge) {
      badge.innerText = `${items.length} alerts`;
      badge.className = items.length > 0 ? 'badge badge-red' : 'badge badge-blue';
    }

    if (items.length === 0) {
      feed.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:15px;">No activity logged yet today.</div>`;
    } else {
      feed.innerHTML = items.map(it => it.html).join('');
    }
  } catch (err) {
    console.error('Error loading today activity feed:', err);
  }
}
window.loadTodayActivityFeed = loadTodayActivityFeed;

async function loadRawLeads() {
  try {
    const searchInput = document.getElementById('filter-raw-search');
    const search = searchInput ? searchInput.value : '';
    let url = `/api/leads?stage=Raw%20Lead&search=${encodeURIComponent(search)}`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Update count badge on sidebar
    const rawCountBadge = document.getElementById('sidebar-raw-count');
    if (rawCountBadge) {
      rawCountBadge.innerText = data.length;
      rawCountBadge.style.display = data.length > 0 ? 'inline-block' : 'none';
    }

    const tbody = document.getElementById('raw-leads-list');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">No raw leads found. Use "Import Dataset" to populate.</td></tr>`;
      return;
    }

    const itemsPerPage = 50;
    const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
    const startIdx = ((state.rawLeadsPage || 1) - 1) * itemsPerPage;
    const pagedData = data.slice(startIdx, startIdx + itemsPerPage);
    
    const pagWrapper = document.getElementById('raw-leads-pagination-wrapper');
    if (pagWrapper) pagWrapper.innerHTML = renderPaginationBar('raw-leads', state.rawLeadsPage || 1, totalPages, 'changeRawLeadsPage');

    tbody.innerHTML = pagedData.map(l => {
      // Tags
      const tags = (l.special_tags || '').split(',').filter(t => t.trim());
      const tagsHtml = tags.map(t => `<span class="badge" style="background:rgba(255,255,255,0.06); font-size:9.5px; border:0.5px solid var(--border); margin-right:2px; display:inline-block; margin-top:2px;">${t.trim()}</span>`).join('');

      return `
        <tr>
          <td><input type="checkbox" class="row-checkbox-raw-leads" value="${l.id}" onchange="updateBulkSelectionState('raw-leads')"></td>
          <td style="padding: 10px 8px; border-bottom: 1px solid var(--border);">
            <strong style="font-size:13px; color:var(--text-light);">${l.name}</strong><br>
            <span style="font-size:9.5px; font-weight:700; color:var(--gold-l); background:rgba(201, 153, 26, 0.1); border: 0.5px solid rgba(201,153,26,0.2); padding:1px 4.5px; border-radius:3px; font-family:monospace; display:inline-block; margin-top:4px;">${l.custom_lead_id || ('LD-' + (1000 + l.id))}</span>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid var(--border);">
            <span style="font-size:12px;">📱 ${l.phone || 'N/A'}</span><br>
            <span style="font-size:11px; color:var(--text-muted)">✉️ ${l.email || 'N/A'}</span>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid var(--border);">
            <span style="font-size:11.5px;">${l.source || 'N/A'}</span><br>
            <div style="margin-top:4px;">${tagsHtml}</div>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid var(--border); font-size:11.5px; color:var(--text-muted);">
            ${l.created_at ? new Date(l.created_at).toLocaleString() : 'N/A'}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid var(--border);">
            <strong>${l.agent_name || 'Unassigned'}</strong>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid var(--border);">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <button class="btn btn-sm" style="background:var(--gold); color:#000; font-size:10.5px; padding:3px 8px; font-weight:700;" onclick="qualifyRawLead(${l.id})"><i class="ti ti-checklist"></i> Qualify & Contact</button>
              <button class="btn btn-ghost btn-sm" style="font-size:10px; padding:2px 6px; color:var(--red);" onclick="deleteLead(${l.id}, 'raw')">✕ Remove</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}
window.loadRawLeads = loadRawLeads;

window.changeRawLeadsPage = function(tab, pageNum) {
  state.rawLeadsPage = pageNum;
  loadRawLeads();
};

window.qualifyRawLead = function(id) {
  window.editLeadData(id);
};

async function updateRawLeadsCountBadge() {
  try {
    const res = await fetch('/api/leads?stage=Raw%20Lead');
    const data = await res.json();
    const rawCountBadge = document.getElementById('sidebar-raw-count');
    if (rawCountBadge) {
      rawCountBadge.innerText = data.length;
      rawCountBadge.style.display = data.length > 0 ? 'inline-block' : 'none';
    }
  } catch (e) {
    console.error('Failed to update raw leads count:', e);
  }
}
window.updateRawLeadsCountBadge = updateRawLeadsCountBadge;

async function loadDuplicateAuditLogs() {
  try {
    const res = await fetch('/api/duplicate-leads-audit');
    const logs = await res.json();
    const pendingLogs = logs.filter(log => log.action_taken === 'Pending Review' || log.action_taken.toLowerCase().includes('pending'));
    const pendingCountEl = document.getElementById('dup-audit-pending-count');
    if (pendingCountEl) {
      pendingCountEl.innerText = `${pendingLogs.length} Pending Review`;
    }
    const tbody = document.getElementById('duplicate-audit-list');
    if (!tbody) return;
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty">No duplicate lead audit logs recorded.</td></tr>`;
      return;
    }
    tbody.innerHTML = logs.map(log => {
      let statusClass = 'chip-warm';
      if (log.action_taken.includes('Merged') || log.action_taken.includes('Allowed')) {
        statusClass = 'chip-green';
      } else if (log.action_taken.includes('Dismissed') || log.action_taken.includes('Deleted')) {
        statusClass = 'chip-cold';
      }
      const isPending = log.action_taken === 'Pending Review' || log.action_taken.toLowerCase().includes('pending');
      const actionButtons = isPending ? `
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" style="background:var(--green); color:#fff; font-size:11px; padding:3px 8px;" onclick="resolveDuplicateLead(${log.id}, 'allow')"><i class="ti ti-check"></i> Allow Import</button>
          <button class="btn btn-sm" style="background:var(--gold); color:#000; font-size:11px; padding:3px 8px;" onclick="resolveDuplicateLead(${log.id}, 'merge')"><i class="ti ti-git-merge"></i> Merge Notes</button>
          <button class="btn btn-sm btn-ghost" style="color:var(--text-muted); font-size:11px; padding:3px 8px;" onclick="resolveDuplicateLead(${log.id}, 'dismiss')">✕ Dismiss</button>
        </div>
      ` : `
        <button class="btn btn-ghost btn-sm" style="color:var(--red); font-size:11px; padding:2px 6px;" onclick="resolveDuplicateLead(${log.id}, 'dismiss-delete')"><i class="ti ti-trash"></i> Delete Log</button>
      `;
      const dateStr = log.detected_at ? new Date(log.detected_at).toLocaleString() : 'N/A';
      return `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid var(--border);">
            <strong>${log.lead_name}</strong><br>
            <span style="font-size:11px; color:var(--text-muted)">📱 ${log.phone || 'N/A'} | ✉️ ${log.email || 'N/A'}</span><br>
            <span style="font-size:10px; color:var(--gold)">Source: ${log.source || 'N/A'}</span><br>
            <span style="font-size:9.5px; color:var(--text-muted)">Detected: ${dateStr}</span>
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid var(--border);">
            ${log.existing_lead_id ? `
              <strong style="cursor:pointer; text-decoration:underline; color:var(--gold);" onclick="showLeadDetails(${log.existing_lead_id})">${log.existing_lead_name || 'View Lead'}</strong><br>
              <span style="font-size:10px; color:var(--text-muted)">ID: LD-${1000 + log.existing_lead_id}</span>
            ` : `<span style="color:var(--text-muted)">No longer exists</span>`}
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid var(--border);">
            <span class="chip ${statusClass}">${log.action_taken}</span>
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid var(--border);">
            ${actionButtons}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load duplicate audit logs:', err);
  }
}
window.loadDuplicateAuditLogs = loadDuplicateAuditLogs;

async function resolveDuplicateLead(id, action) {
  try {
    const res = await fetch(`/api/duplicate-leads-audit/resolve/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const result = await res.json();
    if (result.success || res.ok) {
      showToast(result.message || 'Duplicate log resolved successfully.');
      loadDuplicateAuditLogs();
      if (typeof loadEnquiries === 'function') loadEnquiries();
    } else {
      showToast(result.error || 'Failed to resolve duplicate lead.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Network error while resolving duplicate lead.', 'error');
  }
}
window.resolveDuplicateLead = resolveDuplicateLead;

async function populateAllAgentSelects() {
  try {
    const aRes = await fetch('/api/agents');
    const agents = await aRes.json();
    const selects = [
      { id: 'lead-agent', defaultText: '-- Assign Agent --' },
      { id: 'edit-lead-agent', defaultText: '-- Assign Agent --' },
      { id: 'filter-enq-agent', defaultText: 'All Agents' },
      { id: 'filter-lead-agent', defaultText: 'All Agents' }
    ];
    selects.forEach(selInfo => {
      const el = document.getElementById(selInfo.id);
      if (el) {
        const currentVal = el.value;
        el.innerHTML = `<option value="">${selInfo.defaultText}</option>`;
        agents.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.innerText = a.name;
          el.appendChild(opt);
        });
        if (currentVal) {
          el.value = currentVal;
        }
      }
    });
  } catch (err) {
    console.error('Failed to populate agent selects:', err);
  }
}
window.populateAllAgentSelects = populateAllAgentSelects;

