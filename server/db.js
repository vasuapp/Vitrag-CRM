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

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

const maxRetries = 10;
const retryDelayMs = 3000;

const dbStatus = {
  initialized: false,
  error: null,
  attempts: 0
};

const initPromise = (async () => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    dbStatus.attempts = attempt;
    try {
      console.log(`Database initialization attempt ${attempt}/${maxRetries}...`);
      await pool.query(`CREATE TABLE IF NOT EXISTS leads (
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
CREATE TABLE IF NOT EXISTS properties (
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
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    sync_status TEXT DEFAULT 'NOT_SYNCED', zone TEXT, onboarded_year TEXT, plot_dimension TEXT, house_facing TEXT, plot_facing TEXT, holder_type TEXT, deleted_at TEXT, admin_comments TEXT, project_id INTEGER, agent_id INTEGER, commission_agreed TEXT, google_map_url TEXT, road_width TEXT, fsi TEXT, closure_site_visit BOOLEAN DEFAULT false, closure_negotiation BOOLEAN DEFAULT false, closure_agreement BOOLEAN DEFAULT false, closure_registration BOOLEAN DEFAULT false, closure_closed BOOLEAN DEFAULT false, closure_buyer_name TEXT, closure_buyer_phone TEXT, closure_deal_value NUMERIC, closure_commission_pct NUMERIC, closure_date TEXT, closure_notes TEXT);
CREATE TABLE IF NOT EXISTS builder_projects (
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
  , brochure_link TEXT, floor_plans TEXT, mother_docs TEXT, assignments TEXT, kyc_docs TEXT, photos TEXT, videos TEXT, cp_agreements TEXT, builder_details TEXT, finance_info TEXT, analytics_info TEXT, zone TEXT, onboarded_year TEXT, proj_id TEXT, google_map_url TEXT, unit_details TEXT, builder_poc_details TEXT, plot_dimension TEXT, plot_size TEXT, house_facing TEXT, plot_facing TEXT, deleted_at TEXT, admin_comments TEXT, custom_data JSONB DEFAULT '{}');
CREATE TABLE IF NOT EXISTS daily_checklist (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    routine_type TEXT NOT NULL,
    is_checked INTEGER DEFAULT 0,
    routine_date TEXT NOT NULL
  );
CREATE TABLE IF NOT EXISTS associates (
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
CREATE TABLE IF NOT EXISTS commissions (
    id SERIAL PRIMARY KEY,
    deal_name TEXT NOT NULL,
    deal_value NUMERIC,
    commission_percentage NUMERIC,
    co_broker_payout NUMERIC,
    billing_invoice TEXT,
    expenses NUMERIC,
    payment_status TEXT DEFAULT 'Pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  , booking_date TEXT, agreement_date TEXT, registration_date TEXT, handover_date TEXT, commission_amount NUMERIC, custom_data JSONB DEFAULT '{}');
CREATE TABLE IF NOT EXISTS todo_tasks (
    id SERIAL PRIMARY KEY,
    task TEXT NOT NULL,
    status TEXT DEFAULT 'Incomplete',
    due_date TEXT
  , priority TEXT DEFAULT 'Medium');
CREATE TABLE IF NOT EXISTS scratchpad (
    id SERIAL PRIMARY KEY,
    content TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS habits (
    id SERIAL PRIMARY KEY,
    habit_name TEXT NOT NULL,
    habit_date TEXT NOT NULL,
    is_done INTEGER DEFAULT 0
  , agent_id INTEGER);
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'ACTIVE',
    location_specialty TEXT,
    leads_assigned INTEGER DEFAULT 0
  , role TEXT DEFAULT 'Agent', login_pin TEXT, allowed_pages TEXT, performance_rating INTEGER DEFAULT 5);
CREATE TABLE IF NOT EXISTS drip_campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    target_leads_status TEXT NOT NULL,
    sequence_data TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );
CREATE TABLE IF NOT EXISTS drip_logs (
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
CREATE TABLE IF NOT EXISTS auto_assignment_settings (
    id SERIAL PRIMARY KEY,
    rule_type TEXT DEFAULT 'ROUND_ROBIN',
    is_active INTEGER DEFAULT 1
  );
CREATE TABLE IF NOT EXISTS telephony_calls (
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
CREATE TABLE IF NOT EXISTS proposals (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE,
    lead_id INTEGER,
    title TEXT,
    intro_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS proposal_items (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER,
    property_id INTEGER,
    agent_comments TEXT
  );
CREATE TABLE IF NOT EXISTS client_messages (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER,
    sender TEXT,
    message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS lead_timeline (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_description TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS lead_scorecards (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER UNIQUE NOT NULL,
    budget INTEGER DEFAULT 3,
    timeline INTEGER DEFAULT 3,
    funding INTEGER DEFAULT 3,
    responsiveness INTEGER DEFAULT 3,
    clarity INTEGER DEFAULT 3,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS attendance_logs (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    agent_name TEXT,
    clock_in TEXT,
    clock_out TEXT,
    attendance_date TEXT NOT NULL
  );
CREATE TABLE IF NOT EXISTS interaction_logs (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL,
    interaction_type TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS sequence_counters (
    category_key TEXT,
    last_value INTEGER DEFAULT 150,
    PRIMARY KEY (category_key)
  );
CREATE TABLE IF NOT EXISTS lead_activities (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE IF NOT EXISTS lead_property_interest (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Interested',
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE IF NOT EXISTS invoices (
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
CREATE TABLE IF NOT EXISTS sops (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      steps TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE IF NOT EXISTS communication_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      use_case TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
      `);
    console.log("PostgreSQL tables verified/created successfully.");
    
    // Seamless migrations for new columns
    try {
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS commission_agreed TEXT;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS google_map_url TEXT;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS road_width TEXT;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS fsi TEXT;');
      
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_site_visit BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_negotiation BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_agreement BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_registration BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_closed BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_buyer_name TEXT;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_buyer_phone TEXT;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_deal_value NUMERIC;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_commission_pct NUMERIC;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_date TEXT;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_notes TEXT;');
      
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_site_visit BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_negotiation BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_agreement BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_registration BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_closed BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_prop_id TEXT;');
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_commission_amt NUMERIC;');
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_notes TEXT;');
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_id INTEGER;');
      
      // Create indexes for properties closure milestones and land parameters
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_closure_site_visit ON properties(closure_site_visit);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_closure_negotiation ON properties(closure_negotiation);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_closure_agreement ON properties(closure_agreement);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_closure_registration ON properties(closure_registration);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_closure_closed ON properties(closure_closed);');
      
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_road_width ON properties(road_width);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_fsi ON properties(fsi);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_zone ON properties(zone);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_plot_dimension ON properties(plot_dimension);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_plot_size ON properties(plot_size);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_plot_facing ON properties(plot_facing);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_google_map_url ON properties(google_map_url);');

      // Create indexes for leads closure milestones
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_closure_site_visit ON leads(closure_site_visit);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_closure_negotiation ON leads(closure_negotiation);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_closure_agreement ON leads(closure_agreement);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_closure_registration ON leads(closure_registration);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_closure_closed ON leads(closure_closed);');
      
      // New Associate linkage and Joint visit migrations
      await pool.query('ALTER TABLE commissions ADD COLUMN IF NOT EXISTS associate_id INTEGER;');
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_joint_visit BOOLEAN DEFAULT false;');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS closure_joint_visit BOOLEAN DEFAULT false;');
      await pool.query(`CREATE TABLE IF NOT EXISTS associate_shares (
        id SERIAL PRIMARY KEY,
        associate_id INTEGER NOT NULL,
        property_id INTEGER NOT NULL,
        shared_at TEXT DEFAULT CURRENT_TIMESTAMP,
        shared_by TEXT
      );`);

      // 10 Features Extensions Migration
      await pool.query('ALTER TABLE commissions ADD COLUMN IF NOT EXISTS lead_id INTEGER;');
      await pool.query('ALTER TABLE commissions ADD COLUMN IF NOT EXISTS property_id INTEGER;');
      await pool.query(`CREATE TABLE IF NOT EXISTS document_vault (
        id SERIAL PRIMARY KEY,
        doc_name TEXT NOT NULL,
        doc_url TEXT NOT NULL,
        reference_type TEXT NOT NULL,
        reference_id INTEGER NOT NULL,
        reference_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        uploaded_by TEXT
      );`);

      // New migrations for persistent branding, lead ID custom formats, and duplicate reviews
      await pool.query(`CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`);
      
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_lead_id TEXT;');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_custom_lead_id ON leads(custom_lead_id);');

      await pool.query(`CREATE TABLE IF NOT EXISTS duplicate_leads_audit (
        id SERIAL PRIMARY KEY,
        lead_name TEXT,
        phone TEXT,
        email TEXT,
        source TEXT,
        existing_lead_id INTEGER,
        existing_lead_name TEXT,
        detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        action_taken TEXT DEFAULT 'Pending Review'
      );`);

      // Performance Optimization Indexes
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at) WHERE deleted_at IS NULL;');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_deleted_at ON properties(deleted_at) WHERE deleted_at IS NULL;');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_interaction_logs_lead_id ON interaction_logs(lead_id);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_telephony_calls_lead_id ON telephony_calls(lead_id);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_proposals_lead_id ON proposals(lead_id);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_lead_timeline_lead_id ON lead_timeline(lead_id);');

      // Additional high-impact indexes for common query patterns
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status) WHERE deleted_at IS NULL;');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup) WHERE deleted_at IS NULL AND next_followup IS NOT NULL;');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_agent_deleted ON leads(agent_id, deleted_at);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_properties_agent_deleted ON properties(agent_id, deleted_at);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_interaction_logs_type ON interaction_logs(interaction_type);');

      // Dynamic Forms & Tables Schema Migrations
      await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT \'{}\';');
      await pool.query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT \'{}\';');
      await pool.query('ALTER TABLE builder_projects ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT \'{}\';');
      await pool.query('ALTER TABLE commissions ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT \'{}\';');

      await pool.query(`CREATE TABLE IF NOT EXISTS custom_forms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        module_type TEXT NOT NULL,
        sections JSONB DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`);

      await pool.query(`CREATE TABLE IF NOT EXISTS custom_tables (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        fields JSONB DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`);

      await pool.query(`CREATE TABLE IF NOT EXISTS custom_table_rows (
        id SERIAL PRIMARY KEY,
        table_id INTEGER REFERENCES custom_tables(id) ON DELETE CASCADE,
        data JSONB DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`);

      await pool.query(`CREATE TABLE IF NOT EXISTS custom_workflows (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        module_type TEXT NOT NULL,
        trigger_event TEXT NOT NULL,
        trigger_conditions JSONB DEFAULT '{}',
        action_type TEXT NOT NULL,
        action_config JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`);

      console.log("Migration: Added new columns and indexes to properties and leads tables successfully.");
    } catch (migErr) {
      console.log("Migration skipped or failed:", migErr.message);
    }
    
    // Seed default admin agent if empty
    try {
      const agentCountResult = await pool.query("SELECT COUNT(*) FROM agents");
      const agentCount = agentCountResult.rows[0].count;
      if (parseInt(agentCount) === 0) {
        await pool.query(`
          INSERT INTO agents (name, email, phone, status, location_specialty, role, login_pin, allowed_pages)
          VALUES ('Vasu Jain', 'info@subhhomes.com', '+91 98200 12345', 'ACTIVE', 'All Zones', 'Admin', '0000', '*')
        `);
        console.log("Seeded default admin agent 'Vasu Jain' with PIN '0000'.");
      }
    } catch (agentSeedErr) {
      console.log("Agent seeding skipped or failed:", agentSeedErr.message);
    }

    // Also seed templates if empty
    try {
      const hasOldTemp = (await pool.query("SELECT COUNT(*) FROM communication_templates WHERE name = 'Script: 1. New Enquiry Opening'")).rows[0].count;
      if (parseInt(hasOldTemp) > 0) {
        await pool.query("DELETE FROM communication_templates");
        console.log("Upgraded old communication templates table.");
      }
    } catch(tempCheckErr) {
      console.log("Check for old templates skipped:", tempCheckErr.message);
    }

      const tempCount = (await pool.query("SELECT COUNT(*) FROM communication_templates")).rows[0].count;
      if (parseInt(tempCount) === 0) {
        const insertTemp = async (name, platform, use_case, content) => await pool.query('INSERT INTO communication_templates (name, platform, use_case, content) VALUES ($1, $2, $3, $4)', [name, platform, use_case, content]);

        // Calling Scripts (4 templates)
        await insertTemp('Script: 1. Cold Resale Pitch to Owner', 'Script', 'Resale Mandate Acquisition', 'Good [morning/afternoon] {name}, this is [Agent Name] from Vitrag Premium Real Estate Advisory.\n\nI am calling because I noticed your listing for resale at {Location}. I represent several vetted buyers and corporate clients currently looking for premium configurations in this exact micro-market. Our database shows a high demand for units with your layout.\n\nAre you open to listing your property exclusively with us? We handle end-to-end buyer screening, documentation, and biometric registration. When would be a convenient time for me to visit the property for a brief 10-minute valuation and photo shoot?');
        await insertTemp('Script: 2. Inbound Lead Qualification', 'Script', 'Initial Call profiling', 'Hello {name}, thank you for registering your interest in our premium projects in [Location]. This is [Agent Name] from Vitrag Advisory.\n\nTo help me curate the most suitable luxury configurations, could you share a few details:\n1. Are you looking for a self-use home or a high-yield investment?\n2. What is your preferred layout: 2 BHK, 3 BHK, or a penthouse/villa?\n3. Do you have a flexible budget range, say between ₹1.5 Cr to ₹3 Cr, or are you looking at a specific pocket?\n\nThis will allow me to shortlist the top 3 options and share detailed brochures right away.');
        await insertTemp('Script: 3. Post-Visit Objection Handler', 'Script', 'Objection Resolution & Next Step', 'Hi {name}, this is [Agent Name] from Vitrag CRM. I wanted to follow up on our private site tour of Prestige Lakeside yesterday.\n\nI completely understand that the pricing of ₹2.2 Cr felt slightly above the initial target. However, let\'s look at the parameters:\n• The carpet efficiency is 82%, which is 10% higher than surrounding projects.\n• The builder is offering a limited-time subvention plan where you pay only 10% now and nothing until possession.\n• Similar units in this zone saw a 14% capital appreciation last year alone.\n\nWould you like me to schedule a brief meeting with the developer POC this weekend to discuss a structured payment plan?');
        await insertTemp('Script: 4. Face-to-Face Closing Deal', 'Script', 'Price Negotiation & MoU', 'Hello {name}, I am pleased to inform you that the seller of {Property} has agreed to our negotiated base value of ₹1.85 Cr, subject to completing the agreement details by this Friday.\n\nTo lock this in and prevent other enquiries, we need to execute a standard MoU. This involves:\n1. A refundable token check of 5% of the deal value.\n2. Exchanging KYC documents (PAN, Aadhaar) for registry clearance.\n\nI can set up a joint meeting at our luxury boardroom tomorrow at 4 PM to finalize the signatures. Does that work for you?');

        // WhatsApp Templates (3 templates)
        await insertTemp('WA: 1. Welcome & Digital Brochure', 'WhatsApp', 'Initial Lead Touchpoint', 'Hello {name},\n\nThis is Vasu Jain from *Subh Homes / Vitrag CRM*. Thank you for contacting us regarding luxury properties in [Location].\n\nI have attached our *Premium Real Estate Catalog* and RERA registration documents below. \n\nAre you looking for primary booking or secondary resale? Please share your preferred layout (e.g. 2BHK/3BHK) so I can curate options!\n\n_Vasu Jain | Vitrag Advisory_ 📱');
        await insertTemp('WA: 2. Site Visit Logistics Agenda', 'WhatsApp', 'Tour Coordination', 'Hi {name},\n\nHere is the confirmed agenda for your private site tour tomorrow:\n\n🚗 *Vehicle Details:* Chauffeur-driven sedan ([Driver Name] · [Phone]) will arrive at your location at 10:00 AM.\n📍 *Schedule:* \n• 10:45 AM: *Prestige Shantiniketan* (3BHK Resale)\n• 12:00 PM: *Sobha Royal Pavilion* (3BHK Brand New)\n• 1:30 PM: Boardroom discussion & coffee at Vitrag Office.\n\n*Important:* Please carry a photo ID for community security clearance. See you tomorrow!');
        await insertTemp('WA: 3. Post-Tour Feedback Request', 'WhatsApp', 'Follow-up & Review', 'Hi {name}, thank you for touring *{Property}* with us today! 🏠\n\nHere is a quick recap of the property parameters:\n📍 Location: {Location}\n📐 Layout: {Config} | Super Built Area: {Area} sqft\n💰 Pricing: ₹{Price}\n🔑 Possession: {Possession}\n\nOn a scale of 1-10, how closely does this match your family\'s expectations? Let me know to shortlist or search alternative options.\n\n_Vasu Jain | Subh Homes_ 📱');

        // Email Templates (3 templates)
        await insertTemp('Email: 1. Curated Luxury Hotlist', 'Email', 'Shortlist Dispatch', 'Subject: Curated Luxury Shortlist — {Location} | Vitrag Advisory\n\nDear {name},\n\nThank you for sharing your requirements. Based on your preferences, I have handpicked and personally verified the following three premium options:\n\n1. Prestige Shantiniketan — {Config}, {Area} sqft — ₹{Price}\n   • USP: High-floor, park-facing, semi-furnished resale with immediate registry.\n2. Sobha Royal Pavilion — {Config}, {Area} sqft — ₹{Price}\n   • USP: Brand new luxury tower with Mivan construction and 80% green area.\n3. Prestige Lakeside Habitat — {Config}, {Area} sqft — ₹{Price}\n   • USP: Premium gated villa community with low maintenance and private deck.\n\nI have attached the floor plans and layout maps for each unit. I would love to arrange a private viewing at your convenience.\n\nWarm regards,\nVasu Jain\nVitrag Real Estate Advisory\n📱 +91 99454 03202');
        await insertTemp('Email: 2. High-Yield Investment Analysis', 'Email', 'ROI Justification', 'Subject: High-Yield Real Estate Investment Case — {Location} | Subh Homes\n\nDear {name},\n\nFollowing our discussion regarding real estate asset allocation, here is the financial breakdown for the commercial/residential units at {Project}:\n\n📊 *Financial Metrics Summary:*\n• Acquisition Value: ₹{Price}\n• Monthly Rental Yield: ₹{Rent}/month (expected yield: ~6.2% per annum)\n• Historical Micro-Market Capital Appreciation: 12.5% YoY\n• Net Cash Flow: Positive from Day 1 post-maintenance deduction.\n\n🏗️ *Growth Drivers:*\n• Located within 500 meters of the upcoming Metro station.\n• Proximity to major IT parks ensures zero vacancy rates.\n• Reputed developer with high maintenance standards protecting capital value.\n\nLet me know if you would like me to schedule a call with our mortgage partner to model the loan-to-value (LTV) options.\n\nBest regards,\nVasu Jain | Subh Homes');
        await insertTemp('Email: 3. MoU Checkpoints & Closing Details', 'Email', 'Transaction Onboarding', 'Subject: MoU Execution Checklist — {Property} | Vitrag CRM\n\nDear {name},\n\nCongratulations on finalizing your purchase of {Property}! To ensure a smooth, error-free transaction, here are the next operational steps:\n\n1. *MoU Vetting:* We will share the draft Memorandum of Understanding by tomorrow 11 AM.\n2. *Token Payment:* Please prepare a token transfer of 10% of the deal value.\n3. *KYC Submission:* Please upload the following to our secure Document Vault:\n   • PAN Card & Aadhaar Card (Buyer and Seller)\n   • Pre-approval loan sanction letter (if applicable)\n   • Passport-size photos\n4. *Title Verification:* Our legal counsel is currently verifying original deeds, tax receipts, and encumbrance certificates.\n\nIf you have any questions, please reach out directly.\n\nWarmly,\nVasu Jain\nVitrag Real Estate Advisory');

        console.log("Seeded 10 communication templates (4 Script, 3 WhatsApp, 3 Email) to Postgres.");
      }

      // Seed default SOPs if empty
      const sopCountResult = await pool.query("SELECT COUNT(*) FROM sops");
      const sopCount = sopCountResult.rows[0].count;
      if (parseInt(sopCount) === 0) {
        await seedDefaultSops(pool);
        console.log("Seeded 15 detailed standard SOP real estate procedures successfully.");
      }
      console.log("PostgreSQL database successfully initialized and migrated.");
      dbStatus.initialized = true;
      return;
    } catch (err) {
      console.error(`Database initialization attempt ${attempt} failed:`, err.message);
      dbStatus.error = err.message;
      if (attempt === maxRetries) {
        console.error("FATAL ERROR: Failed to initialize PostgreSQL after max retries. Exiting...");
        process.exit(1);
      }
      console.log(`Retrying database initialization in ${retryDelayMs / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
})();

const seedDefaultSops = async (pool) => {
  // Clear any existing default SOPs or clear the table
  await pool.query("DELETE FROM sops");
  
  const insertSop = async (title, steps) => {
    await pool.query("INSERT INTO sops (title, steps) VALUES ($1, $2)", [title, JSON.stringify(steps)]);
  };

  await insertSop('SOP 01: Lead Capture & Source Tagging', [
    'Query the CRM database via search by phone number or email to ensure the lead is not an existing prospect assigned to another agent, avoiding duplicate file registration.',
    'Extract standard portal parameters (Name, Contact, Query, Budget) from incoming API payloads (99acres, Magicbricks, Facebook Lead Ads, or Website forms).',
    'Set lead source tag dynamically: portal-inbound, direct-call, organic-web, developer-referral, or broker-co-op to enable accurate marketing ROI reporting.',
    'Systematically assign the lead to the roster-active agent on duty based on the dynamic round-robin routing protocol.',
    'Log a baseline Lead Score of 15 points in the system registry, indicating auto-capture completion, and send an instant WhatsApp/SMS notification to the assigned advisor.'
  ]);

  await insertSop('SOP 02: Prospecting Cadence (Digital + Referral)', [
    'Execute the initial outbound call within a strict 15-minute SLA window for all digital inbound leads during business hours (9 AM - 7 PM).',
    'If the lead does not answer, trigger "Touchpoint 1" via WhatsApp, dispatching a co-branded introduction card, company credentials presentation, and a calendar slot link.',
    'Implement the 5-touchpoint dialing rhythm: Day 1 (Call + WhatsApp), Day 2 (Afternoon Call), Day 4 (Morning Follow-up), Day 7 (Value-Add Listing PDF), Day 10 (Final Re-engagement Check).',
    'For referral leads, contact the referring party first to gather background insights, and initiate contact with the prospect using a warm introduction mentioning the referrer.',
    'If no response is received by Day 12, mark the lead status as "Idle/Cold" and move it to the re-engagement bucket for quarterly email newsletter broadcasts.'
  ]);

  await insertSop('SOP 03: Lead Qualification Script (Residential)', [
    'Open the call with the standard greeting: "Good morning/afternoon, this is [Agent Name] from Vitrag Real Estate Advisory. I\'m calling regarding your interest in..."',
    'Confirm critical configuration criteria: BHK type (1/2/3/4 BHK), structural layout preference (penthouse, villa, high-rise apartment), and carpet area vs super built-up area (SBA) expectation.',
    'Determine location scope: identify preferred micro-markets, proximity requirements to work/schools, and threshold tolerance for daily transit.',
    'Qualify financial parameters: ask if they have a pre-approved home loan, their funding split (self-funded vs loan ratio), and their absolute maximum budget cap including stamp duty.',
    'Gauge timeline urgency: categorize readiness to close (Immediate 0-30 days, Active 30-90 days, Nurture 90+ days), and log all qualified parameters into the Lead Profile card.'
  ]);

  await insertSop('SOP 04: Corporate Mandate Intake (Commercial)', [
    'Receive corporate enquiry and verify the legal entity registration name, industry vertical, and corporate GSTIN credentials.',
    'Establish the specific leasing mandate requirements: warm shell vs fully furnished space, seat count requirements, server room parameters, and dedicated parking allocations.',
    'Document zoning laws: ensure the target corporate requirement conforms to local commercial zoning rules, IT/ITES compliance, and fire safety (OC) mandates.',
    'Discuss commercial lease parameters: average lease tenure (3/5/9 years), lock-in period expectations, security deposit limits (typically 6-10 months), and annual escalation escalators.',
    'Issue a formal Corporate Mandate Agreement to the client representative, get it signed by authorized signatories, and log it in the Commercial Mandates Vault.'
  ]);

  await insertSop('SOP 05: Residential Inventory Matching Protocol', [
    'Query the CRM inventory database matching qualified lead parameters (BHK, price range, micro-market locality).',
    'Check secondary resale listings and run seller verification: verify original allotment letters, title chain continuity, and confirm active selling intent.',
    'Query the primary Developer Projects ledger to identify configurations offering active buyer incentives or subvention plans.',
    'Select the top 3 best-fit options; redact direct seller/developer POC phone numbers from the client-facing presentation to prevent co-broke disintermediation.',
    'Compile matched listings into a co-branded, high-quality digital catalog PDF and send it to the client with a customized invitation for physical preview tours.'
  ]);

  await insertSop('SOP 06: Commercial Inventory Curation (3-Option Rule)', [
    'Analyze the corporate commercial requirement, filtering properties strictly by IT/ITES or commercial zoning clearances.',
    'Curate exactly 3 highly optimized options: Option A (Direct fit/budget match), Option B (Slightly larger space/higher yield option), Option C (Budget/value alternative option).',
    'Run comprehensive commercial metrics: calculate efficiency ratios (carpet-to-SBA ratio), monthly CAM charges (Common Area Maintenance), and power back-up capacities.',
    'Verify building parameters: check elevator capacity, occupancy certifications (OC), fire department approvals, and parking slot ratios per 1000 sqft.',
    'Present the curated 3-Option comparison grid to the corporate acquisition committee, setting clear pros and cons for each property location.'
  ]);

  await insertSop('SOP 07: Site Visit Protocol & Follow-Up Playbook', [
    'Coordinate scheduling: confirm the visit date/time with the client, developer representative, or individual seller, allowing a 45-minute tour window per property.',
    'Dispatch the chauffeur-driven corporate vehicle to pick up the client, sending the driver details and car number via the WhatsApp Site Visit Confirmation template.',
    'Conduct the walkthrough professionally: highlight community layout, Mivan construction durability, RERA approvals, local social infrastructure, and possession timelines.',
    'Execute "Post-Visit Debrief": capture client immediate feedback (likes/dislikes, layout preferences) in the car immediately following the tour.',
    'Run the Follow-Up sequence: send a site tour summary PDF within 4 hours, make a feedback call on Day 2, and pitch property comparisons on Day 5 to sustain client momentum.'
  ]);

  await insertSop('SOP 08: Negotiation Playbook', [
    'Collect written, formal offers from the buyer stating their proposed price, payment schedule, and target closing date.',
    'Conduct seller vetting: discuss the buyer\'s offer details, gauge seller flexibility, and highlight the buyer\'s financial readiness (e.g. self-funded or pre-approved loan).',
    'Schedule a face-to-face negotiation meeting at the Vitrag CRM conference room to bridge price differences in real-time, acting as a neutral advisor.',
    'Break down price structures: isolate the base unit price from secondary charges (parking, amenities, club membership, corpus fund) to find negotiation leverage.',
    'Lock in the final negotiated terms, write down the consensus points, and obtain signature clearances from both parties on a formal Negotiation Sheet.'
  ]);

  await insertSop('SOP 09: LOI / Token / Offer Letter Drafting', [
    'Draft the formal Letter of Intent (LOI) or Offer Letter detailing the final price, transaction timeline, and payment schedules.',
    'Incorporate critical protection clauses: token deposit refund conditions in case of legal title defects, default consequences, and registration deadlines.',
    'Facilitate the escrow token payment (typically 2-5% of deal value), ensuring the cheque or online transfer is documented with receipts.',
    'Send the draft LOI to the buyer and seller legal counsels for final review, alignment, and signature execution.',
    'Log the signed LOI in the CRM Document Vault, change the listing status to "Under Agreement (UA)", and trigger title vetting.'
  ]);

  await insertSop('SOP 10: Agreement Drafting & Legal Checklist', [
    'Collect all original property documents: allotment letters, possession certificates, sale agreements, tax receipts, and building plans.',
    'Appoint a certified legal counsel to run a search at the Sub-Registrar Office (SRO) for the last 13-30 years to verify title history and clear ownership.',
    'Obtain a certified Encumbrance Certificate (EC) confirming no active bank mortgages or legal disputes exist on the property.',
    'Draft the formal Sale Agreement or Lease Agreement, ensuring all legal clauses, penalty charges, and payment dates are detailed.',
    'Deliver the final draft agreement to both parties, schedule the signing date, and archive the legal clearance certificate in the CRM vault.'
  ]);

  await insertSop('SOP 11: RERA & Compliance Documentation', [
    'Search the state RERA portal to verify the developer project registration number, active status, and litigation history.',
    'Check the builder\'s quarterly compliance reports on construction progress, fund allocation, and completion timelines.',
    'Obtain and verify municipal approvals: building plan approvals, environmental clearances, and the final Occupancy Certificate (OC).',
    'Collect and verify the client\'s tax compliance details (TDS certificate showing 1% tax deduction on properties above ₹50 Lakhs).',
    'Log all compliance certificates, RERA printouts, and tax documents in the CRM Audit Panel to ensure regulatory readiness.'
  ]);

  await insertSop('SOP 12: Deal Closure & Brokerage Invoice Protocol', [
    'Confirm the final execution of the Sale Deed or Lease Agreement at the Sub-Registrar Office, ensuring registration is complete.',
    'Mark the property status as "SOLD/RENTED" and update the lead profile status to "Converted (Won)" in the CRM.',
    'Calculate the advisory brokerage fee: typically 1-2% for sale transactions or 1-month rent for leasing mandates, adding standard GST (18%).',
    'Generate a professional, co-branded invoice containing banking details, PAN, GSTIN, and corporate remittance instructions.',
    'Deliver the invoice via email to the client, track the payment status in the Commissions Ledger, and log co-broker splits.'
  ]);

  await insertSop('SOP 13: Client Retention & Referral Engine', [
    'Deliver a physical "Welcome Kit" to the client within 3 days of registration, containing deed copies, society contacts, keychains, and a gift box.',
    'Assist with utility transfers: facilitate electricity connection name transfer (e.g. BESCOM), water connection, and local association registry setup.',
    'Share verified partners for home renovation, interiors, and moving services, acting as a resource for their move.',
    'Send automated anniversary greetings (home purchase date) and holiday wishes via WhatsApp/Email to maintain top-of-mind recall.',
    'Trigger the Referral Engine: contact the client at Day 90 post-move to ask for referrals and request a Google Review testimonial.'
  ]);

  await insertSop('SOP 14: Daily & Weekly Reporting Protocol', [
    'Ensure all active sales agents execute a "Daily Clock-In" by 9:30 AM on the CRM attendance portal to signal shift start.',
    'Update daily contact logs: record all outbound calls, follow-up callbacks, site visits, and negotiation stages by 6:30 PM.',
    'Submit the Daily Sales Report (DSR) summarizing new enquiries qualified, meetings scheduled, and revenue booked.',
    'Compile the Weekly Pipeline Report every Friday, detailing active deal slippage, hot prospect warm-up ratios, and team conversions.',
    'Admin reviews DSR logs weekly, maps conversions against KPI metrics, and exports monthly performance charts to CSV.'
  ]);

  await insertSop('SOP 15: Inventory & Pipeline Hygiene', [
    'Review active resale and rental inventory every Friday, contacting sellers to confirm property availability and verify pricing.',
    'Run pipeline cleanup: move stale leads (no contact in 30 days) to the "Nurture" bucket, freeing up hot routing queues.',
    'Audit property listings: update details, replace placeholder images with high-resolution photos, and check geo-coordinates.',
    'Reconcile financial records: check for pending brokerage payments, follow up on overdue client invoices, and register splits.',
    'Back up the PostgreSQL database weekly to secure storage, archiving old transactional data to maintain system speed.'
  ]);
};

const db = {
  query: async (text, params) => {
    if (!dbStatus.initialized) {
      if (dbStatus.error) {
        throw new Error(`Database connection not ready. Last error: ${dbStatus.error}`);
      }
      // Wait for it with a timeout of 4 seconds
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database initialization timeout")), 4000));
      await Promise.race([initPromise, timeoutPromise]);
    }
    let actualParams = params || [];
    if (!Array.isArray(actualParams)) {
      actualParams = [actualParams];
    } else if (actualParams.length === 1 && Array.isArray(actualParams[0])) {
      actualParams = actualParams[0];
    }
    let counter = 1;
    const pgText = text.replace(/\?/g, () => '$' + (counter++));
    return pool.query(pgText, actualParams);
  },
  pool: pool,
  initPromise: initPromise,
  dbStatus: dbStatus,
  resetSopsToDefaults: () => seedDefaultSops(pool)
};

module.exports = db;
