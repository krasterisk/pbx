# AI-00 Task 1 — матрица совместимости

**Дата:** 2026-09-18. **Источник:** текущий код и канонические документы, без production/PBX/provider операций. **Граница:** это inventory и целевой контракт, не миграция и не утверждение готовности новых AI-продуктов.

| Профиль | Текущее состояние | Решение для дальнейшей реализации | Необходимый срез |
|---|---|---|---|
| Сценарный голосовой робот | Отдельный `voice-robots` модуль и ARI flow; это не AI-конфигурация | Сохраняется самостоятельной сущностью. AI runtime не добавляется как режим сценарного робота | AI-00 Task 2: routing fixture; затем AI-07 |
| Existing AI agent draft | `cc_ai_agents` уже хранит `realtime`/`cascade`, LLM/STT/TTS profiles, VAD, toolset и `user_uid → vpbx_user_uid` | Это единственный исходный inventory будущего AI-робота. До migration/backfill нельзя создавать второй одновременно редактируемый CRUD или включать новый admission | AI-01 inventory, migration design и compatibility adapter |
| PBX assistant / existing AI integrations | Используют существующие AI/provider primitives, но не являются voice session runtime | Общий provider/credential capability contract выделяется с compatibility facade; административный AI-chat не становится media bridge | AI-01/02 |
| Analytics-only | В текущем registry есть исторический paid code `cc_ai_voice`, но нет независимого speech analytics продукта, assets/jobs/ledger или PBX-independent API | Новый `speech_analytics` entitlement, analytics project и external recording API. Никакой обязательной ARI/CDR/Route зависимости | AI-01, AI-02, затем AI-04 |
| Robot-only | Нет standalone product boundary; текущие robots завязаны на PBX flow | Новый `ai_voice_robots` entitlement, SIP connection/deployment/session contracts. Tenant определяется доверенным connection/DID binding, не SIP header | AI-01/02, затем AI-07/08 |
| CLOUD | `tenant_modules` проверяется для конкретного tenant; Hub использует legacy aliases `voice_robot` и `cc_ai_voice` | Добавить два независимых product entitlements с явной legacy mapping policy; server guards и API обязаны проверять новый product code, а не только Hub/menu | AI-01 |
| BOX / OPENSOURCE | `ModulesRegistryService.tenantHasModule` возвращает `true` при `DEPLOYMENT_MODE != CLOUD`; market modules фактически разблокированы | Заменить bypass на deployment-aware signed local-license/resource policy. Community core должен собираться без optional commercial source; отсутствие меню недостаточно | AI-01, DEP-01…05 |
| MySQL / PostgreSQL | DB-01 и часть DB-02 дают dual-engine runtime foundation. `cc_ai_agents` остаётся исторической schema; D2 является отдельной задачей автообзвона | Все новые AI aggregates используют `user_uid` attribute с physical field `vpbx_user_uid`; migrations/query/worker contracts тестируются в обоих engines. Не брать D2 и не менять autodial | AI-01/02, DB-04 release gates |

## Подтверждённые инварианты

1. Tenant нельзя брать из body/query/SIP headers. Модели получают server-derived context; физическая колонка остаётся `vpbx_user_uid`, даже если TypeScript attribute называется `user_uid`.
2. Existing `AiAgentsService` проверяет providers через `user_uid IN (0, tenant)`. Для нового voice runtime это не является готовой политикой: tenant `0` нельзя молча считать глобальным provider owner. AI-01 должен определить явный template/ownership model и повторно проверить capability/enabled status при publish и admission.
3. `cc_ai_agents` умеет хранить cascade/realtime profiles, но не имеет immutable published versions, deployment, external SIP connection, session state, durable usage или media assets. Эти данные не следует записывать в сценарного робота или административный чат.
4. Исторические Hub aliases объединяют `voice_robot` и `cc_ai_voice`; будущие `ai_voice_robots` и `speech_analytics` должны быть раздельны. В BOX/OPENSOURCE текущий unconditional allow нельзя трактовать как реализацию лицензирования.
5. DB-02-D2 и все файлы автообзвона принадлежат отдельной задаче. Их исправления, события и acceptance не входят в AI-00.

## Evidence

- `packages/backend/src/modules/ai-agents/models/ai-agent.model.ts`: modes, provider/toolset IDs and `user_uid` field mapping.
- `packages/backend/src/modules/ai-agents/ai-agents.service.ts`: current tenant filtering and provider access rule.
- `packages/backend/src/modules/cloud-admin/modules-registry.service.ts`: seed codes, legacy aliases and CLOUD-vs-BOX access behavior.
- [ROBOTS-SPEC](ROBOTS-SPEC.md), [ANALYTICS-SPEC](ANALYTICS-SPEC.md), [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md), [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md): target contracts.

## Task 1 result and next boundary

Task 1 has produced the current baseline and compatibility contract. It made no application-code, migration, package, PBX or remote-server change.

The next ordered task in [AI-00-PLAN](AI-00-PLAN.md) is ARI ownership and media transport. Its named implementation surfaces include `ari-connection.service.ts`, `voice-robots.service.ts` and `autodial-originator.service.ts`. The latter is explicitly owned by the separate autodial task, and an ARI file is already dirty in the shared tree. Per the user instruction and [HYBRID-WORKFLOW](../../HYBRID-WORKFLOW.md), AI-00 stops here until a bounded Task 2 plan assigns non-overlapping ownership or the relevant owners provide a handoff.
