# Reconciliation Analysis: Tests vs Specification

## Executive Summary

The reviewer's feedback is **CORRECT**. There is a fundamental mismatch between the specification (PR #2, commit 983b63a) and the implementation/tests (PR #3, commits 2cd2c55 and 68146db).

## Key Misalignments

### 1. Parameter Interface (ERROR)

**Specification says:**
- Parameters: `user1`, `user2`, `user3`, `user4`, `user5` (individual query params)
- Example: `?user1=alice&user2=bob&user3=charlie`

**Implementation/Tests use:**
- Parameter: `usernames` (single CSV string)
- Example: `?usernames=alice,bob,charlie`

**Impact:** API interface is completely different from spec.

### 2. Format Options (ERROR)

**Specification says:**
- Valid formats: `detailed`, `compact`, `leaderboard`
- All responses are JSON with different structures

**Implementation/Tests use:**
- Valid formats: `json`, `markdown`
- Markdown returns plain text, not JSON

**Impact:** Output formats don't match spec at all.

### 3. Response Structure (ERROR)

**Specification shows:**
```json
{
  "comparison": {
    "users": ["alice", "bob"],
    "timestamp": "...",
    "cached": false
  },
  "data": { ... },
  "diff": { ... },
  "summary": { ... }
}
```

**Implementation returns:**
```json
{
  "leader": "user2",
  "comparisons": [...],
  "diffs": {...}
}
```

**Impact:** Response structure is completely different.

### 4. File Structure (WARNING)

**Specification implies:**
- Detailed architecture with multiple modules
- File location `/src/comparison/*.js` suggested in context

**Implementation uses:**
- Single file `/src/compare.js`
- Functions: `compareUsers()`, `formatComparison()`

**Impact:** Tests are coupled to implementation details (importing specific functions).

### 5. Missing Test Coverage (ERROR)

**Specification requires testing:**
- ✗ `detailed`, `compact`, `leaderboard` formats
- ✗ `stats` parameter filtering
- ✗ `exclude_repo` parameter
- ✗ `include_all_commits` parameter
- ✗ `cache_seconds` parameter
- ✗ Percentage difference calculations
- ✗ Leader identification per metric
- ✗ Unknown format errors
- ✗ Unknown stats errors
- ✗ Whitelist/blacklist behavior

**Tests actually cover:**
- ✓ Basic validation (missing params, count limits)
- ✓ Two-user comparison
- ✓ Three-user comparison
- ✓ Error handling
- ✓ Cache headers (basic)
- ✓ Markdown format (not in spec!)

**Impact:** Major spec requirements are untested.

## Recommendations

### Must Fix (Breaking Issues)

1. **Change parameter interface** from `usernames` CSV to `user1`, `user2`, etc.
2. **Replace `markdown` format** with `detailed`, `compact`, `leaderboard` formats
3. **Update response structure** to match spec exactly
4. **Add missing test cases** for all spec requirements
5. **Remove implementation detail tests** (don't import/test `compareUsers`, `formatComparison` directly)

### Should Fix (Quality Issues)

1. **Decouple tests from implementation** - test the API endpoint behavior only
2. **Add validation tests** for unknown formats and stats
3. **Add cache behavior tests** with different `cache_seconds` values
4. **Test percentage calculations** explicitly

### Could Fix (Nice to Have)

1. Update spec to be more specific about file structure expectations
2. Add integration tests for the full API flow
3. Document decision rationale for parameter style choice

## Action Plan

Since we're on branch `reconcile-tests-and-spec`, the task is to fix this mismatch. The spec (PR #2) is the authoritative source, so we need to:

1. ✅ Create this analysis document
2. ⬜ Update implementation to match spec parameters (`user1`, `user2`, etc.)
3. ⬜ Implement `detailed`, `compact`, `leaderboard` formats (remove `markdown`)
4. ⬜ Update response structure to match spec
5. ⬜ Rewrite tests to match spec requirements
6. ⬜ Add missing test coverage
7. ⬜ Ensure tests focus on API behavior, not implementation details

## Conclusion

The reviewer's analysis is accurate and thorough. Both the problem description (spec) and the tests/implementation need significant changes to be reconciled into a coherent, implementable feature.
