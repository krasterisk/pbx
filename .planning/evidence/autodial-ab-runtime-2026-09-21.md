# Autodial A/B remaining runtime — 2026-09-21

SSH identity used: `~/.ssh/krasterisk_ipbx_agent`
Public comment on that key: `cursor-agent-ipbx-phase16` (user-facing name `cursor-agent-ipbx`).

## PBX

| Host | Auth | Notes |
|---|---|---|
| `root@aipbx.krasterisk.ru` | Permission denied | Key not in authorized_keys for root |
| `root@ipbx.krasterisk.ru` | OK | hostname `work`, Asterisk certified-22.8-cert2 |

`module load app_amd` and `module load app_waitforsilence` are Running.

`app_waitforsilence.so` is at `/usr/lib/asterisk/modules/app_waitforsilence.so` (built 21 Sep 11:07). `WaitForSilence` is registered.

Because `autoload = no`, both were added after `app_playback.so` in `/etc/asterisk/modules.conf`:

```
load = app_amd.so
load = app_waitforsilence.so
```

Backup: `/etc/asterisk/modules.conf.bak-amd-wfs-20260921`. `Playback` is registered.

No production dialplan rewrite. No live subscriber calls. Isolated AMD voicemail call not run.

## Code closed against the A/B canvas

1. **B04 / A20** — `subscriberHoursAllowForSchedules` in originator. Interval source = enabled campaign windows + `tz_offset_min`. Empty schedules = 24/7 (no invented 09:00-20:00). Out-of-hours defers the task (`pending`, `next_attempt_at` +15m) without burning an attempt.
2. **B03** — unknown IANA zone fails closed in `zonedNow` / `scheduleAllows` (no UTC substitution).
3. **A21 / R2a** — `ac_campaigns.applied_revision`. Written after successful apply. Pacer `stale_apply` when saved revision differs. Boot ALTER + backfill.
4. **A17 lite** — heartbeat `leased_at` for this worker’s `leased` rows before each originate.
5. **Campaign delete** — explicit `ac_attempts` destroy before tasks so history is not left pointing at a missing campaign.
6. **R5 code** — voicemail tail: `TryExec(WaitForSilence)` then `Wait(2)` fallback, then tenant `Playback`.

## Still open

- Durable multi-worker fencing / second instance owner
- Isolated AMD voicemail call on PBX (apps ready; call not run)
- R6 SUMMARY / full frontend suite / GSD STATE
- Shared renderActionChain / TTS prep / save apply error in DTO
