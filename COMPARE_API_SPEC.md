# Compare API Specification

## Overview

The `/api/compare` endpoint allows comparing GitHub statistics between 2-5 users. This document defines the behavioral contract for this feature.

## Endpoint

**Path:** `/api/compare`  
**Method:** `GET`

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user1` | string | Yes | First GitHub username |
| `user2` | string | Yes | Second GitHub username |
| `user3` | string | No | Optional third user |
| `user4` | string | No | Optional fourth user |
| `user5` | string | No | Optional fifth user |
| `format` | string | No | Response format: `detailed` (default), `compact`, or `leaderboard` |
| `stats` | string | No | Comma-separated list of stats to compare (default: all) |
| `include_all_commits` | boolean | No | Include all commits, not just last year (default: false) |
| `exclude_repo` | string | No | Comma-separated list of repositories to exclude |
| `cache_seconds` | number | No | Cache duration in seconds |

### Supported Stats

- `commits` - Total commits
- `prs` - Total pull requests
- `prs_merged` - Merged pull requests
- `reviews` - Pull request reviews
- `issues` - Issues created
- `stars` - Total stars received
- `discussions` - Discussions started
- `discussions_answered` - Discussions answered
- `contributed_to` - Repositories contributed to
- `rank` - GitHub rank
- `all` - All available stats (default)

## Response Formats

### Status Codes

- **200 OK** - Successful comparison
- **400 Bad Request** - Invalid parameters (e.g., fewer than 2 users, unsupported format, invalid stats filter)
- **404 Not Found** - One or more users not found
- **500 Internal Server Error** - Unexpected server error

### Error Response

All error responses SHOULD include:
```json
{
  "message": "Human-readable error description",
  "error": "Optional error details"
}
```

Additional fields MAY be included for debugging but are not guaranteed.

### Success Response - Detailed Format (default)

When `format=detailed` or no format is specified:

```json
{
  "comparison": {
    "users": ["username1", "username2", ...],
    "timestamp": "ISO-8601 timestamp",
    "cached": boolean,
    "stats_compared": ["list of stats"]
  },
  "data": {
    "username1": {
      "name": "User's display name",
      "totalCommits": number,
      "totalPRs": number,
      "totalStars": number,
      ... other stats
    },
    "username2": { ... }
  },
  "diff": {
    "totalCommits": {
      "username1": number,
      "username2": number,
      "difference": number,
      "percentage": number,
      "leader": "username"
    },
    ... other stats
  },
  "summary": {
    "overall_leader": "username",
    "stats_won": {
      "username1": number,
      "username2": number
    },
    "close_stats": ["stat names where users are close"],
    "significant_differences": ["stat names with large gaps"]
  }
}
```

### Success Response - Compact Format

When `format=compact`:

```json
{
  "users": ["username1", "username2", ...],
  "timestamp": "ISO-8601 timestamp",
  "diff": {
    "totalCommits": {
      "username1": number,
      "username2": number,
      "delta": number,
      "leader": "username"
    },
    ... other stats
  },
  "leader": "overall leader username"
}
```

### Success Response - Leaderboard Format

When `format=leaderboard`:

```json
{
  "leaderboard": [
    {
      "rank": number (1-indexed),
      "username": "string",
      "name": "User's display name",
      "score": number | object,
      "stats": {
        "totalCommits": number,
        "totalPRs": number,
        ...
      }
    },
    ...
  ],
  "timestamp": "ISO-8601 timestamp"
}
```

## Behavioral Requirements

### Parameter Validation

1. **MUST** return 400 if fewer than 2 users are provided
2. **MUST** accept 2-5 users (user1 through user5)
3. **MUST** return 400 for unsupported format values
4. **MUST** return 400 if stats filter contains invalid stat names
5. **SHOULD** sanitize usernames to prevent injection attacks

### Data Fetching

1. **MUST** fetch stats for all requested users
2. **SHOULD** use existing `fetchStats` abstraction where possible
3. **MUST** respect the `include_all_commits` parameter
4. **MUST** respect the `exclude_repo` parameter
5. **MAY** fetch data in parallel for performance

### Response Generation

1. **MUST** identify leaders for each stat metric
2. **MUST** calculate differences between users
3. **MUST** determine an overall leader
4. **SHOULD** identify close stats (small percentage difference)
5. **SHOULD** identify significant differences (large percentage difference)
6. **MUST** include valid ISO-8601 timestamps
7. **MUST** sort leaderboard entries by rank (ascending)

### Caching

1. **MUST** set appropriate Cache-Control headers
2. **SHOULD** use default cache TTL consistent with other endpoints
3. **MUST** respect custom `cache_seconds` parameter
4. **SHOULD** indicate whether response is cached via `cached` field (detailed format)

### Error Handling

1. **MUST** return 404 if any user cannot be found
2. **MUST** return 500 for unexpected errors
3. **MUST** include descriptive error messages
4. **SHOULD** log errors for debugging
5. **MUST NOT** expose sensitive information (tokens, internal paths)

### Access Control

1. **SHOULD** apply existing blacklist/whitelist logic to all usernames
2. **SHOULD** respect rate limiting
3. **SHOULD** validate PAT tokens if required

## Test Assumptions

Tests validate behavioral contracts, not implementation details:

1. HTTP status codes are correct for various scenarios
2. Response structure matches one of the defined formats
3. Leaders are correctly identified (highest value wins)
4. Differences and percentages are numerically reasonable
5. Timestamps are valid ISO-8601 strings
6. Error messages are informative

Tests do NOT assume:
- Specific internal field names beyond public API
- Specific error code constants (e.g., "MISSING_PARAMS")
- How data is fetched internally (axios, fetch, etc.)
- Exact data fetching order
- Internal caching mechanisms beyond headers
- Specific calculation algorithms beyond correctness

## Implementation Guidelines

1. Handler MUST be exported as default from `/api/compare.js`
2. Handler signature: `async function(req, res)` (Express/Vercel style)
3. Use existing utilities from `src/` for consistency
4. Follow existing code conventions and patterns
5. Reuse `fetchStats` from `src/fetchers/stats.js` when possible
