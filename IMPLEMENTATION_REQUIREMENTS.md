# Critical Implementation Requirements

## ⚠️ MANDATORY: These Requirements Must Be Implemented

The test suite validates specific behaviors that are **non-negotiable**. Failing to implement these will cause test failures.

---

## 0. 🚨 Validate user count (2-5 users) - REQUIRED

### Why This Matters

The API must compare at least two users and at most five users. The tests enforce:
- 400 error if fewer than two users are provided
- 400 error if `user6`, `user7`, etc. are supplied

### How to Implement

```javascript
const extractUsernames = (query) => {
  const usernames = [];

  // Reject user6, user7, ...
  const hasExtraUsers = Object.keys(query).some((key) =>
    /^user([6-9]|\d{2,})$/.test(key),
  );
  if (hasExtraUsers) {
    throw new Error("Please provide up to 5 users");
  }

  for (let i = 1; i <= 5; i++) {
    const value = query[`user${i}`];
    if (value) usernames.push(value.trim());
  }

  if (usernames.length < 2) {
    throw new Error("Please provide at least 2 users (user1 and user2)");
  }

  return usernames;
};
```

### Pitfalls to Avoid
- ❌ Ignoring `user6` parameters (tests expect 400)
- ❌ Allowing duplicate or empty usernames without validation
- ✅ Return clear error messages mentioning "up to 5 users"

---

## 1. 🚨 MUST Call guardAccess() - REQUIRED

### Why This Matters

The tests mock `guardAccess()` and expect it to be invoked to handle:
- Rate limiting (429 responses)
- Blacklist checks (403 responses)
- PAT token validation (401 responses)

**If you don't call guardAccess(), these tests will FAIL:**
- ✗ `returns 429 when rate limited`
- ✗ `blocks blacklisted usernames via guardAccess`
- ✗ `rejects invalid PAT tokens before processing`

### How to Implement

```javascript
import { guardAccess } from "../src/common/access.js";

export default async (req, res) => {
  const { user1, user2, user3, user4, user5 } = req.query;
  
  // 🚨 CRITICAL: Call guardAccess FIRST
  // This must happen before ANY other processing
  const access = guardAccess({
    res,
    id: [user1, user2, user3, user4, user5].filter(Boolean).join(","),
    type: "comparison",
    colors: {
      // Pass through any theme colors from req.query
    },
  });
  
  if (!access.isPassed) {
    return access.result; // Returns 429, 403, or 401
  }
  
  // Only proceed if guardAccess passed
  // ... rest of handler logic
};
```

### guardAccess Return Value

```typescript
{
  isPassed: boolean;  // true if access is granted
  result: Response;   // Pre-built error response if isPassed is false
}
```

### ❌ DO NOT Implement Custom Access Control

**WRONG - This will fail tests:**
```javascript
// ❌ DON'T DO THIS - Custom blacklist check
const blacklist = ["renovate-bot", "dependabot"];
if (blacklist.includes(user1)) {
  return res.status(403).json({ message: "Blacklisted" });
}
```

**CORRECT - Use guardAccess:**
```javascript
// ✅ DO THIS - Let guardAccess handle it
const access = guardAccess({ res, id: user1, type: "comparison" });
if (!access.isPassed) {
  return access.result;
}
```

---

## 2. 🚨 MUST Implement In-Memory Caching - REQUIRED

### Why This Matters

The tests verify actual cache behavior by:
1. Making a request (expects `cached: false`, fetchStats called)
2. Making the same request again (expects `cached: true`, fetchStats NOT called)

**If you don't implement caching, this test will FAIL:**
- ✗ `marks repeated requests as cached without refetching`

### Cache Requirements

1. **Cache Key Format:** `compare:user1,user2,...:optionsHash`
2. **Storage:** In-memory Map (process-scoped)
3. **TTL:** Respect `cache_seconds` parameter
4. **Cached Flag:** Set `cached: true/false` in detailed format response

### How to Implement

