#!/usr/bin/env python3
"""Scoped update: stage in this module only, switch its dist, restart its one PM2 app, check protected services."""
import base64
import glob
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.request

ROOT = Path('/opt/krasterisk-voice-robots')
RELEASE = ROOT / 'releases' / 'mcp-r3-20261013'
WEB = Path('/var/www/html/vpbx/modules/voice-robots')
ARCHIVE = ROOT / 'mpbx-r3-release.tar.gz'
EVIDENCE = ROOT / 'evidence'

def apps():
    rows = json.loads(subprocess.check_output(['pm2', 'jlist']))
    return {p['name']: {'pid': p['pid'], 'status': p['pm2_env']['status'], 'restarts': p['pm2_env']['restart_time']} for p in rows}

def protected():
    files = glob.glob('/etc/asterisk/*.conf') + ['/var/www/html/vpbx/index.php'] + glob.glob('/etc/apache2/sites-enabled/*')
    return {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in files if Path(p).is_file()}

def robot_channels():
    c = json.loads(Path('/etc/krasterisk-voice-robots/backend.json').read_text())
    prefix = str(c.get('ARI_HTTP_PREFIX', '')).strip('/')
    base = '{}://{}:{}{}/ari/applications/{}'.format(c.get('ARI_PROTOCOL', 'http'), c.get('ARI_HOST', '127.0.0.1'), c.get('ARI_PORT', 8088), '/' + prefix if prefix else '', c['ARI_APP_NAME'])
    request = urllib.request.Request(base, headers={'Authorization': 'Basic ' + base64.b64encode((c['ARI_USER'] + ':' + c['ARI_PASSWORD']).encode()).decode()})
    with urllib.request.urlopen(request, timeout=5) as response:
        return len(json.load(response).get('channel_ids', []))

def health():
    with urllib.request.urlopen('http://127.0.0.1:5013/api/health', timeout=3) as response:
        return json.load(response)

