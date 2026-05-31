const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// I will just replace the redundant `});` before `} catch (err)` around line 4513
// I can just find `    });\n  } catch (err) {\n    res.status(500).json({\n      error: err.message\n    });\n  }\n});`
// and remove the extra `    });\n`
code = code.replace(/    \}\);\n\n    \}\);\n  \} catch \(err\) \{\n    res\.status\(500\)\.json\(\{/g, '    }\n  } catch (err) {\n    res.status(500).json({');

// Wait, the formatting might be slightly different. Let's use a simpler regex
code = code.replace(/\s*\}\);\n\s*\} catch \(err\) \{\n\s*res\.status\(500\)\.json\(\{/g, '\n  } catch (err) {\n    res.status(500).json({');

fs.writeFileSync('server/index.js', code);
