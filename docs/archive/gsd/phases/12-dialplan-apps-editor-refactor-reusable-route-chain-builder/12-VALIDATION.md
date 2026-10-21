---
phase: 12
slug: dialplan-apps-editor-refactor-reusable-route-chain-builder
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Источник: `12-RESEARCH.md` § `## Validation Architecture`. Task ID проставляются в `/gsd-validate-phase 12`
> после создания планов — на момент сидирования планов ещё нет.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | Jest `^29.7.0` + ts-jest `^29.2.5` |
| **Config file (backend)** | `packages/backend/package.json` § `jest` (`rootDir: src`, `testRegex: .*\.spec\.ts$`) |
| **Framework (frontend)** | Vitest `^4.1.4` + `@testing-library/react ^16.3.2` + `user-event ^14.6.1` + `jsdom ^29.0.2` |
| **Config file (frontend)** | `packages/frontend/vite.config.ts`; setup — `src/shared/config/tests/setupTests.ts` |
| **Quick run command** | backend: `npm run test -w @krasterisk/backend -- --testPathPattern="<area>" --no-coverage` · frontend: `npm run test -w @krasterisk/frontend -- <path>` |
| **Full suite command** | `npm run lint && npm run test:backend && npm run test:frontend` |
| **Estimated runtime** | ~15 s узкий прогон · полный набор — минуты |
| **Обязательный префикс** | любая задача, меняющая `packages/shared` → сначала `npm run build -w @krasterisk/shared` |
| **E2E / live Asterisk** | **недоступно** — `packages/harness` не существует (Phase 11 не выполнена) → см. Manual-Only |

---

## Sampling Rate

- **After every task commit:** узкий прогон затронутой области (`--testPathPattern="<area>" --no-coverage`)
- **After every plan wave:** `npm run lint && npm run test:backend && npm run test:frontend`
- **Before `/gsd-verify-work`:** полный набор зелёный **и** все `checkpoint:human-verify` из M1…M12 закрыты
  либо явно задокументированы как отложенные с оценкой риска
