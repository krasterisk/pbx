# R7O4 — проверка смыслового поиска

2026-10-21. Same coordinator / codex-direct / PLAN R7O continuation. No subagents, cross-chat messaging, common robot/provider-model or shared speech-analytics privacy-engine edits. No new model/STT requests.

## Proven defect and implementation

Existing anonymized real-call provider captures exposed two failure modes: a query condition (appointment date) replaced by an opaque identifier, and entire business queries replaced by an organization alias. The cloud verifier treated unrelated aliases/organization greetings as matches.

CDR evidence guard now requires every query privacy alias to occur as the exact alias in the same candidate conversation; alias1 is distinct from alias10 and another alias of the same type. Updated verifier instructions document opaque identity semantics. Profile advanced from v5 to v6. When no letter content remains after removing privacy aliases, the CDR service fails before cloud inference; no raw identifying text is restored or sent as fallback. API returns explicit CDR_SEARCH_QUERY_REDACTED, and RU/EN search UI explains how to rephrase/use exact phrase search. Name-only fully masked semantic queries also require rephrasing or structured/literal search; this conservative limitation is intentional, not a relevance assertion.

## Evidence

- R7O4-ALIAS-REPLAY.json: three saved cases (r5cal19, r5hold22, r5hold47), seven previous false-positive results rejected. Offline replay of existing anonymized real-call captures, not fresh inference or independent grading.
- R7O4-ALL-CAPTURE-GUARDS.json:86 parseable saved requests,32 model-supported rows before existing/new guards,24 after; one existing acronym rejection and seven new alias rejections. No additional previously supported rows rejected by the new alias rule. This diagnostic is not corpus recall/precision.
- Backend targeted search/grounding four suites63 tests PASS; additional explicit API error-contract regression added afterward, result pending.
- Frontend initial test invocation blocked by sandbox esbuild directory access; configLoader runner retry in progress. No visual acceptance claimed.
- Initial owned ESLint/build PASS before late API/profile/UI edits; final current-source checks in progress. Earlier R7O3 runtime remains running until final build is verified and only its owned process is restarted.

## Remaining gates

Eight previously missed matches remain unresolved against old agent labels. In particular, model-supported OMC callback is rejected by an already-existing missing-source-anchor check; do not remove it to fit old gold. Calendar-relative labels may depend on authored CDR clock; native time provenance/human review remains separate. No unsupported reclassification of labels or claim of complete search acceptance.

Browser tab3010/login is visible in inventory, but getTab still times out30s. Native SIP/WebRTC still awaits safe internal test extensions. These gates do not block the proven alias defect fix, but full CDR/release is not accepted.

## Final collection

Final API suite19 PASS replaces previous18:64 unique backend tests across4 suites. Frontend search3 PASS with configLoader runner. Final targeted ESLint and diff-check PASS; backend tsc build and frontend tsc --noEmit PASS. Compiled profilev6 and explicit API error verified. Restarted only owned backend1969408 as hidden PID1745580; final5010 and3010 health200. No active owned test/model/CI worker remains; main app left running. R7O4-VERIFICATION.json sourceDelta[] confirms evidence matches current owned sources. Earlier pending statements are superseded by this collection. No browser/native/independent quality acceptance claimed.
