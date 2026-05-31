const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// Find all "await Promise.all(" and count brackets to find the matching '}'
function fixClosing(str) {
  let idx = 0;
  while ((idx = str.indexOf('await Promise.all(', idx)) !== -1) {
    let openCount = 0;
    let foundStart = false;
    let i = idx;
    
    // We are looking for the closing } of the map arrow function, which is followed by )
    for (; i < str.length; i++) {
      if (str[i] === '{') {
        openCount++;
        foundStart = true;
      } else if (str[i] === '}') {
        openCount--;
      }
      
      if (foundStart && openCount === 0) {
        // We found the closing '}'
        // The next chars are usually ');'
        // We need to change it to '}));'
        // Let's look ahead
        const nextChars = str.substring(i, i + 5);
        if (nextChars.includes('});')) {
          str = str.substring(0, i) + '}));' + str.substring(i + 3);
        } else if (nextChars.includes('})')) {
          str = str.substring(0, i) + '}))' + str.substring(i + 2);
        }
        break; // Fixed this one, move to next
      }
    }
    idx += 20; // move past this one
  }
  return str;
}

const fixedCode = fixClosing(code);
fs.writeFileSync('server/index.js', fixedCode);
console.log('Fixed closures');
