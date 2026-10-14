#!/usr/bin/env python3
"""Run ONLY after human approval for the exact one-line index.php replacement."""
import hashlib
import json
import os
from pathlib import Path
import runpy
import stat
import subprocess
import sys

ROOT = Path('/opt/krasterisk-voice-robots')
INDEX = Path('/var/www/html/vpbx/index.php')
WEB = Path('/var/www/html/vpbx/modules/voice-robots')
EVIDENCE = ROOT / 'evidence'
EXPECTED = 'b34b6951d7008399c12ad1804ba7a9fb9d5ba4748024c158c5a7be258016abc0'
OLD = b'include("modules/voice-robots/standalone.html");'
NEW = b'include("modules/voice-robots/module.php");'

def replace_index(content, metadata):
    temporary = INDEX.with_name('.index-voice-robots-r4.php')
    assert not temporary.exists()
    temporary.write_bytes(content)
    os.chown(temporary, metadata.st_uid, metadata.st_gid)
    os.chmod(temporary, stat.S_IMODE(metadata.st_mode))
    try:
        subprocess.run(['php', '-l', str(temporary)], check=True)
        os.replace(temporary, INDEX)
    finally:
        if temporary.exists(): temporary.unlink()

if __name__ == '__main__':
    assert sys.argv[1:] == ['--human-approved-single-include'], 'Human approval required; do not infer it'
    helpers = runpy.run_path(str(ROOT / 'deploy-ui.py'))
    baseline = json.loads((EVIDENCE / 'ui-r4-before.json').read_text())
    assert helpers['apps']() == baseline['apps'] and helpers['protected']() == baseline['protected']
    assert INDEX.is_file() and not INDEX.is_symlink()
    before = INDEX.read_bytes(); metadata = INDEX.stat()
    assert hashlib.sha256(before).hexdigest() == EXPECTED and before.count(OLD) == 1 and before.count(NEW) == 0
    after = before.replace(OLD, NEW)
    assert after.replace(NEW, OLD) == before
    backup = EVIDENCE / 'ui-r4-index-before.php'
    assert not backup.exists(); backup.write_bytes(before); os.chmod(backup, 0o600)
    replace_index(after, metadata)
    try:
        assert INDEX.read_bytes() == after and helpers['apps']() == baseline['apps']
        current = helpers['protected']()
        assert {p:h for p,h in current.items() if p != str(INDEX)} == {p:h for p,h in baseline['protected'].items() if p != str(INDEX)}
        assert subprocess.check_output(['pidof', 'asterisk']).decode().strip() == baseline['asterisk_pid']
    except Exception:
        if INDEX.read_bytes() == after: replace_index(before, metadata)
        raise
    result = {'index_before_sha256': EXPECTED, 'index_after_sha256': hashlib.sha256(after).hexdigest(), 'exact_single_include_replacement': True,
              'other_index_bytes_unchanged': True, 'all_pm2_unchanged': True, 'asterisk_pid_unchanged': True, 'other_protected_files_unchanged': True}
    (EVIDENCE / 'ui-r4-connected.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