```javascript
// Module-level cache (persists across requests)
const compareCache = new Map();

function getCacheKey(users, options) {
  const userKey = users.join(",");
  const optionsKey = JSON.stringify({
    format: options.format || "detailed",
    stats: options.stats || "all",
    include_all_commits: options.include_all_commits,
    exclude_repo: options.exclude_repo,
  });
  const hash = createHash("md5").update(optionsKey).digest("hex").slice(0, 8);
  return `compare:${userKey}:${hash}`;
}

export default async (req, res) => {
  // ... guardAccess call first ...
  
  const users = [user1, user2, user3, user4, user5].filter(Boolean);
  const cacheKey = getCacheKey(users, req.query);
  
  // 🚨 CRITICAL: Check cache BEFORE fetching
  const cached = compareCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    // Mark as cached in detailed format
    if (req.query.format === "detailed" || !req.query.format) {
      cached.data.comparison.cached = true;
    }
    
    setCacheHeaders(res, cached.ttl);
    return res.status(200).json(cached.data);
  }
  
  // Fetch fresh data
  const statsPromises = users.map(username => 
    fetchStats(
      username,
      parseBoolean(req.query.include_all_commits),
      parseArray(req.query.exclude_repo),
      // ... other fetchStats parameters
    )
  );
  
  const statsResults = await Promise.all(statsPromises);
  
  // Build response
  const response = buildComparisonResponse(users, statsResults, req.query);
  
  // Mark as NOT cached for first fetch
  if (req.query.format === "detailed" || !req.query.format) {
    response.comparison.cached = false;
  }
  
  // 🚨 CRITICAL: Store in cache
  const ttl = resolveCacheSeconds({
    requested: parseInt(req.query.cache_seconds, 10),
    def: CACHE_TTL.STATS_CARD.DEFAULT,
    min: CACHE_TTL.STATS_CARD.MIN,
    max: CACHE_TTL.STATS_CARD.MAX,
  });
  
  compareCache.set(cacheKey, {
    data: response,
    expiry: Date.now() + (ttl * 1000),
    ttl,
  });
  
  setCacheHeaders(res, ttl);
  return res.status(200).json(response);
};
```

### ❌ DO NOT Only Set Cache Headers

**WRONG - This will fail tests:**
```javascript
// ❌ DON'T DO THIS - Only headers, no actual cache
setCacheHeaders(res, cacheSeconds);
return res.json(response);  // No Map storage = test fails
```

**CORRECT - Implement actual caching:**
```javascript
// ✅ DO THIS - Store in Map and check it
const cached = compareCache.get(cacheKey);
if (cached) {
  cached.data.comparison.cached = true;
  return res.json(cached.data);  // No fetchStats call
}
// ... fetch and store ...
compareCache.set(cacheKey, { data, expiry, ttl });
```

### Cache Validation in Tests

The test does this:
```javascript
// First request
await handler({ query: { user1: "alice", user2: "bob" } }, firstRes);
expect(firstPayload.comparison.cached).toBe(false);

fetchStatsMock.mockClear();

// Second request - SAME parameters
await handler({ query: { user1: "alice", user2: "bob" } }, secondRes);
expect(secondPayload.comparison.cached).toBe(true);
expect(fetchStatsMock).not.toHaveBeenCalled();  // 🚨 Must not refetch
```

---

## 3. Required Response Structure

### Detailed Format (default)

```javascript
{
  comparison: {
    users: ["alice", "bob"],
    timestamp: new Date().toISOString(),  // ISO-8601 required
    cached: false,  // 🚨 MUST set based on cache hit/miss
    stats_compared: ["all"] // or filtered list
  },
  data: {
    alice: { /* fetchStats result */ },
    bob: { /* fetchStats result */ }
  },
  diff: {
    totalCommits: {
      alice: 200,
      bob: 150,
      difference: 50,
      percentage: 33.33,  // 🚨 MUST calculate percentage
      leader: "alice"
    },
    // ... other stats
  },
  summary: {
    overall_leader: "alice",
    stats_won: { alice: 8, bob: 2 },
    close_stats: ["mergedPRsPercentage"],
    significant_differences: ["totalStars"]
  }
}
```

### Compact Format

```javascript
{
  users: ["alice", "bob"],
  timestamp: new Date().toISOString(),
  diff: {
    totalCommits: {
      alice: 200,
      bob: 150,
      delta: 50,  // Note: "delta" not "difference"
      leader: "alice"
    }
  },
  leader: "alice"
}
```

### Leaderboard Format

```javascript
{
  leaderboard: [
    {
      rank: 1,  // Must be sorted ascending
      username: "alice",
      name: "Alice Doe",
      totalScore: 12345,  // or "score" object
      stats: { /* all stats */ }
    },
    { rank: 2, ... },
    { rank: 3, ... }
  ],
  timestamp: new Date().toISOString()
}
```

---

## 4. Error Handling Requirements

### Sanitize Sensitive Information

