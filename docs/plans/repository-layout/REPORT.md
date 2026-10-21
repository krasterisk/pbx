# Repository layout — результат

2026-10-21; PLAN r1; `/root chat01a15cc9`, codex-direct. Структурная миграция реализована, локальная целостность и targeted checks пройдены. Общий frontend gate: FAIL вне продуктового scope миграции; release не заявляется.

## Что изменилось

- Перенесены 947 Markdown-документов: текущие инициативы/индекс — `docs/`, 617 исторических материалов — `docs/archive/gsd/`. Ни одна старая фаза не назначена к исполнению и не объявлена заново завершённой.
- Перенесены 5 инструментов: dashboard dual-dialect harness и Asterisk lab/parser tests в `harness/`; синтетический CSV generator и metadata OpenAPI export в `tools/autodial/`. Новые outputs внешние. Исторические/private/numbered helpers не стали поддерживаемой toolchain.
- Перенесены 7 синтетических inputs: 6 Autodial CSV и структурированный conference acceptance input в `tests/fixtures/`. SHA-256/encoding/BOM/line endings сохранены; `.gitattributes` фиксирует `-text` для CSV. JSON CDR, включая файл с названием FIXTURES, не promoted.
- `.gitignore`: 1148 → 62 строки, одна политика `/.planning/`. Правило `/artifacts/` ограничено корнем и не скрывает `tools/artifacts`. AGENTS и GSD_GUIDE закрепляют единственный канонический PLAN и границы хранения.
- В Git index нет `.planning`: 1378 старых записей сняты; исходные index blobs 903 перенесённых tracked файлов сохранены в новых путях. Предшествующие dirty edits не staged/committed; 56 ранее untracked promoted файлов остаются для review вместе с новыми README/политиками. Commit/push/deploy не выполнялись.

## Сохранность и координация

959 transferred файлов имеют immutable originals и SHA в `ARTIFACTS_ROOT/migration/repository-layout-20261021/`, там же `index-before.bin`, original index entries, old→new proposal, журнал и checks. Это локальная резервная копия, не источник исполнения. Исторические raw manifests/receipts не переписывались.

1884 остальных регулярных локальных файла и 2467 прежних legacy aliases сохранены; для неактивных файлов сверены хеши. Два открытых CDR frontend лога оставлены сервисам и не замораживались. Unrelated Git index совпал с baseline; наша миграция не меняла продуктовый код. Секреты/приватные выгрузки в новые версионируемые каталоги не переносились.

Во время длинного прогона чат «Заявка от Росттех» независимо изменил `packages/backend/src/modules/service-requests/service-requests.controller.ts` (13:56). Владелец прямо подтвердил авторство и сообщил о PASS сборки backend и тестов обработчика. Эта правка сохранена без изменения/staging/commit. За исключением неё и двух разрешённых README relinks, tracked product diff совпал с исходным; её SHA и diff отдельно сохранены в журнале. Наши root lint13:32/backend13:34 предшествуют этой правке: результаты относятся к снимку структурной миграции, не являются новым full-regression claim для более позднего контроллера.

CDR, Autodial и AI-products согласовали точные области; их владение возвращено с новыми каноническими путями. CDR:25 top-level Markdown, без продвижения JSON/исторических генераторов. Autodial:12 Markdown, в том числе актуальный прежде untracked PLANr2/verification/handoff; честная частичная UX-приёмка сохранена. AI-products и AI Robot Studio сохранены под `docs/plans/initiatives/`. Продуктовые owners/gates не переопределялись.

## Проверки

| Gate | Результат |
|---|---|
| SHA transferred originals /7 fixtures /remaining local files | PASS |
| Canonical paths не ignored; будущая `.planning` ignored | PASS |
| Сверка1371 прежней Markdown-ссылки | новых broken0; прежние missing7; 366 локальных исторических ссылок |
| Syntax37 изменённых JS/Python файлов, bash `-n` | PASS |
| Docs/pure harness tests | 28/28 PASS |
| Artifact API, реальная Python/Node parity | 9/9 PASS |
| Локальные SIP parser tests | 12/12 PASS; без sockets/processes |
| CSV generator smoke | обе кодировки побайтно совпали с canonical inputs |
| OpenAPI metadata smoke |12 paths; без DB/listen/network |
| git diff --check своих paths | PASS |
| npm run lint | PASS;0 errors/224 warnings; снимок13:32 до независимой правки controller |
| npm run test:backend | PASS;4980 passed/27 skipped; снимок13:34 до независимой правки controller |
| Полный frontend coverage | 481 passed files/1 failed; 2630 passed tests/8 failed |

Frontend source files: `src/features/callcenter/lib/useWebRTCPhone.consultation.test.tsx`. Первый40-file блок принят из исходного вызова npm, незавершённые блоки продолжены с4 workers в той же конфигурации forks. Все482 test files покрыты, их хеши до/после совпали; первый partial run не назван успешным. Подробности — внешний `checks/repository-layout-20261021/frontend-resume-ledger.json`. Продуктовые ошибки не исправлялись этой миграцией.

## Прежние отсутствовавшие цели

Суффиксы `:номер-строки` учтены как навигация, а не часть имени файла. Следующие цели отсутствовали уже до переноса; данные не выдумывались:

- `.planning/initiatives/AI-02-PLAN.md` — docs/plans/initiatives/ai-products/AI-02-D1-VERIFICATION.md
- `.planning/initiatives/ai-products/evidence/PRODUCT-RUNTIME-FLIP.md` — docs/plans/initiatives/ai-products/evidence/pending-gates/RELEASE-CHECKS.md
- `.planning/initiatives/ai-products/evidence/AI-05-PLAN.md` — docs/plans/initiatives/ai-products/evidence/pending-gates/REMOTE-MATRIX.md
- `.planning/initiatives/ai-products/evidence/AI-11-11A-UAT.md` — docs/plans/initiatives/ai-products/evidence/pending-gates/REMOTE-MATRIX.md
- `.planning/initiatives/ai-products/evidence/evidence/int-rt-tool6/REMOTE-MATRIX.md` — docs/plans/initiatives/ai-products/evidence/pending-gates/REMOTE-MATRIX.md
- `.planning/initiatives/ai-products/evidence/evidence/i4/REMOTE-MATRIX.md` — docs/plans/initiatives/ai-products/evidence/pending-gates/REMOTE-MATRIX.md
- `.planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/packages/frontend/.idea/ARCHITECTURE.md` — docs/archive/gsd/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-UI-SPEC.md

Ссылки на `.planning`, `.artifacts`, `.docs` или private/remote paths в исторических документах могут быть локальными. Новый clone не требует их для приложения/поддерживаемых docs tests. Канонические inputs/readers используют новые пути.

## Следующее действие

Структурных задач не осталось. При следующем назначении читать `AGENTS.md` → `docs/CANONICAL_REFS.md` → назначенный EXECUTION/PLAN. Новую рабочую область не force-add в Git; постоянные результаты promote выборочно. Общий frontend gate остаётся у продуктового владельца при наличии ошибок. Независимый reviewer не назначен; выполненные проверки собственные, без live/release claims.
