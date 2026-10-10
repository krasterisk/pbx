# Рефакторинг навигации: мобильный UX, доступность и согласованность

Ревизия: **2026-10-10-r4**. Режим: **codex-direct**. Координатор: текущая задача навигации `/root`.
Статус: **implemented / automated-tests-passed / local-browser-verified (mock API)**. N5-N11 реализованы; N12 automated/browser gates пройдены, human/device/screen-reader/UAT pending. Coordinator/executor /root, без delegated writers.

## 1. Цель и преемственность

Пользователь должен понимать текущий раздел и страницу, находить любую доступную страницу без знания жестов, переходить мышью, touch и клавиатурой, сохранять понятный контекст между разделами.

Это следующий срез той же инициативы. Данный PLAN r4 заменяет r3 как актуальный план; второй roadmap или параллельный implementation plan не создаётся. N1-N4 реализованы и приняты в r3: [исторические результаты r3](SUMMARY-r3.md). Их тесты и browser evidence не подтверждают выполнение новых задач.

Сохраняемый пользовательский контракт:

- На телефоне верхний левый гамбургер открывает **левый Sheet разделов без поиска**.
- Пункт **«Модули» / маркетплейс всегда последний** в меню разделов.
- Снизу остаётся **название раздела, затем страницы раздела**, горизонтальная touch-прокрутка, primary-mouse drag и scrollbar на fine-pointer устройствах.
- Сохраняются 60px + safe-area reservation, автопоказ активной страницы, запрет перехода после drag.
- На desktop остаётся вертикальная навигация страниц, верхние переключатели раздела/страницы и отдельная поисковая палитра.

r4 расширяет прежнее ограничение «desktop keeps current behavior»: исправляет desktop active-route, семантику и доступность, делает поиск глобальным. Старые sketch-решения recents/picker search/current-module-only palette заменены текущими требованиями пользователя; они не должны возвращаться при реализации.

## 2. Входные документы и baseline

Обязательные чтения: [AGENTS](../../AGENTS.md), [CANONICAL_REFS](../CANONICAL_REFS.md), [HYBRID-WORKFLOW](../HYBRID-WORKFLOW.md), [EXECUTION-REGISTRY](../EXECUTION-REGISTRY.md), [EXECUTION](EXECUTION.md), обе архитектуры: [frontend](../../packages/frontend/.idea/ARCHITECTURE.md), [backend](../../packages/backend/.idea/ARCHITECTURE.md).

Локальные design findings: `.cursor/skills/sketch-findings-krasterisk-v4/SKILL.md`, `references/mobile-navigation.md`, `references/in-module-shell.md`; их исторические решения применять только в части, не заменённой пользовательским контрактом. Аудит и рекомендации из этого чата зафиксированы в разделе 3 этого PLAN.

Baseline: `main`, HEAD `6fa6c41904497046a510ad9969f3d36e9cdd067a`; рабочее дерево включает незакоммиченный r3. Новый worktree от HEAD не содержит этот baseline. Перед исполнением повторно сверить branch/diff/владельцев и сохранить все текущие изменения.

Исключённый dirty baseline: `features/dialplan-apps/model/useSchemaRefs.test.tsx`; `features/endpoints/config/natProfiles*`, `lib/bulkDeletePreview*`, `lib/endpointIds*`, `ui/EndpointsTable/*`; `packages/frontend/tsconfig.tsbuildinfo`. Их не откатывать, не править, не включать в commit данной инициативы.

## 3. Аудит и трассировка требований

| ID | Наблюдение / статус | Работа |
|---|---|---|
| A1 | В браузере `/settings/stt-engines`: верхний указатель «Настройки», одновременно текущие ссылки «Настройки» и STT. Подтверждённый дефект. | N5 |
| A2 | В палитре при выборе последнего из 12 результатов стрелками элемент вне viewport, scrollTop = 0; input не имеет связи с активным option. Подтверждено. | N6 |
| A3 | Кнопка темы без доступного имени; название переключателя языка не объясняет действие. Подтверждено. | N6 |
| A4 | Последние страницы нижней панели скрыты; пользователь ранее не обнаружил способ добраться до них мышью. Drag работает в r3, обнаруживаемость требует улучшения. | N7 |
| A5 | Мобильные переходы сделаны кнопками, теряют browser link semantics. Подтверждено кодом. | N7, N9 |
| A6 | Поиск содержит страницы только текущего раздела; path dedupe скрывает название первой страницы за именем раздела. Подтверждено кодом. | N8 |
| A7 | Серые unavailable строки кликабельны, без явного статуса и ведут в общий Hub. Подтверждено. | N9 |
| A8 | Favorites-first в Hub меняет также порядок разделов навигации. Польза стабильного порядка — продуктовая гипотеза. | N9, N12 |
| A9 | Смена раздела всегда открывает первую страницу. Восстановление последней страницы — продуктовая гипотеза. | N10, N12 |
| A10 | Переход на sidebar 240px при 768px уменьшает рабочую область; автоматическое сворачивание на планшете требует проверки. | N11, N12 |
| A11 | Перенос редких действий языка/темы в профиль и отдельный мобильный вход в глобальный поиск — гипотезы. | N11, N12 |
| A12 | Полные проверки contrast/reflow/screen reader/реального телефона ещё не проведены. | N12 |

