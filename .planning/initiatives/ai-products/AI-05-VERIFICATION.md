# AI-05 VERIFICATION

PLAN SHA-256 `FFF05E6EE0300ADFA64EEDBEC98897BF2D066879AC057B7F104392E147E11240`.

| Task | Evidence | Gate |
|---|---|---|
| MET1 | `metric-engine.spec.ts`; live SQL unique key + type/weight CHECK | No SQL/JS from rubric. Duplicate key uniqueness |
| MET2 | Applicability AST / overall coverage units | Missing metadata → unknown, not false |
| MET3 | Reanalyze creates a new job + child run; review command_key unique 409 | Original result row not updated |
| MET4 | `SpeechAnalyticsProjectPage` metric editor + recording review UI | Keyboard/RU/EN copy present. No auto-publish |
| MET5 | [REMOTE-MATRIX](evidence/vr-met/REMOTE-MATRIX.md) | 30-call dual-human holdout **not** executed |

Local: lint 0 errors; backend 299 suites / 3088 passed (11 skipped); frontend targeted 8 files / 27 passed. Full frontend vitest hung at `RUN` on Windows.

Rollback: keep prior project version pointer; do not delete historical metric values or reviews.
