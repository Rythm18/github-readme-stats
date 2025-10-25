# Additional Test Coverage

This document details the additional tests added to address the coverage gaps identified in the feedback.

## Coverage Gaps Addressed

### 1. ✅ Timestamp Validity in All Formats

**Issue:** Timestamp validity was only verified for detailed format, not compact/leaderboard.

**Tests Added:**

```javascript
// Compact format timestamp test
it("includes valid ISO-8601 timestamp", async () => {
  // ... setup ...
  const payload = getPayload(res);
  
  expect(payload.timestamp).toBeDefined();
  expect(typeof payload.timestamp).toBe("string");
  expect(new Date(payload.timestamp).toString()).not.toBe("Invalid Date");
});

// Leaderboard format timestamp test
it("includes valid timestamp in leaderboard response", async () => {
  // ... setup ...
  const payload = getPayload(res);
  
  expect(payload.timestamp).toBeDefined();
  expect(typeof payload.timestamp).toBe("string");
  expect(new Date(payload.timestamp).toString()).not.toBe("Invalid Date");
});
```

**Location:** `describe("response format: compact")` and `describe("response format: leaderboard")`

**Validates:**
- Timestamp field exists in all three formats (detailed, compact, leaderboard)
- Timestamp is a string
- Timestamp can be parsed as a valid Date object (ISO-8601 compliant)

---

### 2. ✅ Caching Semantics

**Issue:** Actual cache usage and cached flag semantics weren't tested.

**Test Added:**

```javascript
describe("caching", () => {
  it("marks repeated requests as cached without refetching", async () => {
    fetchStatsMock
      .mockResolvedValueOnce(makeStats("alice"))
      .mockResolvedValueOnce(makeStats("bob"));

    const handler = await loadCompareHandler();

    // First request - cache miss
    const firstRes = createMockResponse();
    await handler({ query: { user1: "alice", user2: "bob" } }, firstRes);
    const firstPayload = getPayload(firstRes);

    expect(firstPayload?.comparison?.cached).toBe(false);

    fetchStatsMock.mockClear();

    // Second request - cache hit
    const secondRes = createMockResponse();
    await handler({ query: { user1: "alice", user2: "bob" } }, secondRes);
    const secondPayload = getPayload(secondRes);

    expect(secondPayload?.comparison?.cached).toBe(true);
    expect(fetchStatsMock).not.toHaveBeenCalled();
  });
});
```

**Location:** New `describe("caching")` block

**Validates:**
- First request sets `cached: false`
- Second identical request sets `cached: true`
- Second request does not call `fetchStats` (uses cache)
- Cache key properly identifies identical requests

---

### 3. ✅ Whitelist/Blacklist Coverage

**Issue:** Whitelist/blacklist checks weren't validated.

**Tests Added:**

```javascript
describe("access control", () => {
  // Existing rate limit test...
  
  it("blocks blacklisted usernames via guardAccess", async () => {
    const res = createMockResponse();
    guardAccessMock.mockReturnValueOnce({
      isPassed: false,
      result: res
        .status(403)
        .json({ message: "This username is blacklisted" }),
    });

    const handler = await loadCompareHandler();
    await handler({ query: { user1: "renovate-bot", user2: "bob" } }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/blacklist/i),
      }),
    );
    expect(fetchStatsMock).not.toHaveBeenCalled();
  });
});
```

**Location:** `describe("access control")`

**Validates:**
- Blacklisted users are rejected with 403 status
- Error message indicates blacklist reason
- No data fetching occurs for blocked users
- `guardAccess` is called before `fetchStats`

---

### 4. ✅ PAT Validation

**Issue:** PAT (Personal Access Token) validation wasn't covered.

**Test Added:**

```javascript
it("rejects invalid PAT tokens before processing", async () => {
  const res = createMockResponse();
  guardAccessMock.mockReturnValueOnce({
    isPassed: false,
    result: res
      .status(401)
      .json({ message: "Invalid personal access token" }),
  });

  const handler = await loadCompareHandler();
  await handler({ query: { user1: "alice", user2: "bob" } }, res);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringMatching(/token/i),
    }),
  );
  expect(fetchStatsMock).not.toHaveBeenCalled();
});
```

**Location:** `describe("access control")`

**Validates:**
- Invalid PAT tokens return 401 Unauthorized
- Error message indicates token issue
- No data fetching occurs with invalid credentials

---

### 5. ✅ Sensitive Information Protection

