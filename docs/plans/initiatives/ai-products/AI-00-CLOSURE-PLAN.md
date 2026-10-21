---
initiative: ai-products
phase: AI-00
revision: 2026-09-18-r1
status: planned_open_gates
tasks: [G1, G2, G3]
---

# AI-00 — закрытие оставшихся проверок

Дополнение к [AI-00-PLAN](AI-00-PLAN.md), не новая фаза. Исследовательский документ или unit test helper не заменяет live/fixture gate. [IMPLEMENTATION-SEQUENCE](IMPLEMENTATION-SEQUENCE.md) содержит актуальную оценку code readiness. Текущий запрос на проектирование не запускает эти проверки.

## G1 — ownership ARI и корректный rollout

**Owned paths при назначении:** `ari/ari-app-name.ts`, `ari-connection.service.ts`, `ari-http-client.service.ts`, bounded `voice-robots.service.ts` / `autodial-originator.service.ts` handlers и tests, `.env.example` только с сохранением исходной кодировки, disposable harness. Один owner shared ARI/autodial; отдельной соседней задачи сейчас пользователь не требует. Архивные запреты scope не переиспользовать.

Один логический Stasis app **на семейство сервиса и installation namespace**: scripted, autodial, позднее AI voice. Ни на кампанию, ни на tenant отдельное приложение не создаётся. Один event socket подписывается на набор своих app names. Tenant/campaign/session — в проверенной server correlation, не в имени приложения как механизме авторизации.

1. Проверить default/custom scripted name и новый fixed autodial default: dev/prod, подключённые к одному Asterisk, не должны столкнуться на `krasterisk_autodial`. Явный installation namespace для нового deployment; legacy scripted default сохранить. При custom scripted name без explicit autodial setting — безопасно выведенное distinct имя либо startup error с требованием настройки, не общий global fallback. Алгоритм и конфигурационный precedence закрепить tests до rollout.
2. URL credentials/query строить безопасным API/encoding; никогда не логировать URL с user/password. Password с `@:&?/%` должен работать и не утечь. Изменения transport auth сверить с реальным Asterisk на disposable стенде.
3. Pure classifier по application+namespace+channel role; current broad `ari.*` broadcast не считать isolation. Channel-ID prefix сам по себе не authorizes handler. Unknown/mismatched events не вызывают hangup/answer. Только owner делает cleanup своего channel.
4. Atomic in-process session claim до первого await; повтор StasisStart не запускает два сценария. Для HA за одним app требуется отдельный validated owner/lease topology; не обещать active-active из двух websocket subscribers.
5. `ApplicationReplaced` переводит affected app readiness в unavailable, прекращает originates этого owner; один connected socket не означает готовность всех apps. Reconnect backoff, новые channel admissions только после registration readiness. Existing sessions reconciliation, не бесконечная борьба двух subscribers.
6. Rollout: preflight names/subscribers → stop new originates → drain текущие calls → обновить config/dialplan/backend согласованно → live probes → resume. Rollback сохраняет управление оставшимися channels; не переименовывать app посреди разговора.

**Приёмка:** scripted numeric/namespace fixtures, old/new autodial args, unknown app, foreign prefix, external-media/Snoop, double event, reconnect/ApplicationReplaced; параллельно две кампании используют один autodial app без конфликта. Remote live node с двумя installation namespaces, остановка одного consumer не завершает чужие calls. Будущий AI voice owner только no-op test admission до AI-07, не объявлять executor готовым.

## G2 — доказуемая finalization записи

**Owned paths при назначении:** generated recording fixtures/harness, recording utilities tests и research docs; правки `routes.service.ts`/dialplan только отдельный bounded assignment после probe. Capture production implementation — AI-03.

Исправление прежней формулировки: выполнение ffmpeg в hangup **не гарантирует** закрытие MixMonitor и успешную конвертацию. В просмотренном handler нет явного StopMixMonitor и проверки conversion exit code перед webhook. Сначала проверить semantics на выбранном Asterisk; после закрытия recorder → successful probe → durable manifest, и лишь затем ready. `CDR(record)` остаётся playback reference, не evidence readiness.

Создать mono/stereo L/R marker, identical dual, silent, truncated WAV и raw без format metadata; manifest SHA-256, expected duration/channels/sample format. Проверить inward/outward, early hangup, transfer, robot без bridge, `b`/`record_all`; одновременные calls в одну секунду не делят asset ID. Различать probe-ready и качество speech; frame/channels не назначают автоматически роли operator/customer.

Negative: ffmpeg error/timeout, disk full, file still open, API unavailable, duplicate finalization; webhook не даёт fake-ready. Не удалять original до подтверждения durable derivative/manifest. Зафиксировать возможности `D`/`r,t`, формат, роли и fallback на реальном стенде; документация сама по себе не закрывает channel truth.

**Приёмка:** fixtures и actual probe evidence, результаты controlled calls, отсутствие PII/production recordings. Никаких STT/LLM в hangup. Existing MP3 playback regression. G2 специфицирует итог для AI-03, не закрывает spool pipeline до его реализации.

## G3 — сверка gates перед полным AI-01/02 acceptance

**Owned paths:** verification/evidence индекс инициативы; исправления DB/autodial только новым assigned task из DB-02.

- Проверить DB-02-D2 actual evidence и D1 final matrix, затем E independent review и full checks. Прежняя фраза «принадлежит другой задаче» больше не блокирует пользователя, но не является evidence прохождения.
- Отделить AI-00 provider inventory от real compatibility/eval: credential/budget и набор synthetic consented corpus утверждаются до платных calls. Без них deterministic adapter fixtures разрешены, live provider gate pending.
- Снять deployment profiles/recording/ARI capability версий со disposable узла; проверить согласованность [PROVIDER-MATRIX](PROVIDER-MATRIX.md) и [DEPLOYMENT-PROFILES](DEPLOYMENT-PROFILES.md) с измеренными результатами.
- SUMMARY/VERIFICATION содержит для каждой проверки команду, exit code, log path, source revision и ограничения. Исторические «13/22 tests passed» не переименовывать в новый проверенный результат.

Тестовый сервер — только `root@ipbx.krasterisk.ru`, disposable resources и явный cleanup своего namespace. Local Docker запрещён. Незакрытый live gate не мешает детальному проектированию, но не даёт права объявить production-ready ARI/media или оба AI-продукта.
