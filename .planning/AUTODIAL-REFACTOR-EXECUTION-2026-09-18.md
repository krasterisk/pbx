# Автообзвон: назначение исполнения

Статус координации: `backend-tests-passed; external gates partial; isolated SIP CallerID passed; campaign failure-path E2E passed; successful SIP and multi-worker ownership pending`. Режим: `codex-direct`.

## Назначение

| Поле | Значение |
|---|---|
| Coordinator identity / task | `/root`, текущая задача Codex |
| Инициатива и цель | Завершить безопасную реализацию [плана рефакторинга](AUTODIAL-REFACTOR-PLAN-2026-09-18.md), сохраняя пользовательские сценарии и явно фиксируя изменения поведения |
| Канонический PLAN и baseline | `AUTODIAL-REFACTOR-PLAN-2026-09-18.md`, `main` @ `92d342d1` (`Refactoring autodial module`); на момент назначения worktree чистый |
| Task IDs | R0-R6; ранее реализованные части сверяются по [журналу](AUTODIAL-REFACTOR-IMPLEMENTATION-2026-09-18.md), а не считаются автоматически завершёнными |
| Required reads | `AGENTS.md`, CANONICAL_REFS, frontend/backend architecture, HYBRID-WORKFLOW, анализ, план, журнал и релевантный код перед изменением |
| Владелец shared interfaces | Координатор этой инициативы: `packages/shared/src/types/autodial.types.ts`, autodial API DTO и локали при необходимости |
| Owned paths | `packages/backend/src/modules/autodial/**`, `packages/frontend/src/features/autodial/**`, `packages/frontend/src/pages/AutodialBasesPage/**`, указанные shared/API/UI файлы только при нужде задачи |
| Read-only до отдельного назначения | `packages/frontend/src/features/dialplan-apps/**` как источник сравнения; PBX, deploy-конфигурация, migration/data-repair, общие GSD STATE/ROADMAP |
| Запрещённые действия | Реальные исходящие вызовы, запись/перезагрузка PBX, deploy, миграции или data repair без отдельного безопасного test case и явной авторизации |
| Обязательные проверки | Targeted unit/integration по срезу; перед статусом `implemented` всего плана: `npm run lint`, `npm run test:backend`, `npm run test:frontend`, typecheck, DB/PBX/browser evidence по применимости |

## Выполненное и ограничения

Предыдущие R1, частичные R2a и R3 срезы, включая их тестовое evidence и PBX read-only preflight, записаны в журнале. Они имеют статусы `implemented` или `automated-tests-passed` только в объёме журнала. Они не закрывают live/release gates R2-R6.

Текущий владелец не запускает субагентов: пользователь запросил анализ правил оркестрации, но не передал отдельные независимые области записи. При появлении такой необходимости в этом файле будут заранее указаны assignment ID, владелец файлов, зависимости и проверки.

## Текущее действие

Кодовые срезы R2b/R2c, R3, безопасная часть R4 и R5 выполнены в пределах текущих контрактов. Актуальная матрица и точные команды находятся в [AUTODIAL-REFACTOR-ACCEPTANCE-MATRIX-2026-09-18.md](AUTODIAL-REFACTOR-ACCEPTANCE-MATRIX-2026-09-18.md). Пользователь разрешил тестовые номера на PBX; [внешние gates](AUTODIAL-REFACTOR-EXTERNAL-GATES-2026-09-18.md) выполнены в изолированном Local/loopback scope и очищены. Isolated SIP CallerID gate пройден после перехода на ARI `/channels` originate. Новый срез валидирует tenant ownership транков, очередей и внутренних номеров и не считает одного оператора дважды при нескольких очередях. Отдельная versioned DB fixture провела кампанию через ARI failure path до terminal attempt, но успешный campaign-to-SIP capture, voicemail и multi-worker ownership/restart остаются открыты; текущая legacy MySQL отклоняется параллельно внедрённым DB-02 startup guard, владелец DB-02 уведомлён. Узкий restart fallback находит attempt по channel ID и сохранённому времени ответа; это не заменяет shared fencing. При удалении неиспользуемой базы обнаружен и исправлен FK-дефект, integration regression прошёл; удаление кампании с активными задачами теперь запрещено. История `ac_attempts` после удаления кампании остаётся orphan: политику архивирования необходимо спроектировать до исправления.

## Handoff

Не передан. При смене координатора записать baseline/diff, выполненные проверки, pending gates и точное следующее действие до назначения нового writer.
