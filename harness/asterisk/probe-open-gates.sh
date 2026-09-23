#!/bin/bash
# Honest probes for open gates. No DSN overwrite, no xray-ui, no live debit.
set -u
OUT="${1:-/tmp/open-gates-probe}"
mkdir -p "$OUT"

{
  echo "=== channels ==="
  asterisk -rx 'core show channels count'
  echo "=== res_srtp ==="
  asterisk -rx 'module show like res_srtp'
  echo "=== gpu ==="
  (command -v nvidia-smi && nvidia-smi -L) || echo 'NO_NVIDIA_SMI'
  echo "=== ollama ==="
  (command -v ollama && ollama list) || echo 'NO_OLLAMA'
  echo "=== whisper/faster ==="
  (command -v whisper; command -v faster-whisper) || echo 'NO_WHISPER_BIN'
  echo "=== mcp env names only ==="
  env | awk -F= '/MCP|OPENAI|ANTHROPIC|OLLAMA/ {print $1}' | sort -u
  echo "=== public ip ==="
  hostname -I | awk '{print $1}'
} >"$OUT/host.txt" 2>&1

# Lab SRTP: sibling *.conf under krasterisk/ai-lab is already loaded by
# `#include krasterisk/*/*.conf`. Do not nest another #include.
cat > /etc/asterisk/krasterisk/ai-lab/srtp-exten.conf <<'CONF'
[krasterisk-ai-lab-srtp]
exten => s,1,NoOp(lab srtp offer)
 same => n,Answer()
 same => n,Dial(PJSIP/ai-lab-tls,8)
 same => n,Hangup()
CONF
asterisk -rx 'dialplan reload' >"$OUT/dialplan-reload.txt" 2>&1 || true

# Enable brief RTP debug into a file via logger if possible — use CLI redirect
asterisk -rx 'core set verbose 3' >/dev/null 2>&1 || true
asterisk -rx "channel originate Local/s@krasterisk-ai-lab-srtp application Wait 3" >"$OUT/originate.txt" 2>&1 || true
sleep 2
asterisk -rx 'core show channels verbose' >"$OUT/channels-verbose.txt" 2>&1 || true
sleep 4
asterisk -rx 'core show channels count' >"$OUT/channels-after.txt" 2>&1 || true

# SDP crypto evidence from recent log lines (no secrets beyond crypto suite name)
grep -E 'a=crypto|SRTP|sdes|ai-lab-tls|UNREACHABLE|403|401|488' /var/log/asterisk/messages 2>/dev/null | tail -40 >"$OUT/srtp-log.txt" || true

echo "probe written $OUT"
cat "$OUT/host.txt"
echo '---ORIG---'
cat "$OUT/originate.txt"
echo '---SRTPLOG---'
tail -20 "$OUT/srtp-log.txt"
