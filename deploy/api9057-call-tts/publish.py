#!/usr/bin/env python3
"""Single-file guarded API extension. Never restart/reload services."""
import glob
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
TARGET = Path('/var/www/html/vpbx/api/9057/index.php')
SOURCE = Path('/var/www/html/vpbx/api/2/bx24_test.php')
EXPECTED = '1d81cadadb87415b326ebc90a799aa86d4352fa4b57b1ab9385e7b154404c948'
SOURCE_EXPECTED = '1ff7c282a295ff8e799a3809695d1e2d3eb1dd410ef5da6161882085778e8ede'
def digest(data): return hashlib.sha256(data).hexdigest()
def apps():
    return {p['name']: {'pid':p['pid'],'status':p['pm2_env']['status'],'restarts':p['pm2_env']['restart_time']} for p in json.loads(subprocess.check_output(['pm2','jlist']))}
def invariants():
    paths = glob.glob('/etc/asterisk/*.conf') + glob.glob('/etc/apache2/sites-enabled/*') + ['/var/www/html/vpbx/index.php',str(SOURCE)]
    return {'apps':apps(),'asterisk_pid':subprocess.check_output(['pidof','asterisk']).decode().strip(),
        'hashes':{p:digest(Path(p).read_bytes()) for p in paths if Path(p).is_file()}}
def main(mode):
    original=TARGET.read_bytes(); source=SOURCE.read_bytes()
    assert digest(original)==EXPECTED and digest(source)==SOURCE_EXPECTED
    assert b"$action==='call_tts'" not in original
    match=re.search(rb"define\(\s*'BITRIX_URL'\s*,\s*('(?:[^'\\]|\\.)*')\s*\)\s*;",source)
    assert match, 'Expected existing private Bitrix URL literal'
    branch=(ROOT/'branch.txt').read_bytes().strip()+b'\n'
    helper=(ROOT/'helpers.php').read_bytes().replace(b'<?php',b'',1).strip()
    helper=helper.replace(b'__CALL_TTS_BITRIX_URL_LITERAL__',match.group(1))
    marker=re.search(rb"\}elseif\s*\(\$action==='notification'\)\s*\{",original)
    assert marker
    insertion=marker.start()
    # Preserve PHP close tag and every original byte; add only one branch and functions.
    close=original.rfind(b'?>')
    if close<0: close=len(original)
    assert close>insertion
    candidate=original[:insertion]+branch+original[insertion:close]+b'\n'+helper+b'\n'+original[close:]
    restored=candidate[:insertion]+candidate[insertion+len(branch):]
    helper_start=close
    assert restored[helper_start:helper_start+len(helper)+2]==b'\n'+helper+b'\n'
    assert restored[:helper_start]+restored[helper_start+len(helper)+2:]==original
    staged=ROOT/'index.candidate.php'; staged.write_bytes(candidate); staged.chmod(0o600)
    subprocess.run(['php','-l',str(staged)],check=True)
    before=invariants()
    (ROOT/'before.json').write_text(json.dumps(before,indent=2))
    result={'before_sha256':EXPECTED,'after_sha256':digest(candidate),'surrounding_api_bytes_unchanged':True,'mode':mode}
    if mode=='publish':
        backup=ROOT/'index.before.php'
        assert not backup.exists()
        shutil.copy2(TARGET,backup); backup.chmod(0o600)
        assert invariants()==before and digest(TARGET.read_bytes())==EXPECTED
        temporary=TARGET.with_name('.index.call-tts.tmp.php')
        try:
            shutil.copy2(staged,temporary)
            stat=TARGET.stat(); os.chmod(temporary,stat.st_mode & 0o777); os.chown(temporary,stat.st_uid,stat.st_gid)
            os.replace(temporary,TARGET)
        finally:
            if temporary.exists():temporary.unlink()
        assert invariants()==before
        assert digest(TARGET.read_bytes())==digest(candidate)
        result.update(protected_files_unchanged=len(before['hashes']),all_pm2_unchanged=True,asterisk_pid_unchanged=True,backup=str(backup))
        (ROOT/'published.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
if __name__=='__main__':
    assert sys.argv[1] in ('stage','publish')
    main(sys.argv[1])
