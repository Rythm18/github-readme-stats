# Test Setup Guide

## Problem: "No GitHub API tokens found" Error

When running the baseline tests, you may encounter an error like:

```
Something went wrong! file an issue at https://tiny.one/readme-stats
No GitHub API tokens found
Please add an env variable called PAT_1 with your GitHub API token in vercel
```

This happens because the tests require a GitHub API token to be present in the environment, even though the actual API calls are mocked.

## Solution

The `test.sh` script automatically sets a dummy PAT token if one is not already present:

```bash
export PAT_1="${PAT_1:-test_pat_token}"
```

This ensures tests can run without requiring a real GitHub token.

## Running Tests

### Using test.sh (Recommended)

The test runner script handles the environment setup automatically:

```bash
# Run baseline tests (existing api.test.js)
./test.sh base

# Run new comparison tests (api-compare.test.js)
./test.sh new
```

### Manual Test Execution

If running tests manually, ensure you set the PAT_1 environment variable first:

```bash
# Set dummy token
export PAT_1="test_pat_token"

# Run baseline tests
npm test -- tests/api.test.js

# Run new tests
npm test -- tests/api-compare.test.js
```

### In CI/CD Environments

The test.sh script will automatically use any existing PAT_1 token, or fall back to the dummy token:

```bash
# If PAT_1 is already set, it will be used
export PAT_1="ghp_real_token_here"
./test.sh base

# If PAT_1 is not set, test.sh sets "test_pat_token"
./test.sh base
```

## Why is PAT_1 Required?

The GitHub Readme Stats API handlers perform early validation to ensure GitHub tokens are configured before making API calls. This validation happens even when API responses are mocked in tests.

The handlers check for `process.env.PAT_1` (and additional tokens PAT_2, PAT_3, etc.) during initialization. Without at least one token, the handler returns an error SVG instead of processing the request.

## Test Environment Variables

The following environment variables affect test behavior:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PAT_1` | Yes | `test_pat_token` (via test.sh) | GitHub API token for authentication |
| `CACHE_SECONDS` | No | `undefined` | Override default cache TTL |
| `FETCH_MULTI_PAGE_STARS` | No | `undefined` | Enable multi-page star fetching |

## Troubleshooting

### Tests fail with "No GitHub API tokens found"

**Cause:** PAT_1 is not set in the environment.

**Solution:** Use `./test.sh base` instead of `npm test` directly, or export PAT_1 manually:
```bash
export PAT_1="test_pat_token"
npm test -- tests/api.test.js
```

### Tests pass locally but fail in CI

**Cause:** CI environment doesn't have PAT_1 set and doesn't use test.sh.

**Solution:** Update CI configuration to either:
1. Use `./test.sh base` and `./test.sh new`, or
2. Set `PAT_1=test_pat_token` in CI environment variables

### Mock responses are being used but tests still fail

**Cause:** Token validation happens before mocked HTTP calls.

**Solution:** This is expected behavior. The PAT_1 token just needs to exist - it doesn't need to be a valid GitHub token since API calls are mocked. Use the dummy token provided by test.sh.

## Test Patch Application

When applying the test.patch file:

```bash
# Apply patch (includes test.sh and api-compare.test.js)
git apply test.patch

# Make test.sh executable
chmod +x test.sh

# Run baseline tests
./test.sh base
```

The patch includes:
1. `test.sh` - Test runner with automatic PAT_1 setup
2. `tests/api-compare.test.js` - New comparison API tests

Both files are configured to work together without requiring manual environment setup.

## Best Practices

1. **Always use test.sh for running tests** - It handles environment setup automatically
2. **Don't commit real GitHub tokens** - Use the dummy token for testing
3. **In production** - Real PAT tokens should be set via secure environment variables
4. **In development** - Use `.env` file with real tokens for integration testing (not tracked in git)

## Example: Complete Test Workflow

```bash
# Clone repository
git clone <repo-url>
cd <repo>

# Apply test patch
git apply test.patch
chmod +x test.sh

# Run baseline tests (should PASS)
./test.sh base

# Implement compare API in /api/compare.js
# (implementation goes here)

# Run new tests (should PASS after implementation)
./test.sh new

# Run all tests
npm test
```

No manual environment variable setup is required when using test.sh!
