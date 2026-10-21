# Phase 4 — IVR TTS phrases (draft)

> **Superseded by `04-CONTEXT.md`** (discuss 2026-06-04). Runtime TTS in dialplan, JSON-only, no WAV.

## Проблема

- UI «Фразы» (`IvrPromptsEditor`) добавляет только **filename** из справочника Prompts.
- Backend уже понимает legacy `tts:текст` → `AGI(say_bg.php,…)` в `ivrs.service.ts`, но UI это не отдаёт.
- `POST /prompts/synthesize` — заглушка; `TtsProviderFactory` реализован для voice-robots (Yandex stream/batch).

## Целевое поведение

1. Пользователь на вкладке «Фразы» добавляет элемент типа **Аудио** (как сейчас) или **TTS**.
2. Для TTS: текст + выбор **движка** (`tts_engines.uid`) + **override** параметров (voice, speed, role/pitch — по `engine.type`).
3. Defaults берутся из `engine.settings`; override только на этой фразе.
4. При сохранении IVR фразы попадают в dialplan и воспроизводятся в порядке списка.

## Предлагаемая модель данных (`prompts` JSON)

```ts
// packages/shared — IIvrPhrase
type IIvrPhrase =
  | { kind: 'audio'; filename: string }
  | {
      kind: 'tts';
      text: string;
      engine_uid: number;
      /** Per-phrase overrides; merged over engine.settings at synthesis time */
      voice?: Record<string, unknown>;
    };

// Stored in ivr.prompts: (string | IIvrPhrase)[] for backward compat
// Legacy: plain string = audio filename; "tts:hello" = migrate on read to kind:'tts' without engine (pick default engine or block save)
```

## Синтез (рекомендация для discuss)

| Вариант | Описание | Плюсы | Минусы |
|--------|----------|-------|--------|
| **A. Materialize on save** | При save IVR: для каждой TTS-фразы `TtsProviderFactory.synthesizeBatch` → WAV/GSM → upload в `/usr/records/{tenant}/sounds/` → в dialplan только `Background(file)` | Совместимо с текущим Asterisk, без AGI в рантайме | Нужен upload pipeline; смена текста = пересинтез |
| **B. Runtime AGI/API** | Dialplan вызывает Nest/AGI с `engine_uid` + text + overrides | Актуальный текст без файла | Latency, новый AGI, отказ при недоступности API |

**Default для планирования:** вариант **A**, с опциональным `POST /ivrs/preview-tts` для прослушивания в UI.

## Dialplan

- Audio: без изменений — `Background(/usr/records/{uid}/sounds/{filename})`.
- TTS materialized: тот же `Background` на сгенерированный файл (`ivr_tts_{ivrUid}_{phraseIndex}.wav` или hash).
- Legacy `tts:` — миграция при load или поддержка до удаления.

## UI (IvrPromptsEditor)

- Список: бейдж «Аудио» / «TTS», для TTS — превью текста + имя движка + кратко voice override.
- Add row: toggle Audio | TTS; TTS → Textarea + Select engine (`useGetTtsEnginesQuery`) + collapsible «Параметры голоса» (поля по type, как в `TtsEngineFormModal`).
- Кнопка «Прослушать» (если endpoint preview) — optional wave 2.

## Зависимости

- Движки настроены на `/tts-engines`.
- Phase 3 — визуальная оболочка вкладки «Фразы».

## Открытые вопросы (discuss)

1. Materialize vs runtime?
2. Default engine если legacy `tts:` без `engine_uid`?
3. Google TTS в factory — реализовать в фазе или только Yandex?
4. Удаление старых сгенерированных файлов при изменении/удалении фразы?
