"""Private-network SIP/PCMU fixture. No registration, trunks or outbound dialing.

Run only on an isolated test network. Asterisk static contacts address this peer.
Writes aggregate counters and dialog metadata to STATS_PATH (private artifact).
"""
import asyncio
import json
import os
import random
import re
import signal
import socket
import struct
import time
from pathlib import Path


def parse_message(data):
    head, _, body = data.decode('utf-8', 'replace').partition('\r\n\r\n')
    lines = head.split('\r\n')
    headers = {}
    for line in lines[1:]:
        key, sep, value = line.partition(':')
        if sep:
            headers.setdefault(key.lower(), []).append(value.strip())
    return lines[0], headers, body


def header(headers, key):
    return headers.get(key.lower(), [''])[0]


def sdp(ip, port, held=False):
    return ('v=0\r\no=fixture 1 1 IN IP4 ' + ip + '\r\ns=Internal benchmark\r\n'
            'c=IN IP4 ' + ip + '\r\nt=0 0\r\nm=audio ' + str(port) +
            ' RTP/AVP 0\r\na=rtpmap:0 PCMU/8000\r\na=' +
            ('sendonly' if held else 'sendrecv') + '\r\n')


class Media(asyncio.DatagramProtocol):
    def __init__(self):
        self.rx = 0
        self.tx = 0
        self.target = None
        self.sequence = random.randrange(65536)
        self.timestamp = random.randrange(2 ** 32)
        self.ssrc = random.randrange(2 ** 32)

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        if len(data) >= 12 and data[0] >> 6 == 2:
            self.rx += 1

    def tick(self):
        if self.target:
            packet = struct.pack('!BBHII', 128, 0, self.sequence,
                                 self.timestamp, self.ssrc) + b'\xff' * 160
            self.transport.sendto(packet, self.target)
            self.sequence = (self.sequence + 1) % 65536
            self.timestamp = (self.timestamp + 160) % 2 ** 32
            self.tx += 1


