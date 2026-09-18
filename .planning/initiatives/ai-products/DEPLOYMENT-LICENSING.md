# OpenSource-ядро, SaaS и коробочная поставка

Дата: 2026-09-18. Основание: пользователь уточнил необходимость **SaaS и установки на сервере заказчика**, а также **OpenSource базового модуля**. Это обязательные продуктовые направления плана. Рабочая трактовка «базового модуля» — ядро PBX/платформы; точный состав публичного дистрибутива и условия лицензий оформляются отдельным release manifest. Два AI-продукта остаются независимо коммерциализируемыми по исходному запросу. Закрытость их исходников этим документом не утверждается.

## 1. Разделить два измерения

Текущие `CLOUD/BOX/OPENSOURCE` смешивают deployment и права. Целевая модель:

```ts
type DeploymentKind = 'saas' | 'self_hosted';
type ProductEntitlements = {
  core: 'community';
  ai_voice_robots?: ProductLicense;
  speech_analytics?: ProductLicense;
};
```

Это пример будущего контракта, не существующие типы. User-facing editions собираются из deployment + entitlements, а не являются тремя независимыми code forks. Глобальное `mode !== CLOUD → all enabled` не применяется к новым коммерческим модулям.

| Поставка | Базовая платформа | AI-модули | Где данные и провайдеры |
|---|---|---|---|
| Community self-hosted | OpenSource, собирается и работает самостоятельно | Не обязательны; interfaces доступны для подключений | Сервер заказчика |
| SaaS | Общее ядро под управлением оператора платформы | Любой модуль/пакет, subscription + usage | Политика региона/storage и managed/BYOK AI |
| Commercial self-hosted | То же ядро на сервере заказчика | Лицензия каждого продукта отдельно | Локальные storage/jobs/ledger; local/BYOK/managed провайдер по настройке |
| Analytics-only self-hosted/SaaS | Identity/admin/product core без активированной PBX | Только аналитика | Нет обязательного Asterisk/ARI/AMI |
| Robots-only self-hosted/SaaS | Identity/admin/product core + SIP/media edge | Только роботы | Своя внешняя PBX подключается к edge, полный PBX-пакет не нужен |

SaaS и коробка — равноправные acceptance профили. Это не обещание air-gapped работы с облачной моделью: для полностью локального режима нужны выбранные и проверенные local STT/LLM/TTS или realtime providers.

## 2. Граница OpenSource-ядра

База включает текущую PBX-платформу в согласованном community scope, identity/RBAC/tenancy, shell и регистрацию модулей, публичные контракты recording/events/provider extensions. Точный перечень прежних КЦ/автообзвон/прочих функций сверяется с текущей коммерческой политикой, а не меняется этим AI-планом.

Новые общеиспользуемые улучшения ARI ownership, recording finalization, безопасного asset доступа и extension contracts не должны делать core зависимым от наличия коммерческого analytics/robots пакета. Профиль PBX-only не обязан запускать analytics queue/vector index/AI providers.

Общий каталог/credentials/capabilities providers и media interfaces выносятся в нейтральный core/connectivity модуль: текущие voicemail/ai-chat не должны зависеть от коммерческих robot sources через `AiAgentsModule`. AI-01/02 удаляют такие прямые зависимости, сохраняя compatibility facade и одно хранилище credentials. Gate — compile/start/tests community с отсутствующим commercial source tree.

Коммерческие домены — robot designer/runtime, analytics projects/metrics/reporting — подключаются через явные module contracts. Core build/test/install проходит при их отсутствии. Контроллеры/меню/cron/workers не импортируются безусловно из коммерческого пакета в открытое ядро. В SaaS могут быть установлены все пакеты, но server-side access определяется entitlement.

На первом техническом этапе допустим монорепозиторий с явными package boundaries; перед публичной поставкой нужен reproducible community build artifact без случайного включения коммерческих модулей/секретов. Не требуется заранее переносить всё в разные репозитории, но простой hidden menu не является границей OSS distribution.

В root package сейчас указан MIT; данный план **не изменяет лицензию существующего кода** и не выбирает новые юридические условия. Нужны inventory прав на переносимые фрагменты/зависимости и согласованный release manifest до публикации. Копирование кода aiPBX не требуется для использования описанных подходов.

## 3. Коробочная эксплуатация

Поддерживаемый первый профиль развёртывания фиксируется в AI-00: Linux server/container compose с воспроизводимыми версиями API, workers, **PostgreSQL или MySQL**, Redis, storage и SIP/media edge по выбранному набору. Выбор SQL engine обязателен для SaaS, self-hosted и community core; установке не нужны оба сервера одновременно. Это стартовое предложение платформы, не утверждение универсальной поддержки всех ОС. SaaS и коробка используют одинаковые domain contracts и логические migrations с проверенными dialect-specific реализациями. CDR, queue_log и Asterisk realtime включены в [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md); backup/restore и смена engine имеют отдельные процедуры.

Для self-hosted:

