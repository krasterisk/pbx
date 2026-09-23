# AMD leave-message (B05 / R5) — implementation + isolated live gate

Date: 2026-09-21. Host: `root@ipbx.krasterisk.ru`. Isolated Local loopback only. No campaign start, no real subscriber.

## Implemented in code

- `IAutodialAmdConfig.message_prompt` — tenant Prompts filename
- UI: «Оставить сообщение» selectable; prompt required when enabled
- Dialplan machine tail: `TryExec(WaitForSilence(300,2,5))` → `Wait(2)` fallback → `Playback(/usr/records/{tenant}/sounds/{stem})` → `attempt-machine?outcome=voicemail` → Hangup
- `assertAmdReady`: resolves prompt file on disk before start; still requires `app_amd` Running
- Finalize maps `amd_result=VOICEMAIL` → disposition `voicemail`

## Isolated live call (2026-09-21 12:50 UTC+3)

Context `codex-ac-vm-20260921125040` written under `/etc/asterisk/krasterisk/autodial`, originated `Local/machine@ctx/n` → `run@ctx`, then removed.

| Step | Result |
|---|---|
| `app_amd.so` | Running |
| `app_waitforsilence.so` | Running |
| Greeting | two `Playback(hello-world)` |
| AMD | `MACHINE/MAXWORDS-3-2` (`iWordsCount:3`) |
| Machine tail | entered |
| `WaitForSilence(300,2,5)` | `TRYSTATUS=SUCCESS` |
| Leave-message media | `Playback(beep)` → `PLAY=beep` |
| After cleanup | context absent, 0 channels, 0 calls |

This proves the machine-branch order AMD → silence pocket → Playback. It does not prove a tenant prompt file from Prompts, CURL `attempt-machine`, or a campaign attempt row.

## Not in this slice

- ML/ASR AMD
- Guaranteed beep detection beyond WaitForSilence
- Campaign-path voicemail with `message_prompt` from Prompts
- Quality threshold on a labeled human/machine corpus
