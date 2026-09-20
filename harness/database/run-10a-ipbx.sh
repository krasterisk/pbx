#!/bin/bash
set -euo pipefail
ARCHIVE=/tmp/krasterisk-10a-smoke.tgz
OLD=/tmp/krasterisk-10a.LLqOY8
leftover=$(docker ps -aq --filter label=org.testcontainers=true || true)
if [ -n "${leftover}" ]; then
  echo "Removing leftover testcontainers: ${leftover}"
  docker rm -f ${leftover}
fi
DIR=$(mktemp -d /tmp/krasterisk-10a.XXXXXX)
tar -xzf "${ARCHIVE}" -C "${DIR}"
if [ -d "${OLD}/node_modules" ]; then
  mv "${OLD}/node_modules" "${DIR}/node_modules"
fi
rm -rf "${OLD}"
cd "${DIR}"
if [ ! -d node_modules ]; then
  npm install --omit=dev --no-audit --no-fund
  npm install-scripts approve bcrypt || true
fi
npm rebuild bcrypt || true
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
run mysql-10a node harness/database/run-10a-smoke.cjs mysql
run postgres-10a node harness/database/run-10a-smoke.cjs postgres
echo '--- leftover testcontainers ---'
docker ps -a --filter label=org.testcontainers=true --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}' || true
echo "FAIL=${fail}"
echo "DONE_DIR=${DIR}"
exit "${fail}"