def stage(expected_hash):
    if not ROOT.is_dir() or not WEB.is_dir() or RELEASE.exists():
        raise RuntimeError('Unexpected module paths or already staged release')
    if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() != expected_hash:
        raise RuntimeError('Archive hash mismatch')
    before = {'apps': apps(), 'protected': protected(), 'robot_channels': robot_channels(),
              'asterisk_pid': subprocess.check_output(['pidof', 'asterisk']).decode().strip()}
    if before['robot_channels'] != 0:
        raise RuntimeError('Active robot session: do not update')
    EVIDENCE.mkdir(exist_ok=True)
    (EVIDENCE / 'mcp-r3-before.json').write_text(json.dumps(before, indent=2))
    RELEASE.mkdir(parents=True)
    subprocess.run(['tar', '-xzf', str(ARCHIVE), '-C', str(RELEASE)], check=True)
    subprocess.run(['nice', '-n', '15', 'ionice', '-c', '3', 'npm', 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', str(RELEASE / 'npm-cache')], cwd=RELEASE, check=True)
    c = json.loads(Path('/etc/krasterisk-voice-robots/backend.json').read_text())
    subprocess.run(['chown', '-R', '{}:{}'.format(c['RUNTIME_UID'], c['RUNTIME_GID']), str(RELEASE)], check=True)
    credentials = Path('/var/lib/krasterisk-voice-robots')
    credentials.mkdir(mode=0o700, exist_ok=True)
    os.chown(credentials, c['RUNTIME_UID'], c['RUNTIME_GID']); os.chmod(credentials, 0o700)
    for filename in ['api.php', 'mcp.php']:
        subprocess.run(['php', '-l', str(RELEASE / 'frontend' / filename)], check=True)
    print(json.dumps({'stage': 'pass', 'robot_channels': 0, 'archive_sha256': expected_hash, 'release': str(RELEASE)}))

def activate():
    before = json.loads((EVIDENCE / 'mcp-r3-before.json').read_text())
    current = apps()
    for name, app in before['apps'].items():
        if name != 'krasterisk_voice_robots' and current.get(name) != app:
            raise RuntimeError('Existing PM2 app changed before activation')
    if protected() != before['protected'] or robot_channels() != 0:
        raise RuntimeError('Protected config changed or robot session active')
    backup = ROOT / 'releases' / 'pre-mcp-r3-20261013'
    backup.mkdir()
    for name in ['api.php', 'mcp.php']:
        if (WEB / name).exists(): shutil.copy2(WEB / name, backup / name)
    shutil.move(str(ROOT / 'dist'), str(backup / 'dist'))
    os.symlink(str(RELEASE / 'dist'), str(ROOT / 'dist'))
    try:
        subprocess.run(['pm2', 'restart', 'krasterisk_voice_robots'], check=True, stdout=subprocess.DEVNULL)
        for attempt in range(30):
            try:
                h = health()
                if h.get('ari') and h.get('vad'): break
            except Exception: pass
            time.sleep(1)
        else: raise RuntimeError('New backend health did not become ready')
        # Publish only new docs/MCP gateway and the compatible module-owned API gateway. Frontend bundle stays intact.
        for name in ['api.php', 'mcp.php', 'AGENTS.md', 'scenario.schema.json', 'mcp-access.html', 'mcp-client.cjs']:
            shutil.copy2(RELEASE / 'frontend' / name, WEB / name)
            os.chmod(WEB / name, 0o644)
        shutil.copytree(RELEASE / 'frontend' / 'examples', WEB / 'examples', dirs_exist_ok=True)
        for p in (WEB / 'examples').glob('*.json'): os.chmod(p, 0o644)
        current = apps()
        for name, app in before['apps'].items():
            if name != 'krasterisk_voice_robots' and current.get(name) != app: raise RuntimeError('Existing PM2 app changed')
        if protected() != before['protected']: raise RuntimeError('Protected config changed')
        if subprocess.check_output(['pidof', 'asterisk']).decode().strip() != before['asterisk_pid']: raise RuntimeError('Asterisk PID changed')
        after = {'apps': current, 'health': h, 'protected_unchanged': True, 'asterisk_pid_unchanged': True, 'robot_channels': robot_channels()}
        (EVIDENCE / 'mcp-r3-after.json').write_text(json.dumps(after, indent=2))
        print(json.dumps(after))
    except Exception:
        (ROOT / 'dist').unlink()
        os.symlink(str(backup / 'dist'), str(ROOT / 'dist'))
        for name in ['api.php', 'mcp.php']:
            if (backup / name).exists(): shutil.copy2(backup / name, WEB / name)
        subprocess.run(['pm2', 'restart', 'krasterisk_voice_robots'], check=True, stdout=subprocess.DEVNULL)
        raise

def refresh(expected_hash):
    if not RELEASE.is_dir() or (ROOT / 'dist').is_symlink():
        raise RuntimeError('Refresh permitted only for an unactivated staged release')
    if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() != expected_hash:
        raise RuntimeError('Archive hash mismatch')
    subprocess.run(['tar', '-xzf', str(ARCHIVE), '-C', str(RELEASE)], check=True)
    c = json.loads(Path('/etc/krasterisk-voice-robots/backend.json').read_text())
    subprocess.run(['chown', '-R', '{}:{}'.format(c['RUNTIME_UID'], c['RUNTIME_GID']), str(RELEASE / 'dist')], check=True)
    (EVIDENCE / 'mcp-r3-package.json').write_text(json.dumps({'archive_sha256': expected_hash, 'release': str(RELEASE)}))
    print(json.dumps({'stage_refreshed': True, 'archive_sha256': expected_hash}))

def finalize(expected_hash):
    """Activate the tested final package, reusing unchanged isolated dependencies."""
    final = ROOT / 'releases' / 'mcp-r3-final-20261013'
    link = ROOT / 'dist'
    if not link.is_symlink() or final.exists():
        raise RuntimeError('Unexpected current or final release')
    if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() != expected_hash:
        raise RuntimeError('Archive hash mismatch')
    previous = link.resolve()
    if previous != RELEASE / 'dist':
        raise RuntimeError('Unexpected current release target')
    before = {'apps': apps(), 'protected': protected(), 'asterisk_pid': subprocess.check_output(['pidof', 'asterisk']).decode().strip()}
    if robot_channels() != 0: raise RuntimeError('Robot session active')
    final.mkdir()
    subprocess.run(['tar', '-xzf', str(ARCHIVE), '-C', str(final)], check=True)
    for name in ['package.json', 'package-lock.json']:
        if (final / name).read_bytes() != (RELEASE / name).read_bytes():
            raise RuntimeError('Dependency manifest changed: cannot reuse dependencies')
    os.symlink(str(RELEASE / 'node_modules'), str(final / 'node_modules'))
    c = json.loads(Path('/etc/krasterisk-voice-robots/backend.json').read_text())
    subprocess.run(['chown', '-R', '{}:{}'.format(c['RUNTIME_UID'], c['RUNTIME_GID']), str(final / 'dist')], check=True)
    if protected() != before['protected'] or apps() != before['apps'] or robot_channels() != 0:
        raise RuntimeError('Baseline changed before switch')
    temporary = ROOT / 'dist-next-r3'
    if temporary.exists() or temporary.is_symlink(): raise RuntimeError('Unexpected switch path')
    os.symlink(str(final / 'dist'), str(temporary)); os.replace(temporary, link)
    try:
        subprocess.run(['pm2', 'restart', 'krasterisk_voice_robots'], check=True, stdout=subprocess.DEVNULL)
        for attempt in range(30):
            try:
                h = health()
                if h.get('ari') and h.get('vad'): break
            except Exception: pass
            time.sleep(1)
        else: raise RuntimeError('Final backend health did not become ready')
        current = apps()
        for name, app in before['apps'].items():
            if name != 'krasterisk_voice_robots' and current.get(name) != app: raise RuntimeError('Existing PM2 app changed')
        if protected() != before['protected']: raise RuntimeError('Protected config changed')
        if subprocess.check_output(['pidof', 'asterisk']).decode().strip() != before['asterisk_pid']: raise RuntimeError('Asterisk PID changed')
        result = {'release': str(final), 'archive_sha256': expected_hash, 'apps': current, 'health': h, 'protected_unchanged': True, 'protected_files': len(before['protected']), 'asterisk_pid_unchanged': True, 'robot_channels': robot_channels()}
        (EVIDENCE / 'mcp-r3-final-release.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
    except Exception:
        os.symlink(str(previous), str(temporary)); os.replace(temporary, link)
        subprocess.run(['pm2', 'restart', 'krasterisk_voice_robots'], check=True, stdout=subprocess.DEVNULL)
        raise

if __name__ == '__main__':
    if sys.argv[1] == 'stage': stage(sys.argv[2])
    elif sys.argv[1] == 'activate': activate()
    elif sys.argv[1] == 'refresh': refresh(sys.argv[2])
    elif sys.argv[1] == 'finalize': finalize(sys.argv[2])
    else: raise RuntimeError('Unsupported action')
