#!/bin/bash
# Render Asterisk files that contain secrets. Reads /opt/krasterisk/env/production.env.
# Does not print secret values.
set -euo pipefail

ENV_FILE="${1:-/opt/krasterisk/env/production.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

: "${AMI_LOGIN:?}"
: "${AMI_SECRET:?}"
: "${ARI_USER:?}"
: "${ARI_PASSWORD:?}"
: "${DB_USER:?}"
: "${DB_PASSWORD:?}"
: "${DB_NAME:?}"
: "${DB_HOST:?}"
: "${DB_PORT:?}"

install -d -o asterisk -g asterisk -m 0750 /etc/asterisk /etc/odbc

DRIVER="$(find /usr/lib /usr/lib64 -name 'psqlodbcw.so' 2>/dev/null | head -n 1 || true)"
if [[ -z "$DRIVER" ]]; then
  echo "PostgreSQL ODBC driver psqlodbcw.so not found" >&2
  exit 1
fi

umask 077
cat > /etc/odbcinst.ini <<EOF
[PostgreSQL Unicode]
Description=PostgreSQL ODBC driver
Driver=${DRIVER}
UsageCount=1
EOF

cat > /etc/odbc.ini <<EOF
[krasterisk]
Driver = PostgreSQL Unicode
Servername = ${DB_HOST}
Port = ${DB_PORT}
Database = ${DB_NAME}
Username = ${DB_USER}
Password = ${DB_PASSWORD}
SSLMode = disable
EOF

cat > /etc/asterisk/res_odbc.conf <<EOF
[krasterisk]
enabled => yes
dsn => krasterisk
username => ${DB_USER}
password => ${DB_PASSWORD}
pre-connect => yes
sanitysql => select 1
max_connections => 5
EOF

cat > /etc/asterisk/manager.conf <<EOF
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1

[${AMI_LOGIN}]
secret = ${AMI_SECRET}
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.255
read = all
write = all
EOF

cat > /etc/asterisk/ari.conf <<EOF
[general]
enabled = yes
pretty = yes
allowed_origins = *

[${ARI_USER}]
type = user
read_only = no
password = ${ARI_PASSWORD}
password_format = plain
EOF

chown root:asterisk /etc/odbc.ini /etc/odbcinst.ini \
  /etc/asterisk/res_odbc.conf /etc/asterisk/manager.conf /etc/asterisk/ari.conf
chmod 640 /etc/odbc.ini /etc/odbcinst.ini \
  /etc/asterisk/res_odbc.conf /etc/asterisk/manager.conf /etc/asterisk/ari.conf

echo "rendered odbc, manager and ari configs"
