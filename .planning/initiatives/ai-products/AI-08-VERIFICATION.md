# AI-08 VERIFICATION

PLAN SHA-256 `A5C85F43B71812ECB26E70611524A7F4711280AFDDBB5DA12A6C3AB050635155`.

| Task | Evidence | Gate |
|---|---|---|
| RT1 | `realtime-session.ts` VoiceModelSession fake start/audio/close | No paid realtime provider |
| RT2 | Additive `0017-ai-realtime.sql`; secret-once SIP connection | Secret shown once. Drain `{liveSip:false}` |
| RT3 | Invocation replay UNIQUE(tenant, principal, deployment, external_call_id) | Duplicate 409 unit |
| RT4 | Hub `/ai-robots/sip`; capabilities `realtime: false`, `externalSip: false` | `external_sip` cannot ready without certified revision |
| RT5 | Not executed | Live SIP/NAT/provider matrix **not** claimed |

Local units: `realtime-session`. Live SQL DID + invocation: [REMOTE-MATRIX](evidence/rep-rt-tool/REMOTE-MATRIX.md). Product runtime `not-installed`.
