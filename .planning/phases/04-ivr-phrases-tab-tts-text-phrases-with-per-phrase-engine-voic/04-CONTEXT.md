# Phase 4: IVR TTS phrases — Context

**Gathered:** 2026-06-04  
**Status:** Ready for planning

<domain>
## Phase Boundary

На вкладке **«Фразы»** (`IvrPromptsEditor`) пользователь собирает упорядоченный список фраз IVR:

- **Аудио** — файл из справочника Prompts (как сейчас).
- **TTS** — текст + выбранный движок из `tts_engines` + **per-phrase** параметры голоса/скорости (как у типа движка в `TtsEngineFormModal`).

При звонке TTS-фразы **синтезируются в runtime** в dialplan (без предварительной записи WAV в sounds). Аудио-фразы — `Background` как сейчас.

**In scope:** JSON-модель `prompts`, UI редактор, runtime dialplan + AGI/мост к синтезу, preview в UI, все типы движков (yandex/google/custom), типы shared, i18n, тесты.

**Out of scope:** Создание WAV/SFTP-файлов для TTS; запись TTS в справочник Prompts; редизайн `TtsEnginesPage`; streaming-роботы.
</domain>

<decisions>
## Implementation Decisions

### Синтез и dialplan (D-01)
- **D-01:** **Runtime only** — синтез в момент звонка, **не** materialize при save IVR.
- **D-02:** **Не создавать WAV** и не добавлять TTS-фразы в каталог Prompts; в dialplan только вызов runtime-синтеза (AGI или эквивалент), затем воспроизведение в канале.
- **D-03:** Убрать поддержку legacy `string[]` и префикса `tts:` в новом контракте; **`prompts` хранится как JSON-массив объектов** (`IIvrPhrase[]`). Миграция существующих IVR при load/save — отдельная задача плана (одноразовый normalize или admin script); пользователь принял отказ от старого формата.

### Модель данных (D-04)
- **D-04:** Discriminated union в `@krasterisk/shared`:
  ```ts
  type IIvrPhrase =
    | { kind: 'audio'; filename: string }
    | {
        kind: 'tts';
        text: string;
        engine_uid: number;
        /** Per-phrase overrides; merge поверх tts_engines.settings */
        settings?: {
          voice?: string;      // yandex: voice; google: voice_name
          speed?: string | number;
          role?: string;       // yandex emotion/role
          pitch_shift?: string;
          language_code?: string; // google
          speaking_rate?: string;
        };
      };
  ```
- **D-05:** Sequelize `ivr.prompts` остаётся `JSON`, тип в API/DTO — `IIvrPhrase[]` only.

### Per-phrase голос (D-06)
- **D-06:** На каждой TTS-фразе редактируются **голос и скорость** (и прочие поля **по типу движка**, как в `TtsEngineFormModal`): если override пуст — берутся значения из `engine.settings`.
- **D-07:** Движок выбирается **на фразу** (`engine_uid`), не один на весь IVR.

### Preview (D-08)
- **D-08:** **Да** — кнопка «Прослушать» на TTS-фразе в редакторе до сохранения IVR.
- **D-09:** Backend endpoint preview (напр. `POST /ivrs/tts-preview` или `/tts-engines/synthesize`) — tenant-scoped, merge engine + phrase settings, отдаёт аудио (stream/blob) для `<audio>` или существующего player-паттерна проекта.

### Поддерживаемые движки (D-10)
- **D-10:** **Все типы** из `tts_engines`: `yandex`, `google`, `custom` (как на `TtsEnginesPage`).
- **D-11:** Расширить/вынести TTS-синтез для IVR: сейчас `TtsProviderFactory` в voice-robots **только Yandex**; в фазе **обязательно** реализовать провайдеры Google и custom HTTP (или общий `IvrTtsService`), иначе D-10 не выполнен.

### UI «Фразы» (D-12)
- **D-12:** Список: бейдж **Аудио** / **TTS**; TTS — превью текста, имя движка, кратко voice/speed override.
- **D-13:** Добавление: переключатель **Запись | TTS**; TTS — `Textarea`, `Select` движка (`useGetTtsEnginesQuery`), блок параметров (поля зависят от `engine.type`), **Preview**, Add.
- **D-14:** Сохранить SCSS/паттерн Phase 3 (`sectionPanel`, `Button`, `var(--color-*)`).

