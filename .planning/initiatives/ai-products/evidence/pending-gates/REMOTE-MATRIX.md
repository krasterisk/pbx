# Pending gates — 2026-09-20 close-out

Assignment after AI-11 11M. Coordinator `codex-direct`. Host: `root@ipbx.krasterisk.ru` (`krasterisk_ipbx_agent`). Raw probe: [host-probe.txt](host-probe.txt). **No** overwrite of live Adaptive DSN (`MySQL-krasterisk` / `krasterisk`). **No** autodial / `xray-ui`. **No** live tenant debit.

## Verdict table

| Gate | Verdict | Evidence |
|---|---|---|
| Host unixODBC / Asterisk module load | **PASS** | 6 ODBC modules `Running`; DSN `krasterisk` active; MySQL ODBC 8.4 drivers present. Live DSN not modified. |
| MET5 30-call dual-human holdout | **BLOCKED** | Requires ≥30 dual-human labeled calls + kappa/MAE. No holdout corpus / labelers on this stand. Synthetic fixtures must not close MET5 ([AI-05-PLAN](../AI-05-PLAN.md)). |
| Real local-AI STT hardware | **BLOCKED** | No `nvidia-smi`, no `ollama` on ipbx. Fake STT fixtures remain non-closing ([AI-11-11A](../AI-11-11A-UAT.md)). |
| TLS / SRTP / NAT certification | **BLOCKED** | Host PJSIP transports: UDP `:5060`, lab UDP `127.0.0.1:15060`, WSS only. **No** TLS transport. Keys exist under `/etc/asterisk/keys` but unused for TLS SIP. UDP OPTIONS path previously measured (int-rt-tool6); does not certify TLS/SRTP/NAT. |
| `liveMcp=true` | **BLOCKED** | TOOL6 was fake MCP / lexical recall only (`liveMcp:false`). Real vendor MCP + product flag not enabled ([int-rt-tool6](../evidence/int-rt-tool6/REMOTE-MATRIX.md)). |

## Host ODBC / module load (PASS)

```
cdr_adaptive_odbc.so … Running
cel_odbc.so … Running
func_odbc.so … Running
res_config_odbc.so … Running
res_odbc.so … Running (Use Count 5)
res_odbc_transaction.so … Running
ODBC Name: krasterisk / DSN: MySQL-krasterisk / active connections: 1
Drivers: libmyodbc8w.so + libmyodbc8a.so
libodbc.so present
```

I4 installer evidence (generate + disposable SQL writer, no `--apply-live`) remains [evidence/i4](../evidence/i4/REMOTE-MATRIX.md). This gate closes **host load/running**, not a new live DSN apply.

With `i4Evidence: true` (host modules verified), `evaluateSipProfile({ transport: 'udp', nativePbx: true, i4Evidence: true })` is no longer forced to `native_pbx_gated` by the I4 evidence bit alone (TLS still unsupported until certified).

## Explicit non-claims

- Live Adaptive DSN secrets not read or replaced.
- TLS/SRTP/NAT not certified.
- MET5 / local-AI / liveMcp remain open.
- Commercial readiness and default `productRuntime: not-installed` handled in later steps of this assignment.
