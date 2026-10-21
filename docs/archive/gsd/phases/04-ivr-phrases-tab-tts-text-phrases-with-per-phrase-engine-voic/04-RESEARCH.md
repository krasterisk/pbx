# Phase 4: IVR TTS phrases — Research

**Researched:** 2026-06-04  
**Phase:** 04-ivr-phrases-tab-tts-text-phrases-with-per-phrase-engine-voic  
**Status:** Complete

## Objective

Add **TTS text phrases** on IVR tab «Фразы» with per-phrase engine/voice/speed, **runtime synthesis** at call time (no Prompts catalog WAV, no save-time materialization). Support yandex, google, custom engines.

## Runtime architecture (recommended)

### Pattern: internal CURL + ephemeral WAV (brownfield)

Krasterisk already uses **unauthenticated internal HTTP** from Asterisk dialplan:

| Endpoint | Auth | Use |
|----------|------|-----|
| `GET /api/internal/dialplan/phonebook-lookup` | `DIALPLAN_API_KEY` query | CURL from dialplan |
| `POST /api/internal/dialplan/*` | same | webhooks |

**Recommendation (D-16):** add `GET /api/internal/ivr/play-phrase` — dialplan passes **indices only** (no embedded text in URL):

```
same => n,Set(IVR_TTS_PATH=${CURL(${DIALPLAN_BACKEND_URL}/internal/ivr/play-phrase?ivr_uid=5&phrase_index=0&vpbx_user_uid=42&uniqueid=${UNIQUEID}&api_key=...})
same => n,ExecIf($["${IVR_TTS_PATH}" = ""|${IVR_TTS_PATH}" = "0"]?NoOp(IVR TTS failed))
same => n,Background(${IVR_TTS_PATH})
```

**Why not extend `say_bg.php` alone:** AGI scripts (`say.php`, `say_bg.php`) are **not in this repo**; they live on the Asterisk host. Extending them requires ops deploy and duplicates Nest TTS logic. CURL-to-Nest keeps synthesis in one place (tenant engine tokens, merge settings, provider matrix).

**Ephemeral WAV (allowed):** backend writes to `IVR_TTS_CACHE_DIR` (env, default under Asterisk spool) as `{vpbx_user_uid}/{hash}.wav`, returns **Asterisk-relative sound path** for `Background()`. File is **not** in Prompts catalog and **not** created on IVR save — only per-call (or short TTL cache keyed by hash of text+engine+settings).

### Legacy `AGI(say_bg.php,"text")` / `tts:` prefix

- Today: `ivr.prompts` as `string[]`; `tts:foo` → `AGI(say_bg.php,"foo")` with **no engine**.
- Phase 4: remove from **new** contract; **migrate** on read/save to `IIvrPhrase[]`.

### Routes `text2speech` (reference only)

`dialplan.util.ts` uses `AGI(say.php,"text")` without engine — out of phase scope; IVR uses richer internal API.

## TTS implementation matrix

| Engine type | Voice-robots today | Phase 4 `IvrTtsService` |
|-------------|-------------------|-------------------------|
| `yandex` | `YandexStreamingTtsProvider.synthesizeStream` (PCM chunks) | Reuse provider; batch to WAV via ffmpeg/pcm wrapper or existing util |
| `google` | Not implemented (warn) | **New:** Google Cloud Text-to-Speech REST (`text:synthesize`) using engine.token + merged settings |
| `custom` | Not implemented for TTS | **New:** HTTP POST to `engine.custom_url` with auth headers (mirror `CustomHttpSttProvider` pattern) |

Place service in `packages/backend/src/modules/ivrs/` (or `ivr-tts/` subfolder) to avoid coupling IVR dialplan to voice-robot session lifecycle. **Extract** Yandex call from `TtsProviderFactory` or inject factory as dependency.

## Preview (D-08, D-09)

| Endpoint | Auth | Behavior |
|----------|------|----------|
| `POST /api/ivrs/tts-preview` | JWT | Body: `{ text, engine_uid, settings? }`; tenant `vpbx_user_uid`; returns `audio/wav` or `audio/mpeg` stream |
| Reuse | — | Do **not** use stub `POST /prompts/synthesize` without rewrite |

