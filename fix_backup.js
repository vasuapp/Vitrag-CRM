const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const backupLogic = `
    const { exec } = require('child_process');
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/realprocrm';
    
    // Replace .db extension with .sql
    const sqlBackupPath = backupPath.replace('.db', '.sql');
    const sqlBackupFilename = backupFilename.replace('.db', '.sql');
    
    exec(\`pg_dump \${dbUrl} > "\${sqlBackupPath}"\`, (error, stdout, stderr) => {
      if (error) {
        console.error("Backup failed", error);
        if (res) return res.status(500).json({ error: "Failed to write database backup: " + error.message });
      }
      console.log(\`[📦 DATABASE BACKUP] Backup successfully created at: \${sqlBackupPath}\`);
      if (res && res.download) {
         res.download(sqlBackupPath, sqlBackupFilename);
      } else if (res && res.json) {
         res.json({ success: true, message: "Backup saved", filename: sqlBackupFilename, path: sqlBackupPath });
      }
    });
`;

code = code.replace(/db\.backup\(backupPath\)\n\s*\.then\(\(\) => \{\n\s*console\.log\(\`\[📦 MANUAL DATABASE BACKUP\] Backup successfully created at: \$\{backupPath\}\`\);\n\s*res\.json\(\{\n\s*success: true,\n\s*message: "Immediate database backup saved successfully!",\n\s*filename: backupFilename,\n\s*path: backupPath\n\s*\}\);\n\s*\}\)\n\s*\.catch\(err => \{\n\s*res\.status\(500\)\.json\(\{ error: "Failed to write database backup: " \+ err\.message \}\);\n\s*\}\);/gs, backupLogic);

code = code.replace(/db\.backup\(backupPath\)\n\s*\.then\(\(\) => \{\n\s*console\.log\(\`\[📦 FULL DATABASE DOWNLOAD\] Backup generated for download at: \$\{backupPath\}\`\);\n\s*res\.download\(backupPath, backupFilename, \(err\) => \{\n\s*if \(err\) console\.error\("Error downloading backup file:", err\);\n\s*\}\);\n\s*\}\)\n\s*\.catch\(err => \{\n\s*res\.status\(500\)\.json\(\{ error: "Failed to write database backup: " \+ err\.message \}\);\n\s*\}\);/gs, backupLogic);

code = code.replace(/db\.backup\(backupPath\)\n\s*\.then\(\(\) => \{\n\s*console\.log\(\`\[📦 AUTOMATED DATABASE BACKUP\] Snapshot saved successfully at: \$\{backupPath\}\`\);\n\s*\}\)\n\s*\.catch\(err => \{\n\s*console\.error\("\[📦 DATABASE AUTO-BACKUP ERROR\]", err\.message\);\n\s*\}\);/gs, `
    const { exec } = require('child_process');
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/realprocrm';
    const sqlBackupPath = backupPath.replace('.db', '.sql');
    exec(\`pg_dump \${dbUrl} > "\${sqlBackupPath}"\`, (error) => {
      if (error) console.error("[📦 DATABASE AUTO-BACKUP ERROR]", error);
      else console.log(\`[📦 AUTOMATED DATABASE BACKUP] Snapshot saved successfully at: \${sqlBackupPath}\`);
    });
`);

fs.writeFileSync('server/index.js', code);
