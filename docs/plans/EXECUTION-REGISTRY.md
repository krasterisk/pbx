# Реестр координации инициатив

Указывает, где хранится владелец и текущее назначение; не дублирует ROADMAP/STATE и не является атомарной блокировкой. Порядок: [HYBRID-WORKFLOW](../development/HYBRID-WORKFLOW.md).

| Инициатива | Каноническое состояние координации | Master roadmap |
|---|---|---|
| ai-products | [EXECUTION](initiatives/ai-products/EXECUTION.md) | [ROADMAP](initiatives/ai-products/ROADMAP.md) |
| autodial-refactor | [EXECUTION](legacy/AUTODIAL-REFACTOR-EXECUTION-2026-09-18.md) | [план рефакторинга](legacy/AUTODIAL-REFACTOR-PLAN-2026-09-18.md) |

Введён 2026-09-18. Существующие production/autodial/GSD tasks автоматически не переносились и не объявлены свободными. Перед записью в общие файлы сверять dirty baseline и writers. Если у другой инициативы уже есть registry/state, добавить ссылку на него, а не копировать все статусы.

| ci-repair | [EXECUTION](legacy/CI-REPAIR-EXECUTION.md) | Scoped test/lint/CI repair |
| ai-chat-widget | [EXECUTION](ai-chat-widget/EXECUTION.md) | [Scoped UI plan](ai-chat-widget/PLAN.md) |

| ac-reservations-fix | [EXECUTION/PLAN](legacy/AC-RESERVATIONS-FIX.md) | Scoped production schema repair |

| trunk-status-fix | [EXECUTION/PLAN](legacy/TRUNK-STATUS-FIX.md) | r3 /root codex-direct implemented/targeted-tests-passed: AoR discrepancy diagnosed, empty Actions column removed; backend/build PASS, frontend original6 mock failures + corrective9/9 PASS, root lint blocked by support error, browser policy blocked; r2 evidence retained; no release |

| dialplan-callerid-name | [EXECUTION/PLAN](legacy/DIALPLAN-CALLERID-NAME.md) | Trunk labels and CallerID name |
| blf-support | [EXECUTION/PLAN](legacy/BLF-SUPPORT.md) | Optional tenant-isolated BLF and presence |
| endpoints-architecture | [EXECUTION/PLAN](legacy/ENDPOINTS-ARCHITECTURE-EXECUTION.md) | Endpoints UI architecture and audit repair |
| table-ui-standardization | [EXECUTION](table-ui-standardization/EXECUTION.md) | [PLAN](table-ui-standardization/PLAN.md), /root chat 01a12e83-9fcf-7460-a9b5-060c61e3a096 codex-direct r6 T17–T19 accepted: one selection toolbar, legacy banners removed, mobile filtered-ID selection; 36 files/149 tests + final 17-case regression/typecheck/scoped lint PASS, actual Endpoints/Trunks geometry verified |
| design-system-refresh | [EXECUTION/PLAN](legacy/DESIGN-SYSTEM-REFRESH-EXECUTION.md) | Centered errors, redesigned dark palette, AiChat launcher |
| context-defaults-aichat | [EXECUTION/PLAN](legacy/CONTEXT-DEFAULTS-AICHAT-EXECUTION.md) | Default contexts and platform assistant capability audit |
| routes-contexts-refactor | [EXECUTION/PLAN](legacy/ROUTES-CONTEXTS-REFACTOR-PLAN.md) | Ordered includes, route permissions removal and isolated live Asterisk tests |
| release-20261009 | [EXECUTION/PLAN](legacy/RELEASE-20261009.md) | Released 7acfa819; CI and authenticated production smoke PASS |
| modal-ui-standardization | [EXECUTION](modal-ui-standardization/EXECUTION.md) | [PLAN](modal-ui-standardization/PLAN.md), implemented / automated-tests-passed; visual tool-unavailable |

| release-20261010 | [EXECUTION/PLAN](legacy/RELEASE-20261010.md) | Released 4.6.6 / bef2865f; all CI and authenticated production smoke PASS |

