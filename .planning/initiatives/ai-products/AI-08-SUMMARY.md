# AI-08 SUMMARY

Realtime/SIP contracts without live PJSIP or paid provider sessions.

## Done
- `VoiceModelSession` fake adapter, invocation replay hash, SIP connection/DID/invocation tables (`0017-ai-realtime.sql`).
- Secret-once endpoint, drain stops admissions, `external_sip` still cannot become ready without a certified applied revision.
- Hub SIP wizard copy. Capabilities: `realtime: false`, `externalSip: false`.
- Live SQL uniqueness: [REMOTE-MATRIX](evidence/rep-rt-tool/REMOTE-MATRIX.md).

## Not done
- RT5 live SIP/NAT/provider matrix, real originate gateway, certified TLS/SRTP profiles.
