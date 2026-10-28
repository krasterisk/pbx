"""Identify the six measured CC streams independently of other app namespaces."""


def websocket_continuity(browser, before, after, prepared_at_ms):
    start, end = browser['start'], browser['end']
    # Only the CC namespace produces the fullSnapshot metadata recorded here.
    # A closed target may lack a Playwright close event. Exclude previous targets
    # using the coordinator's immutable preparation marker for this candidate.
    connections = [item for item in browser['connectionEvents']
                   if item.get('snapshots') and item['openedAt'] >= prepared_at_ms]
    stable = {item['page'] for item in connections
              if item['openedAt'] <= start and (not item.get('closedAt') or item['closedAt'] > end)}
    reopened = sum(start < item['openedAt'] <= end for item in connections)
    return {
        'passed': stable == set(range(6)) and reopened == 0
                  and before['activeTunnels'] >= 6 and after['activeTunnels'] >= 6,
        'stablePages': sorted(stable), 'callcenterConnections': len(connections),
        'callcenterOpenedInWindow': reopened,
        'allNamespacesTunnelsBefore': before['activeTunnels'],
        'allNamespacesTunnelsAfter': after['activeTunnels'],
    }
