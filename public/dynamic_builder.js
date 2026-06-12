// ==========================================
// ENTERPRISE DYNAMIC BUILDER CONTROLLER LOGIC
// ==========================================

window.builderState = {
  activeTab: 'forms',
  forms: [],
  selectedForm: null,
  workflows: [],
  tables: [],
  selectedTable: null,
  selectedTableRows: [],
  tempTableFields: []
};

window.loadDynamicBuilder = async function() {
  await window.switchBuilderTab(window.builderState.activeTab);
};

window.switchBuilderTab = async function(tab) {
  window.builderState.activeTab = tab;
  
  // Update Tab active style
  const tabsList = ['forms', 'workflows', 'tables', 'reports'];
  tabsList.forEach(t => {
    const btn = document.getElementById(`btn-builder-tab-${t}`);
    const pane = document.getElementById(`builder-panel-${t}`);
    if (t === tab) {
      if (btn) {
        btn.classList.add('active');
        btn.style.borderBottomColor = 'var(--gold)';
      }
      if (pane) pane.classList.remove('hidden');
    } else {
      if (btn) {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
      }
      if (pane) pane.classList.add('hidden');
    }
  });

  // Load specific tab dataset
  if (tab === 'forms') {
    await window.loadBuilderForms();
  } else if (tab === 'workflows') {
    await window.loadBuilderWorkflows();
  } else if (tab === 'tables') {
    await window.loadBuilderTables();
  } else if (tab === 'reports') {
    await window.initReportsCenter();
  }
};

// Helper to escape HTML characters
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ------------------------------------------
// 1. FORM BUILDER TAB CONTROLLER
// ------------------------------------------

window.loadBuilderForms = async function() {
  try {
    const res = await fetch('/api/custom-forms');
    const data = await res.json();
    window.builderState.forms = data;

    const container = document.getElementById('builder-forms-list-container');
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:10px;">No forms registered.</div>`;
      document.getElementById('builder-form-canvas').style.display = 'none';
      return;
    }

    container.innerHTML = data.map(f => `
      <div class="card-option" style="padding:10px; border:1px solid var(--border); border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15);" onclick="window.selectBuilderForm(${f.id})">
        <div>
          <strong style="font-size:12px; color:var(--text-light);">${escapeHTML(f.name)}</strong>
          <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Module: ${f.module_type}</div>
        </div>
        <div style="display:flex; gap:4px;" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" style="padding:2px 6px; font-size:10px;" onclick="window.duplicateBuilderForm(${f.id})" title="Duplicate Form"><i class="ti ti-copy"></i></button>
          <button class="btn btn-ghost btn-sm" style="padding:2px 6px; font-size:10px; color:var(--red);" onclick="window.deleteBuilderForm(${f.id})" title="Delete Form"><i class="ti ti-trash"></i></button>
        </div>
      </div>
    `).join('');

    if (window.builderState.selectedForm) {
      const exists = data.find(f => f.id === window.builderState.selectedForm.id);
      if (exists) {
        window.selectBuilderForm(exists.id);
      } else {
        document.getElementById('builder-form-canvas').style.display = 'none';
      }
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to load forms.');
  }
};

window.selectBuilderForm = function(id) {
  const form = window.builderState.forms.find(f => f.id === id);
  if (!form) return;

  window.builderState.selectedForm = form;
  document.getElementById('builder-form-canvas').style.display = 'block';
  document.getElementById('builder-form-name').innerHTML = `<i class="ti ti-file-text"></i> ${escapeHTML(form.name)} <span style="font-size:10.5px; color:var(--text-muted); font-weight:normal; margin-left:8px;">[${form.module_type}]</span>`;

  window.renderFormCanvas();
};

window.renderFormCanvas = function() {
  const container = document.getElementById('builder-form-sections-container');
  if (!container || !window.builderState.selectedForm) return;

  const sections = window.builderState.selectedForm.sections || [];
  if (sections.length === 0) {
    container.innerHTML = `<div style="font-size:11.5px; color:var(--text-secondary); text-align:center; padding:30px; border:1.5px dashed var(--border); border-radius:6px; background:rgba(0,0,0,0.1);">Canvas is empty. Click "+ Add Section" to build layout.</div>`;
    return;
  }

  container.innerHTML = sections.map((sec, secIdx) => `
    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:15px; border-radius:6px; position:relative;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:8px; margin-bottom:12px;">
        <strong style="color:var(--gold-l); font-size:13px;"><i class="ti ti-folder"></i> ${escapeHTML(sec.name || 'Unnamed Section')}</strong>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-ghost btn-sm" style="padding:2px 8px; font-size:11px;" onclick="window.renameBuilderFormSection(${secIdx})"><i class="ti ti-edit"></i> Rename</button>
          <button class="btn btn-ghost btn-sm" style="padding:2px 8px; font-size:11px; color:var(--red);" onclick="window.deleteBuilderFormSection(${secIdx})"><i class="ti ti-trash"></i> Delete</button>
        </div>
      </div>
      
      <!-- Fields list in section -->
      <div style="display:flex; flex-direction:column; gap:8px;" id="builder-section-fields-${secIdx}">
        ${(sec.fields || []).map((f, fIdx) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.04); border-radius:4px;">
            <div style="display:flex; gap:12px; align-items:center;">
              <span class="badge" style="font-size:9.5px; font-family:monospace; background:rgba(212, 175, 55, 0.15); color:var(--gold-l);">${escapeHTML(f.type)}</span>
              <span style="font-size:12px; font-weight:700; color:var(--text-light);">${escapeHTML(f.label)}</span>
              <span style="font-size:10.5px; color:var(--text-muted); font-family:monospace;">(db: ${escapeHTML(f.key)})</span>
            </div>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="window.moveBuilderFormField(${secIdx}, ${fIdx}, -1)" title="Move Up"><i class="ti ti-arrow-narrow-up"></i></button>
              <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="window.moveBuilderFormField(${secIdx}, ${fIdx}, 1)" title="Move Down"><i class="ti ti-arrow-narrow-down"></i></button>
              <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="window.showAddFieldModal(${secIdx}, ${fIdx})" title="Edit Field"><i class="ti ti-edit"></i></button>
              <button class="btn btn-ghost btn-sm" style="padding:2px 6px; color:var(--red);" onclick="window.deleteBuilderFormField(${secIdx}, ${fIdx})" title="Delete Field"><i class="ti ti-trash"></i></button>
            </div>
          </div>
        `).join('')}
      </div>

      <button class="btn btn-ghost btn-sm" style="margin-top:12px; width:100%; border-radius:4px; font-size:11px;" onclick="window.showAddFieldModal(${secIdx})"><i class="ti ti-plus"></i> Append Custom Field</button>
    </div>
  `).join('');
};

window.showCreateFormModal = function() {
  document.getElementById('builder-edit-form-id').value = '';
  document.getElementById('builder-form-input-name').value = '';
  document.getElementById('builder-form-input-module').value = 'Leads';
  document.getElementById('lbl-form-modal-title').innerText = '📋 Create Custom Form';
  openModal('modal-builder-create-form');
};

window.handleFormTemplateSubmit = async function(e) {
  e.preventDefault();
  const id = document.getElementById('builder-edit-form-id').value;
  const payload = {
    name: document.getElementById('builder-form-input-name').value,
    module_type: document.getElementById('builder-form-input-module').value,
    sections: id ? window.builderState.selectedForm.sections : []
  };

  try {
    const url = id ? `/api/custom-forms/${id}` : '/api/custom-forms';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Form definition synchronized successfully.');
      closeModal('modal-builder-create-form');
      await window.loadBuilderForms();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save form template.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Network error during form save.', 'error');
  }
};

window.duplicateBuilderForm = async function(id) {
  try {
    const res = await fetch(`/api/custom-forms/${id}/duplicate`, { method: 'POST' });
    if (res.ok) {
      showToast('Form configuration duplicated.');
      await window.loadBuilderForms();
    }
  } catch (err) {
    console.error(err);
  }
};

window.deleteBuilderForm = async function(id) {
  if (!confirm('Are you sure you want to delete this custom form template permanently?')) return;
  try {
    const res = await fetch(`/api/custom-forms/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Form template deleted.');
      if (window.builderState.selectedForm?.id === id) {
        window.builderState.selectedForm = null;
      }
      await window.loadBuilderForms();
    }
  } catch (err) {
    console.error(err);
  }
};

