# Test Decoupling Summary

## Problem

The original tests for `/api/compare` suffered from tight coupling to implementation details:

1. **Hardcoded error codes**: Tests enforced specific error code constants (e.g., `MISSING_PARAMS`, `INVALID_FORMAT`, `USER_NOT_FOUND`) that were not part of the public API contract
2. **Rigid response structure**: Tests required exact field names and nested structures beyond what was necessary for behavioral validation
3. **Internal implementation details**: Tests mocked axios directly and enforced specific GraphQL call patterns, coupling tests to how data is fetched rather than what is returned
4. **Unclear interface contract**: The specification didn't clearly define what was guaranteed vs. what was implementation-specific

## Solution

### 1. Test Refactoring (`tests/api-compare.test.js`)

**Key Changes:**
- **Flexible error assertions**: Changed from `code: "MISSING_PARAMS"` to `message: expect.stringMatching(/user/i)` - tests that errors are informative without enforcing specific internal codes
- **Behavioral matchers**: Use `expect.any(String)`, `expect.any(Number)`, `expect.objectContaining()` instead of exact value matching
- **Structure validation**: Verify expected fields exist and have reasonable values, but don't enforce extra internal fields
- **Helper functions**: Introduced `createMockStatsResponse()`, `createMockResponse()`, `invokeCompare()`, and `getJsonPayload()` to abstract test infrastructure
- **Null safety**: Added `expect(payload).toBeDefined()` checks before accessing nested properties
- **Public API focus**: Tests verify HTTP status codes, response format adherence, and correct leader calculation without assuming internal implementation

**What Tests Now Validate:**
- ✅ HTTP status codes (200, 400, 404, 500)
- ✅ Error messages are present and informative
- ✅ Response structure matches one of three defined formats (detailed/compact/leaderboard)
- ✅ Leaders are correctly identified (highest value wins)
- ✅ Cache headers are set appropriately
- ✅ Parameters are respected (stats filtering, include_all_commits, etc.)
- ✅ ISO-8601 timestamps are valid

**What Tests NO LONGER Enforce:**
- ❌ Specific error code constants
- ❌ Exact internal field names beyond public contract
- ❌ How data is fetched (axios implementation details)
- ❌ Specific GraphQL variable names or query structure
- ❌ Internal calculation algorithms (only verify correctness)

### 2. API Specification (`COMPARE_API_SPEC.md`)

Created a comprehensive specification that:
- **Defines the public interface contract**: Query parameters, response formats, status codes
- **Separates MUST from SHOULD**: Clear requirements vs. recommendations
- **Documents behavioral expectations**: What behavior tests should validate
- **Test assumptions section**: Explicitly states what tests assume vs. don't assume
- **Implementation guidelines**: How to build the feature while maintaining flexibility

### 3. Testing Pattern Documentation

Updated repository memory with best practices for writing behavior-focused tests:
- Focus on public API contracts
- Use flexible matchers
- Don't hardcode internal details
- Test outcomes, not implementations
- Create helpers for mock infrastructure

## Benefits

1. **Decoupled**: Implementation can change (e.g., switch from axios to fetch, change error codes, add new fields) without breaking tests
2. **Clear contract**: Specification explicitly defines what is guaranteed API surface
3. **Maintainable**: Tests are easier to read and modify
4. **Flexible**: Implementers have freedom in how they solve the problem
5. **Robust**: Tests validate actual correctness rather than arbitrary internal details

## Files Changed

- `tests/api-compare.test.js` - Refactored test suite with behavioral focus
- `COMPARE_API_SPEC.md` - New specification document defining the API contract
- `TEST_DECOUPLING_SUMMARY.md` - This document

## Verification

Tests can be run with:
```bash
npm test tests/api-compare.test.js
```

The tests will fail until the `/api/compare.js` handler is implemented, but they now test the correct behavioral contract rather than internal implementation details.
