---
phase: 15-universal-pbx-ai-agent
plan: 20
subsystem: api
tags: [mcp, adapters, d-12, d-15, d-22, voice-robots, tts-engines, stt-engines]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Adapter-over-handwritten precedence and registry-enumerated isolation suite (15-07)
provides:
  - VoiceRobotsAiAdapter list/describe with engine configured vs missing
  - TtsEnginesAiAdapter and SttEnginesAiAdapter allow-listed reads without credentials
  - Shared speech-engines skill plus voice-robots skill
  - Batch spec asserting read-only, credential-free and per-tool tenant isolation
affects:
  - 15-23 (completeness gate sees voice-robots, tts-engines, stt-engines; shared skill speech-engines)

actuals:
  tokens: 12454
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Robot describe resolves TTS/STT and reports missing instead of omitting a dangling uid
    - Engine output is an explicit allow list; credential absence asserted on the declared shape
    - Two engine domains share one skill file (speech-engines) for the 15-23 coverage rule

key-files:
  created:
    - packages/backend/src/modules/voice-robots/voice-robots-ai.adapter.ts
    - packages/backend/src/modules/tts-engines/tts-engines-ai.adapter.ts
    - packages/backend/src/modules/stt-engines/stt-engines-ai.adapter.ts
    - packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts
    - packages/backend/src/skills/voice-robots/SKILL.md
    - packages/backend/src/skills/speech-engines/SKILL.md
  modified:
    - packages/backend/src/modules/voice-robots/voice-robots.module.ts
    - packages/backend/src/modules/tts-engines/tts-engines.module.ts
    - packages/backend/src/modules/stt-engines/stt-engines.module.ts

key-decisions:
  - "Voice robot describe resolves each referenced engine and reports missing rather than skipping a dangling uid"
  - "Engine reads are an explicit allow list; no token, custom_url or custom_headers"
  - "TTS and STT share skills/speech-engines so 15-23 does not demand per-module stub files"
  - "No synthesis or transcription tool — billable, no undo, outside the write boundary"

patterns-established:
  - "Pattern: dependency reads report missing explicitly (T-15-89)"
  - "Pattern: credential absence is asserted on the declared output shape, not only fixtures"
  - "Pattern: two adapter domains may share one skill when the diagnostic story is the same"

requirements-completed: [D-12, D-15, D-22]

coverage:
  - id: D1
    description: A voice robot read names its engine dependencies and their configured state, including missing references, with no write surface (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#describes one robot with its scenario outline and referenced speech engines
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#reports a dangling engine reference as a missing dependency instead of omitting it
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#declares no mutating tool
        status: pass
    human_judgment: false
  - id: D2
    description: Both engine domains are readable by allow list with no credential exposure and no billable action surface (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#builds output from an explicit allow list and never returns a provider key, endpoint or encrypted value
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#asserts credential absence against the declared output shape, not only fixtures
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#declares no tool that synthesises audio
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#declares no tool that transcribes audio
        status: pass
    human_judgment: false
  - id: D3
    description: One shared engine skill parses and is accepted as covering tts-engines and stt-engines (D-12)
    requirement: D-12
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#ships one shared skill that parses and covers both engine domains
        status: pass
    human_judgment: false
  - id: D4
    description: All three domains have per-tool cross-tenant assertions plus a registry-enumerated suite (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#proves per-tool cross-tenant isolation and forged-key ignore for every speech adapter tool
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 20: Voice robots and speech engine reads Summary

**Voice robot describe resolves TTS/STT configured vs missing in one call; engine catalogs are allow-listed and never return a provider key or a billable synth/transcribe tool**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-04T13:25:00Z
- **Completed:** 2026-09-04T13:37:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `list_voice_robots` returns status and route entry points; `describe_voice_robot` returns scenario outline plus each referenced engine as configured or missing
- TTS and STT list tools project name, vendor, enabled, capabilities and configured from an explicit allow list — no token, URL or headers
- Neither engine adapter declares synthesis or transcription; none of the three adapters declares a mutating tool
- Shared `speech-engines` skill covers both engine domains; voice-robots skill tells the model to read describe before guessing engines
- Per-tool D-22 suite names the failing handler; forged tenant keys in args are ignored

## Task Commits

Each task was committed atomically (TDD RED → GREEN where applicable):

1. **Task 1 RED: voice robot read** - `2813763` (test)
2. **Task 1 GREEN: adapter + skill + module** - `fab56e0` (feat)
3. **Task 2 RED: engine reads without credentials** - `a2548fc` (test)
4. **Task 2 GREEN: TTS/STT adapters** - `cd8e041` (feat)
5. **Task 3: shared skill + isolation suite** - `3c09b17` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/voice-robots/voice-robots-ai.adapter.ts` — list/describe; engine dependency resolution
- `packages/backend/src/modules/voice-robots/voice-robots.module.ts` — registers adapter; imports engine modules
- `packages/backend/src/modules/tts-engines/tts-engines-ai.adapter.ts` — allow-listed TTS read
- `packages/backend/src/modules/tts-engines/tts-engines.module.ts` — registers adapter
- `packages/backend/src/modules/stt-engines/stt-engines-ai.adapter.ts` — allow-listed STT read
- `packages/backend/src/modules/stt-engines/stt-engines.module.ts` — registers adapter
- `packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts` — read-only, credential-free, D-22
- `packages/backend/src/skills/voice-robots/SKILL.md` — reachability, engines, describe-first
- `packages/backend/src/skills/speech-engines/SKILL.md` — shared TTS/STT skill for 15-23

## Decisions Made

- **Describe resolves engines.** Three calls plus a guessed uid is how a silent robot gets a confident wrong diagnosis.
- **Missing is explicit.** Skipping an unresolvable uid looks identical to «no engines configured».
- **Allow list, not subtract.** Engine rows store tokens beside harmless fields; a new column would leak if we only stripped known keys.
- **No synth/transcribe.** Per-call cost, no confirmable diff, no undo — outside this phase's write boundary.
- **Shared skill.** `tts-engines` and `stt-engines` share `speech-engines`; 15-23 must declare that rather than accept stub files.

## Deviations from Plan

None - plan executed exactly as written.

The coverage-rule classification file (`module-coverage.registry.ts`) is owned by 15-23 and does not exist yet. The shared-skill declaration lives in `skills/speech-engines/SKILL.md` and in `SHARED_SPEECH_SKILL_DOMAINS` in the batch spec, which is what 15-23 will read.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-23 can classify `voice-robots` as covered and `tts-engines`/`stt-engines` as covered via shared skill `speech-engines`
- Later diagnostics can ask describe_voice_robot before blaming a route

## TDD Gate Compliance

Plan frontmatter is `type: execute` with Tasks 1–2 `tdd="true"`. Each has a `test(15-20)` RED commit followed by a `feat(15-20)` GREEN commit. Tracer feedback gate re-ran `read-adapters-speech` after Task 1 (6 passed) and continued (`human_verify_mode` default end-of-phase, automated-only verify).

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-speech|agent-skill-registry|legacy-tool-migration" --no-coverage
```

Task 1: 6 passed. Task 2: 16 passed. Task 3: 41 passed across the three suites (19 in `read-adapters-speech.spec.ts`).

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/voice-robots/voice-robots-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/tts-engines/tts-engines-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/stt-engines/stt-engines-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts`
- FOUND: `packages/backend/src/skills/voice-robots/SKILL.md`
- FOUND: `packages/backend/src/skills/speech-engines/SKILL.md`
- FOUND: commits `2813763`, `fab56e0`, `a2548fc`, `cd8e041`, `3c09b17`