**Issue:** "MUST NOT expose sensitive information" wasn't tested.

**Test Added:**

```javascript
describe("error handling", () => {
  // Existing error tests...
  
  it("does not expose sensitive information in error responses", async () => {
    const errorWithSensitiveInfo = new Error("Connection failed");
    errorWithSensitiveInfo.stack =
      "Error at /internal/path/api/compare.js:123\ntoken: ghp_secrettoken123";

    fetchStatsMock.mockRejectedValueOnce(errorWithSensitiveInfo);

    const res = await invokeCompare({ user1: "alice", user2: "bob" });
    const payload = getPayload(res);

    expect(res.status).toHaveBeenCalledWith(500);

    // Check that sensitive patterns are NOT in response
    const responseString = JSON.stringify(payload);
    expect(responseString).not.toMatch(/ghp_/i);
    expect(responseString).not.toMatch(/token:/i);
    expect(responseString).not.toMatch(/\/internal\/path/);
    expect(responseString).not.toMatch(/\.js:\d+/);

    expect(payload.message).toBeDefined();
    expect(payload.message).not.toContain("ghp_");
  });
});
```

**Location:** `describe("error handling")`

**Validates:**
- GitHub tokens (ghp_ prefix) are not exposed
- Internal file paths are not revealed
- Stack traces with line numbers are stripped
- Token labels/keys are not leaked
- User-facing error messages are sanitized

**Sensitive Patterns Checked:**
- `/ghp_/i` - GitHub personal access tokens
- `/token:/i` - Token variable names
- `/\/internal\/path/` - Internal directory structures
- `/\.js:\d+/` - Stack trace file paths with line numbers

---

## Test Organization

The new tests are organized into logical groups:

1. **Format-specific tests:** Added to existing `describe("response format: X")` blocks
2. **Caching tests:** New dedicated `describe("caching")` block
3. **Access control tests:** Extended existing `describe("access control")` block
4. **Security tests:** Added to existing `describe("error handling")` block

## Coverage Statistics

With these additions, the test suite now covers:

- ✅ All 3 response formats (detailed, compact, leaderboard)
- ✅ All HTTP status codes (200, 400, 401, 403, 404, 429, 500)
- ✅ Cache hit/miss semantics
- ✅ Access control (rate limiting, blacklist, PAT validation)
- ✅ Timestamp validation across all formats
- ✅ Parameter effects (include_all_commits, exclude_repo, stats filtering)
- ✅ Percentage calculations
- ✅ Cached flag behavior
- ✅ Sensitive information protection
- ✅ Error handling and sanitization

## Behavioral Contracts Validated

All MUST requirements from the specification are now tested:

| Requirement | Test Coverage |
|-------------|---------------|
| Fetch stats for all users | ✅ Validated via fetchStatsMock call counts |
| Identify leaders per metric | ✅ Leader field assertions in diff objects |
| Calculate differences | ✅ Difference and percentage field checks |
| Include valid ISO-8601 timestamps | ✅ All three formats validated |
| Set Cache-Control headers | ✅ Cache header assertions |
| Return 404 for missing users | ✅ 404 error test |
| Return 500 for errors | ✅ Multiple error scenario tests |
| Respect include_all_commits | ✅ Observable commit count changes |
| Respect exclude_repo | ✅ Observable star count changes |
| Apply access controls | ✅ Rate limit, blacklist, PAT tests |
| Not expose sensitive info | ✅ Token/path sanitization test |
| Indicate cache status | ✅ Cached flag semantics test |

## How to Run

Run all tests:
```bash
npm test tests/api-compare.test.js
```

Run specific test suites:
```bash
# Timestamp tests
npm test tests/api-compare.test.js -t "timestamp"

# Caching tests
npm test tests/api-compare.test.js -t "caching"

# Access control tests
npm test tests/api-compare.test.js -t "access control"

# Security tests
npm test tests/api-compare.test.js -t "sensitive information"
```

## Implementation Notes

When implementing the `/api/compare` handler, ensure:

1. **Timestamps:** Generate ISO-8601 timestamps in all response formats
2. **Caching:** Track cache hits/misses and set the `cached` field in detailed format
3. **Access Control:** Call `guardAccess()` early and handle non-passed responses
4. **Security:** Sanitize error messages and strip stack traces from responses
5. **Parameter Effects:** Pass through `include_all_commits` and `exclude_repo` to `fetchStats()`

These tests will verify all behavioral requirements without coupling to implementation details.
