# Координация AI-продуктов

Протокол: [HYBRID-WORKFLOW](../../HYBRID-WORKFLOW.md). Единственный указатель текущего implementation assignment инициативы; требования и результаты остаются в ROADMAP/PLAN/SUMMARY/VERIFICATION.

| Поле | Значение |
|---|---|
| Updated | 2026-09-18 |
| Mode | `codex-direct` |
| Coordination status | `idle` |
| Active implementation coordinator | Не назначен |
| Active PLAN / revision | Нет активного implementation assignment |
| Active workers / owned paths | Нет назначенных этим реестром writers |
| Planning/handoff task | `01a0b2cf-f755-74d0-8a7d-7e65ee34fc65` |
| Master roadmap | [ROADMAP](ROADMAP.md) |
| Next candidate | [DB-01-PLAN](DB-01-PLAN.md) |
| Independent candidate | [AI-00-PLAN](AI-00-PLAN.md): fixtures/contracts, без присвоения общих DB-файлов |
| Implementation state | `planned`; dual-DB и новые AI-продукты не реализованы этим пакетом |

## Следующее исполнение

1. Прочитать запрос, project AGENTS, HYBRID-WORKFLOW и next candidate. Запрос на исполнение связать с точными задачами PLAN; изменение этих инструкций само по себе не запускает DB-01.
2. Снять свежий branch/HEAD/dirty baseline; проверить соседние задачи в AppModule/database/package lock/ARI/autodial. Исторический baseline в [VALIDATION](VALIDATION.md) не заменяет свежую сверку.
3. Назначить coordinator identity, mode, PLAN+revision, task IDs, owned paths, shared-interface owner и checks. После этого считать assignment active. Продолжение уже разрешённой работы не требует повторного разрешения пользователя.
4. Учесть [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md): PostgreSQL/MySQL обязательны; aiPBX — read-only; SaaS/self-hosted/OpenSource и независимость продуктов сохраняются.

## Выполнено до implementation

Аудит, продуктовые SPEC, roadmap, AI-00/DB-01 plans, dual-DB contract и порядок координации. Independent plan review — PLAN-REVIEW; прежние baseline checks — VALIDATION. Это не закрывает implementation/live gates.

## Активные назначения

При старте координатор заполняет таблицу фактическими заданиями; ownership меняется после сверки с исполнителями. Evidence записывается по факту.

| Assignment | Executor identity | PLAN / task IDs / revision | Owned paths | Status / evidence |
|---|---|---|---|---|

## Handoff

Активная передача implementation управления отсутствует. Для передачи записать sender→receiver, old→new mode, writers, baseline/diff, completed tasks/checks, blockers, next action и подтверждение принимающей стороны. Старый timestamp не разрешает занять scope.