class Peer(asyncio.DatagramProtocol):
    def __init__(self, ip, stats_path):
        self.ip = ip
        self.stats_path = stats_path
        self.dialogs = {}
        self.started = time.time()
        self.requests = 0
        self.errors = 0

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        asyncio.create_task(self.receive(data, addr))

    def reply(self, status, headers, addr, tag='', body=''):
        fields = [status]
        fields += ['Via: ' + value for value in headers.get('via', [])]
        for name in ['from', 'to', 'call-id', 'cseq']:
            value = header(headers, name)
            if name == 'to' and tag and ';tag=' not in value:
                value += ';tag=' + tag
            fields.append(name.title() + ': ' + value)
        fields += [f'Contact: <sip:fixture@{self.ip}:5070>']
        if body:
            fields.append('Content-Type: application/sdp')
        fields.append('Content-Length: ' + str(len(body.encode())))
        self.transport.sendto(('\r\n'.join(fields) + '\r\n\r\n' + body).encode(), addr)

    async def receive(self, data, addr):
        try:
            first, headers, body = parse_message(data)
            if first.startswith('SIP/2.0'):
                dialog = self.dialogs.get(header(headers, 'call-id'))
                cseq = header(headers, 'cseq').split()
                if dialog and len(cseq) == 2 and cseq[1] == 'INVITE' and int(cseq[0]) >= 1000 and first.startswith('SIP/2.0 200'):
                    self.send_request(dialog, header(headers, 'call-id'), 'ACK', int(cseq[0]))
                return
            self.requests += 1
            method = first.split(' ')[0]
            call_id = header(headers, 'call-id')
            if method == 'OPTIONS':
                self.reply('SIP/2.0 200 OK', headers, addr)
            elif method == 'INVITE':
                if call_id not in self.dialogs:
                    if len(self.dialogs) >= 200:
                        self.reply('SIP/2.0 486 Busy Here', headers, addr)
                        return
                    transport, media = await asyncio.get_running_loop().create_datagram_endpoint(
                        Media, local_addr=('0.0.0.0', 0))
                    self.dialogs[call_id] = {
                        'tag': os.urandom(8).hex(), 'media': media,
                        'port': transport.get_extra_info('sockname')[1],
                        'endpoint': first.split(' ')[1].split('@')[0].removeprefix('sip:'),
                        'createdAt': time.time(), 'remote': addr,
                        'from': header(headers, 'from'), 'to': header(headers, 'to'),
                        'contact': header(headers, 'contact'),
                    }
                dialog = self.dialogs[call_id]
                address = re.search(r'^c=IN IP4 ([^\r\n]+)', body, re.M)
                port = re.search(r'^m=audio (\d+)', body, re.M)
                if address and port:
                    dialog['media'].target = (address.group(1), int(port.group(1)))
                self.reply('SIP/2.0 200 OK', headers, addr, dialog['tag'],
                           sdp(self.ip, dialog['port']))
            elif method == 'BYE':
                self.reply('SIP/2.0 200 OK', headers, addr)
                dialog = self.dialogs.pop(call_id, None)
                if dialog:
                    dialog['media'].transport.close()
            elif method == 'CANCEL':
                self.reply('SIP/2.0 200 OK', headers, addr)
            elif method != 'ACK':
                self.reply('SIP/2.0 405 Method Not Allowed', headers, addr)
        except (ValueError, IndexError, OSError):
            self.errors += 1

    def send_request(self, dialog, call_id, method, sequence, held=False):
        target = re.search(r'<([^>]+)>', dialog['contact'])
        if not target:
            raise ValueError('Missing remote dialog contact')
        from_value = dialog['to']
        if ';tag=' not in from_value:
            from_value += ';tag=' + dialog['tag']
        body = sdp(self.ip, dialog['port'], held) if method == 'INVITE' else ''
        fields = [f'{method} {target.group(1)} SIP/2.0',
                  f'Via: SIP/2.0/UDP {self.ip}:5070;branch=z9hG4bK{os.urandom(8).hex()}',
                  'Max-Forwards: 10', 'From: ' + from_value, 'To: ' + dialog['from'],
                  'Call-ID: ' + call_id, f'CSeq: {sequence} {method}',
                  f'Contact: <sip:fixture@{self.ip}:5070>']
        if body:
            fields.append('Content-Type: application/sdp')
        fields.append('Content-Length: ' + str(len(body.encode())))
        self.transport.sendto(('\r\n'.join(fields) + '\r\n\r\n' + body).encode(), dialog['remote'])

    async def control(self, reader, writer):
        try:
            request = json.loads(await asyncio.wait_for(reader.readline(), 3))
            if request.get('action') not in ['hold', 'unhold']:
                raise ValueError('Only owned SIP hold/unhold is supported')
            endpoints = request.get('endpoints')
            if not isinstance(endpoints, list) or not 1 <= len(endpoints) <= 150:
                raise ValueError('Bounded explicit endpoint list required')
            sent = []
            for call_id, dialog in self.dialogs.items():
                if dialog['endpoint'] not in endpoints:
                    continue
                dialog['cseq'] = dialog.get('cseq', 999) + 1
                self.send_request(dialog, call_id, 'INVITE', dialog['cseq'], request['action'] == 'hold')
                sent.append({'callId': call_id, 'endpoint': dialog['endpoint'], 'at': time.time()})
            writer.write((json.dumps({'sent': sent}) + '\n').encode())
        except (ValueError, KeyError, asyncio.TimeoutError):
            writer.write(b'{"error":"invalid-owned-dialog-command"}\n')
        await writer.drain()
        writer.close()

    async def run_media(self):
        while True:
            for dialog in list(self.dialogs.values()):
                dialog['media'].tick()
            await asyncio.sleep(0.02)

    def snapshot(self):
        items = [{'callId': key, 'endpoint': d['endpoint'], 'createdAt': d['createdAt'],
                  'rxPackets': d['media'].rx, 'txPackets': d['media'].tx}
                 for key, d in self.dialogs.items()]
        return {'at': time.time(), 'started': self.started, 'dialogs': len(items),
                'sipRequests': self.requests, 'errors': self.errors, 'calls': items}

    async def save_stats(self):
        while True:
            temporary = self.stats_path.with_suffix('.tmp')
            temporary.write_text(json.dumps(self.snapshot()))
            temporary.replace(self.stats_path)
            await asyncio.sleep(1)


async def main():
    ip = os.environ.get('SIP_IP') or socket.gethostbyname(socket.gethostname())
    peer = Peer(ip, Path(os.environ.get('STATS_PATH', '/artifacts/sip-stats.json')))
    transport, _ = await asyncio.get_running_loop().create_datagram_endpoint(
        lambda: peer, local_addr=('0.0.0.0', 5070))
    control = await asyncio.start_unix_server(peer.control, path='/artifacts/sip-control.sock', limit=16384)
    os.chmod('/artifacts/sip-control.sock', 0o600)
    stop = asyncio.Event()
    for sig in [signal.SIGINT, signal.SIGTERM]:
        asyncio.get_running_loop().add_signal_handler(sig, stop.set)
    tasks = [asyncio.create_task(peer.run_media()), asyncio.create_task(peer.save_stats())]
    print(json.dumps({'listening': f'{ip}:5070', 'maxDialogs': 200}), flush=True)
    await stop.wait()
    for task in tasks:
        task.cancel()
    for dialog in peer.dialogs.values():
        dialog['media'].transport.close()
    transport.close()
    control.close()
    await control.wait_closed()


if __name__ == '__main__':
    asyncio.run(main())