Источники принципов: [WAI-ARIA combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), [WCAG name/role/value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html), [dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [NN/g horizontal scrolling](https://www.nngroup.com/articles/horizontal-scrolling/). Нативный overflow сам по себе не является нарушением drag criterion; 44px — комфортная touch-цель, а не минимальный размер WCAG AA (2.5.8: 24px с исключениями).

## 4. Решения для реализации

1. **Один источник навигационных данных.** Использовать итоговые строки `useHubModules` после server catalog mapping, tenant visibility, ownModels, license и RBAC. Не строить поиск/restore по отдельной копии BASELINE_MODULES. Каталог может переносить страницу между разделами.
2. **Один resolver текущей страницы.** Наиболее точный разрешённый маршрут, с границами сегментов и точным `/`. Раздел и страница одинаковы для всех поверхностей. Hub/служебные URL не маскировать подписью «Дашборд».
3. **Явный список всех страниц.** Нижнее название раздела становится кнопкой `Раздел ▾` с доступным именем «Все страницы раздела …». Она открывает нижний Sheet «Страницы …» с полными названиями и ссылками. Верхний Sheet содержит разделы, нижний — только страницы; поиска в них нет. Для одной страницы триггер остаётся, для нуля — статичная подпись без пустой панели.
4. **Ссылки для переходов, кнопки для действий.** Link semantics сохраняются в меню, нижней панели и Hub. Перетаскивание не перехватывает middle-click, правую кнопку и клики с модификаторами.
5. **Поиск остаётся отдельным.** Все разрешённые страницы активных разделов доступны из любого раздела. Один результат на канонический URL сохраняет searchable aliases раздела и страницы, контекст раздела и стабильный ID. Если после восстановления module entry отличается от первой страницы, индекс включает оба адреса. Shared CommandPalette получает только готовые данные, без импорта бизнес-фич.
6. **Порядок и доступность разделов.** Навигация использует catalog order до favorites sorting; Hub сохраняет действующий favorites-first. Недоступные разделы идут отдельной группой «Недоступные разделы» (включая отключённые базовые разделы) с различимыми текстами «Не подключён» / «Отключён» и ведут к своей строке/карточке Hub. «Модули» остаются последними.
7. **Возврат в раздел.** Планируем восстановление последней канонической страницы навигации, не entity URL, query/hash или формы. Прямые ссылки, browser history, выбор конкретной страницы и role-start redirect не заменяются restore. Поведение проверить как гипотезу на N12.
8. **Планшет и верхняя панель.** Кандидат: <768px текущий phone layout; 768-1023px компактный sidebar по умолчанию, >=1024px текущий desktop. Явный выбор пользователя имеет приоритет, resize не перезаписывает настройку. Порог и перенос языка/темы в профиль подтвердить на сценариях N11; при отсутствии преимущества сохранить текущее размещение и зафиксировать решение.

## 5. Последовательность задач

N5-N11: **implemented**; N12: automated/local-browser gates **pass**, внешние human/device/UAT gates **pending**. Evidence и принятые решения: [SUMMARY](SUMMARY.md). Приоритет P1 — устранение дефектов и доступ ко всем страницам; P2 — поиск и контекст; P3 — responsive/UX гипотезы.

### N5 — P1: единая модель маршрута и навигационных данных

- Расширить `features/modules/lib/moduleRegistry.ts` или небольшой соседний helper: вернуть текущие module/page с longest matching path. Переиспользовать в ModuleShell, sidebar и bottom bar; не создавать второй registry.
- В `useHubModules` добавить canonical navigation collection до сортировки избранного, сохраняя публичный контракт существующего Hub и server catalog order.
- Не менять route authorization / license gate; сохранить special cases `/speech-analytics`, `/ai-robots`, suppressed modules и fallback.
- Проверки: `/settings/stt-engines`, `/reports/cdr`, `/autodial/bases` и вложенная детальная страница дают ровно один текущий пункт; `/settings-other` не совпадает; `/` только точно; перенос `/queues` каталогом в `core`; Hub/unknown/service URL не выбирают ложную страницу. Прямой URL и Back/Forward согласованы.
- Файлы: `features/modules/lib/moduleRegistry*`, `hooks/useHubModules*`, при необходимости новый чистый navigation helper; `widgets/ModuleShell/{ModuleShell,ModuleShellSidebar,ModuleBreadcrumbs}*`, `widgets/MobileBottomBar/*`.

### N6 — P1: клавиатура и доступность существующего chrome

Зависимость: N5 для интеграционной проверки подписей.

- Палитра: доступное имя input, корректный combobox/listbox API, существующие option IDs, aria-expanded/controls/activedescendant, активный результат всегда в видимой области.
- При query/open/items изменениях корректировать индекс; нулевые результаты, сокращение списка из-за каталога/прав, wrap ArrowUp/Down, Enter/Escape, hover -> keyboard не дают stale selection. Tab не создаёт конкурирующую модель фокуса.
- Проверить реальные Dialog/Sheet focus trap, close/restore; тесты с замоканным Dialog не заменяют browser evidence. При resize/навигации фокус не возвращается на исчезнувший trigger и scroll lock снимается.
- Именовать тему/язык, состояния текущей страницы/раздела и другие icon-only actions. Для контролов в изменяемом chrome — видимый фокус; touch targets 44px как дизайн-цель с проверкой layout.
- При изменении старых sidebar/breadcrumb компонентов привести затронутую разметку к shared UI/Stack/Text и токенам; не делать отдельный широкий дизайн-рефакторинг.
- Файлы: `shared/ui/CommandPalette/*`, затронутые ModuleShell-компоненты/SCSS/tests; shared Dialog/Sheet только при обнаруженном дефекте, без регрессии других панелей.

### N7 — P1: «Все страницы» и browser semantics мобильной навигации

Зависимости: N5, N6.

- Новый `widgets/MobileBottomBar/MobilePageMenu` (tsx/SCSS/test/public export при необходимости): нижний Sheet по решению 3, активная ссылка и полные RU/EN названия; список из 0/1/12 страниц.
- Маршрутные элементы MobileBottomBar и MobileModuleMenu перевести в ссылки через существующий shared UI composition. Проверить типы anchor refs; при необходимости добавить минимальную shared NavItem обёртку вместо unsafe casts/копирования Button. Открытие Sheet остаётся кнопкой.
- Закрывать панель после обычного перехода; Ctrl/Cmd/middle-click открывают новую вкладку по нормальным правилам. Drag >=6px подавляет только release click; следующий клик/Enter работает; pointercancel/lostcapture сбрасывают drag. Не допускать нежелательный native link/image drag.
- Сохранить touch scroll/snap, fine-pointer scrollbar, safe-area и автопоказ текущего пункта. Добавить видимый индикатор продолжения при overflow, скрывать его на последнем краю. До любой страницы можно дойти обычным нажатием через «Все страницы».
- Файлы: `widgets/MobileBottomBar/*`, `widgets/ModuleShell/MobileModuleMenu*`, минимальный shared navigation primitive при необходимости; RU/EN локали.

### N8 — P2: глобальный поиск с понятным контекстом

Зависимости: N5, N6.

- Собрать индекс всех разрешённых страниц licensed active rows; добавить section context и поисковые aliases/keywords в публичные data types builder/filter.
- Дедупликация URL не теряет название первой страницы: «Абоненты» и «PBX» находят `/endpoints`; generic labels различимы по разделу. Каталожный перенос страницы отражён в подписи.
- Из «Системы» находятся «Транки», из PBX — STT; RU/EN смена языка обновляет индекс. Locked/disabled/off/tenant-hidden/RBAC-hidden/ownModels-hidden страницы не попадают в выдачу. Динамическое изменение каталога корректирует активный результат.
- Ctrl/Cmd+K остаётся; мобильный отдельный вход обсуждается только в N11. Верхний section Sheet не становится поиском.
- Файлы: `ModuleShell.tsx/tests`; `shared/ui/CommandPalette/{buildPaletteItems,filterPaletteItems,CommandPalette}*` и тесты.

### N9 — P2: статусы модулей, стабильный порядок и адресный Hub

Зависимости: N5, N7.

- Подключить canonical order к section menu/desktop switcher; favorite toggle изменяет Hub, но не перемещает пункты навигации. Не дублировать рабочие разделы в двух группах.
- Для locked/disabled показывать текстовый статус и понятное действие. Переход `/modules?module=<known-code>` указывает конкретную карточку/строку после загрузки: highlight, scroll, согласованный фокус. Не открывать checkout и не включать/покупать модуль автоматически.
- Unknown/hidden code открывает обычный Hub без ложного focus/selection; поздний API response, refresh, Back/Forward не дают циклов скролла или захвата фокуса после действий пользователя. При error/loading каталога не объявлять расширение активным.
- Убрать вложенную кнопку избранного внутри Hub NavLink: маршрутная ссылка и toggle — отдельные соседние интерактивные элементы. Disabled action информирует о статусе; доступ к enable определяется существующими правами.
- Файлы: `MobileModuleMenu*`, ModuleShell switcher; `widgets/ModuleHub/{ModuleHub,ModuleHubRow,ModuleHubMarketplaceCard}*`; `features/modules/hooks/useHubModules*`; RU/EN локали. Route table/backend не меняются.

### N10 — P2: возвращение к последней разрешённой странице

Зависимости: N5, N8, N9.

- Небольшой helper/hook в features/modules, подписанный один раз в shell; единый resolve destination для выбора раздела в sheet/desktop/Hub/module-result поиска.
- Хранить только allowlisted page ID + канонический маршрут навигации. Не подключать legacy useMobileNavRecents целиком, не восстанавливать его recents layout/global pathname storage и не импортировать старую историю без надёжной identity.
- Versioned storage, проверка JSON/структуры, try/catch; scope по достоверной effective identity пользователя (`uniqueid`) и tenant/impersonation context. Если полного контекста недостаточно — memory-only. При logout/switch user/impersonation сбросить runtime state; raw tokens не использовать как ключи.
- Перед restore проверять текущий каталог, владельца страницы, права/видимость/license; fallback: первая разрешённая страница раздела, затем Hub. Во время loading/error каталога не перезаписывать историю и не делать преждевременный переход.
- Проверки: возврат к `/trunks`; role downgrade, disabled/locked/off/tenantVisible=false/ownModels=false, удаление/перенос страницы; malformed JSON/storage exception/external URL; разные пользователи/tenant; прямой deep link не заменяется restore. Не сохранять query/hash/entity IDs и значения форм.
- Файлы: новый helper/hook + tests в `features/modules`; shell и module-selection entry points. Auth API/storage adapter/backend не менять.

### N11 — P3: проверить responsive и гипотезы верхней панели

Зависимости: N7-N10; можно исследовать layout после N7, но итог проверять с полной навигацией.

- На 768/820/1024px измерить рабочую область и проверить сценарии списка/таблицы, раскрытия rail и длинных заголовков. Подтвердить или скорректировать candidate band из решения 8. Автоадаптация не записывает пользовательскую настройку collapse.
- Проверить light/dark, RU/EN, узкий landscape и zoom; tooltips на rail не заменяют доступные имена. Phone сохраняет собственный layout, планшет не получает принудительный Hub/detail split.
- Оценить перенос языка/темы в профиль и самостоятельную кнопку глобального поиска на мобильном как альтернативы текущей плотности. Выбрать по пользовательским сценариям, без возврата поиска в section menu. Не менять размещение только ради симметрии.
- Для каждого решения записать в этот PLAN / итог evidence: принято/оставлено текущее и причина. Неопределённость P3 не блокирует N5-N10.
- Файлы при принятом изменении: ModuleShell/sidebar/SCSS/tests, `widgets/UserBlock/*`, при необходимости локальный layout hook в features/modules; не менять глобально useIsMobile для других фич.

### N12 — приёмка, evidence и handoff

Зависимости: интегрированный N5-N10; N11 имеет зафиксированные решения.

- Targeted unit/component tests: route resolver, dynamic catalog, palette builder/filter/keyboard, all-pages Sheet, links/drag, unavailable Hub selection, scoped restore. Тестировать поведение, не копировать implementation.
- Обязательные проверки перед статусом automated-tests-passed:

```bash
npm run lint
npm run test:backend
npm run test:frontend
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/frontend/tsconfig.json
```

- Targeted пример из `packages/frontend`: `node ../../node_modules/vitest/vitest.mjs run src/widgets/ModuleShell src/widgets/MobileBottomBar src/shared/ui/CommandPalette src/features/modules src/widgets/ModuleHub`. Расширять на новые изменённые components; существующий полный frontend runner использовать из root.
- Browser matrix: 320/360/390/640/767/768/820/1024/1280px; touch и fine pointer отдельно; прямые URL и history; длинные labels/20+ search results; горизонтальная прокрутка всего документа отсутствует; вертикальная прокрутка основного контента и локальная прокрутка таблиц/панелей сохраняются. Проверить нижний последний action, overlay stacking, assistant/conference mini-panel, resize с открытым Sheet, safe area, экранную клавиатуру.
- A11y: keyboard only + реальные Dialog/Sheet, visible focus, name/role/current/expanded, contrast по фактическим цветам обеих тем, reflow при 200%/400% zoom. Screen reader и реальный телефон/native WebView проверять отдельно; локальный Chromium с API mocks их не заменяет. Полную WCAG-сертификацию не заявлять.
- UX/UAT: представители администратора и оператора находят последнюю страницу без подсказки о свайпе, переключают раздел/возвращаются, находят страницу другого раздела поиском, понимают недоступный модуль. Записать успешность, время, ошибочные переходы и наблюдения; оценить A8-A11. Непроверенную гипотезу не выдавать за измеренное улучшение.
- В результате отдельно указать implementation, automated, local-browser(mock/live API), human/device/UAT и release gates. Известные функциональные/a11y дефекты закрыты; внешний pending gate не скрывать и не переносить в pass из r3.
- После реализации обновить SUMMARY с явной новой ревизией и EXECUTION; сохранить ссылки на r3 evidence. Финальный review другим разрешённым reviewer записывать как независимый только если он действительно выполнен. Публикация/commit/push/deploy этим планом не назначены.

## 6. Владение и ограничения

Пользователь явно назначил исполнение r4. `/root` — единственный implementation writer frontend scope N5-N11, локалей, architecture и документов этой инициативы. Предыдущие NAV-PLAN-INPUTS/NAV-PLAN-REVIEW-INPUTS были read-only review планирования; при исполнении делегированных writers/reviewers нет.

Назначенный implementation scope: перечисленные в N5-N11 frontend пути и их тесты; локали `shared/config/locales/{ru,en}.ts`; frontend architecture только для принятых navigation contracts; минимальный shared UI API по необходимости. Общие registry/types/локали/компоненты имеют одного назначенного владельца записи. Scope назначен запросом пользователя «Реализуй план»; соседние инициативы не присваиваются.

FSD: primitives/public wrappers в shared; доменная навигационная модель и storage в features/modules; композиция в widgets. Выше shared применять Button/Text/Stack/Flex, SCSS modules, семантические CSS-токены и глобальные z-index переменные. Новых пакетов и cmdk не требуется; прямые Radix imports в widgets не добавлять.

Исключено: backend/API/DTO/database, router route table и platform-admin contracts, Asterisk/native packaging/release, чужие dirty файлы и root GSD STATE/ROADMAP/соседние инициативы. Если контракт API оказывается недостаточным — отметить ограничение и продолжить независимые задачи; не расширять запись молча.

## 7. Статусы и следующее действие

| Gate r4 | Статус сейчас |
|---|---|
| План / read-only review планирования | pass; результаты включены |
| N5-N11 implementation | implemented |
| Automated tests / lint / type | pass; см. SUMMARY |
| Local-browser | pass; mocked API, 28 сценариев + 2 theme/long-index проверки |
| Real phone / screen reader / UX-UAT / live authenticated backend | pending; не заменены API mocks |
| Release | not-applicable; публикация не назначена |

Next action: human/device/UAT по сценариям N12. Код и автоматические проверки завершены; внешняя проверка не блокирует независимую работу. Любые дальнейшие функциональные изменения требуют нового bounded assignment и проверки dirty baseline. Исторические r3 результаты: [SUMMARY-r3](SUMMARY-r3.md).
