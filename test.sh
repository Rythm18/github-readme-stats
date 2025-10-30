#!/bin/bash
set -e

# Ensure PAT token is set for tests to prevent "No GitHub API tokens found" errors
export PAT_1="${PAT_1:-test_pat_token}"

case "$1" in
  base)
    # Run existing tests - should pass at base commit
    npm test -- tests/api.test.js
    ;;
  new)
    # Run newly added tests - should fail before solution
    npm test -- tests/api-compare.test.js
    ;;
  *)
    echo "Usage: ./test.sh {base|new}"
    exit 1
    ;;
esac
