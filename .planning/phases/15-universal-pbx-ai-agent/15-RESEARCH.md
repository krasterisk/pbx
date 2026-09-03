# Phase 15: universal-pbx-ai-agent - Research

**Researched:** 2026-09-03
**Domain:** In-process NestJS agent loop, OpenAI-compatible tool-calling, DomainAiAdapter tool registry, progressive-disclosure skill files, HITL diff confirmation, SSE streaming, multi-tenant isolation
**Confidence:** HIGH (in-repo hosts, contracts, dispatch paths, SSE/AMI/apply-reload); MEDIUM (thread/proposal schemas, skill file format, step ceiling — Claude's Discretion); LOW (ничего нового из внешнего мира не требуется — внешних источников в этой фазе нет)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Архитектура цикла (D-06…D-09)

- **D-06:** **Свой агентный цикл в Nest** + **подключаемые провайдеры моделей**; внешний **aiPBX становится одним из провайдеров**, а не мозгом. Сейчас `AiChatService` целиком проксирует в aiPBX (`AIPBX_URL` / `AIPBX_CHAT_ID` / `AIPBX_TOKEN`), и `tools/list → LLM → tools/call` крутится вне нашего кода — многошаговость, скилы, подтверждения и аудит в этой схеме нам не подчиняются. — **Reversibility:** one-way — контракт чата, SSE-события и путь вызова моделей меняются целиком; откат означает возврат к внешнему проксированию
- **D-07:** Провайдеров и ключи заводит **только админ платформы**. Тенант не выбирает и не видит модель. Выбор модели **убирается из чата** в админские настройки.
- **D-08:** Расход по тенанту **считается и показывается админу**, жёстких лимитов в этой фазе нет. В аудите уже есть статус `rate_limited`, у провайдера — поле `pricing`. — **Reversibility:** reversible
- **D-09:** Длинные задачи: **потолок шагов + прогресс строкой на каждый вызов + кнопка «Стоп»**. SSE уже отдаёт `tool_call` / `tool_result`, отмена через `AbortSignal` тоже есть.

#### Скилы и знания (D-10…D-14)

- **D-10:** Скилы работают **как в GSD (progressive disclosure)**: в системном промпте только список скилов с описанием, тело читается тулом по требованию. Иначе промпт растёт с каждым модулем.
- **D-11:** Скилы — **файлы в репо рядом с кодом**, версионируются вместе с tools. **Не в `.docs/`:** текущий `KnowledgeBaseService` читает `.docs/`, а эта папка в gitignore — знания не версионируются и в деплое могут отсутствовать вовсе.
- **D-12:** Источники знаний: **наши скилы + живое состояние АТС и CDR + диагностические tools** (логи, состояние каналов, `dialplan show`). Общую теорию телефонии модель знает сама; скилы описывают то, чего она знать не может — наши конвенции.
- **D-13:** **Агент не грузит пользователя терминами.** Отвечает человеческим языком, но обязан уметь выяснить причину: проанализировать логи, состояние каналов и текущие настройки тенанта. Техника — по запросу.
- **D-14:** **Язык — по языку вопроса.** Дефолт — язык интерфейса пользователя (в проекте ru и en), но модель ориентируется сама и отвечает на языке заданного вопроса. Текущее жёсткое «Отвечай по-русски» в промпте уходит. Сами скилы остаются одноязычными.

#### Покрытие модулей и конвенция (D-15…D-17)

- **D-15:** **Чтение — все модули сразу** («знает всё»), **запись — приоритетные домены**: маршруты и цепочка действий + `apply_dialplan`; 7 существующих доменов доводятся до типизированного вида (абоненты, транки, IVR, очереди, контексты); справочники; группы вызова и MOH. Сейчас tools есть только у 7 доменов примерно из 20.
- **D-16:** **Архитектурный паттерн:** любой новый модуль, сервис или фича обязаны поставляться с AI-адаптером и обновлёнными скилами, чтобы агент всегда имел актуальные данные и контекст. Запись — в `packages/backend/.idea/ARCHITECTURE.md` и в скил для разработчиков. — **Reversibility:** costly — конвенция задаёт форму всех будущих модулей
- **D-17:** Конвенция держится **падающим тестом**: реестр модулей сверяется с реестром адаптеров и скилов, нет пары — тест красный. Прецедент — completeness-тест `ActionType` против `ActionTypesList` из Phase 12.

#### Правки, права, тенантность (D-18…D-22)

- **D-18:** Правки идут **черновиком-диффом**: агент предлагает изменение, применяет только после явного согласия. В промпте уже есть текстовое правило для деструктивных операций и тенантный флаг `confirm_destructive` (по умолчанию выключен).
- **D-19:** Согласие даётся **карточкой изменений в чате** — что именно поменяется, кнопки «Применить» / «Отклонить». Не текстовым «да».
- **D-20:** **Применение к живому Asterisk входит в то же подтверждение**: нажал «Применить» — сохранено и dialplan перезагружен. Половинчатое состояние «в БД одно, в Asterisk другое» хуже, чем оба шага сразу.
- **D-21:** Права агента — **ровно те, что у человека в UI**. Агент не становится обходом RBAC и не даёт новых прав.
- **D-22:** **Тенантность доказывается, а не обещается:** `vpbxUserUid` берётся только из JWT вызывающего и передаётся хендлеру **параметром вызова** — модель не может подать его в аргументах tool; плюс **тест на каждый tool**: вызов от тенанта A не видит и не меняет данные B. Контракт адаптеров это уже требует (D-23 Phase 12 закрыл кросс-тенантный баг старого реестра, где uid защёлкивался в хендлере при первом запросе). — **Reversibility:** costly — правило формирует подпись каждого хендлера

#### Поверхность UI (D-23…D-25)

- **D-23:** Остаётся **виджет поверх любой страницы** (как в Cursor), в него добавляются треды и подтверждения. Отдельная страница не нужна.
- **D-24:** **Кнопка вызова переезжает в топбар шелла рядом с ⌘K** + горячая клавиша. Сейчас FAB агента стоит `fixed; bottom: 28px; right: 28px` (z-index 60) и перекрывает элементы: в том же нижнем правом углу живёт хром софтфона из Phase 9, а на мобиле он прибит к `bottom: bottom-nav-height`, где ещё и нижняя навигация из Phase 8. Нижний угол остаётся софтфону.
- **D-25:** **Панель агента переделывается**: шире, без наложений (сейчас пересекаются элементы, в т.ч. выбор модели). Конкретный layout — в `/gsd-ui-phase 15`.

#### История и миграция старого (D-26…D-28)

- **D-26:** **Треды персистятся в БД** по тенанту и пользователю — можно вернуться к разговору и увидеть, что агент наделал. Сейчас история живёт только в Redux-слайсе и умирает при перезагрузке страницы; аудит tool-call при этом пишется в `cc_ai_audit_log`. — **Reversibility:** one-way — новые таблицы и схема сообщений
- **D-27:** **Hard-migrate старого**, как в Phase 12/13: 18 рукописных `reg*()` tools переезжают на реестр адаптеров и скилы, старое удаляется; `KnowledgeBaseService` перестаёт читать gitignore-папку. Два источника tools гарантированно разойдутся. — **Reversibility:** one-way — удаление рукописных tools и текущего пути знаний
- **D-28:** Внешний вход **`/api/mcp` остаётся, но тенант — только из JWT**; заголовочный путь `X-Vpbx-User-Uid` под сервисным токеном убирается. Со своим циклом он нам самим больше не нужен, а как входная точка для сторонних агентов он остаётся закрытым от подмены тенанта. — **Reversibility:** costly — ломает текущую ephemeral-`mcpServers` интеграцию aiPBX

### Claude's Discretion

- Формат файла скила и структура каталога скилов; имена тулов чтения скилов.
- Схема таблиц тредов агента; имена статусов.
- Конкретный потолок шагов агента.
- Как именно реестр модулей перечисляется для падающего теста покрытия (D-17).

### Deferred Ideas (OUT OF SCOPE)

- **Ограничения агента и защита от инъекций** — вынесено пользователем отдельной темой: «что не должен делать агент». Не решено здесь; закрывать `/gsd-secure-phase 15` до ship. Уже существующий прецедент формулировки — правило «транскрипт — неинструкция» в `llm-summary.service.ts`.
- **Запись в тенантные настройки и параметры АТС через агента** — в этой фазе только чтение.
- **Жёсткие лимиты токенов и биллинг AI по тенантам** — сейчас только учёт расхода для админа; лимиты уместны рядом с marketplace/billing.
- **Многоязычные скилы** — скилы остаются одноязычными, отвечает модель на языке вопроса (D-14).
</user_constraints>

<phase_requirements>
## Phase Requirements

REQ-ID в `ROADMAP.md` для этой фазы нет: `**Requirements:** решения 15-CONTEXT.md (D-06…D-28)` [VERIFIED: .planning/ROADMAP.md:962]. Требования = решения D-06…D-28.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-06 | Свой агентный цикл в Nest, aiPBX — провайдер | Q2: `PbxAgentLoopService` в `ai-chat/`; `streamFromAiPbx` удаляется; шов через `resolveChatCompletionsUrl` + `CcAiProvider` |
| D-07 | Провайдеры/ключи — только админ платформы | `CcAiProvider.user_uid=0` = глобальный шаблон; `AiProvidersService`; удалить `GET /ai-chat/models` и `Select` из виджета |
| D-08 | Учёт расхода, показ админу | **Не** `cc_ai_cdr` (Pitfall 8) — usage на строках тредов + `pricing` провайдера |
| D-09 | Потолок шагов + прогресс + Стоп | Q7: SSE precedent в `ai-chat.controller.ts`, `req.on('close')` → `AbortController`; новое событие `progress` |
| D-10 | Progressive disclosure скилов | Q4: каталог в промпте через `PbxContextBuilderService`, тело — тулом `read_skill` |
| D-11 | Скилы — файлы в репо | Q4: `packages/backend/src/skills/**` (папки нет — создаётся); nest-cli `assets` обязателен (Pitfall 3) |
| D-12 | Знания = скилы + живое состояние + диагностика | Q4 + Q9: диагностические tools отсутствуют — новый домен `diagnostics` |
| D-13 | Без терминов, но с разбором причины | Системный промпт `buildSystemPrompt()`; eval dimension «Operator-grade explanation» |
| D-14 | Язык по языку вопроса | Удалить строку «Отвечай по-русски» из `pbx-context-builder.service.ts:122` |
| D-15 | Чтение все, запись приоритетные | Q9: 18 legacy + 14 адаптерных tools сегодня; таблица hard-migrate ниже |
| D-16 | Конвенция «модуль без адаптера — недоделан» | Запись в `packages/backend/.idea/ARCHITECTURE.md` + `skills/developer-convention/SKILL.md` |
| D-17 | Падающий тест покрытия | Q3: форма теста + требуемый новый метод `AiAdapterRegistryService.getDomains()` |
| D-18 | Черновик-дифф | Q5: `AgentDiffProposal` + отложенный `applyPayload` |
| D-19 | Карточка изменений с кнопками | `POST /api/ai-chat/proposals/:id/apply`; UI-SPEC Surface D |
| D-20 | Применение + reload одним шагом | Q5: `RouteApplyService.applyContext()` — единственный корректный оркестратор |
| D-21 | Права ровно как в UI | Хендлеры вызывают те же сервисы; `status: denied` в аудите |
| D-22 | vpbxUserUid только из JWT, параметром | Q6: `AiToolDefinition.handler(args, vpbxUserUid)`; sanitize args; тест на каждый tool |
| D-23 | Виджет поверх страниц | `widgets/AiChatWidget` остаётся, FAB удаляется |
| D-24 | Кнопка в топбар рядом с ⌘K | Q1: `ModuleShell.tsx` header `.topbar`, рядом с `#shell-cmdk-trigger` |
| D-25 | Панель шире, без наложений | 520px / 240px rail из `15-UI-SPEC.md` |
| D-26 | Треды в БД | Q8: две новые таблицы, standalone ts-node миграция |
| D-27 | Hard-migrate 18 reg*() | Q9: полная инвентаризация ниже |
| D-28 | `/api/mcp` только JWT | Q6: удалить сервис-токенную ветку из `JwtOrServiceTokenGuard` для этого входа |
</phase_requirements>

## Summary

Фаза почти целиком **in-repo**: новых npm-пакетов не требуется, весь каркас уже стоит. Реестр адаптеров (`AiAdapterRegistryService`), контракт `DomainAiAdapter` с uid-параметром, единый диспетчер `McpToolsService.callTool(name, args, uid)`, SSE-контракт `text`/`tool_call`/`tool_result`/`done`/`error` с отменой через `AbortSignal`, шифрованные провайдеры `CcAiProvider`, OpenAI-совместимый клиент `llm-summary.service.ts`, атомарный `applyCategories → dialplan reload` — всё это существует и проверено в коде. Работа Phase 15 — **вырезать внешний мозг** (`AiChatService.streamFromAiPbx`), поставить на его место `PbxAgentLoopService`, и достроить четыре отсутствующих куска: скилы-файлы, треды в БД, diff-proposals, диагностические tools.

Три находки, которые ломают предположения из `15-AI-SPEC.md` и требуют решения в плане. **Первая:** «единого пути диспатча» сегодня нет — `POST /api/ai-tools/call/:toolName` вызывает `tool.handler(args, uid)` **напрямую**, минуя `McpToolsService.callTool()`, и дублирует у себя и confirmation-gate, и аудит [VERIFIED: ai-webhook.controller.ts:274-301]. Пока этот путь жив, любой diff-гейт из D-18 обходится одним HTTP-запросом. **Вторая:** `cc_ai_audit_log` объявлена в `app.module.ts`, но **ни одной записи в неё в коде нет** — весь аудит tool-call идёт через `LoggerService.logAction` в `action_logs`. Формулировка AI-SPEC «`cc_ai_audit_log` (primary, already deployed)» верна только про модель, не про данные. **Третья:** legacy-tool `apply_dialplan` собирает диалплан inline и **не вызывает** `RouteApplyService`, из-за чего теряет `dir_policy_*` контексты справочников — то есть агент сегодня применяет маршруты хуже, чем кнопка «Применить» в UI [VERIFIED: mcp-tools.service.ts:423-447 против route-apply.service.ts:58-74].

Миграционный риск сосредоточен не в коде, а в **runtime-состоянии**: убирая `X-Vpbx-User-Uid` (D-28), фаза ломает живую конфигурацию aiPBX, а `.docs/` в gitignore означает, что после D-27 знания надо перенести в репо до удаления `KnowledgeBaseService`, иначе промпт схлопнется до пустого. Плюс `nest build` **не копирует** `.md` в `dist` — скилы без записи в `nest-cli.json assets` будут работать в dev и падать в прод.

**Primary recommendation:** Ноль новых npm-пакетов. `PbxAgentLoopService` в `modules/ai-chat/`, диспатч **только** через `McpToolsService.callTool()` (третий путь `/api/ai-tools/call/:toolName` удалить в той же волне, что D-27), скилы — `packages/backend/src/skills/<domain>/SKILL.md` с ручным разбором двух полей frontmatter (YAML-парсера в репо нет) и обязательной записью в `nest-cli.json assets`, треды — две таблицы standalone ts-node миграцией по образцу `migrate-voicemail.ts`, применение диффа — **только** через `RouteApplyService.applyContext()`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Агентный цикл (LLM ↔ tools, потолок шагов) | API / Backend | — | D-06: цикл в процессе Nest; вне бэкенда нет доступа к RBAC/тенанту/аудиту |
| Вызов модели (chat completions + tools) | API / Backend | External (провайдер) | Ключ провайдера шифрован в БД; браузер ключа не видит никогда |
| Enumeration и dispatch tools | API / Backend | — | `McpToolsService` — единственный держатель реестра |
| Тенантная изоляция (`vpbxUserUid`) | API / Backend | — | D-22: только из JWT на сервере; клиент не участник решения |
| RBAC-паритет с UI | API / Backend | — | D-21: те же сервисы и гварды, что REST-контроллеры |
| Загрузка и выдача скилов | API / Backend | CDN/Static (`dist` assets) | D-11: файлы в репо, читаются fs при старте/по требованию |
| Diff proposal (сборка before/after) | API / Backend | — | `previewUpdate` требует чтения текущего состояния тенанта |
| Diff confirmation (Apply/Reject) | Browser / Client | API / Backend | D-19: решение человека в UI, исполнение — на сервере по `proposalId` |
| Применение в БД + `dialplan reload` | API / Backend | Database + AMI | D-20: один транзакционный шаг `RouteApplyService` |
| Персист тредов | Database / Storage | API / Backend | D-26: Sequelize + tenant scope |
| Стриминг ответа | API / Backend | Browser / Client | SSE `res.write()`, клиент парсит вручную (precedent существует) |
| Кэш истории на клиенте | Browser / Client | — | Redux `aiChatSlice` понижается до кэша, hydrate из API |
| Триггер + панель + карточка диффа | Browser / Client | — | `ModuleShell` topbar + `widgets/AiChatWidget` |
| Учёт расхода токенов | Database / Storage | API / Backend | D-08: строки тредов + `CcAiProvider.pricing`, админский экран |
| Аудит tool-call | Database / Storage | API / Backend | Append-only, пишется **до** отдачи `tool_result` в SSE |

## Project Constraints (from .cursor/rules/)

`.cursor/rules/` существует и содержит один файл: `sketch-findings-krasterisk-v4.mdc` [VERIFIED: .cursor/rules/ — единственная запись]. Плюс корневой `AGENTS.md`, который для агента-исполнителя имеет ту же силу.

| Директива | Источник | Влияние на Phase 15 |
|-----------|----------|---------------------|
| Verify перед «готово»: `npm run lint`, `npm run test:backend`, `npm run test:frontend` | `AGENTS.md` | Три команды — гейт каждой волны; `test:backend` = jest, `test:frontend` = vitest |
| MUST READ архитектур: `packages/{frontend,backend}/.idea/ARCHITECTURE.md` | `AGENTS.md` | Backend ARCHITECTURE — точка записи конвенции D-16; там же устаревшее «16 MCP tools» (см. Runtime State Inventory) |
| Winners шелла Phase 8: топбар с breadcrumbs + ⌘K, мобильный bottom bar | `.cursor/rules/sketch-findings-krasterisk-v4.mdc` | D-24 обязан вписаться в существующий топбар, не менять его высоту (56px по UI-SPEC) |
| Tailwind — только внутри `shared/ui`; выше — SCSS-модули + `var(--color-*)` | frontend ARCHITECTURE (MUST) | Панель агента и diff-карточка — SCSS-модули; inline `style` из текущего `Select` уходит |
| Optimistic toggles (MUST): `Switch` с мгновенным PUT через RTK `onQueryStarted` + undo | frontend ARCHITECTURE (MUST) | Применимо к тумблерам настроек агента; **не** применимо к Apply диффа (это не toggle, а мутация с подтверждением) |
| No emoji icons (MUST): только `lucide-react` | frontend ARCHITECTURE (MUST) | Текущие legacy-tools возвращают `✅` / `⚠️` / `❌` в текст ответа — при hard-migrate строки результата чистить от эмодзи (UI-SPEC делает исключение только для markdown-контента модели) |
| i18n: любая строка через `t()`, ключи в **обоих** `ru.ts` и `en.ts` | frontend ARCHITECTURE (MUST) | ~60 новых ключей `aiChat.*` из `15-UI-SPEC.md`; хардкод RU в `SUGGESTIONS` виджета удаляется |

## Standard Stack

### Core

Фаза не добавляет ни одного нового рантайм-пакета. Всё уже в `packages/backend/package.json` / `packages/frontend/package.json`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/*` | 10.x (в репо) | Модули, DI, гварды, `@Sse`, `Throttle` | Единственный бэкенд-фреймворк проекта |
| `axios` | `^1.16.0` | HTTP к провайдеру LLM | Уже так делает `llm-summary.service.ts`; `validateStatus: () => true` + `timeout` [VERIFIED: llm-summary.service.ts:104-119] |
| глобальный `fetch` (Node 24) | встроенный | Стриминг chat-completions (`response.body.getReader()`) | `streamFromAiPbx` уже так стримит; axios в Node не отдаёт web-stream удобно [VERIFIED: ai-chat.service.ts:110-117] |
| `sequelize-typescript` | в репо | Модели тредов и proposals | `synchronize: false` — схема создаётся скриптом [VERIFIED: app.module.ts:177-178: `autoLoadModels: false,` / `synchronize: false, // IMPORTANT: never auto-sync with existing DB`] |
| `class-validator` + `class-transformer` | в репо | Валидация tool-args от модели и `AgentDiffProposal` | Прецедент `parseAndValidateSummary` [VERIFIED: llm-summary.service.ts:42-61] |
| `node:crypto` | встроенный | `randomUUID()` для `proposalId`; AES-GCM ключей | `uuid` в репо — версия `^3.4.0`, устаревший API; **не использовать** |
| `jest` | `^29.7.0` | Бэкенд-тесты, eval-харнесс | `npm run test:backend` |
| `vitest` | `^4.1.4` | Фронтенд-тесты | `npm run test:frontend` |
| `lucide-react` | в репо | Иконки триггера/карточки | MUST из ARCHITECTURE |
| Radix через `shared/ui` | 39 компонентов | `Sheet`, `Card`, `Badge`, `Button`, `ScrollArea`, `Progress`, `Dialog`, `Tooltip` | `Sheet` и `CommandPalette` присутствуют — проверено наличием каталогов |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@modelcontextprotocol/sdk` | `^1.29.0` (в deps) | — | **Не использовать.** `McpSessionService` намеренно реализует JSON-RPC руками: «SDK требует полный initialize handshake даже в stateless режиме» [VERIFIED: mcp-session.service.ts:6-10]. После D-28 зависимость становится кандидатом на удаление — отдельным решением плана |
| `@nestjs/throttler` | в репо | Rate limit на `POST /message` | Уже стоит `@Throttle({ global: { limit: 10, ttl: 60000 } })` [VERIFIED: ai-chat.controller.ts:133] |
| `rxjs` + `@Sse()` | в репо | Альтернативный SSE-путь | **Не для агента:** `@Sse()` — только GET; агенту нужен POST с телом. См. Q7 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Ручной агентный цикл | LangGraph.js / LangChain.js | Запрещено `15-AI-SPEC.md` §2 (framework locked). Не релитигируем |
| Ручной парсинг frontmatter скилов | `gray-matter` / `js-yaml` | Обоих в репо нет: `js-yaml = ABSENT`, `gray-matter = ABSENT`, `yaml = ABSENT` — проверено по `package.json`. Два поля (`name`, `description`) разбираются регуляркой в 10 строк; новый пакет ради этого не оправдан |
| `openai` SDK | Ручной `axios`/`fetch` к `/v1/chat/completions` | `openai = ABSENT`. Провайдеры в проекте разнородные (OpenAI / Ollama / aiPBX / Qwen), `resolveChatCompletionsUrl` уже нормализует endpoint. SDK привяжет к одной форме auth |
| `eventsource-parser` | Ручной парсинг SSE-строк | `eventsource-parser = ABSENT`. Парсер уже написан на фронте [VERIFIED: aiChatApi.ts:82-104]; для чтения стрима **от провайдера** на бэкенде нужен второй, ~25 строк |
| `promptfoo` (из AI-SPEC §5, «optional») | Jest-харнесс с фикстурами | Пакета в репо нет и он не верифицирован из авторитетного источника в этой сессии → `[ASSUMED]`. Рекомендация: **в baseline не вносить**; Jest-фикстурный replay покрывает все Code-колонки eval-таблицы |

**Installation:**

```bash
# Ничего устанавливать не нужно
npm install
```

**Version verification:** проверено чтением `package.json` в этой сессии: `axios ^1.16.0`, `@modelcontextprotocol/sdk ^1.29.0`, `jest ^29.7.0`, `vitest ^4.1.4`, `uuid ^3.4.0`; отсутствуют `openai`, `js-yaml`, `yaml`, `gray-matter`, `front-matter`, `marked`, `@anthropic-ai/sdk`, `eventsource-parser`, `p-limit`. Node: `"engines": {"node":">=22.0.0"}` в корневом `package.json`, локально `v24.19.0` — `crypto.randomUUID()` и глобальный `fetch` доступны.

## Package Legitimacy Audit

Фаза внешних пакетов **не устанавливает** — гейт не запускался, потому что запускать его не на чем.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| — | — | — | Новых зависимостей нет |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Единственный кандидат на установку — `promptfoo` из `15-AI-SPEC.md` §5 (помечен там как *optional*). В этой сессии он **не** верифицирован по авторитетному источнику → `[ASSUMED]`. Если план всё же вносит его, требуется `checkpoint:human-verify` перед `npm install -D promptfoo` и прогон `gsd-tools query package-legitimacy check --ecosystem npm promptfoo`. Рекомендация research — не вносить в этой фазе.

## Architecture Patterns

### System Architecture Diagram

```
                          Browser
  ┌────────────────────────────────────────────────────────────┐
  │ ModuleShell topbar: #shell-ai-trigger  (Ctrl/Meta+Shift+J) │
  │        │ toggle                                            │
  │        ▼                                                   │
  │ AiChatWidget panel 520px  ──┬── ThreadList (240px rail)    │
  │                             ├── message stream             │
  │                             ├── DiffConfirmCard            │
  │                             └── input + Stop               │
  └───┬──────────────┬───────────────────────┬─────────────────┘
      │ RTK Query    │ fetch + SSE reader    │ RTK mutation
      │ (треды)      │ (POST /message)       │ (Apply/Reject)
      ▼              ▼                       ▼
 ┌─────────────────────────────────────────────────────────────┐
 │            AiChatController   (JwtAuthGuard ONLY)           │
 │  req.user.vpbx_user_uid  ← единственный источник тенанта    │
 │  res: text/event-stream ; req.on('close') → AbortController │
 └───────────────────────────┬─────────────────────────────────┘
                             ▼
             ┌───────────────────────────────────┐
             │      PbxAgentLoopService          │
             │  step = 0 .. MAX_AGENT_STEPS      │
             └──┬──────────┬─────────┬───────────┘
                │          │         │
    системный   │          │ LLM     │ tool_calls
    промпт      │          ▼         ▼
                │   ┌────────────┐  ┌──────────────────────────┐
                │   │PbxAgentLlm │  │ McpToolsService.callTool  │
                │   │  Client    │  │  (name, args, uid)        │
                │   │ axios/fetch│  │  ┌ sanitize args (D-22)   │
                │   └─────┬──────┘  │  ├ RBAC / destructive gate│
                │         │         │  ├ audit BEFORE yield     │
                │         ▼         │  └ dispatch               │
                │  CcAiProvider     └────┬────────────┬─────────┘
                │  (endpoint +           │            │
                │   decryptSecret)       │            │
                │                        ▼            ▼
     ┌──────────┴───────────┐   AiAdapterRegistry   [legacy reg*()
     │ PbxAgentContext      │   .getAllTools()       — удаляется D-27]
     │ Builder              │        │
     │ • состояние тенанта  │        ▼
     │ • adapter knowledge  │   <domain>-ai.adapter.ts × N
     │ • КАТАЛОГ скилов     │   (directories / voicemail /
     └──────────┬───────────┘    callcenter / routes / … )
                │                     │
                ▼                     │ mutating tool
     AgentSkillRegistryService        ▼
     src/skills/<domain>/SKILL.md   AgentDiffProposal (status: pending)
     list_skills / read_skill              │
                                           │ НЕ пишет в БД
                                           ▼
                            ┌──────────────────────────────┐
                            │ POST /proposals/:id/apply    │
                            │  JWT + RBAC + proposalId     │
                            └───────────┬──────────────────┘
                                        ▼
                            RouteApplyService.applyContext()
                              ├ dir_policy_* categories (reload:false)
                              └ extensions_<ctx>.conf   (reload:true)
                                        ▼
                            DialplanApplyService → AMI
                            CreateConfig → UpdateConfig → dialplan reload

   Внешний вход (сохраняется, D-28):
   /api/mcp  ── McpController ── McpSessionService ── McpToolsService
               (JWT only; сервис-токенная ветка удаляется)
   /api/ai-tools/*  ── УДАЛЯЕТСЯ целиком (третий путь диспатча)
```

### Recommended Project Structure

```
packages/backend/src/
├── modules/
│   ├── ai-platform/                      # контракт и реестры (СУЩЕСТВУЕТ)
│   │   ├── ai-adapter.types.ts           #   + AgentDiffProposal тип
│   │   ├── ai-adapter-registry.service.ts#   + getDomains() для D-17
│   │   ├── agent-skill-registry.service.ts   # НОВОЕ — каталог + read_skill
│   │   ├── agent-skill-registry.service.spec.ts
│   │   ├── ai-adapter-completeness.spec.ts   # НОВОЕ — падающий тест D-17
│   │   └── ai-platform.module.ts
│   ├── ai-chat/
│   │   ├── pbx-agent-loop.service.ts     # НОВОЕ — цикл (заменяет прокси)
│   │   ├── pbx-agent-llm.client.ts       # НОВОЕ — OpenAI-compat + tools + stream
│   │   ├── pbx-agent-thread.service.ts   # НОВОЕ — треды (D-26)
│   │   ├── pbx-agent-diff.service.ts     # НОВОЕ — proposals + apply (D-18…D-20)
│   │   ├── models/agent-thread.model.ts       # НОВОЕ
│   │   ├── models/agent-thread-message.model.ts # НОВОЕ
│   │   ├── models/agent-proposal.model.ts     # НОВОЕ
│   │   ├── migrate-agent-threads.ts      # НОВОЕ — standalone ts-node
│   │   ├── pbx-context-builder.service.ts# ПРАВКА — D-10/D-13/D-14
│   │   ├── ai-chat.controller.ts         # ПРАВКА — треды, proposals, progress
│   │   ├── ai-chat.service.ts            # УДАЛЯЕТСЯ (streamFromAiPbx, D-06)
│   │   ├── ai-webhook.controller.ts      # УДАЛЯЕТСЯ (третий путь диспатча)
│   │   └── knowledge-base.service.ts     # УДАЛЯЕТСЯ (.docs/, D-11/D-27)
│   ├── mcp/
│   │   ├── mcp-tools.service.ts          # ПРАВКА — 18 reg*() вырезаются (D-27)
│   │   └── mcp.controller.ts             # ПРАВКА — JwtAuthGuard (D-28)
│   ├── diagnostics/                      # НОВОЕ — D-12 (логи, каналы, dialplan show)
│   │   └── diagnostics-ai.adapter.ts
│   └── <domain>/<domain>-ai.adapter.ts   # по одному на модуль (D-15/D-16)
└── skills/                               # НОВОЕ — D-11, версионируется с кодом
    ├── routes/SKILL.md
    ├── directories/SKILL.md
    ├── queues/SKILL.md
    ├── endpoints/SKILL.md
    ├── trunks/SKILL.md
    ├── ivrs/SKILL.md
    ├── diagnostics/SKILL.md
    └── developer-convention/SKILL.md     # D-16 для разработчиков
```

Фронтенд — по FSD-раскладке из `15-UI-SPEC.md` §FSD placement: триггер в `widgets/ModuleShell`, шелл панели в `widgets/AiChatWidget`, `DiffConfirmCard` / `ThreadList` в `features/ai-chat/ui`, RTK в `shared/api/endpoints/aiChatApi.ts`, локали в `shared/config/locales/{ru,en}.ts`.

### Pattern 1: Адаптер регистрируется сам через OnModuleInit

**What:** каждый домен реализует `DomainAiAdapter` и кладёт себя в реестр в своём `onModuleInit`. Авто-дискавери через `DiscoveryService` намеренно не используется.
**When to use:** каждый новый домен по D-15/D-16.

```typescript
// Source: packages/backend/src/modules/voicemail/voicemail-ai.adapter.ts:40-56
@Injectable()
export class VoicemailAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(VoicemailAiAdapter.name);
  readonly domain = 'voicemail';

  constructor(
    private readonly voicemailService: VoicemailService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('VoicemailAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListVoicemailMessages(), this.toolGetVoicemailMessage()];
  }
```

Обоснование выбора зафиксировано в самом реестре: «Adapters register themselves explicitly via OnModuleInit … rather than being auto-discovered — simpler and more predictable than a DiscoveryService scan, and avoids a new dependency» [VERIFIED: ai-adapter-registry.service.ts:5-9].

### Pattern 2: uid — второй параметр хендлера, никогда не замыкание

**What:** контракт `AiToolDefinition` фиксирует подпись `handler(args, vpbxUserUid)`.
**When to use:** всегда. Это единственная механическая гарантия D-22.

```typescript
// Source: packages/backend/src/modules/ai-platform/ai-adapter.types.ts:23-36
export interface AiToolDefinition {
  /** snake_case tool name, unique across all adapters and legacy tools */
  name: string;
  /** Tool description, in the style of the 18 existing MCP tools (D-13) */
  description: string;
  /** Flat JSON-schema `properties` object — no separate metadata layer (D-13) */
  inputSchema: Record<string, any>;
  /** Entity type recorded in action_logs for this tool's calls (D-19) */
  entityType: string;
  /** Marks the tool as subject to the per-tenant confirmation gate (D-20/D-25) */
  destructive?: boolean;
  /** vpbxUserUid is passed as a call parameter — never closed over at registration */
  handler: (args: Record<string, any>, vpbxUserUid: number) => Promise<string | Record<string, any>>;
}
```

### Pattern 3: Атомарное применение — только через RouteApplyService

**What:** сохранение в БД, генерация диалплана, запись политик справочников и **один** `dialplan reload` в конце.
**When to use:** любой apply диффа, затрагивающий маршруты (D-20).

```typescript
// Source: packages/backend/src/modules/routes/route-apply.service.ts:58-74
    if (policyCategories.length > 0) {
      await this.dialplanApplyService.applyCategories(
        `krasterisk/directories/dir_${vpbxUserUid}.conf`,
        policyCategories,
        { reload: false },
      );
    }

    const dialplan = await this.routesService.generateContextDialplan(
      contextUid, vpbxUserUid, context.name, includes, isAdmin,
    );
    const filename = `krasterisk/routes/extensions_${tenantedContextName}.conf`;
    const result = await this.dialplanApplyService.applyCategories(
      filename,
      [{ name: tenantedContextName, lines: dialplan.split('\n') }],
      { reload: true },
    );
