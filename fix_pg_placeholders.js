const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

code = code.replace(
  /'INSERT INTO daily_checklist \(item_name, routine_type, is_checked, routine_date\) VALUES \(\?, \?, 0, \?\)'/g,
  "'INSERT INTO daily_checklist (item_name, routine_type, is_checked, routine_date) VALUES ($1, $2, 0, $3)'"
);

code = code.replace(
  /\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/g,
  ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
);

code = code.replace(
  /\) VALUES \(\?, \?, \?\)/g,
  ") VALUES ($1, $2, $3)"
);

code = code.replace(
  /\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/g,
  ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)"
);

code = code.replace(
  /\) VALUES \(\?, \?, \?, \?, \?, \?, \?\)/g,
  ") VALUES ($1, $2, $3, $4, $5, $6, $7)"
);

fs.writeFileSync('server/index.js', code);
