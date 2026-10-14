const path = require('node:path');
module.exports = { apps: [{
  name: 'krasterisk_voice_robots', cwd: __dirname, script: './start.cjs',
  instances: 1, exec_mode: 'fork', watch: false,
  node_args: '--max-old-space-size=768', max_memory_restart: '1100M',
  min_uptime: '20s', max_restarts: 3, exp_backoff_restart_delay: 3000,
  kill_timeout: 15000, time: true,
  out_file: path.join(__dirname, 'logs/out.log'), error_file: path.join(__dirname, 'logs/error.log'),
}] };
