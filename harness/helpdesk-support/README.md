# Изолированный helpdesk harness

Используются искусственные tenants, настоящие MySQL/PostgreSQL, HTTP/MCP и Asterisk. SpeechKit подменяется контролируемым ответом401. Внешних транков, SMTP и реальных клиентских данных нет.

На Linux с Docker, Node22 и установленными зависимостями репозитория:

1. `npm run build` из корня.
2. В этом каталоге `docker compose -p helpdesk-v4-lab-r9 up -d --build mysql redis asterisk` (для второго отдельного прогона заменить mysql на postgres). Все порты только127.0.0.1; сеть internal.
3. `node runner.cjs mysql` в отдельном терминале; после HTTP ready выполнить `node golden.cjs mysql`, затем `python3 boundaries-remote.py`.
4. Остановить runner и только этот compose project: `docker compose -p helpdesk-v4-lab-r9 down --volumes`. Повторить на чистом стенде для postgres.

После потерянного HTTP ответа apply не повторять. Сохранённый план проверяет `node reconcile-golden.cjs postgres`: status/verify и проверка конечных сущностей только чтением. Локальные JSON/logs исключены из Git. При удалённом Docker необходим SSH-туннель fixture портов; TESTTIME helper запускается рядом с compose и mounted каталогом Asterisk. Не запускать на production compose или БД.

Результат: точная переадресация583, последующее сохранение через API веб-интерфейса, очередь ringall, mock STT one-call/replay, календарь+8потребителей и четыре временные границы. RuntimeQueue данные не доказывают состоявшийся звонок.
