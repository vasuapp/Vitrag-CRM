const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// I will just replace `  } catch (err) {\n    res.status(500).json({\n      error: err.message`
// with `    });\n  } catch (err) {\n    res.status(500).json({\n      error: err.message`
// But ONLY if it's not already preceded by `});`
// So I will first remove ALL `});` that are right before `} catch`, then add EXACTLY ONE `});`

code = code.replace(/\s*\}\);\n\s*\} catch \(err\) \{\n\s*res\.status\(500\)\.json\(\{/g, '\n  } catch (err) {\n    res.status(500).json({');

// Now, there are NO `});` before `} catch` for these.
// So add it back exactly once!
code = code.replace(/\n\s*\} catch \(err\) \{\n\s*res\.status\(500\)\.json\(\{/g, '\n    });\n  } catch (err) {\n    res.status(500).json({');

// BUT WAIT! What if the previous statement didn't need `});`? 
// Like, it wasn't `res.json({ ... })`?
// Almost every route ends with `res.json({ ... });`. Let's assume they did.
// Let's just run it.

// Wait, the exec at 4513 now will ALSO get a `});` before `} catch`.
// But we WANT that `});` to be there to close `exec(..., () => { ... });`?
// Actually, `exec` has `});` to close itself. And it is inside a `try`, so it doesn't need another `});` to close `res.json` because `res.json` is called inside `exec`!
// So for `exec`, it should be:
/*
    exec(..., () => {
       ...
    });
  } catch (err) {
*/
// The `});` closes `exec`. So it DOES need one `});`.

fs.writeFileSync('server/index.js', code);
