# INT2 / INT3 / RT5 / TOOL6 live lab

Host: `ipbx.krasterisk.ru` (test Asterisk certified-22.8-cert2, 0 customer calls). Isolated context `[krasterisk-ai-lab]` via existing `#include krasterisk/*/*.conf`. Customer `custom/routes` and global `DURABLE_CAPTURE` were **not** rewritten. `xray-ui` was not touched. No wallet charge.

Harness: `harness/asterisk/run-ai-live-lab.sh`. Raw logs in this directory (no `pjsip show endpoints` dump).

## Summary

```json
{
  "int3_wav": 5,
  "int3_ok": true,
  "int2_duplicate": true,
  "int2_pause_skip": true,
  "rt5_sip_5060": true,
  "rt5_sip_15060": false,
  "rt5_ari": true,
  "tool6_recall": 1,
  "tool6_ok": true
}
```

## INT2 admission / relations / backfill

Local Jest `internal-admission.spec.ts` (duplicate ready, privacy skip, short/unscorable, late CDR enrich, dual-permission snippets, arbitrary path, backfill disabled, uninstalled tenant skip, same recordingUid different nodes).

JWT: `GET /speech-analytics/recordings/:id/relations` (status link, snippets withheld without transcript/audio rights), `POST /speech-analytics/backfill-preview` (default disabled, no client path).

Live after MixMonitor:

- 5 wav files → 4 queued (audio ≥200 bytes) + 1 unscorable (`ivr-*.wav` 44-byte header, MixMonitor after playback / no speech)
- second `asset.ready` on the same origin → **duplicate** (5 replays)
- pause originate answered and hung up **without** MixMonitor; admission `pause_new` → skip
- relation adapter kinds: cdr / callcenter / autodial

CDR `cdr-custom/Master.csv` UniqueIDs match wav names (excerpt, no PSTN numbers):

| scenario | channel | uniqueid | disposition | wav |
|---|---|---|---|---|
| inbound | Local/inbound@krasterisk-ai-lab | 1789872557.84 | ANSWERED | inbound-1789872557.84.wav 95084 / 5.94s |
| outbound | Local/outbound@krasterisk-ai-lab | 1789872559.86 | ANSWERED | outbound-1789872559.86.wav 95084 / 5.94s |
| ivr | Local/ivr@krasterisk-ai-lab | 1789872561.88 | ANSWERED | ivr-1789872561.88.wav 44 (unscorable) |
| robot | Local/robot@krasterisk-ai-lab | 1789872563.90 | ANSWERED | robot-1789872563.90.wav 95084 / 5.94s |
| transfer | Local/transfer Dial Local/inbound | 1789872565.94 / .98 | ANSWERED | inbound-1789872565.98.wav 95084 / 5.94s |
| pause | Local/pause@krasterisk-ai-lab | 1789872567.100 | ANSWERED | none |

CDR logging enabled (Adaptive ODBC + cdr-custom). Native PG Asterisk realtime writer (**DB-03**) is **not** claimed.

## INT3 MixMonitor matrix

`channel originate Local/<exten>@krasterisk-ai-lab application Wait 8`

After the run: **0 active channels / 0 active calls**. Pause call survived without a recording file.

Still **not** claimed: `nativeCaptureApply` / generated-route MixMonitor rewrite, stereo/`record_all` flags, CAP quarantine, 50k snapshot EXPLAIN, production campaigns.

## RT5 SIP / ARI

PJSIP UDP `0.0.0.0:5060` (existing test stack):

- OPTIONS → **200**
- REGISTER with wrong Digest → **403**
- INVITE → **100** then hangup of lab Local channels

ARI HTTP `46781` / HTTPS `46782` `/ari/asterisk/info` → **401** (service up, no secrets copied).

Lab transport `127.0.0.1:15060` loaded (`transport-ai-lab`) but OPTIONS/REGISTER returned **500**; UDP 5060 is the certified signalling profile.

Still **not** claimed: TLS/SRTP, NAT/jitter, paid PSTN, provider 429, CPS, `drain.liveSip=true`, `externalSip` product capability.

## TOOL6 fake MCP / lexical eval

Gates fixed before the run: 30 answerable + 15 unanswerable; recall@5 ≥ 0.85; SSRF deny; phone principal cannot `admin.mutate_pbx`; sampling/roots refused.

Live on ipbx (`tool6-eval.json`): `recallAt5=1`, `unanswerableEmpty=true`, `ssrfDenied=true`, `phoneDenied=true`, `samplingDenied=true`, profile `lexical_fallback`.

Still **not** claimed: dedicated vector index, groundedness/citation LLM eval, real CRM/MCP vendor adapters, `liveMcp=true` in product runtime.

## Local units

`internal-admission` + `mcp-eval` + `realtime-session` (incl. `certifySipProfile`): **3 suites / 10 tests** passed.
