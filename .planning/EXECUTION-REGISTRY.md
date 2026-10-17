# Реестр координации инициатив

Указывает, где хранится владелец и текущее назначение; не дублирует ROADMAP/STATE и не является атомарной блокировкой. Порядок: [HYBRID-WORKFLOW](HYBRID-WORKFLOW.md).

| Инициатива | Каноническое состояние координации | Master roadmap |
|---|---|---|
| ai-products | [EXECUTION](initiatives/ai-products/EXECUTION.md) | [ROADMAP](initiatives/ai-products/ROADMAP.md) |
| autodial-refactor | [EXECUTION](AUTODIAL-REFACTOR-EXECUTION-2026-09-18.md) | [план рефакторинга](AUTODIAL-REFACTOR-PLAN-2026-09-18.md) |

Введён 2026-09-18. Существующие production/autodial/GSD tasks автоматически не переносились и не объявлены свободными. Перед записью в общие файлы сверять dirty baseline и writers. Если у другой инициативы уже есть registry/state, добавить ссылку на него, а не копировать все статусы.

| ci-repair | [EXECUTION](CI-REPAIR-EXECUTION.md) | Scoped test/lint/CI repair |
| ai-chat-widget | [EXECUTION](ai-chat-widget/EXECUTION.md) | [Scoped UI plan](ai-chat-widget/PLAN.md) |

| ac-reservations-fix | [EXECUTION/PLAN](AC-RESERVATIONS-FIX.md) | Scoped production schema repair |

| trunk-status-fix | [EXECUTION/PLAN](TRUNK-STATUS-FIX.md) | r3 /root codex-direct implemented/targeted-tests-passed: AoR discrepancy diagnosed, empty Actions column removed; backend/build PASS, frontend original6 mock failures + corrective9/9 PASS, root lint blocked by support error, browser policy blocked; r2 evidence retained; no release |

| dialplan-callerid-name | [EXECUTION/PLAN](DIALPLAN-CALLERID-NAME.md) | Trunk labels and CallerID name |
| blf-support | [EXECUTION/PLAN](BLF-SUPPORT.md) | Optional tenant-isolated BLF and presence |
| endpoints-architecture | [EXECUTION/PLAN](ENDPOINTS-ARCHITECTURE-EXECUTION.md) | Endpoints UI architecture and audit repair |
| table-ui-standardization | [EXECUTION](table-ui-standardization/EXECUTION.md) | [PLAN](table-ui-standardization/PLAN.md), /root chat 01a12e83-9fcf-7460-a9b5-060c61e3a096 codex-direct r6 T17–T19 accepted: one selection toolbar, legacy banners removed, mobile filtered-ID selection; 36 files/149 tests + final 17-case regression/typecheck/scoped lint PASS, actual Endpoints/Trunks geometry verified |
| design-system-refresh | [EXECUTION/PLAN](DESIGN-SYSTEM-REFRESH-EXECUTION.md) | Centered errors, redesigned dark palette, AiChat launcher |
| context-defaults-aichat | [EXECUTION/PLAN](CONTEXT-DEFAULTS-AICHAT-EXECUTION.md) | Default contexts and platform assistant capability audit |
| routes-contexts-refactor | [EXECUTION/PLAN](ROUTES-CONTEXTS-REFACTOR-PLAN.md) | Ordered includes, route permissions removal and isolated live Asterisk tests |
| release-20261009 | [EXECUTION/PLAN](RELEASE-20261009.md) | Released 7acfa819; CI and authenticated production smoke PASS |
| modal-ui-standardization | [EXECUTION](modal-ui-standardization/EXECUTION.md) | [PLAN](modal-ui-standardization/PLAN.md), implemented / automated-tests-passed; visual tool-unavailable |

| release-20261010 | [EXECUTION/PLAN](RELEASE-20261010.md) | Released 4.6.6 / bef2865f; all CI and authenticated production smoke PASS |

| mobile-navigation | [EXECUTION](mobile-navigation/EXECUTION.md) | [PLAN](mobile-navigation/PLAN.md) N21/r13 compact section flyouts implemented; targeted/types/lint/backend/frontend PASS, visual tool-unavailable; /root sole coordinator, codex-direct idle |

| release-4.6.7 | [EXECUTION/PLAN](RELEASE-4.6.7-20261010.md) | Released 4.6.7 / 96b67a48; all CI and authenticated production smoke PASS |

| release-4.6.8 | [EXECUTION/PLAN](RELEASE-4.6.8-20261010.md) | Released 4.6.8 / b3eaa72f; all CI and authenticated production smoke PASS |

| release-4.6.9 | [EXECUTION/PLAN](RELEASE-4.6.9-20261011.md) | Released 4.6.9 / 35c29abd; all CI and authenticated production smoke PASS |

