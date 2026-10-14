#!/usr/bin/env node
'use strict';
// stdio MCP → private header-authenticated Streamable HTTP. No tokens in command args or stdout.
const readline = require('node:readline');
const endpoint = process.env.VOICE_ROBOTS_MCP_URL;
const token = process.env.VOICE_ROBOTS_MCP_TOKEN;
if (!endpoint || new URL(endpoint).protocol !== 'https:' || !/^krvr_[A-Za-z0-9_-]{43}$/.test(token || '')) {
  process.stderr.write('Configure VOICE_ROBOTS_MCP_URL (HTTPS) and VOICE_ROBOTS_MCP_TOKEN in client secret environment.\n'); process.exit(1);
}
let protocolVersion = '2025-11-25';
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();
lines.on('line', line => { queue = queue.then(async () => {
  let body;
  try {
    if (line.length > 4 * 1024 * 1024) throw new Error('Message too large'); body = JSON.parse(line);
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}`, 'MCP-Protocol-Version': protocolVersion },
      body: JSON.stringify(body), signal: AbortSignal.timeout(35000), redirect: 'error' });
    if (response.status === 202) return;
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
    const message = await response.json();
    if (body.method === 'initialize' && message.result?.protocolVersion) protocolVersion = message.result.protocolVersion;
    if (Object.hasOwn(body, 'id')) process.stdout.write(JSON.stringify(message) + '\n');
  } catch (error) {
    if (body && Object.hasOwn(body, 'id')) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: error.message.startsWith('MCP HTTP') ? error.message : 'MCP transport failed' } }) + '\n');
    else process.stderr.write('MCP notification/transport failed.\n');
  }
}); });
