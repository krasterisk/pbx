# Унификация модалок сущностей

Текущая ревизия: 2026-10-13-r2, назначена U7. U1–U6 сохранены как исторический scope ревизии 2026-10-10-r1. Координатор и единственный writer: `/root`, чат `01a110c1-2070-74f1-9d26-def0842ff170`. Режим `codex-direct`.

## Назначение

Текущее поручение пользователя: применить паттерны модалки маршрута из backend ARCHITECTURE §10 ко всем модалкам/сущностям frontend (абоненты, транки, пользователи, IVR и остальные). Предыдущие мелкие правки Active Switch, общей Info и архитектурной памятки входят в baseline текущего задания. Старые routing/context планы не назначают соседнюю backend работу.

Входы: AGENTS.md; обе архитектуры; HYBRID-WORKFLOW; EXECUTION-REGISTRY. Backend §10 является памяткой; канонические frontend ограничения обязательны. Нет других активных frontend writers по доступному list_threads; изменения baseline сохраняются.

## План

- U1: полный инвентарь Dialog/Sheet и форм, классификация form/confirm/viewer; текущий dirty baseline и безопасные исключения.
- U2: единые переиспользуемые shared UI паттерны оболочки, секции, статуса, адаптивных полей/табов. Улучшение общих Dialog/Tabs/Sheet без разрушения вложенных portal и focus.
- U3: миграция core форм endpoints/trunks/users/IVR/queues/contexts/routes и каталогов к общей оболочке/логическим секциям/подписанным Switch. Сохранение create/edit/copy, expert, readonly, черновика и существующих API.
- U4: остальные редакторы, справочники, загрузки и embedded modal формы. Compact confirm/viewer сохраняют свой сценарий, получают общую визуальную оболочку; не добавлять им ненужные вкладки/кнопки.
- U5: i18n RU/EN, tooltip без title-дублей, ошибки/фокус, keyboard/mobile. Обновить frontend архитектуру с общей реализацией и инвентарь покрытия.
- U6: необходимые regression tests, lint, types, full backend/frontend. Visual проверка через доступный browser инструмент; недоступность инструмента фиксировать отдельно от автоматического pass.

## Владение и ограничения

Owned: frontend shared/ui, UI-компоненты фич/страниц с модалками и их SCSS; bounded locale keys и связанные UI tests; обе архитектуры для согласованной памятки; эта инициатива и её ссылки в registry/index. Shared UI и локали имеют одного writer `/root`.

Не менять backend runtime, DTO, migrations, API контракты, deploy/production/звонки, бизнес-логику форм, глобальный GSD STATE/ROADMAP. Не откатывать baseline natProfiles/endpointIds/bulkDeletePreview/useSchemaRefs/EndpointsTable. Редактирование соседних UI-файлов допустимо без присвоения их реализации бизнес-функций. Новые пакеты не нужны. Нет делегирования.

## Приёмка

Каждый найденный modal consumer присутствует в inventory с implemented/covered/not-applicable обоснованием. Крупные формы: стабильный shell, видимый footer, внутренний scroll, адаптивные поля/табы, логические секции. Булевый enabled статус: Label + Switch, локальный draft при Save и optimistic cache для немедленных mutations. Readonly/confirm/viewer остаются доступны и семантически корректны. RU/EN, keyboard, nested overlays и ошибки проверены по риску. Честные statuses: implemented, automated-tests-passed, visual-verified или pending/tool-unavailable; released не заявляется.
## U7: уточнение IVR, 2026-10-13-r2

Назначение /root codex-direct, один writer, без агентов. Актуальное поручение: привести IvrFormModal и вложенные вкладки к frontend ARCHITECTURE; убрать проверку со Схемы; обеспечить вкладку Где используется для сохранённого IVR.

Owned: features/ivrs/ui/IvrFormModal, IvrMainTab, IvrMenuItemsEditor, IvrPromptsEditor, SortableIvrPhraseItem; новый shared UI wrapper для сортировки; только новые ivrs.editor RU/EN keys; эти артефакты. Read-only: общий Dialplan editor/Flowchart/Usage API и остальные dirty файлы. Никаких backend/API/DB/deploy изменений.

Срезы: U7.1 каркас/основные поля/usage; U7.2 сворачиваемые пункты и фразы с адаптивностью, shared DnD, доступными контролами; U7.3 схема без DryRun и баннеров; U7.4 regression, types, lint, backend/frontend и попытка live browser. Приёмка: draft/payload/reorder/playback сохранены; menu fields только в раскрытых карточках; usage использует kind=ivr/uid и не наследует оригинал при copy; schema не вызывает dry-run API.
