require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is missing.");
  console.error("The CRM now requires PostgreSQL. Please add DATABASE_URL to your .env file.");
  process.exit(1);
}

console.log("DATABASE_URL found. Connecting to PostgreSQL...");

const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false } // Required for Railway, but disable for local
});

const db = {
  query: async (text, params) => {
    let actualParams = params || [];
    if (Array.isArray(params) && params.length === 1 && Array.isArray(params[0])) {
      actualParams = params[0];
    }
    let counter = 1;
    const pgText = text.replace(/\?/g, () => '$' + (counter++));
    return pool.query(pgText, actualParams);
  },
  pool: pool
};

(async () => {
  try {
    await pool.query(`CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    source TEXT,
    status TEXT,
    stage TEXT,
    project_type TEXT,
    budget_min NUMERIC,
    budget_max NUMERIC,
    notes TEXT,
    next_followup TEXT,
    followup_status TEXT,
    touchpoint TEXT,
    associate_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  , agent_id INTEGER, agent_name TEXT, special_tags TEXT, documents TEXT, location_preference TEXT, config_bhk TEXT, timeline_preference TEXT, rental_expiry_date TEXT, lead_score INTEGER DEFAULT 0, deleted_at TEXT, admin_comments TEXT, property_requirement TEXT);
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    prop_id TEXT,
    mandate_type TEXT,
    property_type TEXT,
    society TEXT NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'AVAILABLE',
    site_area TEXT,
    area_sqft NUMERIC,
    configuration TEXT,
    floor_info TEXT,
    floor_range TEXT,
    interiors TEXT,
    facing TEXT,
    amenities TEXT,
    car_park TEXT,
    price NUMERIC,
    price_raw TEXT,
    possession TEXT,
    project_size TEXT,
    project_status TEXT,
    additional_info TEXT,
    video_link TEXT,
    photo_link TEXT,
    brochure_link TEXT,
    owner_name TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    unit_no TEXT,
    registration_status TEXT,
    source TEXT,
    sub_source TEXT,
    comments TEXT,
    maintenance NUMERIC,
    deposit NUMERIC,
    available_from TEXT,
    date_of_inventory TEXT,
    available_for TEXT,
    plot_size TEXT,
    sba TEXT,
    associate_id INTEGER,
    special_tags TEXT,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP
  , sync_status TEXT DEFAULT 'NOT_SYNCED', zone TEXT, onboarded_year TEXT, plot_dimension TEXT, house_facing TEXT, plot_facing TEXT, holder_type TEXT, deleted_at TEXT, admin_comments TEXT, project_id INTEGER, agent_id INTEGER);
CREATE TABLE builder_projects (
    id SERIAL PRIMARY KEY,
    builder_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    location TEXT,
    land_parcel TEXT,
    tower TEXT,
    elevation TEXT,
    configuration TEXT,
    carpet_area TEXT,
    price_final TEXT,
    uc_rtmi TEXT,
    possession TEXT,
    subvention TEXT,
    clp_due TEXT,
    floor_rise TEXT,
    location_usp TEXT,
    metro_station TEXT,
    other_usp TEXT,
    special_tags TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  , brochure_link TEXT, floor_plans TEXT, mother_docs TEXT, assignments TEXT, kyc_docs TEXT, photos TEXT, videos TEXT, cp_agreements TEXT, builder_details TEXT, finance_info TEXT, analytics_info TEXT, zone TEXT, onboarded_year TEXT, proj_id TEXT, google_map_url TEXT, unit_details TEXT, builder_poc_details TEXT, plot_dimension TEXT, plot_size TEXT, house_facing TEXT, plot_facing TEXT, deleted_at TEXT, admin_comments TEXT);
CREATE TABLE daily_checklist (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    routine_type TEXT NOT NULL,
    is_checked INTEGER DEFAULT 0,
    routine_date TEXT NOT NULL
  );
CREATE TABLE associates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    email TEXT,
    co_brokerage_share NUMERIC,
    rating INTEGER,
    speciality_zones TEXT,
    linked_inventories TEXT
  , is_inner_circle INTEGER DEFAULT 0, agent_id INTEGER);
CREATE TABLE commissions (
    id SERIAL PRIMARY KEY,
    deal_name TEXT NOT NULL,
    deal_value NUMERIC,
    commission_percentage NUMERIC,
    co_broker_payout NUMERIC,
    billing_invoice TEXT,
    expenses NUMERIC,
    payment_status TEXT DEFAULT 'Pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  , booking_date TEXT, agreement_date TEXT, registration_date TEXT, handover_date TEXT, commission_amount NUMERIC);
CREATE TABLE todo_tasks (
    id SERIAL PRIMARY KEY,
    task TEXT NOT NULL,
    status TEXT DEFAULT 'Incomplete',
    due_date TEXT
  , priority TEXT DEFAULT 'Medium');
CREATE TABLE scratchpad (
    id SERIAL PRIMARY KEY,
    content TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE habits (
    id SERIAL PRIMARY KEY,
    habit_name TEXT NOT NULL,
    habit_date TEXT NOT NULL,
    is_done INTEGER DEFAULT 0
  , agent_id INTEGER);
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'ACTIVE',
    location_specialty TEXT,
    leads_assigned INTEGER DEFAULT 0
  , role TEXT DEFAULT 'Agent', login_pin TEXT, allowed_pages TEXT, performance_rating INTEGER DEFAULT 5);
CREATE TABLE drip_campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    target_leads_status TEXT NOT NULL,
    sequence_data TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );
CREATE TABLE drip_logs (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER,
    lead_name TEXT,
    campaign_id INTEGER,
    campaign_name TEXT,
    step_index INTEGER,
    message TEXT,
    scheduled_date TEXT,
    sent_date TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'SENT'
  );
CREATE TABLE auto_assignment_settings (
    id SERIAL PRIMARY KEY,
    rule_type TEXT DEFAULT 'ROUND_ROBIN',
    is_active INTEGER DEFAULT 1
  );
CREATE TABLE telephony_calls (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER,
    lead_name TEXT,
    agent_id INTEGER,
    agent_name TEXT,
    duration INTEGER,
    recording_url TEXT,
    call_notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE proposals (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE,
    lead_id INTEGER,
    title TEXT,
    intro_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE proposal_items (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER,
    property_id INTEGER,
    agent_comments TEXT
  );
CREATE TABLE client_messages (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER,
    sender TEXT,
    message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE lead_timeline (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- STAGE_CHANGE, CALL_LOG, CHAT_MESSAGE, WEBHOOK, SYSTEM
    event_description TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE lead_scorecards (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER UNIQUE NOT NULL,
    budget INTEGER DEFAULT 3,
    timeline INTEGER DEFAULT 3,
    funding INTEGER DEFAULT 3,
    responsiveness INTEGER DEFAULT 3,
    clarity INTEGER DEFAULT 3,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE attendance_logs (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    agent_name TEXT,
    clock_in TEXT,
    clock_out TEXT,
    attendance_date TEXT NOT NULL
  );
CREATE TABLE interaction_logs (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL,
    interaction_type TEXT NOT NULL, -- Call, WhatsApp, Email
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE sequence_counters (
    category_key TEXT,
    last_value INTEGER DEFAULT 150,
    PRIMARY KEY (category_key)
  );
CREATE TABLE lead_activities (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE lead_property_interest (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Interested',
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_no TEXT UNIQUE,
    invoice_date TEXT,
    client_name TEXT,
    client_gstin TEXT,
    client_address TEXT,
    project_deal TEXT,
    description TEXT,
    amount NUMERIC,
    cgst NUMERIC,
    sgst NUMERIC,
    total NUMERIC,
    payment_status TEXT DEFAULT 'Pending',
    broker_name TEXT DEFAULT 'Ms Vasu Jain',
    broker_address TEXT,
    broker_email TEXT,
    broker_phone TEXT,
    broker_rera TEXT,
    broker_gstin TEXT,
    bank_name TEXT,
    bank_account TEXT,
    bank_ifsc TEXT,
    bank_account_type TEXT,
    bank_branch TEXT,
    terms TEXT,
    uploaded_file_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  , items TEXT);
CREATE TABLE sops (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      steps TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE communication_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      use_case TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

      `);
    console.log("PostgreSQL tables verified/created successfully.");
    
    // Also seed templates if empty
      const tempCount = (await pool.query("SELECT COUNT(*) FROM communication_templates")).rows[0].count;
      if (parseInt(tempCount) === 0) {
        const insertTemp = async (name, platform, use_case, content) => await pool.query('INSERT INTO communication_templates (name, platform, use_case, content) VALUES ($1, $2, $3, $4)', [name, platform, use_case, content]);

        // 10 WHATSAPP (WA) TEMPLATES
        await insertTemp('WA: 1. New Enquiry Greeting', 'WhatsApp', 'Initial Intro', 'Hello {name},\n\nThis is Vasu Jain from *Subh Homes / Vitrag CRM*. We received your query regarding premium real estate listings.\n\nAre you looking for primary booking or secondary resale? Let me know your preferred layout (e.g. 2BHK/3BHK) so I can curate options!');
        await insertTemp('WA: 2. Schedule Site Visit', 'WhatsApp', 'Lead Nurture', 'Hi {name},\n\nWe have slots open this Saturday for private, chauffeur-driven site tours to *Prestige Lakeside* & *Sobha City*.\n\nWould 11 AM or 3 PM work better for you and your family? Let me know to block it!');
        console.log("Seeded basic templates to Postgres.");
      }
  } catch(err) {
    console.error("PG Init Error:", err);
  }
})();

module.exports = db;
