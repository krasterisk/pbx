#!/usr/bin/env bash
# Disposable lab TLS transport on ipbx loopback :15061.
# Does NOT touch production UDP 5060 / WSS / Adaptive DSN / xray-ui.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KEY="${IPBX_SSH_KEY:-$HOME/.ssh/krasterisk_ipbx_agent}"
HOST="${IPBX_HOST:-root@ipbx.krasterisk.ru}"
REMOTE_DIR="/tmp/krasterisk-tls-lab-$$"
LOCAL_EVIDENCE="${1:-$ROOT/.planning/initiatives/ai-products/evidence/followup-fe-tls-pilot}"

mkdir -p "$LOCAL_EVIDENCE"
ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$HOST" "mkdir -p $REMOTE_DIR"
scp -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes \
  "$ROOT/harness/asterisk/ai-lab/pjsip.conf" \
  "$ROOT/harness/asterisk/sip-probe-tls.cjs" \
  "$HOST:$REMOTE_DIR/"

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$HOST" bash -s <<EOF
set -euo pipefail
install -d /etc/asterisk/krasterisk/ai-lab
cp -f $REMOTE_DIR/pjsip.conf /etc/asterisk/krasterisk/ai-lab/pjsip.conf
if ! grep -q 'krasterisk/ai-lab/pjsip.conf' /etc/asterisk/pjsip.conf; then
  printf '\n#tryinclude krasterisk/ai-lab/pjsip.conf\n' >> /etc/asterisk/pjsip.conf
fi
asterisk -rx 'module reload res_pjsip.so' >$REMOTE_DIR/pjsip-reload.txt 2>&1 || true
sleep 1
asterisk -rx 'pjsip show transports' >$REMOTE_DIR/transports.txt 2>&1 || true
asterisk -rx 'pjsip show endpoints' >$REMOTE_DIR/endpoints.txt 2>&1 || true
cp -f $REMOTE_DIR/sip-probe-tls.cjs /tmp/sip-probe-tls.cjs
node /tmp/sip-probe-tls.cjs 15061 ai-lab-tls >$REMOTE_DIR/sip-tls-15061.json 2>$REMOTE_DIR/sip-tls-15061.err || true
cat $REMOTE_DIR/sip-tls-15061.json || true
EOF

scp -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes \
  "$HOST:$REMOTE_DIR/*" "$LOCAL_EVIDENCE/" || true
ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$HOST" "rm -rf $REMOTE_DIR /tmp/sip-probe-tls.cjs" || true
echo "TLS lab evidence -> $LOCAL_EVIDENCE"
