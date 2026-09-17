const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadEnv,
  loadJwt,
  tokenFor,
} = require('../16-modul-telekonferentsiy-confbridge-webrtc/uat-live-lib');

const env = loadEnv();
const jwt = loadJwt();
const token = tokenFor(
  jwt,
  { uniqueid: 58, login: 'admin', name: 'admin', level: 1, role: 40 },
  0,
  env,
);
const user = {
  uniqueid: 58,
  login: 'admin',
  name: 'admin',
  level: 1,
  role: 40,
  exten: '',
  vpbx_user_uid: 0,
};
const expr = `(() => { localStorage.setItem('accessToken', ${JSON.stringify(token)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(user))}); return { ok: true, hasToken: !!localStorage.getItem('accessToken') }; })()`;
const out = path.join(os.tmpdir(), 'uat162-auth-expr.js');
fs.writeFileSync(out, expr);
console.log(out);
