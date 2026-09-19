# AI-06 SUMMARY

Contracts for 06A reports and INT1 capture policy. Native MixMonitor apply, CDR/КЦ live links and INT3 matrix are not claimed.

## Done
- Additive `0015-sa-reporting.sql` / `0016-sa-native-int.sql` (MySQL + PostgreSQL), equal standalone lists.
- FilterSpec validation, signed cursor, CSV neutralization, budget reservation, bulk limit 1000.
- Hub dashboard/reports, tenant pause Switch with RTK undo, RouteForm analytics inherit/off/on.
- Capture resolver matrix: privacy → entitlement → pause → route → recording → project.
- Live SQL uniqueness: [REMOTE-MATRIX](evidence/rep-rt-tool/REMOTE-MATRIX.md).

## Not done
- INT2/INT3 live Asterisk, MixMonitor rewrite, CDR/КЦ/AutoDial live links, 50k snapshot EXPLAIN on production volume.
- Wallet debit (AI-10).
