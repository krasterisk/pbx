"""Analyze externally saved real AMI, browser DOM and container measurements.

Inputs are private run files, never checked-in fixtures or application shortcuts.
Clock assumption: AMI, host Python and stand Chromium share one Linux clock.
"""
import argparse
import bisect
import collections
import json
import math
import re
from pathlib import Path


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def lines(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def distribution(values):
    values = sorted(values)
    if not values:
        return {'n': 0}
    return {'n': len(values), 'min': round(values[0], 2), 'mean': round(sum(values) / len(values), 2),
            **{label: round(values[max(0, math.ceil(len(values) * fraction) - 1)], 2)
               for label, fraction in [('p50', .5), ('p95', .95), ('p99', .99)]},
            'max': round(values[-1], 2)}


def memory_mib(text):
    match = re.match(r'([\d.]+)\s*([kMGT]?i?B)', text)
    if not match:
        raise ValueError('Unknown Docker memory unit: ' + text)
    scales = {'B': 1 / 1048576, 'kB': 1000 / 1048576, 'KiB': 1 / 1024,
              'MB': 1000000 / 1048576, 'MiB': 1, 'GB': 1e9 / 1048576,
              'GiB': 1024, 'TB': 1e12 / 1048576, 'TiB': 1048576}
    return float(match[1]) * scales[match[2]]


def analyze(directory):
    events = lines(directory / 'artifacts/ami-events.jsonl')
    callers = {event['destchannel']: event['uniqueid'] for event in events
               if event.get('event') == 'AgentConnect' and event.get('destchannel') and event.get('uniqueid')}
    changes = collections.defaultdict(list)
    for event in events:
        if event.get('event') not in ['Hold', 'Unhold'] or event.get('channel') not in callers:
            continue
        at = float(event['timestamp']) * 1000
        key = (callers[event['channel']], 'HOLD' if event['event'] == 'Hold' else 'TALKING')
        changes[key].append(at)
    for timestamps in changes.values():
        timestamps.sort()
    summary = {'clock': 'same Linux host clock; AMI timestamp seconds and browser Date.now milliseconds', 'phases': {}}
    for phase in ['ws-normal', 'sse-normal', 'ws-stress', 'sse-stress']:
        result_path = directory / ('headless-run/result-' + phase + '.json')
        if not result_path.exists():
            summary['phases'][phase] = {'status': 'missing'}
            continue
        browser = load(result_path)
        server = load(directory / 'artifacts' / phase / 'phase.json')
        before, after = [load(directory / 'artifacts' / phase / 'proxy-boundaries.json')[key] for key in ['before', 'after']]
        # The browser receipt is published every2s. Exclude identical boundary
        # margins so a not-yet-flushed final receipt is not called packet loss.
        start, end = server['startedAt'] * 1000 + 1000, server['endedAt'] * 1000 - 3000
        expected = {(key, stamp) for key, stamps in changes.items() for stamp in stamps if start <= stamp <= end}
        pages = []
        all_times = collections.defaultdict(list)
        for index, final in enumerate(browser['final']):
            times = collections.defaultdict(list)
            received, committed = set(), set()
            unmatched = 0
            measurement = final.get('measurement') or {}
            grouped = {}
            for sample in measurement.get('samples', []):
                if sample['receivedAt'] < start or sample['receivedAt'] > end + 10000:
                    continue
                key = (sample['id'], sample['status'])
                stamps = changes.get(key, [])
                position = bisect.bisect_right(stamps, sample['receivedAt'] + 2) - 1
                if position < 0 or (key, stamps[position]) not in expected:
                    unmatched += 1
                    continue
                source = stamps[position]
                identity = (key, source)
                # Same-status refreshes are not new AMI transitions. Use the
                # earliest receipt/DOM per source change, not a late periodic
                # refresh incorrectly counted as seconds of transport latency.
                item = grouped.setdefault(identity, {'source': source, 'receivedAt': sample['receivedAt']})
                item['receivedAt'] = min(item['receivedAt'], sample['receivedAt'])
                for target in ['domAt', 'frameAt']:
                    if target in sample:
                        item[target] = min(item.get(target, sample[target]), sample[target])
            for identity, sample in grouped.items():
                source = sample['source']
                received.add(identity)
                times['sourceToReceiptMs'].append(sample['receivedAt'] - source)
                for target, label in [('domAt', 'sourceToDomMs'), ('frameAt', 'sourceToNextFrameMs')]:
                    if target in sample:
                        times[label].append(sample[target] - source)
                if 'domAt' in sample:
                    committed.add(identity)
                    times['receiptToDomMs'].append(sample['domAt'] - sample['receivedAt'])
            for key, values in times.items():
                all_times[key].extend(values)
            pages.append({'page': index, 'rows': len(final['rows']), 'talking': sum(row['status'] == 'TALKING' for row in final['rows']),
                          'transport': measurement.get('transport'), 'observerErrors': measurement.get('observerErrors'),
                          'sourceEvents': len(expected), 'receivedSourceEvents': len(received), 'committedSourceEvents': len(committed),
                          'unmatchedSamples': unmatched, 'timings': {key: distribution(values) for key, values in times.items()}})
        containers = collections.defaultdict(lambda: collections.defaultdict(list))
        telemetry = lines(directory / 'artifacts' / phase / 'telemetry.jsonl')
        host_cpu = []
        prior = None
        for item in telemetry:
            for container in item['containers']:
                values = containers[container['Name']]
                values['cpuPercentOneCore'].append(float(container['CPUPerc'].rstrip('%')))
                values['memoryMiB'].append(memory_mib(container['MemUsage'].split('/')[0].strip()))
            ticks = [int(number) for number in item['hostCpuTicks'].split()[1:9]]
            if prior:
                elapsed = sum(ticks) - sum(prior)
                idle = ticks[3] + ticks[4] - prior[3] - prior[4]
                if elapsed:
                    host_cpu.append(100 * (elapsed - idle) / elapsed)
            prior = ticks
        probes = [probe for page in browser.get('apiProbes', []) for probe in page if browser['start'] <= probe['at'] <= browser['end']]
        requests = browser['requests']
        statuses = collections.Counter(str(request['status']) for request in requests if 'status' in request)
        proxy_statuses = {key: count - before['responses'].get(key, 0) for key, count in after['responses'].items()}
        summary['phases'][phase] = {
            'status': 'measured' if browser.get('fresh', True) else 'failed-final-freshness',
            'gates': {'freshDom': bool(browser.get('fresh')),
                      'sixTablesConsistent': len(pages) == 6 and all(page['rows'] == 150 and page['talking'] == 150 and not page['observerErrors'] for page in pages),
                      'sixWsTunnelsStable': None if not phase.startswith('ws-') else before['activeTunnels'] == 6 and after['activeTunnels'] == 6 and after['upgrades'] == before['upgrades']},
            'proxyWindowSec': round((after['at'] - before['at']) / 1000, 3),
            'finalFresh': browser.get('fresh'), 'durationSec': round(server['endedAt'] - server['startedAt'], 2),
            'latencyWindow': {'startMs': start, 'endMs': end, 'excludedStartMs': 1000, 'excludedEndMs': 3000},
            'realDialogs': server['realActiveDialogsAtStart'], 'sipCommands': server['generatedSipCommands'],
            'actualAmiStatusChanges': len(expected), 'pages': pages,
            'timings': {key: distribution(values) for key, values in all_times.items()},
            'containers': {name: {key: distribution(values) for key, values in metrics.items()} for name, metrics in containers.items()},
            'hostCpuPercentAllCores': distribution(host_cpu),
            'minHostAvailableMiB': min(item['hostMemory']['MemAvailable'] / 1024 for item in telemetry),
            'http': {'browserRequestsStarted': len(requests), 'responseStatuses': dict(statuses),
                     'failuresCompletedInWindow': len(browser['failuresCompletedInWindow']),
                     'proxyRequests': after['requests'] - before['requests'], 'proxyResponses': proxy_statuses,
                     'proxyUpgrades': after['upgrades'] - before['upgrades'],
                     'proxyUpstreamErrors': after['upstreamErrors'] - before['upstreamErrors'],
                     'activeWsTunnelsBefore': before['activeTunnels'], 'activeWsTunnelsAfter': after['activeTunnels'],
                     'apiProbes': len(probes), 'apiProbeErrors': sum('error' in probe for probe in probes),
                     'apiProbeCompletedMs': distribution([probe['endedAt'] - probe['at'] for probe in probes if probe.get('status') == 200 and 'endedAt' in probe]),
                     'apiProbePending': sum('endedAt' not in probe for probe in probes)},
            'browserErrors': browser['errors'],
            'wsReceivedFrames': sum(after['frames'] - before['frames'] for before, after in zip(browser['framesBefore'], browser['framesAfter'])),
            'wsReceivedBytes': sum(after['bytes'] - before['bytes'] for before, after in zip(browser['framesBefore'], browser['framesAfter'])),
        }
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(json.dumps(analyze(args.directory), indent=2), encoding='utf-8')
