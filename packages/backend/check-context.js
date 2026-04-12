const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({ host: 'ipbx.krasterisk.ru', user: 'krasterisk', password: 'gfhjkm', database: 'krasterisk' });
  const [r] = await c.query("SELECT id, context, tenantid FROM ps_endpoints WHERE id LIKE 't\\_%'");
  console.log(JSON.stringify(r, null, 2));
  await c.end();
})();
