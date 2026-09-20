# Follow-up FE / TLS / pilot — SUMMARY

Assignment `AI-11-followup-fe-tls-pilot`, 2026-09-20. Mode `codex-direct`. Baseline HEAD `936c5259`.

## Done

1. **Frontend vitest hang** — default discovery hangs at `RUN` on Windows; fixed via `scripts/vitest-run-src.cjs` chunked explicit-file runner + src-only include. Full suite: **264 files / 1421 tests, exit 0** (~18.5 min).
2. **Lab TLS SIP** — disposable `transport-ai-lab-tls` on `127.0.0.1:15061`; sorcery file wizards for auth/aor; probe OPTIONS/REGISTER/INVITE → **401**. SRTP media + NAT remain BLOCKED.
3. **Pilot smoke** — `healthProductRuntime` default `not-installed`; with pilot+schema+workers → `installed` / `pilot:true`. No commercial claim, no live debit.

## Non-claims

MET5, local-AI GPU, liveMcp, SRTP media, NAT, commercial launch, commit.