Frontend: `<audio src={blobUrl}>` or existing player pattern; errors → toast (REQ-308).

## Data model

```ts
// packages/shared/src/types/ivr-phrase.types.ts
export type IIvrPhrase =
  | { kind: 'audio'; filename: string }
  | {
      kind: 'tts';
      text: string;
      engine_uid: number;
      settings?: {
        voice?: string;
        speed?: string | number;
        role?: string;
        pitch_shift?: string;
        language_code?: string;
        speaking_rate?: string;
      };
    };
```

**Merge at synth time:** `effectiveSettings = { ...engine.settings, ...phrase.settings }` with type-specific field mapping (google: `voice_name` ← `voice` override alias in service).

**Migration (D-03):** `normalizeIvrPrompts(raw: unknown): IIvrPhrase[]`

| Input | Output |
|-------|--------|
| `string` filename | `{ kind: 'audio', filename }` |
| `tts:text` | `{ kind: 'tts', text, engine_uid: 0 }` → UI forces engine pick before save OR block save with validation error |
| already objects | validate + pass through |

Run normalize in: `IvrsService` create/update, frontend modal load, optional one-shot DB migration script in plan 04-01.

## Dialplan generation changes

`IvrsService.generateIvrDialplan`:

1. Accept `IIvrPhrase[]` only (after normalize).
2. `audio` → unchanged `Background(/usr/records/{uid}/sounds/{filename})` with `sanitizeFilePath`.
3. `tts` → CURL play-phrase line per index (phrase_index in loop).
4. Remove `p.startsWith('tts:')` branch.

Use `AsteriskDialplanUtils.backendBaseUrl` + `dialplanApiKey` for URL construction (same as other internal dialplan helpers).

## Frontend (D-12–D-14)

| Component | Change |
|-----------|--------|
| `IvrPromptsEditor` | `value: IIvrPhrase[]`; mode toggle Audio/TTS; per-type fields from `TtsEngineFormModal` matrix |
| `IvrFormModal` | `prompts` state typed; pass through API |
| Shared | Export types; RTK mutation for preview |

Extract **phrase settings fields** into `IvrPhraseTtsFields.tsx` (copy field list from `TtsEngineFormModal` by `engine.type`, smaller subset).

## Security

| Threat | Mitigation |
|--------|------------|
| Internal API abuse | `DIALPLAN_API_KEY`; validate `ivr.user_uid === vpbx_user_uid` |
| Text injection in dialplan | No raw text in dialplan URL — index only |
| Cross-tenant engine | Load engine with `user_uid` match on preview + play-phrase |
| Path traversal on audio filenames | existing `sanitizeFilePath` |

## Testing (REQ-309)

| Test | Location |
|------|----------|
| `normalizeIvrPrompts` | `packages/shared` or backend unit |
| `generateIvrDialplan` TTS lines | `ivrs.service.spec.ts` |
| Phrase list UI | optional component test |

## Documentation (REQ-310)

Update `.docs/IVR_MODULE.md`: `IIvrPhrase`, preview API, internal `play-phrase` CURL contract, env `IVR_TTS_CACHE_DIR`, ops note if AGI fallback desired later.

## Plan split

| Plan | Wave | depends_on | Focus |
|------|------|------------|-------|
| 04-01 | 1 | [] | Shared types, normalize, DTO validation, `IvrTtsService` + google/custom, migration |
| 04-02 | 2 | [04-01] | Dialplan gen, `IvrsInternalController`, preview endpoint, env/docs |
| 04-03 | 2 | [04-01] | `IvrPromptsEditor` + API + i18n + tests |

Waves 2a/2b can execute in parallel after 04-01.

## Risks

| Risk | Mitigation |
|------|------------|
| CURL latency on every TTS phrase | Accept for v1; optional hash cache in play-phrase |
| Google API credentials invalid | Surface error in preview; dialplan NoOp + log |
| Legacy IVR without engine on migrated `tts:` | Validation on save: `engine_uid > 0` required |
| Asterisk cannot read Nest cache path | Document shared volume or write under `/usr/records/{uid}/sounds/.cache/` |

---

*Research complete — ready for PLAN.md execution.*
