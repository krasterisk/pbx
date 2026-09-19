# AI-00 — provider matrix

**Status:** contract inventory complete; no paid calls, latency benchmarks or accuracy claims were made.

| Profile | Existing reusable assets | Not safe to reuse as-is | AI-01/02 contract |
|---|---|---|---|
| Managed cloud LLM/STT/TTS | `CcAiProvider` holds encrypted key, endpoint, kind and declared capabilities; legacy voice robot has STT/TTS factories | `capabilities` and `pricing` are unversioned JSON; an endpoint is not proof of streaming/realtime behavior | Versioned capability snapshot, credential reference, health state, supported formats, timeout/retry and cost unit |
| Realtime speech-to-speech | `CcAiAgent.mode='realtime'` and provider labels exist | No VoiceSession, media transport adapter, interrupt semantics or provider event normalization | `VoiceModelSession` adapter behind a product-neutral voice runtime contract |
| Cascade | Existing agent fields distinguish model/STT/TTS and require STT/TTS in cascade mode | No durable turn/job/usage state; existing scripted robot pipeline is keyword-oriented | Per-session VAD, streaming STT, bounded tool loop, ordered TTS and cancellation epochs |
| BYOK | Tenant-owned encrypted provider secret supports a starting point | Existing service can accept provider `user_uid IN (0, tenant)` through AI agents; `0` is a BOX tenant, not global ownership | Provider binding verifies exact tenant, enabled state and capability at draft, publish and admission |
| Local/self-hosted | `kind='local'` and custom endpoint fields exist; Ollama-compatible chat mapping exists in voicemail | No hardware/OS/storage profile, offline license policy or proof that local endpoint supplies every speech capability | Local provider remains optional; analytics/robots can use a declared local capability set without mandatory SaaS egress |
| External analytics upload | Existing STT engines and voicemail prove asynchronous transcription patterns | Existing PBX modules assume a local recording path and are not an external upload API | Asset upload/probe pipeline accepts controlled objects and never trusts a caller filesystem path |

## Decisions carried into AI-01

1. Keep `CcAiProvider` as a compatibility inventory; do not expose its raw row as the new product provider contract.
2. Introduce a neutral provider capability vocabulary and immutable revision snapshot. Product runtime binds the snapshot, not a mutable endpoint/defaults JSON.
3. A provider belongs to exactly one tenant or is a separately modelled platform template with an explicit grant. The existing `[0, tenant]` read rule is not inherited.
4. BYOK/local runs emit usage but may be non-billable; managed-provider cost and customer pricing are separate later ledger concerns.
5. No provider/model is selected as a production default without the controlled RU telephony sample and cost/latency evaluation specified by AI-00.

## Deferred measurement

The following require a separately approved test budget and provider credentials: RU telephony STT word error rate, diarization, realtime interruption, first-audio latency, provider 429/outage behavior and per-unit supplier cost. They remain planned evidence, not inferred from vendor capability labels.
