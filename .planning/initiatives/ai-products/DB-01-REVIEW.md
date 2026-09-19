# DB-01 — independent implementation review

Date: 2026-09-18. Scope: DB-01 config, migrations/manifest/history/locks, driver behavior, harness/CI and cleanup. Reviewer: separate read-only agent `/root/audit_krasterisk_reuse`; implementation and disposition owner: current Codex coordinator. Final verdict: **PASS**, no open P0/P1/P2 findings in assigned scope.

| Severity | Finding | Disposition |
|---|---|---|
| P1 | mysql2 disables hostname validation when `ssl.verifyIdentity` is absent, even with `rejectUnauthorized: true`. A trusted certificate for another host could be accepted. | MySQL config now sets `verifyIdentity: true`. An offline regression drives the installed mysql2 TLS callback and rejects a mismatched SAN. |
| P2 | Absent PostgreSQL `ssl` allowed ambient `PGSSLMODE=no-verify`; empty configured password allowed fallback to ambient `PGPASSWORD`. | PG config now passes `ssl: false` when disabled and rejects empty password. A regression instantiates the installed `pg` Client with synthetic ambient variables and checks selected parameters. |

Reviewer independently reran `npm run test:db:unit`: **43/43 pass, 0 skipped**, and compared applied MySQL `0001-current-schema.sql` byte-for-byte to git HEAD; SHA-256 remains `8c18e47d94da3c3aeca3807eb44dbd0280433c1dedf96bef36470203d699543d`. The earlier pinned real-DB matrix passed on the designated test server: MySQL 8.4.11 9/9, PostgreSQL 17.11 8/8. The reviewer examined those logs but did not rerun containers. Real TLS certificate rotation/handshake and full PostgreSQL application compatibility are not claims of this review; DB-02/DB-03 own later gates.
