const fs = require('fs');
let file = fs.readFileSync('public/index.js', 'utf8');

// Replace the Edit button clicks to use editFullProperty
file = file.replace(/onclick="editID\('properties', \$\{p\.id\}, '\$\{p\.prop_id \|\| ''\}'\)"\>\<i class="ti ti-edit"\>\<\/i\> Edit\<\/button\>/g, 'onclick="editFullProperty(${p.id})"><i class="ti ti-edit"></i> Edit</button>');

// Modify submit functions to use PUT when updating
file = file.replace("const res = await fetch('/api/properties'", `const editId = document.getElementById('edit-resale-id').value;
    const url = editId ? \`/api/properties/\${editId}?force=\${reqForce? 'true':'false'}\` : \`/api/properties?force=\${reqForce? 'true':'false'}\`;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url`);

const editFunc = `
window.editFullProperty = function(id) {
  const p = window.state.properties.find(prop => prop.id === id);
  if (!p) {
    showToast('Property not found.', 'error');
    return;
  }
  
  const setVal = (fid, val) => { const el = document.getElementById(fid); if(el) el.value = val !== null && val !== undefined ? val : ''; };
  
  const availFor = (p.available_for || '').toLowerCase();
  const propType = (p.property_type || '').toLowerCase();
  
  if (propType === 'commercial' || availFor.includes('commercial')) {
    document.getElementById('form-add-commercial').reset();
    document.getElementById('edit-commercial-id').value = p.id;
    setVal('comm-id', p.prop_id);
    setVal('comm-mandate', p.mandate_type);
    setVal('comm-society', p.society);
    setVal('comm-location', p.location);
    setVal('comm-available-for', p.available_for);
    setVal('comm-plot-size', p.plot_size);
    setVal('comm-area', p.area_sqft);
    setVal('comm-interiors', p.interiors);
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
    setVal('comm-comments', p.comments);
    setVal('comm-admin-comments', p.admin_comments);
    setVal('comm-project-link', p.project_id);
    document.getElementById('mtitle-commercial').innerHTML = '🏢 Edit Commercial Property';
    showAddCommercialModal();
  } else if (availFor.includes('rent')) {
    document.getElementById('form-add-rental').reset();
    document.getElementById('edit-rental-id').value = p.id;
    setVal('rental-type', p.property_type);
    setVal('rent-id', p.prop_id);
    setVal('rental-mandate', p.mandate_type);
    setVal('rental-society', p.society);
    setVal('rental-location', p.location);
    setVal('rental-status', p.status);
    setVal('rental-site-area', p.site_area);
    setVal('rental-area', p.area_sqft);
    setVal('rental-config', p.configuration);
    setVal('rental-floor-info', p.floor_info);
    setVal('rental-interiors', p.interiors);
    setVal('rental-facing', p.facing);
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
    setVal('rental-comments', p.comments);
    setVal('rental-admin-comments', p.admin_comments);
    setVal('rental-plot-size', p.plot_size);
    setVal('rental-sba', p.sba);
    setVal('rental-plot-dimension', p.plot_dimension);
    setVal('rental-plot-facing', p.plot_facing);
    setVal('rental-house-facing', p.house_facing);
    setVal('rental-project-link', p.project_id);
    document.getElementById('mtitle-rental').innerHTML = '🔑 Edit Rental Property';
    toggleVillaFields(p.property_type, 'rental');
    showAddRentalModal();
  } else {
    document.getElementById('form-add-listing').reset();
    document.getElementById('edit-resale-id').value = p.id;
    setVal('prop-type', p.property_type);
    setVal('prop-id', p.prop_id);
    setVal('prop-mandate', p.mandate_type);
    setVal('prop-society', p.society);
    setVal('prop-location', p.location);
    setVal('prop-status', p.status);
    setVal('prop-site-area', p.site_area);
    setVal('prop-area', p.area_sqft);
    setVal('prop-config', p.configuration);
    setVal('prop-floor-info', p.floor_info);
    setVal('prop-floor-range', p.floor_range);
    setVal('prop-interiors', p.interiors);
    setVal('prop-facing', p.facing);
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
    setVal('prop-comments', p.comments);
    setVal('prop-admin-comments', p.admin_comments);
    setVal('prop-tags', p.special_tags);
    setVal('prop-zone', p.zone);
    setVal('prop-year', p.onboarded_year);
    setVal('prop-available-for', p.available_for);
    setVal('prop-maintenance', p.maintenance);
    setVal('prop-deposit', p.deposit);
    setVal('prop-plot-size', p.plot_size);
    setVal('prop-sba', p.sba);
    setVal('prop-plot-dimension', p.plot_dimension);
    setVal('prop-plot-facing', p.plot_facing);
    setVal('prop-house-facing', p.house_facing);
    setVal('prop-project-link', p.project_id);
    document.getElementById('mtitle-resale').innerHTML = '💎 Edit Resale Property';
    toggleVillaFields(p.property_type, 'resale');
    showAddListingModal();
  }
};
`
if (!file.includes('editFullProperty')) {
  file += '\n' + editFunc;
}

fs.writeFileSync('public/index.js', file);
console.log('Update complete');
