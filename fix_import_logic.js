const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

const regex = /const dbColumnsMap = \{[\s\S]*?error: function\(err\) \{\s*showToast\('Error parsing CSV file\.'\);\s*console\.error\(err\);\s*\}\s*\}\);\s*\};/m;

const replacement = `const dbColumnsMap = {
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
      const isMatch = col.val.toLowerCase() === header.toLowerCase() || header.toLowerCase().includes(col.val.toLowerCase());
      options += \`<option value="\${col.val}" \${isMatch ? 'selected' : ''}>\${col.label}</option>\`;
    });

    tbody.innerHTML += \`
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid var(--border);">\${header}</td>
        <td style="padding: 8px; border-bottom: 1px solid var(--border); color: var(--text-muted);">\${sampleRow[header] ? String(sampleRow[header]).substring(0, 30) : ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid var(--border);">
          <select class="form-select csv-mapping-select" data-csv-header="\${escapeQuote(header)}" style="padding: 4px; font-size: 12px;">
            \${options}
          </select>
        </td>
      </tr>
    \`;
  });

  document.getElementById('csv-mapping-container').style.display = 'block';
  document.getElementById('btn-import-mapped-data').style.display = 'inline-block';
}
`;

if (!regex.test(code)) {
  console.log("Could not find match to replace!");
  process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('public/index.js', code);
