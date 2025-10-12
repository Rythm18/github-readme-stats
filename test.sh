#!/bin/bash
set -e

case "$1" in
  base)
    npm test -- tests/retryer.test.js --testNamePattern="(should return value and have zero retries on first try|should return value and have 2 retries|should return value and have 2 retries with message based rate limit error|should throw specific error if maximum retries reached)"
    npm test -- tests/fetchWakatime.test.js --testNamePattern="(should fetch correct WakaTime data|should throw error if username param missing|should throw error if username is not found)"
    ;;
  new)
    npm test -- tests/network-error-handling.test.js
    npm test -- tests/wakatime-network-error.test.js
    ;;
  *)
    echo "Usage: ./test.sh {base|new}"
    exit 1
    ;;
esac