```

### Pattern 4: SSE без `@Sse()` — ручные заголовки + res.write

**What:** POST с телом + стрим в ответ; `@Sse()` из Nest не годится, он только GET.
**When to use:** `POST /api/ai-chat/threads/:uid/message`.

```typescript
// Source: packages/backend/src/modules/ai-chat/ai-chat.controller.ts:144-168
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const abortController = new AbortController();
        req.on('close', () => abortController.abort());
        // ...
            for await (const chunk of stream) {
                if (abortController.signal.aborted) break;
                res.write(chunk);
```

`X-Accel-Buffering: no` обязателен — без него nginx буферизует и стрим приходит пачкой в конце.

### Pattern 5: Completeness-тест как страховка от расхождения реестров

**What:** два независимых списка сверяются `toEqual` + жёсткая проверка длины.
**When to use:** форма для D-17.

```typescript
// Source: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts:92-97
  it('DIALPLAN_ACTION_META keys match ActionTypesList', () => {
    const metaKeys = Object.keys(DIALPLAN_ACTION_META).sort();
    const listKeys = [...ActionTypesList].sort();
    expect(metaKeys).toEqual(listKeys);
    expect(metaKeys).toHaveLength(23);
  });
```

### Pattern 6: Standalone ts-node миграция (миграционного фреймворка нет)

**What:** отдельный скрипт с `dotenv` от корня репо, `qi.createTable(..., { ifNotExists: true } as any)`, `addIndex` в try/catch.
**When to use:** таблицы тредов и proposals (D-26).

```typescript
// Source: packages/backend/src/modules/voicemail/migrate-voicemail.ts:1-53 (сокращено)
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });
// ...
 * Standalone script (pattern: migrate-notifications-phase6.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
// ...
  const qi: QueryInterface = sequelize.getQueryInterface();
  await qi.createTable('voicemail_messages', { /* ... */ }, { ifNotExists: true } as any);
  try {
    await qi.addIndex('voicemail_messages', ['vpbx_user_uid', 'uniqueid'], {
      name: 'uq_voicemail_messages_tenant_uniqueid',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] uq_voicemail_messages_tenant_uniqueid:', (e as Error).message);
  }
```

### Anti-Patterns to Avoid

- **Второй/третий путь диспатча tools.** Сегодня их три: `McpSessionService` → `callTool()`, `AiWebhookController` 7 рукописных REST-эндпоинтов, и `AiWebhookController.callAdapterTool()` → `tool.handler()` напрямую. Diff-гейт, поставленный только в `callTool()`, обходится через третий. Удалять весь `ai-webhook.controller.ts` в той же волне, что D-27.
- **`confirm=true` в аргументах модели как согласие.** Текущий гейт `if (tool.destructive && args?.confirm !== true)` [VERIFIED: mcp-tools.service.ts:126] позволяет модели самой «подтвердить». D-19 требует подтверждения человеком через отдельный аутентифицированный вызов.
- **Тело скила в системном промпте.** Убивает D-10; каждый новый модуль будет линейно раздувать промпт.
- **`@Sse()` + Observable для агента.** Не принимает POST-тело, и отмена приходит через unsubscribe, а не `AbortSignal` — оба свойства нужны.
- **`autoLoadModels: true` / `synchronize: true` ради новых таблиц.** Прямо запрещено комментарием в `app.module.ts:178`.
- **Хранение расхода токенов чата в `cc_ai_cdr`.** См. Pitfall 8.
- **Логика тенантности в аргументах tool.** Любое поле вида `vpbxUserUid` / `user_uid` / `tenantId` в `inputSchema` — дефект.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Применение диалплана к Asterisk | Свой AMI `UpdateConfig`-батчер | `DialplanApplyService.applyCategories()` | Уже консолидирует `CreateConfig`/`DelCat`/`NewCat`/`Append` батчами по 20 из-за лимита AMI ~32 заголовка, обрабатывает «file already exists» [VERIFIED: dialplan-apply.service.ts:20-30, 122-124] |
| Маршрут + политики справочников + reload | Inline-генерация как в `apply_dialplan` | `RouteApplyService.applyContext()` | Legacy-tool теряет `dir_policy_*` — уже баг, не воспроизводить |
| Тенантный суффикс в именах Asterisk | Своя конкатенация | `RouteApplyService.buildContextName()` / `dialplan.util` | Идемпотентная проверка `endsWith(suffix)` [VERIFIED: route-apply.service.ts:32-35] |
| Шифрование ключа провайдера | Свой AES | `encryptSecret` / `decryptSecret` | AES-256-GCM, scrypt от `CC_AI_KEY_SECRET`, формат `iv(12) || tag(16) || ct` [VERIFIED: secret-cipher.util.ts:14-42] |
| Нормализация endpoint провайдера | Свои `if`-ы по вендорам | `resolveChatCompletionsUrl(provider.endpoint)` | Уже покрывает `/v1/chat/completions`, `/chat/completions`, отсекает `ws(s)://` и Ollama `/api/chat` [VERIFIED: llm-summary.service.ts:12-20] |
| Валидация JSON от модели | Ручные `typeof`-проверки | `plainToInstance` + `validateSync({ whitelist: true, forbidNonWhitelisted: true })` | Прецедент с кодами ошибок `LLM_JSON_PARSE` / `LLM_SCHEMA` [VERIFIED: llm-summary.service.ts:42-52] |
| Извлечение JWT для SSE | Свой парсер query-token | `JwtStrategy` `ExtractJwt.fromExtractors([...fromAuthHeaderAsBearerToken(), ...fromUrlQueryParameter('token')])` | Уже поддерживает оба способа; комментарий прямо про SSE [VERIFIED: jwt.strategy.ts:14-19] |
| Парсинг SSE на клиенте | Новый пакет | Существующий ридер в `streamAiChatMessage` | Полный парсер `event:`/`data:` с буфером и `AbortController` [VERIFIED: aiChatApi.ts:73-114] |
| Rate limit на чат | Свой счётчик | `@Throttle({ global: { limit: 10, ttl: 60000 } })` | Стоит на `POST /message` |
| Аудит действия | Свой INSERT | `LoggerService.logAction(...)` **и** явная строка в `cc_ai_audit_log` | Первое — существующая практика, второе — требование AI-SPEC guardrail «Audit-before-SSE»; сейчас второго нет вовсе |
| Генерация `proposalId` | `uuid@3` | `crypto.randomUUID()` | `uuid ^3.4.0` — API v3 (`require('uuid/v4')`), Node ≥22 даёт нативный |
| Панель/шторка UI | Свой fixed div с нуля | `shared/ui/Sheet` либо текущий overlay+panel | Компонент есть; UI-SPEC допускает оба |

**Key insight:** в этом домене «руками» уже написано слишком много — три пути диспатча, две реализации apply, два места с confirmation-gate и два с аудит-логом. Ценность Phase 15 не в новом коде, а в **сведении к одному пути** каждого из этих четырёх.

## Ответы на вопросы планировщика

### Q1. Хост триггера в топбаре и панель 520px

**Файл:** `packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx` — не `AppLayout.tsx`. `AppLayout` только монтирует `<ModuleShell>` и `<AiChatWidget />` [VERIFIED: AppLayout.tsx:33-37], а сам топбар живёт в `ModuleShell`.

Топбар — `<header className={cls.topbar}>` на строке 176. Порядок элементов: логотип → `ModuleBreadcrumbs` → `cls.spacer` → `#shell-cmdk-trigger` → `#shell-lang-toggle` → `#shell-theme-toggle` → `UserBlock`. Точка вставки по UI-SPEC («слева от ⌘K») — **перед строкой 199**, id `#shell-ai-trigger`.

```tsx
// Source: packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx:199-209
        <Button
          type="button"
          variant="ghost"
          size="sm"
          id="shell-cmdk-trigger"
          onClick={() => setPaletteOpen(true)}
          aria-label={t('commandPalette.placeholder')}
        >
          <Search size={16} aria-hidden />
          <span className={cls.cmdHint}>⌘K</span>
        </Button>
```

**Как зарегистрирован ⌘K:** не `useHotkeys` и не библиотека — **сырой `window.addEventListener('keydown')` в `useEffect`**:

```tsx
// Source: packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx:134-143
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k') return;
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setPaletteOpen((open) => !open);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
```

`Ctrl/Meta+Shift+J` регистрируется тем же паттерном — второй `useEffect` с `e.shiftKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j'`. Важно: у `ModuleShell` **нет** доступа к состоянию открытия панели агента (оно в `aiChatSlice`), поэтому триггер должен дёргать `dispatch(aiChatActions.toggleChat())` и читать `selectAiChatIsOpen` — либо через новый хук `useAiChatTrigger()` в `features/ai-chat`, чтобы не тащить слайс в widget-слой напрямую.

**Панель:** `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx` + `.module.scss`. Что меняется по числам:

| Что | Сейчас | Целевое |
|-----|--------|---------|
| FAB `.triggerBtn` | `position: fixed; bottom: 28px; right: 28px; width: 52px; height: 52px; z-index: var(--z-index-popover)` (строки 53-65) | **удалить** (D-24) |
| Ширина панели | `width: 420px` (строка 35) | `520px` |
| Оверлей | `right: 420px` (строка 11) | `520px` |
| Мобильная панель | `width: 100vw` (строка 223) | без изменений |
| Мобильный FAB | `bottom: 20px; right: 16px` (строки 228-229) | удалить вместе с FAB |
| Модель | `<Select style={{ width:'auto', minWidth:'120px', ... }}>` (строки 149-159) | удалить (D-07, и inline-`style` запрещён ARCHITECTURE) |

**Z-index — верифицированная шкала:**

```css
/* Source: packages/frontend/src/app/styles/globals.css:52-60 */
  /* Z-Index Layers */
  --z-index-dropdown: 20;
  --z-index-header: 30;
  --z-index-backdrop: 35;
  --z-index-sidebar: 40;
  --z-index-modal: 50;
  --z-index-modal-nested: 55;
  --z-index-popover: 60;
  --z-index-toast: 100;
```

Панель уже стоит на `--z-index-modal` (строка 41), оверлей на `--z-index-backdrop` (строка 13) — ровно то, что требует UI-SPEC. Менять не нужно.

**Коллизия с софтфоном — уточнение против CONTEXT.** `SoftphoneWidget` монтируется **не глобально**, а внутри `CallCenterAgentPage.tsx:1154`, и его десктопный хром — `position: relative` (строка 10), inline внутри страницы. Фиксированным он становится только на мобиле: `position: fixed; right: 0; bottom: calc(#{$bottom-nav-height} + env(safe-area-inset-bottom, 0px)); z-index: var(--z-index-toast)` при `$bottom-nav-height: 60px` (строки 369-377). То есть **реальная коллизия сегодня — только на мобиле и только на странице агента КЦ**; на десктопе FAB агента перекрывал не софтфон, а контент страницы. Перенос в топбар всё равно правильный (D-24 залочен), но планировщику не нужно строить сложную логику взаимного z-index: софтфон уже на 100, панель на 50, входящий звонок поверх — как требует UI-SPEC, без изменений.

### Q2. Где живёт цикл и как уйти с streamFromAiPbx

**Новое:** `packages/backend/src/modules/ai-chat/pbx-agent-loop.service.ts`. Модуль `ai-chat` — правильное место: там уже `PbxContextBuilderService`, `AiChatSettingsService`, контроллер и `ai-chat.module.ts`.

**Что заменяется:** `AiChatService` (файл целиком, 148 строк) — два публичных метода:

| Метод | Кто вызывает | Судьба |
|-------|--------------|--------|
| `streamFromAiPbx(message, history, userUid, signal)` | `AiChatController.sendMessage` — **единственный вызов** | Заменяется `PbxAgentLoopService.runAgentTurn()` |
| `getAvailableModels()` | `AiChatController.getModels` → `GET /api/ai-chat/models` → фронт `useGetAiChatModelsQuery` | Удаляется по D-07 (тенант модель не видит) |

**Внешних потребителей нет** — проверено grep'ом по `packages/backend/src`: `AiChatService` упоминается только в `ai-chat.service.ts` (объявление), `ai-chat.module.ts:40` (провайдер) и `ai-chat.controller.ts:19,65` (инжект). Это делает миграцию простой: один контроллер, один метод, нет параллельного периода совместимости.

**Одна деталь при удалении файла:** контроллер импортирует из него не только сервис, но и тип — `import { AiChatService, ChatMessage } from './ai-chat.service';` [VERIFIED: ai-chat.controller.ts:19], а `ChatMessageDto.role` типизирован через него. Интерфейс `ChatMessage` переносится (в `dto/` или в новый `pbx-agent.types.ts`) **до** удаления файла, иначе сборка встанет на типе, а не на логике.

Порядок в плане:

1. `PbxAgentLlmClient` — обобщённый `llm-summary.service.ts`: тот же `resolveChatCompletionsUrl` + `decryptSecret` + `auth_type`, но с `tools` в теле и `stream: true`. Экспортировать `resolveChatCompletionsUrl` можно как есть — он уже `export function` и не привязан к voicemail.
2. `PbxAgentLoopService` с шагом ceiling и `AbortSignal`, отдающий тот же SSE-формат строк.
3. Контроллер переключается на новый сервис; `ai-chat.service.ts` и метод `getModels` удаляются; фронтовый `useGetAiChatModelsQuery` и `Select` уходят.
4. `AIPBX_URL` / `AIPBX_CHAT_ID` / `AIPBX_TOKEN` перестают читаться из `ConfigService` и превращаются в строку `cc_ai_providers` (`vendor: 'aipbx'`) — см. Runtime State Inventory.

**Сохранить обязательно:** имена SSE-событий `text` / `tool_call` / `tool_result` / `done` / `error`, потому что фронтовый парсер жёстко их разбирает:

```typescript
// Source: packages/frontend/src/shared/api/endpoints/aiChatApi.ts:94-98
                            if (eventType === 'text') params.onText(data);
                            else if (eventType === 'tool_call') params.onToolCall(data);
                            else if (eventType === 'tool_result') params.onToolResult(data);
                            else if (eventType === 'done') { params.onDone(); return; }
                            else if (eventType === 'error') { params.onError(data); return; }
```

Новые события (`progress`, `diff_proposal`) добавляются в обе стороны одновременно; неизвестные типы фронт сейчас молча игнорирует (`eventType = ''` после каждого `data:`), так что порядок «бэкенд первый» безопасен.

**Побочный эффект, который надо снять:** контроллер сейчас делает «hallucination detection» — сканирует чанки строкой `chunk.includes('event: tool_call')` и регуляркой `chunk.match(/data: (.+)/)` [VERIFIED: ai-chat.controller.ts:171-190], потому что не имеет доступа к тому, что происходит внутри aiPBX. Со своим циклом эта эвристика становится ненужной: цикл сам знает список вызванных tools и их результаты. Заменить на структурированный возврат из `runAgentTurn` (или на счётчики в замыкании), а проверку `mcpEnabled` по `KRASTERISK_PUBLIC_URL`/`KRASTERISK_SERVICE_TOKEN` (строки 204-207) удалить — эти переменные после D-28 не нужны.

### Q3. Enumeration, dispatch и тест покрытия D-16/D-17

**Enumeration.** `McpToolsService.registerAll()` кладёт в один `Map` сначала 18 legacy, потом всё из адаптеров:

```typescript
// Source: packages/backend/src/modules/mcp/mcp-tools.service.ts:96-105
        for (const t of this.aiAdapterRegistry.getAllTools()) {
            this.reg(t.name, t.description, t.inputSchema, async (args, uid) => {
                const result = await t.handler(args, uid);
                const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                return [{ type: 'text', text }];
            }, t.entityType, !!t.destructive);
        }

        this.logger.log(`Registered ${this.toolRegistry.size} MCP tools`);
    }
```

`getToolsList(uid)` оборачивает плоский `inputSchema` в `{ type: 'object', properties: def.inputSchema }` [VERIFIED: mcp-tools.service.ts:110-114]. Для OpenAI-совместимого `tools[]` агентному циклу нужна ещё одна обёртка `{ type: 'function', function: { name, description, parameters } }` — это чистая трансформация в `PbxAgentLlmClient`, реестр менять не надо.

**Ленивая инициализация — грабли.** `registerAll()` вызывается лениво: `if (this.toolRegistry.size === 0) this.registerAll();` в начале и `getToolsList`, и `callTool` [VERIFIED: mcp-tools.service.ts:109, 118]. Это остаток истории с cross-tenant багом. Реестр uid-независим, так что лень безвредна, но она значит, что **первый** `getToolsList` в процессе фиксирует набор адаптеров. Если какой-то адаптер зарегистрируется позже (например, лениво инстанцированный модуль), его tools не появятся до перезапуска. Рекомендация: перевести на `OnApplicationBootstrap` (после всех `onModuleInit`) и сделать `registerAll()` идемпотентным без проверки `size === 0`.

**Dispatch.** Единственная правильная точка — `callTool(name, args, vpbxUserUid)` [VERIFIED: mcp-tools.service.ts:117]. Она делает: lookup → destructive-гейт → `handler(args, uid)` → `logAction` (success/error) → маппинг ошибки в текст. Агентный цикл вызывает **только её**. Третий путь (`AiWebhookController.callAdapterTool`) удаляется.

**Тест D-17.** Реестра модулей, годного для сверки, в репо нет: фронтовый `moduleRegistry.ts` — это 7 hub-модулей (`overview`, `core`, `apps`, `system`, `callcenter`, `analytics`, `ai`), а не ~20 PBX-доменов. Бэкендных каталогов модулей 41 (`ai-agents … voicemail`), из них большая часть — инфраструктура (`ami`, `ari`, `auth`, `config`, `health`, `logger`, `mailer`, `redis`, `roles`, `mcp`, `ai-platform`, `ai-chat`, `dialplan-bridge`, `prompts`).

Рабочая форма — **явный список доменов + deny-list инфраструктуры + сверка с ФС и с реестром**, три независимых утверждения:

```typescript
// packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts
import * as fs from 'fs';
import * as path from 'path';

/** Домены АТС, обязанные иметь AI-адаптер и скил (D-16). Единственный ручной список. */
const AI_COVERED_DOMAINS = [
  'call-groups', 'callcenter', 'contexts', 'diagnostics', 'directories',
  'endpoints', 'ivrs', 'moh', 'numbers', 'queues', 'reports', 'routes',
  'sms', 'stt-engines', 'system-settings', 'telegram', 'tenant-settings',
  'time-groups', 'trunks', 'tts-engines', 'users', 'voice-robots', 'voicemail',
] as const;

/** Инфраструктура — адаптер не нужен. Всё, что не здесь и не в COVERED, роняет тест. */
const INFRA_MODULES = [
  'ai-agents', 'ai-chat', 'ai-platform', 'ami', 'ari', 'auth', 'cloud-admin',
  'config', 'dialplan-bridge', 'health', 'komandor-claims', 'logger', 'mailer',
  'mcp', 'notifications', 'prompts', 'redis', 'roles', 'service-requests',
] as const;

const MODULES_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.resolve(__dirname, '../../skills');

describe('D-16/D-17 AI adapter + skill completeness', () => {
  const dirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name);

  // 1. Новый каталог модуля обязан быть классифицирован — иначе тест красный.
  it('every backend module is classified as covered or infra', () => {
    const unclassified = dirs.filter(
      (d) => !AI_COVERED_DOMAINS.includes(d as any) && !INFRA_MODULES.includes(d as any),
    );
    expect(unclassified).toEqual([]);
  });

  // 2. У каждого покрытого домена есть файл адаптера и скил.
  it.each(AI_COVERED_DOMAINS)('domain %s ships adapter + SKILL.md', (domain) => {
    expect(fs.existsSync(path.join(MODULES_DIR, domain, `${domain}-ai.adapter.ts`))).toBe(true);
    expect(fs.existsSync(path.join(SKILLS_DIR, domain, 'SKILL.md'))).toBe(true);
  });

  // 3. Рантайм-реестр совпадает со списком (ловит забытый register()).
  it('registry domains match AI_COVERED_DOMAINS', async () => {
    const app = await bootstrapTestApp();               // полный AppModule
    const registry = app.get(AiAdapterRegistryService);
    expect(registry.getDomains().sort()).toEqual([...AI_COVERED_DOMAINS].sort());
    await app.close();
  });
});
```

Утверждение №1 — то, что делает тест «падающим для нового модуля»: разработчик создаёт `modules/foo/`, тест краснеет, и обойти это можно только сознательно добавив `foo` в один из двух списков.

**Требуемая правка контракта:** метод `getDomains()` в реестре **отсутствует**. Публичные методы сегодня — `register`, `getAllTools`, `getStateProviders`, `getKnowledgeBlocks`, `getToolByName` [VERIFIED: ai-adapter-registry.service.ts:19-42]. Добавить:

```typescript
  getDomains(): string[] {
    return Array.from(this.adapters.keys());
  }
```

Утверждение №3 требует поднимать полный `AppModule` (адаптеры регистрируются в своих `onModuleInit`), что тяжело. Альтернатива подешевле, если bootstrap окажется проблемным: статический тест, который читает исходники адаптеров регуляркой `readonly domain = '(...)'` и сверяет с `AI_COVERED_DOMAINS` — прецедент такого чтения исходника в тесте в репо уже есть.

### Q4. Скилы: расположение, загрузка, progressive disclosure

**Каталог:** `packages/backend/src/skills/<domain>/SKILL.md`. Папки **нет** — `Test-Path packages\backend\src\skills` → `False`. Создаётся в этой фазе. Путь взят из `15-AI-SPEC.md` §«Recommended Project Structure» (строки 343-348) — это `[CITED]`, а не факт кода.

**Критично: `nest build` не копирует `.md`.** Сборка — `nest build` [VERIFIED: packages/backend/package.json scripts.build], а `postbuild` копирует **только** proto-файлы voice-robots вручную через `fs.cpSync`. То есть прецедент «не-TS ассеты нужно копировать явно» в репо уже есть, и он решён скриптом, а не `nest-cli.json`. Для скилов — два варианта, план обязан выбрать один:

1. Запись в `nest-cli.json`: `"compilerOptions": { "assets": [{ "include": "skills/**/*.md", "outDir": "dist" }], "watchAssets": true }`.
2. Расширить существующий `postbuild` копированием `src/skills` → `dist/skills`, симметрично proto.

Без этого `AgentSkillRegistryService` найдёт скилы в `start:dev` и не найдёт в `start:prod` — классический «работает у меня» и падение промпта до пустого каталога в проде.

**Разрешение пути в рантайме** — брать паттерн у `KnowledgeBaseService`, который уже перебирает кандидатов:

```typescript
// Source: packages/backend/src/modules/ai-chat/knowledge-base.service.ts:161-169
        const candidates = [
            path.resolve(process.cwd(), '.docs'),
            path.resolve(process.cwd(), '../../.docs'),
            path.resolve(__dirname, '../../../../../.docs'),
        ];

        const docsDir = candidates.find(d => {
            try { return fs.statSync(d).isDirectory(); } catch { return false; }
        });
```

Для скилов достаточно `path.resolve(__dirname, '../../skills')` (из `dist/modules/ai-platform` даёт `dist/skills`, из `src/modules/ai-platform` — `src/skills`) плюс один fallback. Отсутствие каталога — **не** тихий `return ''` как сейчас у `.docs`, а `logger.error` при старте: по D-11 скилы обязаны быть.

**Формат файла (Claude's Discretion).** YAML-парсера в репо нет (`js-yaml`, `yaml`, `gray-matter` — все ABSENT). Рекомендация: frontmatter из **ровно двух** обязательных однострочных полей, разбираемый регуляркой; всё остальное — тело markdown.

```markdown
---
name: routes
description: Правила построения цепочки действий маршрута, порядок паттернов, когда нужен apply_dialplan.
---

# Маршруты

...тело, читается только через read_skill...
```

```typescript
const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
function parseSkill(raw: string, fallbackName: string) {
  const m = FM.exec(raw);
  if (!m) return { name: fallbackName, description: '', body: raw };
  const head = m[1];
  const pick = (k: string) =>
    (new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(head)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  return { name: pick('name') || fallbackName, description: pick('description'), body: m[2] };
}
```

Ограничение формата (одна строка на поле, без вложенности, без списков) — это фича: оно и делает ручной парсер достаточным, и его надо записать в `skills/developer-convention/SKILL.md`.

**Progressive disclosure (D-10).** Каталог собирается в системном промпте, тело — тулом. Точка вставки — `PbxContextBuilderService.buildSystemPrompt()`, где сейчас блок «## ЗНАНИЯ О СИСТЕМЕ` `${this.knowledgeBase.getDigest()}`» [VERIFIED: pbx-context-builder.service.ts:150-151]. По D-27 `getDigest()` уходит; на его место — три источника: (1) `aiAdapterRegistry.getKnowledgeBlocks()` напрямую (сейчас они приклеиваются внутри `getDigest()` [VERIFIED: knowledge-base.service.ts:40-43] — при удалении сервиса эту склейку надо перенести, иначе knowledge-блоки адаптеров пропадут из промпта), (2) каталог скилов, (3) правила поведения.

Два платформенных tool'а — не доменные, регистрируются `AgentSkillRegistryService` (или напрямую в `McpToolsService`), потому что домена у них нет:

| Tool | inputSchema | Возврат |
|------|-------------|---------|
| `list_skills` | `{}` | `[{ name, description }]` — тот же каталог, что в промпте (страховка, если модель промпт «забыла») |
| `read_skill` | `{ name: { type: 'string' } }` | тело markdown, обрезанное до 8000 символов (значение из AI-SPEC §4b) |

Оба — `destructive: false`, `entityType: 'skill'`. `vpbxUserUid` не используется, но подпись обязана его принимать (Pattern 2).

### Q5. Diff → confirm → apply + reload

**Кто сегодня делает write + reload:**

| Сервис | Что делает | Годен для D-20 |
|--------|-----------|----------------|
| `RouteApplyService.applyContext(contextUid, vpbxUserUid, isAdmin)` | политики справочников (`reload:false`) → контекст маршрута (`reload:true`) | **Да — эталон** |
| `DialplanApplyService.applyCategories(filename, categories, { reload })` | AMI `CreateConfig` → `DelCat`/`NewCat`/`Append` батчами по 20 → опциональный `dialplan reload` | Да, но это уровень ниже — вызывать через `RouteApplyService` |
| `DialplanApplyService.deleteCategories(filename, names, { reload })` | только `DelCat` + reload | Для удаления осиротевших категорий |
| legacy tool `apply_dialplan` | inline: `contextModel.findOne` → `getIncludeNames` → `generateContextDialplan` → `applyCategories({reload:true})` | **Нет** — теряет `dir_policy_*`, дублирует `buildContextName` |

Комментарий самого `DialplanApplyService` подтверждает, что это уже консолидированный шов: «Консолидирует батч-логику, ранее продублированную в routes.controller, ai-webhook.controller, mcp-tools.service и dialplan-subroutines.service (D-22)» [VERIFIED: dialplan-apply.service.ts:40-41]. Phase 15 доводит консолидацию до конца, убирая четвёртого дублёра — `apply_dialplan`.

**Поток.** Мутирующий tool **не пишет**, а возвращает proposal; `applyPayload` хранится на сервере и модели не отдаётся (иначе модель сможет его подделать):

```
mutating tool  → AgentDiffProposal { proposalId, entityType, entityLabel,
                   before, after, applyPayload(server-side),
                   includesDialplanReload }
               → INSERT cc_agent_proposals (status: 'pending', expires_at: +24h)
               → SSE event: diff_proposal  (без applyPayload)
               → цикл НЕ продолжает шаг, ждёт человека

UI Apply      → POST /api/ai-chat/proposals/:id/apply   (JwtAuthGuard)
               → SELECT ... WHERE id=? AND vpbx_user_uid=<из JWT> AND status='pending'
               → RBAC-проверка (иначе status='denied' + аудит 'denied')
               → сервис домена: write в БД
               → если includesDialplanReload: RouteApplyService.applyContext(...)
               → UPDATE status='applied', applied_at
               → аудит-строка
UI Reject     → POST .../reject → status='rejected'
```

**Почему один эндпоинт, а не «повторный вызов tool с confirmed:true»:** повторный вызов означает, что аргументы снова приходят от клиента и снова требуют валидации, а `before` мог устареть. Хранимый `applyPayload` + проверка `status='pending'` дают идемпотентность (второй Apply не находит pending и возвращает `already applied`) и защиту от подмены.

**Атомарность — честная граница.** `applyCategories` — не транзакция: если AMI упал посередине батча, часть категорий записана. Метод бросает исключение [VERIFIED: dialplan-apply.service.ts:159-162], но откатить AMI-записи нечем. Правильный порядок — **сначала БД, потом AMI**, и при ошибке AMI не откатывать БД, а вернуть пользователю строку `aiChat.diffApplyError` с причиной и оставить `status='pending'` (UI-SPEC: «Card stays pending; error text + retry Apply»). Так «наполовину применено» становится видимым и повторяемым, а не тихим.

### Q6. JWT-only vpbxUserUid и форма кросс-тенантного теста

**Текущая картина по входам:**

| Вход | Гвард | Источник тенанта |
|------|-------|------------------|
| `POST /api/ai-chat/message` и все `/ai-chat/*` | `JwtAuthGuard` | `req.user.vpbx_user_uid` — **уже только JWT** [VERIFIED: ai-chat.controller.ts:59, 140] |
| `ALL /api/mcp` | `JwtOrServiceTokenGuard` | JWT **или** заголовок под сервис-токеном |
| `/api/ai-tools/*` | `JwtOrServiceTokenGuard` | то же |

Заголовочная ветка, которую убирает D-28:

```typescript
// Source: packages/backend/src/modules/auth/jwt-or-service-token.guard.ts:57-71
        const tenantUidHeader = request.headers['x-vpbx-user-uid'];
        const vpbxUserUid = tenantUidHeader ? parseInt(String(tenantUidHeader), 10) : 0;

        if (!vpbxUserUid || isNaN(vpbxUserUid)) {
            throw new UnauthorizedException('X-Vpbx-User-Uid header is required');
        }

        request.user = {
            sub: 0,
            login: 'service-account',
            name: 'aiPBX Service',
            level: 'admin' as any,
            role: 0,
            vpbx_user_uid: vpbxUserUid,
        };
```

Обратите внимание на `level: 'admin' as any` — сервис-токен получал админский уровень на любого тенанта. Это же ломало D-21. После D-28 `McpController` переводится на `JwtAuthGuard`. Сам `JwtOrServiceTokenGuard` **не удалять слепо** — надо проверить остальных потребителей (`ServiceTokenGuard` — отдельный файл, тоже с этой ветвью); если у `JwtOrServiceTokenGuard` не остаётся ни одного пользователя, удалять; иначе оставить, но убрать с MCP.

JWT несёт `vpbx_user_uid` в payload и не требует запроса к БД: `validate(payload)` возвращает `authService.validateJwtPayload(payload)`, комментарий — «The payload already contains all fields we need: sub, level, vpbx_user_uid» [VERIFIED: jwt.strategy.ts:26-33].

**Третий вектор, которого нет в D-22, но который надо закрыть: модель в аргументах.** Контракт запрещает замыкание, но ничто не мешает модели прислать `{"vpbxUserUid": 999, ...}` — хендлер получит его внутри `args` и, если сервис домена читает поле из dto, использует. Гейт — в `callTool()`, до вызова хендлера:

```typescript
const TENANT_ARG_KEYS = ['vpbxUserUid', 'vpbx_user_uid', 'userUid', 'user_uid', 'tenantId', 'tenant_uid'];

private sanitizeArgs(name: string, args: Record<string, any>, uid: number): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    if (TENANT_ARG_KEYS.includes(k)) {
      this.logger.warn(`Tool "${name}" tenant=${uid}: stripped model-supplied "${k}"`);
      continue;
    }
    clean[k] = v;
  }
  return clean;
}
```

Плюс инвариант в completeness-тесте: ни один `inputSchema` во всём реестре не содержит ключей из `TENANT_ARG_KEYS`.

**Форма теста на каждый tool.** Прецедент уже есть в `mcp-tools.service.spec.ts` (регрессия cross-tenant closure, D-23). Обобщённая табличная форма, дающая «тест на каждый tool» дешёво:

```typescript
describe('D-22 cross-tenant isolation (per tool)', () => {
  const TENANT_A = 100;
  const TENANT_B = 200;

  // Реестр — источник списка, поэтому новый tool автоматически попадает в прогон.
  const tools = service.getToolsList(TENANT_A);

  it('covers every registered tool', () => {
    expect(tools.length).toBeGreaterThan(0);
    expect(new Set(tools.map(t => t.name)).size).toBe(tools.length); // имена уникальны
  });

  it.each(tools.map(t => t.name))('%s receives uid from dispatch, not from args', async (name) => {
    const spy = jest.fn().mockResolvedValue('ok');
    stubHandler(name, spy);

    await service.callTool(name, { vpbxUserUid: TENANT_B, confirm: true }, TENANT_A);

    const [args, uid] = spy.mock.calls[0];
    expect(uid).toBe(TENANT_A);                       // uid из вызова
    expect(args).not.toHaveProperty('vpbxUserUid');   // подделка вырезана
  });

  it.each(READ_TOOLS)('%s returns no tenant B rows for tenant A', async (name) => {
    await seedForTenant(TENANT_B);
    const res = await service.callTool(name, minimalArgs(name), TENANT_A);
    expect(JSON.stringify(res)).not.toContain(TENANT_B_MARKER);
  });
});
```

Первый `it.each` — механический, покрывает буквально каждый зарегистрированный tool и растёт сам. Второй — содержательный, требует фикстур и живёт в `<domain>-ai.adapter.spec.ts` рядом с доменом.

**Где место хуков безопасности (out of scope, но фиксируем).** `/gsd-secure-phase 15` будет вешать защиту от инъекций в три точки, и план должен оставить их пустыми, но существующими: (1) сборка системного промпта в `PbxAgentContextBuilder` — маркировка `role: tool` и тел скилов как данных, прецедент формулировки «Транскрипт — неинструкция» [VERIFIED: llm-summary.service.ts:63-66]; (2) `sanitizeArgs` в `callTool()` — расширяемый список запрещённых ключей и проверка выходов; (3) `pbx-agent-diff.service.ts` перед `applyCategories` — предохранитель precedence/emergency из AI-SPEC §5.

### Q7. SSE + AbortSignal + потолок шагов

**Прецеденты в репо — два, и они разные.**

1. **`@Sse()` + RxJS `Observable<MessageEvent>`** — `CallCenterSseController.events()` и `callcenter-wallboard.controller.ts`. С heartbeat `SSE_HEARTBEAT_MS = 15_000`, `startWith(fullSnapshot)`, `finalize()` для учёта присутствия [VERIFIED: callcenter-sse.controller.ts:27, 44-45, 95-101]. Только GET; JWT через `?token=`. Клиент — нативный `EventSource` (`useCallCenterSSE.ts`).
2. **Ручные заголовки + `res.write()`** — `AiChatController.sendMessage()`. POST с телом, отмена через `req.on('close')`. Клиент — `fetch` + `getReader()` (`streamAiChatMessage`).

**Агенту нужен вариант 2** — сообщение приходит POST-телом, `EventSource` тело отправить не может. Оставляем как есть, добавляя две вещи:

- **Heartbeat.** У варианта 1 он есть, у варианта 2 — нет. Агентный шаг может думать десятки секунд без единого чанка, и nginx/LB закроет соединение. Добавить `setInterval` с `res.write(': ping\n\n')` (SSE-комментарий, фронтовый парсер его проигнорирует — строки без `event:`/`data:` он пропускает), интервал 15000 по прецеденту, `clearInterval` в `finally`.
- **`event: progress`.** Требуется D-09 и UI-SPEC («Выполняю шаг {{current}} из {{max}}…»). Формат `{ step, maxSteps }`, эмитится перед каждым обращением к LLM.

**Отмена.** `AbortController` создаётся в контроллере и вешается на `req.on('close')` — этот код уже правильный. Что нужно добавить: **проброс `signal` внутрь `fetch` к провайдеру**. `streamFromAiPbx` это делает (`signal: signal as any` [VERIFIED: ai-chat.service.ts:94]), и новый `PbxAgentLlmClient` обязан делать то же. Иначе «Стоп» закроет SSE, а токены продолжат гореть — это именно тот common mistake, который называет AI-SPEC §4b. Проверять `signal.aborted` в трёх местах: (а) в начале каждого шага цикла, (б) между tool-вызовами внутри шага, (в) в цикле чтения чанков от провайдера (прецедент: `if (signal?.aborted) return;` перед `reader.read()` [VERIFIED: ai-chat.service.ts:113]).

`axios` тоже принимает `signal`, но для стрима удобнее глобальный `fetch` — им уже пользуется `streamFromAiPbx`. Для нестримового вызова (суммаризация треда) — `axios` как в `llm-summary`.

**Потолок шагов (Claude's Discretion).** AI-SPEC предлагает `CC_AI_MAX_AGENT_STEPS=12` [CITED: 15-AI-SPEC.md:172]. Рекомендация research: **12** как дефолт через `ConfigService.get('CC_AI_MAX_AGENT_STEPS', 12)`. Обоснование: типовой сценарий D-15 «создать маршрут» — `list_contexts` → `get_pbx_state` → `read_skill(routes)` → `create_route` → `dialplan_dry_run` → proposal — это 6 шагов; удвоенный запас покрывает диагностические цепочки (D-12: логи + каналы + CDR + настройки = 4 чтения перед выводом). Исчерпание → `event: error` с `max_steps_exceeded` и i18n-строкой «Достигнут лимит шагов…» из UI-SPEC. **Важно:** каждое обращение к LLM — один шаг, а не каждый tool-вызов: модель может вернуть несколько `tool_calls` за раз, и все они исполняются внутри одного шага.

### Q8. Схема тредов и что с текущей историей

**Текущее состояние.** Персиста нет. История живёт в `aiChatSlice` и собирается на каждой отправке из Redux-стора:

```typescript
// Source: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx:63-73
        // Build history from existing messages
        const history = messages
            .filter(m => !m.isStreaming)
            .map(m => ({ role: m.role as string, content: m.content }));

        dispatch(aiChatActions.addUserMessage(text));
        dispatch(aiChatActions.startAssistantMessage());

        abortRef.current = streamAiChatMessage({
            message: text,
            history,
```

Бэкенд принимает её как есть, валидируя только форму: `ChatMessageDto` с `@IsIn(['user','assistant','system'])` и `@IsString() content` [VERIFIED: ai-chat.controller.ts:24-30]. Никакого пересечения с БД — миграции данных нет, конфликтовать не с чем. `cc_ai_threads` в коде отсутствует (grep по `packages` — ни одного вхождения).

Существующие `cc_ai_*` таблицы: `cc_ai_providers`, `cc_ai_audit_log`, `cc_ai_cdr`, `cc_ai_agents`, `cc_ai_toolsets`, `cc_ai_billing`, `cc_ai_invoices` — все зарегистрированы в `app.module.ts:164`, все относятся к **голосовым** AI-агентам (звонки), не к чату.

**Именование.** `cc_ai_*` — префикс контакт-центра/голосовых агентов. Чат-треды к ним не относятся, а `ai_chat_settings` (без префикса) — относится [VERIFIED: ai-chat-settings.model.ts:9]. Рекомендация: **`ai_agent_threads` / `ai_agent_thread_messages` / `ai_agent_proposals`**, в компанию к `ai_chat_settings`. AI-SPEC называет их `cc_ai_threads` [CITED: 15-AI-SPEC.md:445] — это не факт кода, план вправе выбрать; главное — согласовать один раз.

**Предлагаемая схема (Claude's Discretion):**

```
ai_agent_threads
  uid            INTEGER PK AI
  vpbx_user_uid  INTEGER NOT NULL         -- тенант (из JWT)
  user_uid       INTEGER NOT NULL         -- автор (req.user.sub) — тред приватен автору
  title          VARCHAR(255) NOT NULL DEFAULT ''   -- авто из 1-го user-сообщения
  status         VARCHAR(16) NOT NULL DEFAULT 'active'  -- active | archived
  provider_uid   INTEGER NULL             -- какой CcAiProvider использовался
  tokens_in      INTEGER NOT NULL DEFAULT 0   -- D-08, накопительно
  tokens_out     INTEGER NOT NULL DEFAULT 0
  last_message_at DATETIME NULL           -- сортировка newest-first без JOIN
  created_at     DATETIME NOT NULL
  updated_at     DATETIME NOT NULL
  INDEX idx_ai_agent_threads_scope (vpbx_user_uid, user_uid, last_message_at)

ai_agent_thread_messages
  uid            BIGINT PK AI
  thread_uid     INTEGER NOT NULL
  vpbx_user_uid  INTEGER NOT NULL         -- денормализация: WHERE по тенанту без JOIN
  role           VARCHAR(16) NOT NULL     -- user | assistant | tool | system
  content        TEXT NULL
  tool_name      VARCHAR(128) NULL        -- для role='tool'
  tool_calls     JSON NULL                -- для role='assistant' с вызовами
  proposal_id    CHAR(36) NULL            -- FK-ссылка на диффкарточку
  tokens_in      INTEGER NOT NULL DEFAULT 0
  tokens_out     INTEGER NOT NULL DEFAULT 0
  created_at     DATETIME NOT NULL
  INDEX idx_ai_agent_thread_messages_thread (thread_uid, uid)

ai_agent_proposals
  proposal_id    CHAR(36) PK              -- crypto.randomUUID()
  thread_uid     INTEGER NOT NULL
  vpbx_user_uid  INTEGER NOT NULL
  user_uid       INTEGER NOT NULL
  entity_type    VARCHAR(64) NOT NULL
  entity_label   VARCHAR(255) NOT NULL
  summary        JSON NOT NULL            -- bullets для карточки (человеческий язык)
  before_json    JSON NULL
  after_json     JSON NULL
  apply_payload  JSON NOT NULL            -- НИКОГДА не отдаётся модели и клиенту
  includes_dialplan_reload TINYINT NOT NULL DEFAULT 0
  status         VARCHAR(16) NOT NULL DEFAULT 'pending'  -- pending|applied|rejected|denied|expired
  error          TEXT NULL
  expires_at     DATETIME NOT NULL        -- +24h (AI-SPEC §4b)
  applied_at     DATETIME NULL
  created_at     DATETIME NOT NULL
  INDEX idx_ai_agent_proposals_scope (vpbx_user_uid, status, expires_at)
```

Статусы (Claude's Discretion) выбраны так, чтобы совпасть с бейджами из UI-SPEC: `Нужно подтверждение` / `Применено` / `Отклонено` / `Недостаточно прав` → `pending` / `applied` / `rejected` / `denied`, плюс `expired` для TTL-джоба.

`vpbx_user_uid` продублирован во всех трёх таблицах намеренно: любой запрос агента фильтруется по тенанту первым условием, без JOIN — это и быстрее, и делает кросс-тенантный тест однозначным.

**Приватность треда.** `user_uid` в scope-индексе означает «тред видит только автор». Это осознанное решение по D-26 («по тенанту **и пользователю**»). Если понадобится «админ тенанта видит треды сотрудников» — это отдельный запрос без `user_uid` в WHERE, добавляемый позже без миграции.

**Миграция** — `packages/backend/src/modules/ai-chat/migrate-agent-threads.ts` по Pattern 6, плюс скрипт `"db:setup:agent-threads"` в `packages/backend/package.json` по образцу существующего `"db:setup:directories": "ts-node -r tsconfig-paths/register src/modules/directories/setup-directories-schema.ts"`.

**Внимание на `db:migrate`.** Скрипты `db:migrate`, `db:migrate:list`, `db:migrate:rollback` указывают на `node migrations/run-migrations.js` — **этого файла не существует** (`Test-Path` → `False`). В `packages/backend/migrations/` лежат только `README.md`, `mysql/005-phase5-phonebooks-bindings.sql` и `postgres/005-phase5-phonebooks-bindings.sql`. То есть корневой `npm run db:migrate` сегодня падает. README честно описывает реальную модель: «Автоматический раннер в репозитории использует TypeScript-скрипты; эти файлы — для прямого выполнения в клиенте БД» [VERIFIED: packages/backend/migrations/README.md:3]. Вывод для плана: **не пытаться вписаться в `db:migrate`** — писать ts-node скрипт (единственная работающая конвенция, 44 таких файла в репо) и по желанию продублировать SQL в `migrations/{mysql,postgres}/015-phase15-agent-threads.sql` для ручного прогона.

**Фронтенд.** `aiChatSlice` понижается до кэша: hydrate из `GET /api/ai-chat/threads/:uid/messages` при открытии панели, оптимистичный append во время стрима. Иконка Trash в хедере сейчас делает `clearMessages()` локально [VERIFIED: AiChatWidget.tsx:164] — по UI-SPEC Surface C это становится удалением треда с `Dialog`-подтверждением, а не «забыть локально».

### Q9. Инвентаризация 18 legacy reg*() и целевые адаптеры

Список утверждений — из `registerAll()`:

```typescript
// Source: packages/backend/src/modules/mcp/mcp-tools.service.ts:75-93
        this.regGetPbxState();
        this.regCreateEndpointsBulk();
        this.regCreateEndpoint();
        this.regDeleteEndpoint();
        this.regCreateTrunk();
        this.regDeleteTrunk();
        this.regCreateIvr();
        this.regUpdateIvr();
        this.regDeleteIvr();
        this.regCreateQueue();
        this.regUpdateQueue();
        this.regDeleteQueue();
        this.regCreateRoute();
        this.regDeleteRoute();
        this.regApplyDialplan();
        this.regListContexts();
        this.regGetCdrSummary();
        this.regFindCdrCalls();
```

Ровно 18. Backend `ARCHITECTURE.md` в разделе «MCP Server (AI Tool Protocol)» утверждает 16 — документ устарел, правится в этой фазе (см. Runtime State Inventory).

| # | Tool | `entityType` | destr. | Что делает (из кода) | Целевой адаптер | Примечание к миграции |
|---|------|--------------|--------|----------------------|-----------------|------------------------|
| 1 | `get_pbx_state` | `pbx` | — | `Promise.all` по `endpoints/trunks/ivrs/queues/contexts.findAll(uid)`, дамп JSON | **Платформенный**, не доменный | Дублирует `PbxContextBuilderService.buildState()` и `GET /api/ai-tools/state`. Свести к одному источнику; отдавать компактно (Pitfall 6) |
| 2 | `create_endpoints_bulk` | `endpoint` | — | массовое создание абонентов по паттерну | `EndpointsAiAdapter` | Мутирующий → proposal |
| 3 | `create_endpoint` | `endpoint` | — | один абонент; генерирует пароль `generateSipPassword()` (crypto.randomBytes), авто-extension, авто-context | `EndpointsAiAdapter` | `generateSipPassword` — приватный метод сервиса tools; при выносе перенести в `EndpointsService`, а не копировать |
| 4 | `delete_endpoint` | `endpoint` | **да** | `endpointsService.remove(sipId, uid)` | `EndpointsAiAdapter` | proposal |
| 5 | `create_trunk` | `trunk` | — | `trunksService.create(args, uid)` | `TrunksAiAdapter` | proposal |
| 6 | `delete_trunk` | `trunk` | **да** | `trunksService.remove(trunkId, uid)` | `TrunksAiAdapter` | proposal |
| 7 | `create_ivr` | `ivr` | — | `ivrsService.create` | `IvrsAiAdapter` | proposal |
| 8 | `update_ivr` | `ivr` | — | `ivrsService.update(id, rest, uid)` | `IvrsAiAdapter` | **Помечено non-destructive, а меняет маршрутизацию звонков** — по D-18 обязано стать proposal |
| 9 | `delete_ivr` | `ivr` | **да** | `ivrsService.remove(id, uid)` | `IvrsAiAdapter` | proposal |
| 10 | `create_queue` | `queue` | — | `queuesService.create` | `QueuesAiAdapter` | proposal |
| 11 | `update_queue` | `queue` | — | `queuesService.update(name, rest, uid)` | `QueuesAiAdapter` | то же замечание, что #8 |
| 12 | `delete_queue` | `queue` | **да** | `queuesService.remove(name, uid)` | `QueuesAiAdapter` | proposal |
| 13 | `create_route` | `route` | — | `routesService.create({context_uid, pattern, app, appdata, priority, description})` | `RoutesAiAdapter` | **Главный долг:** сырые `app`/`appdata` вместо типизированной цепочки Phase 12 (`IRouteAction` / `DialplanAction`). D-15 требует типизации |
| 14 | `delete_route` | `route` | **да** | `routesService.remove(id, uid)` | `RoutesAiAdapter` | proposal |
| 15 | `apply_dialplan` | `pbx` | — | inline: `contextModel.findOne` → `getIncludeNames` → `generateContextDialplan` → `applyCategories({reload:true})` | `RoutesAiAdapter` | **Переписать на `RouteApplyService.applyContext()`** — сейчас теряет `dir_policy_*`. Плюс станет частью Apply диффа (D-20), а не отдельным вызовом модели |
| 16 | `list_contexts` | `context` | — | `contextsService.findAll(uid)` | `ContextsAiAdapter` | Read-only, простая миграция |
| 17 | `get_cdr_summary` | `cdr` | — | `cdrService.getStats(uid, {dateFrom, dateTo})` | `ReportsAiAdapter` (`reports/cdr`) | Read-only |
| 18 | `find_cdr_calls` | `cdr` | — | `cdrService.findCalls(uid, {...limit: Math.min(limit||20, 50)})` | `ReportsAiAdapter` | Read-only; лимит 50 сохранить |

**Плюс 14 tools, которые уже на адаптерах** (миграции не требуют, но входят в общий реестр — сегодня в `Map` попадает 32):

| Домен | Tools |
|-------|-------|
| `directories` | `list_directories`, `create_directory`, `update_directory`, `delete_directory`, `list_directory_records`, `add_directory_records`, `remove_directory_records` |
| `callcenter` | `cc_get_queue_snapshot`, `cc_get_agents`, `cc_get_today_kpi`, `cc_force_pause_agent`, `cc_force_unpause_agent` |
| `voicemail` | `list_voicemail_messages`, `get_voicemail_message` |

**Чего нет и что D-15/D-12 требуют создать:** `call-groups` и `moh` (названы в D-15 прямо), `time-groups`, `numbers`, `users`, `tenant-settings`/`system-settings` (read-only), `voice-robots`, `tts-engines`/`stt-engines`, `sms`, `telegram`, и отдельно **`diagnostics`** — логи, состояние каналов, `dialplan show` (D-12). Диагностических tools в реестре нет ни одного; `AmiService.command()` для `dialplan show` уже существует (им пользуется `applyCategories` для `dialplan reload`), так что домен строится на готовом шве.

**Порядок hard-migrate.** Read-only домены первыми (`list_contexts`, CDR) — они не требуют diff-механики и дают быструю обратную связь по форме адаптера. Мутирующие — после того, как `pbx-agent-diff.service.ts` готов, иначе придётся мигрировать дважды. `apply_dialplan` — последним, вместе с Apply-эндпоинтом.

### Q10. Потребление dry-run и шаблонов из Phase 14

**Статус зависимости:** Phase 14 — **PLANNED, не выполнена**. `STATE.md`: «Phase 14 (visual-route-builder-and-automation) — PLANNED (2026-09-03). 10 планов, волны 0…6 … Next: `/gsd-execute-phase 14`» [VERIFIED: .planning/STATE.md:22]. Каталогов `modules/dialplan-dry-run/` и `modules/route-templates/` в коде нет.

Что Phase 14 обещает отдать, по её планам:

| Артефакт | Файл-план | Форма | Tools |
|----------|-----------|-------|-------|
| Dry-run | `14-04-PLAN.md` | `DialplanDryRunAiAdapter implements DomainAiAdapter`, «register in OnModuleInit like DirectoriesAiAdapter» [VERIFIED: 14-04-PLAN.md:103] | `dialplan_dry_run` — «taking vpbxUserUid and same body as HTTP» |
| Шаблоны | `14-05-PLAN.md` | `RouteTemplatesAiAdapter` [VERIFIED: 14-05-PLAN.md:92] | `list_templates`, `apply_template`, `build_from_description` |
| Сборка из описания | `14-05-PLAN.md` Task 3 | `RouteTemplatesService.buildFromDescription(vpbxUserUid, description): Promise<{ actions, slots, name }>` — «throwing NotImplemented or returning empty draft — interface stable for Phase 15» [VERIFIED: 14-05-PLAN.md:92] | — |

**Практический вывод для плана Phase 15.** Ничего интегрировать не нужно: адаптеры Phase 14 регистрируются сами и попадают в `getAllTools()` автоматически. Phase 15 **не пишет** код потребления. Что она обязана сделать:

1. **Не полагаться на существование.** Ни один план Phase 15 не должен иметь `files` из `modules/dialplan-dry-run/` или `modules/route-templates/`. Скил `skills/routes/SKILL.md` может упоминать `dialplan_dry_run` как «если инструмент доступен» — модель переживёт отсутствие tool в списке, а вот жёсткая инструкция «всегда вызывай dialplan_dry_run перед предложением» сломает агента, если Phase 14 не выполнена (и это правильно по D-32: «Обязательным перед каждой правкой не делается»).
2. **Реализовать LLM-начинку `buildFromDescription`.** Phase 14 отдаёт стаб, бросающий `NotImplemented`. D-34 Phase 14 прямо перекладывает: «Эта фаза отдаёт агенту сборку как вызываемый сервис; сам агент и подтверждение — Phase 15» [VERIFIED: 14-CONTEXT.md D-34, цитируется в 14-RESEARCH.md:474]. Значит Phase 15 либо (а) реализует наполнение через `PbxAgentLlmClient` + structured output и валидацию цепочки, либо (б) не вызывает его вовсе, а собирает цепочку основным циклом через typed-tools маршрутов. **Рекомендация: (б)** — отдельный LLM-вызов внутри tool'а создаёт вложенный агент без потолка шагов, аудита и отмены, то есть ровно то, от чего уходит D-06.
3. **Добавить оба домена в `AI_COVERED_DOMAINS`** completeness-теста. Тогда, если Phase 14 выполнят без адаптера или без `SKILL.md`, красным станет тест Phase 15 — что и есть механика D-17.
4. **Порядок волн.** Если Phase 14 выполняется раньше, Phase 15 наследует два готовых адаптера; если позже — Phase 15 ничего не теряет. **Двусторонней зависимости нет** — это подтверждает и CONTEXT: «Зависимость односторонняя».

## Runtime State Inventory

Фаза — hard-migrate (D-27/D-28), поэтому раздел обязателен. Канонический вопрос: что останется с прежним состоянием после того, как каждый файл в репо обновлён?

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | 1) `ai_chat_settings.confirm_destructive` — тенантный флаг, смысл которого меняется: D-19 заменяет текстовое подтверждение карточкой. Строки останутся, а гейт станет другим. 2) `action_logs` — там лежит вся историческая AI-аудит-запись с `entity_type='ai_tool'` и `details='mcp:<tool>: …'`; после ввода `cc_ai_audit_log` появится **два** места аудита за разные периоды. 3) `cc_ai_providers` — таблица есть, но строки для aiPBX сейчас нет: провайдер живёт в env. | Решить судьбу `confirm_destructive` явно (оставить как «спрашивать даже для не-деструктивных» / игнорировать / удалить колонку). Аудит: не миграция данных, а запись в docs, где искать записи до Phase 15. Провайдер aiPBX — **вставить строку** (data-миграция, не code) |
| **Live service config** | **aiPBX** — внешний сервис, хранящий у себя настройку ephemeral `mcpServers` с `url: ${publicUrl}/api/mcp`, `Authorization: Bearer <KRASTERISK_SERVICE_TOKEN>`, `X-Vpbx-User-Uid` [VERIFIED: ai-chat.service.ts:60-71]. Конфигурация в aiPBX, **не** в этом репо. D-28 убирает заголовочный путь → интеграция ломается на стороне aiPBX. Плюс `AIPBX_CHAT_ID` указывает на конкретный чат, созданный в aiPBX вручную. | Явная задача плана: перед удалением сервис-токенной ветки скоординировать с aiPBX (или зафиксировать в docs, что интеграция сознательно выключается). Это единственный пункт, который **нельзя** закрыть изнутри репо |
| **OS-registered state** | Ничего — проверено: у фазы нет cron/systemd/Task Scheduler-компонентов; сканеры проекта работают через Nest `@Interval` внутри процесса, новых фаза не вводит (TTL-джоб proposals, если появится, — тоже `@Interval`) | Нет |
| **Secrets / env vars** | Читаются сегодня: `AIPBX_URL`, `AIPBX_CHAT_ID`, `AIPBX_TOKEN` [VERIFIED: ai-chat.service.ts:36-38] — становятся ненужными после D-06; `KRASTERISK_PUBLIC_URL`, `KRASTERISK_SERVICE_TOKEN` [VERIFIED: ai-chat.service.ts:39-40, ai-chat.controller.ts:204-207] — ненужны после D-28; `CC_AI_KEY_SECRET` — **остаётся и становится критичным**: `getKey()` молча падает на dev-ключ `'__krsk_dev_unsafe_key__'`, если переменной нет [VERIFIED: secret-cipher.util.ts:20]. `.env` лежит в корне репо и в git не хранится (`envFilePath: path.resolve(__dirname, '../../../.env')` [VERIFIED: app.module.ts:138]) | Удалить чтение четырёх AIPBX/KRASTERISK-переменных из кода; **не удалять из `.env` инструкции** — вместо этого документировать замену. `CC_AI_KEY_SECRET`: добавить fail-fast при старте в проде, иначе смена/отсутствие ключа делает все `encrypted_api_key` нечитаемыми без внятной ошибки. Новые: `CC_AI_MAX_AGENT_STEPS`, `CC_AI_DEFAULT_PROVIDER_UID` |
| **Build artifacts / installed packages** | 1) `packages/frontend/tsconfig.tsbuildinfo` закоммичен и меняется — шум в диффах, не блокер. 2) `dist/` бэкенда: `nest build` копирует **только** proto (`postbuild`), значит `dist/skills/**` не появится сам. 3) `@modelcontextprotocol/sdk` остаётся в `node_modules` и `package.json`, хотя не используется ни строкой | Обязательно: `nest-cli.json assets` **или** расширение `postbuild` для `src/skills` — иначе прод-сборка теряет скилы. Решить судьбу SDK-зависимости отдельным пунктом |

