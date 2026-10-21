# AI-06 SUMMARY

06A reporting contracts, INT1 capture policy, INT2 admission/relations/backfill, and INT3 MixMonitor/CDR lab on the **test** Asterisk at `ipbx.krasterisk.ru`. Generated-route native apply stays off.

## Done
- Additive `0015-sa-reporting.sql` / `0016-sa-native-int.sql` (MySQL + PostgreSQL), equal standalone lists.
- FilterSpec validation, signed cursor, CSV neutralization, budget reservation, bulk limit 1000.
- Hub dashboard/reports, tenant pause Switch with RTK undo, RouteForm analytics inherit/off/on.
- Capture resolver matrix: privacy → entitlement → pause → route → recording → project.
- INT2: UNIQUE origin admission, late CDR enrich, dual-permission relation read, backfill default disabled / no arbitrary path / uninstalled tenant skip.
- INT3: isolated `[krasterisk-ai-lab]` MixMonitor inbound/outbound/IVR/robot/transfer + pause-without-recording; CDR UniqueIDs match wav files. Evidence: [REMOTE-MATRIX](evidence/int-rt-tool6/REMOTE-MATRIX.md).
- Live SQL uniqueness: [REMOTE-MATRIX](evidence/rep-rt-tool/REMOTE-MATRIX.md). Dual-DB contracts: [contracts-0018](evidence/contracts-0018/REMOTE-MATRIX.md).

## Not done
- `nativeCaptureApply` / MixMonitor rewrite of generated customer routes (`DURABLE_CAPTURE` still default off).
- DB-03 native PG Asterisk writer; live КЦ/AutoDial module rows (ACL adapters exist).
- 50k snapshot EXPLAIN on production volume.
- Wallet debit (AI-10).
