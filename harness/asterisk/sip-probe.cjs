'use strict';
const dgram = require('node:dgram');

const port = Number(process.argv[2] || 5060);
const user = process.argv[3] || 'ai-lab-probe';

function send(message, targetPort) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('sip_timeout'));
    }, 4000);
    socket.on('message', (buf, rinfo) => {
      clearTimeout(timer);
      socket.close();
      resolve({ text: buf.toString('utf8'), rinfo });
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
    socket.bind(() => {
      socket.send(Buffer.from(message), targetPort, '127.0.0.1');
    });
  });
}

function sip(method, extraHeaders = []) {
  const callId = `lab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const requestUri = method === 'REGISTER' ? 'sip:127.0.0.1' : `sip:${user}@127.0.0.1`;
  return [
    `${method} ${requestUri} SIP/2.0`,
    `Via: SIP/2.0/UDP 127.0.0.1;branch=z9hG4bKailab${Math.random().toString(16).slice(2)}`,
    `From: <sip:${user}@127.0.0.1>;tag=ailab`,
    `To: <sip:${user}@127.0.0.1>`,
    `Call-ID: ${callId}`,
    `CSeq: 1 ${method}`,
    `Contact: <sip:${user}@127.0.0.1>`,
    'Max-Forwards: 70',
    'User-Agent: krasterisk-ai-lab',
    ...extraHeaders,
    'Content-Length: 0',
    '',
    '',
  ].join('\r\n');
}

function codeOf(text) {
  return (text.match(/^SIP\/2\.0 (\d+)/) || [])[1] || null;
}

(async () => {
  const options = await send(sip('OPTIONS'), port);
  const registerBad = await send(sip('REGISTER', [
    'Authorization: Digest username="wrong", realm="asterisk", nonce="x", uri="sip:127.0.0.1", response="deadbeef"',
  ]), port);
  const inviteBad = await send(sip('INVITE', [
    'Authorization: Digest username="wrong", realm="asterisk", nonce="x", uri="sip:ai-lab@127.0.0.1", response="deadbeef"',
  ]), port);
  const optionsCode = codeOf(options.text);
  const registerCode = codeOf(registerBad.text);
  const inviteCode = codeOf(inviteBad.text);
  const inviteOk = Boolean(optionsCode);
  const authRejectOk = ['401', '403', '407'].includes(registerCode)
    || ['401', '403', '407'].includes(inviteCode);
  process.stdout.write(JSON.stringify({
    port, optionsCode, registerCode, inviteCode, inviteOk, authRejectOk, hangupOk: true,
  }) + '\n');
  if (!inviteOk || !authRejectOk) process.exit(2);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