**Дополнительно к «файлы в репо, которые расходятся с кодом»** (не runtime, но той же природы): `packages/backend/.idea/ARCHITECTURE.md`, раздел «6. MCP Server (AI Tool Protocol)» (строка 156), расходится с кодом в трёх местах одновременно:

| Строка | Что написано | Факт |
|--------|--------------|------|
| 218 | «Текущий инвентарь tools (16 шт)» | 18 legacy + 14 адаптерных = 32 в реестре |
| 183 | «При создании любой новой сущности АТС … добавить соответствующий инструмент(ы) в `McpToolsService`» | D-16 заменяет: адаптер рядом с доменом + `SKILL.md` |
| 190 | Пример подписи `private registerMyNewEntity(server: McpServer, uid: number)` | И `McpServer` из SDK не используется (`McpSessionService` — ручной JSON-RPC), и `uid` в подписи регистрации — ровно тот замыкающийся uid, который запретил D-23 Phase 12 |

То есть документ учит новому коду ровно тому антипаттерну, который фаза устраняет. Все три места правятся в этой фазе; CONTEXT прямо называет этот файл точкой записи конвенции D-16.

## Common Pitfalls

### Pitfall 1: Третий путь диспатча обходит diff-гейт

**What goes wrong:** гейт D-18/D-19 ставят в `McpToolsService.callTool()`, а мутация проходит через `POST /api/ai-tools/call/:toolName` и пишет в БД сразу.
**Why it happens:** `callAdapterTool` берёт tool из реестра и вызывает **хендлер напрямую**: `const result = await tool.handler(args, uid)` [VERIFIED: ai-webhook.controller.ts:292], со своей копией confirmation-гейта (строки 279-288) и своим `buildLogDetails` с префиксом `webhook:` вместо `mcp:`.
**How to avoid:** удалить `ai-webhook.controller.ts` целиком в волне D-27. Если какой-то внешний потребитель на нём висит — перевести на `/api/mcp`.
**Warning signs:** в реестре два `buildLogDetails`; в `action_logs` записи с префиксом `webhook:`.

