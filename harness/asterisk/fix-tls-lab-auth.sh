#!/bin/bash
set -euo pipefail
EVIDENCE_REMOTE="${1:-/tmp/krasterisk-tls-lab-fix}"
mkdir -p "$EVIDENCE_REMOTE"

cp -a /etc/asterisk/sorcery.conf /etc/asterisk/sorcery.conf.bak-tls-lab
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/asterisk/sorcery.conf')
text = p.read_text()
changed = False
if 'auth = config,pjsip.conf' not in text:
    needle = 'auth = realtime,ps_auths'
    if needle not in text:
        raise SystemExit('unexpected sorcery.conf: missing auth realtime line')
    text = text.replace(needle, 'auth = config,pjsip.conf,criteria=type=auth\n' + needle, 1)
    changed = True
if 'aor = config,pjsip.conf' not in text:
    needle = 'aor = realtime,ps_aors'
    if needle not in text:
        raise SystemExit('unexpected sorcery.conf: missing aor realtime line')
    text = text.replace(needle, 'aor = config,pjsip.conf,criteria=type=aor\n' + needle, 1)
    changed = True
p.write_text(text)
print('sorcery_changed=' + str(changed))
PY

grep -n 'auth \|aor \|endpoint ' /etc/asterisk/sorcery.conf | head -20 >"$EVIDENCE_REMOTE/sorcery-snip.txt"

asterisk -rx 'module reload res_pjsip.so' >"$EVIDENCE_REMOTE/pjsip-reload.txt" 2>&1 || true
sleep 2
asterisk -rx 'pjsip show auth ai-lab-tls-auth' >"$EVIDENCE_REMOTE/auth-show.txt" 2>&1 || true
asterisk -rx 'pjsip show aor ai-lab-tls' >"$EVIDENCE_REMOTE/aor-show.txt" 2>&1 || true
asterisk -rx 'pjsip show transports' >"$EVIDENCE_REMOTE/transports.txt" 2>&1 || true

cp -f /tmp/sip-probe-tls.cjs /tmp/sip-probe-tls.cjs 2>/dev/null || true
if [[ ! -f /tmp/sip-probe-tls.cjs ]]; then
  echo 'missing sip-probe-tls.cjs' >&2
  exit 1
fi
set +e
node /tmp/sip-probe-tls.cjs 15061 ai-lab-tls >"$EVIDENCE_REMOTE/sip-tls-15061.json" 2>"$EVIDENCE_REMOTE/sip-tls-15061.err"
echo "probe_exit=$?" | tee "$EVIDENCE_REMOTE/probe_exit.txt"
set -e
cat "$EVIDENCE_REMOTE/sip-tls-15061.json" || true
