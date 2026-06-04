# Phase 4 — Validation matrix

| REQ | Check | Type |
|-----|-------|------|
| REQ-301 | Add audio + TTS in one ordered list on «Фразы» | manual modal |
| REQ-302 | TTS phrase selects engine from TtsEngines | manual |
| REQ-303 | Per-phrase voice/speed overrides visible and saved | manual + unit merge test |
| REQ-304 | Dialplan contains CURL play-phrase for `kind:tts`, Background for audio | unit `generateIvrDialplan` |
| REQ-305 | No `string[]` / `tts:` in API after migration | code + unit normalize |
| REQ-305b | No new Prompts catalog entries on save | manual + code review |
| REQ-306 | Shared `IIvrPhrase` + backend validation | build shared + backend tests |
| REQ-307 | ru/en i18n for TTS UI | grep locales |
| REQ-308 | Preview/save errors show toast | manual |
| REQ-309 | Tests: normalize, dialplan, minimal editor | `npm run test:backend` / frontend |
| REQ-310 | `.docs/IVR_MODULE.md` updated | file exists |

## Commands

```bash
npm run build -w @krasterisk/shared
npm run build -w @krasterisk/backend
npm run build -w @krasterisk/frontend
npm run test:backend -- ivrs
npm run lint
```

## Nyquist

| Behavior | Automated | Manual |
|----------|-----------|--------|
| normalize legacy prompts | unit | open old IVR in modal |
| dialplan TTS line shape | unit | test call on staging PBX |
| preview audio plays | - | «Прослушать» button |
| google/custom engine | unit mock | engine type smoke |
