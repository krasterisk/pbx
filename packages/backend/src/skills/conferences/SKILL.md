---
name: conferences
description: Комнаты телеконференций: список и настройка через diff; mute/kick — live dispatch.
domains: ["conferences"]
intents: ["configure_conference", "live_moderation"]
aliases: ["конференция", "телеконференция", "confbridge"]
related: ["callcenter"]
risk: high
---
# Телеконференции

Комната = `uid` + короткий `number` + имя. Список — `list_conference_rooms` (только эти поля, без SIP, канала и `conf{number}_{uid}`). Настройки комнаты — `update_conference_room`: proposal / diff, не live write.

## Live-операции модератора

`cf_force_mute_participant` и `cf_force_kick_participant` — живые операции модерации. Их вызывает dispatch после confirm, это не draft и не proposal. Остальные мутации комнаты идут через proposal.

Аргумент участника — DTO `ref` из состояния комнаты, не имя Asterisk-канала. Тенант берётся из JWT (`vpbxUserUid` аргумент handler), не из схемы tool.

## Рецепт

1. **Что прочитать.** `list_conference_rooms`.
2. **Править комнату.** `update_conference_room` по uid тенанта. Чужой uid отвергается.
3. **Заглушить или исключить.** `cf_force_mute_participant` / `cf_force_kick_participant` с `room_uid` и `ref`. Те же гарды, что REST-модерация.
