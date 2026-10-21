# AI-00 — recording finalization and channel truth research

**Status:** code-path inventory and fixture contract complete; controlled Asterisk call matrix pending. **Date:** 2026-09-18.

## Observed recording path

| Mode | Source produced by Asterisk | Final artifact | Readiness evidence today |
|---|---|---|---|
| Mono route | `MixMonitor(... .wav, b)` by default; `record_all` removes `b` | MP3, 8 kHz mono, 32 kbit/s | Synchronous hangup conversion only when the route has `on_hangup`; otherwise MixMonitor postprocess is asynchronous |
| Stereo route | `MixMonitor(... .raw, D)` (`bD` by default) | MP3, 8 kHz two-channel, 64 kbit/s | Same distinction; `REC_STEREO=1` selects raw conversion |
| Route webhook | Hangup handler runs ffmpeg then invokes `/internal/dialplan/on-hangup` | webhook payload contains `record_path` without extension | Not a proven ready point: the inspected handler has no explicit StopMixMonitor or checked conversion exit code; close/probe/durable manifest evidence is still required |
| CDR | `CDR(record)` holds a relative base path | CDR/player resolves `.mp3` from it | A CDR row may predate conversion, file close or an external upload; it is not asset-ready evidence |

## Findings that affect analytics

1. Route recording already supports the required stereo capture shape. It should be preserved for speaker/channel-aware analytics; a mono recording must be labelled `mixed`, not silently treated as diarized stereo.
2. The generated filename is timestamp + caller fragment + extension. It can collide for simultaneous matching calls, so a future `media_asset.storage_key` must use a server-generated opaque asset ID or call correlation, not reuse this filename as its primary key.
3. The current hangup handler registration condition is effectively tied to `on_hangup`. Routes with recording but no webhook use background postprocess. A future asset finalizer must wait for an observed file probe/close and durable manifest write; it cannot use `CDR(record)` or a hangup event alone.
4. `record_path` is a relative operational path. It must never be accepted from an external analytics upload as authority over a filesystem location. The external API stores an uploaded object under a controlled key and treats caller metadata as untrusted.
5. Route, robot and standalone SIP capture must emit the same `asset.ready` contract only after probe, normalization metadata and durable state write. Analytics starts from that event, not from webhook delivery.

## Fixture manifest contract

The first asset fixture set must contain the following non-production samples and expected probe values:

| Fixture | Channels / format | Expected result |
|---|---|---|
| `mono-marker.wav` | mono PCM WAV | `ready`, `channel_strategy=mixed` |
| `stereo-lr-markers.raw` | interleaved signed 16-bit, 8 kHz, 2 channels | `ready`, `channel_strategy=separate`, left/right role mapping remains provisional |
| `identical-dual.wav` | two equal channels | `ready`, but detector may mark duplicated audio; do not bill two customer minutes by default |
| `truncated.wav` | incomplete WAV | `partial` or rejected with a machine reason; no silent zero score |
| `raw-missing-format.bin` | raw bytes without explicit metadata | rejected before STT/LLM |

Each fixture manifest record requires: opaque `assetId`, tenant fixture ID, original/normalized format, sample rate, channels, duration expectation, SHA-256, provenance (`route|robot|external`), correlation fields, state and reason. It must never contain a production filesystem path, provider secret or caller PII.

## Required live matrix before implementation acceptance

- incoming and outgoing route recordings;
- IVR-after-answer, scripted robot, transfer and early hangup;
- mono, stereo and `record_all` modes;
- recording finalization while backend is unavailable, followed by idempotent local-manifest registration;
- a collision test with equivalent calls in one second;
- file probe: duration, sample rate, channels and conversion failure.

The designated remote server can be used only after a disposable Asterisk test profile and cleanup plan are assigned. No live PBX or production recording was accessed during this research.

## Source evidence

- `packages/backend/src/modules/routes/route-recording.util.ts`
- `packages/backend/src/modules/routes/routes.service.ts`
- `packages/backend/src/shared/utils/dialplan-subroutines.util.ts`
- `packages/backend/src/modules/routes/dialplan-webhooks.controller.ts`
- [RECORDING-INTEGRATION](RECORDING-INTEGRATION.md)
