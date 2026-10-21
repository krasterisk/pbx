---
status: testing
phase: 05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c
source: 05-04-PLAN.md
started: 2026-07-14T12:40:00.000Z
updated: 2026-07-14T12:40:00.000Z
---

## Current Test

number: 2
name: Регистрация webhook tools в aiPBX
expected: В админке aiPBX созданы 8 tool definitions; MCP tools/list содержит новые tools; тестовое сообщение «покажи список справочников» возвращает list_phonebooks.
awaiting: user response

## Tests

### 1. Автоматический гейт (lint + unit tests)
expected: `npm run lint`, `npm run test:backend`, `npm run test:frontend` — все зелёные на итоговом состоянии Phase 5.
result: passed

### 2. Регистрация webhook tools в aiPBX (Task 2)
expected: В админке aiPBX созданы definitions для list_phonebooks, create_phonebook, update_phonebook, delete_phonebook, add_phonebook_entries, remove_phonebook_entries, list_phonebook_entries, update_route — URL POST {BACKEND}/api/ai-tools/call/{toolName}, auth service token + X-Vpbx-User-Uid. POST /api/mcp tools/list содержит новые tools. Тестовое сообщение в AI Chat «покажи список справочников» возвращает результат list_phonebooks.
result: pending

### 3. UI — вкладка «Справочники» на маршруте
expected: Маршрут → вкладка «Справочники» → добавить binding с пресетом, изменить порядок, сохранить, переоткрыть — порядок сохранён.
result: pending

### 4. UI — demo lookup-test
expected: Справочник → ввести номер из записей — matched + vars; чужой номер — not matched.
result: pending

### 5. UI — per-tenant AI confirmations
expected: Настройки → AI Chat: включить подтверждения; в чате «удали справочник X» — AI запрашивает подтверждение; после «да» — удалён. Выключить настройку обратно (default OFF).
result: pending

### 6. AI-сценарий D-21 — чёрный список
expected: «Создай чёрный список с номерами 1001 и 1002 и привяжи его к маршруту {имя} как блокировку» — справочник создан, binding behavior_type=blacklist, dialplan apply (CLI: dialplan show pb_bind_...).
result: pending

### 7. AI-сценарий D-21 — VIP redirect
expected: «Добавь VIP-номера 2001, 2002 с redirect на 100» — vars + binding redirect.
result: pending

### 8. AI-сценарий D-21 — привязка set_name
expected: «Привяжи справочник {X} к маршруту {Y} с подстановкой имени» — update_route с bindings; порядок: blacklist раньше VIP.
result: pending

### 9. Реальный звонок — blacklist
expected: Звонок с номера из чёрного списка — Hangup до основных actions маршрута.
result: pending

### 10. Реальный звонок — VIP
expected: Звонок с VIP-номера — CALLERID(name) подставлен / redirect сработал.
result: pending

### 11. Реальный звонок — посторонний номер
expected: Маршрут работает как раньше, политики не мешают.
result: pending

### 12. Audit action_logs
expected: Записи ai_tool для webhook и mcp:* из сценариев 6–8.
result: pending

## Summary

total: 12
passed: 1
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps

Manual UAT (tests 2–12) requires live Asterisk + aiPBX staging environment. Automated gate (test 1) passed in CI/local run 2026-07-14.
