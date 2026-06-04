# Phase 4: IVR TTS phrases — Discussion Log

> Audit trail only. Decisions: `04-CONTEXT.md`.

**Date:** 2026-06-04  
**Phase:** 04-ivr-phrases-tab-tts-text-phrases-with-per-phrase-engine-voic  
**Areas discussed:** Синтез, модель данных, UI голоса, preview, движки, файлы

---

## 1. Когда синтезировать

| Option | Description | Selected |
|--------|-------------|----------|
| Materialize on save | WAV в sounds, dialplan `Background` | |
| Runtime в звонке | AGI/API при прохождении IVR | ✓ |

**User's choice:** Синтез в момент звонка.  
**Notes:** WAV не создавать.

---

## 2. Модель данных и legacy

| Option | Description | Selected |
|--------|-------------|----------|
| Backward compat `string[]` + `tts:` | Постепенная миграция | |
| JSON-only `IIvrPhrase[]` | Убрать старый формат | ✓ |

**User's choice:** Старый формат убираем, делаем в json.

---

## 3. UI параметров голоса

| Option | Description | Selected |
|--------|-------------|----------|
| Минимальный набор полей | Только text + engine | |
| Как в движке | voice, speed (+ type-specific) | ✓ |

**User's choice:** Голос и скорость, как в движке (per-phrase override).

---

## 4. Preview

| Option | Description | Selected |
|--------|-------------|----------|
| Без preview в фазе | Только после save / звонок | |
| Кнопка «Прослушать» | Endpoint + player в UI | ✓ |

**User's choice:** Да, давай сделаем возможность прослушки.

---

## 5. Движки

| Option | Description | Selected |
|--------|-------------|----------|
| Yandex only (MVP) | Как сейчас в factory | |
| Все типы | yandex, google, custom | ✓ |

**User's choice:** Все движки.

---

## 6. WAV / Prompts catalog

| Option | Description | Selected |
|--------|-------------|----------|
| Materialize WAV + Prompts row | Как в старом draft PHASE.md | |
| Нет файлов | Realtime в dialplan | ✓ |

**User's choice:** «Какие wav файлы? не надо их создавать, это же будет синтез realtime в dialplan».

---

## Claude's Discretion

- Формат AGI-вызова, миграция БД, реализация Google/custom TTS.

## Deferred Ideas

- Materialize-on-save pipeline (отклонено).
