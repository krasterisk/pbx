#!/usr/bin/env python3
"""Authenticated negative HTTP smoke only; every case fails before registration/originate."""
import importlib.util
import json
from pathlib import Path
import re
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('publisher',root/'publish.py')
pub=importlib.util.module_from_spec(spec); spec.loader.exec_module(pub)
code=pub.TARGET.read_text()
match=re.search(r"\$token\s*=\s*'([^']+)'\s*;",code)
assert match, 'Expected existing API bearer token configuration'
valid={'action':'call_tts','lead_id':'12345','tts':'mock validation only','phone':'79990000001'}
cases=[('missing_lead',{'lead_id':''}),('missing_tts',{'tts':''}),('missing_phone',{'phone':''}),
    ('bad_hook',{'answer_hook':'file:///not-used'}),('bad_ivr',{'ivr_id':'bad'}),('bad_channel',{'channel':'bad channel'})]
results=[]
for name,patch in cases:
    payload={**valid,**patch}
    req=Request('https://mpbx.krasterisk.ru/api/9057/index.php', data=urlencode(payload).encode(),
        headers={'Authorization':'Bearer '+match.group(1),'Content-Type':'application/x-www-form-urlencoded'},method='POST')
    try:
        with urlopen(req,timeout=15) as response:
            status=response.status; data=json.load(response)
    except HTTPError as error:
        status=error.code; data=json.load(error)
    assert status==400 and data.get('error') is True, (name,status)
    results.append({'case':name,'http_status':status})
before=json.loads((root/'before.json').read_text())
assert pub.invariants()==before
result={'http_negative_tests':results,'protected_files_unchanged':len(before['hashes']),
    'all_pm2_unchanged':True,'asterisk_pid_unchanged':True,'real_calls':0,'real_bitrix_requests':0,
    'published_sha256':pub.digest(pub.TARGET.read_bytes())}
(root/'verified.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
