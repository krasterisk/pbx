# AI-08 VERIFICATION

PLAN SHA-256 `A5C85F43B71812ECB26E70611524A7F4711280AFDDBB5DA12A6C3AB050635155`.

| Task | Evidence | Gate |
|---|---|---|
| RT1 | `realtime-session.ts` VoiceModelSession fake start/audio/close | No paid realtime provider |
| RT2 | Additive `0017-ai-realtime.sql`; secret-once SIP connection | Secret shown once. Drain `{liveSip:false}` |
| RT3 | Invocation replay UNIQUE(tenant, principal, deployment, external_call_id) | Duplicate 409 unit |
| RT4 | Hub `/ai-robots/sip`; capabilities `realtime: false`, `externalSip: false` | `external_sip` cannot ready without certified revision |
| RT5 | Live UDP 5060 + ARI 401 on test ipbx; `createPstnEmulator` lab DID + emulated wallet | No real PSTN. Emulator TLS/SRTP/NAT/CPS/429. Product `liveSip` still false |

Local units: `realtime-session`, `pstn-emulator`. Live signalling: [int-rt-tool6](evidence/int-rt-tool6/REMOTE-MATRIX.md). Emulator: [emulators](evidence/emulators/REMOTE-MATRIX.md). Product runtime `not-installed`.
