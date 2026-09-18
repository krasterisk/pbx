---
initiative: ai-products
phase: AI-00
status: planned
depends_on: []
autonomous_scope: local_analysis_and_test_fixtures
requirements: [PL-01, PL-02, PL-04, PL-12, PL-13, INT-03, INT-04, DBR-01, DBR-02, DBR-04]
---

# Первый исполняемый этап: подтверждение границ и критичных контрактов

Цель — подготовить foundation AI-01/02 с проверенными техническими решениями. Этот файл является планом следующей части работ. Он не утверждает, что live spikes или production fixes выполнены.

Пользователь выбрал параллельное развитие, SaaS и коробочную установку, OpenSource базового модуля. [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md) обязателен: community core без AI-пакетов, оба commercial deployment profiles, data boundaries и локальная проверка лицензии. Две продуктовые ветки получают общие contracts, не ждут завершения друг друга.

Пользователь также задал **PostgreSQL и MySQL на выбор установки**, включая CDR/queue_log/Asterisk. [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md) заменяет прежнее MySQL-only допущение. Параллельный первый implementation slice — [DB-01-PLAN](DB-01-PLAN.md); он может начаться без live PBX/AI keys. Полный SQL foundation DB-02 необходим для зависимых AI-01/02; Asterisk DB-03 проверяется отдельно до native PBX integration.

## Вход

- Все audit/spec/architecture документы этой инициативы и `.planning/CANONICAL_REFS.md`.
- Текущее рабочее дерево содержит изменения сторонних задач. Снимок начала аудита: `e7eba43f3b2c2e985f0e7647bd81d8a3a0fda9cd`, branch `main`; точный dirty list — `evidence/baseline-status.txt`.
- Документы aiPBX — `C:/Users/Professional/WebstormProjects/aiPBX`; backend фактически `C:/Users/Professional/WebstormProjects/aiPBX_backend`, подтверждён workspace config. Они остаются read-only источниками.

## Task 1. Baseline и инварианты

**Ownership:** coordinator; только docs инициативы и выделенные fixtures, не чужой текущий diff.

Действия:

1. Зафиксировать актуальный HEAD/dirty list и изменившиеся с момента аудита файлы ARI/auth/routes/ai-agents; использовать новые результаты вместо старых line numbers.
2. Сверить migration runner, текущую схему `cc_ai_agents`/providers/module entitlements на disposable MySQL; подготовить parity fixtures PostgreSQL, не считать переключатель ORM готовым портом. Tenant=0 BOX semantics одинаковы на обоих engines. Читать production credentials не требуется.
3. Записать compatibility matrix: scripted robot / existing ai-agent draft / PBX assistant / analytics-only / robot-only / current BOX/CLOUD.
4. Подтвердить proposed ADR-11: новые AI-модели используют attribute `user_uid` → physical `vpbx_user_uid` как текущие `cc_ai_*`; обновить canonical delta при реализации с учётом исторического расхождения frontend/backend docs. Нет unsafe default fallback, tenant 0 — реальный владелец.
5. Зафиксировать состав открытого ядра и optional commercial packages; проверить current CLOUD/BOX/OPENSOURCE mapping и предложить переход к deployment+entitlements. Не изменять existing MIT/права лицензий автоматически. Community build profile и signed local-license interface входят в foundation contract.
6. Сохранить ADR-13 и конкретный SQL inventory: hardcoded runner/driver, applied baseline, raw reports/JSON/date SQL, queue_log readers, Asterisk schema/config ownership. Согласовать DB-01 config interface и CI matrix; legacy MySQL history не переписывается. Две СУБД — требование, не открытый вопрос пользователю.

**Готово, когда:** известны scope изменения и migration compatibility; неподтверждённые данные явно отмечены. **Проверки:** три штатных npm checks; причины failures отделены от будущих изменений. Не исправлять весь unrelated lint backlog в этой фазе.

## Task 2. ARI ownership + media transport spike

**Предполагаемые места внутри backend modules:** `ari/ari-connection.service.ts`, `voice-robots/voice-robots.service.ts`, `autodial/autodial-originator.service.ts`, targeted contract fixtures в harness. Сначала тест маршрутизации событий, затем минимальная реализация dispatcher отдельным PR при подтверждении коллизии.

