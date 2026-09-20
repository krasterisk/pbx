#!/bin/bash
set -euo pipefail
ROOT="${1:-.}"
cd "$ROOT"
LOG=logs/ai-generated-mixmonitor
DATE=$(date +%Y%m%d)
REC=/usr/records/8/calls/$DATE
mkdir -p "$LOG" "$REC"
chmod 777 /usr/records /usr/records/8 /usr/records/8/calls "$REC" || true
install -d /etc/asterisk/krasterisk/ai-lab
cp -f harness/asterisk/ai-lab/generated.conf /etc/asterisk/krasterisk/ai-lab/generated.conf
if ! grep -q 'krasterisk/ai-lab/generated.conf' /etc/asterisk/extensions.conf; then
  printf '\n#tryinclude krasterisk/ai-lab/generated.conf\n' >> /etc/asterisk/extensions.conf
fi
asterisk -rx 'dialplan reload' >"$LOG/dialplan-reload.txt" 2>&1 || true
asterisk -rx 'dialplan show krasterisk-ai-generated' >"$LOG/dialplan-show.txt" 2>&1 || true
if ! grep -q 'Exten s' "$LOG/dialplan-show.txt"; then
  cat /etc/asterisk/krasterisk/ai-lab/generated.conf >> /etc/asterisk/krasterisk/ai-lab/extensions.conf
  asterisk -rx 'dialplan reload' >>"$LOG/dialplan-reload.txt" 2>&1 || true
  asterisk -rx 'dialplan show krasterisk-ai-generated' >"$LOG/dialplan-show.txt" 2>&1 || true
fi
asterisk -rx 'core show channels count' >"$LOG/channels-before.txt" 2>&1 || true
find "$REC" -name '*.wav' -delete 2>/dev/null || true
asterisk -rx 'channel originate Local/s@krasterisk-ai-generated application Wait 8' \
  >"$LOG/originate.txt" 2>&1 || true
sleep 8
asterisk -rx 'core show channels count' >"$LOG/channels-after.txt" 2>&1 || true
ls -l "$REC" >"$LOG/wav-list.txt" 2>&1 || true
{
  echo "WAV_COUNT=$(find "$REC" -name '*.wav' | wc -l | tr -d ' ')"
  find "$REC" -name '*.wav' -printf 'WAV %f %s\n' 2>/dev/null || true
} >"$LOG/wav-summary.txt"
if [ -f /var/log/asterisk/cdr-csv/Master.csv ]; then
  tail -n 20 /var/log/asterisk/cdr-csv/Master.csv >"$LOG/cdr-master-tail.csv" || true
fi
if [ -d /var/log/asterisk/cdr-custom ]; then
  find /var/log/asterisk/cdr-custom -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n 3 | while read -r _ path; do
    tail -n 5 "$path"
  done >"$LOG/cdr-custom-tail.txt" || true
fi
python3 - "$LOG/wav-summary.txt" "$LOG/channels-after.txt" <<'PY'
from pathlib import Path
import re, sys
summary = Path(sys.argv[1]).read_text(encoding='utf-8', errors='replace')
channels = Path(sys.argv[2]).read_text(encoding='utf-8', errors='replace')
wav = 0
uuid = 0
for line in summary.splitlines():
    if line.startswith('WAV_COUNT='):
        wav = int(line.split('=', 1)[1] or 0)
    if re.search(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.wav', line, re.I):
        uuid += 1
active = -1
for line in channels.splitlines():
    m = re.search(r'(\d+)\s+active channels', line)
    if m:
        active = int(m.group(1))
        break
print(f'generated_ok={wav >= 1 and uuid >= 1 and active == 0} wav={wav} uuid={uuid} channels={active}')
PY
