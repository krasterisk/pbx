#!/usr/bin/env python3
"""Bounded module-only r5 shadow-gutter overlay; no service/config/data changes."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import urllib.request

spec = importlib.util.spec_from_file_location('baseline_tools', Path(__file__).with_name('deploy-ui-r5.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
archive = base.ROOT / 'mpbx-r5-shadows.tar.gz'
stage = base.ROOT / 'releases/ui-r5-shadows-20261014'
backup = base.EVIDENCE / 'ui-r5-shadow-backup'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == sys.argv[1]
assert not stage.exists() and not backup.exists()
baseline = json.loads((base.EVIDENCE / 'ui-r5-before.json').read_text())
assert base.apps() == baseline['apps'] and base.protected() == baseline['protected']
assert subprocess.check_output(['pidof', 'asterisk']).decode().strip() == baseline['asterisk_pid']
stage.mkdir()
with tarfile.open(archive) as package:
    for entry in package.getmembers():
        assert (stage / entry.name).resolve().is_relative_to(stage)
        assert entry.isfile() or entry.isdir()
    package.extractall(stage, filter='data')
subprocess.run(['php', '-l', str(stage / 'module.php')], check=True)
backup.mkdir(mode=0o700)
sources = sorted((p for p in stage.rglob('*') if p.is_file()), key=lambda p: (p.parent == stage, str(p)))
published = []
for source in sources:
    relative = source.relative_to(stage)
    target = base.WEB / relative
    assert target.resolve().is_relative_to(base.WEB)
    if target.exists() and target.read_bytes() == source.read_bytes():
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        saved = backup / relative
        saved.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, saved)
    temporary = target.with_name(target.name + '.ui-r5-shadows.tmp')
    shutil.copy2(source, temporary)
    os.chmod(temporary, 0o644)
    os.replace(temporary, target)
    published.append(str(relative))
assert base.apps() == baseline['apps'] and base.protected() == baseline['protected']
assert subprocess.check_output(['pidof', 'asterisk']).decode().strip() == baseline['asterisk_pid']
health = json.load(urllib.request.urlopen('http://127.0.0.1:5013/api/health', timeout=10))
result = {'archive_sha256': sys.argv[1], 'published': published,
    'protected_files_unchanged': len(baseline['protected']), 'index_unchanged': True,
    'all_pm2_unchanged': True, 'asterisk_pid_unchanged': True, 'apps': base.apps(), 'health': health}
(base.EVIDENCE / 'ui-r5-shadows-final.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result))
