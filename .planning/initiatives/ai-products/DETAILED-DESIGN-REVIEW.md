# Проверка детального проектирования AI-01/02

Это отчёт о ревизии r1. Последующее r2-проектирование AI-03/04/07 и его согласования — [PRODUCT-SLICES-CONTRACTS](PRODUCT-SLICES-CONTRACTS.md); число 37 задач в текущем индексе включает 17 добавленных после этого отчёта. Проверки/хэши r1 ниже остаются историческими.

Дата/ревизия: **2026-09-18-r1**. Автор и проверяющий — текущий `/root`; это self-review, не независимое ревью другим агентом. Назначение было planning-only. Канонический вход — [IMPLEMENTATION-SEQUENCE](IMPLEMENTATION-SEQUENCE.md), планы — [AI-01](AI-01-PLAN.md) и [AI-02](AI-02-PLAN.md).

## Устранённые пробелы планирования

| Пробел | Решение / проверка в плане |
|---|---|
| Начальный entitlement helper ошибочно воспринимался как завершённая Wave1 | Статус partial foundation; A1 подключает реальные entrypoints, explicit expiry/tenant checks, закрывает direct purchase/toggle |
| Смешаны выдача лицензии, активация и runtime readiness | A1/A2 разделяют policy, activation store и admission; до готового adapter новый processing закрыт |
| Credential без resource мог стать tenant-wide ключом | B2 explicit scopes/bindings; missing resolver deny, не выдавать upload/invoke до AI-04/07 |
| Retry rotation мог требовать хранить plaintext secret | B2 generation lock, command receipt без secret, отдельная новая rotation при потере ответа |
| Analytics-only не достигался одним profile flag | B4 identity split + C2 compile roots и минимальная schema chain; full baseline immutable |
| Optional module в TypeScript всё ещё мог требовать его исходники | C4 build workspace без commercial source, отдельно от runtime-disable теста |
| Legacy public endpoints оставались бы открыты в standalone | C2/C4 route allowlist и negative HTTP checks; full-pbx требует отдельной compatibility remediation |
| Provider core тянул robot/voicemail зависимости | C1 neutral module+facade, одна provider таблица; A3 exact mode/capability/tenant |
| SQL/Redis/provider вызов ошибочно мог выглядеть как одна transaction | D2 outbox/fence/unknown outcome, no transaction across network; fault cases на каждой границе |
| Job и stage reservations могли считать один reserve дважды | D4 parent quota hold, child allocation и единый settlement; SQL invariant tests |
| ffmpeg в hangup трактовался как доказательство ready | Исправлен recording research; G2 требует recorder close + probe + durable manifest |
| Два default ARI app names не решали dev/prod и ApplicationReplaced | G1 installation namespace, classifier, readiness и drain; один app семейства для всех кампаний |
| Старый запрет autodial противоречил последнему поручению | EXECUTION фиксирует разрешение пользователя; это не автоматическое закрытие DB-02-D2 |

## Проверки документов

- Итоговый Node check: 14 документов, 125 относительных file links, UTF-8, code fences, trailing whitespace, уникальные headings 20 task IDs G1–G3/A1–A3/B1–B4/C1–C4/D1–D6 и соответствие двух PLAN SHA-256 в EXECUTION — exit0, errors=[]; выполнен после финализации планов и назначений.
- `git diff --check -- .planning/initiatives/ai-products`: exit0; только предупреждения Git о принятом LF→CRLF, без whitespace errors. Новые untracked документы дополнительно читаются скриптом: git diff сам по себе их не проверяет.
- Порядок зависимостей сверён вручную: A1 первый, A2/A3 и B/C имеют gates; D зависит от принятого AI-01; ARI/live не притворяются пройденными; native PBX ждёт DB-03. Product plans AI-03/04/07 не объявлены детализированными здесь.
- Runtime-код, SQL migrations и package files в этом назначении не изменялись. Build/lint/backend/frontend/runtime tests не запускались для документационных изменений; исторические pass не присваиваются новой ревизии. Remote сервер, Docker, providers и телефония не использовались.

## Границы готовности

**A1 можно назначать на реализацию** после свежего baseline и записи task/hash/owned paths. Остальные планы конкретны по контрактам, состояниям, ошибкам и приёмке, но выполняются в указанном порядке после gates. Для A2 license security, C2 schema composition, D2 recovery и D4 metering нужен focused code review перед принятием; review не означает запуск второго orchestrator.

Не закрыты этим проектированием: DB-02 итоговая матрица/review; AI-00 live/media/provider evidence; commercial license issuance/условия и tariffs; реальные product adapters/evals; DB-04 restore/release drills. Отсутствие этих результатов не мешает A1, но запрещает обещать готовность обоих продуктов к эксплуатации.
