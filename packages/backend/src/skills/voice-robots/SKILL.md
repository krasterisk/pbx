---
name: voice-robots
description: Создание и настройка сценарного голосового робота через MCP/AI инструменты; без доступа — portable JSON и точная инструкция импорта и тестирования.
domains: ["voice-robots"]
intents: ["configure_robot", "diagnose_robot"]
aliases: ["робот", "voice robot"]
related: ["voice-robot-scenarios", "voice-robot-testing", "speech-engines"]
risk: high
---
# Голосовые роботы

Робот в этом продукте ведёт диалог на входящем звонке: приветствие, группы ключевых слов, затем TTS и STT. Его вызывают действием `voicerobot` на маршруте — это точка входа, не сам номер.

## Как достигают

`list_voice_robots` отдаёт статус (`active` / `inactive`) и `entry_points` — маршруты, которые на него ссылаются. Пустой список входов значит, что робот есть, но ни один маршрут его не вызывает. Это не «робота нет».

## Движки

Робот ссылается на TTS и STT по uid. Тишина почти всегда значит, что движок не настроен или ссылка битая: движок удалили, а робот всё ещё указывает на его uid.

`describe_voice_robot` уже решает эту зависимость: для каждого указанного движка пишет имя и `configured` / `missing`. Не вызывай list движков и не угадывай, какой движок стоит у робота — неверный uid даёт уверенный неверный диагноз. Сначала прочитай describe.

Битую ссылку describe не пропускает: `missing: true` отличается от «движок есть, но без конфигурации».

## Настройка через доступные инструменты

1. Проверь фактически доступные инструменты через get_configuration_capabilities/tools/list. Если MCP недоступен, авторизация не работает или нет прав записи, выдай scenario.json формата krasterisk.voice-robot.scenario v1 и конкретную инструкцию по интерфейсу; не сообщай о выполненной настройке. Прочитай voice-robot-scenarios и voice-robot-testing.
2. Вызови list_voice_robots. Для существующего робота найди реальный UID, затем describe_voice_robot и get_voice_robot_configuration. Не угадывай UID и не создавай дубликат при неоднозначности.
3. list_voice_robot_speech_engines с kind=stt и kind=tts даёт доступные UID. Ключи речевых провайдеров вводит пользователь в защищённом интерфейсе: они не должны попадать в промпт, JSON или tool args. Если провайдеров нет, подготовь робота inactive и укажи оставшийся шаг.
4. Спроектируй приветствие, стартовую группу, фразы/synonyms, переходы и завершение. Сначала validate_voice_robot_scenario. Исправь errors и учти warnings. Для нового робота предпочитай create_voice_robot с data и scenario: создание и импорт — одна транзакция. Активность по умолчанию false. Для существующего импорт append; повтор создаёт дубликаты.
5. В основной версии mutation tools создают карточку изменения. Дождись подтверждения человека через интерфейс и затем перечитай объект. Proposal не означает выполненную запись. Reload policy=none. Standalone MCP с ключом configure применяет изменения напрямую в рамках поручения пользователя; read ключ не даёт права записи.
6. Части сценария: create/update/delete_voice_robot_keyword_group, create/update/delete_voice_robot_keyword и create/update/delete_voice_robot_data_list. В отдельных CRUD bot_action использует реальный UID группы и dataListSearch.listId. В portable JSON — group:<key> и listKey. Удаления только при явном намерении пользователя; сервис отвергает висящие ссылки.
7. После записи вызови get_voice_robot_configuration, export_voice_robot_scenario, check_voice_robot_readiness, test_voice_robot_match; для справочника test_voice_robot_data_list. Сообщи реальные UID и результаты. Не проси вручную импортировать уже записанный файл.
8. Итог обязательно содержит точные действия: ссылка на робота, Основные/Диалог/Справочники/Тест, таблица тестовых реплик и ожидаемых веток, один реальный звонок по подтверждённому тестовому маршруту, Журнал звонков. Раздели configuration/text-match/live-audio gates.

Не меняй маршруты или конфигурацию Asterisk как скрытый шаг создания робота. Standalone не имеет таких инструментов и не запускает реальные звонки. Отсутствие entry_points в standalone — не доказательство отсутствия маршрута: v3 каталог не перечисляется. LLM проектирует FSM; свободного LLM-ответа внутри обычного сценарного разговора нет.

Для mpbx: https://mpbx.krasterisk.ru/modules/voice-robots/standalone.html#/voice-robots; ключ MCP создаётся на https://mpbx.krasterisk.ru/modules/voice-robots/mcp-access.html. Полный portable контракт: https://mpbx.krasterisk.ru/modules/voice-robots/AGENTS.md. В другой установке используй её фактический URL.