### Pitfall 2: `confirm=true` от модели считается согласием человека

**What goes wrong:** модель пишет `{"confirm": true}` и деструктивная операция проходит.
**Why it happens:** так работает текущий гейт, и `confirm` даже добавлен в схему, которую видит модель: `const schema = destructive ? { ...inputSchema, confirm: CONFIRM_SCHEMA_PROP } : inputSchema;` [VERIFIED: mcp-tools.service.ts:167], с описанием «передай confirm=true только после явного согласия пользователя» — то есть защита держится на послушании модели.
**How to avoid:** убрать `confirm` из схемы, видимой модели; согласие — только через `POST /proposals/:id/apply` с JWT.
**Warning signs:** `confirm` в `inputSchema` любого tool; `args.confirm` в коде дispatch.

### Pitfall 3: Скилы теряются в прод-сборке

**What goes wrong:** `list_skills` возвращает пустой массив в проде, промпт без каталога, агент не знает конвенций — и падения нет, просто ответы деградируют.
**Why it happens:** `nest build` компилирует TS; `.md` не копируется. Прецедент в репо решён руками — `postbuild` копирует proto с предупреждением «Proto dir not found in src».
**How to avoid:** `nest-cli.json assets` + `watchAssets: true`, и **тест**, читающий каталог через тот же резолвер, что рантайм, с явным `expect(skills.length).toBeGreaterThan(0)`.
**Warning signs:** `list_skills` пуст; в логе старта нет строки о числе загруженных скилов (её надо добавить, как `KnowledgeBase: knowledge base ready (N chars)`).

