---
status: testing
phase: 16-modul-telekonferentsiy-confbridge-webrtc
source: [16-VERIFICATION.md]
started: 2026-09-16T02:53:00Z
updated: 2026-09-16T02:53:00Z
---

## Current Test

number: 1
name: Живой профиль krsk_conf_sfu
expected: |
  После холодного и повторного старта бэкенда `confbridge show profile bridge krsk_conf_sfu` показывает категорию, `video_mode=sfu`, `allow` содержит opus,ulaw,vp8; повторный старт не дублирует категорию.
awaiting: user response

## Tests

### 1. Живой профиль krsk_conf_sfu
expected: Категория есть, video_mode=sfu, allow содержит opus,ulaw,vp8; повторный старт не дублирует категорию
result: [pending]

### 2. Живой звонок в комнату и SSE
expected: Звонок попадает в conf{number}_{uid}; первое SSE-сообщение fullSnapshot с участником; leave очищает снимок (и фиксированный шаг, и маска _9XX)
result: [pending]

### 3. DIALPLAN_EXISTS в mask-index
expected: Существующий номер переходит в krsk-conf-{uid},s,1; несуществующий играет invalid и Hangup
result: [pending]

### 4. Разовая роль vs DTMF
expected: Портальные mute/kick работают сразу после повышения гостя; административное DTMF-меню — только после повторного входа
result: [pending]

### 5. Кэш после рестарта бэкенда
expected: Join появляется в снимке без предварительного GET /conferences (сейчас кэш пуст до list/CRUD)
result: [pending]

### 6. D-06 precision — uid INT max
expected: Имя содержит десятичную запись 2147483647, без e+ и без разделителей
result: [pending]

### 7. D-25 ordering — строка allow
expected: Ровно opus,ulaw,vp8 в этом порядке
result: [pending]

### 8. D-34 concurrency — параллельные N join
expected: В снимке ровно N участников, без потери и без дублей
result: [pending]

### 9. D-35 SSE — закрыть вкладку
expected: interval heartbeat остановлен, Subject комнаты не копит подписчиков
result: [pending]

### 10. D-17 ordering — два входа админа
expected: Две audit-записи conference_live_room_enter в порядке входов
result: [pending]

### 11. D-08 concurrency — две create подряд
expected: Последняя публикация mask-index содержит оба номера
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps
