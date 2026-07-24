# Phase 10 — Full Softphone (ТЗ / Brief)

> Product brief for the dedicated softphone phase.
> Seeded from Phase 9 ARM layout feedback (journal + contacts + docked chrome).
> Roadmap entry prepared — next: `/gsd-discuss-phase 10`.

---

## Goal

Сделать **полнофункциональный WebRTC-софтфон** отдельным продуктовым контуром внутри АРМ оператора: набор, журнал, контакты (абоненты / очереди / группы), управление вызовом и качеством связи — без плавающего FAB, перекрывающего UI.

## Why a separate phase

Phase 9 закрыла АРМ (статус-бар, вкладки, KPI, missed, call-control). Софтфон там — минимальный виджет (dialpad + answer/hangup). Журнал и справочник контактов по объёму равны отдельной фазе (данные, права, UX, offline/reconnect).

## In scope

### Shell / chrome
- Софтфон **вшит в chrome** АРМ (status strip / header), не FAB и не настраиваемое «placement» в углах экрана.
- Состояния: collapsed trigger · expanded panel · mobile sticky + sheet.
- Единый источник правды по активному вызову с status-bar call controls (без дублирования логики).

### Tabs inside softphone
1. **Dial** — dialpad, click-to-call bridge, DTMF in-call, redial last.
2. **Journal** — личный журнал звонков оператора (in/out/missed), фильтры смена/сутки, callback, открытие карточки звонка.
3. **Contacts** — единый каталог:
   - абоненты (endpoints / phonebook),
   - очереди,
   - группы (ring groups / dial groups),
   - BLF presence где доступно,
   - поиск + недавно использованные.

### Call features (professional softphone baseline)
- Mute / Hold / Transfer (blind + attended) / Conference add
- Park / retrieve (если роль разрешает)
- Call quality indicator (MOS / jitter / RTT / loss) + degraded UX
- Device picker (mic/speaker) без перелогина смены
- Auto-answer + zip tone (уже есть — довести до parity с softphone UX)

### Resilience
- Переподключение WSS / re-REGISTER после рестарта backend / Asterisk без потери смены
- Явный UI «регистрируюсь… / offline» в trigger софтфона
- Сохранение dial buffer / last number в sessionStorage

## Out of scope (later)
- Video softphone
- Embedded CRM screen-pop beyond existing CallCard
- Multi-line / multi-call UI (park + switch) — только если появится в discuss
- Native mobile app softphone (Capacitor) — отдельный трек

## Dependencies
- Phase 9 agent panel (chrome, KPI, TransferDirectory, history API)
- Existing `useWebRTCPhone` + PJSIP WSS
- Transfer directory / BLF from Phase 9 backend
- Operator call history API (`getOperatorCallHistory`)

## Success criteria (draft)
1. Оператор набирает, принимает и переводит звонок **только из softphone chrome** — FAB нигде не перекрывает таблицы.
2. Вкладки Journal и Contacts показывают реальные данные (не placeholder).
3. После F5 / смены вкладки / краткого рестарта backend смена и регистрация WebRTC восстанавливаются без повторного «Start shift», либо с одной явной кнопкой Recover.
4. Контакты: поиск ≤300ms perceived; click-to-call ≤1 клик от строки.
5. i18n ru/en; a11y: keyboard dial + ARIA tabs.

## Seed already in codebase (Phase 9 layout pass)
- `SoftphoneWidget` `variant="chrome"` + tabs Dial / Journal / Contacts (Journal/Contacts = placeholders)
- Softphone placement removed from «Моя панель»
- Status-bar hosts softphone trigger alongside missed/chat

## Next GSD steps
1. `/gsd-discuss-phase 10` — зафиксировать D-XX (journal source, contact sources, multi-call, quality metrics MVP)
2. `/gsd-ui-phase 10` — UI-SPEC softphone surfaces (Dial / Journal / Contacts + chrome states)
3. `/gsd-plan-phase 10` — backend+frontend plans
4. `/gsd-execute-phase 10` → `/gsd-verify-work 10`
