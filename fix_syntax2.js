const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// I will find `message: \`Successfully imported \${importCount} records into \${table}!\`\n  } catch (err) {`
// and replace it with `message: \`Successfully imported \${importCount} records into \${table}!\`\n    });\n  } catch (err) {`
code = code.replace(/message: \`Successfully imported \$\{importCount\} records into \$\{table\}!\`\n  \} catch \(err\) \{/, 'message: `Successfully imported ${importCount} records into ${table}!`\n    });\n  } catch (err) {');

fs.writeFileSync('server/index.js', code);