window.addBuilderFormSection = function() {
  if (!window.builderState.selectedForm) return;
  const sections = window.builderState.selectedForm.sections || [];
  sections.push({ name: 'New Section', fields: [] });
  window.builderState.selectedForm.sections = sections;
  window.renderFormCanvas();
};

window.deleteBuilderFormSection = function(secIdx) {
  if (!confirm('Are you sure you want to delete this layout section along with all its custom fields?')) return;
  window.builderState.selectedForm.sections.splice(secIdx, 1);
  window.renderFormCanvas();
};

window.renameBuilderFormSection = function(secIdx) {
  const current = window.builderState.selectedForm.sections[secIdx].name;
  const name = prompt('Enter layout section display name:', current);
  if (name !== null && name.trim() !== '') {
    window.builderState.selectedForm.sections[secIdx].name = name.trim();
    window.renderFormCanvas();
  }
};

window.showAddFieldModal = function(secIdx, fieldIdx = null) {
  document.getElementById('builder-field-section-index').value = secIdx;
  document.getElementById('builder-field-index').value = fieldIdx !== null ? fieldIdx : '';
  
  if (fieldIdx !== null) {
    const field = window.builderState.selectedForm.sections[secIdx].fields[fieldIdx];
    document.getElementById('builder-field-label').value = field.label;
    document.getElementById('builder-field-key').value = field.key;
    document.getElementById('builder-field-type').value = field.type;
    document.getElementById('builder-field-options').value = field.options || '';
    window.handleFieldTypeChange(field.type);
  } else {
    document.getElementById('builder-field-label').value = '';
    document.getElementById('builder-field-key').value = '';
    document.getElementById('builder-field-type').value = 'text';
    document.getElementById('builder-field-options').value = '';
    window.handleFieldTypeChange('text');
  }

  openModal('modal-builder-add-field');
};

window.handleFieldTypeChange = function(type) {
  const optionsGroup = document.getElementById('builder-field-options-group');
  if (type === 'select') {
    optionsGroup.classList.remove('hidden');
  } else {
    optionsGroup.classList.add('hidden');
  }
};

window.handleFieldTemplateSubmit = function(e) {
  e.preventDefault();
  const secIdx = parseInt(document.getElementById('builder-field-section-index').value);
  const fieldIdxStr = document.getElementById('builder-field-index').value;
  const isEdit = fieldIdxStr !== '';

  const label = document.getElementById('builder-field-label').value.trim();
  const key = document.getElementById('builder-field-key').value.trim();
  const type = document.getElementById('builder-field-type').value;
  const options = document.getElementById('builder-field-options').value;

  // Verify unique key
  let duplicate = false;
  window.builderState.selectedForm.sections.forEach((sec, sIdx) => {
    sec.fields.forEach((f, fIdx) => {
      if (f.key === key) {
        if (isEdit && sIdx === secIdx && fIdx === parseInt(fieldIdxStr)) {
          // Self editing
        } else {
          duplicate = true;
        }
      }
    });
  });

  if (duplicate) {
    showToast('Database collision: a field with this key already exists on this form.', 'error');
    return;
  }

  const fieldObj = { label, key, type, options };

  if (isEdit) {
    const fIdx = parseInt(fieldIdxStr);
    window.builderState.selectedForm.sections[secIdx].fields[fIdx] = fieldObj;
  } else {
    window.builderState.selectedForm.sections[secIdx].fields.push(fieldObj);
  }

  closeModal('modal-builder-add-field');
  window.renderFormCanvas();
};

window.deleteBuilderFormField = function(secIdx, fieldIdx) {
  window.builderState.selectedForm.sections[secIdx].fields.splice(fieldIdx, 1);
  window.renderFormCanvas();
};

window.moveBuilderFormField = function(secIdx, fieldIdx, direction) {
  const fields = window.builderState.selectedForm.sections[secIdx].fields;
  const targetIdx = fieldIdx + direction;
  if (targetIdx < 0 || targetIdx >= fields.length) return;

  // Swap
  const temp = fields[fieldIdx];
  fields[fieldIdx] = fields[targetIdx];
  fields[targetIdx] = temp;

  window.renderFormCanvas();
};

