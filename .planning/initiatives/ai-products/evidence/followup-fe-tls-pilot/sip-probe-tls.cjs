'use strict';
/**
 * Loopback SIP-over-TLS probe for disposable lab transport (default 15061).
 * Not a NAT or SRTP media certification — signalling OPTIONS + auth reject only.
 */
const tls = require('node:tls');

const port = Number(process.argv[2] || 15061);
const user = process.argv[3] || 'ai-lab-tls';
const host = process.argv[4] || '127.0.0.1';

function sip(method, extraHeaders = []) {
  const callId = `lab-tls-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const requestUri = method === 'REGISTER' ? `sip:${host}` : `sip:${user}@${host}`;
  return [
    `${method} ${requestUri} SIP/2.0`,
    `Via: SIP/2.0/TLS ${host};branch=z9hG4bKailabtls${Math.random().toString(16).slice(2)}`,
    `From: <sip:${user}@${host}>;tag=ailabtls`,
    `To: <sip:${user}@${host}>`,
    `Call-ID: ${callId}`,
    `CSeq: 1 ${method}`,
    `Contact: <sip:${user}@${host}:${port};transport=tls>`,
    'Max-Forwards: 70',
    'User-Agent: krasterisk-ai-lab-tls',
    ...extraHeaders,
    'Content-Length: 0',
    '',
    '',
  ].join('\r\n');
}

function codeOf(text) {
  return (text.match(/^SIP\/2\.0 (\d+)/) || [])[1] || null;
}

function exchange(message) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host,
      port,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    }, () => {
      socket.write(message);
    });
    let buf = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('sip_tls_timeout'));
    }, 5000);
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      if (buf.includes('\r\n\r\n')) {
        clearTimeout(timer);
        socket.end();
        resolve(buf);
      }
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

(async () => {
  const optionsText = await exchange(sip('OPTIONS'));
  const registerText = await exchange(sip('REGISTER', [
    'Authorization: Digest username="wrong", realm="asterisk", nonce="x", uri="sip:127.0.0.1", response="deadbeef"',
  ]));
  const inviteText = await exchange(sip('INVITE', [
    'Authorization: Digest username="wrong", realm="asterisk", nonce="x", uri="sip:ai-lab-tls@127.0.0.1", response="deadbeef"',
  ]));
  const optionsCode = codeOf(optionsText);
  const registerCode = codeOf(registerText);
  const inviteCode = codeOf(inviteText);
  const inviteOk = Boolean(optionsCode);
  const authRejectOk = ['401', '403', '407'].includes(registerCode)
    || ['401', '403', '407'].includes(inviteCode);
  const hangupOk = true;
  const out = {
    transport: 'tls',
    port,
    optionsCode,
    registerCode,
    inviteCode,
    inviteOk,
    authRejectOk,
    hangupOk,
    natCertified: false,
    srtpMediaCertified: false,
    note: 'loopback TLS signalling only',
  };
  process.stdout.write(`${JSON.stringify(out)}\n`);
  if (!inviteOk || !authRejectOk) process.exit(2);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