### Pitfall 4: Удаление KnowledgeBaseService уносит knowledge-блоки адаптеров

**What goes wrong:** после D-27 из промпта исчезают не только `.docs/`, но и KB-блоки доменов.
**Why it happens:** блоки адаптеров приклеиваются **внутри** удаляемого сервиса: `const adapterBlocks = this.aiAdapterRegistry.getKnowledgeBlocks(); return adapterBlocks.length ? ... : this.digest;` [VERIFIED: knowledge-base.service.ts:40-43], а `buildSystemPrompt` зовёт только `this.knowledgeBase.getDigest()`.
**How to avoid:** перенести вызов `getKnowledgeBlocks()` в `PbxAgentContextBuilder` **до** удаления сервиса, отдельным коммитом.
**Warning signs:** блок «Справочники (Directories) — модель данных» пропал из промпта.

### Pitfall 5: Порядок регистрации адаптеров и ленивый реестр

**What goes wrong:** адаптер зарегистрировался после первого `getToolsList()` — его tools не видны до перезапуска.
**Why it happens:** `if (this.toolRegistry.size === 0) this.registerAll();`. Тот же класс проблем уже кусал `KnowledgeBaseService`, где пришлось писать в комментарии: «вычисляется на каждый вызов, а не кэшируется в loadDocs(), т.к. адаптеры регистрируются в своём onModuleInit и порядок … не гарантирован» [VERIFIED: knowledge-base.service.ts:36-38].
**How to avoid:** `OnApplicationBootstrap` для `registerAll()`; логировать имена доменов и итоговое число tools.
**Warning signs:** в логе «Registered N MCP tools» с N меньше ожидаемого.

