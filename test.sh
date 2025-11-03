#!/bin/bash
set -e

case "$1" in
  base)
    # Run existing tests - should pass at base commit
    npm test -- --testPathIgnorePatterns=githubResponseCache.test.js
    ;;
  new)
    # Run newly added tests - should fail before solution
    npm test -- --runTestsByPath tests/githubResponseCache.test.js
    ;;
  *)
    echo "Usage: ./test.sh {base|new}"
    exit 1
    ;;
esac
