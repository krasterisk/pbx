#!/bin/bash
set -euo pipefail
ARCHIVE=/tmp/krasterisk-d1-contracts.tgz
OLD=/tmp/krasterisk-i3.g7CBtb
leftover=$(docker ps -aq --filter label=org.testcontainers=true || true)
if [ -n "${leftover}" ]; then
  echo "Removing leftover testcontainers: ${leftover}"
  docker rm -f ${leftover}
fi
DIR=$(mktemp -d /tmp/krasterisk-i3.XXXXXX)
tar -xzf "${ARCHIVE}" -C "${DIR}"
if [ -d "${OLD}/node_modules" ]; then
  mv "${OLD}/node_modules" "${DIR}/node_modules"
fi
rm -rf "${OLD}"
cd "${DIR}"
if [ ! -d node_modules ]; then
  npm install --omit=dev --no-audit --no-fund
fi
mkdir -p logs
fail=0
run() {
  local name="$1"; shift
  echo "===== $name ====="
  set +e
  "$@" > "logs/${name}.log" 2>&1
  local code=$?
  set -e
  echo "EXIT ${name} ${code}"
  tail -n 80 "logs/${name}.log" || true
  if [ "${code}" -ne 0 ]; then fail=1; fi
}
run mysql-i3 node harness/database/run-i3-upgrade.cjs mysql
run postgres-i3 node harness/database/run-i3-upgrade.cjs postgres
echo '--- leftover testcontainers ---'
docker ps -a --filter label=org.testcontainers=true --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}' || true
echo "FAIL=${fail}"
echo "DONE_DIR=${DIR}"
exit "${fail}"
