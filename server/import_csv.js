const fs = require('fs');
const path = require('path');
const db = require('./db');

const csvPath = '/Users/vasujain1/Desktop/Vj Inventoory list for Crm.csv';

console.log(`Starting property CSV hydration from: ${csvPath}`);

// State-machine CSV parser that respects newlines inside double quotes
function parseCSV(content) {
  const result = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i+1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        cell += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF
      }
      row.push(cell.trim());
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        result.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    result.push(row);
  }
  
  return result;
}

// Helper to clean price strings into numeric floats
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  let s = priceStr.toLowerCase().replace(/,/g, '').trim();
  
  // check for Cr
  if (s.includes('cr')) {
    let match = s.match(/([0-9.]+)\s*cr/);
    if (match) {
      return parseFloat(match[1]) * 10000000;
    }
    let num = parseFloat(s);
    if (!isNaN(num)) return num * 10000000;
  }
  
  // check for Lakhs / L
  if (s.includes('lakh') || s.includes(' l') || s.endsWith('l')) {
    let match = s.match(/([0-9.]+)\s*(lakh|l)/);
    if (match) {
      return parseFloat(match[1]) * 100000;
    }
    let num = parseFloat(s);
    if (!isNaN(num)) return num * 100000;
  }

  // check for monthly rent (e.g. "28,000/mo")
  if (s.includes('/mo') || s.includes('rent')) {
    let num = parseFloat(s);
    if (!isNaN(num)) return num;
  }

  let val = parseFloat(s);
  return isNaN(val) ? 0 : val;
}

async function runImport() {
  try {
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found at: ${csvPath}`);
      return;
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    console.log('File loaded in memory. Parsing CSV state machine...');
    
    const rows = parseCSV(content);
    console.log(`Parsed ${rows.length} rows successfully.`);

    // Clear existing properties table before loading user dataset
    db.prepare('DELETE FROM properties').run();
    console.log('Cleared existing properties table.');

    const insertProp = db.prepare(`
      INSERT INTO properties (
        prop_id, mandate_type, property_type, society, location,
        status, site_area, area_sqft, configuration, floor_info,
        floor_range, interiors, facing, amenities, car_park,
        price, price_raw, possession, project_size, project_status,
        additional_info, video_link, photo_link, brochure_link, owner_name,
        owner_phone, owner_email, unit_no, registration_status, source,
        sub_source, comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // SQLite Transaction for ultra-high speed insert
    const insertTransaction = db.transaction((lines) => {
      for (const cols of lines) {
        insertProp.run(cols);
      }
    });

    const rowsToInsert = [];
    let importCount = 0;

    // Skip index 0 (header row)
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      
      // We expect 31 columns.
      const hasContent = cols.some(c => c !== '');
      if (cols.length < 5 || !hasContent) {
        // Skip malformed or completely empty lines
        continue;
      }

      // Map columns
      const prop_id = cols[0] || '';
      const mandate_type = cols[1] || '';
      const property_type = cols[2] || '';
      const society = cols[3] || 'N/A';
      const location = cols[4] || '';
      const status = cols[5] || 'AVAILABLE';
      const site_area = cols[6] || '';
      const area_sqft_raw = cols[7] || '0';
      const area_sqft = parseFloat(area_sqft_raw) || 0;
      const configuration = cols[8] || '';
      const floor_info = cols[9] || '';
      const floor_range = cols[10] || '';
      const interiors = cols[11] || '';
      const facing = cols[12] || '';
      const amenities = cols[13] || '';
      const car_park = cols[14] || '';
      const price_raw = cols[15] || '0';
      const price = parsePrice(price_raw);
      const possession = cols[16] || '';
      const project_size = cols[17] || '';
      const project_status = cols[18] || '';
      const additional_info = cols[19] || '';
      const video_link = cols[20] || '';
      const photo_link = cols[21] || '';
      const brochure_link = cols[22] || '';
      const owner_name = cols[23] || '';
      const owner_phone = cols[24] || '';
      const owner_email = cols[25] || '';
      const unit_no = cols[26] || '';
      const registration_status = cols[27] || '';
      const source = cols[28] || '';
      const sub_source = cols[29] || '';
      const comments = cols[30] || '';

      rowsToInsert.push([
        prop_id, mandate_type, property_type, society, location,
        status.toUpperCase(), site_area, area_sqft, configuration, floor_info,
        floor_range, interiors, facing, amenities, car_park,
        price, price_raw, possession, project_size, project_status,
        additional_info, video_link, photo_link, brochure_link, owner_name,
        owner_phone, owner_email, unit_no, registration_status, source,
        sub_source, comments
      ]);

      importCount++;
    }

    insertTransaction(rowsToInsert);
    console.log(`Successfully hydrated SQLite properties table with ${importCount} real properties from CSV!`);
  } catch (err) {
    console.error('Error migrating CSV data to SQLite properties:', err);
  }
}

runImport();
