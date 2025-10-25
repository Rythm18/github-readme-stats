# Fix: PAT Token Issue in Baseline Tests

## Problem Summary

When applying `test.patch` and running baseline tests, they failed with:

```
Something went wrong! file an issue at https://tiny.one/readme-stats
No GitHub API tokens found
Please add an env variable called PAT_1 with your GitHub API token in vercel
```

**Exit Code:** 1  
**Failed Tests:** 10 out of 14 baseline tests  
**Root Cause:** Missing `PAT_1` environment variable

## Technical Analysis

### Why This Happens

The GitHub Readme Stats API handlers perform early token validation:

```javascript
// Inside API handler initialization
if (!process.env.PAT_1) {
  return res.send(renderError({
    message: "No GitHub API tokens found",
    secondaryMessage: "Please add an env variable called PAT_1..."
  }));
}
```

This validation occurs **before** the mocked axios responses are used, causing tests to receive error SVGs instead of the expected stats output.

### Why Tests Need PAT_1

Even though tests mock HTTP responses using `axios-mock-adapter`, the API handlers validate token presence during request processing. Without at least one token configured, the handler returns an error immediately without reaching the mocked data layer.

## Solution Implemented

### Updated test.sh Script

Added automatic PAT_1 token export to `test.sh`:

```bash
#!/bin/bash
set -e

# Ensure PAT token is set for tests to prevent "No GitHub API tokens found" errors
export PAT_1="${PAT_1:-test_pat_token}"

case "$1" in
  base)
    npm test -- tests/api.test.js
    ;;
  new)
    npm test -- tests/api-compare.test.js
    ;;
  *)
    echo "Usage: ./test.sh {base|new}"
    exit 1
    ;;
esac
```

**Key Feature:**  
`export PAT_1="${PAT_1:-test_pat_token}"`

This bash syntax means:
- If `PAT_1` is already set, use its existing value
- If `PAT_1` is not set, default to `"test_pat_token"`

### Benefits

✅ **No Manual Setup Required** - Users can run `./test.sh base` immediately after applying the patch  
✅ **Works in CI/CD** - Automated pipelines can use existing PAT tokens or fall back to dummy token  
✅ **Safe for Development** - Doesn't override real tokens if they're already configured  
✅ **Clear Intent** - Comment explains why the token is needed  

## How to Use

### After Applying Patch

```bash
# Apply patch (includes updated test.sh)
git apply test.patch

# Make executable (if needed)
chmod +x test.sh

# Run baseline tests - now works without manual PAT setup!
./test.sh base

# Expected: All baseline tests PASS
```

### Manual Token Setup (Alternative)

If you prefer not to use `test.sh`:

```bash
export PAT_1="test_pat_token"
npm test -- tests/api.test.js
```

## Verification

### Before Fix

```bash
$ npm test -- tests/api.test.js
# ❌ FAIL: 10 failed, 4 passed
# Error: No GitHub API tokens found
```

### After Fix

```bash
$ ./test.sh base
# ✅ PASS: All baseline tests pass
```

## Implementation Notes

### Why a Dummy Token Works

The token value `"test_pat_token"` is sufficient because:
1. The handler only checks if `process.env.PAT_1` **exists**
2. Actual GitHub API calls are mocked by `axios-mock-adapter`
3. The token isn't used for authentication in tests
4. Token format/validity isn't validated during early checks

### Token Doesn't Need to Be Real

For testing purposes, any non-empty string works. The actual GitHub API authentication happens later in the request flow, where mocked responses are already in place.

### CI/CD Integration

In CI environments, the script will:
- Use real PAT tokens if configured (for integration tests)
- Fall back to dummy token for unit tests
- Never require manual intervention

## Related Files Updated

| File | Change | Purpose |
|------|--------|---------|
| `test.sh` | Added `export PAT_1` | Automatic token setup |
| `test.patch` | Includes updated test.sh | Distributed with tests |
| `TEST_SETUP.md` | New documentation | Troubleshooting guide |
| `FEEDBACK_RESOLUTION.md` | Added setup section | Documents the fix |
| `TEST_DECOUPLING_SUMMARY.md` | Updated verification steps | Explains test.sh usage |

## FAQ

### Q: Do I need a real GitHub token to run tests?

**A:** No. The dummy token `"test_pat_token"` is sufficient because API calls are mocked.

### Q: Will this override my existing PAT_1 token?

**A:** No. The script uses `${PAT_1:-test_pat_token}` which only sets the default if PAT_1 isn't already defined.

### Q: Why not set PAT_1 inside the test files?

**A:** The token needs to be set **before** the handler module is loaded. Setting it inside test files may be too late, depending on module initialization order.

### Q: Can I use a different token name?

**A:** The codebase specifically looks for `PAT_1` (and optionally PAT_2, PAT_3, etc.). The test.sh script must export `PAT_1` to match this expectation.

### Q: What if tests still fail with "No GitHub API tokens found"?

**A:** Ensure you're using `./test.sh base` instead of `npm test` directly. If the issue persists, manually export the token:

```bash
export PAT_1="test_pat_token"
npm test -- tests/api.test.js
```

See `TEST_SETUP.md` for additional troubleshooting steps.

## Summary

The fix is simple but critical:
- **Problem:** Baseline tests failed due to missing PAT_1 token
- **Solution:** test.sh now exports a dummy PAT_1 token automatically
- **Result:** Tests pass without manual environment configuration

Users can now apply the patch and run `./test.sh base` immediately without any additional setup!
