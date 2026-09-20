#!/bin/bash
set -euo pipefail
ROOT="${1:-.}"
cd "$ROOT"
mkdir -p logs
leftover=$(docker ps -aq --filter label=org.testcontainers=true || true)
if [ -n "${leftover}" ]; then
  echo "Removing leftover testcontainers: ${leftover}"
  docker rm -f ${leftover}
fi
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
  if [ "$code" -ne 0 ]; then fail=1; fi
}
run mysql-db03 node harness/database/run-db03.cjs mysql
run postgres-db03 node harness/database/run-db03.cjs postgres
run mysql-contracts node harness/database/run-contracts.cjs mysql
run postgres-contracts node harness/database/run-contracts.cjs postgres
echo '--- leftover testcontainers ---'
docker ps -a --filter label=org.testcontainers=true --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}' || true
echo "FAIL=${fail}"
exit "${fail}"
