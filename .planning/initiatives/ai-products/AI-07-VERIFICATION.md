# AI-07 VERIFICATION

PLAN SHA-256 `0F9520F243CDB3AEA33FE2E4A16FD0BDDC6A1A11CE6F3466500C2DB6F3D9F78E`.

| Task | Evidence | Gate |
|---|---|---|
| VR1 | Unit `ai-voice.spec.ts` publish CAS; Nest If-Match on `ai-agents`; live SQL drafts/versions/deployments | Writes without revision 428. Realtime publish 409. No auto-ready deployment |
| VR2 | Ticket consume + ARI classifier + RTP spoof unit tests | Classifier implemented. G1 live ApplicationReplaced spike **not** executed |
| VR3 | Turn coordinator barge-in / serial playback / late callback units | Fake adapters only. No paid STT/LLM/TTS |
| VR4 | `ai_voice_robot` dialplan/autodial; tools allowlist; attempt adapter units | Scripted `voicerobot` unchanged. No second originate |
| VR5 | Hub studio/sessions/preview; preview test asserts no getUserMedia until Start | Browser WSS live call **not** executed |
| VR6 | [REMOTE-MATRIX](evidence/vr-met/REMOTE-MATRIX.md) MySQL **2/2** + PG **2/2** SQL | Native ARI/media 10-session live **not** executed |

Local: lint 0 errors; backend 299 suites / 3088 passed (11 skipped); frontend targeted 8 files / 27 passed (full vitest hung at `RUN` on Windows, same baseline as prior slices). Analytics/robot image rebuild not re-run this turn.

Rollback: leave deployments `disabled`. Do not rename Stasis apps on a live PBX.
