# API Coverage — Phase 13 Custom Voicemail

**Written:** 2026-09-02  
**Surfaces:** OpenAI-compatible chat completions (thin HTTP client) + existing `SttProviderFactory.transcribe`  
**Default:** INTEGRATE. Every OPT-OUT has a one-line reason.  
**Not rows:** Asterisk `Record()`, Nest internal `/api/internal/dialplan/voicemail`, JWT/token stream endpoints (first-party HTTP, not third-party SDKs).

No new npm packages. Client is `fetch`/`axios` + `decryptSecret`. STT goes through `SttProviderFactory.transcribe` already in-repo.

---

## 1. LLM — OpenAI-compatible `POST /v1/chat/completions`

Canonical shape: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat). Seed endpoint: `CcAiProvider` vendor `openai`, `endpoint` `https://api.openai.com/v1/chat/completions`, `defaults.model` `gpt-4o-mini`.

| Capability | Disposition | Reason |
|------------|-------------|--------|
| `POST {endpoint}` JSON body | INTEGRATE | D-57 thin client; no SDK |
| `model` from `provider.defaults.model` | INTEGRATE | Seed + per-provider override |
| `temperature` from `defaults.temperature` (fallback `0.2`) | INTEGRATE | Deterministic-enough summaries |
| `messages[]` roles `system` + `user` | INTEGRATE | Fixed RU system prompt + capped transcript |
| Read `choices[0].message.content` | INTEGRATE | Official response path |
| Auth `bearer` → `Authorization: Bearer` | INTEGRATE | Seed `auth_type` |
| Auth `api_key_header` → `X-API-Key` | INTEGRATE | Alternate `CcAiProvider.auth_type` |
| `AbortSignal.timeout(30_000)` | INTEGRATE | Hangup-adjacent scanner must not block forever |
| Skip `endpoint` starting with `wss:` | INTEGRATE | Realtime seed must not be called as HTTP |
| Skip `kind=online` without HTTP chat path | INTEGRATE | Same as wss skip |
| Cap user transcript chars before send | INTEGRATE | Prompt-injection + token cost bound |
| Treat transcript as untrusted user content | INTEGRATE | T-13-05; never concatenate into system prompt |
| `stream` / SSE deltas | OPT-OUT | Summary is a short batch string; no UI stream |
| `tools` / function calling | OPT-OUT | No tools in the voicemail summary prompt |
| `response_format` / `json_schema` | OPT-OUT | Plain-text summary card, not structured extract |
| `n` > 1 completions | OPT-OUT | One summary per message |
| `logprobs` / `top_logprobs` | OPT-OUT | Not displayed |
| `seed` | OPT-OUT | Not required for operator-readable summary |
| `store` | OPT-OUT | Do not persist prompts at the vendor |
| `max_tokens` explicit cap | INTEGRATE | Bound output size for the details card |
| `top_p` / `presence_penalty` / `frequency_penalty` | OPT-OUT | Provider defaults via `temperature` only |
| Vision / `image_url` parts | OPT-OUT | Input is STT text, not images |
| Audio input on chat | OPT-OUT | Audio is transcribed by STT, not the LLM |
| Web search / hosted tools | OPT-OUT | Summary must not fetch the open web |
| Embeddings API | OPT-OUT | No retrieval index this phase |
| Assistants / Responses / Batch APIs | OPT-OUT | Chat completions only |
| Fine-tuning / files / moderation APIs | OPT-OUT | Out of D-57 scope |
| Official `openai` npm SDK | OPT-OUT | D-57 + no new packages |

**Pick rule (research Open Q2):** step `llm_provider_uid` if set; else first `enabled` HTTP `capabilities` contains `'llm'` for `user_uid IN (tenant, 0)`; none → store transcript only, do not mark `transcript_status=failed`.

---

## 2. STT — `SttProviderFactory.transcribe`

Canonical: `ISttProvider.transcribe(audioBuffer, language?)` — headerless PCM16 8 kHz mono (`stt-provider.interface.ts`). Factory routes `custom` → HTTP batch, `yandex` → temp stream (`provider-factory.ts`).

| Capability | Disposition | Reason |
|------------|-------------|--------|
| `transcribe(pcm16, language)` | INTEGRATE | D-57; scanner after `parseWavPcm16` |
| Language hint `ru-RU` default | INTEGRATE | Product locale; pass through to provider |
| `custom-http-stt` existing URL | INTEGRATE | Reuse allow-list; no new outbound URL on the step |
| `yandex-streaming-stt` via factory batch wrapper | INTEGRATE | Factory already wraps file audio |
| `parseWavPcm16` RIFF walk then caller checks `sampleRate===8000` and `channels===1` | INTEGRATE | D-71 |
| Reject non-16-bit / missing `data` chunk | INTEGRATE | Fail `transcript_status`, no silent success |
| `ISttStreamingProvider.createStream` from the scanner | OPT-OUT | File is complete; streaming API is for live robots |
| Diarization / multi-speaker | OPT-OUT | One caller leaving a message |
| Word-level timestamps | OPT-OUT | Surface L shows full text, not a transcript editor |
| Alternative hypotheses / n-best | OPT-OUT | One string in CDR details |
| Provider-specific punctuation flags | OPT-OUT | Use engine `settings` already stored on `SttEngine` |
| New STT vendor SDK | OPT-OUT | No new packages; no new provider class |
| ffmpeg / resample in Nest | OPT-OUT | Wrong rate → fail the attempt (A1), do not convert |

**Pick rule (research Open Q1):** step `stt_engine_uid` if set; else `SttEnginesService.findAll(tenant)` first row; empty → `transcript_status=not_configured` (D-63).

---

## 3. Notify attach (not a new vendor SDK)

Telegram `sendDocument` multipart and nodemailer `attachments[]` are existing HTTP/SMTP clients. WhatsApp / MAX / VK / webhook stay link-only (A4). Not listed as external-API rows beyond this note.
