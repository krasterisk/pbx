# Phase 5 — Validation Map (Nyquist)

**Phase:** 05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c
**Source:** Validation Architecture из 05-RESEARCH.md + чекпоинты 05-04-PLAN.md
**Created:** 2026-07-14

> `workflow.nyquist_validation` в `.planning/config.json` отсутствует → артефакт обязателен.

## Test Framework

| Property | Value |
|----------|-------|
| Backend | Jest 29.7 (`packages/backend`, spec-файлы рядом с модулями) |
| Frontend | Vitest 4.1 (`packages/frontend`) |
| Quick run (backend) | `npx jest <module> --silent` из `packages/backend` |
| Full suite | `npm run lint && npm run test:backend && npm run test:frontend` (из корня; обязательный verify по AGENTS.md) |
| E2E | Playwright в `e2e/` — опционально; ручной UAT обязателен (05-04 Task 3) |

## Requirements → Validation Map

REQ-ID для Phase 5 в `.planning/REQUIREMENTS.md` не заведены (файл заканчивается Phase 4) — мапим на locked decisions из 05-CONTEXT.md.

| Decision(s) | Behavior | Method | Command / Checkpoint | Plan | Test File |
|-------------|----------|--------|----------------------|------|-----------|
| D-22 | DialplanApplyService: DelCat/NewCat/Append батчами, один reload, порядок категорий; 4 вызывающих переведены | automated (unit, mock AmiService) | `npx jest dialplan-apply --silent; npx jest routes --silent` | 05-01 | `ami/dialplan-apply.service.spec.ts` (Wave 0 gap — создаётся в 05-01 Task 1) |
| D-04, D-05, D-07 | Модель binding (route_phonebook_bindings), drop invert/actions, DTO с IsIn-валидацией, миграция идемпотентна | automated (tsc + unit) | `npx tsc --noEmit; npm run test:backend` + grep `invert` пуст | 05-05 | `phonebooks.service.spec.ts` (расширяется) |
| D-03 | Bindings CRUD replace-all, GET с position ASC, tenant isolation (where user_uid) | automated (unit) | `npx jest phonebooks -t binding; npx jest routes --silent` | 05-05 | `phonebooks.service.spec.ts` (describe bindings) |
| D-10 (backend) | lookup-test endpoint: tenant check ДО lookupNumber, ответ {matched, vars} | automated (unit) | `npx jest phonebooks -t lookup` | 05-05 | `phonebooks.service.spec.ts` (describe lookupNumber — база есть) |
| D-06, D-24 | 7 behavior-пресетов → корректные dialplan-строки; on_no_match инвертирует GotoIf и не эмитит Set(PB_*) | automated (unit) | `npx jest phonebooks -t generate` | 05-05 | `phonebooks.service.spec.ts` (describe generateBindingDialplan) |
| D-17, D-18 | RouteApplyService: pb-файл (reload=false) → контекст маршрута (reload=true); реген-триггеры (var-key set, bindings, delete) | automated (unit, mock DialplanApplyService) | `npx jest routes --silent` | 05-05 | route-apply спек (Wave 0 gap — создаётся в 05-05 Task 3) |
| D-23 | Cross-tenant фикс MCP: два uid подряд → сервисы вызваны с каждым uid | automated (unit, регрессионный) | `npx jest mcp --silent` | 05-02 | `mcp/mcp-tools.service.spec.ts` |
| D-19 | Каждый MCP tool-вызов пишет action_logs (success/error), fire-and-forget | automated (unit, mock LoggerService) | `npx jest mcp --silent` | 05-02 | `mcp/mcp-tools.service.spec.ts` |
| D-14, D-15 | Каркас Domain AI Adapter: registry register/getAllTools/getStateProviders/getKnowledgeBlocks; 5 legacy-доменов не сломаны | automated (unit) | `npx jest ai-adapter --silent` | 05-02 | `ai-platform/ai-adapter-registry.service.spec.ts` (Wave 0 gap — создаётся в 05-02 Task 1) |
| D-20, D-25 | Per-tenant подтверждения: default OFF; gate блокирует destructive tools (включая update_route) без confirm=true; per-tenant изоляция настроек | automated (unit) | `npx jest ai-chat --silent; npx jest mcp --silent` | 05-02 | ai-chat settings спек + `mcp-tools.service.spec.ts` |
| D-11, D-12, D-13, D-16 | PhonebooksAiAdapter: 8 tools (7 phonebook + update_route c bindings и destructive-гейтом), buildSummary без полных entries, KB-блок | automated (unit) | `npx jest phonebooks --silent; npx jest ai- --silent` | 05-02 | `phonebooks/phonebooks-ai.adapter.spec.ts` (Wave 0 gap — создаётся в 05-02 Task 3) |
| D-08, D-26 | Вкладка «Справочники»: порядок/удаление/добавление, custom → DialplanAppsEditor, on_no_match сужает пресеты | automated (vitest, интеграционный — требование frontend ARCHITECTURE.md) | `npm run test:frontend` | 05-03 | `RoutePhonebooksTab.test.tsx` (Wave 0 gap — создаётся в 05-03 Task 1) |
| D-04 (UI), D-10 (UI) | PhonebookFormModal без invert/actions; демо-тест lookup (matched + vars) | automated (vitest + lint + grep) | `npm run test:frontend; npm run lint` | 05-03 | существующие vitest-сьюты features/phonebooks |
| D-20, D-25 (UI) | Подраздел AI Chat в SellerSettingsForm: чтение/сохранение per-tenant настройки; i18n ru/en | automated (vitest + lint) | `npm run test:frontend; npm run lint` | 05-03 | vitest cloud-admin |
| D-09 | Preview dialplan отсутствует | automated (negative, grep) | grep preview-компонентов в RoutePhonebooksTab — пусто | 05-03 | — |
| Pitfall 9 | Регистрация 8 webhook tool definitions в aiPBX (вне git, нет CLI/API) | **manual** — checkpoint:human-action | 05-04 Task 2: чеклист регистрации + проверка MCP tools/list + тест-сообщение в AI Chat | 05-04 | — |
| D-21 | Три AI-сценария end-to-end (чёрный список, VIP redirect, привязка к маршруту) + политика срабатывает в реальном звонке (blacklist рвёт вызов, set_name/redirect) + подтверждения в чате + action_logs | **manual-only** — checkpoint:human-verify (нужен живой Asterisk + aiPBX + LLM; автоматизировать нельзя) | 05-04 Task 3: UAT-чеклист пункты 1-10, включая реальные звонки 7-9 | 05-04 | — |