| pbx-dashboard | [EXECUTION](pbx-dashboard/EXECUTION.md) | [PLAN](pbx-dashboard/PLAN.md), [SUMMARY](pbx-dashboard/SUMMARY.md); /root codex-direct D7-UI r4 implemented, scoped43/types/frontend-lint/backend PASS, global lint/frontend foreign failures; visual pending, writers FIN; r3 AI/autodial/load/release gates unchanged |
| mpbx-voice-robots | [EXECUTION/PLAN](mpbx-voice-robots/EXECUTION.md) | /root codex-direct r5 module HTML MCP restyle/footer guide, full-viewport dialogs and shadow gutters released/live-verified; desktop/mobile scoped checks PASS;109 protected files/index and all PM2/Asterisk unchanged/no restarts; r4 backend4011/frontend1946 regression baseline PASS; real audio/capacity pending |

| release-4.7.0 | [EXECUTION/PLAN](RELEASE-4.7.0-20261014.md) | Released4.7.0 / e6fce25e; CI/schema35/authenticated smoke PASS, customer dashboard disabled as configured |

| mpbx-api9057-call-tts | [EXECUTION/PLAN](mpbx-api9057-call-tts/EXECUTION.md) | /root codex-direct API9057-only call_tts released; PHP/43mock/six negative HTTPS/protected110 and PM2/Asterisk final invariants PASS; no restart/reload/calls; real phone E2E pending; custom hooks forwarded, existing global context unchanged |

| cc-analytics | [EXECUTION](cc-analytics/EXECUTION.md) | [PLAN](cc-analytics/PLAN.md), /root codex-direct, фаза A «Одна правда» реализована (словарь метрик, RNA, direct:*, rollup, tz, idle restore, golden parity; lint/backend зелёные); фаза B «Live cockpit»: срез B1/B2/B3 (лента внимания, плитки очередей, ждёт/говорит) и C1(очереди)+B4 (интервальные агрегаты 0037, внутридневной график) реализованы; фаза E срез 1 (E1–E4): отдельный дашборд КЦ `/callcenter/dashboard` (overview-API, миграция 0038, now/KPI/график/очереди) реализован; секции «Потери и перезвоны», «Паузы» и «Операторы, выделяющиеся среди остальных» добавлены; C2-lite (URL-состояние отчётов, провалы с дашборда) и B7 (тренд SLA в плитках) реализованы; миграции 0036–0038 применены на стенде и дашборд сверен с живыми данными (исправлен подсчёт пауз без события окончания); дальше E секции команд / результатов / стоимости лида (нужны решения владельца и миграции), C1 по операторам |

| helpdesk-chat | [EXECUTION](helpdesk-chat/EXECUTION.md) | /root chat01a13e6e-f990-7d41-81eb-259a3c65a65b codex-direct R29, explicit user assignment; existing chat → remote helpdesk task tool; canonical PLAN in aiPBX-helpdesk/docs/PLAN.md |

| cc-ux | [EXECUTION](cc-ux/EXECUTION.md) | [PLAN](cc-ux/PLAN.md), /root codex-direct (продолжение cc-analytics, тот же координатор), реализация U0–U6 по явному поручению пользователя |

| autodial-ux-audit | [EXECUTION](autodial-ux-audit/EXECUTION.md) | [REPORT §6](autodial-ux-audit/REPORT.md), /root codex-direct; U0–U7/UA1–UA4 implementation/assigned acceptance complete; backend4403/frontend2332/lint, browser, real-model8 and model-plan→preflight→internal TTS call PASS; own cleanup PASS; not released; boundaries in VERIFICATION |

| cc-operator-report | [EXECUTION](cc-operator-report/EXECUTION.md) | [PLAN](cc-operator-report/PLAN.md), codex-direct, plan v1.0 ready (research + code review F1–F21, stages 0–5, live tests L0–L9 / gates G0–G4); OD1–OD10 accepted (recommended variants); implementation not assigned |

| ai-robots-studio | [EXECUTION](ai-robots-studio/EXECUTION.md) | [PLAN](ai-robots-studio/PLAN.md), [REPORT](ai-robots-studio/REPORT.md), codex-direct, plan v1.0 ready (аудит F1–F21, этапы S0–S9, живые тесты L1–L10, гейты G1–G5); OD1–OD10 ждут владельца (OD1 — отношение к ai-products AI-VOICE-PARITY); implementation not assigned |

| module-marketplace | [EXECUTION](module-marketplace/EXECUTION.md) | [PLAN](module-marketplace/PLAN.md), codex-direct, plan v1.1 ready: навигация, маркетплейс и активация модулей (находки F1–F13, этапы S0–S4); OD1–OD8 приняты (OD2: в навигации только активные модули, заменяет mobile-navigation N9 решение 6); остальной контракт mobile-navigation N5–N21 сохранён; implementation not assigned |

| cc-operator-report | [EXECUTION](cc-operator-report/EXECUTION.md) | [PLAN](cc-operator-report/PLAN.md), codex-direct; operator scorecard: person rows, journal time, queue filter, RNA and occupancy, supervisor scope; migration 0047; live stand check PASS |
