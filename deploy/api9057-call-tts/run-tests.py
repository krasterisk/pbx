#!/usr/bin/env python3
"""Run PHP tests against local mock Bitrix only."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import subprocess
import threading
from pathlib import Path
from urllib.parse import parse_qs

requests = []
class MockBitrix(BaseHTTPRequestHandler):
    def do_POST(self):
        fields = parse_qs(self.rfile.read(int(self.headers['Content-Length'])).decode(), keep_blank_values=True)
        requests.append(fields)
        assert self.path == '/telephony.externalcall.register.json'
        assert fields['TYPE'] == ['1'] and 'USER_PHONE_INNER' in fields
        self.send_response(500 if fields['PHONE_NUMBER'] == ['79990000000'] else 200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"result":{"CALL_ID":"mock-b24-call"}}')
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), MockBitrix)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    subprocess.run(['php', '-d', 'display_errors=1', str(Path(__file__).with_name('test.php')), f'http://127.0.0.1:{server.server_port}/'], check=True)
    assert len(requests) == 4, f'Expected four valid mock registrations, got {len(requests)}'
    print('Mock registration validation PASS; no external requests')
finally:
    server.shutdown()