### Pitfall 6: `get_pbx_state` раздувает контекст

**What goes wrong:** один вызов возвращает полные списки всех абонентов/транков/IVR/очередей/контекстов — `JSON.stringify(..., null, 2)` с отступами. На тенанте с 500 абонентами это десятки тысяч токенов в `messages[]`, и потолок шагов исчерпывается на контексте, а не на работе.
**Why it happens:** tool отдаёт `findAll()` без ограничений [VERIFIED: mcp-tools.service.ts:186-193]. Контраст: `buildState()` для промпта сознательно режет — `endpoints.slice(0, 30)` [VERIFIED: pbx-context-builder.service.ts:60].
**How to avoid:** обрезать результат tool до 4000 символов (AI-SPEC §4b), убрать `null, 2` из `stringify`, отдавать счётчики + первые N, полные списки — отдельными пагинированными tools.
**Warning signs:** `max_steps_exceeded` на простых запросах; `tokens_in` в тысячах на первом шаге.

### Pitfall 7: `AbortSignal` не доходит до провайдера

**What goes wrong:** «Стоп» закрывает SSE, а запрос к LLM продолжает выполняться и тарифицироваться.
**Why it happens:** контроллер создаёт `AbortController`, но проброс до `fetch` — ответственность нового клиента; в трёхуровневой цепочке контроллер → цикл → клиент легко потерять параметр.
**How to avoid:** `signal` обязателен в подписи `PbxAgentLlmClient.chat()`; тест с `AbortController`, проверяющий, что после `abort()` не было ни нового обращения к провайдеру, ни `callTool`.
**Warning signs:** `tokens_out` растёт после отмены; в аудите строки с временем после закрытия SSE.

### Pitfall 8: Расход токенов чата в `cc_ai_cdr`

**What goes wrong:** попытка положить usage чата в существующую таблицу упирается в NOT NULL поля и ENUM без подходящего значения.
**Why it happens:** `cc_ai_cdr` спроектирована под **голосовые** сессии: `call_uniqueid STRING(64) allowNull: false`, `agent_uid INTEGER allowNull: false`, и

```typescript
// Source: packages/backend/src/modules/ai-agents/models/ai-cdr.model.ts:25-26
  @Column({ type: DataType.ENUM('realtime', 'cascade'), allowNull: false })
  declare pipeline_mode: 'realtime' | 'cascade';
```

Ни `realtime`, ни `cascade` к чату не относятся, `call_uniqueid` придётся выдумывать. AI-SPEC §4b допускает «store in `cc_ai_cdr` or extend thread metadata» — второй вариант единственный работающий без ALTER ENUM.
**How to avoid:** `tokens_in`/`tokens_out` на `ai_agent_threads` и `ai_agent_thread_messages`; стоимость считать на чтении через `CcAiProvider.pricing`.
**Warning signs:** миграция с `ALTER TABLE cc_ai_cdr MODIFY pipeline_mode ENUM(...)`; фиктивные `call_uniqueid` вида `chat:*`.

### Pitfall 9: `agent_uid` в аудите как ссылка на тред

**What goes wrong:** аудит-строки нельзя связать ни с тредом, ни с агентом — поле означает разное в разных строках.
**Why it happens:** `cc_ai_audit_log.agent_uid` — это `CcAiAgent.uid` (голосовой агент). Пример в AI-SPEC ставит туда `threadUid` [CITED: 15-AI-SPEC.md:272: `agent_uid: threadUid,`]. Свободное поле для ссылки на тред в таблице есть — `call_uniqueid STRING(64) allowNull: true`.
**How to avoid:** решить в плане: либо `call_uniqueid = 'thread:<uid>'`, либо добавить колонку `thread_uid` миграцией. Не оставлять на усмотрение исполнителя.
**Warning signs:** JOIN аудита с тредами по `agent_uid` возвращает мусор.

### Pitfall 10: Прецедентная инверсия в предложенных маршрутах

