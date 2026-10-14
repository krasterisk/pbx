#!/usr/bin/env python3
"""Only the robot module's static/PHP files. No service, DB or host configuration mutation."""
import glob
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

ROOT = Path('/opt/krasterisk-voice-robots')
WEB = Path('/var/www/html/vpbx/modules/voice-robots')
STAGE = ROOT / 'releases/ui-r4-20261014'
ARCHIVE = ROOT / 'mpbx-r4-frontend.tar.gz'
EVIDENCE = ROOT / 'evidence'

def apps():
    return {a['name']: {'pid': a['pid'], 'status': a['pm2_env']['status'], 'restarts': a['pm2_env']['restart_time']} for a in json.loads(subprocess.check_output(['pm2', 'jlist']))}

def protected():
    files = glob.glob('/etc/asterisk/*.conf') + ['/var/www/html/vpbx/index.php'] + glob.glob('/etc/apache2/sites-enabled/*')
    return {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in files if Path(p).is_file()}

def stage(expected_hash):
    assert not STAGE.exists() and WEB.is_dir()
    assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == expected_hash
    baseline = {'apps': apps(), 'protected': protected(), 'asterisk_pid': subprocess.check_output(['pidof', 'asterisk']).decode().strip(), 'archive_sha256': expected_hash}
    (EVIDENCE / 'ui-r4-before.json').write_text(json.dumps(baseline, indent=2))
    STAGE.mkdir()
    with tarfile.open(ARCHIVE) as archive:
        for member in archive.getmembers():
            assert (STAGE / member.name).resolve().is_relative_to(STAGE)
            assert member.isfile() or member.isdir()
        archive.extractall(STAGE, filter='data')
    subprocess.run(['php', '-l', str(STAGE / 'module.php')], check=True)
    print(json.dumps({'stage': 'pass', 'archive_sha256': expected_hash, 'index_unchanged': True}))

def publish():
    baseline = json.loads((EVIDENCE / 'ui-r4-before.json').read_text())
    assert apps() == baseline['apps'] and protected() == baseline['protected']
    backup = EVIDENCE / 'ui-r4-module-backup'
    backup.mkdir()
    published = []
    # Hashed assets first; entry points and bridge files last. Existing assets retained.
    sources = sorted((p for p in STAGE.rglob('*') if p.is_file() and p.name != 'AGENTS.md'), key=lambda p: (p.suffix in ['.html', '.php', '.js'] and p.parent == STAGE, str(p)))
    for source in sources:
        relative = source.relative_to(STAGE)
        target = WEB / relative
        assert target.resolve().is_relative_to(WEB)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            saved = backup / relative; saved.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(target, saved)
        temporary = target.with_name(target.name + '.ui-r4.tmp')
        shutil.copy2(source, temporary); os.chmod(temporary, 0o644); os.replace(temporary, target)
        published.append(str(relative))
    assert apps() == baseline['apps'] and protected() == baseline['protected']
    assert subprocess.check_output(['pidof', 'asterisk']).decode().strip() == baseline['asterisk_pid']
    result = {'published': published, 'index_unchanged': True, 'protected_unchanged': True, 'all_pm2_unchanged': True, 'asterisk_pid_unchanged': True}
    (EVIDENCE / 'ui-r4-published.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))

def refresh(expected_hash):
    assert STAGE.is_dir() and not (EVIDENCE / 'ui-r4-published.json').exists()
    assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == expected_hash
    with tarfile.open(ARCHIVE) as archive:
        for member in archive.getmembers():
            assert (STAGE / member.name).resolve().is_relative_to(STAGE)
            assert member.isfile() or member.isdir()
        archive.extractall(STAGE, filter='data')
    subprocess.run(['php', '-l', str(STAGE / 'module.php')], check=True)
    print(json.dumps({'stage_refreshed': True, 'archive_sha256': expected_hash}))

if __name__ == '__main__':
    if sys.argv[1] == 'stage': stage(sys.argv[2])
    elif sys.argv[1] == 'publish': publish()
    elif sys.argv[1] == 'refresh': refresh(sys.argv[2])
    else: raise RuntimeError('Only module staging/publishing is supported; index.php edits require separate approval')
