# Phase 13: Custom voicemail instead of VoiceMail - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 13-custom-voicemail-instead-of-voicemail
**Areas discussed:** STT/LLM trigger, attachment vs link, retries, format and storage

---

## STT/LLM trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Очередь / сканер pending | Handler пишет файл + строку; воркер забирает | ✓ |
| Inline в hangup_handler | STT/LLM в том же завершении | |
| Гибрид Bull/очередь Nest | Новая инфра | |

**User's choice:** очередь / сканер по `status=pending`
**Follow-up:** notify сразу из handler, не ждать STT; не two-shot notify.
**Follow-up:** Nest `@Interval`, не `setImmediate`.
**Follow-up:** STT опционален — файл + notify достаточно, «расшифровка не настроена».

---

## Attachment vs link

| Option | Description | Selected |
|--------|-------------|----------|
| По размеру (байты) | Telegram/email лимитят размер | ✓ |
| По длительности | Проще в UI | |
| Всегда ссылка | | |
| Всегда вложение | | |

**User's choice:** байты, порог **2 МБ**.
**Follow-up:** провайдер отверг вложение → сразу ссылка тем же каналом.
**Follow-up:** TTL токена **7 дней** (`cc_display_tokens`, не cdr-public).

---

## Retries

| Option | Description | Selected |
|--------|-------------|----------|
| 3 попытки notify + fail status | Файл остаётся | ✓ |
| 5 попыток | | |
| Пока не уйдёт | | |

**User's choice:** 3 попытки notify → `notify_failed`; видно только в CDR.
**Follow-up:** STT 3 попытки → `ready` без текста + «расшифровка не удалась».
**Follow-up:** backoff ~1 / 4 / 10 мин.

---

## Format and storage

| Option | Description | Selected |
|--------|-------------|----------|
| wav | Research; parseWavPcm16 по чанкам | ✓ |
| sln | | |

**User's choice:** wav; тот же том + `voicemail/`; retention как у записей разговоров; дефолт Record **120 сек**.

---

## Claude's Discretion

Пользователь нигде не выбрал «реши сам» — все рекомендации приняты явно. В CONTEXT оставлена свобода по периоду `@Interval`, именам колонок и Telegram document vs audio.

## Deferred Ideas

- Phase 14: flowchart / MCP / D-46 / D-48 / D-50
- MWI / VoiceMailMain
- Отдельный retention или BullMQ
