const { Pool } = require('pg');

const passwords = ["postgres", "root", "123456", "password", "subh", "subhhomes", "vitrag", "admin", ""];
const users = ["postgres", "vasujain1"];
const dbs = ["CRM", "postgres"];

async function probe() {
  for (const dbName of dbs) {
    for (const user of users) {
      for (const pwd of passwords) {
        const url = pwd ? `postgres://${user}:${pwd}@localhost:5432/${dbName}` : `postgres://${user}@localhost:5432/${dbName}`;
        const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 1000 });
        try {
          const res = await pool.query('SELECT NOW()');
          console.log(`SUCCESS! URL:`, url);
          pool.end();
          return;
        } catch (err) {
          // ignore
        }
        pool.end();
      }
    }
  }
  console.log("All connection attempts failed.");
}

probe();
