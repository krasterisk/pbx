---
status: partial
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
source: [07-VERIFICATION.md]
started: 2026-07-16T04:30:00Z
updated: 2026-07-16T11:39:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Полный сценарий оператора на /callcenter/agent
expected: Войти в АРМ → входящий звонок из очереди → карточка звонка открывается с данными из телефонной книги → удержание/перевод → поствызовная обработка (wrap-up) → звонок появляется в отчётах
result: issue
reported: "при входе в АРМ и начале смены - статусы не меняются, при выборе номера, смена не начинается. Карточка звонка не открывается, удержание\\перевод, поствызывная обработка не появляется, в отчётах звонков нет. Полный провал"
severity: blocker

### 2. WebRTC-режим в браузере (сквозной)
expected: В ShiftLoginModal режим WebRTC регистрируется по WSS; ответ/удержание/mute/DTMF/перевод работают полностью в браузере
result: issue
reported: "Вообще ничего не работает"
severity: blocker

### 3. Wallboard TV по display-токену
expected: Создать токен в настройках → открыть /callcenter/wallboard?token=… без логина → видны KPI/агенты/очереди; отзыв токена останавливает SSE
result: blocked
blocked_by: prior-phase
reason: "Вообще ничего не работает — АРМ/смена не стартует, зависимые сценарии не проверялись"

### 4. Навигация по ролям
expected: Оператор видит только «АРМ оператора»; супервизор — agent/supervisor/wallboard/reports; админ ещё и settings; deep-link оператора на /callcenter/supervisor уводит на главную
result: blocked
blocked_by: prior-phase
reason: "Вообще ничего не работает — АРМ/смена не стартует, зависимые сценарии не проверялись"

### 5. Настройки: причины пауз и выбор оператора
expected: Админ открывает /callcenter/settings → CRUD «Причины пауз» работает; «Настройки операторов» → выбрать другого оператора → сохранение через /operator/:operatorId
result: blocked
blocked_by: prior-phase
reason: "Вообще ничего не работает — АРМ/смена не стартует, зависимые сценарии не проверялись"

## Summary

total: 5
passed: 0
issues: 2
pending: 0
skipped: 0
blocked: 3

## Gaps

- truth: "Войти в АРМ → входящий звонок из очереди → карточка звонка открывается с данными из телефонной книги → удержание/перевод → поствызовная обработка (wrap-up) → звонок появляется в отчётах"
  status: failed
  reason: "User reported: при входе в АРМ и начале смены - статусы не меняются, при выборе номера, смена не начинается. Карточка звонка не открывается, удержание/перевод, поствызывная обработка не появляется, в отчётах звонков нет. Полный провал"
  severity: blocker
  test: 1
  root_cause: "PRIMARY: After agentLogin success, frontend never dispatches setMyAgentInterface — selectMyAgent always undefined so status stays OFFLINE and call card/hold/transfer/wrap-up UI never bind (CallCenterAgentPage handleShiftLogin; callCenterSelectors.selectMyAgent; setMyAgentInterface only in slice/tests). CONTRIBUTING: empty queues[] skips AMI QueueAdd → no inbound queue calls/reports even if UI identity is fixed."
  artifacts: [".planning/debug/DEBUG-cc-agent-shift.md"]
  missing: []
  debug_session: ".planning/debug/DEBUG-cc-agent-shift.md"

- truth: "В ShiftLoginModal режим WebRTC регистрируется по WSS; ответ/удержание/mute/DTMF/перевод работают полностью в браузере"
  status: failed
  reason: "User reported: Вообще ничего не работает"
  severity: blocker
  test: 2
  root_cause: "PRIMARY: same as test 1 — missing setMyAgentInterface after login so hold/mute/DTMF/transfer never mount (gated on myAgent/activeCall). SECONDARY independent: ASTERISK_WSS_URL unset → wssUrl null aborts REGISTER before phone.connect. sip.js path itself not the primary defect."
  artifacts: [".planning/debug/DEBUG-cc-webrtc.md"]
  missing: []
  debug_session: ".planning/debug/DEBUG-cc-webrtc.md"