Acceptance fixture содержит одновременно: legacy numeric robot args, `autodial,...`, новый `ai-voice,...`, external media channel, неизвестный namespace. Каждое событие имеет одного владельца; scripted handler не hangup'ит чужой канал. Проверяется missing/mismatched tenant и disconnect cleanup.

На подготовленном Asterisk test node определить version/modules/ARI capabilities, codec frames, chan_websocket protocol и flush/backpressure. Один controlled echo/recording call, затем barge-in test; существующий RTP profile — comparator. Внешняя PBX не обязана иметь chan_websocket: capability нужна нашему media node.

**Выход:** `MEDIA-SPIKE.md`, сохранённые обезличенные captures/метрики и выбор первого transport profile. **Stop condition:** без стенда оставить live part pending; не выдавать unit routing за успешный voice runtime.

## Task 3. Recording finalization и channel truth spike

**Предполагаемые места:** `routes/route-recording.util.ts`, `routes.service.ts`, `shared/utils/dialplan-subroutines.util.ts`, recording fixture utility. Не менять действующий production dialplan во время исследования.

На controlled fixtures: separate left/right spoken markers, tone duration, mono, identical dual channels, truncated WAV, raw with explicit sample format. На test node: incoming/outgoing, IVR after Answer, robot, transfer, early hangup. Проверить D и доступный r/t fallback, recorder close/StopMixMonitor, actual sample rate, метаданные участника.

Смоделировать недоступность backend: local manifest survives, uploader повторяет регистрацию тем же ID. Показать detection collision текущего filename generator на двух одинаковых вызовах в одну секунду и будущий unique asset key.

**Выход:** `RECORDING-SPIKE.md`; fixture manifest schema; список точечных исправлений для AI-03; старый CDR MP3 compatibility test.

## Task 4. Provider + product-profile decision

**Ownership:** один researcher + reviewer; новые зависимости не устанавливать без проверки versions/peers по backend architecture.

1. Проверить capability contracts существующих `CcAiProvider`/STT/TTS engines; не предполагать, что указанная capability реализует transport. Записать mapping без копирования секретов.
2. Сравнить первый доступный managed/local профиль на одних RU samples: STT errors на телефонии, supported format/diarization, schema validity, latency/cost units; realtime interruptions/transfer отдельно. Платные вызовы только в согласованном test budget.
3. Изолировать analytics-only composition root prototype (без подключения AMI/ARI, PBX schema, billing cron). Проверить signup без автоматического `Context` provisioning.
4. Выбрать первый self-hosted hardware/OS/storage profile и local-model candidate; проверить отсутствие обязательного SaaS egress при local/BYOK режиме. Подготовить offline-license verification fixtures, install/backup key ownership contract. Deployment SaaS/self-hosted уже обязателен, конкретные характеристики требуют измерения.
5. Зафиксировать минимальные объёмы и продуктовые assumptions. Если владелец не выбрал провайдер/тариф, оставить decision pending, но contract tests и offline replay продолжаются.

**Выход:** `PROVIDER-MATRIX.md`, `DEPLOYMENT-PROFILES.md`, список решений для обсуждения только там, где действительно нужен бизнес-ответ.

## Завершение фазы

Создать `AI-00-SUMMARY.md` и `AI-00-VERIFICATION.md`: отдельно что прочитано, реализовано, проверено mock/integration/live, какие измерения и что осталось pending. Далее детализировать AI-01 до ограниченных PR/tasks с зависимостью от DB-02; отдельный DB-01 summary описывает результат database infrastructure, не завершённый PostgreSQL port. Не активировать новый milestone автоматически и не считать соседние production/autodial задачи закрытыми.

## Откат

Fixtures и документы обратимы. Если dispatcher будет исправлен отдельным slice, сохранить compatibility adapter numeric args и отдельный feature flag нового namespace. Сначала отключить новые admissions, затем вернуть handler routing; активные звонки не ронять перезапуском всех процессов ради отката.