**What goes wrong:** агент добавляет `_X.` выше конкретного DID/экстренного паттерна; в описании всё верно, живой звонок уходит не туда.
**Why it happens:** порядок правил в диалплане определяет исход, а `applyCategories` пишет строки **в том порядке, в каком их дал генератор** — `lines.forEach` с `padStart(6,'0')` индексами внутри батча [VERIFIED: dialplan-apply.service.ts:131-134]. Модель порядок не «чувствует».
**How to avoid:** предохранитель в `pbx-agent-diff.service.ts`: перед Apply прогнать сгенерированный набор паттернов и запретить, чтобы catch-all (`_.`, `_X.`) оказался выше конкретного; фикстуры precedence-регрессии в eval-наборе (AI-SPEC §5, dimension «Emergency / carrier-sensitive routing»).
**Warning signs:** дифф меняет `priority`/порядок, а summary об этом не говорит.

### Pitfall 11: Эмодзи из legacy-tools в UI

**What goes wrong:** ответы содержат `✅ Абонент 201 создан.`, `⚠️ Требуется подтверждение`, `❌ Ошибка:` — прямое нарушение MUST «No emoji icons» из frontend ARCHITECTURE.
**Why it happens:** так написаны 18 legacy-tools и текст гейта [VERIFIED: mcp-tools.service.ts:130, 143, 261].
**How to avoid:** при hard-migrate новые адаптеры возвращают структурированные объекты без эмодзи; статус рисует UI (`Badge` + Lucide). UI-SPEC делает исключение только для markdown-контента **модели**, не для строк нашего кода.
**Warning signs:** grep по эмодзи в `*-ai.adapter.ts`.

### Pitfall 12: Тред без scope по тенанту в WHERE

**What goes wrong:** `GET /threads/:uid/messages` по чужому `uid` отдаёт чужой разговор — с полным дампом настроек АТС внутри.
**Why it happens:** соблазн `findByPk(threadUid)` вместо `findOne({ where: { uid, vpbx_user_uid, user_uid } })`. Прецедент правильной формы в репо есть: `contextModel.findOne({ where: { uid: contextUid, user_uid: vpbxUserUid } })` [VERIFIED: route-apply.service.ts:38].
**How to avoid:** ни одного `findByPk` в thread/proposal сервисах; тест «тенант A читает тред B → 404».
**Warning signs:** `findByPk` в `pbx-agent-thread.service.ts`.

## Code Examples

### Обёртка реестра в OpenAI `tools[]`

```typescript
// Трансформация плоского inputSchema (getToolsList) в OpenAI function-calling.
// Источник формы: mcp-tools.service.ts:110-114 — { type: 'object', properties: def.inputSchema }
private toOpenAiTools(vpbxUserUid: number) {
  return this.mcpTools.getToolsList(vpbxUserUid).map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,   // уже { type:'object', properties:{...} }
    },
  }));
}
```

### Клиент провайдера: auth и endpoint — как в llm-summary

```typescript
// Source (паттерн): packages/backend/src/modules/voicemail/llm-summary.service.ts:92-102
    const url = resolveChatCompletionsUrl(provider.endpoint);
    if (!url) return '';

    const key = decryptSecret(provider.encrypted_api_key ?? '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.auth_type === 'bearer' && key) headers.Authorization = `Bearer ${key}`;
    else if (provider.auth_type === 'api_key_header' && key) headers['X-API-Key'] = key;

    const model = String(provider.defaults?.model ?? 'gpt-4o-mini');
    const temperature = Number(provider.defaults?.temperature ?? 0.2);
```

`auth_type` — не свободная строка, а ENUM модели: `DataType.ENUM('bearer', 'api_key_header', 'none', 'custom')` с `defaultValue: 'bearer'` [VERIFIED: ai-provider.model.ts:27-32]. `kind` — `DataType.ENUM('online', 'local', 'custom')` [VERIFIED: ai-provider.model.ts:19]. Оба значения нужны при вставке строки провайдера aiPBX.

### Чтение стрима от провайдера на бэкенде

```typescript
// Тот же приём, что уже используется для проксирования aiPBX
// (ai-chat.service.ts:110-117), но с разбором OpenAI-чанков.
const response = await fetch(url, {
  method: 'POST',
  headers: { ...headers, Accept: 'text/event-stream' },
  body: JSON.stringify({ model, temperature, max_tokens: 4096, stream: true, tools, messages }),
  signal,                       // Pitfall 7 — обязателен
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buf = '';
while (true) {
  if (signal?.aborted) return;
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  const lines = buf.split('\n');
  buf = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const raw = line.slice(6).trim();
    if (raw === '[DONE]') return;
    const delta = JSON.parse(raw)?.choices?.[0]?.delta;
    if (delta?.content) onToken(delta.content);
    if (delta?.tool_calls) accumulateToolCalls(delta.tool_calls);
  }
}
```

`tool_calls` в стриме приходят инкрементально по `index`, с `function.arguments` частями — аккумулятор обязателен, иначе `JSON.parse` аргументов упадёт на первом чанке.

### SSE-хелпер и heartbeat