| mobile-navigation | [EXECUTION](mobile-navigation/EXECUTION.md) | [PLAN](mobile-navigation/PLAN.md) N21/r13 compact section flyouts implemented; targeted/types/lint/backend/frontend PASS, visual tool-unavailable; /root sole coordinator, codex-direct idle |

| release-4.6.7 | [EXECUTION/PLAN](legacy/RELEASE-4.6.7-20261010.md) | Released 4.6.7 / 96b67a48; all CI and authenticated production smoke PASS |

| release-4.6.8 | [EXECUTION/PLAN](legacy/RELEASE-4.6.8-20261010.md) | Released 4.6.8 / b3eaa72f; all CI and authenticated production smoke PASS |

| release-4.6.9 | [EXECUTION/PLAN](legacy/RELEASE-4.6.9-20261011.md) | Released 4.6.9 / 35c29abd; all CI and authenticated production smoke PASS |

| pbx-dashboard | [EXECUTION](pbx-dashboard/EXECUTION.md) | [PLAN](pbx-dashboard/PLAN.md) D8-BINLOG r1 complete; [REPORT](pbx-dashboard/binlog-optimization/REPORT.md). /root chat01a11af4-afac-7a90-9f33-b52556c634de codex-direct; compression and snapshot fix deployed a7440544 over427a5059; baseline build/dashboard255/root backend4641/frontend2426/lint PASS; real SQL rollback/cold/lease/stale/scope PASS. Main107x smaller, extra3.09x binlog reduction in short post-compression windows. Local commit not pushed; prior UI/load gates unchanged |
| mpbx-voice-robots | [EXECUTION/PLAN](mpbx-voice-robots/EXECUTION.md) | /root codex-direct r5 module HTML MCP restyle/footer guide, full-viewport dialogs and shadow gutters released/live-verified; desktop/mobile scoped checks PASS;109 protected files/index and all PM2/Asterisk unchanged/no restarts; r4 backend4011/frontend1946 regression baseline PASS; real audio/capacity pending |

| release-4.7.0 | [EXECUTION/PLAN](legacy/RELEASE-4.7.0-20261014.md) | Released4.7.0 / e6fce25e; CI/schema35/authenticated smoke PASS, customer dashboard disabled as configured |

| mpbx-api9057-call-tts | [EXECUTION/PLAN](mpbx-api9057-call-tts/EXECUTION.md) | /root codex-direct API9057-only call_tts released; PHP/43mock/six negative HTTPS/protected110 and PM2/Asterisk final invariants PASS; no restart/reload/calls; real phone E2E pending; custom hooks forwarded, existing global context unchanged |

| cc-analytics | [EXECUTION](cc-analytics/EXECUTION.md) | [PLAN](cc-analytics/PLAN.md), /root codex-direct, фаза A «Одна правда» реализована (словарь метрик, RNA, direct:*, rollup, tz, idle restore, golden parity; lint/backend зелёные); фаза B «Live cockpit»: срез B1/B2/B3 (лента внимания, плитки очередей, ждёт/говорит) и C1(очереди)+B4 (интервальные агрегаты 0037, внутридневной график) реализованы; фаза E срез 1 (E1–E4): отдельный дашборд КЦ `/callcenter/dashboard` (overview-API, миграция 0038, now/KPI/график/очереди) реализован; секции «Потери и перезвоны», «Паузы» и «Операторы, выделяющиеся среди остальных» добавлены; C2-lite (URL-состояние отчётов, провалы с дашборда) и B7 (тренд SLA в плитках) реализованы; миграции 0036–0038 применены на стенде и дашборд сверен с живыми данными (исправлен подсчёт пауз без события окончания); дальше E секции команд / результатов / стоимости лида (нужны решения владельца и миграции), C1 по операторам |