## Sampling Rate

- **Per task commit:** `npx jest <module> --silent` (затронутый модуль)
- **Per wave merge:** `npm run test:backend && npm run test:frontend`
- **Phase gate (05-04 Task 1):** `npm run lint && npm run test:backend && npm run test:frontend` зелёные + ручной UAT (05-04 Tasks 2-3)

## Wave 0 Gaps (тесты, создаваемые в фазе)

- [ ] `ami/dialplan-apply.service.spec.ts` — mock `AmiService.action` (05-01 Task 1)
- [ ] `phonebooks.service.spec.ts` — новые describe для binding-модели и per-binding генерации; старые тесты `invert`/`actions` переписываются — поля удаляются (05-05 Tasks 2-3)
- [ ] спек `RouteApplyService` — порядок применений, mock DialplanApplyService (05-05 Task 3)
- [ ] `ai-platform/ai-adapter-registry.service.spec.ts` + `phonebooks/phonebooks-ai.adapter.spec.ts` (05-02 Tasks 1, 3)
- [ ] регрессионные тесты MCP: два uid подряд, аудит, confirmation-gate включая update_route (05-02 Tasks 1-3)
- [ ] frontend: `RoutePhonebooksTab.test.tsx` — интеграционный тест вкладки привязок (05-03 Task 1)

## Manual-Only Coverage (не автоматизируется)

| Item | Why manual | Where validated |
|------|-----------|-----------------|
| Регистрация webhook tools в aiPBX | админка aiPBX без CLI/API | 05-04 Task 2 (checkpoint:human-action) |
| AI-диалоги D-21 end-to-end | живой LLM (aiPBX), недетерминированные ответы | 05-04 Task 3, пункты 4-6 |
| Реальные звонки (blacklist/set_name/redirect/посторонний номер) | живой Asterisk + телефония | 05-04 Task 3, пункты 7-9 |
| Подтверждение деструктивной операции в чате | живой LLM + UI-переключатель | 05-04 Task 3, пункт 3 |
