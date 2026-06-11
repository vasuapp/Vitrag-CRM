require('dotenv').config();

// Global Exception & Rejection Handlers to prevent abrupt crashes
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cron = require('node-cron');

// Initialize database connection
const db = require('./db');
const app = express();
const PORT = process.env.PORT || 5001;

// Ensure upload directory exists
let uploadDir = path.join(__dirname, '../public/uploads');

// Support cloud persistent volume uploads
if (process.env.PERSISTENT_DIR) {
  const persistentUploads = path.join(process.env.PERSISTENT_DIR, 'uploads');
  if (!fs.existsSync(persistentUploads)) {
    fs.mkdirSync(persistentUploads, {
      recursive: true
    });
  }
  try {
    if (fs.existsSync(uploadDir)) {
      const stats = fs.lstatSync(uploadDir);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(uploadDir);
      } else {
        // If real directory, move existing files first to retain seeded assets
        const files = fs.readdirSync(uploadDir);
        for (const file of files) {
          fs.renameSync(path.join(uploadDir, file), path.join(persistentUploads, file));
        }
        fs.rmdirSync(uploadDir);
      }
    }
    fs.symlinkSync(persistentUploads, uploadDir, 'dir');
    console.log(`Symlinked public/uploads to persistent directory: ${persistentUploads}`);
  } catch (e) {
    console.error("Symlink of uploads failed, falling back to ephemeral directory:", e.message);
  }
} else {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
      recursive: true
    });
  }
}

// Storage engine configuration for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({
  storage
});

// Session Config — use PostgreSQL session store in production (Railway)
// Falls back to SQLite for local dev when DATABASE_URL is not a remote host
let sessionStore;
const isRemoteDb = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1');
if (isRemoteDb) {
  const pgSession = require('connect-pg-simple')(session);
  sessionStore = new pgSession({
    pool: db.pool,
    tableName: 'crm_sessions',
    createTableIfMissing: true
  });
} else {
  sessionStore = new SQLiteStore({
    db: 'realpro_sessions.db',
    dir: path.join(__dirname, '../server')
  });
}

if (sessionStore && typeof sessionStore.on === 'function') {
  sessionStore.on('error', (err) => {
    console.error('Session store error:', err);
  });
}

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'realpro_crm_gold_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: isRemoteDb, // HTTPS-only cookies in production
    sameSite: isRemoteDb ? 'none' : 'lax'
  }
}));

// Gzip compression — reduces JSON response payload size by ~70%
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Proxy endpoint to bypass CORS for Google Sheets
app.post('/api/system/proxy-gsheet', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    // Dynamically import node-fetch if available, otherwise rely on native fetch
    let fetchFn;
    if (typeof fetch === 'undefined') {
      try {
        fetchFn = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      } catch(e) {
        throw new Error("Native fetch not supported and node-fetch not installed.");
      }
    } else {
      fetchFn = fetch;
    }

    const response = await fetchFn(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const text = await response.text();
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, '../public')));

// Settings / Session configuration for Field Masking & Co-branding
let systemSettings = {
  showMaskedFields: true,
  // Admin view: true, Employee view: false
  userName: 'Vasu Jain',
  userRole: 'Owner / Admin',
  coBrandName: 'Subh Homes',
  coBrandLogo: '',
  coPhone: '+91 9964985128',
  coEmail: 'vasujain@subhhomes.com',
  coAddress: '300, 2nd Floor, Kamraj Road, Bengaluru - 560 042',
  coRera: 'AG/KN/170731/000296',
  coGstin: '29AMSPK0486E1ZO',
  bankName: 'SUBH HOMES',
  bankAccount: '10060214087',
  bankIfsc: 'IDFB0080157',
  bankType: 'CURRENT ACCOUNT',
  bankBranch: 'IDFC FIRST BANK, KALYAN NAGAR BRANCH',
  invoiceTerms: '1. Please make the payment on or before registration\n2. Service Charges for Seller is 2% plus Gst. For Buyer is 1% plus Gst. For UC properties no Service Charge. Rental Property 1 Month\'s rent plus Gst\n3. Subject to Bangalore Jurisdiction.'
};

// Synchronize and seed settings and custom Lead IDs
async function initSystem() {
  try {
    // 1. Seed/load system settings
    for (const [key, val] of Object.entries(systemSettings)) {
      const exists = (await db.query("SELECT value FROM system_settings WHERE key = $1", [key])).rows[0];
      if (!exists) {
        await db.query("INSERT INTO system_settings (key, value) VALUES ($1, $2)", [key, String(val)]);
      } else {
        if (key === 'showMaskedFields') {
          systemSettings[key] = exists.value === 'true';
        } else {
          systemSettings[key] = exists.value;
        }
      }
    }
    
    // 2. Backfill custom Lead IDs for leads that don't have one
    await db.query("UPDATE leads SET custom_lead_id = 'LD-' || (1000 + id) WHERE custom_lead_id IS NULL;");
    console.log("System settings and custom Lead IDs initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize system settings/Lead IDs:", err);
  }
}
initSystem();

// Helper functions for parsing agent sessions and checking permissions (RBAC)
function getRequestUser(req) {
  const header = req.headers['x-agent-session'];
  if (!header) return null;
  try {
    return JSON.parse(header);
  } catch (e) {
    return null;
  }
}
function getParsedAllowedPages(user) {
  if (!user) return ['*'];
  if (user.role === 'Admin') return ['*'];
  if (user.allowed_pages === '*') return ['*'];
  if (Array.isArray(user.allowed_pages)) return user.allowed_pages;
  try {
    return JSON.parse(user.allowed_pages || '[]');
  } catch (e) {
    return [];
  }
}

function maskProperty(l, user) {
  const isAdmin = !user || user.role === 'Admin';
  const isEmployee = user && user.role === 'Employee';
  const allowed = getParsedAllowedPages(user);
  const hasPhoneAccess = isAdmin || allowed.includes('*') || allowed.includes('phone_access');
  
  const shouldMaskContact = !isAdmin && !hasPhoneAccess && l.agent_id !== user.id || !systemSettings.showMaskedFields || isEmployee;
  if (shouldMaskContact) {
    return {
      ...l,
      owner_name: '🔐 Hidden (Admin locked)',
      owner_phone: '🔐 Hidden',
      owner_email: '🔐 Hidden',
      comments: '🔐 Hidden comments',
      admin_comments: '🔐 Hidden admin comments',
      unit_no: '🔐 Hidden',
      commission_agreed: '🔐 Hidden',
      closure_commission_pct: null,
      closure_commission_amt: null
    };
  }
  return l;
}

function maskCommission(c, user) {
  if (!c) return c;
  const isAdmin = !user || user.role === 'Admin';
  const isEmployee = user && user.role === 'Employee';
  const shouldMask = !systemSettings.showMaskedFields || isEmployee;
  if (shouldMask) {
    return {
      ...c,
      deal_value: 0,
      commission_percentage: 0,
      commission_amount: 0,
      co_broker_payout: 0,
      expenses: 0,
      billing_invoice: '🔐 Hidden'
    };
  }
  return c;
}


