const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// Fix PRAGMA table_info
code = code.replace(/await db\.query\(\`PRAGMA table_info\(\$\{table\}\)\`\)/g, "await db.query(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = '${table}'`)");

// Fix db.transaction(records => { ... })
// It looks like:
/*
    const transaction = db.transaction(records => {
      for (const record of records) {
        insertStmt.run(record);
      }
    });
...
    transaction(insertRows);
*/
// I will replace transaction(insertRows); with our custom async begin/commit logic.
// Then remove the original definition.

code = code.replace(/const transaction = db\.transaction\(records => \{\n\s*for \(const record of records\) \{\n\s*insertStmt\.run\(record\);\n\s*\}\n\s*\}\);/g, "");
code = code.replace(/transaction\(insertRows\);/g, `
    try {
      await db.query('BEGIN');
      for (const record of insertRows) {
        await insertStmt.run(record);
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
`);

// The second transaction:
/*
    const transaction = db.transaction(records => {
      for (const recordObj of records) {
        const record = dbCols.map(col => {
          let val = recordObj[col];
          if (val === undefined || val === null) return '';
          return val;
        });
        insertStmt.run(record);
        importCount++;
      }
    });
    transaction(data);
*/
code = code.replace(/const transaction = db\.transaction\(records => \{\n\s*for \(const recordObj of records\) \{\n\s*const record = dbCols\.map\(col => \{\n\s*let val = recordObj\[col\];\n\s*if \(val === undefined \|\| val === null\) return '';\n\s*return val;\n\s*\}\);\n\s*insertStmt\.run\(record\);\n\s*importCount\+\+;\n\s*\}\n\s*\}\);\n\s*transaction\(data\);/g, `
    try {
      await db.query('BEGIN');
      for (const recordObj of data) {
        const record = dbCols.map(col => {
          let val = recordObj[col];
          if (val === undefined || val === null) return '';
          return val;
        });
        await insertStmt.run(record);
        importCount++;
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
`);

fs.writeFileSync('server/index.js', code);
