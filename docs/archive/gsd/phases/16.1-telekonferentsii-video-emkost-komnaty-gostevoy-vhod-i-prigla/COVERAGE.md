# Phase 16.1 — API Coverage

**Sealed:** 2026-09-16
**Decision:** extend existing AmiService / PJSIP realtime / Nest conference APIs. No new vendor SDK.

No external API integration: Phase 16.1 does not add a third-party HTTP/SDK client (no Stripe/Twilio/LiveKit/SFU vendor). Asterisk is the already-wired media/control plane from Phase 16; 16.1 only calls methods that already exist on `AmiService` and realtime tables.

## Asterisk / AMI surface (treated as existing platform API)

| Capability | Disposition | Reason |
|------------|-------------|--------|
| AMI `Originate` (`AmiService.originate`) | INTEGRATE | D-38 internal/external invite into `krsk-conf-{uid},s,1` |
| AMI `ConfbridgeKick` (`AmiService.action`) | INTEGRATE | D-12 revoke must drop live media, not only `revoked_at` |
| PJSIP realtime CRUD (`ps_endpoints` / `ps_auths` / `ps_aors` via `EndpointsService`) | INTEGRATE | D-10 ephemeral guest triple; D-23/D-24 `max_video_streams` + VP8 |
| AMI `pjsip reload` (`AmiService.pjsipReload`) | OPT-OUT | Spike 002 registered without reload (Open Q2); call only if REGISTER 404 on UAT |
| AMI `ConfbridgeList` / `ConfbridgeListRooms` | OPT-OUT | Live roster already comes from Phase 16 Join/Leave events + `ConferenceStateService` |
| AMI `ConfbridgeMute` / `Unmute` / `Lock` | OPT-OUT | Already Phase 16 moderation; 16.1 does not reopen |
| AMI `ConfbridgeStartRecord` / `StopRecord` | OPT-OUT | Phase 16.2 |
| ARI `createChannel` / `addChannelToBridge` | OPT-OUT | R-ENGINE closed on ConfBridge+AMI; D-10/D-38 must match the engine |
| New vendor SFU / WebRTC SDK | OPT-OUT | R-VIDEO closed on native `video_mode=sfu`; no npm packages |

## Nest HTTP surface added (first-party)

Guest public: `GET/POST /conferences/guest/:token`, `join`, `leave`, `events`, `webrtc-config`, `telemetry`, `me/display-name`.
Staff JWT: `GET :uid/capacity`, guest-token CRUD, `POST :uid/invite`, `POST :uid/telemetry`, `POST :room_uid/me/display-name`.
