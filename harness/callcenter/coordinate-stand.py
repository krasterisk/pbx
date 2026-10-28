"""Private-filesystem coordinator for the explicitly authorized headless run.

The browser container has no Docker socket or application test-control endpoint.
"""
import argparse
import hashlib
import json
import os
import signal
import subprocess
import time
from pathlib import Path
from stream_gate import websocket_continuity


def write(target, value):
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.replace(target)


def wait_file(target, exchange, seconds):
    deadline = time.monotonic() + seconds
    while not target.exists():
        failure = exchange / 'browser-failure.json'
        if failure.exists():
            raise RuntimeError('Browser failure: ' + failure.read_text())
        if time.monotonic() > deadline:
            raise TimeoutError('Coordinator wait timed out: ' + target.name)
        time.sleep(.25)
    return json.loads(target.read_text())


def proxy_snapshot():
    stamp = time.time() * 1000
    subprocess.run(['docker', 'kill', '--signal=USR2', 'krasterisk-chat-r29-web'], check=True, capture_output=True)
    for _ in range(20):
        result = subprocess.run(['docker', 'logs', '--tail', '5', 'krasterisk-chat-r29-web'], capture_output=True, text=True, check=True)
        items = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
        items = [item for item in items if item.get('at', 0) >= stamp]
        if items:
            return items[-1]
        time.sleep(.05)
    raise TimeoutError('Proxy metric signal did not arrive')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    args = parser.parse_args()
    directory = args.directory.resolve()
    if str(directory) != '/opt/krasterisk-deploys/supervisor-pulse/a13-9c948aa3-20261028':
        raise ValueError('Only the owned A13 stand directory is supported')
    exchange = directory / 'headless-run'
    fingerprint = None
    summary = {'startedAt': time.time(), 'phases': [], 'status': 'in_progress'}
    durations = {'sse-normal': 120, 'ws-normal': 120, 'sse-stress': 60, 'ws-stress': 60}
    selected = os.environ.get('CC_PHASES', ','.join(durations)).split(',')
    summary['selectedPhases'] = selected
    try:
        if not selected or len(set(selected)) != len(selected) or any(phase not in durations for phase in selected):
            raise ValueError('Invalid bounded phase selection')
        wait_file(exchange / 'browser-start.json', exchange, 90)
        for phase in selected:
            duration = durations[phase]
            stats = json.loads((directory / 'artifacts/sip-stats.json').read_text())
            if stats['dialogs'] != 150:
                raise RuntimeError('Expected 150 real active dialogs')
            current = hashlib.sha256('\n'.join(sorted(call['callId'] for call in stats['calls'])).encode()).hexdigest()
            fingerprint = fingerprint or current
            if current != fingerprint:
                raise RuntimeError('Call set changed between phases')
            write(exchange / ('prepare-' + phase + '.json'), {'at': time.time()})
            ready = wait_file(exchange / ('ready-' + phase + '.json'), exchange, 600)
            if len(ready['pages']) != 6 or any(not page['ready'] for page in ready['pages']):
                write(exchange / 'readiness-failure.json', {'phase': phase, 'ready': ready})
                raise RuntimeError('Not all six real browser tables became ready')
            print(json.dumps({'phase': phase, 'stage': 'six-tables-ready', 'warmupSec': 60}), flush=True)
            time.sleep(60)
            write(exchange / ('start-' + phase + '.json'), {'at': time.time()})
            wait_file(exchange / ('started-' + phase + '.json'), exchange, 20)
            before = proxy_snapshot()
            environment = dict(os.environ, CC_BROWSER_CONTAINER='krasterisk-a13-browser')
            with (exchange / (phase + '-host.log')).open('w') as log:
                result = subprocess.run(['python3', str(directory / 'run-phase.py'), '--directory', str(directory), '--phase', phase, '--duration', str(duration)], env=environment, stdout=log, stderr=subprocess.STDOUT, timeout=duration + 60)
            after = proxy_snapshot()
            target = directory / 'artifacts' / phase
            write(target / 'proxy-boundaries.json', {'before': before, 'after': after, 'phaseExit': result.returncode})
            if result.returncode:
                raise RuntimeError('SIP phase failed: ' + phase)
            write(exchange / ('end-' + phase + '.json'), {'at': time.time()})
            done = wait_file(exchange / ('done-' + phase + '.json'), exchange, 90)
            consistent = len(done['pages']) == 6 and all(page['rows'] == 150 and page['talking'] == 150 and not page['observerErrors'] for page in done['pages'])
            transport_stable = not phase.startswith('ws-') or websocket_continuity(json.loads((exchange / ('result-' + phase + '.json')).read_text()), before, after, json.loads((exchange / ('prepare-' + phase + '.json')).read_text())['at'] * 1000)['passed']
            phase_status = 'measured' if consistent and done.get('fresh', False) and transport_stable else 'failed-browser-gates'
            summary['phases'].append({'phase': phase, 'status': phase_status, 'transportStable': transport_stable, 'dialogs': 150, 'callFingerprint': fingerprint, 'done': done, 'proxyBefore': before, 'proxyAfter': after})
            write(exchange / 'coordinator-summary.json', summary)
            print(json.dumps({'phase': phase, 'stage': phase_status, 'tables': 6}), flush=True)
        summary['status'] = 'completed' if all(phase['status'] == 'measured' for phase in summary['phases']) else 'completed-with-failed-gates'
    except Exception as error:
        summary.update(status='failed', error=type(error).__name__, detail=str(error))
        write(exchange / 'stop.json', {'at': time.time(), 'reason': summary['detail']})
        raise
    finally:
        summary['endedAt'] = time.time()
        write(exchange / 'coordinator-summary.json', summary)
        # Only the generator started for this owned fixture, never arbitrary processes.
        pid = int((directory / 'generator.pid').read_text())
        process = Path('/proc') / str(pid)
        if process.exists() and (process / 'stat').read_text().split()[2] != 'Z':
            if str(directory / 'run-real-calls.py').encode() not in (process / 'cmdline').read_bytes():
                raise RuntimeError('Generator cleanup ownership mismatch')
            os.kill(pid, signal.SIGTERM)


if __name__ == '__main__':
    main()
