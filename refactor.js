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

// Function to replace '?' with '$1', '$2', etc. in a SQL string
function convertSql(sql) {
  let counter = 1;
  return sql.replace(/\?/g, () => `$${counter++}`);
}

traverse(ast, {
  // 1. Make Express route handlers async if they contain db operations
  CallExpression(path) {
    const callee = path.node.callee;
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.object, { name: 'app' })) {
      const args = path.node.arguments;
      const callback = args.find(arg => t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg));
      
      if (callback) {
        // We just make all route callbacks async to be safe
        callback.async = true;
      }
    }

    // 2. Transform db.prepare(...).run/get/all
    if (t.isMemberExpression(callee)) {
      const method = callee.property.name;
      if (['get', 'all', 'run'].includes(method)) {
        const prepareCall = callee.object;
        if (t.isCallExpression(prepareCall) && t.isMemberExpression(prepareCall.callee) && 
            t.isIdentifier(prepareCall.callee.object, { name: 'db' }) && 
            t.isIdentifier(prepareCall.callee.property, { name: 'prepare' })) {
          
          let sqlNode = prepareCall.arguments[0];
          
          if (t.isStringLiteral(sqlNode)) {
             sqlNode.value = convertSql(sqlNode.value);
             // If it's a run on an INSERT, append RETURNING id
             if (method === 'run' && sqlNode.value.trim().toUpperCase().startsWith('INSERT')) {
               sqlNode.value += ' RETURNING id';
             }
          } else if (t.isTemplateLiteral(sqlNode)) {
             let counter = 1;
             for (let i = 0; i < sqlNode.quasis.length; i++) {
                 sqlNode.quasis[i].value.raw = sqlNode.quasis[i].value.raw.replace(/\?/g, () => `$${counter++}`);
                 sqlNode.quasis[i].value.cooked = sqlNode.quasis[i].value.cooked.replace(/\?/g, () => `$${counter++}`);
             }
             if (method === 'run' && sqlNode.quasis[0].value.raw.trim().toUpperCase().startsWith('INSERT')) {
                const last = sqlNode.quasis[sqlNode.quasis.length - 1];
                last.value.raw += ' RETURNING id';
                last.value.cooked += ' RETURNING id';
             }
          }

          const args = path.node.arguments; // arguments to get/all/run
          
          // Create `await db.query(SQL, [args])`
          const queryArgs = [sqlNode];
          if (args.length > 0) {
            queryArgs.push(t.arrayExpression(args));
          }
          
          let replacement = t.awaitExpression(
            t.callExpression(
              t.memberExpression(t.identifier('db'), t.identifier('query')),
              queryArgs
            )
          );
          
          // Wrap based on method
          if (method === 'get') {
            // (await ...).rows[0]
            replacement = t.memberExpression(
              t.memberExpression(replacement, t.identifier('rows')),
              t.numericLiteral(0),
              true
            );
          } else if (method === 'all') {
            // (await ...).rows
            replacement = t.memberExpression(replacement, t.identifier('rows'));
          } else if (method === 'run') {
            // Let's create an IIFE-like or just wait for it and mock lastInsertRowid
            // Actually, we can replace it with an await, and for assignments `const info = ...` we rewrite it later,
            // OR we wrap it in a helper function:
            // (await (async () => { const r = await db.query(...); return { lastInsertRowid: r.rows[0]?.id, changes: r.rowCount }; })())
            
            const asyncIife = t.callExpression(
              t.arrowFunctionExpression(
                [],
                t.blockStatement([
                  t.variableDeclaration('const', [
                    t.variableDeclarator(
                      t.identifier('r'),
                      replacement
                    )
                  ]),
                  t.returnStatement(
                    t.objectExpression([
                      t.objectProperty(
                        t.identifier('lastInsertRowid'),
                        t.conditionalExpression(
                          t.optionalMemberExpression(
                            t.memberExpression(t.identifier('r'), t.identifier('rows')),
                            t.numericLiteral(0),
                            true,
                            true
                          ),
                          t.memberExpression(
                            t.memberExpression(
                              t.memberExpression(t.identifier('r'), t.identifier('rows')),
                              t.numericLiteral(0),
                              true
                            ),
                            t.identifier('id')
                          ),
                          t.nullLiteral()
                        )
                      ),
                      t.objectProperty(
                        t.identifier('changes'),
                        t.memberExpression(t.identifier('r'), t.identifier('rowCount'))
                      )
                    ])
                  )
                ]),
                true // async
              ),
              []
            );
            replacement = t.awaitExpression(asyncIife);
          }
          
          path.replaceWith(replacement);
        }
      }
    }
  }
});

const output = generate(ast, {}, code);
fs.writeFileSync('server/index.js', output.code);
console.log('AST transformation completed.');