- **Дополнительный gate после Wave 0:** покрытие ветвей `dialplan.util.ts` = 29/29
  (`npm run test:cov -w @krasterisk/backend`). Единственная численная метрика фазы, и она измеряет ровно тот
  риск, который делает фазу опасной: сейчас покрыто 7 ветвей из 29.
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | Wave 0 — характеризация | — | N/A | unit | `--testPathPattern="dialplan.util"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-43 условие на каждой строке multi-line | T-dialplan-injection | Условие не отваливается на 2-й строке | unit | `--testPathPattern="dialplan.util"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-43 time-group guard во всех 5 call-site | — | N/A | unit | `--testPathPattern="routes.service\|ivrs.service\|phonebook-dialplan"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-21 `normalizeTarget` + негативный тест на `${EXTEN}` | T-cross-tenant | Нет `Queue(${EXTEN}` / `Gosub(group_${EXTEN}` ни в одной ветви | unit | `--testPathPattern="dialplan-target"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-42 `toroute` без двойного суффикса | — | N/A | unit | `--testPathPattern="dialplan.util"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-42 `cmd` пишется в `action_logs` | T-audit-gap | Применение произвольной строки оставляет след | unit | `--testPathPattern="dialplan.util\|routes.service"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-25 счётчик переходов ограничивает A→B→A | T-loop-dos | На N+1 переходе цепочка обрывается | unit | `--testPathPattern="dialplan.util"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-08/D-09 инвариант 4 списков `ActionType` | T-input-validation | shared === DTO === generator === registry | unit | `--testPathPattern="route-action.dto"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-09 IVR `menu_items` и `voice_robots` валидируются | T-input-validation | Сегодня IVR не валидируется вовсе | integration | `--testPathPattern="ivrs.service\|voice-robots"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-10 пустой `type` / незаполненные params → 400 | T-input-validation | N/A | integration | `--testPathPattern="routes.controller"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | **D-11 held-out** (UI-SPEC backstop 2) | — | Ошибка бэкенда подсвечивает **тот** шаг; немаппящиеся не теряются | integration + component | `-- src/features/dialplan-apps` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-12 data-миграция идемпотентна, 6 JSON-колонок | T-data-loss | Неизвестные типы не трогаются | unit | `--testPathPattern="migrate-"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-04 `summarize()` деградирует, а не выпадает | — | N/A | unit | `-- src/features/dialplan-apps/lib/summarize` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | **D-27 held-out round-trip** (UI-SPEC backstop 4) | T-data-loss | `serialize(parse(s)) === s` для `U()`/`M()`/`L(x:y:z)` и порядка | unit | `-- src/features/dialplan-apps/lib/optionsString` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | **UI loading held-out** (UI-SPEC backstop 1) | — | «Грузится» отличимо от «пусто» | component | `-- src/features/dialplan-apps/ui/SchemaField` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | **D-57 UI held-out** (UI-SPEC backstop 3) | — | `not-configured` ведёт в настройки STT, без «Повторить» | component | CDR-фича | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-24/D-53 терминальность + плюрализация | — | N/A | component | `-- src/features/dialplan-apps` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-06 правка шага не ре-рендерит остальные (W1/W2) | — | N/A | component (счётчик рендеров) | `-- src/features/dialplan-apps` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-13 операции шага на редьюсере | — | N/A | unit | `-- src/features/dialplan-apps/model` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-14/D-15 `readOnly` / `maxSteps` / `allowedTypes` | T-data-loss | Тип вне `allowedTypes` не удаляется | component | `-- src/features/dialplan-apps` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-17/D-19 `tenant_settings` whitelist + изоляция | T-cross-tenant | Глобальные ключи тенанту недоступны | unit + integration | `--testPathPattern="tenant-settings"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-17 UI optimistic toggle + `undo()` при 400 | — | До резолва `Switch` disabled, без подставленного дефолта | component | `-- src/features/…/TenantSettings` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-51/D-52 режим → приложение + `Progress()` | — | N/A | unit | `--testPathPattern="dialplan.util"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | **D-55 `hangup_handler_push` строго до `Record(`; `k` всегда** | T-data-loss | Отбой посреди записи не теряет сообщение **и** запускает пост-обработку | unit | `--testPathPattern="dialplan.util\|voicemail"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-56 все **7** значений `RECORD_STATUS`, включая `OPERATOR` | — | Перевод на оператора отличим от завершения записи | unit | `--testPathPattern="dialplan-condition"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-57 `parseWavPcm16` (LIST-чанк, не-16-bit, обрезанный data) | T-dos | Не падает на битом файле | unit | `--testPathPattern="wav-pcm"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-57 `LlmSummaryService` таймаут / не-2xx / нет провайдера | T-ssrf, T-prompt-injection | Нет провайдера → `not-configured`, **не** `failed` | unit | `--testPathPattern="llm-summary"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-58 вкладка+фильтр одно состояние; access-scope | T-cross-tenant | Чужие сообщения не видны | unit + integration | `--testPathPattern="voicemail\|cdr"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | **D-59 токен `audience='voicemail-link'`** | T-public-url | Истёкший → 401; auth-токен не открывает сообщение и наоборот; `cdr-public` не обслуживает ВП | integration | `--testPathPattern="voicemail-link\|voicemail.controller"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-58 резолвер файла ВП с path-traversal guard | T-path-traversal | `../../etc/passwd` отвергается; MIME верный (не жёсткий `.mp3`) | unit | `--testPathPattern="voicemail"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-33 `call_groups.exten` + контекст `group_{exten}_{uid}` | T-data-loss | Ни один `togroup` не остаётся без валидного контекста | unit | `--testPathPattern="call-group-dialplan\|migrate-call-groups"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-34/D-35 подтверждение, пропуск занятых, откат CID | — | N/A | unit | `--testPathPattern="call-group-dialplan"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-36 карусель линейна по n (n=5: было 25 `Dial`, стало ≤ n+const) | T-dos | N/A | unit | `--testPathPattern="dialplan.util"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-37 `setclid_list` зовёт SHELL/CURL один раз | T-command-injection | N/A | unit | `--testPathPattern="dialplan.util"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-39 пустой `exten` → ошибка валидации, не `dp=''` | T-input-validation | N/A | unit | `--testPathPattern="dialplan.util\|route-action.dto"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DnD/a11y: `DragOverlay`, announcements ru+en, `randomUUID` | — | N/A | component | `-- src/features/dialplan-apps` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Адаптивность 375 / 768 / 1280 px | — | N/A | component (matchMedia mock) | `-- src/features/dialplan-apps` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Инъекция в **каждое** новое поле схемы | T-dialplan-injection | `sanitizeDialplanInput` / `sanitizeShellInput` / `sanitizeFilePath` | unit | `--testPathPattern="sanitize\|route-action.dto"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Фреймворки устанавливать не нужно — Jest и Vitest настроены и работают. Wave 0 — это тесты, а не инфраструктура.

**Характеризация (обязательна до первой правки генератора):**

- [ ] `packages/backend/src/shared/utils/dialplan.util.spec.ts` — расширить характеризационными тестами на **22**
      непокрытые ветви, фиксирующими текущий вывод **до** правок. Без этого рефакторинг D-43 не отличит
      «исправил баг» от «сломал работавшее».

**Новые backend spec-файлы:**

- [ ] `shared/utils/dialplan-target.util.spec.ts` — D-21 + негативные тесты на `${EXTEN}`
- [ ] `shared/utils/dialplan-condition.util.spec.ts` — D-22 + инвариант «DTO === генератор»
- [ ] `shared/utils/dialplan-options.util.spec.ts` — round-trip опций (D-27)
- [ ] `modules/routes/dto/route-action.dto.spec.ts` — per-type params + инвариант четырёх списков `ActionType`
- [ ] `modules/phonebooks/phonebook-dialplan.util.spec.ts` — time-group guard
- [ ] `modules/call-groups/call-group-dialplan.util.spec.ts` — D-33…D-36
- [ ] `modules/tenant-settings/tenant-settings.service.spec.ts` — D-19
- [ ] `modules/voicemail/*.spec.ts` — `voicemail.service`, `wav-pcm.util`, `llm-summary.service`,
      `voicemail-link.service`, `voicemail.controller`
- [ ] `modules/**/migrate-*.spec.ts` — data-миграции (прецедент: `cloud-admin/migrate-hub-modules-phase8.spec.ts`)

**Расширить существующие backend spec-файлы:**

- [ ] `modules/routes/routes.service.spec.ts` — time-group guard на многострочном действии
- [ ] `modules/ivrs/ivrs.service.spec.ts` — time-group guard + валидация `menu_items`

**Новые frontend тесты:**

- [ ] `features/dialplan-apps/lib/summarize.test.ts` — D-04
- [ ] `features/dialplan-apps/lib/optionsString.test.ts` — round-trip (backstop 4)
- [ ] `features/dialplan-apps/lib/validateAction.test.ts` — D-10
- [ ] `features/dialplan-apps/model/useChainEditor.test.ts` — D-13
- [ ] `features/dialplan-apps/ui/StepSheet/StepSheet.test.tsx` — D-01…D-03, фокус, backstop 1
- [ ] `features/dialplan-apps/ui/StepRow/StepRow.test.tsx` — summary, бейджи, overflow, unknown, terminal, плюрализация
- [ ] `features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.test.tsx` — props, backstop 2, счётчик ре-рендеров
- [ ] CDR-фича голосовых сообщений — четыре статуса обработки (backstop 3)

---

## Manual-Only Verifications

`packages/harness` не существует, поэтому всё, что требует живого Asterisk, автоматизировать в этой фазе нельзя.
Каждый пункт обязан попасть в план как `checkpoint:human-verify` с явным ожидаемым результатом.

| # | Behavior | Requirement | Why Manual | Test Instructions |
|---|----------|-------------|------------|-------------------|
| M1 | Версия Asterisk на целевом PBX | все Asterisk-решения | нет доступа к хосту | `asterisk -rx 'core show version'` → записать в ARCHITECTURE |
| M2 | **`Record()` + `k`: отбой посреди записи → файл есть И уведомление пришло** | D-55 | нужен реальный SIP-звонок с отбоем в середине | звонок → отбой на 5-й секунде → файл на диске + строка в `voicemail_messages` + доставленное уведомление |
| M3 | Hangup handler выполняется при отбое из `Record()` | D-55 | то же | `asterisk -rvvv` — вход в `krsk-vm-done-*` после `Hangup` |
| M4 | `Progress()` + `Playback(...,noanswer)` — звук идёт до ответа | D-52 | зависит от SIP-провайдера и трансляции early media | входящий с трунка на маршрут с воспроизведением без ответа |
| M5 | `QUEUESTATUS` и условие «очередь переполнена» | D-22 | нужна очередь с `maxlen` и реальные звонки | `maxlen=1`, два звонка, второй уходит на следующее действие |
| M6 | Переименование контекста групп не оборвало `togroup` | D-33 | зависит от данных прода | после миграции `dialplan show group_*`, затем тестовый звонок в каждую группу тенанта |
| M7 | Подтверждение вызова и пропуск занятых в группах | D-34 | нужен внешний номер с голосовой почтой оператора | звонок в группу с внешним участником; VM оператора не «отвечает» за группу |
| M8 | Вложенный `Sheet` поверх `RouteFormModal` на 3 уровнях | UI-SPEC ⚠ unresolved | порядок порталов Radix проверяется только в рантайме | `RouteFormModal` → `RoutePhonebooksTab` → шаг → Sheet: перекрытие и фокус |
| M9 | `records_base_path` на проде совпадает с `/usr/records` | D-38 | значение живёт в БД прода | прочитать `system_settings.records_base_path` **до** унификации пути |
| M10 | STT и LLM с реальными токенами тенанта на русском 8 kHz | D-57 | нужны платные внешние сервисы | оставить сообщение → проверить расшифровку и саммари в «Детали сообщения» |
| M11 | Ссылка из уведомления работает и **перестаёт** работать после TTL | D-59 | нужен реальный Telegram / email | получить уведомление, открыть ссылку, повторить после истечения TTL |
| M12 | Осиротевшие PHP-скрипты больше не вызываются | D-31 | grep по логам PBX | `grep -c 'usr/scripts' /var/log/asterisk/full` после деплоя — не должно расти |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] Покрытие ветвей `dialplan.util.ts` = 29/29 после Wave 0
- [ ] M1…M12 закрыты либо явно отложены с оценкой риска
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
