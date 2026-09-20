# Follow-up FE / TLS / pilot — 2026-09-20

Host: `root@ipbx.krasterisk.ru` (`krasterisk_ipbx_agent`). No live Adaptive DSN overwrite. No autodial / `xray-ui`. No live tenant debit. No commercial launch.

## Verdict table

| Item | Verdict | Evidence |
|---|---|---|
| Full frontend vitest (Windows hang) | **PASS** (chunked runner) | `packages/frontend/scripts/vitest-run-src.cjs` — discovery hang at `RUN` bypassed; see [RELEASE-CHECKS](RELEASE-CHECKS.md) |
| Lab TLS signalling `127.0.0.1:15061` | **PASS** | Transport loaded; OPTIONS/REGISTER/INVITE → **401**; [sip-tls-15061.json](sip-tls-15061.json) |
| SRTP media path | **BLOCKED** | Signalling-only probe; `srtpMediaCertified: false` |
| NAT traversal | **BLOCKED** | Loopback only; `natCertified: false` |
| Pilot `productRuntime` flip | **PASS** (opt-in helper) | Default remains `not-installed`; see [PILOT-SMOKE](PILOT-SMOKE.md) |

## Lab TLS notes

1. Added disposable `[transport-ai-lab-tls]` on loopback `:15061` using existing `/etc/asterisk/keys/asterisk.{pem,key}`.
2. Host `sorcery.conf` lacked file wizards for `auth`/`aor` (realtime-only). Additive config wizards were inserted **before** realtime lines; Asterisk soft-restart required for sorcery re-read. Backup: `/etc/asterisk/sorcery.conf.bak-tls-lab`.
3. `evaluateSipProfile({ transport:'tls' })` stays disabled until `certified: true` (lab probe feeds `certifySipProfile`).
4. Production UDP `:5060` / WSS `:46782` untouched.

## Explicit non-claims

- Not a public TLS trunk certification.
- Not SRTP/NAT certification.
- Not commercial readiness / `cloud_wallet` on.
