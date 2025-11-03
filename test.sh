#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./test.sh <base|new>

  base  Run the full baseline test suite
  new   Run only the new caching tests
USAGE
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

case "$1" in
  base)
    npm test
    ;;
  new)
    npx jest --runTestsByPath tests/githubResponseCache.test.js
    ;;
  *)
    usage
    exit 1
    ;;
esac
