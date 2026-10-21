# AI-00 — исследование ARI application routing

**Статус:** исследование завершено; bounded separation slice implemented and unit-tested. Live Asterisk spike ещё не выполнен. **Дата:** 2026-09-18.

## Что происходит сейчас

| Поверхность | Фактическое поведение | Риск |
|---|---|---|
| `AriHttpClientService` | Один `ARI_APP_NAME`, по умолчанию `krasterisk_voicerobots` | Все вызовы, которые создают Stasis channel, получают один application namespace |
| `AriConnectionService` | Один WebSocket `/ari/events?...&app=<one app>` | Один процесс получает события разнородных session types без transport-level separation |
| Сценарные роботы | Dialplan генерирует `Stasis(krasterisk_voicerobots,<numeric robot uid>)` | Обработчик воспринимает numeric arg как свою сущность и при malformed event может завершить channel |
| Автообзвон | `originateChannel(... app: getAppName(), appArgs: autodial,<campaign>,<task>)` | Автообзвон намеренно разделяет тот же app; защита строится на `ac-` channel-id prefix и порядке обработчиков |

Текущая защита `VoiceRobotsService.handleStasisStart()` уже пропускает `ac-*`, а `AutodialOriginatorService` обрабатывает только `ac-*`. Это снижает текущий конфликт, но не создаёт проверяемого ownership contract для future AI-voice, external-media и unknown namespaces. В частности, непонятный event общего приложения проходит в сценарный handler, где отсутствие numeric robot UID может вызвать hangup.

## Рекомендованное направление

Использовать **отдельные логические Stasis application names**, но оставить **один `AriConnectionService` WebSocket**, подписанный на их comma-separated list:

| Owner | Application name | Args contract |
|---|---|---|
| Existing scripted robots | `krasterisk_voicerobots` (сохранить как legacy default) | Legacy `<robotUid>`; new writes only after dispatcher migration may use `scripted-v1,<robotUid>` |
| Autodial | `krasterisk_autodial` | `autodial-v1,<campaignUid>,<taskUid>`; temporary parser accepts existing `autodial,...` |
| Future AI voice robots | `krasterisk_ai_voice` | `ai-voice-v1,<opaque dispatch ticket>` |
| External media second legs | Same application as the owning primary channel | Opaque parent/session correlation only; never a standalone robot argument |

The Asterisk documentation permits multiple ARI applications on one instance, with each app controlling only its own channels. It also documents an inbound WebSocket subscription using a comma-separated app list. A given application must have one serving WebSocket; opening competing connections to the same app replaces the older subscriber. Therefore application separation is preferable to a broadcast of mutable event consumers, while multiple independent WebSockets for one app are not.

## Required bounded implementation plan

This is a **planned research item**, not a code edit in this task:

1. Add an application-name resolver that exposes the three names, validates them and preserves the legacy default.
2. Change the event WebSocket builder to subscribe to the explicit set of enabled names, once. Add unit tests for URL encoding, deduplication and legacy single-name compatibility.
3. Make each call origin explicitly name its owner application. Keep `getAppName()` only as a deprecated scripted-robot compatibility facade until all callers migrate.
4. Add a pure routing classifier for `application`, args namespace, channel kind and correlation. Unknown/mismatched input is logged and left untouched; it must never cause a handler-owned hangup.
5. Add fixtures covering scripted numeric args, old/new autodial args, `ai-voice-v1`, external media, Snoop, missing tenant and duplicate events. No handler may accept another owner's fixture.
6. Run a controlled live Asterisk node test: two active app names, scripted + autodial calls, disconnect/reconnect, and a new AI-voice no-op admission. Verify that no `ApplicationReplaced` occurs and every channel has one owner.

### Implemented first slice

- `AriHttpClientService` resolves distinct scripted and autodial names, rejects duplicate configuration and exposes the one event-app list.
- `AriConnectionService` subscribes one inbound WebSocket to the two comma-separated names.
- `AutodialOriginatorService` now originates every campaign through `krasterisk_autodial` (or `ARI_AUTODIAL_APP_NAME`) with `autodial-v1,<campaignUid>,<taskUid>`. This is one application per service, never an application per campaign, tenant or call.
- Existing scripted robot calls retain the `krasterisk_voicerobots` default and their legacy numeric args.
- Targeted regression suite: 13 tests passed; backend build and lint passed. No live Asterisk or external provider was used.

The remaining classifier, the `ai-voice-v1` owner and the controlled node test are later Task 2 work. They are deliberately not claimed by this small configuration migration.

The dispatcher does **not** need a new ARI application per worker or per tenant. It owns classification inside the backend. The application name is a session-family boundary; tenant remains a server-derived authorization property.

## Open evidence required

- Test-node Asterisk version and `res_ari`/media module capabilities.
- Whether the installed version accepts the comma-separated inbound `app` query list exactly as documented.
- Existing dialplan deployment/reload ordering and rollback: the old scripted name is retained; autodial moves only with its regression fixtures.
- AI-voice transport choice (`chan_websocket` or tested RTP fallback) remains a separate media spike.

## Sources

- Current source: `packages/backend/src/modules/ari/ari-app-name.ts`, `ari-http-client.service.ts`, `ari-connection.service.ts`, `voice-robots.service.ts`, `autodial-originator.service.ts`.
- [Asterisk ARI configuration](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-REST-Interface-ARI/Asterisk-Configuration-for-ARI/) — separate Stasis applications and channel ownership.
- [Asterisk ARI outbound websocket documentation](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-REST-Interface-ARI/ARI-Outbound-Websockets/) — comma-separated application sets and one connection serving an application.
- [Asterisk REST data models](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/Asterisk_REST_Data_Models/) — a newer WebSocket replaces an existing subscriber for the same application.
