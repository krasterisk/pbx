# Деплой коробки Krasterisk

Повторяемый контур для сервера заказчика: Asterisk certified собирается на хосте из архива, приложение и PostgreSQL 17 живут в Docker. Секреты остаются в `/opt/krasterisk/env/production.env` (режим `0600`) и не попадают в git.

Первый инвентарь: `deploy/ansible/inventories/telephony` → `185.177.216.132`.

## Новый сервер

1. Положите `asterisk-certified-22.8-cert4.tar.gz` в `/usr/local/src/` на сервере.
2. Скопируйте инвентарь `inventories/telephony` и поменяйте `ansible_host`, `krasterisk_public_ip` и путь к SSH-ключу.
3. На машине, где лежит репозиторий и установлен Ansible (коллекция `ansible.posix` нужна только для режима `sync`):

```bash
cd deploy/ansible
ansible-playbook site.yml
```

`site.yml` ставит пакеты, Docker, firewall и собирает Asterisk. Модули `app_amd`, `app_waitforcond`, `app_waitforring`, `app_waitforsilence` включаются в menuselect явно и попадают в `modules.conf`.

4. Экспортируйте робота со стенда (файл содержит токены STT/TTS, не коммитьте его):

```bash
NODE_PATH=/var/www/pbx/node_modules node deploy/robots/export-voice-robot.mjs \
  --env /var/www/pbx/.env.production \
  --out /root/komandor.bundle.json \
  --uid 4
```

Скопируйте bundle на новый сервер в `/opt/krasterisk/secrets/komandor.bundle.json` и выставьте `chmod 600`.

5. Поднимите приложение:

```bash
ansible-playbook app.yml
```

Playbook создаёт env, собирает образы с тегом git SHA (или хешем `package.json`, если каталог без `.git`), накатывает миграции `full-pbx` на PostgreSQL. База и пользователь — `krasterisk`; тем же пользователем Asterisk читает realtime через ODBC. Дальше playbook стартует Asterisk, импортирует «Командора» и создаёт маршрут `901`, очередь перевода `614` и тестового абонента `201`.

Логин администратора и пароль SIP лежат в `/opt/krasterisk/env/production.env` (`ADMIN_LOGIN`, `ADMIN_PASSWORD`, `TEST_SIP_PASSWORD`). Пароль при первом создании генерируется на сервере.

Режим источника:

| `krasterisk_source` | Поведение |
|---|---|
| `sync` | rsync репозитория с машины, где запущен Ansible |
| `git` | clone `krasterisk_git_repo` / `krasterisk_git_ref` |
| `local` | код уже лежит в `/opt/krasterisk/src` |

На самом сервере, когда код уже скопирован:

```bash
ansible-playbook site.yml -e krasterisk_source=local -e ansible_connection=local
ansible-playbook app.yml -e krasterisk_source=local -e ansible_connection=local
```

## Транк и DID

Пока в env нет `TRUNK_HOST`, шаг транка пропускается. Для живого номера допишите в `production.env` и повторите `app.yml`:

```
INBOUND_DID=74951234567
TRUNK_HOST=sip.example.com
TRUNK_PORT=5060
TRUNK_MODE=ip
TRUNK_MATCH=203.0.113.10
```

`TRUNK_MODE=auth` дополнительно читает `TRUNK_USERNAME` и `TRUNK_PASSWORD`. Входящий DID попадает в того же робота.

## Обновление и откат

Повторный `app.yml` на том же дереве пересобирает образы из кэша Docker и не пересоздаёт env. Asterisk заново не компилируется, если `asterisk -V` уже содержит `certified-22.8-cert4` и десять обязательных `.so` (включая запись и BLF) на месте.

Текущий тег записан в `/opt/krasterisk/env/image-tag`. Откат приложения без пересборки Asterisk:

```bash
echo <previous-tag> > /opt/krasterisk/env/image-tag
/opt/krasterisk/src/deploy/scripts/compose.sh up -d
```

Предыдущий тег — это имя образа `docker images krasterisk-backend`. База при откате образа не сносится. Откат миграции автоматически не делается.

## Проверка

```bash
asterisk -rx "core show version"
asterisk -rx "module show like app_amd"
asterisk -rx "module show like app_waitfor"
curl -fsS http://127.0.0.1/api/health
node deploy/scripts/sip-register-check.mjs --env /opt/krasterisk/env/production.env
```

Тестовый абонент: пользователь `e201_0`, пароль `TEST_SIP_PASSWORD`, номер `901` ведёт в робота.
# BLF и SIP-статусы (опционально)

В «Абоненты → Редактировать → Перехват» включите «BLF и подписки на статусы»
для телефона, который должен получать SIP SUBSCRIBE/NOTIFY. У новых абонентов
опция выключена. В настройках кнопки BLF телефона укажите внутренний номер,
например `201`, а сервер — адрес этой АТС. Поддерживаются события `dialog` и
`presence`; состояния формируются Asterisk из SIP и WebRTC устройств номера.

Backend управляет отдельными контекстами `krsk-blf-{tenant}` и файлами
`krasterisk/routes/blf_{tenant}.conf`. В этих контекстах только hints, без
включений маршрутов других организаций. Контекст нельзя выбрать вручную.
Обновление выполняется после изменения абонента, при запуске и каждые 30 секунд
для повторного применения после сбоя AMI. Существующий glob в `extensions.conf`
должен включать `krasterisk/*/*.conf`. В профиле сборки необходимы
`res_pjsip_outbound_publish` (зависимость в certified 22),
`res_pjsip_exten_state`, `res_pjsip_pidf_body_generator`,
`res_pjsip_xpidf_body_generator`, `res_pjsip_dialog_info_body_generator`.

`t_*` — технические endpoints транков в общей таблице Asterisk `ps_endpoints`;
они отображаются и редактируются через «Транки», а не «Абоненты».
