'use strict';
/**
 * Lab-only SIP-over-TLS INVITE with Digest auth and an SDES offer.
 * Records whether Asterisk answers with a=crypto. Not a NAT traversal test.
 */
const tls = require('node:tls');
const crypto = require('node:crypto');

const port = Number(process.argv[2] || 15061);
const user = process.argv[3] || 'ai-lab-tls';
const password = process.argv[4] || 'ai-lab-tls-secret';
const host = '127.0.0.1';

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

function sip(method, headers, body = '') {
  const lines = [
    `${method} ${method === 'REGISTER' ? `sip:${host}` : `sip:sip-echo@${host}`} SIP/2.0`,
    ...headers,
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ];
  return lines.join('\r\n');
}

function sdp() {
  const key = crypto.randomBytes(30).toString('base64');
  return [
    'v=0',
    `o=- 0 0 IN IP4 ${host}`,
    's=krasterisk-lab-srtp',
    `c=IN IP4 ${host}`,
    't=0 0',
    'm=audio 18000 RTP/SAVP 0',
    'a=rtpmap:0 PCMU/8000',
    `a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:${key}`,
    '',
  ].join('\r\n');
}

function exchange(message) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host, port, rejectUnauthorized: false, minVersion: 'TLSv1.2',
    }, () => socket.write(message));
    let buf = '';
    const timer = setTimeout(() => {
      socket.destroy();
      if (buf) resolve(buf);
      else reject(new Error('timeout'));
    }, 8000);
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      const parts = buf.split(/\r\n\r\n/);
      const lastHead = parts.length > 1 ? parts[parts.length - 2] : '';
      const code = (lastHead.match(/^SIP\/2\.0 (\d+)/m) || [])[1]
        || (buf.match(/^SIP\/2\.0 (\d+)/m) || [])[1];
      if (code && !code.startsWith('1')) {
        clearTimeout(timer);
        socket.end();
        resolve(buf);
      }
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      if (buf) resolve(buf);
      else reject(error);
    });
  });
}

function finalCode(text) {
  const codes = [...text.matchAll(/^SIP\/2\.0 (\d+)/gm)].map((m) => m[1]);
  return codes.filter((c) => !c.startsWith('1')).pop() || codes.pop() || null;
}

function header(text, name) {
  const m = text.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'));
  return m ? m[1].trim() : '';
}

(async () => {
  const callId = `srtp-${Date.now()}`;
  const branch = `z9hG4bK${crypto.randomBytes(6).toString('hex')}`;
  const base = [
    `Via: SIP/2.0/TLS ${host};branch=${branch}`,
    `From: <sip:${user}@${host}>;tag=srtplab`,
    `To: <sip:sip-echo@${host}>`,
    `Call-ID: ${callId}`,
    'CSeq: 1 INVITE',
    `Contact: <sip:${user}@${host}:${port};transport=tls>`,
    'Max-Forwards: 70',
    'Content-Type: application/sdp',
    'User-Agent: krasterisk-ai-lab-srtp',
  ];
  const offer = sdp();
  const first = await exchange(sip('INVITE', base, offer));
  const firstCode = finalCode(first);
  let secondCode = null;
  let answerCrypto = false;
  let answer = '';
  if (firstCode === '401' || firstCode === '407') {
    const auth = header(first, 'WWW-Authenticate') || header(first, 'Proxy-Authenticate');
    const realm = (auth.match(/realm="([^"]+)"/) || [])[1] || 'asterisk';
    const nonce = (auth.match(/nonce="([^"]+)"/) || [])[1] || '';
    const uri = `sip:sip-echo@${host}`;
    const ha1 = md5(`${user}:${realm}:${password}`);
    const ha2 = md5(`INVITE:${uri}`);
    const response = md5(`${ha1}:${nonce}:${ha2}`);
    const digest = `Authorization: Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5`;
    const authed = base.map((line) => (line.startsWith('CSeq:') ? 'CSeq: 2 INVITE' : line));
    authed.push(digest);
    answer = await exchange(sip('INVITE', authed, offer));
    secondCode = finalCode(answer);
    answerCrypto = /a=crypto:/i.test(answer);
  }
  const out = {
    transport: 'tls',
    port,
    firstCode,
    secondCode,
    answerCrypto,
    srtpMediaDecrypted: false,
    natCertified: false,
    note: 'SDES offer/answer only; no decrypted RTP; loopback',
    answerHead: (answer || first).split('\r\n').slice(0, 12),
  };
  process.stdout.write(`${JSON.stringify(out)}\n`);
  if (!answerCrypto) process.exit(2);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