| helpdesk-chat | [EXECUTION](helpdesk-chat/EXECUTION.md) | /root chat01a13e6e-f990-7d41-81eb-259a3c65a65b codex-direct R29, explicit user assignment; existing chat → remote helpdesk task tool; canonical PLAN in aiPBX-helpdesk/docs/PLAN.md |

| cc-ux | [EXECUTION](cc-ux/EXECUTION.md) | [PLAN](cc-ux/PLAN.md), /root codex-direct (продолжение cc-analytics, тот же координатор), реализация U0–U6 по явному поручению пользователя |

| autodial-ux-audit | [EXECUTION](autodial-ux-audit/EXECUTION.md) | /root codex-direct chat01a14365. Source29 IMPLEMENTED/automated+availableLIVEaccepted/CLEANED; partialUXacceptance only200zoom unsupported/SA locked.89targeted+lint/types/Vite+full29b474files2598tests0skip/24chunks/exit0/all2572+CDR13+compiler unchanged. Actualcold/401/reload/encodedquery/hashPASS. Exactown7containers/net/volume/root+3localhelpers/privatefixture removed/postcheckPASS, foreign preserved. Noactivewriter/CI/helper/agents,newpublication. [Verification](autodial-ux-audit/supervisor-review-20261018/VERIFICATION.md). |

| ai-robots-studio | [EXECUTION](initiatives/ai-robots-studio/EXECUTION.md) | [PLAN](initiatives/ai-robots-studio/PLAN.md), [REPORT](initiatives/ai-robots-studio/REPORT.md), codex-direct, plan v1.0 ready (аудит F1–F26, этапы S0–S9, живые тесты L1–L10, гейты G1–G5); OD1 (заменяет ai-products AI-VOICE-PARITY для AI-роботов), OD2 (сохранить = в бой + откат), OD3 (удалить /ai-agents), OD5 (вертикальный срез) приняты; implementation not assigned |

| module-marketplace | [EXECUTION](module-marketplace/EXECUTION.md) | [PLAN](module-marketplace/PLAN.md), codex-direct, S0–S4 implemented, acceptance open: active-only nav, access screen, one-step connect, routes from manifests; frontend tsc and targeted nav tests PASS, backend grant/purchase 33 PASS; authenticated browser blocked by 401 token |

| cc-operator-report | [EXECUTION](cc-operator-report/EXECUTION.md) | [PLAN](cc-operator-report/PLAN.md), codex-direct; operator scorecard: person rows, journal time, queue filter, RNA and occupancy, supervisor scope; migration 0047; live stand check PASS |

| cdr-reports-ux | [EXECUTION](cdr-reports-ux/EXECUTION.md) | R7O11 bounded acceptance CLOSED: both privacy failures repaired using retained STT;13/13 analyses,463segments/169metrics,11 prior results unchanged. Browser aiChat approximate timing/unknown,7-call aggregate and6/6 summary PASS; index71/71/search/card/seek/ACL+revocation PASS with semantic preview limits. Backend5017PASS/27skip; frontend482filesPASS; lint/build PASS. Native WebRTC/unanswered gates retained. Disposable QA stopped/removed, external evidence retained; main3010/5010 rebuilt/up. No robot-model or CC-shift edits; not a production rollout. External runs/cdr-reports-ux/r7o11-20261021. |

| artifact-storage | [EXECUTION](artifact-storage/EXECUTION.md) | Completed storage migration: 79334 files external/SHA-256 PASS, 247 generators, 9 targeted PASS; frontend WebRTC8 FAIL outside product ownership; /root chat01a15cc9 |

| repository-layout | [EXECUTION](repository-layout/EXECUTION.md) | /root chat01a15cc9 codex-direct idle;947 docs/5 tools/7 inputs moved; planning tracked0; integrity/targeted/lint/backend PASS; frontend gate recorded separately; no release |
| release-4.7.2.0 | `/root`, codex-direct | [PLAN / EXECUTION](release-4.7.2.0/EXECUTION.md) | released/live-verified on185.177.216.132, sourcee0d0a038; all required gates PASS; schema0055, customer grants/menu preserved; no active writer |
