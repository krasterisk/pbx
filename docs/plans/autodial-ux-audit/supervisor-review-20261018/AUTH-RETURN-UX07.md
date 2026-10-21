# UX07: возврат после входа — предложение владельцу

Это уточнение незакрытого UX07 в PLANr2, не отдельный план исполнения. Статус: **implemented/source29 targeted89 PASS; source28 live PASS; final CI29 pending**. User explicitly transferred the three paths to this coordinator; `auth-takeover-28.json`. Historical ownership wait below is superseded. Координатор Autodial: чат01a14365-0819-75a2-b04b-b2132bd65a45, codex-direct. Права на межзадачное согласование даны пользователем; владельца активной module-marketplace пока установить не удалось.

## Воспроизводимость

Normal-password вход супервизора4 после открытия `/v4/autodial/campaigns/18?tab=scenario` ведёт на `/v4/callcenter/supervisor`. После исправленного source26 перехода 401→`/v4/login` обычный вход также приводит к старту роли. Evidence: `implementation/login-return-19.json`, `auth-return-still-pending-26.txt`.

Отдельная BASE_URL ошибка уже исправлена в ранее чистом `shared/api/rtkApi.ts`, с actual RTK tests и controlled live401+refresh401. Она не закрывает возврат к исходной странице и не присваивает три файла ниже.

## Точки взаимодействия

1. `app/layouts/AppLayout.tsx`: сейчас `<Navigate to="/login" replace />` не сохраняет pathname/search/hash.
2. `widgets/AuthLogin/AuthLogin.tsx`: успешный вход non-SuperAdmin всегда ставит ROLE_START_PENDING_KEY и вызывает resolveRoleStart.
3. `features/modules/hooks/useRoleStartRedirect.ts`: после загрузки каталога pending-флаг всегда применяет старт роли. Изменения только AuthLogin недостаточно: hook может перезаписать выбранный возврат.

Хеши для согласования: `implementation/auth-return-owner-baseline-26.json`. Они не означают передачу владения. Активный EXECUTION module-marketplace остаётся приоритетным до явного handoff.

## Предлагаемый минимальный контракт

- Сохранить одноразовый локальный адрес pathname+search+hash при вынужденном входе. Учесть холодную глубокую ссылку через Router и hard redirect RTK при отклонённом refresh: одного Router location.state недостаточно для обоих случаев.
- Разделить локальный путь Router без basename и URL браузера с BASE_URL; не удваивать `/v4`. Не принимать внешние URL, `//host`, обратные слеши, управляющие символы, login/register/reset и tenant→platform переходы. Не сохранять токены или пароли в адресе/хранилище возврата.
- После обычного входа дождаться каталога и проверить доступность страницы по текущей роли, активному модулю/лицензии и серверным guards. Сохранённый адрес не даёт новых прав. Внешний/неподходящий/устаревший адрес → существующий старт роли/Hub.
- Одноразовый разрешённый возврат имеет приоритет над ROLE_START_PENDING_KEY. Снять оба pending-состояния после единственного применения; следующие переходы пользователя не перехватывать.
- SuperAdmin по-прежнему идёт в `/platform`, tenant возврат не расширяет его кабинет. Смена учётной записи/организации не должна переносить чужой pending адрес без повторной проверки доступности; API guards сохраняются.
- Не использовать resolveAvailableStartPath как единственный валидатор входного URL: он намеренно сохраняет неизвестные service/custom routes и публичный `/ai-robots`. Нужен явный whitelist назначений или подтверждённая семантика каталога.

## Проверки для принятого владельцем среза

- Router integration: холодный campaign deep link, query/hash, вход на корне и при BASE `/v4/`, возврат применяется один раз; pending старт роли не перезаписывает его.
- Отказанный refresh, missing refresh и контролируемый reload: адрес не теряется; существующие standalone/impersonation guards не меняются.
- Отрицательные случаи: external/protocol-relative/control/backslash, auth/platform, недоступная роль, locked/disabled/hidden module, failed/loading catalog, просроченный pending, другой пользователь.
- SuperAdmin→platform и обычный вход без исходного адреса сохраняют существующий role start. API/permissions/tenant isolation остаются прежними.
- Valid red/green, targeted modules/auth tests, types/lint/build; затем новая frozen source и полный frontend. Backend повторять только при изменении его исходников.
- Live обычный вход в допустимую кампанию с query/hash и повторный вход после controlled401, отдельная проверка forbidden module/fallback. До этого UX07 остаётся fail/pending; итоговый source27 full CI относится к текущему коду без этого исправления.


## Финальный результат 2026-10-19T03:27:56.241569+00:00

Human takeover applied; finalsource29 implemented,89targeted/474files2598fullfrontend/lint/types/Vite PASS. Actual cold/401+refresh401/reload/normalpassword exactquery+percent+hash PASS, normalUIlogout. All ownstand/helpers/privatefixture removed with guardedpostcheck. Historical pendingownership proposal above is superseded. See VERIFICATION for exactproof and remaining environment limits.
