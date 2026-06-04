# Requirements — MOH playlist

- **REQ-001:** Новые MOH-классы с `mode=playlist`.
- **REQ-002:** Entries в `musiconhold_entry` с position и абсолютным entry path.
- **REQ-003:** Backend reject create без entries.
- **REQ-004:** Frontend block save при пустом playlist.
- **REQ-005:** Удалить MOH field из PromptUploadModal.
- **REQ-006:** Обновить `.docs/MOH_MODULE.md`.

---

## Phase 2 — MohPage redesign

- **REQ-101:** `/gsd-sketch` создаёт **3 сравниваемых варианта** MohPage (артефакты в `.planning/sketches/`).
- **REQ-102:** Пользователь выбирает один вариант; решение зафиксировано (`sketch --wrap-up`, UI-SPEC).
- **REQ-103:** Реализация только **победившего** варианта в `MohPage.tsx` (+ минимально нужные правки `MohTable` wrapper/states).
- **REQ-104:** Соответствие `packages/frontend/.idea/ARCHITECTURE.md` (FSD, shadcn, Stack, без лишних `div`-layout).
- **REQ-105:** Responsive + i18n для всех видимых строк на странице.
- **REQ-106:** Без изменений backend/API MOH в этой фазе.

---

## Phase 3 — IVR page & form modal UI alignment

- **REQ-201:** `IvrFormModal` — таб-бар как `RouteFormModal` (одна граница под табами, SCSS + `var(--color-*)`, без дублирующих Tailwind border на кнопках).
- **REQ-202:** Вкладка «Записи» (`IvrPromptsEditor`) — контрастная секция, элементы не сливаются с фоном модалки (токены дизайн-системы).
- **REQ-203:** `IvrsPage` — layout/стили через SCSS-модуль, паттерн страницы как MohPage (header, CTA, контейнер таблицы).
- **REQ-204:** Соответствие `packages/frontend/.idea/ARCHITECTURE.md` (FSD, `shared/ui`, Stack, без Tailwind в `pages/`/`features/`).
- **REQ-205:** i18n `ru` + `en` для новых/изменённых строк; без em dash в UI-текстах.
- **REQ-206:** Без изменений backend/API IVR; функциональность create/edit/copy и редакторов сохранена.

## Phase 4 — IVR TTS phrases

- **REQ-301:** Вкладка «Фразы» поддерживает добавление **TTS-текста** и **аудиозаписи** в одном упорядоченном списке.
- **REQ-302:** Каждая TTS-фраза ссылается на **TTS-движок** (`tts_engines`, tenant-scoped) из справочника TtsEnginesPage.
- **REQ-303:** Для каждой TTS-фразы задаются **per-phrase overrides** голоса/параметров (merge поверх `engine.settings`), не только глобальные настройки движка.
- **REQ-304:** Backend генерирует dialplan с **runtime TTS** (синтез в момент звонка через AGI/сервис), merge engine + per-phrase settings; порядок фраз сохраняется.
- **REQ-305:** `prompts` — только JSON `IIvrPhrase[]`; legacy `string[]` и `tts:…` удалены (миграция данных — в scope плана, не вечная поддержка).
- **REQ-305b:** TTS-фразы **не** создают WAV и **не** добавляются в каталог Prompts.
- **REQ-306:** Shared types + валидация DTO create/update IVR для union `audio | tts`.
- **REQ-307:** i18n `ru` + `en` для UI TTS-режима; ARCHITECTURE (FSD, SCSS, `shared/ui`).
- **REQ-308:** Ошибки синтеза/сохранения видны пользователю (не только `console.error`).
- **REQ-309:** Unit/integration tests: парсинг prompts, dialplan lines, editor state (минимум).
- **REQ-310:** Документировать контракт в `.docs/IVR_MODULE.md` или дополнение MOH/IVR docs.
