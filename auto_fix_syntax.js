const { execSync } = require('child_process');
const fs = require('fs');

let i = 0;
while (i < 150) {
  try {
    execSync('node -c server/index.js', { stdio: 'pipe' });
    console.log('Syntax is clean!');
    break;
  } catch (err) {
    const output = err.stderr.toString() + err.stdout.toString() || err.message;
    const match = output.match(/server\/index\.js:(\d+)/);
    if (match) {
      const lineNum = parseInt(match[1]);
      let lines = fs.readFileSync('server/index.js', 'utf8').split('\n');
      
      // If the error is 'Missing catch or finally after try', the '});' is usually on the line indicated or the line before
      // We will check lineNum-1, lineNum, lineNum-2 to find '});' and remove it.
      let removed = false;
      for (let offset = 0; offset >= -2; offset--) {
        const l = lineNum - 1 + offset;
        if (lines[l] && lines[l].trim() === '});') {
          lines[l] = ''; // Remove it
          removed = true;
          break;
        }
      }
      
      if (!removed) {
        console.error('Could not find }); to remove around line ' + lineNum);
        console.error(output);
        break;
      }
      
      fs.writeFileSync('server/index.js', lines.join('\n'));
    } else {
      console.error('Could not parse line number from error');
      console.error(output);
      break;
    }
  }
  i++;
}
