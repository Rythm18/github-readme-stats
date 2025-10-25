# Test Decoupling Summary

## Problem

The original tests for `/api/compare` suffered from tight coupling to implementation details:

1. **Hardcoded error codes**: Tests enforced specific error code constants (e.g., `MISSING_PARAMS`, `INVALID_FORMAT`, `USER_NOT_FOUND`) that were not part of the public API contract
2. **Rigid response structure**: Tests required exact field names and nested structures beyond what was necessary for behavioral validation
3. **Low-level implementation details**: Tests mocked axios at the HTTP client level, coupling them to how data is fetched rather than what abstraction is used
4. **Unclear interface contract**: The specification didn't clearly define what was guaranteed vs. what was implementation-specific
5. **Missing behaviors**: Tests didn't cover important requirements like rate limiting (429), percentage fields, cached indicators, and observable effects of parameters

## Solution

### 1. Test Refactoring (`tests/api-compare.test.js`)

**Key Changes:**
- **Mock at abstraction level**: Changed from mocking axios directly to mocking `fetchStats()` and `guardAccess()` - the public abstractions used by the implementation
- **Flexible error assertions**: Changed from `code: "MISSING_PARAMS"` to `message: expect.stringMatching(/user/i)` - tests that errors are informative without enforcing specific internal codes
- **Behavioral matchers**: Use `expect.any(String)`, `expect.any(Number)`, `expect.objectContaining()` instead of exact value matching
- **File extension flexibility**: Dynamic import that tries both `.js` and `.ts` extensions
- **Parameter effect validation**: Tests verify observable effects (e.g., when `include_all_commits` is true, commit counts change)
- **Complete coverage**: Added tests for rate limiting (429), percentage fields, cached indicators, and stats filtering

**What Tests Now Validate:**
- ✅ HTTP status codes (200, 400, 404, 429, 500)
- ✅ Error messages are present and informative
- ✅ Response structure matches one of three defined formats (detailed/compact/leaderboard)
- ✅ Leaders are correctly identified (highest value wins)
- ✅ Percentage differences are computed and included
- ✅ Cached indicator is present in detailed format
- ✅ Cache headers are set appropriately
- ✅ Parameters have observable effects (include_all_commits, exclude_repo, stats filtering)
- ✅ ISO-8601 timestamps are valid across all formats
- ✅ Cached flag semantics (first miss, subsequent hit) are enforced
- ✅ Rate limiting returns 429 and guard-based denials are respected (blacklist, invalid PAT)
- ✅ Responses strip sensitive details from error messages

**What Tests NO LONGER Enforce:**
- ❌ Specific error code constants
- ❌ Exact internal field names beyond public contract
- ❌ HTTP client implementation (axios vs fetch vs other)
- ❌ Specific GraphQL endpoint URLs or query structure
- ❌ Internal calculation algorithms (only verify correctness)
- ❌ File extension (.js vs .ts)

**Testing Approach:**
The tests now mock at the **abstraction boundary** (`fetchStats` and `guardAccess`) rather than at the HTTP client level. This allows:
- Implementation freedom in how data is fetched
- Testing against the same interface the handler will use
- Focus on the handler's logic rather than data fetching mechanics
- Compatibility with both JavaScript and TypeScript implementations

### 2. API Specification (`COMPARE_API_SPEC.md`)

Created a comprehensive specification that:
- **Defines the public interface contract**: Query parameters, response formats, status codes
- **Separates MUST from SHOULD**: Clear requirements vs. recommendations
- **Documents behavioral expectations**: What behavior tests should validate
- **Test assumptions section**: Explicitly states what tests assume vs. don't assume
- **Implementation guidelines**: How to build the feature while maintaining flexibility

### 3. Testing Pattern Documentation

Updated repository memory with best practices for writing behavior-focused tests:
- Mock at abstraction boundaries, not HTTP clients
- Focus on public API contracts
- Use flexible matchers
- Don't hardcode internal details
- Test outcomes and observable effects
- Support multiple file extensions
- Create helpers for mock infrastructure

## Benefits

1. **Decoupled**: Implementation can change HTTP clients, error codes, add fields, or switch languages without breaking tests
2. **Clear contract**: Specification explicitly defines what is guaranteed API surface
3. **Maintainable**: Tests are easier to read and modify
4. **Flexible**: Implementers have freedom in how they solve the problem
5. **Robust**: Tests validate actual correctness rather than arbitrary internal details
6. **Complete**: All documented behaviors are now tested (rate limiting, percentage, cached flag, parameter effects)

## Files Changed

- `tests/api-compare.test.js` - Refactored test suite with behavioral focus and abstraction-level mocking
- `test.patch` - Patch file containing test.sh runner (with automatic PAT setup) and test suite
- `test.sh` - Test runner script that exports a dummy PAT_1 token when not provided
- `COMPARE_API_SPEC.md` - Specification document defining the API contract
- `TEST_DECOUPLING_SUMMARY.md` - This document

## Verification

### Using test.sh (Recommended)

The test runner automatically configures the required PAT_1 token:

```bash
./test.sh base    # Run existing baseline tests (should pass)
./test.sh new     # Run new compare tests (will fail until implementation exists)
```

### Manual Execution

If running tests manually, set a dummy PAT token first:

```bash
export PAT_1="test_pat_token"
npm test tests/api-compare.test.js
```

### Important Note

The tests require `PAT_1` to be set because the API handlers validate token presence during initialization. The test.sh script handles this automatically by setting a dummy token when one isn't provided.

See `TEST_SETUP.md` for troubleshooting "No GitHub API tokens found" errors.

The new tests will fail until the `/api/compare.js` (or `.ts`) handler is implemented, but they now test the correct behavioral contract rather than internal implementation details.

## How to Implement

The implementation should:
1. Export a default handler function from `/api/compare.js` or `/api/compare.ts`
2. Use `fetchStats()` from `src/fetchers/stats.js` to get user data
3. Use `guardAccess()` from `src/common/access.js` for access control and rate limiting
4. Follow the response formats defined in COMPARE_API_SPEC.md
5. Include percentage calculations in detailed diff format
6. Add a `cached` boolean to the comparison object in detailed format
7. Filter stats based on the `stats` parameter and reflect this in `stats_compared`
8. Pass parameters like `include_all_commits` and `exclude_repo` through to `fetchStats()`

The tests will validate behavior without constraining implementation choices.
