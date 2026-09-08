---
name: directories
description: Схема и записи справочника, нормализация ключа, привязки к маршруту.
domains: ["directories"]
intents: ["configure_directory"]
aliases: ["справочник", "directory"]
related: []
risk: low
---
# Справочники

Справочник — это схема полей плюс записи. Поведение задаёт привязка к маршруту, не сама сущность.

## Рецепт

1. **Что прочитать.** `list_directories` (и записи — `list_directory_records`), прежде чем утверждать, что справочника нет.
2. **Чеклист из слов пользователя.** Бери факты из **любой** реплики треда, не только из последней. Имя, ключ и поля — только названные. Не выдумывай `key_source`.
3. **Висит карточка.** Попроси подтвердить и назови, что осталось (поля, записи, привязка).
4. **Когда остановиться.** Спрашивать можно только то, чего нет ни в одной реплике треда: ключ lookup или тип поля. Уже названное не переспрашивай. Полный ТЗ не закрывай меню «что настроить».

## Модель

- Поля имеют числовой `field_uid`, ключ (`key`) и тип. Ссылки в runtime идут по `field_uid`, не по display name. Management API пишет значения ключами полей.
- Запись хранит `lookup_value`, `normalized_lookup_value`, `match_kind` (`exact` | `asterisk_pattern`) и `values` по field uid.
- Ключ поиска всегда явный (`key_source`): `original_caller`, `current_caller`, `route_pattern`, `variable`, `fixed`. `CALLERID(num)` сам по себе ключом не является.

## Нормализация ключа

`key_normalization` на справочнике: `none` (trim), `digits` (только цифры), `ru_8_to_7` (`8XXXXXXXXXX` → `7XXXXXXXXXX`). Нормализация применяется к ключу lookup и к точному значению записи. Значение без ведущего `_` — точное совпадение. Ведущий `_` делает запись шаблоном Asterisk. Точное совпадение всегда раньше шаблона; среди шаблонов побеждает более узкий. Два одинаковых значения или шаблона запрещены.

Исходы lookup: `FOUND`, `NOT_FOUND`, `ERROR`. Технический `ERROR` — fail-open: исходный CallerID сохраняется, `on_no_match` не выполняется.

## Привязки в контексте маршрута

`route_directory_bindings` участвуют в генерации диалплана маршрута. У каждой привязки: `key_source`, `match_mode` (`on_match` | `on_no_match`), `behavior_type` (`set_name`, `set_number`, `drop`, `redirect`, `map_fields`, `custom`) и позиция. Политики справочника применяются до контекста маршрута.

## Запись через агента

Пять write-tools (`create_directory`, `update_directory`, `delete_directory`, `add_directory_records`, `remove_directory_records`) предлагают изменения и не пишут сами. Persist — `callTool` в плане 15-05, не этот скил.
