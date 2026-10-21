# Phase 11 — Plan Check Report (Iteration 2/3)

**Checked:** 2026-08-04  
**Checker:** gsd-plan-checker (Revision Gate)  
**Phase:** 11 — Harness Layer (external black-box infrastructure)  
**Plans reviewed:** 8 (`11-01` … `11-08`)  
**Verdict:** **PASS** — 0 blockers, 4 warnings

---

## Executive Summary

All five blockers from iteration 1 are **resolved**. Plans are structurally valid (`verify.plan-structure` passes on all 8), the dependency graph is acyclic, locked decisions D-H01…D-H06 and D-01…D-24 map to executable tasks, and the e2e absorb cycle is correctly staged: Plan 04 migrates content while retaining `e2e/` for interim CI; Plan 08 creates `harness.yml`, retires `e2e.yml`, and deletes `e2e/` only after local CI-equivalent green.

Four non-blocking warnings remain (verify quality, scope borderline, pattern citations). Execution may proceed.

---

## Prior Blocker Resolution

| ID | Issue | Status | Evidence |
|----|-------|--------|----------|
| B1 | Plan 04 deleted `e2e/` before CI migrated | **FIXED** | Plan 04 objective/T3 action: migration only; `must_haves` truth retains `e2e/` until Plan 08. Plan 08 T2 deletes `e2e/` after `harness.yml` green. |
| B2 | Plan 07 forward-ref Plan 08 template | **FIXED** | Plan 07 T3 copies from `.github/workflows/e2e.yml`; no Plan 08 reference. |
| B3 | RESEARCH Open Questions unresolved | **FIXED** | `11-RESEARCH.md` § `Open Questions (RESOLVED)` with inline RESOLVED on items 1–3. |
| B4 | Plan 03 unsafe verify (`2>/dev/null \|\|`) | **FIXED** | T2 verify: `npm run harness:api -- --tag moh` + `npm run test:backend -- --testPathPattern=moh.controller` (no suppression). |
| B5 | Plan 05 unsafe verify (require `.ts` + fallback) | **FIXED** | T2: `npx tsx -e "import { startScenario…}"`; T3: sequential `npm run harness:api` then `test -f` (no `\|\|` fallback). |

**Plan 02 strengthen (W1):** Tasks 2–3 now use `npx tsx -e "import …"` smoke verifies instead of grep-only counts. Task 1 retains `require \|\| tsx` fallback (see W1 below — warning only).

---

## Phase Goal Traceability

| Goal element (ROADMAP + CONTEXT) | Covering plan(s) | Task(s) | Status |
|----------------------------------|------------------|---------|--------|
| `/harness` workspace + Runner | 11-01 | tracer, auto | Covered |
| `GET /api/health` (D-H06) | 11-01 | tracer | Covered |
| Environment + seed/teardown (D-08, D-15, D-16) | 11-02 | all 3 | Covered |
| Auth + MOH CRUD API (D-01, D-02) | 11-03 | both | Covered |
| UI agent/supervisor + SSE (D-03, D-04) | 11-04 | all 3 | Covered |
| Absorb/delete `e2e/` (D-H01, D-23) | 11-04, 11-08 | 04-T3 migrate, 08-T2 delete | Covered |
| Metrics + Reporter triad (D-11) | 11-05 | all 3 | Covered |
| Harness OTel only (D-H05) | 11-06 | both | Covered |
| Asterisk gated + ami-events (D-05–D-07, D-H03) | 11-07 | T1–T3 + checkpoint | Covered |
| CI Node 22 + workers=1 (D-09, D-12, D-24) | 11-08 | all 3 | Covered |

ROADMAP lists **Requirements: TBD** — coverage validated against locked CONTEXT decisions (D-H* + D-01…D-24).

---

## e2e/ Deletion Timing (Critical Path)

```
Plan 04 (wave 4):  migrate specs/fixtures → harness/; update root scripts; KEEP e2e/
                   e2e.yml still valid (working-directory: e2e)
Plan 05–07:        harness grows; e2e/ unchanged; PR CI still green via e2e.yml
Plan 08 (wave 8):  create harness.yml (Node 22) → verify local green → delete e2e/ + retire e2e.yml
```

This satisfies D-H01 (“delete after green”) and D-23 (absorb includes CI update before delete). No CI gap between Plan 04 merge and Plan 08 merge.

---

## Dimension Results

### 1. Requirement / Decision Coverage — PASS

All locked decisions have implementing tasks. Deferred ideas absent from plans.

### 2. Task Completeness — PASS

All 8 plans valid; 22 implementation tasks + 1 checkpoint. All `auto`/`tracer` tasks have files, action, verify, done.

### 3. Dependency Correctness — PASS

```
W1: 11-01
W2: 11-02 → 01
W3: 11-03 → 02
W4: 11-04 → 03
W5: 11-05 → 04
W6: 11-06 → 05
W7: 11-07 → 06
W8: 11-08 → 07
```

Acyclic; wave numbers match `depends_on`. No forward references.

### 4. Key Links Planned — PASS

| Link | Plan coverage |
|------|---------------|
| harness.yml → npm test in harness | 11-08 T1 |
| e2e/ retained until CI switch | 11-04 T3 + 11-08 T2 |
| harness-asterisk.yml from e2e.yml | 11-07 T3 |
| Reports → CI artifacts | 11-05 + 11-08 T2 |

### 5. Scope Sanity — WARNING

