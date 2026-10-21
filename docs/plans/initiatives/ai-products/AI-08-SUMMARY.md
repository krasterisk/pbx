# AI-08 SUMMARY

Realtime/SIP contracts, test-PBX UDP/ARI probe, and a **local paid-SIP emulator** (no PSTN).

## Done
- `VoiceModelSession` fake adapter, invocation replay hash, SIP connection/DID/invocation tables (`0017-ai-realtime.sql`).
- Secret-once endpoint, drain stops admissions, `external_sip` still cannot become ready without a certified applied revision.
- Hub SIP wizard copy. Capabilities: `realtime: false`, `externalSip: false`. Product `drain()` remains `{ liveSip: false }`.
- RT5 lab: PJSIP UDP 5060 OPTIONS 200 / bad REGISTER 403 / INVITE 100; ARI `:46781`/`:46782` 401. Evidence: [int-rt-tool6](evidence/int-rt-tool6/REMOTE-MATRIX.md).
- Local PSTN emulator: lab `+15555550xxx` only, emulated wallet pulse, 403/402/429, TLS/SRTP flags and NAT loss **in-process**. Evidence: [emulators](evidence/emulators/REMOTE-MATRIX.md).

## Not done
- Real carrier trunk, Asterisk `transport-tls` certificates, kernel netem between two hosts.
- Product `externalSip` / `liveSip` flags stay false until an applied certified revision is stored for a tenant connection.
