#!/bin/bash
set -e

case "$1" in
  base)
    # Run existing tests - should pass at base commit
    npm test -- tests/api.test.js
    ;;
  new)
    # Run newly added tests - should fail before solution
    npm test -- tests/compare.test.js tests/api-compare.test.js
    ;;
  *)
    echo "Usage: ./test.sh {base|new}"
    exit 1
    ;;
esac