// ----------------------------------------------------
// 1. SYSTEM SETTINGS API
// ----------------------------------------------------
app.get('/api/system/settings', async (req, res) => {
  try {
    const rows = (await db.query("SELECT * FROM system_settings")).rows;
    const settings = { ...systemSettings };
    rows.forEach(r => {
      if (r.key === 'showMaskedFields') {
        settings[r.key] = r.value === 'true';
      } else {
        settings[r.key] = r.value;
      }
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/settings', async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        await db.query(`
          INSERT INTO system_settings (key, value)
          VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, [key, String(val)]);
        
        // Also update local cache
        if (key === 'showMaskedFields') {
          systemSettings[key] = String(val) === 'true';
        } else {
          systemSettings[key] = String(val);
        }
      }
    }
    // Return unified configuration
    const rows = (await db.query("SELECT * FROM system_settings")).rows;
    const settings = { ...systemSettings };
    rows.forEach(r => {
      if (r.key === 'showMaskedFields') {
        settings[r.key] = r.value === 'true';
      } else {
        settings[r.key] = r.value;
      }
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 1B. GENERIC IMPORT & EXPORT CSV ENGINE
// ----------------------------------------------------
function convertToCSV(rows, columns) {
  const header = columns.join(',');
  const csvRows = rows.map(row => {
    return columns.map(col => {
      const val = row[col] === null || row[col] === undefined ? '' : row[col];
      const valStr = String(val).replace(/"/g, '""');
      if (valStr.includes(',') || valStr.includes('\n') || valStr.includes('\r') || valStr.includes('"')) {
        return `"${valStr}"`;
      }
      return valStr;
    }).join(',');
  });
  return [header, ...csvRows].join('\r\n');
}
function parseCSV(content) {
  const result = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(cell.trim());
      if (row.length > 1 || row.length === 1 && row[0] !== '') {
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
app.get('/api/export/:table', async (req, res) => {
  try {
    const {
      table
    } = req.params;
    let allowedTables = ['leads', 'properties', 'builder_projects'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({
        error: 'Invalid table requested'
      });
    }

    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const isEmployee = user && user.role === 'Employee';
    const allowed = getParsedAllowedPages(user);
    const hasPhoneAccess = isAdmin || allowed.includes('*') || allowed.includes('phone_access');

    // Check Employee Masking constraint
    if (!systemSettings.showMaskedFields) {
      const {
        password
      } = req.query;
      if (password !== 'admin123') {
        return res.status(403).json({
          error: 'Admin authorization password required'
        });
      }
    }

    let query = `SELECT * FROM ${table} WHERE deleted_at IS NULL`;
    const params = [];
    let paramCounter = 1;

    if (table === 'properties') {
      const { min_price, max_price, configuration, mandate_type, search, interiors, facing, status, zone, holder_type, registration_status, tab } = req.query;
      if (min_price) {
        query += ` AND price >= $${paramCounter++}`;
        params.push(parseFloat(min_price));
      }
      if (max_price) {
        query += ` AND price <= $${paramCounter++}`;
        params.push(parseFloat(max_price));
      }
      if (mandate_type) {
        query += ` AND mandate_type ILIKE $${paramCounter++}`;
        params.push(`%${mandate_type}%`);
      }
      if (interiors) {
        query += ` AND interiors ILIKE $${paramCounter++}`;
        params.push(`%${interiors}%`);
      }
      if (facing) {
        query += ` AND facing ILIKE $${paramCounter++}`;
        params.push(`%${facing}%`);
      }
      if (status) {
        query += ` AND COALESCE(UPPER(status), 'AVAILABLE') = UPPER($${paramCounter++})`;
        params.push(status);
      }
      if (zone) {
        query += ` AND zone ILIKE $${paramCounter++}`;
        params.push(`%${zone}%`);
      }
      if (holder_type) {
        query += ` AND holder_type ILIKE $${paramCounter++}`;
        params.push(`%${holder_type}%`);
      }
      if (registration_status) {
        query += ` AND registration_status ILIKE $${paramCounter++}`;
        params.push(`%${registration_status}%`);
      }
      if (tab) {
        if (tab === 'rental') {
          query += ` AND (COALESCE(property_type, '') ILIKE 'rental' OR COALESCE(price_raw, '') ILIKE '%/mo%')`;
        } else if (tab === 'commercial') {
          query += ` AND (COALESCE(property_type, '') ILIKE '%commercial%' OR COALESCE(property_type, '') ILIKE '%office%' OR COALESCE(property_type, '') ILIKE '%retail%' OR COALESCE(property_type, '') ILIKE '%warehouse%' OR COALESCE(property_type, '') ILIKE '%showroom%')`;
        } else if (tab === 'resale') {
          query += ` AND (property_type IS NULL OR (COALESCE(property_type, '') NOT ILIKE 'rental' AND COALESCE(price_raw, '') NOT ILIKE '%/mo%' AND COALESCE(property_type, '') NOT ILIKE '%commercial%' AND COALESCE(property_type, '') NOT ILIKE '%office%' AND COALESCE(property_type, '') NOT ILIKE '%retail%' AND COALESCE(property_type, '') NOT ILIKE '%warehouse%' AND COALESCE(property_type, '') NOT ILIKE '%showroom%'))`;
        }
      }
      if (configuration) {
        const bhks = configuration.split(',');
        const bhkClauses = bhks.map(() => `configuration ILIKE $${paramCounter++}`);
        query += ` AND (${bhkClauses.join(' OR ')})`;
        bhks.forEach(bhk => params.push(`%${bhk}%`));
      }
      if (search) {
        query += ` AND (society ILIKE $${paramCounter} OR location ILIKE $${paramCounter} OR property_type ILIKE $${paramCounter} OR prop_id ILIKE $${paramCounter} OR owner_name ILIKE $${paramCounter} OR owner_phone ILIKE $${paramCounter} OR owner_email ILIKE $${paramCounter} OR comments ILIKE $${paramCounter} OR admin_comments ILIKE $${paramCounter} OR additional_info ILIKE $${paramCounter} OR configuration ILIKE $${paramCounter} OR special_tags ILIKE $${paramCounter})`;
        params.push(`%${search}%`);
        paramCounter++;
      }
    } else if (table === 'builder_projects') {
      const { search, stage, area_min, area_max, price_min, price_max } = req.query;
      if (stage) {
        query += ` AND uc_rtmi = $${paramCounter++}`;
        params.push(stage);
      }
      if (search) {
        query += ` AND (project_name ILIKE $${paramCounter} OR builder_name ILIKE $${paramCounter} OR location ILIKE $${paramCounter} OR tower ILIKE $${paramCounter} OR configuration ILIKE $${paramCounter} OR uc_rtmi ILIKE $${paramCounter} OR possession ILIKE $${paramCounter} OR location_usp ILIKE $${paramCounter} OR other_usp ILIKE $${paramCounter} OR special_tags ILIKE $${paramCounter} OR admin_comments ILIKE $${paramCounter})`;
        params.push(`%${search}%`);
        paramCounter++;
      }
    } else if (table === 'leads') {
      const { search, status } = req.query;
      if (status) {
        query += ` AND status = $${paramCounter++}`;
        params.push(status);
      }
      if (search) {
        query += ` AND (name ILIKE $${paramCounter} OR phone ILIKE $${paramCounter} OR email ILIKE $${paramCounter} OR notes ILIKE $${paramCounter} OR project_type ILIKE $${paramCounter} OR location_preference ILIKE $${paramCounter} OR config_bhk ILIKE $${paramCounter} OR admin_comments ILIKE $${paramCounter} OR property_requirement ILIKE $${paramCounter} OR source ILIKE $${paramCounter} OR special_tags ILIKE $${paramCounter})`;
        params.push(`%${search}%`);
        paramCounter++;
      }
    }

    query += ' ORDER BY id DESC';
    const rows = (await db.query(query, params)).rows;

    let shouldMask = !systemSettings.showMaskedFields || isEmployee;
    const { password } = req.query;
    if (password === 'admin123' && !isEmployee) {
      shouldMask = false;
    }

    const processedRows = rows.map(r => {
      if (!shouldMask) return r;
      if (table === 'properties') {
        return maskProperty(r, user);
      } else if (table === 'builder_projects') {
        return {
          ...r,
          builder_poc_details: '[]',
          cp_agreements: '',
          finance_info: '🔐 Private details masked (Admin locked)',
          admin_comments: '🔐 Locked Comments'
        };
      } else if (table === 'leads') {
        const shouldMaskContact = !isAdmin && !hasPhoneAccess && r.agent_id !== user.id || shouldMask;
        if (shouldMaskContact) {
          return {
            ...r,
            phone: r.phone ? r.phone.slice(0, 4) + 'XXXXXX' + r.phone.slice(-2) : '🔐 Hidden',
            email: r.email ? 'e***@***.com' : '🔐 Hidden',
            admin_comments: '🔐 Hidden (Admin locked)'
          };
        }
      }
      return r;
    });

    if (processedRows.length === 0) {
      const info = (await db.query(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = '${table}'`)).rows;
      const columns = info.map(i => i.name);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=REALPro_${table}_export.csv`);
      return res.send(columns.join(','));
    }
    const columns = Object.keys(processedRows[0]);
    const csvContent = convertToCSV(processedRows, columns);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=REALPro_${table}_export.csv`);
    res.send(csvContent);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/import/:table', upload.single('file'), async (req, res) => {
  try {
    const {
      table
    } = req.params;
    let allowedTables = ['leads', 'properties', 'builder_projects'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({
        error: 'Invalid table requested'
      });
    }
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }
    const filePath = req.file.path;
    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(content);
    if (rows.length < 2) {
      return res.status(400).json({
        error: 'CSV file is empty or missing data rows'
      });
    }
    const headers = rows[0];
    
    // Fetch column names, types, nullability, and defaults dynamically
    const info = (await db.query(`
      SELECT column_name AS name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table])).rows;
    
    const dbCols = info.map(i => i.name).filter(name => name !== 'id');
    const numericTypes = ['numeric', 'integer', 'real', 'double precision', 'decimal', 'smallint', 'bigint'];
    const numericCols = info.filter(i => i.data_type && numericTypes.includes(i.data_type.toLowerCase())).map(i => i.name);
    const requiredCols = info.filter(i => i.is_nullable === 'NO' && !i.column_default).map(i => i.name);
    
    const sanitizeValue = (colName, val) => {
      // 1. If it's a numeric column, parse/clean numeric values
      if (numericCols.includes(colName)) {
        if (val === undefined || val === null || val === '') {
          if (requiredCols.includes(colName)) return 0;
          return null;
        }
        if (typeof val === 'string') {
          const match = val.replace(/,/g, '').match(/[-+]?[0-9]*\.?[0-9]+/);
          if (match) {
            return parseFloat(match[0]);
          }
          if (requiredCols.includes(colName)) return 0;
          return null;
        }
        if (typeof val === 'number') return val;
        return requiredCols.includes(colName) ? 0 : null;
      }
      
      // 2. If it's a non-numeric column and it's required (NOT NULL) and has no value
      if (val === undefined || val === null || String(val).trim() === '') {
        if (requiredCols.includes(colName)) {
          if (colName === 'society') return 'Unknown Society';
          if (colName === 'name') return 'Unnamed Lead';
          return 'N/A';
        }
        return null;
      }
      
      return val;
    };

    let importCount = 0;
    try {
      await db.query('BEGIN');
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 1 || row.every(c => c === '')) continue;
        
        const activeCols = [];
        const activeValues = [];
        
        // We iterate over all dbCols. If a column is required, we want sanitizeValue to provide a default fallback even if the CSV header is not mapped!
        dbCols.forEach(col => {
          const csvIdx = headers.findIndex(h => h.toLowerCase() === col.toLowerCase());
          let val = csvIdx !== -1 ? row[csvIdx] : null;
          let cleanVal = sanitizeValue(col, val);
          
          if (cleanVal !== null && cleanVal !== undefined && cleanVal !== '') {
            activeCols.push(col);
            activeValues.push(cleanVal);
          }
        });

        if (activeCols.length > 0) {
          let q = `
            INSERT INTO ${table} (${activeCols.join(', ')})
            VALUES (${activeCols.map((_, idx) => '$' + (idx + 1)).join(', ')})
            RETURNING id
          `;
          await db.query(q, activeValues);
          importCount++;
        }
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
    
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
    res.json({
      success: true,
      count: importCount,
      message: `Successfully imported ${importCount} records into ${table}!`
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Endpoint for receiving manually mapped CSV imports
app.post('/api/import-mapped/:table', async (req, res) => {
  try {
    const {
      table
    } = req.params;
    let allowedTables = ['leads', 'properties', 'builder_projects'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({
        error: 'Invalid table requested'
      });
    }
    const {
      data
    } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        error: 'No mapped data received'
      });
    }
    
    // Fetch column names, types, nullability, and defaults dynamically
    const info = (await db.query(`
      SELECT column_name AS name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table])).rows;
    
    const dbCols = info.map(i => i.name).filter(name => name !== 'id');
    const numericTypes = ['numeric', 'integer', 'real', 'double precision', 'decimal', 'smallint', 'bigint'];
    const numericCols = info.filter(i => i.data_type && numericTypes.includes(i.data_type.toLowerCase())).map(i => i.name);
    const requiredCols = info.filter(i => i.is_nullable === 'NO' && !i.column_default).map(i => i.name);
    
    const sanitizeValue = (colName, val, recordObj) => {
      // 1. If it's a numeric column, parse/clean numeric values
      if (numericCols.includes(colName)) {
        if (val === undefined || val === null || val === '') {
          if (requiredCols.includes(colName)) return 0;
          return null;
        }
        if (typeof val === 'string') {
          const match = val.replace(/,/g, '').match(/[-+]?[0-9]*\.?[0-9]+/);
          if (match) {
            return parseFloat(match[0]);
          }
          if (requiredCols.includes(colName)) return 0;
          return null;
        }
        if (typeof val === 'number') return val;
        return requiredCols.includes(colName) ? 0 : null;
      }
      
      // 2. If it's a non-numeric column and it's required (NOT NULL) and has no value
      if (val === undefined || val === null || String(val).trim() === '') {
        if (requiredCols.includes(colName)) {
          if (colName === 'society') return 'Unknown Society';
          if (colName === 'name') {
            if (recordObj && recordObj.phone) return String(recordObj.phone).trim();
            if (recordObj && recordObj.email) return String(recordObj.email).trim();
            return 'Unnamed Lead';
          }
          return 'N/A';
        }
        return null;
      }
      
      return val;
    };

    let importCount = 0;
    
    try {
      await db.query('BEGIN');
      for (const recordObj of data) {
        if (table === 'leads') {
          // Force stage to Raw Lead for imports
          recordObj.stage = 'Raw Lead';

          const rawPhone = recordObj.phone;
          if (rawPhone && String(rawPhone).trim() !== '') {
            const cleanPhone = String(rawPhone).trim();
            const existing = (await db.query("SELECT id, name FROM leads WHERE phone = $1 AND deleted_at IS NULL", [cleanPhone])).rows[0];
            if (existing) {
              await db.query(`
                INSERT INTO duplicate_leads_audit (lead_name, phone, email, source, existing_lead_id, existing_lead_name, action_taken)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [recordObj.name || 'Unnamed Imported Lead', cleanPhone, recordObj.email || '', recordObj.source || 'Bulk Import', existing.id, existing.name, 'Pending Review (Import Collision)']);
              continue; // Skip active insert
            }
          }
        }

        const activeCols = [];
        const activeValues = [];
        
        // We iterate over all dbCols. If a column is required, we want sanitizeValue to provide a default fallback even if the column is not mapped!
        dbCols.forEach(col => {
          let val = recordObj[col];
          let cleanVal = sanitizeValue(col, val, recordObj);
          if (cleanVal !== null && cleanVal !== undefined && cleanVal !== '') {
            activeCols.push(col);
            activeValues.push(cleanVal);
          }
        });
        
        if (activeCols.length > 0) {
          let q = `
            INSERT INTO ${table} (${activeCols.join(', ')})
            VALUES (${activeCols.map((_, idx) => '$' + (idx + 1)).join(', ')})
            RETURNING id
          `;
          const resInsert = await db.query(q, activeValues);
          const insertedId = resInsert.rows[0].id;
          
          if (table === 'leads') {
            const customLeadId = `IMP-${1000 + insertedId}`;
            await db.query(`UPDATE leads SET custom_lead_id = $1 WHERE id = $2`, [customLeadId, insertedId]);
          }
          
          importCount++;
        }
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }

    res.json({
      success: true,
      count: importCount,
      message: `Successfully imported ${importCount} records into ${table}!`
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 2. DASHBOARD & STATS API
// ----------------------------------------------------
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';

    if (isAdmin) {
      // ── ADMIN: fire ALL queries in parallel ─────────────────────────────
      const [
        leadsRes,
        propsRes,
        commRes,
        touchRes
      ] = await Promise.all([
        // Single query returns total, hot, and due-followup counts
        db.pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE deleted_at IS NULL)                                       AS total_leads,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'Hot')                    AS hot_leads,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND next_followup != '' AND next_followup <= $1) AS due_followups
          FROM leads
        `, [todayStr]),
        // Active listings count
        db.pool.query(`
          SELECT COUNT(*) AS active_listings
          FROM properties
          WHERE deleted_at IS NULL AND COALESCE(UPPER(status), 'AVAILABLE') = 'AVAILABLE'
        `),
        // Commissions: earned + pending in one pass
        db.pool.query(`
          SELECT
            COALESCE(SUM(deal_value * (commission_percentage/100.0) - co_broker_payout - expenses) FILTER (WHERE payment_status = 'Paid'),   0) AS earned,
            COALESCE(SUM(deal_value * (commission_percentage/100.0) - co_broker_payout - expenses) FILTER (WHERE payment_status = 'Pending'), 0) AS pending
          FROM commissions
        `),
        // Touchpoints: all in a single aggregation query
        db.pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE interaction_type = 'Phone Call') AS calls,
            COUNT(*) FILTER (WHERE interaction_type = 'WhatsApp')   AS chats,
            COUNT(*) FILTER (WHERE interaction_type = 'Site Visit') AS visits,
            COUNT(*) FILTER (WHERE interaction_type = 'Email')      AS emails
          FROM interaction_logs
        `)
      ]);

      // Telephony calls count (separate table)
      const telRes = await db.pool.query('SELECT COUNT(*) AS tel_count FROM telephony_calls');

      const lr = leadsRes.rows[0];
      const pr = propsRes.rows[0];
      const cr = commRes.rows[0];
      const tr = touchRes.rows[0];

      return res.json({
        totalLeads:    parseInt(lr.total_leads),
        hotLeads:      parseInt(lr.hot_leads),
        dueFollowups:  parseInt(lr.due_followups),
        activeListings: parseInt(pr.active_listings),
        commissions: {
          earned:  parseFloat(cr.earned),
          pending: parseFloat(cr.pending),
          total:   parseFloat(cr.earned) + parseFloat(cr.pending)
        },
        touchpoints: {
          calls:  parseInt(tr.calls) + parseInt(telRes.rows[0].tel_count),
          chats:  parseInt(tr.chats),
          visits: parseInt(tr.visits),
          emails: parseInt(tr.emails)
        }
      });
    } else {
      // ── AGENT: fire all agent-scoped queries in parallel ─────────────────
      const agentId = user.id;
      const [leadsRes, propsRes, touchRes, telRes] = await Promise.all([
        db.pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND agent_id = $1)                                               AS total_leads,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'Hot' AND agent_id = $1)                            AS hot_leads,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND next_followup != '' AND next_followup <= $2 AND agent_id = $1) AS due_followups
          FROM leads
        `, [agentId, todayStr]),
        db.pool.query(`
          SELECT COUNT(*) AS active_listings FROM properties
          WHERE deleted_at IS NULL AND COALESCE(UPPER(status), 'AVAILABLE') = 'AVAILABLE'
            AND (agent_id IS NULL OR agent_id = $1)
        `, [agentId]),
        db.pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE i.interaction_type = 'Phone Call') AS calls,
            COUNT(*) FILTER (WHERE i.interaction_type = 'WhatsApp')   AS chats,
            COUNT(*) FILTER (WHERE i.interaction_type = 'Site Visit') AS visits,
            COUNT(*) FILTER (WHERE i.interaction_type = 'Email')      AS emails
          FROM interaction_logs i
          JOIN leads l ON i.lead_id = l.id
          WHERE l.agent_id = $1
        `, [agentId]),
        db.pool.query('SELECT COUNT(*) AS tel_count FROM telephony_calls WHERE agent_id = $1', [agentId])
      ]);

      const lr = leadsRes.rows[0];
      const pr = propsRes.rows[0];
      const tr = touchRes.rows[0];

      return res.json({
        totalLeads:    parseInt(lr.total_leads),
        hotLeads:      parseInt(lr.hot_leads),
        dueFollowups:  parseInt(lr.due_followups),
        activeListings: parseInt(pr.active_listings),
        commissions:   { earned: 0, pending: 0, total: 0 },
        touchpoints: {
          calls:  parseInt(tr.calls) + parseInt(telRes.rows[0].tel_count),
          chats:  parseInt(tr.chats),
          visits: parseInt(tr.visits),
          emails: parseInt(tr.emails)
        }
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/todo
app.get('/api/dashboard/todo', async (req, res) => {
  try {
    const todos = (await db.query('SELECT * FROM todo_tasks ORDER BY id DESC')).rows;
    res.json(todos);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// POST /api/dashboard/todo
app.post('/api/dashboard/todo', async (req, res) => {
  try {
    const {
      task,
      status,
      priority,
      due_date
    } = req.body;
    const info = await (async () => {
      const r = await db.query("INSERT INTO todo_tasks (task, status, priority, due_date) VALUES ($1, $2, $3, $4) RETURNING id", [task, status || 'Incomplete', priority || 'Medium', due_date || '']);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: info.lastInsertRowid,
      task,
      status: status || 'Incomplete',
      priority: priority || 'Medium',
      due_date: due_date || ''
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// PUT /api/dashboard/todo/:id
app.put('/api/dashboard/todo/:id', async (req, res) => {
  try {
    const {
      task,
      status,
      priority,
      due_date
    } = req.body;
    await (async () => {
      const r = await db.query("UPDATE todo_tasks SET task = $1, status = $2, priority = $3, due_date = $4 WHERE id = $5", [task, status, priority, due_date, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: req.params.id,
      task,
      status,
      priority,
      due_date
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// DELETE /api/dashboard/todo/:id
app.delete('/api/dashboard/todo/:id', async (req, res) => {
  try {
    await (async () => {
      const r = await db.query("DELETE FROM todo_tasks WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// GET /api/dashboard/scratchpad
app.get('/api/dashboard/scratchpad', async (req, res) => {
  try {
    const note = (await db.query('SELECT content FROM scratchpad ORDER BY id DESC LIMIT 1')).rows[0];
    res.json({
      content: note ? note.content : ''
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// POST /api/dashboard/scratchpad
app.post('/api/dashboard/scratchpad', async (req, res) => {
  try {
    const {
      content
    } = req.body;
    await (async () => {
      const r = await db.query('DELETE FROM scratchpad');
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })(); // keep only one
    await (async () => {
      const r = await db.query("INSERT INTO scratchpad (content) VALUES ($1) RETURNING id", [content || '']);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 3. DAILY ROUTINE CHECKLIST (DAILY OS)
// ----------------------------------------------------
app.get('/api/daily/checklist', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Ensure checklist is generated
    const checkCount = (await db.query("SELECT COUNT(*) as count FROM daily_checklist WHERE routine_date = $1", [todayStr])).rows[0].count;
    if (checkCount === 0) {
      const morningRoutines = ['Review yesterday\'s pending follow-ups', 'Check for new WhatsApp/portal leads overnight', 'Identify 3 Hot leads — plan first calls', 'Send morning check-in to negotiation-stage leads', 'Review and confirm any site visits scheduled today'];
      const eveningRoutines = ['Log all new enquiries received today', 'Update lead statuses — move pipeline cards', 'Update any inventory price/status changes', 'Plan tomorrow\'s top 3 priority actions', 'Send relationship message to 1 past client'];
      const insertCheck = { run: async (...args) => {
        // If it's an INSERT, append RETURNING id
        let q = 'INSERT INTO daily_checklist (item_name, routine_type, is_checked, routine_date) VALUES ($1, $2, 0, $3)';
        if (q.trim().toUpperCase().startsWith('INSERT') && !q.includes('RETURNING')) {
            q += ' RETURNING id';
        }
        const r = await db.query(q, args);
        return { lastInsertRowid: r.rows[0] ? r.rows[0].id : null, changes: r.rowCount };
   }};

      morningRoutines.forEach(item => insertCheck.run(item, 'Morning', todayStr));
      eveningRoutines.forEach(item => insertCheck.run(item, 'Evening', todayStr));
    }
    const items = (await db.query("SELECT * FROM daily_checklist WHERE routine_date = $1", [todayStr])).rows;
    res.json(items);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/daily/checklist/toggle/:id', async (req, res) => {
  try {
    const {
      is_checked
    } = req.body;
    await (async () => {
      const r = await db.query("UPDATE daily_checklist SET is_checked = $1 WHERE id = $2", [is_checked ? 1 : 0, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id,
      is_checked
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 4. LEADS & PIPELINE API
// ----------------------------------------------------
app.get('/api/leads', async (req, res) => {
  try {
    const {
      search,
      status,
      stage,
      project_type
    } = req.query;
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const allowed = getParsedAllowedPages(user);
    const hasPhoneAccess = isAdmin || allowed.includes('*') || allowed.includes('phone_access');
    let query = 'SELECT * FROM leads WHERE deleted_at IS NULL';
    const params = [];
    if (!isAdmin) {
      query += ' AND agent_id = ?';
      params.push(user.id);
    }
    if (search) {
      query += ' AND (name ILIKE ? OR phone ILIKE ? OR email ILIKE ? OR notes ILIKE ? OR project_type ILIKE ? OR location_preference ILIKE ? OR config_bhk ILIKE ? OR admin_comments ILIKE ? OR property_requirement ILIKE ? OR source ILIKE ? OR special_tags ILIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s, s, s);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (stage) {
      query += ' AND stage = ?';
      params.push(stage);
    }
    if (project_type) {
      query += ' AND project_type = ?';
      params.push(project_type);
    }
    query += ' ORDER BY id DESC';
    const leads = (await db.query(query, [params])).rows;

    // Mask sensitive fields and compute dynamic lead score (Phase 9)
    // Bulk fetch aggregations to avoid N+1 queries bottleneck
    let interactionLogsMap = {};
    let telephonyCallsMap = {};
    let leadActivitiesMap = {};
    let proposalsMap = {};
    let scorecardsMap = {};
    let leadTimelineMap = {};

    if (leads.length > 0) {
      const leadIds = leads.map(l => l.id);
      
      const [
        interactionRes,
        telephonyRes,
        activitiesRes,
        proposalsRes,
        scorecardsRes,
        timelineRes
      ] = await Promise.all([
        db.pool.query(`
          SELECT lead_id,
                 COALESCE(SUM(CASE WHEN interaction_type IN ('Calls', 'Phone Call') THEN 1 ELSE 0 END), 0) AS calls_count,
                 COALESCE(SUM(CASE WHEN interaction_type = 'WhatsApp' THEN 1 ELSE 0 END), 0) AS chats_count,
                 COALESCE(SUM(CASE WHEN interaction_type = 'Site Visit' THEN 1 ELSE 0 END), 0) AS visits_count,
                 MAX(created_at) AS max_created
          FROM interaction_logs
          WHERE lead_id = ANY($1)
          GROUP BY lead_id
        `, [leadIds]),
        db.pool.query(`
          SELECT lead_id,
                 COUNT(*) AS tel_count,
                 MAX(created_at) AS max_created
          FROM telephony_calls
          WHERE lead_id = ANY($1)
          GROUP BY lead_id
        `, [leadIds]),
        db.pool.query(`
          SELECT lead_id,
                 COALESCE(SUM(CASE WHEN type = 'Site Visit' THEN 1 ELSE 0 END), 0) AS visits_count,
                 MAX(timestamp) AS max_timestamp
          FROM lead_activities
          WHERE lead_id = ANY($1)
          GROUP BY lead_id
        `, [leadIds]),
        db.pool.query(`
          SELECT lead_id,
                 COUNT(*) AS props_count
          FROM proposals
          WHERE lead_id = ANY($1)
          GROUP BY lead_id
        `, [leadIds]),
        db.pool.query(`
          SELECT lead_id, budget, timeline, funding, responsiveness, clarity
          FROM lead_scorecards
          WHERE lead_id = ANY($1)
        `, [leadIds]),
        db.pool.query(`
          SELECT lead_id,
                 MAX(created_at) AS max_created
          FROM lead_timeline
          WHERE lead_id = ANY($1)
          GROUP BY lead_id
        `, [leadIds])
      ]);

      interactionRes.rows.forEach(r => { interactionLogsMap[r.lead_id] = r; });
      telephonyRes.rows.forEach(r => { telephonyCallsMap[r.lead_id] = r; });
      activitiesRes.rows.forEach(r => { leadActivitiesMap[r.lead_id] = r; });
      proposalsRes.rows.forEach(r => { proposalsMap[r.lead_id] = r; });
      scorecardsRes.rows.forEach(r => { scorecardsMap[r.lead_id] = r; });
      timelineRes.rows.forEach(r => { leadTimelineMap[r.lead_id] = r; });
    }

    const processedLeads = leads.map(l => {
      let score = 15; // base
      try {
        const interactionData = interactionLogsMap[l.id] || {};
        const telephonyData = telephonyCallsMap[l.id] || {};
        const activitiesData = leadActivitiesMap[l.id] || {};
        const proposalsData = proposalsMap[l.id] || {};
        const card = scorecardsMap[l.id] || null;

        const callsCount = parseInt(interactionData.calls_count || 0);
        const telCallsCount = parseInt(telephonyData.tel_count || 0);
        const totalCalls = callsCount + telCallsCount;

        const chatsCount = parseInt(interactionData.chats_count || 0);

        const visitsCount = parseInt(interactionData.visits_count || 0);
        const actVisitsCount = parseInt(activitiesData.visits_count || 0);
        const totalVisits = visitsCount + actVisitsCount;

        const propsCount = parseInt(proposalsData.props_count || 0);

        score += totalCalls * 15;
        score += chatsCount * 5;
        score += totalVisits * 30;
        score += propsCount * 20;

        if (card) {
          score += (parseInt(card.budget || 0) + parseInt(card.timeline || 0) + parseInt(card.funding || 0) + parseInt(card.responsiveness || 0) + parseInt(card.clarity || 0)) * 1.5;
        }

        // Days Active: +2 points per day (max 20 points / 10 days)
        const daysActive = l.created_at ? Math.max(0, Math.floor((new Date() - new Date(l.created_at)) / (1000 * 60 * 60 * 24))) : 0;
        score += Math.min(20, daysActive * 2);

        // Age Decay based on last interaction date
        let lastDate = l.created_at ? new Date(l.created_at) : null;
        
        const dates = [
          interactionData.max_created,
          telephonyData.max_created,
          activitiesData.max_timestamp,
          leadTimelineMap[l.id]?.max_created
        ].filter(Boolean).map(v => new Date(v));

        if (dates.length > 0) {
          const maxD = new Date(Math.max(...dates));
          if (!lastDate || maxD > lastDate) {
            lastDate = maxD;
          }
        }

        if (lastDate) {
          const daysSinceLast = Math.max(0, Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24)));
          if (daysSinceLast > 30) {
            score *= 0.4; // 60% decay
          } else if (daysSinceLast > 14) {
            score *= 0.6; // 40% decay
          } else if (daysSinceLast > 7) {
            score *= 0.8; // 20% decay
          }
        }
      } catch (errScore) {
        console.error('Failed to compute lead score dynamically:', errScore);
      }
      const finalScore = Math.min(99, Math.max(1, Math.round(score)));
      const resLead = {
        ...l,
        lead_score: finalScore
      };
      const shouldMaskContact = !isAdmin && !hasPhoneAccess && l.agent_id !== user.id || !systemSettings.showMaskedFields;
      if (shouldMaskContact) {
        return {
          ...resLead,
          phone: l.phone ? l.phone.slice(0, 4) + 'XXXXXX' + l.phone.slice(-2) : '🔐 Hidden',
          email: l.email ? 'e***@***.com' : '🔐 Hidden',
          admin_comments: '🔐 Hidden (Admin locked)'
        };
      }
      return resLead;
    });
    res.json(processedLeads);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Helper function for Auto Lead Assignment (Phase 6)
async function assignLeadToAgent(notes, location) {
  try {
    // Fetch active assignment settings rule
    const setting = (await db.query("SELECT rule_type FROM auto_assignment_settings WHERE is_active = 1")).rows[0];
    const ruleType = setting ? setting.rule_type : 'ROUND_ROBIN';

    // Fetch active agents
    const agents = (await db.query("SELECT * FROM agents WHERE status = 'ACTIVE'")).rows;
    if (agents.length === 0) {
      return {
        id: null,
        name: 'Unassigned'
      };
    }
    if (ruleType === 'LOCATION_BASED') {
      const searchText = ((notes || '') + ' ' + (location || '')).toLowerCase();

      // Look for agent matching location specialty
      for (const agent of agents) {
        if (agent.location_specialty && agent.location_specialty !== 'All Zones') {
          const specialties = agent.location_specialty.split(',').map(s => s.trim().toLowerCase());
          for (const spec of specialties) {
            if (spec && searchText.includes(spec)) {
              // Found location match, increment counter and return
              await (async () => {
                const r = await db.query("UPDATE agents SET leads_assigned = leads_assigned + 1 WHERE id = $1", [agent.id]);
                return {
                  lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
                  changes: r.rowCount
                };
              })();
              return {
                id: agent.id,
                name: agent.name
              };
            }
          }
        }
      }
    }

    // Fallback to ROUND_ROBIN: Select agent with lowest assignment count
    const selectedAgent = agents.reduce((prev, curr) => prev.leads_assigned < curr.leads_assigned ? prev : curr, agents[0]);
    await (async () => {
      const r = await db.query("UPDATE agents SET leads_assigned = leads_assigned + 1 WHERE id = $1", [selectedAgent.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    return {
      id: selectedAgent.id,
      name: selectedAgent.name
    };
  } catch (e) {
    console.error("Auto assignment failed:", e);
    return {
      id: null,
      name: 'Unassigned'
    };
  }
}
app.post('/api/leads', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      source,
      status,
      stage,
      project_type,
      budget_min,
      budget_max,
      notes,
      next_followup,
      followup_status,
      touchpoint,
      location_preference,
      config_bhk,
      timeline_preference,
      special_tags,
      documents,
      admin_comments,
      property_requirement,
      associate_id,
      agent_id
    } = req.body;

    // Duplicate Phone Detection
    if (phone && phone.trim() !== '') {
      const existing = (await db.query("SELECT id, name FROM leads WHERE phone = $1 AND deleted_at IS NULL", [phone.trim()])).rows[0];
      if (existing) {
        if (req.query.force !== 'true') {
          // Log manual block audit
          await db.query(`
            INSERT INTO duplicate_leads_audit (lead_name, phone, email, source, existing_lead_id, existing_lead_name, action_taken)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [name, phone.trim(), email || '', source || 'Manual Add', existing.id, existing.name, 'Blocked (Manual Add)']);
          
          return res.status(409).json({
            error: `Duplicate Mobile Number! This number is already registered under the lead "${existing.name}".`,
            existingId: existing.id
          });
        } else {
          // Log manual bypass audit
          await db.query(`
            INSERT INTO duplicate_leads_audit (lead_name, phone, email, source, existing_lead_id, existing_lead_name, action_taken)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [name, phone.trim(), email || '', source || 'Manual Add', existing.id, existing.name, 'Bypassed (Manual Add)']);
        }
      }
    }

    // Manual Agent Assignment vs Auto-routing
    let assignment = { id: null, name: 'Unassigned' };
    if (agent_id !== undefined && agent_id !== null && agent_id !== '') {
      const selectedAgent = (await db.query("SELECT id, name FROM agents WHERE id = $1", [parseInt(agent_id)])).rows[0];
      if (selectedAgent) {
        assignment = { id: selectedAgent.id, name: selectedAgent.name };
        // Increment agent lead count
        await db.query("UPDATE agents SET leads_assigned = leads_assigned + 1 WHERE id = $1", [selectedAgent.id]);
      } else {
        assignment = await assignLeadToAgent(notes, location_preference || '');
      }
    } else {
      assignment = await assignLeadToAgent(notes, location_preference || '');
    }

    // Calculate initial rental expiry if rental
    let rental_expiry = '';
    if (project_type === 'Rental' && status === 'Closed') {
      const d = new Date();
      d.setMonth(d.getMonth() + 11);
      rental_expiry = d.toISOString().split('T')[0];
    }
    const info = await (async () => {
      const r = await db.query(`
      INSERT INTO leads (name, phone, email, source, status, stage, project_type, budget_min, budget_max, notes, next_followup, followup_status, touchpoint, location_preference, config_bhk, timeline_preference, special_tags, documents, agent_id, agent_name, rental_expiry_date, admin_comments, property_requirement, associate_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
     RETURNING id`, [name, phone || '', email || '', source || 'Website', status || 'Warm', stage || 'New', project_type || 'Residential', budget_min || 0, budget_max || 0, notes || '', next_followup || '', followup_status || 'None', touchpoint || 'Calls', location_preference || '', config_bhk || '', timeline_preference || '', special_tags || '', documents || '[]', assignment.id, assignment.name, rental_expiry, admin_comments || '', property_requirement || '', associate_id ? parseInt(associate_id) : null]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();

    const leadId = info.lastInsertRowid;
    const customLeadId = `LD-${1000 + leadId}`;
    await db.query(`UPDATE leads SET custom_lead_id = $1 WHERE id = $2`, [customLeadId, leadId]);

    res.json({
      id: leadId,
      custom_lead_id: customLeadId,
      ...req.body,
      agent_id: assignment.id,
      agent_name: assignment.name,
      rental_expiry_date: rental_expiry,
      lead_score: 0
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.put('/api/leads/:id', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      source,
      status,
      stage,
      project_type,
      budget_min,
      budget_max,
      notes,
      next_followup,
      followup_status,
      touchpoint,
      location_preference,
      config_bhk,
      timeline_preference,
      special_tags,
      documents,
      rental_expiry_date,
      lead_score,
      admin_comments,
      property_requirement,
      associate_id,
      agent_id
    } = req.body;

    const currentLead = (await db.query("SELECT agent_id, agent_name FROM leads WHERE id = $1", [req.params.id])).rows[0];
    let finalAgentId = currentLead ? currentLead.agent_id : null;
    let finalAgentName = currentLead ? currentLead.agent_name : 'Unassigned';

    if (agent_id !== undefined && agent_id !== null && agent_id !== '') {
      const numericAgentId = parseInt(agent_id);
      if (!currentLead || currentLead.agent_id !== numericAgentId) {
        const selectedAgent = (await db.query("SELECT id, name FROM agents WHERE id = $1", [numericAgentId])).rows[0];
        if (selectedAgent) {
          finalAgentId = selectedAgent.id;
          finalAgentName = selectedAgent.name;
          await db.query("UPDATE agents SET leads_assigned = leads_assigned + 1 WHERE id = $1", [selectedAgent.id]);
        }
      }
    } else if (agent_id === null || agent_id === '') {
      finalAgentId = null;
      finalAgentName = 'Unassigned';
    }

    await db.query(`
      UPDATE leads
      SET name = $1, phone = $2, email = $3, source = $4, status = $5, stage = $6, project_type = $7, budget_min = $8, budget_max = $9, notes = $10, next_followup = $11, followup_status = $12, touchpoint = $13, location_preference = $14, config_bhk = $15, timeline_preference = $16, special_tags = $17, documents = $18, rental_expiry_date = $19, lead_score = $20, admin_comments = $21, property_requirement = $22, associate_id = $23, agent_id = $24, agent_name = $25
      WHERE id = $26
    `, [name, phone, email, source, status, stage, project_type, budget_min, budget_max, notes, next_followup, followup_status || 'None', touchpoint || 'Calls', location_preference, config_bhk, timeline_preference, special_tags, JSON.stringify(documents || []), rental_expiry_date || '', lead_score || 0, admin_comments || '', property_requirement || '', associate_id ? parseInt(associate_id) : null, finalAgentId, finalAgentName, req.params.id]);

    res.json({
      id: req.params.id,
      ...req.body,
      agent_id: finalAgentId,
      agent_name: finalAgentName
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Lead Activities Endpoints
app.get('/api/leads/:id/activities', async (req, res) => {
  try {
    const acts = (await db.query("SELECT * FROM lead_activities WHERE lead_id = $1 ORDER BY timestamp DESC", [req.params.id])).rows;
    res.json(acts);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/leads/:id/activities', async (req, res) => {
  try {
    const {
      type,
      description
    } = req.body;
    const info = await (async () => {
      const r = await db.query("INSERT INTO lead_activities (lead_id, type, description) VALUES ($1, $2, $3) RETURNING id", [req.params.id, type, description]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();

    // Also save into interaction_logs for unified dashboard telemetry statistics
    await (async () => {
      const r = await db.query("INSERT INTO interaction_logs (lead_id, interaction_type, notes) VALUES ($1, $2, $3) RETURNING id", [req.params.id, type, description]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();

    // Auto-update lead score based on activity type
    let scoreBump = 1;
    if (type === 'Site Visit') scoreBump = 20;else if (type === 'Meeting') scoreBump = 15;else if (type === 'Proposal Sent') scoreBump = 10;else if (type === 'Call Logged' || type === 'Phone Call') scoreBump = 5;
    await (async () => {
      const r = await db.query("UPDATE leads SET lead_score = lead_score + $1 WHERE id = $2", [scoreBump, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: info.lastInsertRowid,
      type,
      description,
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Lead AI Matching Endpoint
app.get('/api/leads/:id/matches', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const lead = (await db.query("SELECT * FROM leads WHERE id = $1", [id])).rows[0];
    if (!lead) return res.status(404).json({
      error: "Lead not found"
    });

    // Fetch active available properties
    const properties = (await db.query("SELECT * FROM properties WHERE status = 'AVAILABLE' AND deleted_at IS NULL")).rows;
    const matches = await Promise.all(properties.map(async p => {
      let scoreLocality = 0;
      let scoreBudget = 0;
      let scoreBHK = 0;
      let scoreFacing = 0;

      // 1. Locality overlap (35% weight)
      const pLoc = (p.location || '').toLowerCase().trim();
      const lLoc = (lead.location_preference || '').toLowerCase().trim();
      if (lLoc && pLoc) {
        if (pLoc === lLoc || pLoc.includes(lLoc) || lLoc.includes(pLoc)) {
          scoreLocality = 35;
        } else {
          scoreLocality = 5; // minimal micro-market proximity fallback
        }
      } else {
        scoreLocality = 20; // Default partial if lead has no preference
      }

      // 2. Budget match (30% weight)
      const price = parseFloat(p.price || 0);
      const bMin = parseFloat(lead.budget_min || 0);
      const bMax = parseFloat(lead.budget_max || Infinity);
      if (price > 0) {
        if (price >= bMin && price <= bMax) {
          scoreBudget = 30;
        } else if (price > bMax) {
          const dev = (price - bMax) / bMax;
          scoreBudget = Math.max(0, Math.round(30 * (1 - dev * 4)));
        } else if (price < bMin) {
          const dev = (bMin - price) / bMin;
          scoreBudget = Math.max(0, Math.round(30 * (1 - dev * 1.5)));
        }
      } else {
        scoreBudget = 15; // default fallback if price not set
      }

      // 3. BHK match (20% weight)
      const pBhkStr = (p.configuration || '').toLowerCase();
      const lBhkStr = (lead.config_bhk || '').toLowerCase();
      if (lBhkStr && pBhkStr) {
        const pNum = pBhkStr.replace(/[^0-9]/g, '');
        const lNum = lBhkStr.replace(/[^0-9]/g, '');
        if (pNum && lNum && pNum === lNum) {
          scoreBHK = 20;
        } else if (pBhkStr.includes(lBhkStr) || lBhkStr.includes(pBhkStr)) {
          scoreBHK = 20;
        } else {
          scoreBHK = 5; // close category fallback
        }
      } else {
        scoreBHK = 10;
      }

      // 4. Facing preference (15% weight)
      let lFacing = '';
      const notes = (lead.notes || '').toLowerCase();
      if (notes.includes('east')) lFacing = 'east';else if (notes.includes('west')) lFacing = 'west';else if (notes.includes('north')) lFacing = 'north';else if (notes.includes('south')) lFacing = 'south';
      const pFacing = (p.facing || '').toLowerCase();
      if (lFacing) {
        if (pFacing && pFacing.includes(lFacing)) {
          scoreFacing = 15;
        } else {
          scoreFacing = 0;
        }
      } else {
        scoreFacing = 15; // default full marks if client has no facing preference
      }
      const totalScore = Math.min(100, Math.round(scoreLocality + scoreBudget + scoreBHK + scoreFacing));

      // Dynamic AI Rationale Generation (Local Compiler)
      let rationale = '';
      if (totalScore >= 80) {
        rationale = `Outstanding match at ${totalScore}%. This unit at ${p.society} in ${p.location || 'Bangalore'} fits your ${lead.config_bhk || 'desired'} configuration. Price of ₹${(price / 10000000).toFixed(2)} Cr perfectly aligns with your max budget of ₹${((lead.budget_max || price) / 10000000).toFixed(2)} Cr.`;
      } else if (totalScore >= 60) {
        rationale = `Strong match at ${totalScore}%. Good location proximity in ${p.location || 'prime suburbs'}. Pricing is at ₹${(price / 10000000).toFixed(2)} Cr, which is within moderate range of your budget boundaries.`;
      } else {
        rationale = `Moderate match at ${totalScore}%. Property offers good value in ${p.location} at ₹${(price / 10000000).toFixed(2)} Cr. Budget deviation is slightly high, but layout size and secondary amenities could suit your requirement.`;
      }
      return {
        id: p.id,
        prop_id: p.prop_id,
        society: p.society,
        location: p.location,
        bedrooms_bhk: p.bedrooms_bhk || p.configuration,
        facing: p.facing,
        price: p.price,
        price_raw: p.price_raw,
        interiors: p.interiors,
        area_sqft: p.area_sqft,
        score: totalScore,
        rationale,
        breakdown: {
          locality: scoreLocality,
          budget: scoreBudget,
          bhk: scoreBHK,
          facing: scoreFacing
        }
      };
    }));

    // Sort matches descending by score
    matches.sort((a, b) => b.score - a.score);

    // Fetch previously offered properties
    const offered = (await db.query("SELECT property_id, status FROM lead_property_interest WHERE lead_id = $1", [id])).rows;
    res.json({
      matches,
      offered
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/leads/:id/interest', async (req, res) => {
  try {
    const {
      property_id,
      status
    } = req.body;
    await (async () => {
      const existing = (await db.query("SELECT id FROM lead_property_interest WHERE lead_id = $1 AND property_id = $2", [req.params.id, property_id])).rows[0];
      let r;
      if (existing) {
        r = await db.query("UPDATE lead_property_interest SET status = $1 WHERE id = $2 RETURNING id", [status, existing.id]);
      } else {
        r = await db.query("INSERT INTO lead_property_interest (lead_id, property_id, status) VALUES ($1, $2, $3) RETURNING id", [req.params.id, property_id, status]);
      }
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();

    // Add an activity log automatically
    await (async () => {
      const r = await db.query("INSERT INTO lead_activities (lead_id, type, description) VALUES ($1, $2, $3) RETURNING id", [req.params.id, 'Property Offered', `Property ID ${property_id} marked as ${status}.`]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    await (async () => {
      const r = await db.query("UPDATE leads SET lead_score = lead_score + 10 WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.patch('/api/leads/:id/stage', async (req, res) => {
  try {
    const {
      stage
    } = req.body;
    await (async () => {
      const r = await db.query("UPDATE leads SET stage = $1 WHERE id = $2", [stage, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id,
      stage
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.delete('/api/leads/:id', async (req, res) => {
  try {
    await (async () => {
      const r = await db.query("UPDATE leads SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.patch('/api/leads/:id/restore', async (req, res) => {
  try {
    await (async () => {
      const r = await db.query("UPDATE leads SET deleted_at = NULL WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Link Associate to Lead
app.patch('/api/leads/:id/associate', async (req, res) => {
  try {
    const {
      associate_id
    } = req.body;
    await (async () => {
      const r = await db.query("UPDATE leads SET associate_id = $1 WHERE id = $2", [associate_id ? parseInt(associate_id) : null, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id,
      associate_id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Update Closure Journey for Lead
app.patch('/api/leads/:id/closure', async (req, res) => {
  try {
    const {
      closure_site_visit,
      closure_joint_visit,
      closure_negotiation,
      closure_agreement,
      closure_registration,
      closure_closed,
      closure_prop_id,
      closure_commission_amt,
      closure_notes
    } = req.body;
    
    await db.query(`
      UPDATE leads
      SET closure_site_visit = $1,
          closure_joint_visit = $2,
          closure_negotiation = $3,
          closure_agreement = $4,
          closure_registration = $5,
          closure_closed = $6,
          closure_prop_id = $7,
          closure_commission_amt = $8,
          closure_notes = $9
      WHERE id = $10
    `, [
      closure_site_visit === true || closure_site_visit === 'true',
      closure_joint_visit === true || closure_joint_visit === 'true',
      closure_negotiation === true || closure_negotiation === 'true',
      closure_agreement === true || closure_agreement === 'true',
      closure_registration === true || closure_registration === 'true',
      closure_closed === true || closure_closed === 'true',
      closure_prop_id || null,
      closure_commission_amt ? parseFloat(closure_commission_amt) : null,
      closure_notes || null,
      req.params.id
    ]);

    // If deal is closed, automatically log a closed deal activity and link to commissions
    if (closure_closed === true || closure_closed === 'true') {
      await db.query("INSERT INTO lead_activities (lead_id, type, description) VALUES ($1, 'Deal Closed', $2)", 
        [req.params.id, `Closed deal on Property ${closure_prop_id || 'N/A'} for commission ₹${closure_commission_amt || 0}`]);
      
      // Also update lead pipeline stage to 'Sale Closed' / 'Closed'
      await db.query("UPDATE leads SET stage = 'Sale Closed', status = 'Closed' WHERE id = $1", [req.params.id]);

      // Auto-register transaction in commissions ledger
      try {
        const lead = (await db.query("SELECT name, associate_id FROM leads WHERE id = $1", [req.params.id])).rows[0];
        const propIdInt = closure_prop_id ? parseInt(closure_prop_id) : null;
        let property = null;
        if (propIdInt && !isNaN(propIdInt)) {
          property = (await db.query("SELECT society, price FROM properties WHERE id = $1", [propIdInt])).rows[0];
        }

        const dealName = `${lead ? lead.name : 'Client'} - ${property ? property.society : 'Deal closure'}`;
        const dealValue = property ? parseFloat(property.price || 0) : 0;
        const commAmt = closure_commission_amt ? parseFloat(closure_commission_amt) : 0;
        const commPct = dealValue > 0 ? (commAmt / dealValue) * 100 : 0;
        const assocId = lead ? lead.associate_id : null;

        const commCheck = await db.query("SELECT id FROM commissions WHERE lead_id = $1", [req.params.id]);
        if (commCheck.rows.length === 0) {
          await db.query(`
            INSERT INTO commissions (deal_name, deal_value, commission_percentage, commission_amount, payment_status, booking_date, created_at, lead_id, property_id, associate_id)
            VALUES ($1, $2, $3, $4, 'Pending', CURRENT_DATE, CURRENT_TIMESTAMP, $5, $6, $7)
          `, [dealName, dealValue, commPct, commAmt, req.params.id, propIdInt, assocId]);
        }
      } catch (errComm) {
        console.error("Failed to auto-register commission during lead closure:", errComm);
      }
    }
    
    res.json({
      success: true,
      id: req.params.id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// GET /api/admin/today-activity
app.get('/api/admin/today-activity', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayStartStr = todayStart.toISOString();

    const leadsQuery = `
      SELECT id, name, created_at, agent_name, source, project_type 
      FROM leads 
      WHERE deleted_at IS NULL 
        AND created_at IS NOT NULL
        AND created_at::timestamptz >= $1
    `;
    const propsQuery = `
      SELECT id, prop_id, last_updated as created_at, society, location, price, property_type 
      FROM properties 
      WHERE deleted_at IS NULL 
        AND last_updated IS NOT NULL
        AND last_updated::timestamptz >= $1
    `;
    const projsQuery = `
      SELECT id, project_name, builder_name, created_at, location 
      FROM builder_projects 
      WHERE deleted_at IS NULL 
        AND created_at IS NOT NULL
        AND created_at::timestamptz >= $1
    `;

    const leads = (await db.query(leadsQuery, [todayStartStr])).rows;
    const properties = (await db.query(propsQuery, [todayStartStr])).rows;
    const projects = (await db.query(projsQuery, [todayStartStr])).rows;

    res.json({
      leads,
      properties,
      projects
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk Delete Leads
app.post('/api/leads/bulk-delete', async (req, res) => {
  try {
    const {
      ids
    } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'No IDs provided'
      });
    }
    const placeholders = ids.map(() => '?').join(',');
    await (async () => {
      const r = await db.query(`UPDATE leads SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, [ids]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      count: ids.length
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Bulk Update Leads
app.post('/api/leads/bulk-update', async (req, res) => {
  try {
    const {
      ids,
      field,
      value
    } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'No IDs provided'
      });
    }
    let allowedFields = ['status', 'stage'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        error: 'Field update not allowed'
      });
    }
    const placeholders = ids.map(() => '?').join(',');
    await (async () => {
      const r = await db.query(`UPDATE leads SET ${field} = $1 WHERE id IN (${placeholders})`, [value, ...ids]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      count: ids.length
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 5. PROPERTIES API (WITH FIELD MASKING CONTROL)
// ----------------------------------------------------

function calculateIDLogic(propType, availableFor, zone, year) {
  const isComm = propType && (propType.toLowerCase().includes('commercial') || propType.toLowerCase().includes('retail') || propType.toLowerCase().includes('warehouse') || propType.toLowerCase().includes('office') || propType.toLowerCase().includes('showroom'));
  const isRent = availableFor && (availableFor.toLowerCase().includes('rent') || availableFor.toLowerCase().includes('lease'));
  let category = 'prop_residential_resale';
  let prefix = '';
  if (isComm && isRent) {
    category = 'prop_commercial_rental';
    prefix = 'CRT';
  } else if (isComm && !isRent) {
    category = 'prop_commercial_sale';
    prefix = 'C';
  } else if (!isComm && isRent) {
    category = 'prop_residential_rental';
    prefix = 'RT';
  } else {
    category = 'prop_residential_resale';
    prefix = '';
  }
  const z = zone || 'N';
  const y = year || new Date().getFullYear().toString();
  const counterKey = `${category}_${y}`;
  return {
    prefix,
    category,
    counterKey,
    z,
    y
  };
}
app.get('/api/generate-id', async (req, res) => {
  try {
    const {
      propType,
      availableFor,
      isProject,
      zone,
      year
    } = req.query;
    let prefix = '';
    let counterKey = '';
    let z = zone || 'N';
    let y = year || new Date().getFullYear().toString();
    if (isProject === 'true') {
      prefix = 'PROJ-';
      counterKey = `proj_global_${y}`;
    } else {
      const logic = calculateIDLogic(propType, availableFor, zone, year);
      prefix = logic.prefix;
      counterKey = logic.counterKey;
    }
    let row = (await db.query("SELECT last_value FROM sequence_counters WHERE category_key = $1", [counterKey])).rows[0];
    let nextVal = 151;
    if (row) {
      nextVal = row.last_value + 1;
    }
    const generatedId = `${prefix}${nextVal}/${z}-${y}`;
    res.json({
      generatedId,
      nextVal,
      counterKey
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.get('/api/properties', async (req, res) => {
  try {
    const {
      min_price,
      max_price,
      configuration,
      mandate_type,
      search,
      rera_checked,
      property_type
    } = req.query;
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const allowed = getParsedAllowedPages(user);
    const hasPhoneAccess = isAdmin || allowed.includes('*') || allowed.includes('phone_access');
    let query = `
      SELECT p.*, 
             a.name AS associate_name, 
             a.company AS associate_company,
             (SELECT COUNT(*) FROM associate_shares WHERE property_id = p.id) AS total_shares,
             (SELECT STRING_AGG(DISTINCT a2.name, ', ') FROM associate_shares s2 JOIN associates a2 ON s2.associate_id = a2.id WHERE s2.property_id = p.id) AS shared_with_list,
             ((SELECT COUNT(*) FROM leads l WHERE (l.closure_prop_id = p.id::text OR (l.closure_prop_id IS NOT NULL AND l.closure_prop_id = p.prop_id)) AND (l.closure_site_visit = true OR l.closure_joint_visit = true)) + (CASE WHEN p.closure_site_visit = true OR p.closure_joint_visit = true THEN 1 ELSE 0 END)) AS total_visits,
             (SELECT STRING_AGG(DISTINCT COALESCE(l.agent_name, 'Unknown Agent'), ', ') FROM leads l WHERE (l.closure_prop_id = p.id::text OR (l.closure_prop_id IS NOT NULL AND l.closure_prop_id = p.prop_id)) AND (l.closure_site_visit = true OR l.closure_joint_visit = true)) AS visiting_agents_list
      FROM properties p 
      LEFT JOIN associates a ON p.associate_id = a.id 
      WHERE p.deleted_at IS NULL
    `;
    const params = [];
    if (min_price) {
      query += ' AND p.price >= ?';
      params.push(parseFloat(min_price));
    }
    if (max_price) {
      query += ' AND p.price <= ?';
      params.push(parseFloat(max_price));
    }
    if (configuration) {
      query += ' AND p.configuration ILIKE ?';
      params.push(`%${configuration}%`);
    }
    if (mandate_type) {
      query += ' AND p.mandate_type ILIKE ?';
      params.push(`%${mandate_type}%`);
    }
    if (property_type) {
      query += ' AND p.property_type ILIKE ?';
      params.push(`%${property_type}%`);
    }
    if (rera_checked !== undefined && rera_checked !== '') {
      query += ' AND p.rera_checked = ?';
      params.push(parseInt(rera_checked));
    }
    if (search) {
      query += ' AND (p.society ILIKE ? OR p.location ILIKE ? OR p.property_type ILIKE ? OR p.prop_id ILIKE ? OR p.owner_name ILIKE ? OR p.owner_phone ILIKE ? OR p.owner_email ILIKE ? OR p.comments ILIKE ? OR p.admin_comments ILIKE ? OR p.additional_info ILIKE ? OR p.configuration ILIKE ? OR p.special_tags ILIKE ? OR a.name ILIKE ? OR a.company ILIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s, s, s, s, s, s);
    }
    query += ' ORDER BY p.id DESC';
    const listings = (await db.query(query, [params])).rows;

    // Stale listing check: last_updated older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const processedListings = await Promise.all(listings.map(async l => {
      const isStale = l.last_updated < sevenDaysAgo;
      const masked = maskProperty(l, user);
      return {
        ...masked,
        is_stale: isStale
      };
    }));
    res.json(processedListings);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/properties', async (req, res) => {
  try {
    const {
      prop_id,
      mandate_type,
      property_type,
      society,
      location,
      status,
      site_area,
      area_sqft,
      configuration,
      floor_info,
      floor_range,
      interiors,
      facing,
      amenities,
      car_park,
      price,
      price_raw,
      possession,
      project_size,
      project_status,
      additional_info,
      video_link,
      photo_link,
      brochure_link,
      owner_name,
      owner_phone,
      owner_email,
      unit_no,
      registration_status,
      source,
      sub_source,
      comments,
      maintenance,
      deposit,
      available_from,
      date_of_inventory,
      available_for,
      plot_size,
      sba,
      special_tags,
      zone,
      onboarded_year,
      plot_dimension,
      plot_facing,
      house_facing,
      holder_type,
      admin_comments,
      associate_id,
      project_id,
      commission_agreed,
      google_map_url,
      road_width,
      fsi
    } = req.body;
    const user = getRequestUser(req);
    const agentId = user ? user.id : null;

    // Duplicate detection check (society + owner_phone)
    if (req.query.force !== 'true') {
      const existing = (await db.query("SELECT id FROM properties WHERE society = $1 AND owner_phone = $2 AND deleted_at IS NULL", [society || '', owner_phone || ''])).rows[0];
      if (existing) {
        return res.status(409).json({
          error: 'A property listing inside this society/project linked with this owner phone number already exists!',
          existingId: existing.id
        });
      }
    }

    // Auto-generate prop_id if missing
    let pId = prop_id;
    if (!pId) {
      const logic = calculateIDLogic(property_type, available_for, zone, onboarded_year);
      let row = (await db.query("SELECT last_value FROM sequence_counters WHERE category_key = $1", [logic.counterKey])).rows[0];
      let nextVal = 151;
      if (row) {
        nextVal = row.last_value + 1;
        await (async () => {
          const r = await db.query("UPDATE sequence_counters SET last_value = $1 WHERE category_key = $2", [nextVal, logic.counterKey]);
          return {
            lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
            changes: r.rowCount
          };
        })();
      } else {
        await (async () => {
          const r = await db.query("INSERT INTO sequence_counters (category_key, last_value) VALUES ($1, $2) RETURNING category_key", [logic.counterKey, nextVal]);
          return {
            lastInsertRowid: null,
            changes: r.rowCount
          };
        })();
      }
      pId = `${logic.prefix}${nextVal}/${logic.z}-${logic.y}`;
    }

    // Clean and format price_raw if missing
    let pRaw = price_raw;
    if (!pRaw) {
      if ((available_for || '').toLowerCase().includes('rent')) {
        const rentVal = price || 0;
        pRaw = `₹${rentVal.toLocaleString()}/mo`;
      } else {
        const priceVal = price || 0;
        if (priceVal >= 10000000) {
          pRaw = `₹${(priceVal / 10000000).toFixed(2)} Cr`;
        } else if (priceVal >= 100000) {
          pRaw = `₹${(priceVal / 100000).toFixed(2)} L`;
        } else {
          pRaw = `₹${priceVal.toLocaleString()}`;
        }
      }
    }
    const info = await (async () => {
      const r = await db.query(`
      INSERT INTO properties (
        prop_id, mandate_type, property_type, society, location, status,
        site_area, area_sqft, configuration, floor_info, floor_range,
        interiors, facing, amenities, car_park, price, price_raw, possession,
        project_size, project_status, additional_info, video_link, photo_link,
        brochure_link, owner_name, owner_phone, owner_email, unit_no,
        registration_status, source, sub_source, comments,
        maintenance, deposit, available_from, date_of_inventory, available_for,
        plot_size, sba, special_tags, zone, onboarded_year,
        plot_dimension, plot_facing, house_facing, holder_type, admin_comments, associate_id, project_id, agent_id, commission_agreed, google_map_url, road_width, fsi, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, CURRENT_TIMESTAMP)
     RETURNING id`, [pId, mandate_type || 'Open', property_type || 'Resale', society, location || '', status || 'AVAILABLE', site_area || '', parseFloat(area_sqft || 0), configuration || '', floor_info || '', floor_range || '', interiors || 'Unfurnished', facing || '', amenities || '', car_park || '', parseFloat(price || 0), pRaw, possession || '', project_size || '', project_status || '', additional_info || '', video_link || '', photo_link || '', brochure_link || '', owner_name || '', owner_phone || '', owner_email || '', unit_no || '', registration_status || '', source || '', sub_source || '', comments || '', parseFloat(maintenance || 0), parseFloat(deposit || 0), available_from || '', date_of_inventory || '', available_for || 'Sale', plot_size || '', sba || '', special_tags || '', zone || 'N', onboarded_year || new Date().getFullYear().toString(), plot_dimension || '', plot_facing || '', house_facing || '', holder_type || '', admin_comments || '', associate_id ? parseInt(associate_id) : null, project_id ? parseInt(project_id) : null, agentId, commission_agreed || '', google_map_url || '', road_width || '', fsi || '']);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: info.lastInsertRowid,
      ...req.body,
      prop_id: pId,
      price_raw: pRaw,
      zone,
      onboarded_year,
      agent_id: agentId
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.patch('/api/properties/:id/inline', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;
    
    const allowedFields = ['society', 'location', 'configuration', 'area_sqft', 'price', 'deposit', 'maintenance', 'available_from', 'interiors', 'facing', 'project_status', 'status'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid field for inline editing' });
    }
    
    // Update the database field using parametrized query
    const query = `UPDATE properties SET ${field} = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`;
    const result = await db.query(query, [value, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    const user = getRequestUser(req);
    const maskedProperty = maskProperty(result.rows[0], user);
    res.json({ success: true, property: maskedProperty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/properties/:id', async (req, res) => {
  try {
    const {
      mandate_type,
      property_type,
      society,
      location,
      status,
      site_area,
      area_sqft,
      configuration,
      floor_info,
      floor_range,
      interiors,
      facing,
      amenities,
      car_park,
      price,
      price_raw,
      possession,
      project_size,
      project_status,
      additional_info,
      video_link,
      photo_link,
      brochure_link,
      owner_name,
      owner_phone,
      owner_email,
      unit_no,
      registration_status,
      source,
      sub_source,
      comments,
      maintenance,
      deposit,
      available_from,
      date_of_inventory,
      available_for,
      plot_size,
      sba,
      special_tags,
      zone,
      onboarded_year,
      plot_dimension,
      plot_facing,
      house_facing,
      holder_type,
      admin_comments,
      associate_id,
      project_id,
      commission_agreed,
      google_map_url,
      road_width,
      fsi
    } = req.body;

    // Optional duplicate detection check ignoring self
    if (req.query.force !== 'true') {
      const existing = (await db.query("SELECT id FROM properties WHERE society = $1 AND owner_phone = $2 AND id != $3 AND deleted_at IS NULL", [society || '', owner_phone || '', req.params.id])).rows[0];
      if (existing) {
        return res.status(409).json({
          error: 'A property listing inside this society/project linked with this owner phone number already exists!',
          existingId: existing.id
        });
      }
    }

    // Clean and format price_raw if missing
    let pRaw = price_raw;
    if (!pRaw) {
      if ((available_for || '').toLowerCase().includes('rent')) {
        const rentVal = price || 0;
        pRaw = `₹${rentVal.toLocaleString()}/mo`;
      } else {
        const priceVal = price || 0;
        if (priceVal >= 10000000) {
          pRaw = `₹${(priceVal / 10000000).toFixed(2)} Cr`;
        } else if (priceVal >= 100000) {
          pRaw = `₹${(priceVal / 100000).toFixed(2)} L`;
        } else {
          pRaw = `₹${priceVal.toLocaleString()}`;
        }
      }
    }
    await (async () => {
      const r = await db.query(`
      UPDATE properties SET
        mandate_type = $1, property_type = $2, society = $3, location = $4, status = $5,
        site_area = $6, area_sqft = $7, configuration = $8, floor_info = $9, floor_range = $10,
        interiors = $11, facing = $12, amenities = $13, car_park = $14, price = $15, price_raw = $16, possession = $17,
        project_size = $18, project_status = $19, additional_info = $20, video_link = $21, photo_link = $22,
        brochure_link = $23, owner_name = $24, owner_phone = $25, owner_email = $26, unit_no = $27,
        registration_status = $28, source = $29, sub_source = $30, comments = $31,
        maintenance = $32, deposit = $33, available_from = $34, date_of_inventory = $35, available_for = $36,
        plot_size = $37, sba = $38, special_tags = $39, zone = $40, onboarded_year = $41,
        plot_dimension = $42, plot_facing = $43, house_facing = $44, holder_type = $45, admin_comments = $46, 
        associate_id = $47, project_id = $48, commission_agreed = $49, google_map_url = $50, road_width = $51, fsi = $52, last_updated = CURRENT_TIMESTAMP
      WHERE id = $53
    `, [mandate_type || 'Open', property_type || 'Resale', society, location || '', status || 'AVAILABLE', site_area || '', parseFloat(area_sqft || 0), configuration || '', floor_info || '', floor_range || '', interiors || 'Unfurnished', facing || '', amenities || '', car_park || '', parseFloat(price || 0), pRaw, possession || '', project_size || '', project_status || '', additional_info || '', video_link || '', photo_link || '', brochure_link || '', owner_name || '', owner_phone || '', owner_email || '', unit_no || '', registration_status || '', source || '', sub_source || '', comments || '', parseFloat(maintenance || 0), parseFloat(deposit || 0), available_from || '', date_of_inventory || '', available_for || 'Sale', plot_size || '', sba || '', special_tags || '', zone || 'N', onboarded_year || new Date().getFullYear().toString(), plot_dimension || '', plot_facing || '', house_facing || '', holder_type || '', admin_comments || '', associate_id ? parseInt(associate_id) : null, project_id ? parseInt(project_id) : null, commission_agreed || '', google_map_url || '', road_width || '', fsi || '', req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id,
      price_raw: pRaw,
      zone,
      onboarded_year
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.patch('/api/properties/:id/closure', async (req, res) => {
  try {
    const {
      closure_site_visit,
      closure_joint_visit,
      closure_negotiation,
      closure_agreement,
      closure_registration,
      closure_closed,
      closure_buyer_name,
      closure_buyer_phone,
      closure_deal_value,
      closure_commission_pct,
      closure_date,
      closure_notes
    } = req.body;
    
    await db.query(`
      UPDATE properties
      SET closure_site_visit = $1,
          closure_joint_visit = $2,
          closure_negotiation = $3,
          closure_agreement = $4,
          closure_registration = $5,
          closure_closed = $6,
          closure_buyer_name = $7,
          closure_buyer_phone = $8,
          closure_deal_value = $9,
          closure_commission_pct = $10,
          closure_date = $11,
          closure_notes = $12
      WHERE id = $13
    `, [
      closure_site_visit === true || closure_site_visit === 'true',
      closure_joint_visit === true || closure_joint_visit === 'true',
      closure_negotiation === true || closure_negotiation === 'true',
      closure_agreement === true || closure_agreement === 'true',
      closure_registration === true || closure_registration === 'true',
      closure_closed === true || closure_closed === 'true',
      closure_buyer_name || null,
      closure_buyer_phone || null,
      closure_deal_value ? parseFloat(closure_deal_value) : null,
      closure_commission_pct ? parseFloat(closure_commission_pct) : null,
      closure_date || null,
      closure_notes || null,
      req.params.id
    ]);

    // If deal is closed, automatically log a closed deal on property
    if (closure_closed === true || closure_closed === 'true') {
      const propResult = await db.query("SELECT society, property_type, available_for FROM properties WHERE id = $1", [req.params.id]);
      const p = propResult.rows[0];
      if (p) {
        const pType = (p.property_type || '').toLowerCase();
        const isRental = pType.includes('rental') || (p.available_for && p.available_for.toLowerCase().includes('rent')) || (p.available_for && p.available_for.toLowerCase().includes('lease'));
        const finalStatus = isRental ? 'RENTED OUT' : 'SOLD';
        
        await db.query("UPDATE properties SET status = $1 WHERE id = $2", [finalStatus, req.params.id]);
        
        // Check if commission entry already exists for this property
        const commCheck = await db.query("SELECT id FROM commissions WHERE deal_name = $1", [p.society + ' - ' + (closure_buyer_name || 'Closed Deal')]);
        if (commCheck.rows.length === 0) {
          const dealVal = closure_deal_value ? parseFloat(closure_deal_value) : 0;
          const commPct = closure_commission_pct ? parseFloat(closure_commission_pct) : 0;
          const commAmt = (dealVal * commPct) / 100;
          
          await db.query(`
            INSERT INTO commissions (deal_name, deal_value, commission_percentage, commission_amount, payment_status, booking_date, created_at)
            VALUES ($1, $2, $3, $4, 'Pending', $5, CURRENT_TIMESTAMP)
          `, [
            p.society + ' - ' + (closure_buyer_name || 'Closed Deal'),
            dealVal,
            commPct,
            commAmt,
            closure_date || new Date().toISOString().split('T')[0]
          ]);
        }
      }
    }
    
    res.json({
      success: true,
      id: req.params.id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.delete('/api/properties/:id', async (req, res) => {
  try {
    await (async () => {
      const r = await db.query("UPDATE properties SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.patch('/api/properties/:id/restore', async (req, res) => {
  try {
    await (async () => {
      const r = await db.query("UPDATE properties SET deleted_at = NULL WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Link Associate to Property
app.patch('/api/properties/:id/associate', async (req, res) => {
  try {
    const {
      associate_id
    } = req.body;
    await (async () => {
      const r = await db.query("UPDATE properties SET associate_id = $1 WHERE id = $2", [associate_id ? parseInt(associate_id) : null, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id,
      associate_id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Add/Remove Special Tag to Property
app.patch('/api/properties/:id/tag', async (req, res) => {
  try {
    const {
      tag,
      action
    } = req.body;
    const prop = (await db.query("SELECT special_tags FROM properties WHERE id = $1", [req.params.id])).rows[0];
    let tags = prop.special_tags ? prop.special_tags.split(',').map(t => t.trim()) : [];
    if (tag) {
      if (action === 'remove') {
        tags = tags.filter(t => t.toLowerCase() !== tag.trim().toLowerCase());
      } else {
        if (!tags.includes(tag.trim())) {
          tags.push(tag.trim());
        }
      }
    }
    const tagsStr = tags.filter(t => t !== '').join(', ');
    await (async () => {
      const r = await db.query("UPDATE properties SET special_tags = $1 WHERE id = $2", [tagsStr, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id,
      special_tags: tagsStr
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Bulk Delete Properties
app.post('/api/properties/bulk-delete', async (req, res) => {
  try {
    const {
      ids
    } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'No IDs provided'
      });
    }
    const placeholders = ids.map(() => '?').join(',');
    await (async () => {
      const r = await db.query(`UPDATE properties SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, [ids]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      count: ids.length
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Bulk Update Properties
app.post('/api/properties/bulk-update', async (req, res) => {
  try {
    const {
      ids,
      field,
      value
    } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'No IDs provided'
      });
    }
    let allowedFields = ['mandate_type', 'status', 'special_tags'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        error: 'Field update not allowed'
      });
    }
    const placeholders = ids.map(() => '?').join(',');
    await (async () => {
      const r = await db.query(`UPDATE properties SET ${field} = $1 WHERE id IN (${placeholders})`, [value, ...ids]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      count: ids.length
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Edit Property ID
app.post('/api/properties/edit-id', async (req, res) => {
  try {
    const {
      id,
      newId
    } = req.body;
    await (async () => {
      const r = await db.query("UPDATE properties SET prop_id = $1 WHERE id = $2", [newId, id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 6. BUILDER PROJECTS
// ----------------------------------------------------
app.get('/api/projects', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM builder_projects WHERE deleted_at IS NULL';
    const params = [];
    
    if (search) {
      query += ' AND (project_name ILIKE ? OR builder_name ILIKE ? OR location ILIKE ? OR tower ILIKE ? OR configuration ILIKE ? OR uc_rtmi ILIKE ? OR possession ILIKE ? OR location_usp ILIKE ? OR other_usp ILIKE ? OR special_tags ILIKE ? OR admin_comments ILIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s, s, s);
    }
    
    query += ' ORDER BY id DESC';
    
    const projects = (await db.query(query, params)).rows;

    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const isEmployee = user && user.role === 'Employee';

    // Mask sensitive fields if showMaskedFields is FALSE (Phase 7 RBAC Task 5) or user is Employee
    const processedProjects = await Promise.all(projects.map(async p => {
      if (!systemSettings.showMaskedFields || isEmployee) {
        return {
          ...p,
          builder_poc_details: '[]',
          // Hide contacts entirely for employees
          cp_agreements: '',
          // Hide CP agreements
          finance_info: '🔐 Private details masked (Admin locked)',
          admin_comments: '🔐 Locked Comments'
        };
      }
      return p;
    }));
    res.json(processedProjects);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/projects', async (req, res) => {
  try {
    const {
      proj_id,
      builder_name,
      project_name,
      location,
      land_parcel,
      tower,
      elevation,
      configuration,
      carpet_area,
      price_final,
      uc_rtmi,
      possession,
      subvention,
      clp_due,
      floor_rise,
      location_usp,
      metro_station,
      other_usp,
      special_tags,
      videos,
      cp_agreements,
      builder_details,
      finance_info,
      analytics_info,
      zone,
      onboarded_year,
      google_map_url,
      unit_details,
      builder_poc_details,
      admin_comments,
      brochure_link,
      floor_plans,
      mother_docs,
      assignments,
      kyc_docs,
      photos
    } = req.body;

    // Duplicate detection check (project_name + builder_name)
    if (req.query.force !== 'true') {
      const existing = (await db.query("SELECT id FROM builder_projects WHERE project_name = $1 AND builder_name = $2 AND deleted_at IS NULL", [project_name || '', builder_name || ''])).rows[0];
      if (existing) {
        return res.status(409).json({
          error: 'A project with this project name and builder name already exists!',
          existingId: existing.id
        });
      }
    }
    let pId = proj_id;
    if (!pId) {
      const z = zone || 'N';
      const y = onboarded_year || new Date().getFullYear().toString();
      const counterKey = `proj_global_${y}`;
      let row = (await db.query("SELECT last_value FROM sequence_counters WHERE category_key = $1", [counterKey])).rows[0];
      let nextVal = 151;
      if (row) {
        nextVal = row.last_value + 1;
        await (async () => {
          const r = await db.query("UPDATE sequence_counters SET last_value = $1 WHERE category_key = $2", [nextVal, counterKey]);
          return {
            lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
            changes: r.rowCount
          };
        })();
      } else {
        await (async () => {
          const r = await db.query("INSERT INTO sequence_counters (category_key, last_value) VALUES ($1, $2) RETURNING category_key", [counterKey, nextVal]);
          return {
            lastInsertRowid: null,
            changes: r.rowCount
          };
        })();
      }
      pId = `PROJ-${nextVal}/${z}-${y}`;
    }
    const info = await (async () => {
      const r = await db.query(`
      INSERT INTO builder_projects (
        proj_id, builder_name, project_name, location, land_parcel, tower,
        elevation, configuration, carpet_area, price_final, uc_rtmi,
        possession, subvention, clp_due, floor_rise, location_usp,
        metro_station, other_usp, special_tags, videos, cp_agreements,
        builder_details, finance_info, analytics_info, zone, onboarded_year,
        google_map_url, unit_details, builder_poc_details, admin_comments,
        brochure_link, floor_plans, mother_docs, assignments, kyc_docs, photos, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, CURRENT_TIMESTAMP)
     RETURNING id`, [pId, builder_name, project_name, location || '', land_parcel || '', tower || '', elevation || '', configuration || '', carpet_area || '', price_final || '', uc_rtmi || 'UC', possession || '', subvention || '', clp_due || '', floor_rise || '', location_usp || '', metro_station || '', other_usp || '', special_tags || '', videos || '', cp_agreements || '', builder_details || '', finance_info || '', analytics_info || '', zone || 'N', onboarded_year || new Date().getFullYear().toString(), google_map_url || '', unit_details || '', builder_poc_details || '', admin_comments || '', brochure_link || '', floor_plans || '', mother_docs || '', assignments || '', kyc_docs || '', photos || '']);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: info.lastInsertRowid,
      ...req.body,
      proj_id: pId
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Update Project
app.put('/api/projects/:id', async (req, res) => {
  try {
    const {
      builder_name,
      project_name,
      location,
      land_parcel,
      tower,
      elevation,
      configuration,
      carpet_area,
      price_final,
      uc_rtmi,
      possession,
      subvention,
      clp_due,
      floor_rise,
      location_usp,
      metro_station,
      other_usp,
      special_tags,
      videos,
      cp_agreements,
      builder_details,
      finance_info,
      analytics_info,
      zone,
      onboarded_year,
      google_map_url,
      unit_details,
      builder_poc_details,
      admin_comments,
      brochure_link,
      floor_plans,
      mother_docs,
      assignments,
      kyc_docs,
      photos
    } = req.body;
    await (async () => {
      const r = await db.query(`
      UPDATE builder_projects SET
        builder_name = $1, project_name = $2, location = $3, land_parcel = $4, tower = $5,
        elevation = $6, configuration = $7, carpet_area = $8, price_final = $9, uc_rtmi = $10,
        possession = $11, subvention = $12, clp_due = $13, floor_rise = $14, location_usp = $15,
        metro_station = $16, other_usp = $17, special_tags = $18, videos = $19, cp_agreements = $20,
        builder_details = $21, finance_info = $22, analytics_info = $23, zone = $24, onboarded_year = $25,
        google_map_url = $26, unit_details = $27, builder_poc_details = $28, admin_comments = $29,
        brochure_link = $30, floor_plans = $31, mother_docs = $32, assignments = $33, kyc_docs = $34, photos = $35
      WHERE id = $36
    `, [builder_name, project_name, location || '', land_parcel || '', tower || '', elevation || '', configuration || '', carpet_area || '', price_final || '', uc_rtmi || 'UC', possession || '', subvention || '', clp_due || '', floor_rise || '', location_usp || '', metro_station || '', other_usp || '', special_tags || '', videos || '', cp_agreements || '', builder_details || '', finance_info || '', analytics_info || '', zone || 'N', onboarded_year || new Date().getFullYear().toString(), google_map_url || '', unit_details || '', builder_poc_details || '', admin_comments || '', brochure_link || '', floor_plans || '', mother_docs || '', assignments || '', kyc_docs || '', photos || '', req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Add/Remove Special Tag to Project
app.patch('/api/projects/:id/tag', async (req, res) => {
  try {
    const {
      tag,
      action
    } = req.body;
    const proj = (await db.query("SELECT special_tags FROM builder_projects WHERE id = $1", [req.params.id])).rows[0];
    let tags = proj.special_tags ? proj.special_tags.split(',').map(t => t.trim()) : [];
    if (tag) {
      if (action === 'remove') {
        tags = tags.filter(t => t.toLowerCase() !== tag.trim().toLowerCase());
      } else {
        if (!tags.includes(tag.trim())) {
          tags.push(tag.trim());
        }
      }
    }
    const tagsStr = tags.filter(t => t !== '').join(', ');
    await (async () => {
      const r = await db.query("UPDATE builder_projects SET special_tags = $1 WHERE id = $2", [tagsStr, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id,
      special_tags: tagsStr
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Assign Lead to Project manually
app.patch('/api/leads/:id/assign-project', async (req, res) => {
  try {
    const { project_id } = req.body;
    await db.query("UPDATE leads SET project_id = $1 WHERE id = $2", [project_id, req.params.id]);
    res.json({
      success: true,
      id: req.params.id,
      project_id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.delete('/api/projects/:id', async (req, res) => {
  try {
    await (async () => {
      const r = await db.query("UPDATE builder_projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.patch('/api/projects/:id/restore', async (req, res) => {
  try {
    await (async () => {
      const r = await db.query("UPDATE builder_projects SET deleted_at = NULL WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Bulk Delete Projects
app.post('/api/projects/bulk-delete', async (req, res) => {
  try {
    const {
      ids
    } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'No IDs provided'
      });
    }
    const placeholders = ids.map(() => '?').join(',');
    await (async () => {
      const r = await db.query(`UPDATE builder_projects SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, [ids]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      count: ids.length
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Edit Project ID
app.post('/api/projects/edit-id', async (req, res) => {
  try {
    const {
      id,
      newId
    } = req.body;
    await (async () => {
      const r = await db.query("UPDATE builder_projects SET proj_id = $1 WHERE id = $2", [newId, id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Bulk Update Projects
app.post('/api/projects/bulk-update', async (req, res) => {
  try {
    const {
      ids,
      field,
      value
    } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'No IDs provided'
      });
    }
    let allowedFields = ['uc_rtmi', 'special_tags'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        error: 'Field update not allowed'
      });
    }
    const placeholders = ids.map(() => '?').join(',');
    await (async () => {
      const r = await db.query(`UPDATE builder_projects SET ${field} = $1 WHERE id IN (${placeholders})`, [value, ...ids]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      count: ids.length
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 7. ASSOCIATES & NETWORK BROKERS
// ----------------------------------------------------
app.get('/api/associates', async (req, res) => {
  try {
    const network = (await db.query('SELECT * FROM associates ORDER BY id DESC')).rows;
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const isEmployee = user && user.role === 'Employee';
    const allowed = getParsedAllowedPages(user);
    const hasPhoneAccess = isAdmin || allowed.includes('*') || allowed.includes('phone_access');
    const shouldMaskCommissions = !systemSettings.showMaskedFields || isEmployee;
    const processedNetwork = await Promise.all(network.map(async a => {
      const shouldMaskContact = !isAdmin && !hasPhoneAccess && a.agent_id !== user.id;
      let record = { ...a };
      if (shouldMaskContact) {
        record.phone = a.phone ? a.phone.slice(0, 4) + 'XXXXXX' + a.phone.slice(-2) : '🔐 Hidden';
        record.email = a.email ? 'e***@***.com' : '🔐 Hidden';
      }
      if (shouldMaskCommissions) {
        record.co_brokerage_share = 0;
      }
      return record;
    }));
    res.json(processedNetwork);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/associates', async (req, res) => {
  try {
    const {
      name,
      company,
      phone,
      email,
      co_brokerage_share,
      rating,
      speciality_zones,
      is_inner_circle
    } = req.body;
    const user = getRequestUser(req);
    const agentId = user ? user.id : null;
    const info = await (async () => {
      const r = await db.query(`
      INSERT INTO associates (name, company, phone, email, co_brokerage_share, rating, speciality_zones, is_inner_circle, agent_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`, [name, company || '', phone || '', email || '', co_brokerage_share || 0, rating || 5, speciality_zones || '', is_inner_circle ? 1 : 0, agentId]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: info.lastInsertRowid,
      ...req.body,
      agent_id: agentId
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.put('/api/associates/:id', async (req, res) => {
  try {
    const {
      name,
      company,
      phone,
      email,
      co_brokerage_share,
      rating,
      speciality_zones,
      is_inner_circle
    } = req.body;
    await (async () => {
      const r = await db.query(`
      UPDATE associates SET
        name = $1, company = $2, phone = $3, email = $4, co_brokerage_share = $5, rating = $6, speciality_zones = $7, is_inner_circle = $8
      WHERE id = $9
    `, [name, company || '', phone || '', email || '', co_brokerage_share || 0, rating || 5, speciality_zones || '', is_inner_circle ? 1 : 0, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.delete('/api/associates/:id', async (req, res) => {
  try {
    const assocId = req.params.id;
    await (async () => {
      const r = await db.query("DELETE FROM associates WHERE id = $1", [assocId]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    await (async () => {
      const r = await db.query("UPDATE properties SET associate_id = NULL WHERE associate_id = $1", [assocId]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    await (async () => {
      const r = await db.query("UPDATE leads SET associate_id = NULL WHERE associate_id = $1", [assocId]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: 'Associate successfully deleted.'
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/associates/:id/upload-inventory', express.text({
  type: '*/*'
}), async (req, res) => {
  try {
    const assocId = req.params.id;
    const user = getRequestUser(req);
    const agentId = user ? user.id : null;
    const csvLines = req.body.split('\n').filter(line => line.trim().length > 0);
    if (csvLines.length < 2) return res.status(400).json({
      error: 'CSV empty or no data rows'
    });
    const headers = csvLines[0].split(',').map(h => h.trim().toLowerCase());
    let addedCount = 0;
    const insertStmt = { run: async (...args) => {
        // If it's an INSERT, append RETURNING id
        let q = `
      INSERT INTO properties (
        prop_id, society, location, configuration, carpet_area, price, price_raw,
        associate_id, source, agent_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
        if (q.trim().toUpperCase().startsWith('INSERT') && !q.includes('RETURNING')) {
            q += ' RETURNING id';
        }
        const r = await db.query(q, args);
        return { lastInsertRowid: r.rows[0] ? r.rows[0].id : null, changes: r.rowCount };
   }};

    for (let i = 1; i < csvLines.length; i++) {
      // Basic CSV split ignoring commas inside quotes
      const values = csvLines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!values) continue;
      const cleanVals = values.map(v => v.replace(/^"|"$/g, '').trim());
      const getValue = keys => {
        for (let key of keys) {
          const idx = headers.findIndex(h => h.includes(key));
          if (idx !== -1 && cleanVals[idx]) return cleanVals[idx];
        }
        return '';
      };
      const society = getValue(['society', 'project', 'building']);
      if (!society) continue;
      const location = getValue(['location', 'area', 'micro']);
      const configuration = getValue(['config', 'bhk', 'type']);
      const area = getValue(['area', 'sqft', 'size']);
      const priceRaw = getValue(['price', 'cost', 'value']);

      // Generate random unique prop ID just for associate inventory
      const propId = 'ASSOC-' + assocId + '-' + Date.now().toString().slice(-6) + '-' + i;
      insertStmt.run(propId, society, location, configuration, area, parseFloat(priceRaw) || 0, priceRaw, assocId, 'Associate Network', agentId);
      addedCount++;
    }
    res.json({
      success: true,
      addedCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

// GET Associate Performance Metrics Summary
app.get('/api/associates/performance', async (req, res) => {
  try {
    const q = `
      SELECT 
        a.id,
        a.name,
        a.company,
        a.rating,
        a.co_brokerage_share,
        a.is_inner_circle,
        (SELECT COUNT(*) FROM properties WHERE associate_id = a.id AND deleted_at IS NULL) AS total_listings,
        (SELECT COUNT(*) FROM properties WHERE associate_id = a.id AND status = 'SOLD' AND deleted_at IS NULL) AS converted_deals,
        (SELECT COUNT(*) FROM associate_shares WHERE associate_id = a.id) AS shared_listings,
        (SELECT COUNT(*) FROM leads WHERE associate_id = a.id AND closure_joint_visit = true) AS joint_site_visits,
        (SELECT COALESCE(SUM(co_broker_payout), 0) FROM commissions c WHERE c.associate_id = a.id) AS total_payout
      FROM associates a
      ORDER BY total_listings DESC, total_payout DESC
    `;
    const result = await db.query(q);
    const user = getRequestUser(req);
    const isEmployee = user && user.role === 'Employee';
    const shouldMask = !systemSettings.showMaskedFields || isEmployee;
    const processed = result.rows.map(a => {
      if (shouldMask) {
        return {
          ...a,
          co_brokerage_share: 0,
          total_payout: 0
        };
      }
      return a;
    });
    res.json(processed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Sourced/Shared properties with Associate
app.get('/api/associates/:id/shares', async (req, res) => {
  try {
    const assocId = req.params.id;
    const q = `
      SELECT s.id AS share_id, s.shared_at, s.shared_by, p.* 
      FROM associate_shares s
      JOIN properties p ON s.property_id = p.id
      WHERE s.associate_id = $1 AND p.deleted_at IS NULL
      ORDER BY s.id DESC
    `;
    const result = await db.query(q, [parseInt(assocId)]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Share property with Associate
app.post('/api/associates/:id/shares', async (req, res) => {
  try {
    const assocId = req.params.id;
    const { property_id } = req.body;
    const user = getRequestUser(req);
    const sharedBy = user ? user.name : 'System';

    const q = `
      INSERT INTO associate_shares (associate_id, property_id, shared_by)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const result = await db.query(q, [parseInt(assocId), parseInt(property_id), sharedBy]);
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Property Activity Log (Shares & Site Visits)
app.get('/api/properties/:id/activity-log', async (req, res) => {
  try {
    const propId = parseInt(req.params.id);
    
    // 1. Get the property's alphanumeric prop_id code
    const propMeta = await db.query('SELECT prop_id, closure_site_visit, closure_joint_visit, closure_buyer_name, closure_buyer_phone, closure_date, closure_notes, associate_id, (SELECT name FROM associates WHERE id = properties.associate_id) AS associate_name FROM properties WHERE id = $1', [propId]);
    if (propMeta.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const prop = propMeta.rows[0];
    const alphanumericId = prop.prop_id;

    // 2. Fetch Shares history
    const sharesQuery = `
      SELECT s.id AS share_id, s.shared_at, s.shared_by, a.name AS associate_name, a.company AS associate_company
      FROM associate_shares s
      JOIN associates a ON s.associate_id = a.id
      WHERE s.property_id = $1
      ORDER BY s.id DESC
    `;
    const sharesResult = await db.query(sharesQuery, [propId]);

    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const isEmployee = user && user.role === 'Employee';
    const shouldMask = !systemSettings.showMaskedFields || isEmployee;

    // 3. Fetch Site Visits history
    // A: Visits logged directly on property closure journey
    const visits = [];
    if (prop.closure_site_visit || prop.closure_joint_visit) {
      let visPhone = prop.closure_buyer_phone || '';
      if (shouldMask && visPhone) {
        visPhone = visPhone.slice(0, 4) + 'XXXXXX' + visPhone.slice(-2);
      }
      visits.push({
        visitor_name: prop.closure_buyer_name || 'Direct Closure Lead',
        visitor_phone: visPhone,
        is_joint: prop.closure_joint_visit,
        associate_name: prop.associate_name || null,
        visit_date: prop.closure_date || 'N/A',
        notes: prop.closure_notes || 'Logged during property closure journey',
        source: 'Property Deal Status'
      });
    }

    // B: Visits logged on leads matching either integer ID or alphanumeric prop_id
    const leadsQuery = `
      SELECT 
        l.id AS lead_id, 
        l.name AS client_name, 
        l.phone AS client_phone, 
        l.closure_site_visit, 
        l.closure_joint_visit, 
        l.closure_notes, 
        l.next_followup,
        l.associate_id,
        a.name AS associate_name
      FROM leads l
      LEFT JOIN associates a ON l.associate_id = a.id
      WHERE (l.closure_prop_id = $1 OR (l.closure_prop_id IS NOT NULL AND l.closure_prop_id = $2))
        AND (l.closure_site_visit = true OR l.closure_joint_visit = true)
      ORDER BY l.id DESC
    `;
    const leadsResult = await db.query(leadsQuery, [propId.toString(), alphanumericId]);
    
    leadsResult.rows.forEach(row => {
      let cPhone = row.client_phone || '';
      if (shouldMask && cPhone) {
        cPhone = cPhone.slice(0, 4) + 'XXXXXX' + cPhone.slice(-2);
      }
      visits.push({
        visitor_name: row.client_name,
        visitor_phone: cPhone,
        is_joint: row.closure_joint_visit,
        associate_name: row.associate_name || null,
        visit_date: row.next_followup || 'N/A',
        notes: row.closure_notes || 'Logged via lead pipeline stage progress',
        source: `Lead Pipeline (ID: ${row.lead_id})`
      });
    });

    res.json({
      shares: sharesResult.rows,
      visits: visits
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 8. COMMISSIONS FINANCE LEDGER
// ----------------------------------------------------
app.get('/api/commissions', async (req, res) => {
  try {
    const reg = (await db.query('SELECT * FROM commissions ORDER BY id DESC')).rows;
    const user = getRequestUser(req);
    const processed = reg.map(c => maskCommission(c, user));
    res.json(processed);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/commissions', async (req, res) => {
  try {
    const {
      deal_name,
      deal_value,
      commission_percentage,
      commission_amount,
      co_broker_payout,
      billing_invoice,
      expenses,
      payment_status,
      booking_date,
      agreement_date,
      registration_date,
      handover_date,
      associate_id,
      lead_id,
      property_id
    } = req.body;
    const info = await (async () => {
      const r = await db.query(`
      INSERT INTO commissions (deal_name, deal_value, commission_percentage, commission_amount, co_broker_payout, billing_invoice, expenses, payment_status, booking_date, agreement_date, registration_date, handover_date, associate_id, lead_id, property_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`, [deal_name, deal_value || 0, commission_percentage || 0, commission_amount || 0, co_broker_payout || 0, billing_invoice || '', expenses || 0, payment_status || 'Pending', booking_date || '', agreement_date || '', registration_date || '', handover_date || '', associate_id ? parseInt(associate_id) : null, lead_id ? parseInt(lead_id) : null, property_id ? parseInt(property_id) : null]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: info.lastInsertRowid,
      ...req.body
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.put('/api/commissions/:id', async (req, res) => {
  try {
    const {
      deal_name,
      deal_value,
      commission_percentage,
      commission_amount,
      co_broker_payout,
      billing_invoice,
      expenses,
      payment_status,
      booking_date,
      agreement_date,
      registration_date,
      handover_date,
      associate_id,
      lead_id,
      property_id
    } = req.body;
    await (async () => {
      const r = await db.query(`
      UPDATE commissions
      SET deal_name = $1, deal_value = $2, commission_percentage = $3, commission_amount = $4, co_broker_payout = $5, billing_invoice = $6, expenses = $7, payment_status = $8, booking_date = $9, agreement_date = $10, registration_date = $11, handover_date = $12, associate_id = $13, lead_id = $14, property_id = $15
      WHERE id = $16
    `, [deal_name, deal_value, commission_percentage, commission_amount || 0, co_broker_payout, billing_invoice, expenses, payment_status, booking_date, agreement_date, registration_date, handover_date, associate_id ? parseInt(associate_id) : null, lead_id ? parseInt(lead_id) : null, property_id ? parseInt(property_id) : null, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: req.params.id,
      ...req.body
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.delete('/api/commissions/:id', async (req, res) => {
  try {
    await (async () => {
      const r = await db.query("DELETE FROM commissions WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 9. HABITS KPI TRACKING SYSTEM
// ----------------------------------------------------
app.get('/api/habits', async (req, res) => {
  try {
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';

    // Check if bulk admin query is requested
    if (isAdmin && req.query.all === 'true') {
      const allHabits = (await db.query("SELECT * FROM habits")).rows;
      return res.json(allHabits);
    }
    let targetAgentId = user ? user.id : null;
    if (isAdmin && req.query.agent_id) {
      targetAgentId = parseInt(req.query.agent_id);
    }
    if (!targetAgentId) {
      return res.json([]);
    }
    const habits = (await db.query("SELECT * FROM habits WHERE agent_id = $1", [targetAgentId])).rows;
    res.json(habits);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/habits/toggle', async (req, res) => {
  try {
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const {
      habit_name,
      habit_date,
      is_done,
      agent_id
    } = req.body;
    let targetAgentId = user ? user.id : null;
    if (isAdmin && agent_id) {
      targetAgentId = parseInt(agent_id);
    }
    if (!targetAgentId) {
      return res.status(400).json({
        error: "Missing active agent ID"
      });
    }

    // Check if habit log already exists for this date and agent
    const existing = (await db.query("SELECT id FROM habits WHERE agent_id = $1 AND habit_date = $2", [targetAgentId, habit_date])).rows[0];
    if (existing) {
      await (async () => {
        const r = await db.query("UPDATE habits SET is_done = $1 WHERE id = $2", [is_done, existing.id]);
        return {
          lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
          changes: r.rowCount
        };
      })();
    } else {
      await (async () => {
        const r = await db.query("INSERT INTO habits (habit_name, habit_date, is_done, agent_id) VALUES ($1, $2, $3, $4) RETURNING id", [habit_name || 'Daily OS Completed', habit_date, is_done, targetAgentId]);
        return {
          lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
          changes: r.rowCount
        };
      })();
    }
    res.json({
      success: true,
      message: "Habit log saved successfully."
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 10. FILE UPLOADS
// ----------------------------------------------------
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }
    const relativePath = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      filePath: relativePath
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 11. ADVANCED AUTOMATION & TRIGGERS (PHASE 6)
// ----------------------------------------------------

// Retrieve all Sales Agents
app.get('/api/agents', async (req, res) => {
  try {
    const agents = (await db.query("SELECT * FROM agents ORDER BY id ASC")).rows;
    res.json(agents);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Retrieve Agent names & IDs only (Public list for Lock Screen profiles)
app.get('/api/team/profiles', async (req, res) => {
  try {
    const list = (await db.query("SELECT id, name, role FROM agents WHERE status = 'ACTIVE' ORDER BY id ASC")).rows;
    res.json(list);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// PIN Verification & Authenticated Login route
app.post('/api/team/login', async (req, res) => {
  try {
    const {
      agent_id,
      pin
    } = req.body;
    if (!agent_id || !pin) {
      return res.status(400).json({
        error: "Agent selection and PIN are required."
      });
    }
    const agent = (await db.query("SELECT * FROM agents WHERE id = $1", [agent_id])).rows[0];
    if (!agent) {
      return res.status(404).json({
        error: "Profile not found."
      });
    }
    if (agent.login_pin !== String(pin)) {
      return res.status(401).json({
        error: "Invalid 4-digit PIN code."
      });
    }
    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        allowed_pages: agent.allowed_pages
      }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Create new Sales Agent (with permissions credentials)
app.post('/api/agents', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      status,
      location_specialty,
      role,
      login_pin,
      allowed_pages
    } = req.body;
    if (!name) return res.status(400).json({
      error: "Agent Name is required."
    });
    const info = await (async () => {
      const r = await db.query(`
      INSERT INTO agents (name, email, phone, status, location_specialty, role, login_pin, allowed_pages, leads_assigned)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
     RETURNING id`, [name, email || '', phone || '', status || 'ACTIVE', location_specialty || 'All Zones', role || 'Agent', login_pin || '0000', allowed_pages || '[]']);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: info.lastInsertRowid,
      name,
      email,
      phone,
      status,
      location_specialty,
      role: role || 'Agent',
      login_pin: login_pin || '0000',
      allowed_pages: allowed_pages || '[]',
      leads_assigned: 0
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Update Sales Agent
app.put('/api/agents/:id', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      name,
      email,
      phone,
      status,
      location_specialty,
      role,
      login_pin,
      allowed_pages
    } = req.body;
    await (async () => {
      const r = await db.query(`
      UPDATE agents
      SET name = $1, email = $2, phone = $3, status = $4, location_specialty = $5, role = $6, login_pin = $7, allowed_pages = $8
      WHERE id = $9
    `, [name, email || '', phone || '', status || 'ACTIVE', location_specialty || 'All Zones', role || 'Agent', login_pin || '0000', allowed_pages || '[]', id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id,
      name,
      email,
      phone,
      status,
      location_specialty,
      role,
      login_pin,
      allowed_pages
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Delete Sales Agent
app.delete('/api/agents/:id', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    await (async () => {
      const r = await db.query("DELETE FROM agents WHERE id = $1", [id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Retrieve Active Assignment Settings Rule
app.get('/api/assignment/settings', async (req, res) => {
  try {
    const setting = (await db.query("SELECT * FROM auto_assignment_settings ORDER BY id DESC LIMIT 1")).rows[0];
    res.json(setting || {
      rule_type: 'ROUND_ROBIN',
      is_active: 1
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Update Assignment Settings Rule
app.post('/api/assignment/settings', async (req, res) => {
  try {
    const {
      rule_type
    } = req.body;
    if (!['ROUND_ROBIN', 'LOCATION_BASED', 'MANUAL'].includes(rule_type)) {
      return res.status(400).json({
        error: "Invalid assignment rule type."
      });
    }
    await (async () => {
      const r = await db.query("DELETE FROM auto_assignment_settings");
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    await (async () => {
      const r = await db.query("INSERT INTO auto_assignment_settings (rule_type, is_active) VALUES ($1, 1) RETURNING id", [rule_type]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      rule_type
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Retrieve Marketing Drip Campaigns Sequence Templates
app.get('/api/drip/campaigns', async (req, res) => {
  try {
    const campaigns = (await db.query("SELECT * FROM drip_campaigns ORDER BY id ASC")).rows;
    const formatted = await Promise.all(campaigns.map(async c => {
      try {
        c.sequence_data = JSON.parse(c.sequence_data);
      } catch (e) {
        c.sequence_data = [];
      }
      return c;
    }));
    res.json(formatted);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Toggle Drip Campaign Sequence Active Status
app.patch('/api/drip/campaigns/:id/toggle', async (req, res) => {
  try {
    const campaign = (await db.query("SELECT is_active FROM drip_campaigns WHERE id = $1", [req.params.id])).rows[0];
    if (!campaign) return res.status(404).json({
      error: "Campaign not found"
    });
    const nextActive = campaign.is_active ? 0 : 1;
    await (async () => {
      const r = await db.query("UPDATE drip_campaigns SET is_active = $1 WHERE id = $2", [nextActive, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      id: req.params.id,
      is_active: nextActive
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Retrieve Marketing Drip Logs history
app.get('/api/drip/logs', async (req, res) => {
  try {
    const logs = (await db.query("SELECT * FROM drip_logs ORDER BY id DESC")).rows;
    res.json(logs);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Perform manual drip sweep & trigger simulated drip sequence steps
app.post('/api/drip/trigger-check', async (req, res) => {
  try {
    const campaigns = (await db.query("SELECT * FROM drip_campaigns WHERE is_active = 1")).rows;
    const processed = [];
    for (const camp of campaigns) {
      let sequence = [];
      try {
        sequence = JSON.parse(camp.sequence_data);
      } catch (e) {
        continue;
      }

      // Select leads matching trigger status
      const leads = (await db.query("SELECT * FROM leads WHERE status = $1", [camp.target_leads_status])).rows;
      for (const lead of leads) {
        // Query last sent drip step
        const lastLog = (await db.query("SELECT step_index FROM drip_logs WHERE lead_id = $1 AND campaign_id = $2 ORDER BY step_index DESC LIMIT 1", [lead.id, camp.id])).rows[0];
        let nextIndex = 0;
        if (lastLog) {
          nextIndex = lastLog.step_index + 1;
        }
        if (nextIndex < sequence.length) {
          const step = sequence[nextIndex];
          const rawMsg = step.message || '';
          const message = rawMsg.replace(/{name}/g, lead.name);

          // Save sent log
          await (async () => {
            const r = await db.query(`
            INSERT INTO drip_logs (lead_id, lead_name, campaign_id, campaign_name, step_index, message, scheduled_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'SENT')
           RETURNING id`, [lead.id, lead.name, camp.id, camp.name, nextIndex, message, `Day ${step.day}`]);
            return {
              lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
              changes: r.rowCount
            };
          })();
          processed.push({
            lead_name: lead.name,
            campaign_name: camp.name,
            step: `Day ${step.day}`,
            message
          });
        }
      }
    }
    res.json({
      success: true,
      processed,
      count: processed.length
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Portal Webhook Intake Gateway (MagicBricks / 99acres / Facebook Ads Leads)
app.post('/api/webhooks/mock-lead', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      source,
      notes,
      location
    } = req.body;
    if (!name) return res.status(400).json({
      error: "Name is a required field."
    });

    // Routing lead through assignment engine
    const assignment = await assignLeadToAgent(notes || '', location || '');
    const pNum = phone || '+91 99000 ' + Math.floor(10000 + Math.random() * 90000);
    const eMail = email || name.toLowerCase().replace(/\s+/g, '') + '@portal-intake.com';
    const info = await (async () => {
      const r = await db.query(`
      INSERT INTO leads (name, phone, email, source, status, stage, project_type, budget_min, budget_max, notes, next_followup, followup_status, touchpoint, agent_id, agent_name)
      VALUES ($1, $2, $3, $4, 'Warm', 'New', 'Residential - Primary', 8500000, 15000000, $5, '', 'None', 'Calls', $6, $7)
     RETURNING id`, [name, pNum, eMail, source || '99acres Webhook Intake', notes || 'Simulated webhook intake lead matching Whitefield preferences.', assignment.id, assignment.name]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      lead_id: info.lastInsertRowid,
      name,
      assigned_to: assignment.name,
      message: `Webhook lead successfully captured and auto-assigned to ${assignment.name}!`
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 12. PORTAL SYNC & CLOUD TELEPHONY (PHASE 7)
// ----------------------------------------------------

// Bulk Sync Listings Outbound to Portals
app.post('/api/properties/sync-portal', async (req, res) => {
  try {
    const {
      ids,
      portals
    } = req.body;
    if (!ids || !portals || ids.length === 0 || portals.length === 0) {
      return res.status(400).json({
        error: "Missing required fields property ids or portals."
      });
    }
    const portalStr = portals.join(', ');
    const syncStatusText = `SYNCED: ${portalStr}`;
    const updateSync = { run: async (...args) => {
        // If it's an INSERT, append RETURNING id
        let q = "UPDATE properties SET sync_status = ? WHERE id = ?";
        if (q.trim().toUpperCase().startsWith('INSERT') && !q.includes('RETURNING')) {
            q += ' RETURNING id';
        }
        const r = await db.query(q, args);
        return { lastInsertRowid: r.rows[0] ? r.rows[0].id : null, changes: r.rowCount };
   }};

    ids.forEach(id => {
      updateSync.run(syncStatusText, id);
    });
    res.json({
      success: true,
      count: ids.length,
      portals,
      sync_status: syncStatusText,
      message: `Successfully synchronized ${ids.length} properties outbound to ${portalStr} portals!`
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Log click-to-call telephony outcome and save call details
app.post('/api/telephony/call', async (req, res) => {
  try {
    const {
      lead_id,
      agent_id,
      duration,
      call_notes
    } = req.body;
    if (!lead_id) return res.status(400).json({
      error: "Missing lead_id."
    });

    // Fetch lead and agent details
    const lead = (await db.query("SELECT name, notes FROM leads WHERE id = $1", [lead_id])).rows[0];
    if (!lead) return res.status(404).json({
      error: "Lead not found."
    });
    let agentName = 'Vasu Jain';
    let agentId = agent_id || 1;
    const agent = (await db.query("SELECT name FROM agents WHERE id = $1", [agentId])).rows[0];
    if (agent) {
      agentName = agent.name;
    }
    const recordingUrl = `/uploads/recordings/call_${Math.floor(100 + Math.random() * 900)}.mp3`;
    const notesContent = call_notes || 'Call placed successfully. Client answered.';

    // Insert into telephony calls registry
    await (async () => {
      const r = await db.query(`
      INSERT INTO telephony_calls (lead_id, lead_name, agent_id, agent_name, duration, recording_url, call_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`, [lead_id, lead.name, agentId, agentName, duration || 0, recordingUrl, notesContent]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();

    // Prepend call note directly inside Lead Notes history!
    const todayStr = new Date().toLocaleString();
    const formattedLog = `[📞 Telephony Log - ${todayStr} - Agent ${agentName} (${duration || 0}s)]\nMemo: ${notesContent}\n-----------------------\n` + (lead.notes || '');
    await (async () => {
      const r = await db.query("UPDATE leads SET notes = $1 WHERE id = $2", [formattedLog, lead_id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      lead_name: lead.name,
      agent_name: agentName,
      duration,
      message: "Exotel simulated telephony call logged successfully and appended to Lead notes!"
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Retrieve call history records
app.get('/api/telephony/calls', async (req, res) => {
  try {
    const calls = (await db.query("SELECT * FROM telephony_calls ORDER BY id DESC")).rows;
    res.json(calls);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// 13. CLIENT PORTAL & INTERACTIVE PROPOSALS (PHASE 8)
// ----------------------------------------------------

// Serve public static files for proposals and client portal routing
app.get('/proposal/:token', async (req, res) => {
  res.sendFile(path.join(__dirname, '../public/proposal.html'));
});
app.get('/client-portal', async (req, res) => {
  res.sendFile(path.join(__dirname, '../public/client-portal.html'));
});

// Admin API: Create a new proposal
app.post('/api/proposals', async (req, res) => {
  try {
    const {
      lead_id,
      title,
      intro_message,
      property_ids,
      agent_comments
    } = req.body;
    if (!lead_id || !property_ids || property_ids.length === 0) {
      return res.status(400).json({
        error: "Missing lead_id or property_ids."
      });
    }
    const crypto = require('crypto');
    const token = crypto.randomBytes(16).toString('hex');
    const result = await (async () => {
      const r = await db.query(`
      INSERT INTO proposals (token, lead_id, title, intro_message)
      VALUES ($1, $2, $3, $4)
     RETURNING id`, [token, lead_id, title || 'Curated Property Portfolio', intro_message || '']);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    const proposalId = result.lastInsertRowid;
    const insertItem = { run: async (...args) => {
        // If it's an INSERT, append RETURNING id
        let q = `
      INSERT INTO proposal_items (proposal_id, property_id, agent_comments)
      VALUES (?, ?, ?)
    `;
        if (q.trim().toUpperCase().startsWith('INSERT') && !q.includes('RETURNING')) {
            q += ' RETURNING id';
        }
        const r = await db.query(q, args);
        return { lastInsertRowid: r.rows[0] ? r.rows[0].id : null, changes: r.rowCount };
   }};

    for (const propId of property_ids) {
      const comment = agent_comments && agent_comments[propId] || '';
      await insertItem.run(proposalId, propId, comment);
    }

    // Also insert a log inside lead interaction log
    const lead = (await db.query("SELECT name, notes FROM leads WHERE id = $1", [lead_id])).rows[0];
    if (lead) {
      const todayStr = new Date().toLocaleString();
      const updatedNotes = `[📢 Proposal Sent - ${todayStr}]\nCurated a portfolio of ${property_ids.length} properties. Access Token: ${token}\n-----------------------\n` + (lead.notes || '');
      await (async () => {
        const r = await db.query("UPDATE leads SET notes = $1 WHERE id = $2", [updatedNotes, lead_id]);
        return {
          lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
          changes: r.rowCount
        };
      })();
    }
    res.json({
      success: true,
      token,
      proposal_id: proposalId,
      url: `/proposal/${token}`,
      message: "Interactive proposal created successfully!"
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Admin API: Fetch all proposals
app.get('/api/proposals', async (req, res) => {
  try {
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const allowed = getParsedAllowedPages(user);
    const hasPhoneAccess = isAdmin || allowed.includes('*') || allowed.includes('phone_access');
    let query = `
      SELECT p.*, l.name as lead_name, l.phone as lead_phone, l.agent_id as lead_agent_id
      FROM proposals p 
      JOIN leads l ON p.lead_id = l.id
    `;
    const params = [];
    if (!isAdmin) {
      query += ' WHERE l.agent_id = ?';
      params.push(user.id);
    }
    query += ' ORDER BY p.id DESC';
    const proposals = (await db.query(query, [params])).rows;

    // For each proposal, fetch items
    const proposalsWithItems = await Promise.all(proposals.map(async prop => {
      const items = (await db.query(`
        SELECT pi.agent_comments, pr.society, pr.location, pr.price_raw 
        FROM proposal_items pi
        JOIN properties pr ON pi.property_id = pr.id
        WHERE pi.proposal_id = $1
      `, [prop.id])).rows;
      const shouldMaskContact = !isAdmin && !hasPhoneAccess && prop.lead_agent_id !== user.id;
      return {
        ...prop,
        lead_phone: shouldMaskContact ? prop.lead_phone ? prop.lead_phone.slice(0, 4) + 'XXXXXX' + prop.lead_phone.slice(-2) : '🔐 Hidden' : prop.lead_phone,
        items
      };
    }));
    res.json(proposalsWithItems);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Admin API: Reply to client messages
app.post('/api/proposals/message', async (req, res) => {
  try {
    const {
      lead_id,
      message
    } = req.body;
    if (!lead_id || !message) {
      return res.status(400).json({
        error: "Missing lead_id or message."
      });
    }
    await (async () => {
      const r = await db.query(`
      INSERT INTO client_messages (lead_id, sender, message)
      VALUES ($1, 'agent', $2)
     RETURNING id`, [lead_id, message]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: "Reply posted successfully."
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Public API: Fetch a proposal details by token (Stripped of direct owner details)
app.get('/api/public/proposals/:token', async (req, res) => {
  try {
    const {
      token
    } = req.params;
    const proposal = (await db.query(`
      SELECT p.*, l.name as lead_name, l.phone as lead_phone, l.agent_name 
      FROM proposals p 
      JOIN leads l ON p.lead_id = l.id 
      WHERE p.token = $1
    `, [token])).rows[0];
    if (!proposal) {
      return res.status(404).json({
        error: "Proposal not found or has expired."
      });
    }

    // Fetch matched properties
    const properties = (await db.query(`
      SELECT pi.agent_comments, pr.* 
      FROM proposal_items pi
      JOIN properties pr ON pi.property_id = pr.id
      WHERE pi.proposal_id = $1
    `, [proposal.id])).rows;

    // Secure field masking: strip owner coordinates and direct details
    const sanitizedProperties = properties.map(pr => ({
      id: pr.id,
      prop_id: pr.prop_id,
      mandate_type: pr.mandate_type,
      property_type: pr.property_type,
      society: pr.society,
      location: pr.location,
      site_area: pr.site_area,
      area_sqft: pr.area_sqft,
      configuration: pr.configuration,
      floor_info: pr.floor_info,
      floor_range: pr.floor_range,
      interiors: pr.interiors,
      facing: pr.facing,
      amenities: pr.amenities,
      car_park: pr.car_park,
      price: pr.price,
      price_raw: pr.price_raw,
      possession: pr.possession,
      project_size: pr.project_size,
      project_status: pr.project_status,
      additional_info: pr.additional_info,
      video_link: pr.video_link,
      photo_link: pr.photo_link,
      brochure_link: pr.brochure_link,
      registration_status: pr.registration_status,
      special_tags: pr.special_tags,
      agent_comments: pr.agent_comments
    }));
    res.json({
      proposal,
      properties: sanitizedProperties,
      settings: systemSettings
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Public API: Lead responds to proposals (expressed interest / site visit requests)
app.post('/api/public/proposals/:token/respond', async (req, res) => {
  try {
    const {
      token
    } = req.params;
    const {
      response_type,
      property_id
    } = req.body;
    if (!response_type) return res.status(400).json({
      error: "Missing response_type."
    });
    const proposal = (await db.query(`
      SELECT p.*, l.name as lead_name, l.notes 
      FROM proposals p
      JOIN leads l ON p.lead_id = l.id
      WHERE p.token = $1
    `, [token])).rows[0];
    if (!proposal) return res.status(404).json({
      error: "Proposal not found."
    });
    let propertyName = 'Bespoke Shortlist Portfolio';
    if (property_id) {
      const prop = (await db.query("SELECT society FROM properties WHERE id = $1", [property_id])).rows[0];
      if (prop) propertyName = prop.society;
    }
    const todayStr = new Date().toLocaleString();
    const formattedNotes = `[📢 Proposal Response - ${todayStr}]\nClient responded with: ${response_type.toUpperCase()} on property: ${propertyName}\n-----------------------\n` + (proposal.notes || '');
    await (async () => {
      const r = await db.query("UPDATE leads SET notes = $1 WHERE id = $2", [formattedNotes, proposal.lead_id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();

    // Create a Priority Action Item on dashboard to alert agent
    await (async () => {
      const r = await db.query(`
      INSERT INTO todo_tasks (task, status, due_date)
      VALUES ($1, 'Priority', $2)
     RETURNING id`, [`🔔 PROPOSAL ALERT: ${proposal.lead_name} requested ${response_type.toUpperCase()} on ${propertyName}!`, new Date().toISOString().split('T')[0]]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: `Successfully logged client response: ${response_type}!`
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Duplicates Audit API: Get log
app.get('/api/duplicate-leads-audit', async (req, res) => {
  try {
    const logs = (await db.query("SELECT * FROM duplicate_leads_audit ORDER BY id DESC")).rows;
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicates Audit API: Resolve Log
app.post('/api/duplicate-leads-audit/resolve/:id', async (req, res) => {
  try {
    const { action } = req.body;
    const auditId = req.params.id;
    const log = (await db.query("SELECT * FROM duplicate_leads_audit WHERE id = $1", [auditId])).rows[0];
    if (!log) {
      return res.status(404).json({ error: "Audit log not found." });
    }

    if (action === 'dismiss') {
      await db.query("UPDATE duplicate_leads_audit SET action_taken = 'Resolved (Dismissed)' WHERE id = $1", [auditId]);
      return res.json({ success: true, message: "Duplicate record dismissed successfully." });
    }

    if (action === 'dismiss-delete') {
      await db.query("DELETE FROM duplicate_leads_audit WHERE id = $1", [auditId]);
      return res.json({ success: true, message: "Duplicate audit record deleted." });
    }

    if (action === 'merge') {
      // Append notes to the existing lead
      const existing = (await db.query("SELECT notes FROM leads WHERE id = $1", [log.existing_lead_id])).rows[0];
      if (existing) {
        const todayStr = new Date().toLocaleString();
        const mergedNotes = `[🔗 Duplicate Merged - ${todayStr}]\n- Name: ${log.lead_name}\n- Source: ${log.source}\n- Email: ${log.email}\n-----------------------\n` + (existing.notes || '');
        await db.query("UPDATE leads SET notes = $1 WHERE id = $2", [mergedNotes, log.existing_lead_id]);
      }
      await db.query("UPDATE duplicate_leads_audit SET action_taken = 'Resolved (Merged)' WHERE id = $1", [auditId]);
      return res.json({ success: true, message: "Notes merged into existing lead successfully." });
    }

    if (action === 'allow') {
      // Auto assign
      const assignment = await assignLeadToAgent('', '');
      const r = await db.query(`
        INSERT INTO leads (name, phone, email, source, status, stage, project_type, budget_min, budget_max, notes, next_followup, followup_status, touchpoint, location_preference, config_bhk, timeline_preference, special_tags, documents, agent_id, agent_name, rental_expiry_date)
        VALUES ($1, $2, $3, $4, 'Warm', 'New', 'Residential', 0, 0, 'Import duplicate allowed override.', '', 'None', 'Calls', '', '', '', 'Imported', '[]', $5, $6, '')
        RETURNING id
      `, [log.lead_name, log.phone, log.email, log.source, assignment.id, assignment.name]);
      
      const leadId = r.rows[0].id;
      const customLeadId = `IMP-${1000 + leadId}`;
      await db.query(`UPDATE leads SET custom_lead_id = $1 WHERE id = $2`, [customLeadId, leadId]);
      
      await db.query("UPDATE duplicate_leads_audit SET action_taken = 'Resolved (Allowed)' WHERE id = $1", [auditId]);
      return res.json({ success: true, message: "Lead imported successfully with ID: " + customLeadId });
    }

    res.status(400).json({ error: "Invalid action." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client Portal API: Mobile Login
app.post('/api/client/login', async (req, res) => {
  try {
    const {
      phone
    } = req.body;
    if (!phone) return res.status(400).json({
      error: "Missing phone number."
    });

    // Lookup phone number in leads database
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const leads = (await db.query("SELECT * FROM leads")).rows;
    const lead = leads.find(l => {
      const lPhone = (l.phone || '').replace(/[^0-9]/g, '');
      return lPhone && (lPhone.includes(cleanPhone) || cleanPhone.includes(lPhone));
    });
    if (!lead) {
      return res.status(401).json({
        error: "Authentication failed. Phone number not registered as an active lead."
      });
    }

    // Set Session
    req.session.clientLeadId = lead.id;
    res.json({
      success: true,
      message: "Client authenticated successfully!",
      lead: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        stage: lead.stage
      }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Client Portal API: Fetch Client Dashboard (Secure)
app.get('/api/client/dashboard', async (req, res) => {
  try {
    const leadId = req.session.clientLeadId;
    if (!leadId) return res.status(401).json({
      error: "Unauthorized portal access. Please login."
    });
    const lead = (await db.query("SELECT * FROM leads WHERE id = $1", [leadId])).rows[0];
    if (!lead) return res.status(404).json({
      error: "Lead profile not found."
    });

    // Fetch matching properties shortlisted via proposals
    const proposalProps = (await db.query(`
      SELECT DISTINCT pr.* FROM properties pr
      JOIN proposal_items pi ON pr.id = pi.property_id
      JOIN proposals p ON pi.proposal_id = p.id
      WHERE p.lead_id = $1
    `, [leadId])).rows;

    // Fallback: dynamic configuration match if no proposals exist
    let matchedProperties = proposalProps;
    if (matchedProperties.length === 0) {
      const budgetMax = lead.budget_max || 80000000;
      matchedProperties = (await db.query(`
        SELECT * FROM properties 
        WHERE price <= $1 AND price_raw != '0' 
        ORDER BY price DESC 
        LIMIT 4
      `, [budgetMax])).rows;
    }

    // Sanitize property fields (mask owner details in public spaces)
    const sanitizedProps = matchedProperties.map(pr => ({
      id: pr.id,
      prop_id: pr.prop_id,
      society: pr.society,
      location: pr.location,
      price_raw: pr.price_raw,
      configuration: pr.configuration,
      area_sqft: pr.area_sqft,
      interiors: pr.interiors,
      facing: pr.facing,
      possession: pr.possession,
      amenities: pr.amenities
    }));

    // Fetch conversation messages
    const messages = (await db.query(`
      SELECT * FROM client_messages 
      WHERE lead_id = $1 
      ORDER BY id ASC
    `, [leadId])).rows;
    res.json({
      success: true,
      lead: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        stage: lead.stage,
        agent_name: lead.agent_name || 'Vasu Jain'
      },
      properties: sanitizedProps,
      messages
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Client Portal API: Post message to agent
app.post('/api/client/messages', async (req, res) => {
  try {
    const leadId = req.session.clientLeadId;
    if (!leadId) return res.status(401).json({
      error: "Unauthorized access."
    });
    const {
      message
    } = req.body;
    if (!message) return res.status(400).json({
      error: "Message content cannot be blank."
    });
    await (async () => {
      const r = await db.query(`
      INSERT INTO client_messages (lead_id, sender, message)
      VALUES ($1, 'client', $2)
     RETURNING id`, [leadId, message]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();

    // Update lead timeline logs
    const lead = (await db.query("SELECT name, notes FROM leads WHERE id = $1", [leadId])).rows[0];
    if (lead) {
      const todayStr = new Date().toLocaleString();
      const updatedNotes = `[💬 Client Portal Message - ${todayStr}]\n${message}\n-----------------------\n` + (lead.notes || '');
      await (async () => {
        const r = await db.query("UPDATE leads SET notes = $1 WHERE id = $2", [updatedNotes, leadId]);
        return {
          lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
          changes: r.rowCount
        };
      })();

      // Create Priority Action
      await (async () => {
        const r = await db.query(`
        INSERT INTO todo_tasks (task, status, due_date)
        VALUES ($1, 'Priority', $2)
       RETURNING id`, [`💬 CLIENT QUERY from ${lead.name}: "${message.substring(0, 35)}..."`, new Date().toISOString().split('T')[0]]);
        return {
          lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
          changes: r.rowCount
        };
      })();
    }
    res.json({
      success: true,
      message: "Message posted successfully!"
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ----------------------------------------------------
// PHASE C — TIMELINE, SCORECARDS, ATTENDANCE & TEAM
// ----------------------------------------------------

// 1. Get Lead Timeline Journey
app.get('/api/leads/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const leadIdInt = parseInt(id);

    const timelinePromise = db.query("SELECT event_type, event_description, created_at FROM lead_timeline WHERE lead_id = $1", [leadIdInt]);
    const activitiesPromise = db.query("SELECT type AS event_type, description AS event_description, timestamp AS created_at FROM lead_activities WHERE lead_id = $1", [leadIdInt]);
    const interactionsPromise = db.query("SELECT interaction_type AS event_type, notes AS event_description, created_at FROM interaction_logs WHERE lead_id = $1", [leadIdInt]);
    const telephonyPromise = db.query("SELECT 'Telephony Call' AS event_type, duration, call_notes, created_at, agent_name FROM telephony_calls WHERE lead_id = $1", [leadIdInt]);

    const [tRes, aRes, iRes, telRes] = await Promise.all([
      timelinePromise,
      activitiesPromise,
      interactionsPromise,
      telephonyPromise
    ]);

    const events = [];

    // Add standard timeline
    tRes.rows.forEach(r => {
      events.push({
        event_type: r.event_type,
        event_description: r.event_description,
        created_at: r.created_at
      });
    });

    // Add activities
    aRes.rows.forEach(r => {
      events.push({
        event_type: r.event_type,
        event_description: r.event_description,
        created_at: r.created_at
      });
    });

    // Add interactions
    iRes.rows.forEach(r => {
      events.push({
        event_type: r.event_type,
        event_description: r.event_description,
        created_at: r.created_at
      });
    });

    // Add telephony calls
    telRes.rows.forEach(r => {
      events.push({
        event_type: 'Telephony Call',
        event_description: `Agent ${r.agent_name || 'System'} spoke for ${r.duration || 0}s. Memo: "${r.call_notes}"`,
        created_at: r.created_at
      });
    });

    // Sort descending by created_at timestamp
    events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(events);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 2. Post Custom Timeline Event
app.post('/api/leads/:id/timeline', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      event_type,
      event_description
    } = req.body;
    if (!event_description) {
      return res.status(400).json({
        error: "Missing event description"
      });
    }
    await (async () => {
      const r = await db.query("INSERT INTO lead_timeline (lead_id, event_type, event_description) VALUES ($1, $2, $3) RETURNING id", [id, event_type || 'SYSTEM', event_description]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: "Timeline event successfully appended."
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 3. Get Lead Scorecard
app.get('/api/leads/:id/scorecard', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    let scorecard = (await db.query("SELECT * FROM lead_scorecards WHERE lead_id = $1", [id])).rows[0];
    if (!scorecard) {
      scorecard = {
        lead_id: parseInt(id),
        budget: 3,
        timeline: 3,
        funding: 3,
        responsiveness: 3,
        clarity: 3
      };
    }
    res.json(scorecard);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 4. Update Lead Scorecard
app.post('/api/leads/:id/scorecard', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      budget,
      timeline,
      funding,
      responsiveness,
      clarity
    } = req.body;
    await (async () => {
      const r = await db.query(`
      INSERT INTO lead_scorecards (lead_id, budget, timeline, funding, responsiveness, clarity, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT(lead_id) DO UPDATE SET
        budget=excluded.budget,
        timeline=excluded.timeline,
        funding=excluded.funding,
        responsiveness=excluded.responsiveness,
        clarity=excluded.clarity,
        updated_at=CURRENT_TIMESTAMP
     RETURNING id`, [id, budget || 3, timeline || 3, funding || 3, responsiveness || 3, clarity || 3]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();

    // Auto-append scorecard update to timeline
    await (async () => {
      const r = await db.query("INSERT INTO lead_timeline (lead_id, event_type, event_description) VALUES ($1, $2, $3) RETURNING id", [id, 'SYSTEM', `Lead Qualification Scorecard updated. Budget: ${budget}/5, Timeline: ${timeline}/5, Funding: ${funding}/5.`]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: "Qualification scorecard saved successfully!"
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 5. Get Lead Interactions
app.get('/api/leads/:id/interactions', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const logs = (await db.query("SELECT * FROM interaction_logs WHERE lead_id = $1 ORDER BY id DESC", [id])).rows;
    res.json(logs);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 6. Post Lead Interaction
app.post('/api/leads/:id/interactions', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      interaction_type,
      notes
    } = req.body;
    if (!interaction_type || !notes) {
      return res.status(400).json({
        error: "Missing type or notes"
      });
    }
    await (async () => {
      const r = await db.query("INSERT INTO interaction_logs (lead_id, interaction_type, notes) VALUES ($1, $2, $3) RETURNING id", [id, interaction_type, notes]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();

    // Prepend to lead notes timeline
    const lead = (await db.query("SELECT notes, name FROM leads WHERE id = $1", [id])).rows[0];
    if (lead) {
      const timestamp = new Date().toLocaleString();
      const updatedNotes = `[📞 ${interaction_type} - ${timestamp}] ${notes}\n\n` + (lead.notes || '');
      await (async () => {
        const r = await db.query("UPDATE leads SET notes = $1 WHERE id = $2", [updatedNotes, id]);
        return {
          lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
          changes: r.rowCount
        };
      })();

      // Auto-append to visual timeline
      await (async () => {
        const r = await db.query("INSERT INTO lead_timeline (lead_id, event_type, event_description) VALUES ($1, $2, $3) RETURNING id", [id, 'CALL_LOG', `Outbound ${interaction_type} completed: "${notes.substring(0, 50)}..."`]);
        return {
          lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
          changes: r.rowCount
        };
      })();
    }
    res.json({
      success: true,
      message: "Interaction logged successfully!"
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 7. Get Team Roster
app.get('/api/team', async (req, res) => {
  try {
    const roster = (await db.query('SELECT * FROM agents ORDER BY id DESC')).rows;
    res.json(roster);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 8. Add Team Agent to Roster
app.post('/api/team', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      location_specialty,
      role,
      login_pin,
      allowed_pages,
      performance_rating
    } = req.body;
    if (!name) {
      return res.status(400).json({
        error: "Agent name is required"
      });
    }
    await (async () => {
      const r = await db.query("INSERT INTO agents (name, email, phone, location_specialty, role, login_pin, allowed_pages, status, performance_rating) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id", [name, email || '', phone || '', location_specialty || 'All Zones', role || 'Agent', login_pin || '0000', allowed_pages || '[]', 'ACTIVE', performance_rating !== undefined ? parseInt(performance_rating) : 5]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: "Agent successfully added to active team roster!"
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Update Team Agent inside Roster
app.put('/api/team/:id', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      name,
      email,
      phone,
      location_specialty,
      role,
      login_pin,
      allowed_pages,
      status,
      performance_rating
    } = req.body;
    await (async () => {
      const r = await db.query(`
      UPDATE agents
      SET name = $1, email = $2, phone = $3, location_specialty = $4, role = $5, login_pin = $6, allowed_pages = $7, status = $8, performance_rating = $9
      WHERE id = $10
    `, [name, email || '', phone || '', location_specialty || 'All Zones', role || 'Agent', login_pin || '0000', allowed_pages || '[]', status || 'ACTIVE', performance_rating !== undefined ? parseInt(performance_rating) : 5, id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: "Agent successfully updated inside Roster!"
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Delete Team Agent from Roster
app.delete('/api/team/:id', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    await (async () => {
      const r = await db.query("DELETE FROM agents WHERE id = $1", [id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: "Agent deleted from Active Roster."
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 9. Clock-In / Clock-Out Attendance OS
app.post('/api/attendance/clock', async (req, res) => {
  try {
    const {
      agent_id,
      action
    } = req.body;
    if (!agent_id || !action) {
      return res.status(400).json({
        error: "Missing agent_id or action"
      });
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const agent = (await db.query("SELECT name FROM agents WHERE id = $1", [agent_id])).rows[0];
    if (!agent) {
      return res.status(404).json({
        error: "Agent not found"
      });
    }
    const currentTimeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    if (action === 'IN') {
      // Check if already clocked in today
      const existing = (await db.query("SELECT * FROM attendance_logs WHERE agent_id = $1 AND attendance_date = $2 AND clock_out IS NULL", [agent_id, todayStr])).rows[0];
      if (existing) {
        return res.json({
          success: true,
          message: "Already clocked in.",
          clock_in: existing.clock_in
        });
      }
      await (async () => {
        const r = await db.query("INSERT INTO attendance_logs (agent_id, agent_name, clock_in, clock_out, attendance_date) VALUES ($1, $2, $3, $4, $5) RETURNING id", [agent_id, agent.name, currentTimeStr, null, todayStr]);
        return {
          lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
          changes: r.rowCount
        };
      })();
      res.json({
        success: true,
        message: `Clocked in successfully at ${currentTimeStr}!`,
        clock_in: currentTimeStr
      });
    } else if (action === 'OUT') {
      // Update latest clock-in log
      const activeLog = (await db.query("SELECT id FROM attendance_logs WHERE agent_id = $1 AND attendance_date = $2 AND clock_out IS NULL ORDER BY id DESC", [agent_id, todayStr])).rows[0];
      if (!activeLog) {
        return res.status(400).json({
          error: "No active clock-in session found for today. Please clock-in first."
        });
      }
      await (async () => {
        const r = await db.query("UPDATE attendance_logs SET clock_out = $1 WHERE id = $2", [currentTimeStr, activeLog.id]);
        return {
          lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
          changes: r.rowCount
        };
      })();
      res.json({
        success: true,
        message: `Clocked out successfully at ${currentTimeStr}!`,
        clock_out: currentTimeStr
      });
    } else {
      res.status(400).json({
        error: "Invalid action parameter"
      });
    }

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 10. Get Attendance Logs
app.get('/api/attendance/logs', async (req, res) => {
  try {
    const logs = (await db.query('SELECT * FROM attendance_logs ORDER BY id DESC LIMIT 50')).rows;
    res.json(logs);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 11. Query Daily Aggregate Statistics (Daily Admin Report)
app.get('/api/reports/daily', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const totalLeads = (await db.query('SELECT COUNT(*) as count FROM leads')).rows[0].count;
    const newLeadsToday = (await db.query("SELECT COUNT(*) as count FROM leads WHERE created_at LIKE $1", [`${todayStr}%`])).rows[0].count;
    const activeSiteVisits = (await db.query("SELECT COUNT(*) as count FROM leads WHERE stage = $1", ['Visit'])).rows[0].count;
    const totalProperties = (await db.query('SELECT COUNT(*) as count FROM properties')).rows[0].count;
    const totalCallsToday = (await db.query("SELECT COUNT(*) as count FROM telephony_calls WHERE created_at LIKE $1", [`${todayStr}%`])).rows[0].count;
    res.json({
      success: true,
      report_date: todayStr,
      metrics: {
        total_leads: totalLeads,
        new_leads_today: newLeadsToday,
        active_site_visits: activeSiteVisits,
        total_properties: totalProperties,
        total_calls_today: totalCallsToday
      }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 12. Query Lead Duplicates (Phase 9)
app.get('/api/leads/duplicates', async (req, res) => {
  try {
    const duplicates = (await db.query(`
      SELECT phone, COUNT(*) as count, GROUP_CONCAT(id) as ids, GROUP_CONCAT(name) as names
      FROM leads
      WHERE phone IS NOT NULL AND phone != '' AND deleted_at IS NULL
      GROUP BY phone
      HAVING count > 1
    `)).rows;
    res.json(duplicates);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 13. SOPs CRUD APIs (Phase 9)
app.get('/api/sops', async (req, res) => {
  try {
    const sops = (await db.query('SELECT * FROM sops ORDER BY id DESC')).rows;
    const parsedSops = sops.map(s => ({
      ...s,
      steps: JSON.parse(s.steps || '[]')
    }));
    res.json(parsedSops);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/sops', async (req, res) => {
  try {
    const {
      title,
      steps
    } = req.body;
    if (!title || !steps) {
      return res.status(400).json({
        error: "Missing title or steps"
      });
    }
    const info = await (async () => {
      const r = await db.query("INSERT INTO sops (title, steps) VALUES ($1, $2) RETURNING id", [title, JSON.stringify(steps)]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: info.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.delete('/api/sops/:id', async (req, res) => {
  try {
    await (async () => {
      const r = await db.query("DELETE FROM sops WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: "SOP successfully deleted."
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 14. Communication Templates CRUD APIs (Phase 9)
app.get('/api/templates', async (req, res) => {
  try {
    const templates = (await db.query('SELECT * FROM communication_templates ORDER BY id DESC')).rows;
    res.json(templates);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/templates', async (req, res) => {
  try {
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const allowed = getParsedAllowedPages(user);
    const canManage = isAdmin || allowed.includes('*') || allowed.includes('template_add');
    if (!canManage) {
      return res.status(403).json({
        error: "Access Denied: You do not have permission to manage templates."
      });
    }
    const {
      name,
      platform,
      use_case,
      content
    } = req.body;
    if (!name || !platform || !content) {
      return res.status(400).json({
        error: "Missing name, platform, or content"
      });
    }
    const info = await (async () => {
      const r = await db.query("INSERT INTO communication_templates (name, platform, use_case, content) VALUES ($1, $2, $3, $4) RETURNING id", [name, platform, use_case || '', content]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: info.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.put('/api/templates/:id', async (req, res) => {
  try {
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const allowed = getParsedAllowedPages(user);
    const canManage = isAdmin || allowed.includes('*') || allowed.includes('template_add');
    if (!canManage) {
      return res.status(403).json({
        error: "Access Denied: You do not have permission to manage templates."
      });
    }
    const {
      name,
      platform,
      use_case,
      content
    } = req.body;
    if (!name || !platform || !content) {
      return res.status(400).json({
        error: "Missing name, platform, or content"
      });
    }
    await (async () => {
      const r = await db.query("UPDATE communication_templates SET name = $1, platform = $2, use_case = $3, content = $4 WHERE id = $5", [name, platform, use_case || '', content, req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      id: req.params.id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.delete('/api/templates/:id', async (req, res) => {
  try {
    const user = getRequestUser(req);
    const isAdmin = !user || user.role === 'Admin';
    const allowed = getParsedAllowedPages(user);
    const canManage = isAdmin || allowed.includes('*') || allowed.includes('template_add');
    if (!canManage) {
      return res.status(403).json({
        error: "Access Denied: You do not have permission to delete templates."
      });
    }
    await (async () => {
      const r = await db.query("DELETE FROM communication_templates WHERE id = $1", [req.params.id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      message: "Template successfully deleted."
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ====================================================
// 4 ADVANCED CRM TRACKS (TRACKS 1, 2, 3 & 4)
// ====================================================

// Track 1: Proximity Match AI Engine Proximity Match Scores
// NOTE: Handled by the unified '/api/leads/:id/matches' endpoint above to prevent route duplication and support offered history rendering in a single payload.

// Track 2: Outbound Proposal AI & WhatsApp Pitch Curator
app.post('/api/proposals/generate-pitch', async (req, res) => {
  try {
    const {
      lead_id,
      property_ids
    } = req.body;
    if (!lead_id || !property_ids || property_ids.length === 0) {
      return res.status(400).json({
        error: "Missing lead_id or property_ids."
      });
    }
    const lead = (await db.query("SELECT * FROM leads WHERE id = $1", [lead_id])).rows[0];
    if (!lead) return res.status(404).json({
      error: "Lead not found."
    });
    
    // Check if a proposal already exists for this lead with these properties
    let token = null;
    const existingProposals = (await db.query(`
      SELECT p.token, p.id FROM proposals p
      WHERE p.lead_id = $1
      ORDER BY p.id DESC
    `, [lead_id])).rows;
    
    for (const ep of existingProposals) {
      const epItems = (await db.query(`
        SELECT property_id FROM proposal_items WHERE proposal_id = $1
      `, [ep.id])).rows.map(item => item.property_id);
      
      // Compare arrays
      if (epItems.length === property_ids.length && epItems.every(id => property_ids.includes(id))) {
        token = ep.token;
        break;
      }
    }

    // Generate on-the-fly proposal if not found
    if (!token) {
      const crypto = require('crypto');
      token = crypto.randomBytes(16).toString('hex');
      const title = 'Curated Property Shortlist';
      const intro_message = 'Please review the properties chosen below.';
      
      const insertRes = await db.query(`
        INSERT INTO proposals (token, lead_id, title, intro_message)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [token, lead_id, title, intro_message]);
      
      const proposalId = insertRes.rows[0].id;
      for (const propId of property_ids) {
        await db.query(`
          INSERT INTO proposal_items (proposal_id, property_id, agent_comments)
          VALUES ($1, $2, $3)
        `, [proposalId, propId, '']);
      }
      
      // Log in lead timeline/notes
      const todayStr = new Date().toLocaleString();
      const updatedNotes = `[📢 Proposal Sent - ${todayStr}]\nCurated a portfolio of ${property_ids.length} properties. Access Token: ${token}\n-----------------------\n` + (lead.notes || '');
      await db.query("UPDATE leads SET notes = $1 WHERE id = $2", [updatedNotes, lead_id]);
    }

    const host = req.get('host') || 'localhost:5001';
    const protocol = req.protocol || 'http';
    const origin = `${protocol}://${host}`;

    const placeholders = property_ids.map((_, idx) => '$' + (idx + 1)).join(',');
    const properties = (await db.query(`SELECT * FROM properties WHERE id IN (${placeholders})`, property_ids)).rows;
    
    let pitch = `🏠 *PREMIUM PROPERTY PORTFOLIO FOR ${lead.name.toUpperCase()}* 🏠\n\n`;
    pitch += `Hi ${lead.name}, hope you are doing well!\nBased on your specific requirements, I have curated these exclusive premium residential options for you:\n\n`;
    properties.forEach((p, idx) => {
      pitch += `🔥 *OPTION ${idx + 1}: ${p.society.toUpperCase()}*\n`;
      pitch += `📍 *Locality*: ${p.location || 'Bangalore'}\n`;
      pitch += `📐 *Configuration*: ${p.configuration || 'Premium BHK'} | *Area*: ${p.area_sqft || 'N/A'} sqft\n`;
      pitch += `🛋️ *Interiors*: ${p.interiors || 'Semi-furnished'} | *Facing*: ${p.facing || 'East facing'}\n`;
      pitch += `💰 *Expected Price*: ₹${p.price_raw || (p.price ? (p.price / 10000000).toFixed(2) + ' Cr' : 'On Request')}\n`;
      if (p.amenities) pitch += `✨ *Amenities*: ${p.amenities.substring(0, 75)}...\n`;
      pitch += `\n`;
    });
    
    pitch += `🔗 *Interactive Proposal Showroom Link*:\n`;
    pitch += `${origin}/proposal/${token}\n\n`;
    
    // Get branding settings
    const rows = (await db.query("SELECT * FROM system_settings")).rows;
    const settings = { ...systemSettings };
    rows.forEach(r => {
      if (r.key === 'showMaskedFields') {
        settings[r.key] = r.value === 'true';
      } else {
        settings[r.key] = r.value;
      }
    });

    pitch += `📞 *${settings.userName} | ${settings.coBrandName}*\n`;
    pitch += `${settings.userRole || 'Luxury Real Estate Advisor'}\n`;
    pitch += `📱 ${settings.coPhone} | ✉️ ${settings.coEmail}\n`;
    pitch += `-------------------------------------------\n`;
    pitch += `*(Direct owner details and direct unit numbers are stripped automatically for secure client sharing)*`;
    
    res.json({
      success: true,
      pitch,
      token
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Track 3: Executive Operations & GTM Financial Dashboard Analytics
app.get('/api/reports/analytics', async (req, res) => {
  try {
    // 1. Stage breakdown
const timeFilter = req.query.timeframe || 'All Time';
    let dateCondition = '';
    if (timeFilter === 'Daily') dateCondition = "WHERE created_at >= NOW() - INTERVAL '1 day'";
    if (timeFilter === 'Weekly') dateCondition = "WHERE created_at >= NOW() - INTERVAL '7 days'";
    if (timeFilter === 'Monthly') dateCondition = "WHERE created_at >= NOW() - INTERVAL '30 days'";
    if (timeFilter === 'Quarterly') dateCondition = "WHERE created_at >= NOW() - INTERVAL '90 days'";

    // 1. Stage breakdown
    const rawStages = (await db.query(`SELECT stage, COUNT(*) as count FROM leads ${dateCondition} GROUP BY stage`)).rows;

    // 1b. Source breakdown
    const rawSources = (await db.query(`SELECT source, COUNT(*) as count FROM leads ${dateCondition} GROUP BY source`)).rows;
    const stagesMap = {
      'New': 0,
      'Contacted': 0,
      'Qualified': 0,
      'Proposal': 0,
      'Won': 0,
      'Lost': 0
    };
    rawStages.forEach(s => {
      if (s.stage && stagesMap[s.stage] !== undefined) {
        stagesMap[s.stage] = s.count;
      }
    });

    // 2. Specialty Location Density
    const locationCounts = (await db.query("SELECT location, COUNT(*) as count FROM properties GROUP BY location ORDER BY count DESC LIMIT 5")).rows;

    // 3. Agent Performance
    const agents = (await db.query("SELECT id, name, location_specialty, leads_assigned, performance_rating FROM agents")).rows;
    const agentsPerformance = await Promise.all(agents.map(async a => {
      const leadsCount = (await db.query("SELECT COUNT(*) as count FROM leads WHERE agent_id = $1", [a.id])).rows[0].count;
      const closedDeals = (await db.query("SELECT COUNT(*) as count FROM leads WHERE agent_id = $1 AND stage = 'Won'", [a.id])).rows[0].count;
      return {
        id: a.id,
        name: a.name,
        specialty: a.location_specialty,
        leads: leadsCount || a.leads_assigned || 0,
        deals_won: closedDeals,
        volume: closedDeals * 15000000,
        // simulated sales volume
        performance_rating: a.performance_rating || 5
      };
    }));

    // 4. Commissions splits ledger
    const commissionsList = (await db.query("SELECT * FROM commissions ORDER BY id DESC")).rows;

    // Calculate aggregate financials
    let totalGrossRevenue = 0;
    let totalCoBrokerPayouts = 0;
    let totalExpenses = 0;
    commissionsList.forEach(c => {
      totalGrossRevenue += parseFloat(c.deal_value || 0) * (parseFloat(c.commission_percentage || 0) / 100);
      totalCoBrokerPayouts += parseFloat(c.co_broker_payout || 0);
      totalExpenses += parseFloat(c.expenses || 0);
    });

    const user = getRequestUser(req);
    const isEmployee = user && user.role === 'Employee';
    const shouldMask = !systemSettings.showMaskedFields || isEmployee;

    const processedLedger = commissionsList.map(c => maskCommission(c, user));
    const processedFinancials = shouldMask ? {
      gross_revenue: 0,
      payouts: 0,
      expenses: 0,
      net_profit: 0
    } : {
      gross_revenue: totalGrossRevenue,
      payouts: totalCoBrokerPayouts,
      expenses: totalExpenses,
      net_profit: totalGrossRevenue - totalCoBrokerPayouts - totalExpenses
    };

    res.json({
      success: true,
      stages: stagesMap,
      sources: rawSources,
      locations: locationCounts,
      agents: agentsPerformance,
      ledger: processedLedger,
      financials: processedFinancials
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Track 4: Bi-Directional Google Sheets Sync Engine (Simulated Sync)
app.post('/api/system/sync-sheets', async (req, res) => {
  try {
    const fs = require('fs');
    const sheetPath = path.join(__dirname, 'simulated_google_sheet.csv');

    // Fetch all active properties
    const activeProperties = (await db.query("SELECT * FROM properties")).rows;

    // Check if simulated CSV exists
    let newPropertiesImportedCount = 0;
    let statusMessage = "";
    if (fs.existsSync(sheetPath)) {
      // 1. Read and parse the simulated sheet (bi-directional import)
      const csvData = fs.readFileSync(sheetPath, 'utf-8');
      const rows = csvData.split('\n');
      if (rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i].trim();
          if (!row) continue;
          const cols = row.split(',');
          if (cols.length >= 5) {
            const propId = cols[0].trim();
            const society = cols[1].trim();
            const location = cols[2].trim();
            const priceVal = parseFloat(cols[3].trim() || 0);
            const priceRaw = cols[4].trim();
            if (society && propId) {
              const existing = (await db.query("SELECT id FROM properties WHERE prop_id = $1", [propId])).rows[0];
              if (!existing) {
                await (async () => {
                  const r = await db.query(`
                  INSERT INTO properties (prop_id, mandate_type, property_type, society, location, price, price_raw, status)
                  VALUES ($1, 'Non-Exclusive', 'Apartment', $2, $3, $4, $5, 'AVAILABLE')
                 RETURNING id`, [propId, society, location, priceVal, priceRaw]);
                  return {
                    lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
                    changes: r.rowCount
                  };
                })();
                newPropertiesImportedCount++;
              }
            }
          }
        }
      }
      statusMessage = `Sync successful! Imported ${newPropertiesImportedCount} new listings from Simulated Google Sheet. `;
    } else {
      statusMessage = "Created fresh Simulated Google Sheet with active properties database. ";
    }

    // 2. Export database properties back to the simulated CSV (bi-directional sync/update)
    const updatedProperties = (await db.query("SELECT * FROM properties")).rows;
    let csvContent = "prop_id,society,location,price,price_raw,configuration,area_sqft,facing,interiors,sync_status\n";
    updatedProperties.forEach(p => {
      const cleanSociety = (p.society || 'N/A').replace(/,/g, ' ');
      const cleanLoc = (p.location || 'N/A').replace(/,/g, ' ');
      const cleanConfig = (p.configuration || 'N/A').replace(/,/g, ' ');
      const cleanFacing = (p.facing || 'N/A').replace(/,/g, ' ');
      const cleanInteriors = (p.interiors || 'N/A').replace(/,/g, ' ');
      csvContent += `${p.prop_id || 'PROP-' + p.id},${cleanSociety},${cleanLoc},${p.price || 0},${p.price_raw || 'On Request'},${cleanConfig},${p.area_sqft || 0},${cleanFacing},${cleanInteriors},SYNCED: Google Sheets\n`;
    });
    fs.writeFileSync(sheetPath, csvContent, 'utf-8');

    // Update sync_status in property table
    await (async () => {
      const r = await db.query("UPDATE properties SET sync_status = 'SYNCED: Google Sheets'");
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true,
      imported_count: newPropertiesImportedCount,
      exported_count: updatedProperties.length,
      sheet_path: sheetPath,
      message: statusMessage + `Exported ${updatedProperties.length} active listings bi-directionally to the master spreadsheet.`
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Manual Backup Endpoint: Trigger immediate database snapshot backup
app.post('/api/system/backup', async (req, res) => {
  try {
    const fs = require('fs');
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, {
        recursive: true
      });
    }
    const backupFilename = `realpro_crm_backup_${new Date().toISOString().split('T')[0]}_manual.db`;
    const backupPath = path.join(backupDir, backupFilename);
    
    const { exec } = require('child_process');
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/realprocrm';
    const sqlBackupPath = backupPath.replace('.db', '.sql');
    const sqlBackupFilename = backupFilename.replace('.db', '.sql');
    exec(`pg_dump ${dbUrl} > "${sqlBackupPath}"`, (error) => {
      if (error) {
        if (typeof res !== 'undefined' && res.status) res.status(500).json({ error: error.message });
        else console.error("Backup failed", error);
        return;
      }
      console.log(`Backup successfully created at: ${sqlBackupPath}`);
      if (typeof res !== 'undefined') {
         if (res.download) res.download(sqlBackupPath, sqlBackupFilename);
         else if (res.json) res.json({ success: true, filename: sqlBackupFilename, path: sqlBackupPath });
      }

    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Download Full Database Backup Endpoint
app.get('/api/system/backup/download', async (req, res) => {
  try {
    const fs = require('fs');
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, {
        recursive: true
      });
    }
    const backupFilename = `realpro_crm_backup_${new Date().toISOString().split('T')[0]}_full.db`;
    const backupPath = path.join(backupDir, backupFilename);
    
    const { exec } = require('child_process');
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/realprocrm';
    const sqlBackupPath = backupPath.replace('.db', '.sql');
    const sqlBackupFilename = backupFilename.replace('.db', '.sql');
    exec(`pg_dump ${dbUrl} > "${sqlBackupPath}"`, (error) => {
      if (error) {
        if (typeof res !== 'undefined' && res.status) res.status(500).json({ error: error.message });
        else console.error("Backup failed", error);
        return;
      }
      console.log(`Backup successfully created at: ${sqlBackupPath}`);
      if (typeof res !== 'undefined') {
         if (res.download) res.download(sqlBackupPath, sqlBackupFilename);
         else if (res.json) res.json({ success: true, filename: sqlBackupFilename, path: sqlBackupPath });
      }

    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Hourly Automated Database Backup scheduler using node-cron (runs every hour at minute 0)
cron.schedule('0 * * * *', () => {
  try {
    const fs = require('fs');
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, {
        recursive: true
      });
    }
    // Unique hourly timestamped filename (replacing colons to prevent file path issues on Windows/MacOS)
    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const backupFilename = `realpro_crm_backup_${timestamp}_auto.sql`;
    const backupPath = path.join(backupDir, backupFilename);
    
    const { exec } = require('child_process');
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/realprocrm';
    
    exec(`pg_dump ${dbUrl} > "${backupPath}"`, (error) => {
      if (error) {
        console.error("[📦 DATABASE AUTO-BACKUP ERROR]", error.message);
        return;
      }
      console.log(`[📦 DATABASE AUTO-BACKUP] Backup successfully created at: ${backupPath}`);
    });

  } catch (err) {
    console.error("[📦 DATABASE AUTO-BACKUP ERROR]", err.message);
  }
});

// ----------------------------------------------------
// 20. INVOICING CRUD & FILE UPLOADS API
// ----------------------------------------------------
app.get('/api/invoices', async (req, res) => {
  try {
    const list = (await db.query('SELECT * FROM invoices ORDER BY id DESC')).rows;
    res.json(list);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/invoices', async (req, res) => {
  try {
    const {
      invoice_no,
      invoice_date,
      client_name,
      client_gstin,
      client_address,
      project_deal,
      description,
      amount,
      cgst,
      sgst,
      total,
      payment_status,
      broker_name,
      broker_address,
      broker_email,
      broker_phone,
      broker_rera,
      broker_gstin,
      bank_name,
      bank_account,
      bank_ifsc,
      bank_account_type,
      bank_branch,
      terms,
      items
    } = req.body;
    const stmt = { run: async (...args) => {
        // If it's an INSERT, append RETURNING id
        let q = `
      INSERT INTO invoices (
        invoice_no, invoice_date, client_name, client_gstin, client_address,
        project_deal, description, amount, cgst, sgst, total, payment_status,
        broker_name, broker_address, broker_email, broker_phone, broker_rera, broker_gstin,
        bank_name, bank_account, bank_ifsc, bank_account_type, bank_branch, terms, items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    `;
        if (q.trim().toUpperCase().startsWith('INSERT') && !q.includes('RETURNING')) {
            q += ' RETURNING id';
        }
        const r = await db.query(q, args);
        return { lastInsertRowid: r.rows[0] ? r.rows[0].id : null, changes: r.rowCount };
   }};

    const result = stmt.run(invoice_no || null, invoice_date || null, client_name || null, client_gstin || null, client_address || null, project_deal || null, description || null, amount || 0, cgst || 0, sgst || 0, total || 0, payment_status || 'Pending', broker_name || 'Ms Vasu Jain', broker_address || null, broker_email || null, broker_phone || null, broker_rera || null, broker_gstin || null, bank_name || null, bank_account || null, bank_ifsc || null, bank_account_type || null, bank_branch || null, terms || null, items || null);
    res.json({
      success: true,
      id: result.lastInsertRowid,
      invoice_no
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/api/invoices/upload', upload.single('invoice_file'), async (req, res) => {
  try {
    const {
      client_name,
      invoice_no,
      invoice_date,
      amount,
      payment_status
    } = req.body;
    if (!req.file) {
      return res.status(400).json({
        error: "No PDF file uploaded"
      });
    }
    const relativePath = '/uploads/' + req.file.filename;
    const stmt = { run: async (...args) => {
        // If it's an INSERT, append RETURNING id
        let q = `
      INSERT INTO invoices (
        invoice_no, invoice_date, client_name, amount, total, payment_status, uploaded_file_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
        if (q.trim().toUpperCase().startsWith('INSERT') && !q.includes('RETURNING')) {
            q += ' RETURNING id';
        }
        const r = await db.query(q, args);
        return { lastInsertRowid: r.rows[0] ? r.rows[0].id : null, changes: r.rowCount };
   }};

    const result = stmt.run(invoice_no || `RE INT - UPL - ${Date.now()}`, invoice_date || new Date().toISOString().split('T')[0], client_name || 'Uploaded Invoice', parseFloat(amount || 0), parseFloat(amount || 0), payment_status || 'Pending', relativePath);
    res.json({
      success: true,
      id: result.lastInsertRowid,
      file_path: relativePath
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const inv = (await db.query("SELECT uploaded_file_path FROM invoices WHERE id = $1", [id])).rows[0];
    if (inv && inv.uploaded_file_path) {
      const fullPath = path.join(__dirname, '../public', inv.uploaded_file_path);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {}
      }
    }
    await (async () => {
      const r = await db.query("DELETE FROM invoices WHERE id = $1", [id]);
      return {
        lastInsertRowid: r.rows?.[0] ? r.rows[0].id : null,
        changes: r.rowCount
      };
    })();
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Admin Reports API
app.get('/api/reports/admin', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'Monthly';
    let dateConditionLeads = '';
    let dateConditionCommissions = '';
    let dateConditionCalls = '';
    let dateConditionLogs = '';
    let label = 'Last 30 Days';

    if (timeframe === 'Daily') {
      dateConditionLeads = "WHERE created_at >= NOW() - INTERVAL '1 day'";
      dateConditionCommissions = "WHERE created_at >= NOW() - INTERVAL '1 day'";
      dateConditionCalls = "WHERE call_time >= NOW() - INTERVAL '1 day'";
      dateConditionLogs = "WHERE created_at >= NOW() - INTERVAL '1 day'";
      label = 'Daily (Last 24 Hours)';
    } else if (timeframe === 'Weekly') {
      dateConditionLeads = "WHERE created_at >= NOW() - INTERVAL '7 days'";
      dateConditionCommissions = "WHERE created_at >= NOW() - INTERVAL '7 days'";
      dateConditionCalls = "WHERE call_time >= NOW() - INTERVAL '7 days'";
      dateConditionLogs = "WHERE created_at >= NOW() - INTERVAL '7 days'";
      label = 'Weekly (Last 7 Days)';
    } else if (timeframe === 'Monthly') {
      dateConditionLeads = "WHERE created_at >= NOW() - INTERVAL '30 days'";
      dateConditionCommissions = "WHERE created_at >= NOW() - INTERVAL '30 days'";
      dateConditionCalls = "WHERE call_time >= NOW() - INTERVAL '30 days'";
      dateConditionLogs = "WHERE created_at >= NOW() - INTERVAL '30 days'";
      label = 'Monthly (Last 30 Days)';
    } else if (timeframe === 'Quarterly') {
      dateConditionLeads = "WHERE created_at >= NOW() - INTERVAL '90 days'";
      dateConditionCommissions = "WHERE created_at >= NOW() - INTERVAL '90 days'";
      dateConditionCalls = "WHERE call_time >= NOW() - INTERVAL '90 days'";
      dateConditionLogs = "WHERE created_at >= NOW() - INTERVAL '90 days'";
      label = 'Quarterly (Last 90 Days)';
    } else {
      label = 'All Time';
    }

    // Leads summary
    const totalLeadsRes = await db.query(`SELECT COUNT(*) as count FROM leads ${dateConditionLeads}`);
    const totalLeads = parseInt(totalLeadsRes.rows[0]?.count || 0);

    const newLeadsRes = await db.query(`SELECT COUNT(*) as count FROM leads ${dateConditionLeads} ${dateConditionLeads ? 'AND' : 'WHERE'} stage = 'New'`);
    const newLeads = parseInt(newLeadsRes.rows[0]?.count || 0);

    const convertedLeadsRes = await db.query(`SELECT COUNT(*) as count FROM leads ${dateConditionLeads} ${dateConditionLeads ? 'AND' : 'WHERE'} stage = 'Won'`);
    const convertedLeads = parseInt(convertedLeadsRes.rows[0]?.count || 0);

    const activePipelineRes = await db.query(`SELECT COUNT(*) as count FROM leads ${dateConditionLeads} ${dateConditionLeads ? 'AND' : 'WHERE'} stage NOT IN ('Won', 'Lost')`);
    const activePipeline = parseInt(activePipelineRes.rows[0]?.count || 0);

    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    // Commissions/Revenue summary
    const commissionsRes = await db.query(`SELECT deal_value, commission_percentage FROM commissions ${dateConditionCommissions}`);
    let totalRevenue = 0;
    commissionsRes.rows.forEach(c => {
      totalRevenue += parseFloat(c.deal_value || 0) * (parseFloat(c.commission_percentage || 0) / 100);
    });

    const avgDealSizeRes = await db.query(`SELECT AVG(deal_value) as avg_deal FROM commissions ${dateConditionCommissions}`);
    const avgDealSize = Math.round(parseFloat(avgDealSizeRes.rows[0]?.avg_deal || 0));

    // Leads by source
    const leadsBySourceRes = await db.query(`SELECT source, COUNT(*) as count FROM leads ${dateConditionLeads} GROUP BY source ORDER BY count DESC`);
    
    // Leads by stage
    const leadsByStageRes = await db.query(`SELECT stage, COUNT(*) as count FROM leads ${dateConditionLeads} GROUP BY stage`);

    // Agent performance
    const agents = (await db.query("SELECT id, name, performance_rating FROM agents")).rows;
    const agentPerformance = await Promise.all(agents.map(async a => {
      const lCountRes = await db.query(`SELECT COUNT(*) as count FROM leads ${dateConditionLeads} ${dateConditionLeads ? 'AND' : 'WHERE'} agent_id = $1`, [a.id]);
      const wCountRes = await db.query(`SELECT COUNT(*) as count FROM leads ${dateConditionLeads} ${dateConditionLeads ? 'AND' : 'WHERE'} agent_id = $1 AND stage = 'Won'`, [a.id]);
      return {
        id: a.id,
        name: a.name,
        leads: parseInt(lCountRes.rows[0]?.count || 0),
        deals_won: parseInt(wCountRes.rows[0]?.count || 0),
        volume: parseInt(wCountRes.rows[0]?.count || 0) * 15000000,
        performance_rating: a.performance_rating || 5
      };
    }));

    // Activities log
    const callsRes = await db.query(`SELECT COUNT(*) as count FROM telephony_calls ${dateConditionCalls}`);
    const visitsRes = await db.query(`SELECT COUNT(*) as count FROM leads ${dateConditionLeads} ${dateConditionLeads ? 'AND' : 'WHERE'} stage = 'Qualified' OR stage = 'Proposal'`);
    const waRes = await db.query(`SELECT COUNT(*) as count FROM interaction_logs ${dateConditionLogs} ${dateConditionLogs ? 'AND' : 'WHERE'} type = 'WhatsApp'`);
    const emailRes = await db.query(`SELECT COUNT(*) as count FROM interaction_logs ${dateConditionLogs} ${dateConditionLogs ? 'AND' : 'WHERE'} type = 'Email'`);

    // Top properties
    const topPropertiesRes = await db.query(`
      SELECT p.id as property_id, p.society, p.title, p.location, COUNT(lpi.lead_id) as enquiries
      FROM properties p
      LEFT JOIN lead_property_interest lpi ON p.id = lpi.property_id
      GROUP BY p.id, p.society, p.title, p.location
      ORDER BY enquiries DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      period: {
        label,
        startDate: timeframe === 'All Time' ? 'Beginning' : new Date(Date.now() - (timeframe === 'Daily' ? 1 : timeframe === 'Weekly' ? 7 : timeframe === 'Monthly' ? 30 : 90) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      },
      summary: {
        totalLeads,
        newLeads,
        convertedLeads,
        conversionRate,
        totalRevenue,
        avgDealSize,
        activePipeline
      },
      leadsBySource: leadsBySourceRes.rows,
      leadsByStage: leadsByStageRes.rows,
      agentPerformance,
      activityLog: {
        totalCalls: parseInt(callsRes.rows[0]?.count || 0),
        totalSiteVisits: parseInt(visitsRes.rows[0]?.count || 0),
        totalWhatsApp: parseInt(waRes.rows[0]?.count || 0),
        totalEmails: parseInt(emailRes.rows[0]?.count || 0)
      },
      topProperties: topPropertiesRes.rows
    });
  } catch (err) {
    console.error("Admin Report API Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- DOCUMENT VAULT API ENDPOINTS ---
app.get('/api/documents', async (req, res) => {
  try {
    const { reference_type, reference_id } = req.query;
    let query = 'SELECT * FROM document_vault';
    const params = [];
    if (reference_type && reference_id) {
      query += ' WHERE reference_type = $1 AND reference_id = $2';
      params.push(reference_type, parseInt(reference_id));
    }
    query += ' ORDER BY id DESC';
    const docs = (await db.query(query, params)).rows;
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    const { doc_name, doc_url, reference_type, reference_id, uploaded_by } = req.body;
    if (!doc_name || !doc_url || !reference_type || !reference_id) {
      return res.status(400).json({ error: 'Missing required document fields.' });
    }

    let refName = 'Unknown';
    const refIdInt = parseInt(reference_id);
    if (reference_type === 'Lead') {
      const row = (await db.query('SELECT name FROM leads WHERE id = $1', [refIdInt])).rows[0];
      if (row) refName = row.name;
    } else if (reference_type === 'Inventory') {
      const row = (await db.query('SELECT society FROM properties WHERE id = $1', [refIdInt])).rows[0];
      if (row) refName = row.society;
    } else if (reference_type === 'Transaction') {
      const row = (await db.query('SELECT deal_name FROM commissions WHERE id = $1', [refIdInt])).rows[0];
      if (row) refName = row.deal_name;
    }

    const user = getRequestUser(req);
    const uBy = uploaded_by || (user ? user.name : 'System');

    const result = await db.query(
      `INSERT INTO document_vault (doc_name, doc_url, reference_type, reference_id, reference_name, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [doc_name, doc_url, reference_type, refIdInt, refName, uBy]
    );

    res.json({ success: true, id: result.rows[0].id, reference_name: refName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM document_vault WHERE id = $1', [parseInt(id)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LEAD TRANSACTION LINK ENDPOINT ---
app.get('/api/leads/:id/transaction', async (req, res) => {
  try {
    const { id } = req.params;
    const comm = (await db.query('SELECT * FROM commissions WHERE lead_id = $1 ORDER BY id DESC LIMIT 1', [parseInt(id)])).rows[0];
    const user = getRequestUser(req);
    res.json(maskCommission(comm, user) || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, async () => {
  console.log(`REALPro CRM server is listening running on port http://localhost:${PORT}`);

  // --- Migration 1: Backfill null prop_ids ---
  try {
    await db.query(`
      UPDATE properties
      SET prop_id = id::text || '/' || COALESCE(zone, 'N') || '-' || TO_CHAR(COALESCE(created_at, NOW()), 'YYYY')
      WHERE prop_id IS NULL OR TRIM(prop_id) = ''
    `);
    console.log('[Migration 1] prop_id backfill complete.');
  } catch (err) {
    console.warn('[Migration 1] prop_id backfill skipped:', err.message);
  }

  // --- Migration 2: Sync sequence_counters to MAX actual prop_id number ---
  // This ensures new IDs continue from the last used number, not reset to 151
  try {
    // Get distinct category_keys that exist in sequence_counters
    const categories = [
      { key_pattern: 'prop_residential_resale', year: new Date().getFullYear().toString() },
      { key_pattern: 'prop_residential_rental', year: new Date().getFullYear().toString() },
      { key_pattern: 'prop_commercial_sale', year: new Date().getFullYear().toString() },
      { key_pattern: 'prop_commercial_rental', year: new Date().getFullYear().toString() },
    ];

    for (const cat of categories) {
      const counterKey = `${cat.key_pattern}_${cat.year}`;
      // Find MAX numeric prefix from prop_ids (format: NUMBER/ZONE-YEAR)
      const result = await db.query(`
        SELECT MAX(
          CASE WHEN prop_id ~ '^[0-9]+/' THEN CAST(split_part(prop_id, '/', 1) AS INTEGER)
          ELSE 150 END
        ) as max_val
        FROM properties WHERE deleted_at IS NULL AND prop_id IS NOT NULL
      `);
      const maxVal = parseInt(result.rows[0]?.max_val || 150);
      if (maxVal >= 151) {
        // Upsert: update if exists, insert if not
        await db.query(`
          INSERT INTO sequence_counters (category_key, last_value)
          VALUES ($1, $2)
          ON CONFLICT (category_key) DO UPDATE
          SET last_value = GREATEST(sequence_counters.last_value, $2)
        `, [counterKey, maxVal]);
        console.log(`[Migration 2] Synced ${counterKey} to max=${maxVal}`);
      }
    }
  } catch (err) {
    console.warn('[Migration 2] sequence_counters sync skipped:', err.message);
  }
});