### Dialplan generation (D-15)
- **D-15:** Для `kind: 'audio'` — без изменений: `Background(/usr/records/{vpbxUserUid}/sounds/{filename})`.
- **D-16:** Для `kind: 'tts'` — строка dialplan вызывает runtime TTS с `engine_uid`, `text`, merged settings (формат уточнит research: новый AGI `ivr_tts.php` / доработка `say_bg.php` / параметры в AGI). **Не** `tts:` prefix, **не** путь к файлу.

### Claude's Discretion
- Точный формат AGI-аргументов и безопасное экранирование текста в dialplan.
- Стратегия миграции старых `prompts: string[]` в БД (авто при открытии модалки vs fail validation).
- Размещение preview endpoint (ivrs module vs tts-engines vs prompts).
- Google/custom TTS implementation detail (REST vs existing stubs).

### Areas not discussed (defaults)
- Ошибки preview/save — toast/inline (REQ-308).
- Документация `.docs/IVR_MODULE.md` (REQ-310).
</decisions>

<specifics>
## Specific Ideas

- Пользователь явно отверг сценарий с WAV: «какие wav файлы? не надо их создавать, это же будет синтез realtime в dialplan».
- Per-phrase voice/speed как в настройках движка, не глобально на движок для всего меню.
</specifics>

<canonical_refs>
## Canonical References

### Architecture & planning
- `packages/frontend/.idea/ARCHITECTURE.md`
- `packages/backend/.idea/ARCHITECTURE.md`
- `.planning/ROADMAP.md` — Phase 4
- `.planning/REQUIREMENTS.md` — REQ-301 … REQ-310
- `.planning/phases/03-refactor-ivrspage-and-ivrformmodal-align-with-project-archit/03-CONTEXT.md` — UI «Фразы» (D-12…D-14)

### Code — IVR & UI
- `packages/frontend/src/features/ivrs/ui/IvrPromptsEditor/IvrPromptsEditor.tsx`
- `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx`
- `packages/frontend/src/features/tts-engines/ui/TtsEngineFormModal/TtsEngineFormModal.tsx` — поля voice/speed по type
- `packages/frontend/src/pages/TtsEnginesPage/TtsEnginesPage.tsx`

### Code — Backend
- `packages/backend/src/modules/ivrs/ivrs.service.ts` — генерация dialplan (переписать ветку prompts)
- `packages/backend/src/modules/ivrs/ivr.model.ts` — `prompts` JSON
- `packages/backend/src/modules/tts-engines/` — CRUD + загрузка engine для синтеза
- `packages/backend/src/modules/voice-robots/providers/provider-factory.ts` — `TtsProviderFactory` (Yandex; Google/custom — gap)
- `packages/backend/src/shared/utils/dialplan.util.ts` — `text2speech` → `AGI(say.php,…)` (эталон runtime TTS в маршрутах)

### Phase draft (superseded where conflicts)
- `.planning/phases/04-ivr-phrases-tab-tts-text-phrases-with-per-phrase-engine-voic/PHASE.md` — materialize вариант A **отменён** решением D-01
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TtsEngineFormModal` — матрица полей по `type` (google/yandex/custom) для per-phrase UI.
- `TtsProviderFactory.synthesize` / `synthesizeBatch` — Yandex streaming/batch PCM.
- `useGetTtsEnginesQuery` — список движков tenant-scoped.
- `IvrPromptsEditor` — reorder, audio select; расширить под TTS + preview.

### Established Patterns
- IVR `prompts` сейчас `string[]` в UI; backend legacy `tts:` + `say_bg.php`.
- Route action `text2speech` использует `AGI(say.php,"text")` без engine_uid — IVR должен богаче (engine + settings).
- Tenant isolation: `req.user.vpbx_user_uid` на backend; движки с `user_uid`.

### Integration Points / Gaps
- **Gap:** `TtsProviderFactory` — Google/custom TTS not implemented (только warn/error).
- **Gap:** `POST /prompts/synthesize` — stub, не использовать для IVR preview без доработки.
- **Research must:** как `say_bg.php` / `say.php` на Asterisk принимают параметры и можно ли передать engine id + JSON settings.
</code_context>

<deferred>
## Deferred Ideas

- Materialize TTS в sounds + `Background` — отклонено пользователем (runtime only).
- Запись TTS-фраз в справочник Prompts — не нужно (D-02).
- Legacy `tts:текст` в dialplan — удалить из нового контракта (D-03).

</deferred>

---

*Phase: 04-ivr-phrases-tab-tts-text-phrases-with-per-phrase-engine-voic*  
*Context gathered: 2026-06-04*
