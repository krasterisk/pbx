'use strict';
const http = require('node:http');
const fs = require('node:fs');
const { healthProductRuntime } = require('/tmp/product-runtime.js');

const server = http.createServer((req, res) => {
  const pilot = String(req.url || '').includes('pilot=1');
  const env = pilot
    ? { AI_PRODUCT_RUNTIME_PILOT: '1', AI_SCHEMA_READY: '1', AI_WORKERS_CONFIGURED: '1' }
    : {};
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(healthProductRuntime('robot-api', env)));
});

server.listen(18080, '127.0.0.1', async () => {
  const def = await fetch('http://127.0.0.1:18080/api/health');
  const on = await fetch('http://127.0.0.1:18080/api/health?pilot=1');
  const out = {
    default: await def.json(),
    pilot: await on.json(),
    nestSequelizeBoot: false,
    liveDebit: false,
    note: 'loopback health contract; Nest not pointed at production DB',
  };
  fs.writeFileSync('/tmp/pilot-http.json', JSON.stringify(out, null, 2));
  process.stdout.write(`${JSON.stringify(out)}\n`);
  server.close();
});