window.saveBuilderForm = async function() {
  if (!window.builderState.selectedForm) return;
  const id = window.builderState.selectedForm.id;
  const payload = {
    name: window.builderState.selectedForm.name,
    module_type: window.builderState.selectedForm.module_type,
    sections: window.builderState.selectedForm.sections
  };

  try {
    const res = await fetch(`/api/custom-forms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Form structure saved successfully.');
      await window.loadBuilderForms();
    } else {
      showToast('Failed to save layout structure.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to connect to backend server.', 'error');
  }
};

// ------------------------------------------
// 2. WORKFLOW STUDIO TAB CONTROLLER
// ------------------------------------------

window.loadBuilderWorkflows = async function() {
  try {
    const res = await fetch('/api/custom-workflows');
    const data = await res.json();
    window.builderState.workflows = data;

    const tbody = document.getElementById('builder-workflows-table-body');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; font-size:11px; color:var(--text-muted); padding:20px;">No workflows configured.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(w => {
      let conds = '';
      try {
        const c = typeof w.trigger_conditions === 'string' ? JSON.parse(w.trigger_conditions) : w.trigger_conditions;
        conds = Object.keys(c || {}).map(k => `${k}==${c[k]}`).join(', ') || 'Any';
      } catch (e) {
        conds = 'Invalid';
      }
      return `
        <tr>
          <td><strong style="color:var(--text-light);">${escapeHTML(w.name)}</strong></td>
          <td>${w.module_type}</td>
          <td><span class="badge" style="background:rgba(255,255,255,0.05); font-size:10.5px;">${w.trigger_event}</span> <span style="font-size:10px; color:var(--text-muted);">(${conds})</span></td>
          <td><span class="badge badge-amber" style="font-size:10px;">${w.action_type}</span></td>
          <td>
            <label class="switch" style="transform: scale(0.85); display:inline-block;">
              <input type="checkbox" ${w.is_active ? 'checked' : ''} onchange="window.toggleWorkflowStatus(${w.id}, this.checked)">
              <span class="slider round"></span>
            </label>
          </td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="window.showCreateWorkflowModal(${w.id})"><i class="ti ti-edit"></i> Edit</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="window.deleteBuilderWorkflow(${w.id})"><i class="ti ti-trash"></i> Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    showToast('Failed to load rules.');
  }
};

window.showCreateWorkflowModal = function(id = null) {
  document.getElementById('builder-workflow-id').value = id || '';
  
  if (id) {
    const w = window.builderState.workflows.find(x => x.id === id);
    if (!w) return;
    document.getElementById('builder-wf-name').value = w.name;
    document.getElementById('builder-wf-module').value = w.module_type;
    document.getElementById('builder-wf-event').value = w.trigger_event;
    
    let condField = 'stage';
    let condVal = '';
    try {
      const c = typeof w.trigger_conditions === 'string' ? JSON.parse(w.trigger_conditions) : w.trigger_conditions;
      condField = Object.keys(c || {})[0] || 'stage';
      condVal = c[condField] || '';
    } catch(e) {}
    
    window.handleWorkflowModuleChange(w.module_type);
    document.getElementById('builder-wf-condition-field').value = condField;
    document.getElementById('builder-wf-condition-value').value = condVal;
    
    document.getElementById('builder-wf-action-type').value = w.action_type;
    window.handleWorkflowActionTypeChange(w.action_type);
    
    let actionStr = '';
    try {
      actionStr = typeof w.action_config === 'string' ? w.action_config : JSON.stringify(w.action_config || {});
      if (w.action_type === 'LOG_ACTIVITY' || w.action_type === 'SEND_WHATSAPP') {
        const actJson = typeof w.action_config === 'string' ? JSON.parse(w.action_config) : w.action_config;
        actionStr = actJson.message || actJson.description || actionStr;
      } else if (w.action_type === 'UPDATE_FIELD') {
        const actJson = typeof w.action_config === 'string' ? JSON.parse(w.action_config) : w.action_config;
        actionStr = `${actJson.field}:${actJson.value}`;
      }
    } catch(e) {}

    document.getElementById('builder-wf-action-config').value = actionStr;
  } else {
    document.getElementById('builder-wf-name').value = '';
    document.getElementById('builder-wf-module').value = 'Leads';
    window.handleWorkflowModuleChange('Leads');
    document.getElementById('builder-wf-event').value = 'STAGE_CHANGED';
    document.getElementById('builder-wf-condition-field').value = 'stage';
    document.getElementById('builder-wf-condition-value').value = '';
    document.getElementById('builder-wf-action-type').value = 'LOG_ACTIVITY';
    window.handleWorkflowActionTypeChange('LOG_ACTIVITY');
    document.getElementById('builder-wf-action-config').value = '';
  }

  openModal('modal-builder-workflow');
};

window.handleWorkflowModuleChange = function(module) {
  const condField = document.getElementById('builder-wf-condition-field');
  if (module === 'Properties') {
    condField.innerHTML = `
      <option value="status">Status</option>
      <option value="property_type">Type</option>
    `;
  } else {
    condField.innerHTML = `
      <option value="stage">Pipeline Stage</option>
      <option value="status">Lead Status</option>
    `;
  }
};

window.handleWorkflowActionTypeChange = function(type) {
  const cfg = document.getElementById('builder-wf-action-config');
  if (type === 'LOG_ACTIVITY') {
    cfg.placeholder = 'e.g. System logged: Stage converted to Won automatically.';
  } else if (type === 'SEND_WHATSAPP') {
    cfg.placeholder = 'e.g. Hello Rahul, thank you for showing interest...';
  } else if (type === 'UPDATE_FIELD') {
    cfg.placeholder = 'e.g. field_name:new_value (e.g. timeline_preference:Urgent)';
  }
};

window.handleWorkflowSubmit = async function(e) {
  e.preventDefault();
  const id = document.getElementById('builder-workflow-id').value;
  const name = document.getElementById('builder-wf-name').value;
  const module_type = document.getElementById('builder-wf-module').value;
  const trigger_event = document.getElementById('builder-wf-event').value;
  
  const condField = document.getElementById('builder-wf-condition-field').value;
  const condValue = document.getElementById('builder-wf-condition-value').value.trim();
  const trigger_conditions = {};
  if (condField && condValue) {
    trigger_conditions[condField] = condValue;
  }

  const action_type = document.getElementById('builder-wf-action-type').value;
  const actionConfigVal = document.getElementById('builder-wf-action-config').value.trim();
  let action_config = {};
  if (action_type === 'LOG_ACTIVITY') {
    action_config = { description: actionConfigVal };
  } else if (action_type === 'SEND_WHATSAPP') {
    action_config = { message: actionConfigVal };
  } else {
    try {
      const parts = actionConfigVal.split(':');
      action_config = { field: parts[0]?.trim(), value: parts[1]?.trim() };
    } catch(e) {
      action_config = { raw: actionConfigVal };
    }
  }

  const payload = {
    name,
    module_type,
    trigger_event,
    trigger_conditions,
    action_type,
    action_config,
    is_active: id ? (window.builderState.workflows.find(x => x.id == id)?.is_active) : true
  };

  try {
    const url = id ? `/api/custom-workflows/${id}` : '/api/custom-workflows';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Workflow rule synchronized successfully.');
      closeModal('modal-builder-workflow');
      await window.loadBuilderWorkflows();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save workflow rules.', 'error');
    }
  } catch(err) {
    console.error(err);
  }
};

