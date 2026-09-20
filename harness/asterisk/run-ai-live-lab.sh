#!/bin/bash
set -euo pipefail
ROOT="${1:-.}"
cd "$ROOT"
LAB=/var/spool/asterisk/monitor/krasterisk-ai-lab
LOG=logs/ai-live-lab
mkdir -p "$LAB" "$LOG"
chmod 777 "$LAB"
install -d /etc/asterisk/krasterisk/ai-lab
cp -f harness/asterisk/ai-lab/extensions.conf /etc/asterisk/krasterisk/ai-lab/extensions.conf
cp -f harness/asterisk/ai-lab/pjsip.conf /etc/asterisk/krasterisk/ai-lab/pjsip.conf
if ! grep -q 'krasterisk/ai-lab/pjsip.conf' /etc/asterisk/pjsip.conf; then
  printf '\n#tryinclude krasterisk/ai-lab/pjsip.conf\n' >> /etc/asterisk/pjsip.conf
fi
asterisk -rx 'dialplan reload' >"$LOG/dialplan-reload.txt" 2>&1 || true
asterisk -rx 'module reload res_pjsip.so' >"$LOG/pjsip-reload.txt" 2>&1 || true
asterisk -rx 'dialplan show krasterisk-ai-lab' >"$LOG/dialplan-show.txt" 2>&1 || true
asterisk -rx 'pjsip show endpoints' >"$LOG/pjsip-endpoints.txt" 2>&1 || true
asterisk -rx 'cdr show status' >"$LOG/cdr-status.txt" 2>&1 || true
asterisk -rx 'core show channels count' >"$LOG/channels-before.txt" 2>&1 || true
rm -f "$LAB"/*.wav

originate() {
  local exten="$1"
  asterisk -rx "channel originate Local/${exten}@krasterisk-ai-lab application Wait 8" \
    >"$LOG/originate-${exten}.txt" 2>&1 || true
}

originate inbound
sleep 2
originate outbound
sleep 2
originate ivr
sleep 2
originate robot
sleep 2
originate transfer
sleep 2
originate pause
sleep 8

asterisk -rx 'core show channels count' >"$LOG/channels-after.txt" 2>&1 || true
ls -l "$LAB" >"$LOG/wav-list.txt" 2>&1 || true
{
  echo "WAV_COUNT=$(ls "$LAB"/*.wav 2>/dev/null | wc -l | tr -d ' ')"
  for wav in "$LAB"/*.wav; do
    [ -e "$wav" ] || continue
    echo "WAV $(basename "$wav") $(wc -c < "$wav" | tr -d ' ')"
  done
} >"$LOG/wav-summary.txt"

node harness/asterisk/sip-probe.cjs 5060 anonymous >"$LOG/sip-5060.json" || true
node harness/asterisk/sip-probe.cjs 15060 ai-lab-a >"$LOG/sip-15060.json" || true
ARI_HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:46781/ari/asterisk/info || echo 000)
ARI_HTTPS=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 3 https://127.0.0.1:46782/ari/asterisk/info || echo 000)
printf '{"http":"%s","https":"%s","up":%s}\n' "$ARI_HTTP" "$ARI_HTTPS" \
  "$( [ "$ARI_HTTP" = 401 ] || [ "$ARI_HTTPS" = 401 ] || [ "$ARI_HTTP" = 200 ] || [ "$ARI_HTTPS" = 200 ] && echo true || echo false )" \
  >"$LOG/ari-probe.json"
node harness/asterisk/run-int2-admission.cjs "$LAB" >"$LOG/int2-admission.json" || true
node harness/asterisk/run-tool6-eval.cjs >"$LOG/tool6-eval.json" || true

WAV_COUNT=$(ls "$LAB"/*.wav 2>/dev/null | wc -l | tr -d ' ')
SIP5060_OK=0
SIP15060_OK=0
python3 - "$LOG/sip-5060.json" "$LOG/sip-15060.json" "$LOG/ari-probe.json" "$LOG/int2-admission.json" "$LOG/tool6-eval.json" "$WAV_COUNT" <<'PY'
import json,sys
from pathlib import Path
def load(path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except Exception as exc:
        return {"error": str(exc)}
sip5060=load(sys.argv[1]); sip15060=load(sys.argv[2]); ari=load(sys.argv[3])
adm=load(sys.argv[4]); tool=load(sys.argv[5]); wav=int(sys.argv[6])
out={
  "int3_wav": wav,
  "int3_ok": wav>=3,
  "int2_duplicate": adm.get("duplicate",0)>=1,
  "int2_pause_skip": adm.get("pauseSkip") is True,
  "rt5_sip_5060": bool(sip5060.get("inviteOk") and sip5060.get("authRejectOk")),
  "rt5_sip_15060": bool(sip15060.get("inviteOk") and sip15060.get("authRejectOk")),
  "rt5_ari": bool(ari.get("up")),
  "tool6_recall": tool.get("recallAt5",0),
  "tool6_ok": bool(tool.get("ssrfDenied") and tool.get("phoneDenied") and tool.get("recallAt5",0)>=0.85),
}
print(json.dumps(out, indent=2))
Path("logs/ai-live-lab/summary.json").write_text(json.dumps(out, indent=2)+"\n", encoding="utf-8")
failed=[]
if not out["int3_ok"]: failed.append("int3")
if not out["int2_duplicate"] or not out["int2_pause_skip"]: failed.append("int2")
if not (out["rt5_sip_5060"] or out["rt5_sip_15060"]) or not out["rt5_ari"]: failed.append("rt5")
if not out["tool6_ok"]: failed.append("tool6")
if failed:
    print("FAILED "+",".join(failed))
    sys.exit(1)
print("AI_LIVE_LAB_OK")
PY
