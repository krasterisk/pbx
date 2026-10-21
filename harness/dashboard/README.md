# Dashboard integration harness

`node harness/dashboard/dashboard-dialects-check.cjs` использует testcontainers и две свежие loopback SQL DB с генерируемыми credentials; требует Docker. Это отдельный integration gate, не обычный unit test. Сохранены прежние pinned images, SQL/fixture checks и ограничения scope. Вывод — внешний `ARTIFACTS_ROOT/runs/pbx-dashboard/dialects-<timestamp>/`.

В рамках структурной миграции выполняется syntax/AST review; контейнеры и внешние подключения не запускаются. Обособленный Asterisk lab и локальные SIP parser tests находятся в `harness/asterisk/`.