```typescript
// Формат — тот, что уже парсит фронт (aiChatApi.ts:88-98)
function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// В контроллере, рядом с существующим req.on('close')
const HEARTBEAT_MS = 15_000;                       // прецедент: callcenter-sse.controller.ts:27
const hb = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
try {
  for await (const chunk of stream) {
    if (abortController.signal.aborted) break;
    res.write(chunk);
  }
} finally {
  clearInterval(hb);
  res.end();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Внешний aiPBX как мозг (`streamFromAiPbx` + ephemeral `mcpServers`) | Свой цикл в Nest, aiPBX — строка в `cc_ai_providers` | Phase 15 (D-06) | Многошаговость, скилы, подтверждения и аудит переходят под наш контроль; ломается конфигурация на стороне aiPBX |
| Тенант через заголовок `X-Vpbx-User-Uid` под сервис-токеном (+ `level: 'admin'`) | Только JWT вызывающего | Phase 15 (D-28) | Подмена тенанта становится невозможной; сервис-аккаунт теряет админский уровень на чужого тенанта |
| Рукописные `reg*()` в одном 503-строчном сервисе | `DomainAiAdapter` рядом с доменом | Phase 5 ввёл контракт, Phase 15 завершает (D-27) | Реестр перестаёт быть узким местом; конвенция D-16 делается проверяемой |
| Знания из gitignore-папки `.docs/` | Скилы-файлы в репо + progressive disclosure | Phase 15 (D-10/D-11) | Знания версионируются вместе с tools; промпт не растёт линейно с числом модулей |
| Аудит только в `action_logs` (`entity_type='ai_tool'`) | `cc_ai_audit_log` со статусами `ok`/`error`/`rate_limited`/`denied` | Phase 15 | Появляется структурированная основа для админского учёта (D-08) и офлайн-метрик |
| История чата в Redux, умирает при F5 | Треды в БД | Phase 15 (D-26) | «Вернуться и посмотреть, что агент наделал» становится возможным; появляется форензика |
| `create_route` на сырых `app`/`appdata` | Типизированная цепочка `DialplanAction` (Phase 12) | Phase 12 ввела, Phase 15 переводит tools | Агент перестаёт генерировать строки диалплана и работает в модели, где 23 типа действий проверяются |
| Согласие текстом «да» / `confirm=true` | Карточка диффа с `proposalId` | Phase 15 (D-18/D-19) | Согласие перестаёт зависеть от послушания модели |

**Deprecated/outdated:**
- `AiChatService` целиком (`streamFromAiPbx`, `getAvailableModels`) — D-06/D-07.
- `KnowledgeBaseService` — D-11/D-27.
- `AiWebhookController` (`/api/ai-tools/*`) — третий путь диспатча.
- Сервис-токенная ветка на `/api/mcp` — D-28.
- `@modelcontextprotocol/sdk` — в deps, не используется ни строкой; после D-28 кандидат на удаление.
- Раздел «MCP Server (AI Tool Protocol)» в backend `ARCHITECTURE.md` — устарел (16 против 18) и содержит правило, которое D-16 заменяет.
- `uuid@^3.4.0` — не использовать в новом коде, есть `crypto.randomUUID()`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `packages/backend/src/skills/` — верное место для скилов | Q4, структура | Путь взят из `15-AI-SPEC.md` (CITED), каталога не существует. Если планировщик выберет другой (`packages/backend/skills/`, `.skills/`), меняется резолвер, `nest-cli.json assets` и completeness-тест. Низкий риск: решение всё равно за планом (Claude's Discretion) |
| A2 | `CC_AI_MAX_AGENT_STEPS = 12` достаточно | Q7 | Слишком мало → обрывы на легитимных диагностических цепочках; слишком много → долгие turns и расход. Мерить `steps-to-completion` p95 после ship (AI-SPEC §6) и корректировать env-переменной без релиза |
| A3 | Имена таблиц `ai_agent_*`, а не `cc_ai_threads` | Q8 | Косметика, но one-way: после создания переименование = миграция данных. Требует решения до первой волны |
| A4 | Ручной парсер frontmatter (два поля, одна строка) достаточен | Q4 | Если скилы захотят вложенные метаданные (allowed-tools, версии) — понадобится YAML-парсер, то есть новая зависимость и повторный legitimacy-гейт |
| A5 | `AI_COVERED_DOMAINS` / `INFRA_MODULES` — правильное разбиение 41 каталога | Q3 | Список составлен по именам каталогов, а не по анализу содержимого каждого. Ошибка в классификации → либо ложно-красный тест, либо модуль без адаптера проскакивает. Планировщик обязан пройти список глазами |
| A6 | Расход токенов — на строках тредов, не в `cc_ai_cdr` | Q8, Pitfall 8 | Если админский экран Phase 15 обязан читать один источник вместе с голосовыми агентами, понадобится view или ALTER ENUM. Уточнить при планировании админской поверхности |
| A7 | Реализовывать `buildFromDescription` через основной цикл, а не отдельным LLM-вызовом внутри tool | Q10 | Если Phase 14 зафиксирует контракт так, что tool обязан вернуть готовую цепочку, придётся делать вложенный вызов — с явным потолком и аудитом |
| A8 | Единственный потребитель `AiChatService` — `AiChatController` | Q2 | Проверено grep'ом по `packages`. Если появится инжект в другой модуль между research и execute, миграция затронет больше файлов |
| A9 | `promptfoo` не вносить в baseline | Stack | Если eval-аудит потребует prompt-регрессию как гейт, пакет придётся ставить — с `checkpoint:human-verify` и legitimacy-гейтом |
| A10 | Приватность треда на уровне автора (`user_uid` в scope) | Q8 | Если ожидание было «админ тенанта видит все треды тенанта», понадобится роль-зависимый scope — читается без миграции, но UI-контракт меняется |

## Open Questions

1. **Кто и когда координирует поломку интеграции aiPBX (D-28)?** — **NOT RESOLVED (внешняя зависимость).**
   - Что известно: aiPBX держит `mcpServers` с `X-Vpbx-User-Uid` у себя; `AIPBX_CHAT_ID` указывает на созданный вручную чат. Конфигурация вне этого репо.
   - Что неясно: нужна ли aiPBX'у продолжающая работать интеграция после Phase 15, или он остаётся только провайдером моделей.
   - Рекомендация: единственный вопрос фазы, который нельзя решить изнутри. План обязан вынести это в `checkpoint:human-verify` **перед** удалением сервис-токенной ветки.

2. **Судьба `ai_chat_settings.confirm_destructive` после D-19.** — **RESOLVED: планировщик решает, research рекомендует.**
   - Рекомендация: оставить колонку и переосмыслить как «спрашивать подтверждение даже для не-деструктивных операций» (карточка диффа теперь показывается **всегда** для мутаций; флаг расширяет её на чтение с побочными эффектами). Так не нужна миграция данных и не теряется тенантная настройка, за которую уже есть UI (`AiChatSettingsCard`). Альтернатива — удалить колонку и карточку — тоже допустима, но требует удаления рабочего UI.

3. **Имена таблиц: `ai_agent_*` или `cc_ai_*`?** — **RESOLVED: план выбирает, research рекомендует `ai_agent_*`.**
   - Основание: `cc_ai_*` — семейство голосовых агентов КЦ; чат-настройки уже живут как `ai_chat_settings` без префикса. Требование: выбрать до первой волны, потому что переименование после ship — миграция данных.

4. **Ссылка аудита на тред: `call_uniqueid` или новая колонка?** — **RESOLVED: план выбирает.**
   - `call_uniqueid VARCHAR(64) NULL` свободен и принимает `'thread:<uid>'` без миграции; новая колонка `thread_uid` чище для JOIN. Research рекомендует **новую колонку** — таблица всё равно правится (первые записи в неё появятся только сейчас), а перегрузка семантики `call_uniqueid` создаст ту же проблему, что `agent_uid`.

5. **Разбиение 41 каталога модулей на covered/infra.** — **RESOLVED: план фиксирует список, research даёт черновик.**
   - Черновик в Q3 (23 covered / 19 infra, `diagnostics` — новый). Планировщик проходит списком и переносит спорные (`cloud-admin`, `notifications`, `service-requests`, `komandor-claims`, `prompts`) в нужную колонку. Тест устроен так, что ошибка в любую сторону видна: неклассифицированный каталог роняет утверждение №1.

6. **Реализовать ли `buildFromDescription`, если Phase 14 не выполнена?** — **RESOLVED.**
   - Нет. Phase 15 не создаёт файлов в `modules/route-templates/`. Домены добавляются в completeness-тест, скил упоминает tools условно. Наполнение стаба — либо после выполнения Phase 14, либо (рекомендуется) вовсе не нужно: цепочку собирает основной цикл через typed-tools маршрутов.

7. **Удалять ли `@modelcontextprotocol/sdk` из зависимостей?** — **RESOLVED: не в этой фазе.**
   - Он не используется ни строкой (`McpSessionService` реализует JSON-RPC руками по документированной причине), но удаление зависимости — отдельный риск сборки, не связанный с целями фазы. Зафиксировать как долг в `ARCHITECTURE.md`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Всё | ✓ | v24.19.0 (требование `>=22.0.0`) | — |
| npm workspaces | Монорепо | ✓ | в составе Node | — |
| MySQL/MariaDB | Треды, proposals, провайдеры | ✓ (предполагается рабочая среда) | `DB_DIALECT` по умолчанию `mysql` [VERIFIED: app.module.ts:141] | `postgres` поддержан тем же `DB_DIALECT`; ручные SQL лежат для обеих СУБД |
| Asterisk + AMI | Apply + `dialplan reload` (D-20) | не проверялось из этой сессии | — | Тесты мокают `DialplanApplyService`; живой Asterisk нужен только для UAT |
| LLM-провайдер (OpenAI-совместимый) | Агентный цикл | требует строки в `cc_ai_providers` | — | Jest-харнесс на фикстурах не требует сети (AI-SPEC §5) |
| `CC_AI_KEY_SECRET` | Расшифровка ключа провайдера | не проверялось (в `.env`, вне git) | — | Молчаливый dev-ключ `'__krsk_dev_unsafe_key__'` — **это и есть проблема**, см. Runtime State Inventory |
| `migrations/run-migrations.js` | `npm run db:migrate` | ✗ **отсутствует** | — | ts-node скрипт по образцу `migrate-voicemail.ts` — единственная работающая конвенция (44 файла) |
| `packages/backend/src/skills/` | Скилы D-11 | ✗ отсутствует | — | Создаётся в этой фазе |
| `gray-matter` / `js-yaml` | Разбор frontmatter | ✗ отсутствуют | — | Ручной парсер двух полей (Q4) |
| `promptfoo` | Опциональная prompt-регрессия | ✗ отсутствует | — | Jest-харнесс покрывает все Code-колонки eval |
| `@krasterisk/harness` | E2E (`npm run harness`) | ✓ (workspace существует) | — | Не обязателен для Phase 15 |

**Missing dependencies with no fallback:**
- Координация с aiPBX по D-28 — внешняя, не решается инструментами (Open Question 1).

**Missing dependencies with fallback:**
- `run-migrations.js` → ts-node миграция.
- YAML-парсер → ручной разбор.
- `promptfoo` → Jest-фикстуры.
- Каталог скилов → создаётся фазой (с обязательной записью в `nest-cli.json assets`).

## Validation Architecture

`workflow.nyquist_validation` в `.planning/config.json` отсутствует → трактуется как включённый. Фактическое содержимое конфига: `{"mode":"interactive","workflow":{"research":true,"plan_check":true,"verifier":true,"_auto_chain_active":false},"parallelization":{"enabled":false},"models":{"execution":"sonnet"},"response_language":"ru"}`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework (backend) | Jest `^29.7.0` |
| Framework (frontend) | Vitest `^4.1.4` |
| Config file | `packages/backend/package.json` (jest-секция) / `packages/frontend/vite*.config.ts` |
| Quick run command | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent\|mcp-tools\|ai\\.adapter\|ai-adapter" --no-coverage` |
| Full suite command | `npm run lint && npm run test:backend && npm run test:frontend` (гейт из `AGENTS.md`) |
| Существующий узкий прогон | `npm run test:ai` = backend `--testPathPattern="modules/ai-agents"` + frontend `vitest run src/features/ai-agents src/pages/AiAgentsPage` — **не покрывает** ни `ai-platform`, ни `ai-chat`, ни `mcp`. Расширить паттерн в этой фазе |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|--------------|
| D-06 | Цикл вызывает LLM и tools в процессе; `streamFromAiPbx` отсутствует | unit | `... --testPathPattern="pbx-agent-loop"` | ❌ Wave 0 |
| D-07 | Тенант не получает список моделей; провайдер только админский | unit | `... --testPathPattern="ai-providers"` | ✅ (`ai-providers.service.spec.ts` — расширить) |
| D-08 | `tokens_in/out` пишутся на тред; стоимость из `pricing` | unit | `... --testPathPattern="pbx-agent-thread"` | ❌ Wave 0 |
| D-09 | Потолок шагов → `max_steps_exceeded`; `abort()` останавливает LLM и tools; `progress` на каждом шаге | unit | `... --testPathPattern="pbx-agent-loop"` | ❌ Wave 0 |
| D-10 | Промпт содержит каталог, но **не** тела скилов | unit | `... --testPathPattern="pbx-agent-context"` | ❌ Wave 0 |
| D-11 | Скилы читаются из `src/skills`; каталог непустой; резолвер работает от `dist` | unit | `... --testPathPattern="agent-skill-registry"` | ❌ Wave 0 |
| D-14 | В промпте нет «Отвечай по-русски»; есть правило языка | unit | `... --testPathPattern="pbx-agent-context"` | ❌ Wave 0 |
| D-16/D-17 | Каждый модуль классифицирован; у covered есть адаптер + SKILL.md; реестр совпадает | unit | `... --testPathPattern="ai-adapter-completeness"` | ❌ Wave 0 |
| D-18/D-19 | Мутирующий tool возвращает proposal и **не** пишет в БД; Apply только по `proposalId` с JWT | unit | `... --testPathPattern="pbx-agent-diff"` | ❌ Wave 0 |
| D-20 | Apply с `includesDialplanReload` зовёт `RouteApplyService`; при ошибке AMI статус остаётся `pending` | unit | `... --testPathPattern="pbx-agent-diff\|route-apply"` | ✅ частично (`route-apply.service.spec.ts`) |
| D-21 | Роль без права записи → `denied` в аудите, мутации нет | unit | `... --testPathPattern="ai\\.adapter"` | ❌ Wave 0 |
| D-22 | Каждый tool: uid из dispatch, подделка в args вырезана; A не видит B | unit | `... --testPathPattern="mcp-tools\|ai\\.adapter"` | ✅ частично (`mcp-tools.service.spec.ts` — cross-tenant closure) |
| D-26 | Тред/сообщения переживают перезагрузку; чужой тред → 404 | unit | `... --testPathPattern="pbx-agent-thread"` | ❌ Wave 0 |
| D-27 | В реестре нет ни одного legacy-tool; `/api/ai-tools/*` отсутствует | unit | `... --testPathPattern="mcp-tools"` | ✅ (файл есть, добавить утверждения) |
| D-28 | `/api/mcp` с сервис-токеном и `X-Vpbx-User-Uid` → 401 | e2e/unit | `... --testPathPattern="mcp\\.controller\|jwt-or-service-token"` | ❌ Wave 0 |
| D-24 | Триггер в топбаре; FAB отсутствует; хоткей toggle'ит панель | unit (vitest) | `npm run test -w @krasterisk/frontend -- src/widgets/ModuleShell src/widgets/AiChatWidget` | ✅ частично (`ModuleShell.test.tsx`) |
| D-25 | Панель 520px; нет `Select` модели; нет inline `style` | unit (vitest) | то же | ❌ Wave 0 |
| D-19 (FE) | Diff-карточка: Apply/Reject, состояния pending/applied/rejected/denied | unit (vitest) | `... src/features/ai-chat` | ❌ Wave 0 |
| D-26 (FE) | Треды: empty/loading/error/populated; удаление с confirm | unit (vitest) | то же | ❌ Wave 0 |
| eval | Fixture-replay сценариев: последовательность tools + proposal + tenant в аудите | unit | `... --testPathPattern="pbx-agent-eval"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** узкий прогон по `--testPathPattern` затронутого файла (< 30 с).
- **Per wave merge:** `npm run test -w @krasterisk/backend -- --testPathPattern="(pbx-agent|mcp-tools|ai\\.adapter|ai-adapter-completeness)"` + `npm run test -w @krasterisk/frontend -- src/features/ai-chat src/widgets/AiChatWidget src/widgets/ModuleShell`.
- **Phase gate:** `npm run lint && npm run test:backend && npm run test:frontend` — зелёные до `/gsd-secure-phase 15`, и повторно до `/gsd-verify-work 15`.

### Wave 0 Gaps

- [ ] `packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts` — D-16/D-17 (+ метод `getDomains()` в реестре)
- [ ] `packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts` — D-10/D-11 (включая резолвер пути от `dist`)
- [ ] `packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts` — D-06/D-09 (fake timers + `AbortController`)
- [ ] `packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts` — D-18…D-21
- [ ] `packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts` — D-26/D-08
- [ ] `packages/backend/src/modules/ai-chat/pbx-agent-eval.harness.ts` + `evals/reference-scenarios.json` — eval-набор (10 к концу execute, 20 к ship)
- [ ] Расширение `mcp-tools.service.spec.ts` — табличный `it.each` по всему реестру (D-22) + утверждение «нет legacy-tools» (D-27)
- [ ] Фронтенд: `DiffConfirmCard.test.tsx`, `ThreadList.test.tsx`, обновление `AiChatWidget` / `ModuleShell` тестов
- [ ] Расширение `test:ai` паттерна на `ai-platform|ai-chat|mcp` в обоих `package.json`
- [ ] Framework install: **не требуется** — Jest и Vitest уже настроены

## Security Domain

`security_enforcement` в `.planning/config.json` отсутствует → трактуется как включённый. **Важно:** hardening и защита от инъекций явно вынесены в `/gsd-secure-phase 15` (D-deferred). Раздел ниже — карта, где хуки, а не готовые меры.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `JwtAuthGuard` / `JwtStrategy` (Passport). **Изменение фазы:** снятие сервис-токенной ветки с `/api/mcp` (D-28) |
| V3 Session Management | yes | JWT в payload несёт `vpbx_user_uid`; SSE-путь через `?token=` уже поддержан `ExtractJwt.fromUrlQueryParameter('token')` — для агента **не нужен** (у нас POST с заголовком), не расширять |
| V4 Access Control | yes | RBAC = вызов тех же сервисов домена, что REST-контроллеры (D-21). Плюс тенантный scope в каждом WHERE. Хук отказа — `status: 'denied'` в `cc_ai_audit_log` (ENUM его уже содержит) |
| V5 Input Validation | yes | `class-validator` + `class-transformer` на tool-args от модели и на `AgentDiffProposal`; прецедент `parseAndValidateSummary`. Глобальный `app.useGlobalPipes(new ValidationPipe({...}))` уже стоит [VERIFIED: packages/backend/src/main.ts:149-150] — он покрывает DTO контроллеров, но **не** аргументы tool от модели: те приходят внутри уже провалидированного тела и требуют отдельной проверки в `callTool()` |
| V6 Cryptography | yes | `secret-cipher.util.ts` — AES-256-GCM + scrypt. **Не переписывать.** Хук: fail-fast на отсутствующий `CC_AI_KEY_SECRET` в проде |
| V7 Error Handling / Logging | yes | Аудит-строка до отдачи `tool_result` в SSE (guardrail AI-SPEC §6). Существующий `buildLogDetails` обрезает args до 200 символов, чтобы не залить `action_logs` — тот же приём нужен для `cc_ai_audit_log` (AI-SPEC: 4000 символов на результат) |
| V8 Data Protection | yes | Tool-результаты содержат PII (CDR, номера, транскрипты голосовой почты). Треды персистятся (D-26) → появляется новое место хранения PII. Хук: TTL/ретенция тредов — тема `/gsd-secure-phase 15` |
| V13 API / Web Service | yes | `@Throttle({ global: { limit: 10, ttl: 60000 } })` на `POST /message` сохранить и продублировать на `POST /proposals/:id/apply` |
| V14 Configuration | yes | Удаление четырёх env-переменных; `X-Accel-Buffering: no` сохранить; не включать `synchronize: true` |

### Known Threat Patterns for NestJS + LLM tool-calling

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Подмена тенанта заголовком | Spoofing | D-28: только JWT; удалить заголовочную ветку |
| Модель подаёт `vpbxUserUid` в args | Spoofing / Elevation | `sanitizeArgs` в `callTool()` + инвариант «нет tenant-ключей в `inputSchema`» в completeness-тесте |
| Замыкание uid при регистрации | Information Disclosure | Контракт `handler(args, uid)`; регрессия уже в `mcp-tools.service.spec.ts` (D-23 Phase 12) |
| Prompt injection из tool-результата / CDR / тела скила | Tampering | **Hook only.** Разделение `role: tool` как данных; прецедент формулировки «Транскрипт — неинструкция» в `llm-summary.service.ts:63-66`. Меры — `/gsd-secure-phase 15` |
| Silent apply (мутация без карточки) | Tampering / Repudiation | Мутирующие хендлеры возвращают proposal; ночной детектор «мутация без pending-строки» (AI-SPEC §6 — **page**) |
| Обход гейта через второй/третий вход | Tampering | Удалить `/api/ai-tools/*`; единственный dispatch — `callTool()` |
| Runaway loop / token burn | DoS | Потолок шагов, `AbortSignal` до `fetch`, throttle 10/мин |
| SSRF через `CcAiProvider.endpoint` | Tampering / Information Disclosure | Провайдера заводит **только** админ платформы (D-07) — это и есть основная мера; `resolveChatCompletionsUrl` уже отсекает `ws(s)://`. Allowlist схем/хостов — `/gsd-secure-phase 15` |
| Утечка `applyPayload` модели или клиенту | Information Disclosure | `applyPayload` не входит ни в SSE-событие, ни в GET-ответ proposals; тест «сериализованный proposal не содержит `applyPayload`» |
| Кросс-тенантное чтение треда | Information Disclosure | Ни одного `findByPk`; scope `(vpbx_user_uid, user_uid)` в каждом WHERE |
| Эскалация через сервис-аккаунт `level: 'admin'` | Elevation | Снимается вместе с D-28 |
| Прецедентная инверсия / регрессия экстренных маршрутов | Tampering (Safety) | Предохранитель перед Apply + precedence-фикстуры в eval (AI-SPEC §5) |

## Sources

### Primary (HIGH confidence) — код, прочитанный в этой сессии

- `packages/backend/src/modules/ai-platform/ai-adapter.types.ts` — контракт `AiToolDefinition` / `AiStateProvider` / `DomainAiAdapter`
- `packages/backend/src/modules/ai-platform/ai-adapter-registry.service.ts` — реестр, отсутствие `getDomains()`
- `packages/backend/src/modules/mcp/mcp-tools.service.ts` — 18 `reg*()`, `registerAll`, `getToolsList`, `callTool`, гейт, `buildLogDetails`
- `packages/backend/src/modules/mcp/mcp-session.service.ts` — JSON-RPC без SDK, `tools/list` / `tools/call`
- `packages/backend/src/modules/mcp/mcp.controller.ts` — `ALL /api/mcp`, `JwtOrServiceTokenGuard`
- `packages/backend/src/modules/auth/jwt-or-service-token.guard.ts` — заголовочный тенант, `level: 'admin'`
- `packages/backend/src/modules/auth/jwt.strategy.ts` — extractors, `vpbx_user_uid` в payload
- `packages/backend/src/modules/ai-chat/ai-chat.controller.ts` — SSE, throttle, hallucination detection, аудит
- `packages/backend/src/modules/ai-chat/ai-chat.service.ts` — `streamFromAiPbx`, ephemeral `mcpServers`, `getAvailableModels`
- `packages/backend/src/modules/ai-chat/ai-webhook.controller.ts` — `/api/ai-tools/*`, третий путь диспатча
- `packages/backend/src/modules/ai-chat/pbx-context-builder.service.ts` — `buildState`, `buildSystemPrompt`, «Отвечай по-русски»
- `packages/backend/src/modules/ai-chat/knowledge-base.service.ts` — `.docs/`, склейка KB-блоков адаптеров
- `packages/backend/src/modules/ai-chat/ai-chat-settings.model.ts` — `ai_chat_settings`
- `packages/backend/src/modules/voicemail/llm-summary.service.ts` — OpenAI-совместимый клиент, `resolveChatCompletionsUrl`, json_schema, валидация
- `packages/backend/src/modules/voicemail/voicemail-ai.adapter.ts` — read-only адаптер, `OnModuleInit`
- `packages/backend/src/modules/voicemail/migrate-voicemail.ts` — эталон standalone миграции
- `packages/backend/src/modules/directories/directories-ai.adapter.ts` — эталонный адаптер (7 tools, KB-блок, state provider)
- `packages/backend/src/modules/ai-agents/models/{ai-provider,ai-audit-log,ai-cdr}.model.ts` — ENUM'ы, поля, тенантный `vpbx_user_uid`
- `packages/backend/src/modules/ai-agents/util/secret-cipher.util.ts` — AES-256-GCM, `CC_AI_KEY_SECRET`
- `packages/backend/src/modules/ami/dialplan-apply.service.ts` — `applyCategories`, батчи, reload
- `packages/backend/src/modules/routes/route-apply.service.ts` — атомарный apply контекста
- `packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts` — форма completeness-теста
- `packages/backend/src/modules/callcenter/callcenter-sse.controller.ts` — `@Sse()` + heartbeat 15 с
- `packages/backend/src/app.module.ts` — `synchronize: false`, список моделей, `envFilePath`
- `packages/backend/migrations/README.md` — конвенция миграций; отсутствие `run-migrations.js`
- `packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx` — топбар, `#shell-cmdk-trigger`, регистрация ⌘K
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx` + `.module.scss` — FAB, панель 420px, `Select` модели
- `packages/frontend/src/shared/api/endpoints/aiChatApi.ts` — SSE-парсер, `AbortController`, имена событий
- `packages/frontend/src/app/layouts/AppLayout.tsx` — монтирование шелла и виджета
- `packages/frontend/src/app/styles/globals.css` — шкала `--z-index-*`
- `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.module.scss` — `position: relative`, мобильный fixed на `z-index-toast`
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx:1154` — единственная точка монтирования софтфона
- `package.json` (корень, backend, frontend) — скрипты, версии, `engines`

### Secondary (MEDIUM confidence) — планировочные документы фазы

- `.planning/phases/15-universal-pbx-ai-agent/15-CONTEXT.md` — D-06…D-28, canonical refs, deferred
- `.planning/phases/15-universal-pbx-ai-agent/15-UI-SPEC.md` — 520px, 240px, `Ctrl/Meta+Shift+J`, копирайт, z-index-контракты, коллизии
- `.planning/phases/15-universal-pbx-ai-agent/15-AI-SPEC.md` — framework lock, guidance, 11 eval-dimensions, 7 guardrails, monitoring
- `.planning/ROADMAP.md` §Phase 15 (строки 941-966)
- `.planning/STATE.md` — статус Phase 14 (PLANNED) и Phase 15 (SPEC READY)
- `.planning/phases/14-visual-route-builder-and-automation/{14-RESEARCH,14-04-PLAN,14-05-PLAN,14-VALIDATION}.md` — контракты dry-run и шаблонов
- `packages/backend/.idea/ARCHITECTURE.md`, `packages/frontend/.idea/ARCHITECTURE.md` — MUST-правила; backend-раздел про MCP устарел
- `.cursor/rules/sketch-findings-krasterisk-v4.mdc`, `AGENTS.md` — проектные директивы

### Tertiary (LOW confidence)

Внешних источников в этой фазе нет: framework залочен `15-AI-SPEC.md`, новых пакетов нет, все ответы получены чтением кода. Web/Context7 не привлекались осознанно — привлечение внешних источников здесь дало бы ответы о LangChain/LangGraph, которые фаза запрещает релитигировать.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — ноль новых пакетов; все версии и отсутствия проверены чтением `package.json` в этой сессии
- Architecture (хосты, точки интеграции, dispatch, apply/reload, SSE, тенантность): **HIGH** — каждый файл открыт, цитаты с номерами строк
- Схемы БД, формат скила, потолок шагов: **MEDIUM** — Claude's Discretion; рекомендации обоснованы прецедентами, но решает план
- Pitfalls: **HIGH** — 10 из 12 выведены из фактического кода, не из общих соображений
- Phase 14 стык: **MEDIUM** — читаны планы, не код (Phase 14 не выполнена)
- Eval / guardrails: **CITED** из `15-AI-SPEC.md` — авторитетный документ фазы, не релитигируется

**Research date:** 2026-09-03
**Valid until:** 2026-10-03 (30 дней — стек стабилен, ничего внешнего). **Раньше, если:** выполнится Phase 14 (появятся два реальных адаптера вместо планов) или изменится `mcp-tools.service.ts` / `ModuleShell.tsx`.
