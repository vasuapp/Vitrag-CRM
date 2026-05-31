const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const code = fs.readFileSync('server/index.js', 'utf8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx']
});

traverse(ast, {
  CallExpression(path) {
    // Look for map() calls
    if (t.isMemberExpression(path.node.callee) && t.isIdentifier(path.node.callee.property, { name: 'map' })) {
      const callback = path.node.arguments[0];
      
      // If the callback contains await, make it async and wrap the whole map in await Promise.all()
      let hasAwait = false;
      path.traverse({
        AwaitExpression() {
          hasAwait = true;
        }
      });
      
      if (hasAwait && (t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback))) {
        callback.async = true;
        
        // Make sure we haven't already wrapped it in Promise.all
        const parent = path.parentPath.node;
        if (!(t.isCallExpression(parent) && t.isMemberExpression(parent.callee) && t.isIdentifier(parent.callee.property, { name: 'all' }))) {
          path.replaceWith(
            t.awaitExpression(
              t.callExpression(
                t.memberExpression(t.identifier('Promise'), t.identifier('all')),
                [path.node]
              )
            )
          );
        }
      }
    }
  }
});

const output = generate(ast, {}, code);
fs.writeFileSync('server/index.js', output.code);
console.log('Map transforms complete');
