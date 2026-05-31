const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// The string is exactly `message: \`Successfully imported \${importCount} records into \${table}!\`\n  } catch (err) {`
code = code.replace(/message: \`Successfully imported \$\{importCount\} records into \$\{table\}!\`\n  \} catch \(err\) \{/g, 'message: `Successfully imported ${importCount} records into ${table}!`\n    });\n  } catch (err) {');

fs.writeFileSync('server/index.js', code);