Plan 07 has 4 tasks (incl. checkpoint) — borderline but acceptable with human-verify gate for live lab.

### 6. Verification Derivation — PASS

`must_haves.truths` are user-observable. Artifacts and key_links map to truths.

### 7. Context Compliance — PASS

D-H01/D-23 absorb cycle correctly staged across Plans 04 and 08. No scope reduction on locked decisions. Deferred ideas excluded.

### 7c. Architectural Tier Compliance — PASS

Tasks align with RESEARCH § Architectural Responsibility Map.

### 8. Nyquist Compliance — PASS (with warnings)

**8e VALIDATION.md:** ✅ exists

**8a Automated verify:** All implementation tasks include `<automated>` — PASS

**8b Feedback latency:** Full `npm run harness` in Plans 05/08 — WARNING (~60–180s per VALIDATION.md)

**8c Sampling continuity:** No 3 consecutive tasks without `<automated>` — PASS

**8d Wave 0:** `harness.yml` created in Plan 08 before `e2e/` deletion — PASS

**Verify format sanity:** Plans 03/05 blockers fixed. Plan 02 T1 retains `||` fallback (W1).

### 9. Cross-Plan Data Contracts — PASS

### 10. `.cursor/rules/` Compliance — SKIPPED (no `.cursor/rules/`)

### 11. Research Resolution — PASS

`## Open Questions (RESOLVED)` with inline resolutions.

### 12. Pattern Compliance — WARNING

Plans reference `@11-PATTERNS.md` in context; several task actions omit explicit analog citations (executor can still succeed).

---

## Threat Model / ASVS L1 — PASS

All 8 plans include `<threat_model>` with trust boundaries and STRIDE register.

---

## Tracer-First / One-PR-per-Plan — PASS

Every plan leads with `type="tracer"`. ROADMAP PR-1…PR-8 maps 1:1 to plans 01…08.

---

## Warnings (non-blocking)

### W1. Plan 02 Task 1 `||` fallback verify `[verify_format_sanity]`

`node -e "require(…readiness.ts)" 2>&1 || npx tsx … --dry-run` masks require failure. Prefer single `npx tsx harness/environment/readiness.ts --dry-run`.

### W2. Plan 06 Task 1 fragile span grep `[nyquist_compliance]`

`grep -i scenario || grep -i span` may false-pass. Prefer asserting structured OTel console output.

### W3. Plan 07 four tasks `[scope_sanity]`

Borderline scope; acceptable given blocking human-verify checkpoint for live lab.

### W4. Pattern analogs not in task actions `[pattern_compliance]`

Add one-line PATTERNS.md analog citation per new file in `<action>` where helpful.

---

## Structured Issues

```yaml
issues:
  - plan: "11-02"
    dimension: verify_format_sanity
    severity: warning
    description: "Task 1 verify uses require() || tsx fallback that masks first command failure"
    task: 1
    fix_hint: "Replace with single npx tsx harness/environment/readiness.ts --dry-run"

  - plan: "11-06"
    dimension: nyquist_compliance
    severity: warning
    description: "Task 1 span verify relies on grep -i scenario || grep -i span; may false-pass"
    task: 1
    fix_hint: "Assert OTEL_TRACES_EXPORTER=console structured output or exit code"

  - plan: "11-07"
    dimension: scope_sanity
    severity: warning
    description: "4 tasks including checkpoint — borderline scope"
    fix_hint: "Optional: merge SQL helper + workflow tasks if executor context tight"

  - plan: "11-02"
    dimension: pattern_compliance
    severity: warning
    description: "Testcontainers task does not cite PATTERNS.md analog in action prose"
    task: 2
    fix_hint: "Reference e2e.yml MySQL service block as interim analog in action"
```

---

## Plan Summary

| Plan | Wave | Deps | Tasks | Structure | Autonomous |
|------|------|------|-------|-----------|------------|
| 11-01 | 1 | — | 2 | ✅ | yes |
| 11-02 | 2 | 01 | 3 | ✅ | yes |
| 11-03 | 3 | 02 | 2 | ✅ | yes |
| 11-04 | 4 | 03 | 3 | ✅ | yes |
| 11-05 | 5 | 04 | 3 | ✅ | yes |
| 11-06 | 6 | 05 | 2 | ✅ | yes |
| 11-07 | 7 | 06 | 4 | ✅ | no (checkpoint) |
| 11-08 | 8 | 07 | 3 | ✅ | yes |

---

## Coverage Summary

| Requirement / Decision group | Plans | Status |
|------------------------------|-------|--------|
| D-H01…D-H06 (architecture) | 01, 04, 06, 08 | Covered |
| D-01…D-04 (MVP scenarios) | 03, 04 | Covered |
| D-05…D-08 (Asterisk + lab) | 02, 07 | Covered |
| D-09…D-12 (CI matrix) | 04, 08 | Covered |
| D-13…D-16 (seed/tenant) | 02, 03, 08 | Covered |
| D-17…D-24 (CLI + layout) | 01, 04, 08 | Covered |

---

## Recommendation

**Run `/gsd-execute-phase 11` to proceed.** Warnings may be addressed during execution or left for a polish pass — none block phase goal achievement.

---

## VERIFICATION PASSED

**Phase:** 11-harness-layer-external-scenario-runner-environment-observabi  
**Plans checked:** 8  
**Issues:** 0 blocker(s), 4 warning(s)

Plans verified. Proceed to execution.