window.toggleWorkflowStatus = async function(id, isActive) {
  const w = window.builderState.workflows.find(x => x.id === id);
  if (!w) return;
  const payload = { ...w, is_active: isActive };
  try {
    await fetch(`/api/custom-workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    showToast(`Workflow rule ${isActive ? 'activated' : 'deactivated'}.`);
    await window.loadBuilderWorkflows();
  } catch(e) {
    console.error(e);
  }
};

window.deleteBuilderWorkflow = async function(id) {
  if (!confirm('Are you sure you want to delete this workflow trigger rule permanently?')) return;
  try {
    const res = await fetch(`/api/custom-workflows/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Workflow rule deleted.');
      await window.loadBuilderWorkflows();
    }
  } catch(err) {
    console.error(err);
  }
};

// ------------------------------------------
// 3. CUSTOM TABLES CONTROLLER
// ------------------------------------------

window.loadBuilderTables = async function() {
  try {
    const res = await fetch('/api/custom-tables');
    const data = await res.json();
    window.builderState.tables = data;

    const container = document.getElementById('builder-tables-list-container');
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:10px;">No tables registered.</div>`;
      document.getElementById('builder-table-detail-container').style.display = 'none';
      return;
    }

    container.innerHTML = data.map(t => `
      <div class="card-option" style="padding:10px; border:1px solid var(--border); border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15);" onclick="window.selectBuilderTable(${t.id})">
        <div>
          <strong style="font-size:12px; color:var(--text-light);">${escapeHTML(t.name)}</strong>
          <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Columns: ${(t.fields || []).length}</div>
        </div>
        <div style="display:flex; gap:4px;" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" style="padding:2px 6px; font-size:10px; color:var(--gold-l);" onclick="window.showEditTableModal(${t.id})" title="Edit Table"><i class="ti ti-edit"></i></button>
          <button class="btn btn-ghost btn-sm" style="padding:2px 6px; font-size:10px; color:var(--red);" onclick="window.deleteBuilderTable(${t.id})" title="Delete Table"><i class="ti ti-trash"></i></button>
        </div>
      </div>
    `).join('');

    if (window.builderState.selectedTable) {
      const exists = data.find(t => t.id === window.builderState.selectedTable.id);
      if (exists) {
        window.selectBuilderTable(exists.id);
      } else {
        document.getElementById('builder-table-detail-container').style.display = 'none';
      }
    }
  } catch(err) {
    console.error(err);
    showToast('Failed to load custom tables.');
  }
};

window.selectBuilderTable = async function(id) {
  const t = window.builderState.tables.find(x => x.id === id);
  if (!t) return;

  window.builderState.selectedTable = t;
  document.getElementById('builder-table-detail-container').style.display = 'block';
  document.getElementById('builder-selected-table-name').innerText = t.name;
  document.getElementById('builder-selected-table-desc').innerText = t.description || 'No description provided.';

  await window.loadBuilderTableRows(id);
};

window.loadBuilderTableRows = async function(tableId) {
  try {
    const res = await fetch(`/api/custom-tables/${tableId}/rows`);
    const data = await res.json();
    window.builderState.selectedTableRows = data;

    window.renderTableGrid();
  } catch (err) {
    console.error(err);
    showToast('Failed to load rows.');
  }
};

window.renderTableGrid = function() {
  const table = window.builderState.selectedTable;
  const rows = window.builderState.selectedTableRows;
  
  const thead = document.getElementById('builder-table-data-thead');
  const tbody = document.getElementById('builder-table-data-tbody');
  if (!thead || !tbody || !table) return;

  const cols = table.fields || [];

  if (cols.length === 0) {
    thead.innerHTML = `<tr><th>Table is empty</th></tr>`;
    tbody.innerHTML = `<tr><td style="text-align:center; font-size:11px; color:var(--text-muted); padding:20px;">Use "Edit Columns" to add columns to the schema structure first.</td></tr>`;
    return;
  }

  // Header
  thead.innerHTML = `
    <tr>
      ${cols.map(c => `<th>${escapeHTML(c.label)}</th>`).join('')}
      <th style="width:100px;">Actions</th>
    </tr>
  `;

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${cols.length + 1}" style="text-align:center; font-size:11px; color:var(--text-muted); padding:20px;">No records recorded. Click "+ Add Row" to insert data.</td>
      </tr>
    `;
    return;
  }

  // Body
  tbody.innerHTML = rows.map(r => {
    const rData = r.data || {};
    return `
      <tr>
        ${cols.map(c => {
          let val = rData[c.key];
          if (val === undefined || val === null) val = '';
          if (c.type === 'boolean') val = val ? 'Yes' : 'No';
          return `<td>${escapeHTML(val.toString())}</td>`;
        }).join('')}
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="window.showAddTableRowModal(${r.id})"><i class="ti ti-edit"></i></button>
            <button class="btn btn-ghost btn-sm" style="padding:2px 6px; color:var(--red);" onclick="window.deleteTableRow(${r.id})"><i class="ti ti-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.showCreateTableModal = function() {
  document.getElementById('builder-table-id').value = '';
  document.getElementById('builder-table-name').value = '';
  document.getElementById('builder-table-description').value = '';
  openModal('modal-builder-table');
};

