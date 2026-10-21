# R7O5 — native phone acceptance preflight

2026-10-21, same coordinator/codex-direct/PLAN R7O. User explicitly authorized202/203 and desk201, requiring notice before201 rings. Cabinet clarified as admin; read-only DB mapped existing user58/tenant0. No passwords read or authentication tokens forged.

Read-only SQL and actual AMI inventory: e201_0 reachable/Not in use, e202_0 and ew202_0 Unavailable, no active test channels.203 does not exist in tenant0. Same extension numbers in other tenants explicitly excluded. No relevant active CC shifts or phone leases. Actual TLS WebSocket handshake to configured WSS succeeded with sip protocol. This proves signaling transport only, not REGISTER, media or a successful call.

Browser getState lists stale3526 inaccessible error pages; binding one was explicitly denied by browser URL security policy. No rawCDP/alternate browser/native workaround attempted. User asynchronously asked to open the legitimate current localhost3010/admin app, register202 WebRTC, report state/error, and not dial yet. Reply pending.

Local previous app was no longer listening. Restored current backend hidden PID19680 and frontend19564. Both5010/api/health and3010/api/health returned200. Boot logs confirm existing automatic subroutine and BLF apply; no manual endpoint/dialplan/config change. Files r7o5-backend/frontend logs record startup. No product changes or new model/STT calls in this slice. Both SQL/AMI read-only preflights completed/closed normally.

Evidence: R7O5-PHONE-PREFLIGHT.json and R7O5-TRANSPORT-PREFLIGHT.json. No calls made,201 not rung, no new CDR or card verification claimed. New QA scripts only; previous product tests are historical and not rerun for read-only inventory.

Next: user registers202 WebRTC through normal UI; then warn before201 call, bounded202↔201 success/no-answer, collect actual linkedid and compare journal/card/route/media/duration with current access.203 unavailable, do not silently create or use another-tenant203. Full WebRTC/browser and native CDR acceptance remain pending; keep main app running.