```javascript
try {
  // ... handler logic
} catch (err) {
  // 🚨 MUST strip sensitive data
  let message = err.message || "Internal server error";
  
  // Remove tokens
  message = message.replace(/ghp_[a-zA-Z0-9]+/gi, "[REDACTED]");
  message = message.replace(/token:\s*[^\s]+/gi, "token: [REDACTED]");
  
  // Remove file paths
  message = message.replace(/\/[^\s]+\.js:\d+/g, "[PATH]");
  
  return res.status(500).json({
    message: message,
    error: "Internal Server Error"
  });
}
```

Tests verify:
```javascript
const responseString = JSON.stringify(payload);
expect(responseString).not.toMatch(/ghp_/i);
expect(responseString).not.toMatch(/token:/i);
expect(responseString).not.toMatch(/\/internal\/path/);
```

---

## 5. Parameter Handling

### fetchStats() Signature

```javascript
fetchStats(
  username,           // string
  include_all_commits, // boolean - affects totalCommits
  exclude_repo,        // array - affects totalStars
  include_merged_pull_requests, // boolean
  include_discussions, // boolean
  include_discussions_answers, // boolean
  commits_year        // number or undefined
)
```

### Observable Effects Required

Tests verify that parameters change outputs:

**include_all_commits:**
```javascript
// Test expects different commit counts
fetchStats("alice", true, ...) // returns totalCommits: 999
fetchStats("alice", false, ...) // returns totalCommits: 123
```

**exclude_repo:**
```javascript
// Test expects different star counts
fetchStats("alice", false, ["repo1", "repo2"], ...) // returns totalStars: 50
fetchStats("alice", false, [], ...) // returns totalStars: 120
```

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Skipping guardAccess

```javascript
// ❌ WRONG - Tests will fail
export default async (req, res) => {
  // Custom validation instead of guardAccess
  if (req.rateLimit > 100) {
    return res.status(429).json(...);
  }
}
```

### ❌ Mistake 2: Only HTTP Caching

```javascript
// ❌ WRONG - Tests will fail
setCacheHeaders(res, 3600);  // Only sets headers
return res.json(response);   // No Map storage
```

### ❌ Mistake 3: Not Marking Cached Flag

```javascript
// ❌ WRONG - Tests will fail
const cached = compareCache.get(key);
if (cached) {
  // Missing: cached.data.comparison.cached = true;
  return res.json(cached.data);
}
```

### ❌ Mistake 4: Calling fetchStats on Cache Hit

```javascript
// ❌ WRONG - Tests will fail
const cached = compareCache.get(key);
if (cached) {
  // Still calling fetchStats even though we have cached data
  const stats = await fetchStats(...);  // ❌ NO!
  return res.json(cached.data);
}
```

### ❌ Mistake 5: Missing Percentage Calculation

```javascript
// ❌ WRONG - Tests will fail
diff: {
  totalStars: {
    alice: 100,
    bob: 150,
    difference: 50,
    // Missing: percentage: 50.0
    leader: "bob"
  }
}
```

---

## Validation Checklist

Before submitting, verify:

- [ ] Handler calls `guardAccess()` as the FIRST operation
- [ ] Handler returns `access.result` immediately if `!access.isPassed`
- [ ] Handler validates minimum 2 users and maximum 5 users
- [ ] Handler rejects user6+ parameters with 400 status
- [ ] Handler implements `Map`-based caching with cache keys
- [ ] Cache keys include users, format, include_all_commits, exclude_repo
- [ ] Cache checks happen BEFORE calling `fetchStats()`
- [ ] `cached: false` on first request, `cached: true` on second
- [ ] `fetchStats()` is NOT called on cache hit
- [ ] Different options (format, include_all_commits, exclude_repo) create distinct cache entries
- [ ] All three formats include valid ISO-8601 timestamps
- [ ] Detailed format includes percentage calculations in diff
- [ ] Summary classifies close stats (<10%) and significant differences (>50%)
- [ ] Error responses strip tokens and file paths
- [ ] Parameters (`include_all_commits`, `exclude_repo`) are passed to `fetchStats()`

---

## Testing Your Implementation

```bash
# Run tests that check guardAccess behavior
npm test -- tests/api-compare.test.js -t "access control"

# Run tests that check caching behavior
npm test -- tests/api-compare.test.js -t "caching"

# Run tests that check percentage calculations
npm test -- tests/api-compare.test.js -t "percentage"

# Run all tests
./test.sh new
```

If any test fails, refer back to this document for the exact requirements!