window.showEditTableModal = function(id) {
  const t = window.builderState.tables.find(x => x.id === id);
  if (!t) return;
  document.getElementById('builder-table-id').value = t.id;
  document.getElementById('builder-table-name').value = t.name;
  document.getElementById('builder-table-description').value = t.description || '';
  openModal('modal-builder-table');
};

window.handleCustomTableSubmit = async function(e) {
  e.preventDefault();
  const id = document.getElementById('builder-table-id').value;
  let fields = [];
  if (id) {
    const existingTable = window.builderState.tables.find(x => x.id == id);
    if (existingTable) {
      fields = existingTable.fields || [];
    }
  }
  const payload = {
    name: document.getElementById('builder-table-name').value.trim(),
    description: document.getElementById('builder-table-description').value.trim(),
    fields: fields
  };

  try {
    const url = id ? `/api/custom-tables/${id}` : '/api/custom-tables';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Custom table schema registered successfully.');
      closeModal('modal-builder-table');
      await window.loadBuilderTables();
    }
  } catch(err) {
    console.error(err);
  }
};

window.deleteBuilderTable = async function(id) {
  if (!confirm('Warning: Deleting this custom database table will erase its columns schema AND all its rows of records. Continue?')) return;
  try {
    const res = await fetch(`/api/custom-tables/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Table deleted.');
      if (window.builderState.selectedTable?.id === id) {
        window.builderState.selectedTable = null;
      }
      await window.loadBuilderTables();
    }
  } catch(err) {
    console.error(err);
  }
};

window.showTableSchemaModal = function() {
  if (!window.builderState.selectedTable) return;
  document.getElementById('builder-columns-table-id').value = window.builderState.selectedTable.id;
  window.builderState.tempTableFields = JSON.parse(JSON.stringify(window.builderState.selectedTable.fields || []));

  window.renderTableSchemaColumnsList();
  openModal('modal-builder-table-columns');
};

window.renderTableSchemaColumnsList = function() {
  const container = document.getElementById('builder-table-schema-columns-list');
  const fields = window.builderState.tempTableFields;

  if (fields.length === 0) {
    container.innerHTML = `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:10px;">No columns defined.</div>`;
    return;
  }

  container.innerHTML = fields.map((f, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:6px 12px; border-radius:4px; border:1px solid rgba(255,255,255,0.02);">
      <div style="font-size:11.5px; color:var(--text-light); font-weight:700;">${escapeHTML(f.label)} <span style="font-size:10px; color:var(--text-muted); font-family:monospace;">(${f.type})</span></div>
      <button class="btn btn-ghost btn-sm" style="color:var(--red); padding:2px 6px;" onclick="window.removeTempTableColumn(${idx})"><i class="ti ti-trash"></i></button>
    </div>
  `).join('');
};

window.addNewTableColumnField = function() {
  const label = document.getElementById('builder-col-label').value.trim();
  const type = document.getElementById('builder-col-type').value;

  if (!label) {
    showToast('Column Label is required.', 'warning');
    return;
  }

  const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  
  // Verify unique key
  if (window.builderState.tempTableFields.find(x => x.key === key)) {
    showToast('A column with a matching DB name key already exists.', 'warning');
    return;
  }

  window.builderState.tempTableFields.push({ label, key, type });
  document.getElementById('builder-col-label').value = '';
  window.renderTableSchemaColumnsList();
};

window.removeTempTableColumn = function(idx) {
  window.builderState.tempTableFields.splice(idx, 1);
  window.renderTableSchemaColumnsList();
};

window.saveTableColumnsSchema = async function() {
  const tableId = window.builderState.selectedTable.id;
  const payload = {
    name: window.builderState.selectedTable.name,
    description: window.builderState.selectedTable.description,
    fields: window.builderState.tempTableFields
  };

  try {
    const res = await fetch(`/api/custom-tables/${tableId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Columns schema configured successfully.');
      closeModal('modal-builder-table-columns');
      await window.loadBuilderTables();
    }
  } catch(err) {
    console.error(err);
  }
};

window.showAddTableRowModal = function(rowId = null) {
  const table = window.builderState.selectedTable;
  if (!table) return;

  const container = document.getElementById('builder-row-data-inputs-container');
  if (!container) return;

  document.getElementById('lbl-row-modal-title').innerText = rowId ? '📝 Edit Row Entry' : '📝 Add Row Entry';
  
  let rowObj = { id: '', data: {} };
  if (rowId) {
    const existing = window.builderState.selectedTableRows.find(x => x.id === rowId);
    if (existing) rowObj = existing;
  }

  container.innerHTML = `<input type="hidden" id="builder-row-entry-id" value="${rowObj.id}">`;

  table.fields.forEach(c => {
    let inputHtml = '';
    const currentVal = rowObj.data[c.key] !== undefined ? rowObj.data[c.key] : '';

    if (c.type === 'number') {
      inputHtml = `<input type="number" class="form-input row-data-field-input" data-key="${c.key}" value="${currentVal}" placeholder="Enter number...">`;
    } else if (c.type === 'boolean') {
      inputHtml = `
        <select class="form-select row-data-field-input" data-key="${c.key}">
          <option value="false" ${currentVal === false ? 'selected' : ''}>No</option>
          <option value="true" ${currentVal === true ? 'selected' : ''}>Yes</option>
        </select>
      `;
    } else {
      inputHtml = `<input type="text" class="form-input row-data-field-input" data-key="${c.key}" value="${currentVal}" placeholder="Enter text...">`;
    }

    container.innerHTML += `
      <div class="form-group">
        <label class="form-label">${escapeHTML(c.label)}</label>
        ${inputHtml}
      </div>
    `;
  });

  openModal('modal-builder-row-data');
};

window.handleRowDataEntrySubmit = async function(e) {
  e.preventDefault();
  const rowId = document.getElementById('builder-row-entry-id').value;
  const table = window.builderState.selectedTable;
  if (!table) return;

  const data = {};
  const inputElements = document.querySelectorAll('.row-data-field-input');
  inputElements.forEach(el => {
    const key = el.getAttribute('data-key');
    const colDef = table.fields.find(c => c.key === key);
    let val = el.value;
    if (colDef) {
      if (colDef.type === 'number') {
        val = val !== '' ? parseFloat(val) : null;
      } else if (colDef.type === 'boolean') {
        val = val === 'true';
      }
    }
    data[key] = val;
  });

  try {
    const url = rowId ? `/api/custom-tables/${table.id}/rows/${rowId}` : `/api/custom-tables/${table.id}/rows`;
    const method = rowId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });

    if (res.ok) {
      showToast('Row entry saved successfully.');
      closeModal('modal-builder-row-data');
      await window.loadBuilderTableRows(table.id);
    }
  } catch(err) {
    console.error(err);
  }
};

