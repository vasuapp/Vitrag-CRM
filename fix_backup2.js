const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const execLogic = `
    const { exec } = require('child_process');
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/realprocrm';
    const sqlBackupPath = backupPath.replace('.db', '.sql');
    const sqlBackupFilename = backupFilename.replace('.db', '.sql');
    exec(\`pg_dump \${dbUrl} > "\${sqlBackupPath}"\`, (error) => {
      if (error) {
        if (typeof res !== 'undefined' && res.status) res.status(500).json({ error: error.message });
        else console.error("Backup failed", error);
        return;
      }
      console.log(\`Backup successfully created at: \${sqlBackupPath}\`);
      if (typeof res !== 'undefined') {
         if (res.download) res.download(sqlBackupPath, sqlBackupFilename);
         else if (res.json) res.json({ success: true, filename: sqlBackupFilename, path: sqlBackupPath });
      }
    });
`;

code = code.replace(/db\.backup\(backupPath\)\.then\(\(\) => \{[\s\S]*?\}\)\.catch\(err => \{[\s\S]*?\}\);/g, execLogic);

fs.writeFileSync('server/index.js', code);
