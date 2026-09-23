#!/bin/bash
set -eu
CONF=/etc/asterisk/krasterisk/ai-lab/extensions.conf
if ! grep -q 'exten => srtpcheck' "$CONF"; then
  INCLUDE_LINE='#include krasterisk/ai-lab/srtp-exten.conf'
  TMP=$(mktemp)
  awk -v inc="$INCLUDE_LINE" '
    $0 == inc && !done {
      print "exten => srtpcheck,1,NoOp(lab srtp answer)"
      print " same => n,Answer()"
      print " same => n,Wait(1)"
      print " same => n,Hangup()"
      print ""
      done=1
    }
    { print }
  ' "$CONF" > "$TMP"
  mv "$TMP" "$CONF"
fi
asterisk -rx 'dialplan reload'
asterisk -rx 'dialplan show krasterisk-ai-lab' | grep srtpcheck || true
node /tmp/sip-probe-srtp.cjs 15061 ai-lab-tls ai-lab-tls-secret | tee /tmp/srtp-offer.json
