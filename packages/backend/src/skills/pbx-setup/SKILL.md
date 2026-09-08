---
name: pbx-setup
description: Сквозной рецепт первичной настройки АТС — контексты, транк, абоненты, группа, IVR, входящий DID-маршрут и проверка.
domains: ["pbx-setup"]
intents: ["pbx_setup", "greenfield_pbx", "inbound_did_setup"]
aliases: ["настрой атс", "pbx setup", "первичная настройка", "greenfield"]
related: ["contexts", "trunks", "endpoints", "call-groups", "ivrs", "routes", "diagnostics"]
risk: high
---

# Сквозная настройка АТС (pbx-setup)

Оркестрационный рецепт. Не дублируй схемы доменных skills — читай их через `read_skill` / серверный injection и вызывай их mutation tools.

## Порядок зависимостей

1. **Собрать DID / provider requirements.** Нужны: точный DID pattern входящего маршрута (это `route.extensions` / pattern, **не** модуль `numbers`), тип транка (IP-peering или auth), имена контекстов, диапазон абонентов, IVR/группа.
2. **Контексты.** `list_contexts` → при отсутствии создать internal и inbound через `create_context`. Не выдумывай UID.
3. **Транк.** `list_trunks` → `create_trunk`. Для auth-trunk остановись на secure-input (пароль не принимай в chat/tool args). IP-peering проходит полностью диалогом.
4. **Абоненты.** `list_endpoints` → `create_endpoints_bulk` только для недостающих номеров.
5. **Группа.** Одна call-group на таймаут/очередь ожидания. `exten` группы не выдумывай — спроси, если не назван.
6. **IVR.** `create_ivr` с typed destinations (`extension` / `group`), greeting из brief.
7. **Входящий DID route.** Exact-DID inbound route с typed `toivr` на созданное меню. Pattern = точный DID, не catch-all `_X.` выше emergency.
8. **Проверка.** Route/dialplan dry-run → compiled dialplan / lab verification если доступно.

## Частичная конфигурация

Если сущности уже есть — строй только недостающие/изменяемые шаги. Идемпотентность важнее «создать заново».

## Обязательные факты

Не придумывай: context UID, group extension, TTS engine, tenant suffix. Отсутствующий обязательный факт → **один** точный вопрос до карточки.

## HITL

Весь план — одна workflow-карточка. Apply идёт последовательно; при ошибке оставшиеся шаги `pending`, уже применённые `applied`. Не обещай атомарность БД↔AMI.
