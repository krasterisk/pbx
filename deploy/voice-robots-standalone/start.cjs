'use strict';
const fs = require('node:fs');
const path = require('node:path');
const config = JSON.parse(fs.readFileSync(process.env.VOICE_ROBOTS_ENV_FILE || '/etc/krasterisk-voice-robots/backend.json', 'utf8'));
for (const [key, value] of Object.entries(config)) process.env[key] = String(value);
// Only this PM2 child enters a new bounded cgroup; existing applications stay untouched.
if (process.platform === 'linux' && process.getuid() === 0) {
  const group = '/sys/fs/cgroup/krasterisk-voice-robots';
  fs.mkdirSync(group, { recursive: true });
  fs.writeFileSync(path.join(group, 'memory.max'), '1610612736');
  fs.writeFileSync(path.join(group, 'memory.high'), '1342177280');
  fs.writeFileSync(path.join(group, 'cpu.max'), '150000 100000');
  fs.writeFileSync(path.join(group, 'pids.max'), '96');
  fs.writeFileSync(path.join(group, 'cgroup.procs'), String(process.pid));
  if (!Number.isInteger(config.RUNTIME_UID) || config.RUNTIME_UID <= 0
    || !Number.isInteger(config.RUNTIME_GID) || config.RUNTIME_GID <= 0) throw new Error('Invalid runtime identity');
  process.setgroups([]); process.setgid(config.RUNTIME_GID); process.setuid(config.RUNTIME_UID);
}
require(path.resolve(__dirname, 'dist/standalone-voice-robots/main.js'));
