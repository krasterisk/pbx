"""Identical SIP hold/unhold schedule and bounded server telemetry for A/B runs.

No application API shortcuts or fabricated events. Requires 150 existing dialogs.
"""
import argparse
import json
import os
import socket
import subprocess
import threading
import time
from pathlib import Path


def command(directory, action, endpoints):
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
        connection.settimeout(5)
        connection.connect(str(directory / 'artifacts/sip-control.sock'))
        connection.sendall((json.dumps({'action': action, 'endpoints': endpoints}) + '\n').encode())
        with connection.makefile('r') as stream:
            reply = json.loads(stream.readline())
        if 'error' in reply:
            raise RuntimeError(reply['error'])
        return reply


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--phase', choices=['ws-normal', 'sse-normal', 'ws-stress', 'sse-stress'], required=True)
    parser.add_argument('--duration', type=int, default=120)
    args = parser.parse_args()
    if not 30 <= args.duration <= 300:
        raise ValueError('Phase duration must be 30–300 seconds')
    directory = args.directory
    stats = json.loads((directory / 'artifacts/sip-stats.json').read_text())
    if stats['dialogs'] != 150 or any(c['rxPackets'] < 50 or c['txPackets'] < 50 for c in stats['calls']):
        raise ValueError('Require exactly 150 proven bidirectional RTP dialogs')
    endpoints = sorted(c['endpoint'] for c in stats['calls'])
    output = directory / ('artifacts/' + args.phase)
    output.mkdir(mode=0o700)
    # Restore the same initial all-talking state before each measured window.
    command(directory, 'unhold', endpoints)
    time.sleep(3)
    stop = threading.Event()
    def telemetry():
        containers = ['krasterisk-chat-r29-backend', 'krasterisk-chat-r29-web',
                      'krasterisk-a13-asterisk', 'krasterisk-a13-sip']
        if os.environ.get('CC_BROWSER_CONTAINER') == 'krasterisk-a13-browser':
            containers.append('krasterisk-a13-browser')
        with (output / 'telemetry.jsonl').open('w', buffering=1) as file:
            while not stop.is_set():
                result = subprocess.run(['docker', 'stats', '--no-stream', '--format', '{{json .}}',
                                         *containers], capture_output=True, text=True, timeout=10)
                file.write(json.dumps({'at': time.time(), 'exit': result.returncode,
                                       'containers': [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')],
                                       'hostCpuTicks': Path('/proc/stat').read_text().splitlines()[0],
                                       'hostMemory': {line.split(':')[0]: int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith(('MemTotal:', 'MemAvailable:', 'SwapTotal:', 'SwapFree:'))},
                                       'media': json.loads((directory / 'artifacts/sip-stats.json').read_text())}) + '\n')
                stop.wait(1)
    worker = threading.Thread(target=telemetry, daemon=True)
    worker.start()
    rate = 10 if args.phase.endswith('stress') else 1
    started = time.time()
    deadline = time.monotonic() + args.duration
    count = 0
    with (output / 'schedule.jsonl').open('w', buffering=1) as file:
        try:
            while time.monotonic() < deadline:
                endpoint = endpoints[count % len(endpoints)]
                hold = command(directory, 'hold', [endpoint])
                file.write(json.dumps({'at': time.time(), 'action': 'hold', 'index': count, 'reply': hold}) + '\n')
                time.sleep(0.2 if rate == 1 else 0.04)
                unhold = command(directory, 'unhold', [endpoint])
                file.write(json.dumps({'at': time.time(), 'action': 'unhold', 'index': count, 'reply': unhold}) + '\n')
                count += 1
                wait = started + count / rate - time.time()
                if wait > 0:
                    time.sleep(wait)
        finally:
            command(directory, 'unhold', endpoints)
            stop.set()
            worker.join(timeout=15)
    summary = {'phase': args.phase, 'startedAt': started, 'endedAt': time.time(),
               'cycles': count, 'plannedCyclesPerSecond': rate, 'realActiveDialogsAtStart': 150,
               'generatedSipCommands': 2 * count, 'transport': args.phase.split('-')[0]}
    (output / 'phase.json').write_text(json.dumps(summary))
    print(json.dumps(summary), flush=True)


if __name__ == '__main__':
    main()
