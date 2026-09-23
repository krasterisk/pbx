# Phase 18 — вход для discuss

Статус: **не план и не CONTEXT**. Решения фазы появятся в `18-CONTEXT.md` после `/gsd-discuss-phase 18`, задачи — после `/gsd-plan-phase 18`.

## Запрос

Полный рефакторинг модуля речевой аналитики. Текущая реализация по `.planning/initiatives/ai-products/` не устраивает; её разбор — `.planning/initiatives/ai-products/SPEECH-ANALYTICS-UX-SLICE.md`. Это пример результата, который не надо повторять, а не объём новой фазы.

Эталон поведения — aiPBX. При переносе проверять реализацию aiPBX и улучшать её, а не копировать сервис целиком.

Исходники aiPBX:

- `C:\Users\Professional\WebstormProjects\aiPBX_backend\src\operator-analytics\operator-analytics.service.ts`
- `C:\Users\Professional\WebstormProjects\aiPBX\src\features\OperatorAnalytics\ui\OperatorProjectManager\OperatorProjectManager.tsx`
- `C:\Users\Professional\WebstormProjects\aiPBX\src\features\Calls\index.ts`
- `C:\Users\Professional\WebstormProjects\aiPBX\src\pages\CallsPage\ui\CallsPage.tsx`
- `C:\Users\Professional\WebstormProjects\aiPBX\src\pages\DashboardCallRecordsPage\ui\DashboardCallRecordsPage\DashboardCallRecordsPage.tsx`
- Эталон вне скоупа: `C:\Users\Professional\WebstormProjects\aiPBX_backend\src\operator-analytics\eval\golden-set\example-003-out-of-scope-service.json`

UI Krasterisk: `packages/frontend/.idea/ARCHITECTURE.md`. AI-чат: `packages/backend/src/modules/ai-chat/ai-chat.module.ts`. Маршрут: `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx`.

## Что должно получиться

1. Проекты, редактор метрик, API, дашборды, отчёты, биллинг — по функциям не хуже aiPBX, по UI удобнее.
2. Если модуль включён в маркетплейсе, в параметрах маршрута есть включение анализа записи. Общий рубильник тенанта тоже разобрать на discuss: одного из двух недостаточно.
3. Запись (формат, stereo/mono) и передача на аналитику после завершения файла, без ожидания STT на hangup. Диаризация stereo и mono сохраняется. Внешняя АТС подключается тем же приёмом записей, что и сейчас у aiPBX.
4. Модели распознавания и аналитики задаёт мультиадмин platform из общего списка провайдеров. Если у тенанта есть право — администратор кабинета выбирает из списка моделей тенанта.
5. Эталонные оценки, включая кейс «услуга вне скоупа».
6. Запись загружается в отчёт по звонкам через интерфейс и через API.
7. Кроме экранов, модуль настраивается через AI-чат. Редактор метрик даёт шаблоны отраслей и свободную настройку, в том числе из чата.
8. В плане фазы сразу есть блок живого UAT: несколько сценариев настройки, загрузка через веб и API. Корпус: `Z:\temp\speech-analytics-samples` (mono и stereo). В git не класть.

## Что discuss не должен считать уже решённым

Черновик в инициативе снят с роли плана и заменён ссылкой на Phase 18. Решения этой фазы ещё не приняты.
