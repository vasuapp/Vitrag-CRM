const db = require('./server/db.js');

async function test() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayStartStr = todayStart.toISOString();
    console.log("todayStartStr:", todayStartStr);

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

    console.log("Executing leadsQuery...");
    const leads = (await db.query(leadsQuery, [todayStartStr])).rows;
    console.log("Leads count:", leads.length);

    console.log("Executing propsQuery...");
    const properties = (await db.query(propsQuery, [todayStartStr])).rows;
    console.log("Properties count:", properties.length);

    console.log("Executing projsQuery...");
    const projects = (await db.query(projsQuery, [todayStartStr])).rows;
    console.log("Projects count:", projects.length);

    console.log("SUCCESS");
  } catch (err) {
    console.error("ERROR running queries:", err);
  } finally {
    db.pool.end();
  }
}

test();
