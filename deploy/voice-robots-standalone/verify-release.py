#!/usr/bin/env python3
"""Read-only final production invariants; run from the private module directory."""
import hashlib
import json
from pathlib import Path
import runpy
import stat
import subprocess
import urllib.request

ROOT = Path('/opt/krasterisk-voice-robots')
WEB = Path('/var/www/html/vpbx/modules/voice-robots')
helpers = runpy.run_path(str(ROOT / 'release-mcp.py'))
before = json.loads((ROOT / 'evidence/mcp-r3-before.json').read_text())
current = helpers['apps']()
for name, app in before['apps'].items():
    if name != 'krasterisk_voice_robots': assert current.get(name) == app, name
assert helpers['protected']() == before['protected'], 'Protected files changed'
assert subprocess.check_output(['pidof', 'asterisk']).decode().strip() == before['asterisk_pid'], 'Asterisk PID changed'
health = helpers['health']()
assert health.get('ari') and health.get('vad'), 'Backend readiness'
credentials_file = Path('/var/lib/krasterisk-voice-robots/mcp-credentials.json')
assert stat.S_IMODE(credentials_file.stat().st_mode) == 0o600
assert not any(row['name'].startswith('__mcp_r3_smoke') for row in json.loads(credentials_file.read_text()))
public = {}
for name in ['AGENTS.md', 'scenario.schema.json', 'examples/basic.scenario.json', 'examples/directory.scenario.json', 'mcp-access.html', 'mcp-client.cjs', 'standalone.html']:
    with urllib.request.urlopen('https://mpbx.krasterisk.ru/modules/voice-robots/' + name, timeout=10) as response:
        content = response.read()
        assert response.status == 200 and content == (WEB / name).read_bytes(), name
        public[name] = {'http': response.status, 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)}
assert (ROOT / 'dist/standalone-voice-robots/AGENTS.md').read_bytes() == (WEB / 'AGENTS.md').read_bytes()
with urllib.request.urlopen('https://mpbx.krasterisk.ru/', timeout=10) as response:
    assert response.status == 200
for command in [['asterisk', '-rx', 'core show uptime'], ['asterisk', '-rx', 'core show channels count'], ['free', '-m'], ['uptime']]:
    print(subprocess.check_output(command).decode().strip())
result = {'apps': current, 'asterisk_pid_unchanged': True, 'protected_files_unchanged': len(before['protected']), 'existing_ui_http': 200, 'health': health, 'robot_channels': helpers['robot_channels'](), 'temporary_mcp_credentials_removed': True, 'credential_file_mode': '600', 'public': public}
(ROOT / 'evidence/mcp-r3-final.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result))