window.deleteTableRow = async function(rowId) {
  if (!confirm('Are you sure you want to delete this row?')) return;
  const table = window.builderState.selectedTable;
  if (!table) return;

  try {
    const res = await fetch(`/api/custom-tables/${table.id}/rows/${rowId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Row deleted.');
      await window.loadBuilderTableRows(table.id);
    }
  } catch(err) {
    console.error(err);
  }
};

// ------------------------------------------
// 4. REPORTS CENTER CONTROLLER
// ------------------------------------------

window.initReportsCenter = async function() {
  const select = document.getElementById('report-builder-source');
  if (!select) return;

  // Clear choices
  select.innerHTML = `
    <option value="">-- Select Source Table --</option>
    <option value="Leads">Leads</option>
    <option value="Properties">Properties</option>
  `;

  // Fetch custom tables
  try {
    const res = await fetch('/api/custom-tables');
    const tables = await res.json();
    tables.forEach(t => {
      const opt = document.createElement('option');
      opt.value = `custom_table_${t.id}`;
      opt.innerText = t.name;
      select.appendChild(opt);
    });
  } catch(e) {
    console.error(e);
  }
};

window.handleReportSourceChange = async function(source) {
  const colContainer = document.getElementById('report-builder-columns-container');
  const filterContainer = document.getElementById('report-builder-filters-container');
  if (!colContainer || !filterContainer) return;

  if (!source) {
    colContainer.innerHTML = `<div style="font-size:11px; color:var(--text-muted);">Select a source table first</div>`;
    filterContainer.innerHTML = `<div style="font-size:11px; color:var(--text-secondary);">Select a source table to define filter metrics</div>`;
    return;
  }

  let columns = [];
  if (source === 'Leads') {
    columns = [
      { label: 'Name', key: 'name', is_custom: false },
      { label: 'Phone', key: 'phone', is_custom: false },
      { label: 'Email', key: 'email', is_custom: false },
      { label: 'Source', key: 'source', is_custom: false },
      { label: 'Status', key: 'status', is_custom: false },
      { label: 'Pipeline Stage', key: 'stage', is_custom: false }
    ];
    // Append custom fields
    try {
      const fRes = await fetch('/api/custom-forms');
      const forms = await fRes.json();
      const leadForm = forms.find(f => f.module_type === 'Leads');
      if (leadForm) {
        leadForm.sections.forEach(sec => {
          sec.fields.forEach(f => {
            columns.push({ label: f.label, key: f.key, is_custom: true });
          });
        });
      }
    } catch(e) {}
  } else if (source === 'Properties') {
    columns = [
      { label: 'Property ID', key: 'prop_id', is_custom: false },
      { label: 'Society Name', key: 'society', is_custom: false },
      { label: 'Location', key: 'location', is_custom: false },
      { label: 'Typology', key: 'configuration', is_custom: false },
      { label: 'Price (Raw)', key: 'price_raw', is_custom: false },
      { label: 'Status', key: 'status', is_custom: false }
    ];
    // Append custom fields
    try {
      const fRes = await fetch('/api/custom-forms');
      const forms = await fRes.json();
      const propForm = forms.find(f => f.module_type === 'Properties');
      if (propForm) {
        propForm.sections.forEach(sec => {
          sec.fields.forEach(f => {
            columns.push({ label: f.label, key: f.key, is_custom: true });
          });
        });
      }
    } catch(e) {}
  } else if (source.startsWith('custom_table_')) {
    const tId = parseInt(source.replace('custom_table_', ''));
    const table = window.builderState.tables.find(x => x.id === tId);
    if (table) {
      columns = (table.fields || []).map(f => ({ label: f.label, key: f.key, is_custom: true }));
    }
  }

  // Render Checkboxes
  colContainer.innerHTML = columns.map(c => `
    <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-light); cursor:pointer;">
      <input type="checkbox" class="report-column-checkbox" value="${c.key}" data-label="${c.label}" data-custom="${c.is_custom}" checked>
      ${escapeHTML(c.label)}
    </label>
  `).join('');

  // Render Filters Inputs
  filterContainer.innerHTML = columns.map(c => `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
      <span style="font-size:11px; align-self:center;">${escapeHTML(c.label)} matches:</span>
      <input type="text" class="form-input report-filter-value-input" data-key="${c.key}" data-custom="${c.is_custom}" placeholder="Match criteria..." style="padding:3px 6px; font-size:11px; height:24px;">
    </div>
  `).join('');
};

window.runBuilderReport = async function() {
  const source = document.getElementById('report-builder-source').value;
  if (!source) {
    showToast('Source table required.', 'warning');
    return;
  }

  // Columns
  const cols = [];
  document.querySelectorAll('.report-column-checkbox:checked').forEach(el => {
    cols.push({
      key: el.value,
      label: el.getAttribute('data-label'),
      is_custom: el.getAttribute('data-custom') === 'true'
    });
  });

  if (cols.length === 0) {
    showToast('Please select at least 1 display column.', 'warning');
    return;
  }

  // Filters
  const filters = [];
  document.querySelectorAll('.report-filter-value-input').forEach(el => {
    const val = el.value.trim();
    if (val) {
      filters.push({
        field: el.getAttribute('data-key'),
        value: val,
        is_custom: el.getAttribute('data-custom') === 'true'
      });
    }
  });

  try {
    const res = await fetch('/api/custom-reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_table: source, columns: cols.map(c => c.key), filters })
    });

    const dataset = await res.json();
    if (!res.ok) throw new Error(dataset.error || 'Failed to build query');

    window.builderState.lastReportData = { columns: cols, rows: dataset };

    // Render Preview
    document.getElementById('builder-report-preview-card').style.display = 'block';
    document.getElementById('btn-builder-report-export').style.display = 'block';

    const thead = document.getElementById('builder-report-preview-thead');
    thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHTML(c.label)}</th>`).join('')}</tr>`;

    const tbody = document.getElementById('builder-report-preview-tbody');
    if (dataset.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center; font-size:11px; color:var(--text-muted); padding:20px;">No rows matched constraints.</td></tr>`;
      return;
    }

    tbody.innerHTML = dataset.map(row => {
      return `
        <tr>
          ${cols.map(c => {
            let val = c.is_custom ? (row.data ? row.data[c.key] : row.custom_data?.[c.key]) : row[c.key];
            if (val === undefined || val === null) val = '';
            return `<td>${escapeHTML(val.toString())}</td>`;
          }).join('')}
        </tr>
      `;
    }).join('');

  } catch(err) {
    console.error(err);
    showToast(err.message, 'error');
  }
};

