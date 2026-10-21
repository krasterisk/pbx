# Asterisk harness

`live-asterisk-lab.py` — отдельный Linux lab на JSON-lines protocol для свежего изолированного Asterisk. Передавать только синтетические параметры; установка/процессы/сигнализация требуют отдельного назначения и окружения. Не импортировать/запускать lab как обычный unit test.

`python harness/asterisk/live-asterisk-lab-sip.test.py` — 12 локальных parser/UA tests: извлекает выбранные функции/classes через AST, использует FakeSocket и временные файлы, не запускает процессы и реальные звонки. Проверяет тот же source, который используется в lab. На Windows использовать доступный Python3.

`run-tls-lab-ipbx.sh` — существующий remote TLS scenario; в этой миграции изменён только локальный default evidence output на внешний ARTIFACTS_ROOT. SSH, SIP, reload и cleanup не выполнялись. Остальные существующие harness scenarios не присваиваются этой миграции.
