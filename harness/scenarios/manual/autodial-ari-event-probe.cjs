/** Read-only, short-lived ARI event probe for the opt-in live gate. */
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');

if (process.env.AC_LIVE_GATE_ALLOWED !== '1') throw new Error('Set AC_LIVE_GATE_ALLOWED=1');
for (const line of fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}
const protocol = process.env.ARI_PROTOCOL === 'https' ? 'wss' : 'ws';
const host = process.env.ARI_HOST || 'localhost';
const port = Number(process.env.ARI_PORT || 8088);
const user = process.env.ARI_USER || 'krasterisk';
const password = process.env.ARI_PASSWORD || '';
const app = process.env.ARI_APP_NAME || 'krasterisk_voicerobots';
const url = `${protocol}://${host}:${port}/ari/events?api_key=${encodeURIComponent(`${user}:${password}`)}&app=${encodeURIComponent(app)}`;
const ws = new WebSocket(url, { rejectUnauthorized: false });
const timeout = setTimeout(() => { console.log(JSON.stringify({ probe: 'timeout' })); ws.close(); }, 25_000);

ws.on('open', () => console.log(JSON.stringify({ probe: 'connected', app })));
ws.on('message', (data) => {
  const event = JSON.parse(data.toString());
  const channel = event.channel;
  if (!channel?.id?.startsWith('ac-')) return;
  console.log(JSON.stringify({ type: event.type, channelId: channel.id, state: channel.state, cause: event.cause }));
  if (event.type === 'ChannelDestroyed') ws.close();
});
ws.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
ws.on('close', (code, reason) => {
  clearTimeout(timeout);
  console.log(JSON.stringify({ probe: 'closed', code, reason: reason.toString() }));
});
