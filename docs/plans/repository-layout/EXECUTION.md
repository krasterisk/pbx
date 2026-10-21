# Repository layout — EXECUTION

- Coordinator: `/root chat01a15cc9-e096-7fd2-b4a1-319ff59dd48e`; mode `codex-direct`; единственный writer, subagents нет.
- Current plan: [PLAN r1](PLAN.md), все5 bounded tasks выполнены.
- Coordination: idle; CDR/Autodial/AI-products ownership возвращён с новыми paths.
- Status: implemented / targeted-tests-passed / local-filesystem-verified.
- Evidence: [REPORT](REPORT.md), [VERIFICATION](VERIFICATION.json); originals/index/journal во внешнем `migration/repository-layout-20261021`.
- Gates: integrity/links/ignore/index/fixture bytes PASS; docs28/artifact9/SIP12 PASS; lint/backend PASS на снимке13:32/13:34 до независимой правки controller (владелец «Заявка от Росттех», см.REPORT); full frontend FAIL вне продуктового scope миграции: 2630 passed/8 failed. Миграция не меняла product code; release not claimed.
- Next action: none for structural scope; product frontend failures remain with product coordinator. User review/commit is outside this assignment, no commit created.
- Baseline: main HEAD10308472a809ba42e501ccbd2d079a097b9a1222; prior dirty source preserved. Initial index and file originals are recoverable in evidence; no reset/stash/cleanup of other work.
