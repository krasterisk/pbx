# AI-07 SUMMARY — versioned cascade robot contracts

Phase: AI-07 VR1–VR6. Product commercial runtime remains `not-installed`. Realtime publish and `external_sip` ready stay blocked until AI-08. Production PBX was not reconfigured. Native MixMonitor/ARI live calls were not executed.

## Delivered

- Additive `0013-ai-voice.sql` (MySQL + PostgreSQL): `cc_ai_agents` IF NOT EXISTS, drafts/versions/deployments, sessions/turns/events, call-control ops, tickets. No ALTER of the Sequelize `CcAiAgent` model; revision CAS lives on `ai_robot_drafts`.
- Voice engine: If-Match 428/409, realtime publish 409, deployment default disabled, sip cannot be `ready`, ticket HMAC 30s, UNIQUE ingress replay, barge-in epoch, serial playback, allowlisted tools, autodial attempt→session adapter without a second originate.
- Nest `/ai-voice` on robot-api and full PBX commercial composition. Analytics does not ship `ai-voice` HTTP.
- Route/autodial action `ai_voice_robot` (Stasis `krasterisk_ai_voice`) separate from scripted `voicerobot`.
- Hub studio `/ai-robots/studio`, session journal, browser preview with mic only after Start.
- Live SQL uniqueness/CHECK matrix: [REMOTE-MATRIX](evidence/vr-met/REMOTE-MATRIX.md).

## Not claimed

- VR6 live 10-session ARI/provider eval, barge-in latency on real media, chan_websocket probe.
- G1 ApplicationReplaced spike on the existing ipbx PBX.
- Realtime / external SIP (AI-08). Paid providers / wallet charge.
