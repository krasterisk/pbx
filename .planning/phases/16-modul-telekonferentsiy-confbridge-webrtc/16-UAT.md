---
status: complete
phase: 16-modul-telekonferentsiy-confbridge-webrtc
source: [16-VERIFICATION.md]
started: 2026-09-16T02:53:00Z
updated: 2026-09-16T04:48:40Z
---

## Current Test

[testing complete]

## Tests

### 1. Живой профиль krsk_conf_sfu
expected: Категория загружена в app_confbridge, Video Mode = sfu; повторный reload не дублирует категорию. allow на type=bridge недопустим и больше не пишется.
result: pass
reported: "После снятия allow= CLI показывает krsk_conf_sfu / Video Mode: sfu; повторный module reload оставляет один профиль"

### 2. Живой звонок в комнату и SSE
expected: Звонок попадает в conf{number}_{uid}; первое SSE-сообщение fullSnapshot с участником; leave очищает снимок (и фиксированный шаг, и маска _9XX)
result: pass
reported: "Local/s@krsk-conf-2 и Local/16891@krsk-conf-mask-58 → conf16891_58; SSE fullSnapshot → participantJoin(1) → participantLeave(0) на обоих путях. Enable Events yes. Модели conference_* добавлены в Sequelize forRoot."

### 3. DIALPLAN_EXISTS в mask-index
expected: Существующий номер переходит в krsk-conf-{uid},s,1; несуществующий играет invalid и Hangup
result: pass
reported: "16893@krsk-conf-mask-348: DIALPLAN_EXISTS → krsk-conf-3,s,1 → conf16893_348. 16899: Playback(invalid), конференции нет."

### 4. Разовая роль vs DTMF
expected: Портальные mute/kick работают сразу после повышения гостя; административное DTMF-меню — только после повторного входа
result: pass
reported: "Гость 119 до grant mute → 403; после grant mute жертвы → 200. confbridge list: Admin=No у гостя (DTMF-меню не включается до rejoin)."

### 5. Кэш после рестарта бэкенда
expected: Join появляется в снимке без предварительного GET /conferences (сейчас кэш пуст до list/CRUD)
result: pass
reported: "После рестарта 5099 join в conf16895_348 без GET /conferences → SSE participantJoin(1). ConferenceStateService подтягивает комнату из БД по имени моста."

### 6. D-06 precision — uid INT max
expected: Имя содержит десятичную запись 2147483647, без e+ и без разделителей
result: pass
reported: "normalizeTarget(16896, 2147483647) → conf16896_2147483647. Живой dialplan ConfBridge(conf16896_348) без научной нотации."

### 7. D-25 ordering — строка кодеков
expected: CONFERENCE_PLATFORM_CODECS = opus,ulaw,vp8 в этом порядке. На type=bridge allow= не пишется (G-16-1).
result: pass
reported: "Литерал opus,ulaw,vp8. Bootstrap пишет type/video_mode/enable_events. Live krsk_conf_sfu без allow=, Video Mode sfu."

### 8. D-34 concurrency — параллельные N join
expected: В снимке ровно N участников, без потери и без дублей
result: pass
reported: "3 параллельных Originate Local/s@krsk-conf-9 → SSE participants=3, unique refs=3, AMI members=3."

### 9. D-35 SSE — закрыть вкладку
expected: interval heartbeat остановлен, Subject комнаты не копит подписчиков
result: pass
reported: "После destroy запроса: Conference SSE closed room 10 heartbeat stopped observers=0. Повторный subscribe/unsubscribe тоже сбрасывает счётчик."

### 10. D-17 ordering — два входа админа
expected: Две audit-записи conference_live_room_enter в порядке входов
result: pass
reported: "Комната created_by=348, visitor sub=58: action_logs 711 затем 712, created_at по возрастанию."

### 11. D-08 concurrency — две create подряд
expected: Последняя публикация mask-index содержит оба номера
result: pass
reported: "krsk-conf-mask-348 после create 16902 и 16903 содержит оба номера → krsk-conf-12 / krsk-conf-13."

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-16-1
  truth: "После старта бэкенда `confbridge show profile bridge krsk_conf_sfu` показывает категорию с video_mode=sfu"
  status: resolved
  reason: "User reported: ipbx*CLI> confbridge show profile bridge krsk_conf_sfu — No conference bridge profile named 'krsk_conf_sfu' found!"
  severity: blocker
  test: 1
  root_cause: "AMI wrote allow= onto a type=bridge category; Asterisk rejected the whole profile. GetConfig still saw the on-disk category so bootstrap never rewrote it."
  artifacts:
    - path: "packages/backend/src/modules/conferences/confbridge-static-profile.service.ts"
      issue: "Stopped writing allow=; rewrite if CLI missing or on-disk category still has allow="
    - path: "/etc/asterisk/confbridge.conf"
      issue: "Rewrote without allow=; module reload loads krsk_conf_sfu with Video Mode sfu"
  missing: []
  debug_session: ""
