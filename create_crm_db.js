const { Client } = require('pg');

async function createDb() {
  const client = new Client({ connectionString: "postgres://postgres:root@localhost:5432/postgres" });
  try {
    await client.connect();
    // Check if CRM db already exists
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'CRM'");
    if (res.rows.length === 0) {
      await client.query('CREATE DATABASE "CRM"');
      console.log('Database "CRM" created successfully.');
    } else {
      console.log('Database "CRM" already exists.');
    }
  } catch (err) {
    console.error("Error creating database:", err);
  } finally {
    await client.end();
  }
}

createDb();