- Секреты и encryption root принадлежат установке. Резервное копирование включает необходимый key material по отдельной процедуре; без него encrypted provider credentials не восстановятся.
- Local filesystem/object storage adapter, локальные durable jobs, ledger и log/metrics. Подключение нашего облака не требуется для хранения/чтения/обработки при локальных providers.
- Исходящие подключения перечислены: выбранные providers, customer integrations, опциональные updates/managed services. Телеметрия и отправка transcript/audio в SaaS не включаются скрыто.
- Local providers проходят тот же capability/eval contract. Недостаточная мощность сервера отображается как capacity limitation, не маскируется автоматическим fallback в чужое облако.
- Installer/preflight: ports/TLS/volumes/disk, dependencies, migration plan, backup/restore, signed/checksummed artifacts, diagnostics. Upgrade: backup → expand schema → canary/health → worker drain → compatible cutover; rollback не удаляет accepted jobs/assets.
- PBX/audio workload изолирован от ffmpeg/LLM batch CPU. При local models GPU resources и concurrency описываются отдельно от capacity API/Redis.

## 4. Entitlements коробки

Предлагается подписанный license document, проверяемый локально по публичному ключу: installation/account binding, enabled products, edition/limits, validity, license schema version. Не хранить приватный ключ издателя в customer install. Ротация/renewal допускают импорт нового файла/документа без обязательного постоянного heartbeat.

Точная политика perpetual/subscription/grace/offline validity — бизнес-решение AI-00/10. До него UI/API отображают expiry/grace/pending понятными состояниями, а не обещают бессрочную работу или мгновенную online revocation. Offline installation не может узнать об отзыве без обновления лицензии/контакта; это свойство модели, которое отражается в коммерческих условиях.

Имеющиеся calls/jobs завершаются по установленной in-flight policy; expiry не удаляет данные и не отключает OpenSource core. Source access/root на customer server означает, что программные проверки не следует описывать как абсолютную DRM-защиту; акцент на корректном licensing contract, обновлениях и поддержке.

Legacy mappings переносятся отдельно: сохранить оплаченные права, не трактовать tenant0 как template, не открыть AI голосовой runtime по старой сценарной лицензии без явно согласованного migration mapping.

## 5. Биллинг и стоимость

| Сценарий | Лицензия/usage | Как отражать стоимость |
|---|---|---|
| SaaS + managed AI | Подписка и клиентский usage price book | Наш provider cost отдельно от customer charge; atomic reserves/settlement |
| SaaS + BYOK | Лицензия/сервисные units по тарифу | AI cost estimate помечен; прямые счета provider не списываются повторно нашим ledger |
| Self-hosted + local AI | Лицензия по выбранным лимитам; локальный metering | Local compute estimate/units, без фиктивного remote provider charge |
| Self-hosted + customer BYOK | Лицензия и локальный metering | Provider invoice оплачивает заказчик; не создавать дублирующий SaaS кошелёк |
| Self-hosted + наш managed AI | Отдельная явно включённая связь с managed service | Remote service возвращает authoritative usage/charge ID; reconcile с локальным usage без двойного debit |

Учёт единиц обязателен во всех режимах для диагностики/capacity/тарифа. Денежное списание зависит от billing policy; оно не включается автоматически потому, что runtime произвёл usage event. Self-hosted не должен открывать cloud subscription scheduler и делать сетевые списания при старте без настройки managed service.

Admission всегда проверяет лицензию и resource/concurrency quota. Денежный hold применяется только для фактически тарифицируемой операции. Self-hosted local/BYOK профиль не требует SaaS-аккаунта с положительным балансом; его проверяемая лицензия и локальные лимиты достаточны.

## 6. Gates и фазы

| ID | Gate | Где реализовать |
|---|---|---|
| DEP-01 | Community build/start/PBX smoke без AI пакетов и их обязательных workers | AI-01/02, повтор AI-11 |
| DEP-02 | SaaS: два tenant, отдельные SKU, no cross-tenant resources | AI-01/04/07/10/11 |
| DEP-03 | Self-hosted analytics-only: чистая установка, signup, API upload, результат без PBX schema/AMI/ARI | AI-01/02/04/10A/11A |
| DEP-04 | Self-hosted robots-only: SIP edge, versioned robot, record/playback без analytics entitlement | AI-03/07/08/10R/11R |
| DEP-05 | Подписанная лицензия: invalid/expired/wrong-install/renewal/key rotation; offline выбранный профиль | AI-01 contract, AI-10 implementation, AI-11 test |
| DEP-06 | Local/BYOK режим не передаёт audio/PII/telemetry нашему облаку без настройки | Provider spikes AI-00, AI-04/07/09/11 |
| DEP-07 | Backup→restore→upgrade→rollback с jobs/assets/keys/ledger | AI-02 storage contracts, AI-10 packaging, AI-11 drills |
| DEP-08 | SaaS/self-hosted одинаковая schema/event/API semantics и поддерживаемая version-skew policy | Все контракты, CI matrix AI-11 |

Минимальные automation fixtures могут использовать локальные fake providers. Для обещания полноценной локальной AI-работы нужен отдельный измеренный real-model профиль: STT quality, conversation latency, model/tools correctness и hardware sizing. Этот gate нельзя закрыть mock-ом.
