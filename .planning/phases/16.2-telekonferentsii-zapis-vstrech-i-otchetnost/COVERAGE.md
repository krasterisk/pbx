# Phase 16.2 — External API Coverage (Asterisk AMI ConfBridge record)

Asterisk AMI ConfBridge record actions are an external API. Default is INTEGRATE; every OPT-OUT has a one-line reason.

| API / option | Source | Decision | Reason |
|--------------|--------|----------|--------|
| `ConfbridgeStartRecord` | Official AMI action | **INTEGRATE** | D-31 auto and button share one start path after the meeting row exists. |
| `ConfbridgeStopRecord` | Official AMI action | **INTEGRATE** | D-31 stop on last leave and on moderator POST stop. Conference name only. |
| `RecordFile` (AMI field on StartRecord) | Official optional header | **INTEGRATE** | Server builds `{records_base_path}/{vpbx}/conferences/{room_uid}/{meeting_uid}.wav`. Client body never supplies this field (T-16.2-02). |
| `record_conference` (`CONFBRIDGE(bridge,record_conference)`) | Official bridge option yes/no | **OPT-OUT** | Native yes starts a monitor-directory file before `meeting_uid` exists and races AMI StartRecord; Phase 16 currently emits invalid `button`. AMI-only start is the product path. |
| `record_file` / `record_file_timestamp` / `record_file_append` via dialplan `CONFBRIDGE(bridge,…)` | Official bridge options | **OPT-OUT** | Path is owned by AMI `RecordFile` after INSERT. Timestamp-append would break the stored relative path (Pitfall 3). |
| `CONFBRIDGE(user,announcement)` | Official user option | **INTEGRATE** | D-32 join-time notice when `notify_recording` is true. Prompt id is the stock file `beep` (in-repo precedent in `call-group-confirm.util.ts`). |
| Play-to-all / `ConfbridgePlay` / Originate-into-conference playback | Not an official ConfBridge AMI action | **OPT-OUT** | No official play-to-all. Mid-call button start notifies the web via SSE `recording`; already-present SIP users rely on join-time announcement. |
| Per-leg `MixMonitor` / `CDR(record)` | In-repo conversation recording | **OPT-OUT** | Records one channel or points CDR at a WAV that the MP3 resolver cannot play. Violates D-30/D-31. |
| `record_command` ffmpeg postprocess | Official since 14 | **OPT-OUT** | Host has no ffmpeg; voicemail already streams WAV to `AudioPlayer`. Revisit only if a live ConfBridge slin file fails in Chrome (assumption A3). |
