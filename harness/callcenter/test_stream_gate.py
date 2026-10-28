import unittest

from stream_gate import websocket_continuity


class StreamGateTest(unittest.TestCase):
    def setup_case(self):
        return {'start': 2000, 'end': 5000, 'connectionEvents': [
            {'page': page, 'openedAt': 1500, 'snapshots': [{}]} for page in range(6)
        ]}

    def test_separates_service_namespaces_from_six_cc_connections(self):
        browser = self.setup_case()
        browser['connectionEvents'].append({'page': 0, 'openedAt': 3000, 'snapshots': []})
        result = websocket_continuity(browser, {'activeTunnels': 7}, {'activeTunnels': 8}, 1000)
        self.assertTrue(result['passed'])
        self.assertEqual(result['callcenterOpenedInWindow'], 0)

    def test_rejects_a_cc_reconnect_even_when_six_tunnels_remain(self):
        browser = self.setup_case()
        browser['connectionEvents'][0]['closedAt'] = 2500
        browser['connectionEvents'].append({'page': 0, 'openedAt': 3000, 'snapshots': [{}]})
        self.assertFalse(websocket_continuity(browser, {'activeTunnels': 7}, {'activeTunnels': 7}, 1000)['passed'])

    def test_old_target_without_close_event_cannot_hide_missing_current_page(self):
        browser = self.setup_case()
        browser['connectionEvents'][-1]['openedAt'] = 900
        self.assertFalse(websocket_continuity(browser, {'activeTunnels': 7}, {'activeTunnels': 7}, 1000)['passed'])

    def test_low_proxy_count_rejects_unreported_network_closes(self):
        self.assertFalse(websocket_continuity(self.setup_case(), {'activeTunnels': 7}, {'activeTunnels': 2}, 1000)['passed'])


if __name__ == '__main__':
    unittest.main()