window.exportBuilderReportCSV = function() {
  const report = window.builderState.lastReportData;
  if (!report || report.rows.length === 0) return;

  const cols = report.columns;
  const rows = report.rows;

  const headersLine = cols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const rowsLines = rows.map(row => {
    return cols.map(c => {
      let val = c.is_custom ? (row.data ? row.data[c.key] : row.custom_data?.[c.key]) : row[c.key];
      if (val === undefined || val === null) val = '';
      return `"${val.toString().replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = [headersLine, ...rowsLines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'dynamic_builder_report.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ------------------------------------------
// 5. CUSTOM FIELDS INJECTION UTILITIES
// ------------------------------------------

window.renderCustomFields = async function(module, customData) {
  let containerId = 'custom-lead-fields-container';
  if (module === 'Properties') containerId = 'custom-properties-fields-container';
  else if (module === 'Projects') containerId = 'custom-projects-fields-container';
  else if (module === 'Commissions') containerId = 'custom-commissions-fields-container';

  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const res = await fetch('/api/custom-forms');
    const forms = await res.json();
    const form = forms.find(f => f.module_type === module);

    if (!form || !form.sections || form.sections.length === 0 || form.sections.every(s => !s.fields || s.fields.length === 0)) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';

    let html = `
      <h4 style="margin:0 0 12px 0; color:var(--gold-l); font-size:13px; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:6px;">
        <i class="ti ti-tool"></i> Additional Custom Parameters
      </h4>
    `;

    form.sections.forEach(sec => {
      if (!sec.fields || sec.fields.length === 0) return;
      html += `
        <div style="margin-bottom: 8px; font-weight: 700; font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">${escapeHTML(sec.name)}</div>
        <div class="form-row" style="margin-bottom: 15px;">
      `;

      sec.fields.forEach(f => {
        const value = customData?.[f.key] !== undefined ? customData[f.key] : '';
        let inputHtml = '';

        if (f.type === 'number') {
          inputHtml = `<input type="number" class="form-input custom-dynamic-field-input" data-key="${f.key}" data-type="number" value="${value}" placeholder="Enter numeric value...">`;
        } else if (f.type === 'select') {
          const opts = (f.options || '').split(',').map(o => o.trim()).filter(Boolean);
          inputHtml = `
            <select class="form-select custom-dynamic-field-input" data-key="${f.key}" data-type="select">
              <option value="">-- Choose Option --</option>
              ${opts.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          `;
        } else if (f.type === 'boolean') {
          inputHtml = `
            <select class="form-select custom-dynamic-field-input" data-key="${f.key}" data-type="boolean">
              <option value="false" ${value === false ? 'selected' : ''}>No</option>
              <option value="true" ${value === true ? 'selected' : ''}>Yes</option>
            </select>
          `;
        } else if (f.type === 'textarea') {
          inputHtml = `<textarea class="form-input custom-dynamic-field-input" data-key="${f.key}" data-type="textarea" rows="2" placeholder="Enter notes...">${value}</textarea>`;
        } else {
          inputHtml = `<input type="text" class="form-input custom-dynamic-field-input" data-key="${f.key}" data-type="text" value="${value}" placeholder="Enter text...">`;
        }

        inputHtml = `
          <div class="form-group">
            <label class="form-label">${escapeHTML(f.label)}</label>
            ${inputHtml}
          </div>
        `;
        html += inputHtml;
      });

      html += `</div>`;
    });

    container.innerHTML = html;
  } catch(e) {
    console.error('Failed to load custom fields:', e);
    container.innerHTML = '';
  }
};

window.serializeCustomFields = function(containerId) {
  const data = {};
  const container = document.getElementById(containerId || 'custom-lead-fields-container');
  if (!container) return data;
  const inputs = container.querySelectorAll('.custom-dynamic-field-input');
  inputs.forEach(el => {
    const key = el.getAttribute('data-key');
    const type = el.getAttribute('data-type');
    let val = el.value;

    if (type === 'number') {
      val = val !== '' ? parseFloat(val) : null;
    } else if (type === 'boolean') {
      val = val === 'true';
    }
    data[key] = val;
  });
  return data;
};

window.renderCustomDetails = async function(module, customData) {
  let containerId = 'custom-lead-details-container';
  if (module === 'Properties') containerId = 'custom-properties-details-container';
  else if (module === 'Projects') containerId = 'custom-projects-details-container';
  else if (module === 'Commissions') containerId = 'custom-commissions-details-container';

  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const res = await fetch('/api/custom-forms');
    const forms = await res.json();
    const form = forms.find(f => f.module_type === module);

    if (!form || !form.sections || form.sections.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    let hasFields = false;
    let html = ``;

    form.sections.forEach(sec => {
      let sectionHtml = '';
      (sec.fields || []).forEach(f => {
        let val = customData?.[f.key];
        if (val === undefined || val === null || val === '') return;
        hasFields = true;
        
        if (f.type === 'boolean') val = val ? 'Yes' : 'No';
        
        sectionHtml += `
          <div style="display:flex; flex-direction:column; gap:4px; padding:6px; background:rgba(0,0,0,0.15); border-radius:4px; border:1px solid rgba(255,255,255,0.02);">
            <span style="font-size:9.5px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">${escapeHTML(f.label)}</span>
            <span style="font-size:11.5px; color:var(--text-light); font-weight:700;">${escapeHTML(val.toString())}</span>
          </div>
        `;
      });

      if (sectionHtml) {
        html += `
          <div style="grid-column: span 2; font-size:10px; color:var(--gold-l); font-weight:700; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:3px; margin-top:5px; margin-bottom:5px;">${escapeHTML(sec.name)}</div>
          ${sectionHtml}
        `;
      }
    });

    if (hasFields) {
      container.innerHTML = html;
      container.style.display = 'grid';
    } else {
      container.style.display = 'none';
      container.innerHTML = '';
    }

  } catch(e) {
    console.error('Failed to render custom details:', e);
    container.style.display = 'none';
  }
};

window.validateCustomFields = async function(module, containerId) {
  try {
    const res = await fetch('/api/custom-forms');
    const forms = await res.json();
    const form = forms.find(f => f.module_type === module);

    if (!form || !form.sections || form.sections.length === 0) {
      return null; // No custom fields, no validation errors
    }

    const container = document.getElementById(containerId || 'custom-lead-fields-container');
    if (!container) return null;
    const inputs = container.querySelectorAll('.custom-dynamic-field-input');
    const inputVals = {};
    inputs.forEach(el => {
      const key = el.getAttribute('data-key');
      inputVals[key] = {
        val: el.value.trim(),
        element: el
      };
    });

    for (const sec of form.sections) {
      if (!sec.fields) continue;
      for (const f of sec.fields) {
        const inputData = inputVals[f.key];
        const valStr = inputData ? inputData.val : '';
        const el = inputData ? inputData.element : null;

        // Reset previous validation error highlights
        if (el) {
          el.style.borderColor = '';
          el.style.boxShadow = '';
        }

        const rules = f.rules || {};
        const isMandatory = rules.mandatory || f.required;

        // 1. Mandatory Check
        if (isMandatory && valStr === '') {
          if (el) {
            el.style.borderColor = 'var(--color-status-sold)';
            el.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.25)';
            el.focus();
          }
          return `Validation Error: "${f.label}" is a required field.`;
        }

        if (valStr !== '') {
          // 2. Range validation (for number type)
          if (f.type === 'number') {
            const numVal = parseFloat(valStr);
            if (isNaN(numVal)) {
              if (el) {
                el.style.borderColor = 'var(--color-status-sold)';
                el.focus();
              }
              return `Validation Error: "${f.label}" must be a valid number.`;
            }
            if (rules.min !== undefined && rules.min !== null) {
              const minVal = parseFloat(rules.min);
              if (numVal < minVal) {
                if (el) {
                  el.style.borderColor = 'var(--color-status-sold)';
                  el.focus();
                }
                return `Validation Error: "${f.label}" must be at least ${minVal}.`;
              }
            }
            if (rules.max !== undefined && rules.max !== null) {
              const maxVal = parseFloat(rules.max);
              if (numVal > maxVal) {
                if (el) {
                  el.style.borderColor = 'var(--color-status-sold)';
                  el.focus();
                }
                return `Validation Error: "${f.label}" must not exceed ${maxVal}.`;
              }
            }
          }

          // 3. RegEx Pattern Check
          if (rules.regex) {
            try {
              const regexObj = new RegExp(rules.regex);
              if (!regexObj.test(valStr)) {
                if (el) {
                  el.style.borderColor = 'var(--color-status-sold)';
                  el.focus();
                }
                return `Validation Error: "${f.label}" must match validation pattern: ${rules.regex}`;
              }
            } catch (regexErr) {
              console.error('Invalid regex rule pattern:', rules.regex, regexErr);
            }
          }
        }
      }
    }

    return null; // Passed all validations
  } catch (err) {
    console.error('Validation engine error:', err);
    return null; // In case of network errors, bypass validation to prevent blockages
  }
};

window.renderFormLayoutPreview = async function(moduleType) {
  const previewContainer = document.getElementById('blueprint-form-preview-container');
  if (!previewContainer) return;

  try {
    const res = await fetch('/api/custom-forms');
    const forms = await res.json();
    const form = forms.find(f => f.module_type === moduleType);

    if (!form || !form.sections || form.sections.length === 0 || form.sections.every(s => !s.fields || s.fields.length === 0)) {
      previewContainer.innerHTML = `<div style="font-size:11.5px; color:var(--text-muted); text-align:center; padding: 10px 0;">No custom fields to preview. Add a column above to see the layout.</div>`;
      return;
    }

    let previewHtml = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px; margin-bottom:5px;">
          ${moduleType} Form — Additional Fields Preview
        </div>
        <div class="form-row" style="margin-bottom:0;">
    `;

    form.sections.forEach(sec => {
      if (!sec.fields || sec.fields.length === 0) return;
      sec.fields.forEach(f => {
        let inputHtml = '';
        if (f.type === 'number') {
          let rangeTxt = '';
          if (f.rules?.min !== undefined || f.rules?.max !== undefined) {
            rangeTxt = ` (Min: ${f.rules.min ?? 0}, Max: ${f.rules.max ?? '∞'})`;
          }
          inputHtml = `<input type="number" class="form-input" placeholder="Enter numeric value...${rangeTxt}" disabled>`;
        } else if (f.type === 'select') {
          const opts = (f.options || '').split(',').map(o => o.trim()).filter(Boolean);
          inputHtml = `
            <select class="form-select" disabled>
              <option value="">-- Choose Option --</option>
              ${opts.map(o => `<option value="${o}">${o}</option>`).join('')}
            </select>
          `;
        } else if (f.type === 'boolean') {
          inputHtml = `
            <select class="form-select" disabled>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          `;
        } else if (f.type === 'textarea') {
          inputHtml = `<textarea class="form-input" rows="2" placeholder="Enter notes..." disabled></textarea>`;
        } else {
          inputHtml = `<input type="text" class="form-input" placeholder="Enter text..." disabled>`;
        }

        previewHtml += `
          <div class="form-group">
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
              <span>${escapeHTML(f.label)} ${f.required ? '<span style="color:var(--red);">*</span>' : ''}</span>
              ${f.rules?.regex ? `<span style="font-size:9.5px; color:var(--gold-l); font-family:monospace;" title="Regex: ${f.rules.regex}">RegEx Validated</span>` : ''}
            </label>
            ${inputHtml}
          </div>
        `;
      });
    });

    previewHtml += `
        </div>
      </div>
    `;
    previewContainer.innerHTML = previewHtml;
  } catch (err) {
    console.error('Failed to render form layout preview:', err);
    previewContainer.innerHTML = `<div style="font-size:11.5px; color:var(--red);">Failed to render form layout preview.</div>`;
  }
};

