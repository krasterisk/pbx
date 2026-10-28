"""Bounded real-call generator for the newly owned A13 Asterisk only.

AMI events and media counters are evidence; no synthetic AMI event injection.
The process hangs up its own calls on signal/deadline, never other channels.
"""
import argparse
import json
import queue
import re
import signal
import socket
import threading
import time
from pathlib import Path


class Ami:
    def __init__(self, config, output):
        if config['amiHost'] != 'krasterisk-a13-asterisk':
            raise ValueError('Only the newly owned A13 Asterisk is supported')
        self.socket = socket.create_connection((config['ip'], config['amiPort']), timeout=10)
        self.socket.settimeout(1)
        self.output = output.open('a', buffering=1)
        self.responses = {}
        self.counter = 0
        self.closed = False
        self.channels = []
        self.core_done = threading.Event()
        self.events = 0
        self.thread = threading.Thread(target=self.read, daemon=True)
        self.thread.start()
        self.action({'Action': 'Login', 'Username': config['amiUsername'], 'Secret': config['amiSecret'], 'Events': 'on'})

    def read(self):
        buffer = b''
        while not self.closed:
            try:
                data = self.socket.recv(65536)
                if not data:
                    break
                buffer += data
                while b'\r\n\r\n' in buffer:
                    packet, buffer = buffer.split(b'\r\n\r\n', 1)
                    fields = {}
                    for line in packet.decode('utf-8', 'replace').split('\r\n'):
                        name, sep, value = line.partition(':')
                        if sep:
                            fields[name.lower()] = value.strip()
                    action_id = fields.get('actionid')
                    if fields.get('response') and action_id in self.responses:
                        self.responses[action_id].put(fields)
                    event = fields.get('event', '')
                    if event == 'CoreShowChannel':
                        self.channels.append(fields)
                    elif event == 'CoreShowChannelsComplete':
                        self.core_done.set()
                    if event:
                        self.events += 1
                        if event in ['Hold', 'Unhold', 'AgentConnect', 'AgentComplete', 'QueueCallerJoin', 'QueueCallerAbandon', 'Hangup', 'OriginateResponse']:
                            allowed = ['event', 'timestamp', 'uniqueid', 'linkedid', 'channel', 'destchannel',
                                       'destuniqueid', 'queue', 'interface', 'response', 'reason', 'cause']
                            self.output.write(json.dumps({'receivedAt': time.time(), **{k: fields[k] for k in allowed if k in fields}}) + '\n')
            except socket.timeout:
                continue
            except OSError:
                break

    def action(self, fields):
        self.counter += 1
        action_id = 'a13-' + str(self.counter)
        response = queue.Queue()
        self.responses[action_id] = response
        self.socket.sendall(('\r\n'.join(f'{key}: {value}' for key, value in {**fields, 'ActionID': action_id}.items()) + '\r\n\r\n').encode())
        try:
            result = response.get(timeout=20)
            if result.get('response') == 'Error':
                raise RuntimeError(result.get('message', 'AMI rejected action'))
            return result
        finally:
            self.responses.pop(action_id, None)

    def core(self):
        self.channels = []
        self.core_done.clear()
        self.action({'Action': 'CoreShowChannels'})
        if not self.core_done.wait(15):
            raise TimeoutError('Asterisk channel inventory timed out')
        return list(self.channels)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--duration', type=int, default=1800)
    args = parser.parse_args()
    if not 60 <= args.duration <= 3600:
        raise ValueError('Duration must be bounded to 60–3600 seconds')
    p = args.directory
    config = json.loads((p / 'asterisk-private.json').read_text())
    receipt = json.loads((p / 'cabinet-private.json').read_text())
    tenant = receipt['tenant']
    assert tenant == config['tenant'] and len(receipt['agents']) == 200
    queues = receipt['queues']
    assert len(queues) == 12 and all(re.fullmatch(r'q86\d{2}_' + str(tenant), q) for q in queues)
    stop = threading.Event()
    for sig in [signal.SIGTERM, signal.SIGINT]:
        signal.signal(sig, lambda *_: stop.set())
    ami = Ami(config, p / 'artifacts/ami-events.jsonl')
    def owned(channel):
        return bool(re.match(r'(?:PJSIP/e8[78]\d{2}_' + str(tenant) + r'-|Local/q86\d{2}_' + str(tenant) + r'@bench-source-)', channel))
    started = time.time()
    owns_run = False
    try:
        if any(owned(c.get('channel', '')) for c in ami.core()):
            raise RuntimeError('Owned calls already exist; do not start a second generator')
        owns_run = True
        for agent in receipt['agents']:
            try:
                ami.action({'Action': 'QueueAdd', 'Queue': agent['queues'][0], 'Interface': agent['interface'],
                            'MemberName': agent['interface'], 'Penalty': 0, 'Paused': 'false'})
            except RuntimeError as error:
                if 'already' not in str(error).lower():
                    raise
        for index in range(150):
            if stop.is_set():
                break
            ami.action({'Action': 'Originate', 'Channel': f'Local/{queues[index % 12]}@bench-source/n',
                        'Context': 'bench-media', 'Exten': 's', 'Priority': 1, 'Async': 'true',
                        'CallerID': f'A13 Internal {index + 1} <{880000 + index}>', 'Timeout': 30000})
            stop.wait(0.1)
        deadline = time.time() + 90
        while not stop.is_set() and time.time() < started + args.duration:
            channels = ami.core()
            sip = [c for c in channels if c.get('channel', '').startswith('PJSIP/') and owned(c.get('channel', ''))]
            up = [c for c in sip if c.get('channelstatedesc') == 'Up']
            evidence = {'at': time.time(), 'startedAt': started, 'expiresAt': started + args.duration,
                        'ownedChannels': sum(owned(c.get('channel', '')) for c in channels),
                        'sipDialogsUp': len(up), 'amiEvents': ami.events,
                        'channels': [{k: c.get(k) for k in ['channel', 'uniqueid', 'linkedid', 'bridgeid', 'channelstatedesc', 'application']} for c in channels if owned(c.get('channel', ''))]}
            (p / 'artifacts/calls-latest.json').write_text(json.dumps(evidence))
            if len(up) == 150:
                if not (p / 'artifacts/150-calls-first.json').exists():
                    (p / 'artifacts/150-calls-first.json').write_text(json.dumps(evidence))
                    print(json.dumps({'realSipDialogsUp': 150, 'ownedChannels': evidence['ownedChannels'], 'at': time.time()}), flush=True)
            elif time.time() > deadline:
                raise RuntimeError(f'Expected 150 established SIP dialogs, got {len(up)}')
            stop.wait(5)
    finally:
        hung_up = 0
        for channel in ami.core() if owns_run else []:
            if owned(channel.get('channel', '')) and channel.get('channel', '').startswith('Local/'):
                try:
                    ami.action({'Action': 'Hangup', 'Channel': channel['channel']})
                    hung_up += 1
                except RuntimeError:
                    pass
        (p / 'artifacts/generator-cleanup.json').write_text(json.dumps({'at': time.time(), 'hangupActions': hung_up}))
        ami.closed = True
        ami.socket.close()
        ami.thread.join(timeout=2)
        ami.output.close()


if __name__ == '__main__':
    main()
