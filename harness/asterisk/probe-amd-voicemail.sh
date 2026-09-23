#!/bin/bash
# Isolated Local AMD + leave-message tail. No real subscribers, no campaign start.
set -eu
CTX="codex-ac-vm-$(date +%Y%m%d%H%M%S)"
DIR=/etc/asterisk/krasterisk/autodial
FILE="$DIR/${CTX}.conf"
OUT=/tmp/${CTX}.out
MARKER="KRSK_AC_VM_${CTX}"
mkdir -p "$DIR"

cleanup() {
  asterisk -rx "core show channels concise" 2>/dev/null | awk -F'!' -v ctx="$CTX" '$0 ~ ctx {print $1}' | while read -r ch; do
    [ -n "$ch" ] && asterisk -rx "channel request hangup $ch" >/dev/null 2>&1 || true
  done
  rm -f "$FILE"
  asterisk -rx "dialplan reload" >/dev/null 2>&1 || true
}
trap cleanup EXIT

python3 - "$FILE" "$CTX" "$MARKER" <<'PY'
import sys
path, ctx, marker = sys.argv[1], sys.argv[2], sys.argv[3]
open(path, "w", encoding="utf-8").write(f"""[{ctx}]
exten => machine,1,Answer()
 same => n,Set(TIMEOUT(absolute)=25)
 same => n,Playback(hello-world)
 same => n,Playback(hello-world)
 same => n,Wait(8)
 same => n,Hangup()

exten => run,1,NoOp({marker} start)
 same => n,Answer()
 same => n,AMD()
 same => n,NoOp({marker} AMD=${{AMDSTATUS}}/${{AMDCAUSE}})
 same => n,GotoIf($["${{AMDSTATUS}}" = "MACHINE"]?vm)
 same => n,NoOp({marker} not-machine)
 same => n,Hangup()
 same => n(vm),NoOp({marker} machine-tail)
 same => n,TryExec(WaitForSilence(300,2,5))
 same => n,NoOp({marker} TRY=${{TRYSTATUS}})
 same => n,ExecIf($["${{TRYSTATUS}}"!="SUCCESS"]?Wait(2))
 same => n,Playback(beep)
 same => n,NoOp({marker} PLAY=beep)
 same => n,Hangup()
""")
PY

{
  echo "CTX=$CTX"
  echo "=== modules ==="
  asterisk -rx "module show like app_amd"
  asterisk -rx "module show like app_waitforsilence"
  echo "=== apps ==="
  asterisk -rx "core show application AMD" | head -8
  asterisk -rx "core show application WaitForSilence" | head -8
  asterisk -rx "core show application Playback" | head -4
  echo "=== reload ==="
  asterisk -rx "dialplan reload"
  asterisk -rx "dialplan show ${CTX}"
  echo "=== originate ==="
  asterisk -rx "core set verbose 3"
  asterisk -rx "channel originate Local/machine@${CTX}/n extension run@${CTX}"
  sleep 16
  echo "=== channels after ==="
  asterisk -rx "core show channels count"
  echo "=== log ==="
  grep -E "${MARKER}|${CTX}" /var/log/asterisk/full /var/log/asterisk/messages 2>/dev/null | tail -50 || true
} | tee "$OUT"

echo "PROBE_OUT=$OUT"
# Keep a copy after cleanup removes the conf; evidence lives in OUT.
cp "$OUT" "/tmp/codex-ac-vm-latest.out"
