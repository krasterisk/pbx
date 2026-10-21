# cc-ux — EXECUTION

Инициатива: модернизация UI / UX модуля колл-центра (`/callcenter/dashboard`, `/callcenter/supervisor`, `/callcenter/agent`, `/callcenter/reports`, `/callcenter/settings`).
План: [PLAN.md](PLAN.md). Продолжение и UI-контур инициативы [cc-analytics](../cc-analytics/EXECUTION.md).

## Режим и владелец

- Mode: `codex-direct`, единственный координатор — текущий чат (/root).
- Пользователь явно поручил (2026-10-15): «Давай, начинай реализацию U0 и двигайся до самого конца без остановки».
- Решения Q1–Q6 приняты (см. PLAN §6).

### Owned paths (запись)

- `packages/shared/src/callcenter-hotkeys/**`, `packages/shared/src/callcenter-metrics/**`, `packages/shared/src/index.ts`
- `packages/backend/src/modules/callcenter/**` (spy stop/mode, typed report columns, hotkeys settings)
- `packages/backend/database/migrations/0039-*.sql`, `.../postgres/0039-*.sql`, `manifest.json`, `database/test/runner.test.cjs`, `database/test/callcenter-hotkeys-migration.test.cjs`
- `packages/frontend/src/shared/ui/Sheet/**` (опциональные `modal`/`overlay`, обратно совместимо)
- `packages/frontend/src/{pages,features}/**` только callcenter (`pages/CallCenter*`, `features/callcenter/**`, `features/cc-dashboard/**`), `app/router.tsx`, locales `callcenter.*`, `eslint.config.*`, `packages/frontend/package.json` (`@tanstack/react-virtual`), корневой `package.json` (`@axe-core/playwright`)
- `.planning/cc-ux/**`; одна строка в `docs/plans/EXECUTION-REGISTRY.md` (append only)

### Read-only / чужое

- Autodial, AI-products, pbx-dashboard, endpoints, mobile-navigation, table-ui-standardization, mpbx-api9057-call-tts, helpdesk-chat — не трогать.
- Аудио-хуки `useWebRTCPhone.ts` и `useSipPhoneAmi.ts` — не менять.
- Формулы фазы A (`cc-analytics`) и эталонные данные стенда в `cc_*` — не менять и не очищать.

## Журнал

| Дата | Срез | Статус |
|---|---|---|
| 2026-10-15 | Старт U0–U6 по поручению пользователя | в работе |
| 2026-10-15 | U0 — единые форматтеры и i18n-покрытие, CcPageHeader, баннер SSE, shared/ui вместо нативных тегов и `window.confirm`, гигиена тревог, URL-состояние | готово |
| 2026-10-15 | U4 — дашборд: честные дельты, цели метрик, профильные переходы, суточный SLA | готово |
| 2026-10-15 | U1 — кокпит супервизора: доска на 300 операторов (виртуализация), AgentSheet, прослушивание, лента внимания v2, WatchlistSheet, фильтр очередей | готово |
| 2026-10-15 | U5 — настройки по группам, обзор готовности, личные настройки, защита форм, миграция 0039, горячие клавиши | готово |
| 2026-10-16 | U2 — рабочее место оператора: экран вне смены, inline-карточка, WrapupPanel, диалог перевода, лимит паузы, фиксированные панели (DnD удалён), горячие клавиши | готово |
| 2026-10-16 | U3 — отчёты 2.0: типизированные колонки (BE+FE), период со сдвигом, OperatorPicker, чипы фильтров, каталог-вопросы, итоги, drill-down очередь → звонки → CallDetailSheet, единое меню экспорта, карточки на телефоне | готово |
| 2026-10-16 | U6 — сквозная проверка: `npm run lint` (0 ошибок), `test:backend` (4181/4192, 11 skipped; флак reconciler по часовому поясу исправлен в spec), `test:frontend` (все батчи, exit 0); Chromium+Vite с мок-API: отчёты 1280/390/320 × light/dark, drill-down, лист звонка, нет горизонтального скролла, axe WCAG A/AA без serious/critical | готово |
| 2026-10-16 | Доделка хвостов: мультивыбор очередей, заметка постобработки в карточку, итоги прошлой смены, строка итогов внизу таблицы, контраст и aria оболочки, миграция 0039 на стенде, проверка ChanSpy/PlayDTMF, доска на 300 операторов в браузере | готово |

## Что закрыто 2026-10-16

- Отчёты: несколько очередей (`queue=a&queue=b`, на сервере `IN`). Итоги — строка `<tfoot>`, не плашка.
- Постобработка: `POST /callcenter/cards/wrapup-note` пишет заметку в карточку звонка (или создаёт карточку по активному шаблону).
- Экран вне смены: `GET /callcenter/agent/last-shift` и блок «Прошлая смена».
- `SegmentedControl` больше не ставит `aria-pressed` на `role=tab`. Активный сегмент — инверсия цветов (контраст в обеих темах). Первая колонка активируемой строки таблицы и подписи сайдбара затемнены до 4.5:1. Аватар с инициалами затемняет фон.
- Повторный axe (отчёты + оболочка, 1280/390/320, light/dark) — без serious/critical. Отчёт: `u6-reports-report.json`.
- Доска: контейнер прокрутки ограничен по высоте, иначе виртуализация монтировала все карточки. Прогон `.planning/cc-ux/u6-board-300.cjs`: 300 операторов, в DOM 14 карточек, высота списка 33600px. Снимок `u6-board-300.png`.
- Стенд `ipbx.krasterisk.ru`: миграции 0036–0038 уже были применены, 0039 (`agent_hotkeys`) применена штатным `db:migrate`. Asterisk 22.8: ChanSpy опция `d` — цифры 4/5/6, как в `supervisorSpy` (`qd`/`wd`/`Bd`). AMI `PlayDTMF` с `Channel`/`Digit` (так их и шлёт `asterisk-manager`) отвечает `Channel not found` на несуществующий канал — параметры приняты. Живой сеанс прослушивания на разговор абонента не поднимался.
