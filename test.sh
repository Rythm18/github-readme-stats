#!/bin/bash
set -e

case "$1" in
  base)
    # Run existing tests - should pass at base commit
    npm test -- tests/api/auth.test.ts
    ;;
  new)
    # Run newly added tests - should fail before solution
    npm test -- tests/api/auth-rate-limit.test.ts
    ;;
  *)
    echo "Usage: ./test.sh {base|new}"
    exit 1
    ;;
esac
