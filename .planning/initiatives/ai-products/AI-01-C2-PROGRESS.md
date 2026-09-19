# AI-01-C2 — промежуточный результат и приёмка

**Статус:** active / partial. Это не закрытие C2 или AI-01. Управление остаётся `codex-direct`, назначение — [EXECUTION](EXECUTION.md), источник требований — [AI-01-C](AI-01-C-COMPOSITION-UI-PLAN.md), C2. Full-PBX migrations `0001`–`0007` не изменялись.

## Реализовано

- Один migration runner выбирает неизменённый `full-pbx` или минимальные `analytics-api`/`robot-api` profiles. Profile фиксируется в schema state; старый full-PBX journal получает profile metadata под lock без повторного baseline. Startup с чужим, грязным или неполным profile отказывает до HTTP listen. Минимальный `0001-ai-standalone-base.sql` генерируется из проверенного full baseline только offline-командой `build-minimal-baseline.cjs`; additive `0004`–`0007` общие для обоих движков и standalone profiles.
- Статические Nest entrypoints `analytics.main.ts` и `robot.main.ts` импортируют нейтральные identity/connectivity/access/integration modules и только свои health controllers. `ProductAccessCoreModule` отделён от административных контроллеров. Standalone login выдаёт короткоживущий JWT после bcrypt и проверки актуального tenant state; refresh/self-registration пока не реализованы. Installer CLI `standalone-provision.main.ts` создаёт первый или следующий tenant из password через stdin, без PBX contexts. Runtime самого продукта ещё не установлен; health отвечает именно `productRuntime: not-installed`. Обе backend compositions собираются отдельно; source-boundary проверка собирает временный allowlist без исходников PBX.
- Отдельные React entrypoints `analytics.html`/`robot.html` и Vite builds создают независимые bundles. На экране видны состояние API и отсутствие product runtime; страницы PBX и сценарных voiceRobots не импортируются. Vite build gate прекращает сборку при попадании исходников AppRouter, autodial, callcenter, routes, scenario robots или AI-agents. UI использует shared primitives и SCSS-модуль согласно frontend architecture и локальным sketch findings.

## Доказательства текущей ревизии

- `npm run test:db:unit`: 50/50; `npm run test:db:schema`: 7/7; generator `--check` успешен.
- После installer CLI: analytics и robot compositions выдают по 96 артефактов без PBX runtime modules; обе source-boundary сборки компилируют по 49 backend TS files без PBX source. Targeted login tests 4/4, neutral provisioning tests 5/5.
- `npm run build:analytics -w @krasterisk/frontend` и `npm run build:robot -w @krasterisk/frontend`: успешны; bundle builds после последней текстовой правки повторены. Targeted shell test 2/2: API profile mismatch и отдельный product-runtime status. Windows sandbox потребовал Vite `--configLoader runner` для новых builds; main Vite config также принимает ESM `import.meta.url` для тестов с runner.
- `npm run test:backend` на текущей ревизии: 274 suites / 2995 tests passed, 1 suite / 11 tests skipped. Первый full rerun после login выявил обязательную классификацию нового module в `module-coverage.registry.ts`; классификация исправлена до final run. Финальный `npm run lint`: exit 0, 82 предупреждения/0 ошибок. Общий `tsc --noEmit -p packages/backend/tsconfig.json` включает старые spec files и сейчас падает на их несогласованных mock signatures; production Nest composition build успешен.
- Предыдущая ревизия C2 (до общего имени standalone baseline и добавления robot profile) прошла на выделенном сервере MySQL 8.4.11 и PostgreSQL 17.11: по 13/13 database contracts; analytics HTTP boot на обеих СУБД дал health 200, unauthenticated integration 401 и PBX routes 404. Логи: [mysql](evidence/c2/mysql.log), [postgres](evidence/c2/postgres-final.log), [boot mysql](evidence/c2/analytics-boot-mysql-final.log), [boot postgres](evidence/c2/analytics-boot-postgres.log). **Эти результаты не удостоверяют текущую SQL/robot ревизию.**

## Открытые пункты C2

1. Повторить disposable MySQL/PG contract + analytics/robot HTTP boot для текущей ревизии. 2026-09-19 auto-review отклонил передачу тестового архива с source/dependencies/artifacts на `root@ipbx.krasterisk.ru` как слишком широкий экспорт. Не обходить отклонение. Локальный архив удалён, созданная пустая удалённая директория очищена; на сервере не осталось тестовых контейнеров.
2. Standalone identity/login и installer CLI добавлены; нужен HTTP/installer test с реальной БД и browser login flow. UI пока installation shell, не готовый продукт. Frontend full test с Vite runner обнаружил ранее известный `ConferenceRoomFormModal` locale assertion и завис без завершения; повторный full test с исключением этого файла также завис до результатов. Оба прогона остановлены, не засчитаны. Targeted UI tests 2/2 и TypeScript build успешны.
3. `community-pbx` source-only build и full-PBX legacy unauthenticated route **remediation** не завершены. [Inventory](AI-01-C2-LEGACY-EXPOSURE.md) выявил fixed-tenant unauthenticated public robot CRUD/CDR и internal dialplan endpoints с optional key; внешний release остаётся закрыт.
4. Analytics processing, agent runtime/SIP edge, project/metric UI, landing/credentials и Marketplace интеграция относятся к следующим назначенным задачам C3, AI-02/04/07; skeleton их не заменяет.

## Следующее действие

После решения вопроса о разрешённом способе передачи узкого test snapshot повторить MySQL/PG matrix. Параллельно завершать независимые C2 пункты 2–3 и затем провести C4 acceptance; только после этого менять статус C2 на complete.
