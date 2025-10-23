# Stats Comparison/Diff Endpoint - Feature Specification

**Feature ID:** #9  
**Priority:** LOW  
**Complexity:** MEDIUM-HIGH  
**Impact:** LOW-MEDIUM  
**Estimated Effort:** 5-7 days  
**Status:** Proposed  
**Last Updated:** 2024

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Context and Background](#context-and-background)
- [Use Cases](#use-cases)
- [Solution Overview](#solution-overview)
- [Detailed Requirements](#detailed-requirements)
- [API Specification](#api-specification)
- [Data Models](#data-models)
- [Technical Architecture](#technical-architecture)
- [Implementation Plan](#implementation-plan)
- [Security Considerations](#security-considerations)
- [Performance Considerations](#performance-considerations)
- [Testing Strategy](#testing-strategy)
- [Success Criteria](#success-criteria)
- [Future Enhancements](#future-enhancements)

---

## Problem Statement

### Current Limitations

Users of GitHub Readme Stats currently face several limitations when trying to understand statistical changes:

1. **No User Comparison**: There is no built-in mechanism to compare GitHub statistics between two different users (e.g., teammates, competitors, or collaborators).

2. **No Historical Tracking**: Users cannot track their own progress over time. The service generates stats in real-time but doesn't store historical snapshots.

3. **Manual Comparison Required**: To compare stats, users must:
   - Fetch multiple cards separately
   - Manually extract numeric values
   - Perform calculations themselves
   - Create their own visualization or analysis

4. **No Trend Analysis**: Without historical data, users cannot identify trends such as:
   - Growth rate in contributions
   - Changes in rank over time
   - Evolution of language usage
   - Contribution patterns

5. **Limited Insights**: The current card system shows absolute values but doesn't provide:
   - Relative performance metrics
   - Percentage changes
   - Growth indicators
   - Comparative context

### Impact

This limitation affects several user groups:

- **Individual Developers**: Cannot track their progress and growth over time
- **Team Leaders**: Cannot compare team members' contributions objectively
- **Open Source Maintainers**: Cannot analyze contributor statistics comparatively
- **Recruiters/HR**: Cannot assess candidate profiles in a comparative context
- **Educators**: Cannot track student progress in coding bootcamps/courses
- **Community Managers**: Cannot identify and reward top contributors

---

## Context and Background

### Current Architecture

GitHub Readme Stats operates as a stateless serverless application:
- Fetches data from GitHub API on-demand
- Renders SVG cards dynamically
- Uses caching (TTL-based) to reduce API calls
- No persistent storage beyond cache

### Architectural Constraints

1. **Stateless Design**: Current Vercel serverless functions are ephemeral
2. **No Database**: No persistent storage layer exists
3. **Cache-Only**: Redis/Vercel cache is TTL-based and volatile
4. **GitHub API Limits**: Rate limits restrict frequent data fetching
5. **Memory Constraints**: Serverless functions have memory limits (128MB configured)

### Why This Feature Matters

1. **User Engagement**: Historical tracking increases user engagement with the platform
2. **Gamification**: Enables progress tracking and achievement systems
3. **Analytics**: Provides valuable insights into developer growth
4. **Competitive Analysis**: Enables healthy competition and benchmarking
5. **Trend Detection**: Helps identify patterns in contribution behavior

### Related Features

This feature complements existing functionality:
- Stats Card (provides the base data)
- Top Languages Card (language comparison potential)
- WakaTime Card (time-tracking comparison)
- Rank Calculation (comparative ranking)

---

## Use Cases

### Use Case 1: User-to-User Comparison

**Actor**: Developer / Team Lead  
**Goal**: Compare GitHub statistics between two users

**Scenario**:
```
As a team lead, I want to compare the GitHub contributions of two developers
(Alice and Bob) to understand their relative activity levels and specializations.

Expected Output:
- Side-by-side statistics
- Differences highlighted
- Percentage deltas
- Visual indicators of who's ahead in each metric
```

**Example Request**:
```
GET /api/compare?user1=alice&user2=bob
```

**Value**: Objective comparison for performance reviews, team balancing, or friendly competition.

---

### Use Case 2: Personal Progress Tracking

**Actor**: Individual Developer  
**Goal**: Track personal growth over time

**Scenario**:
```
As a developer, I want to see how my GitHub statistics have changed
over the last 30 days to track my contribution growth and identify patterns.

Expected Output:
- Current vs. previous statistics
- Change deltas (absolute and percentage)
- Growth indicators
- Improvement suggestions
```

**Example Request**:
```
GET /api/diff?username=alice&days=30
```

**Value**: Personal motivation, goal setting, portfolio building.

---

### Use Case 3: Milestone Detection

**Actor**: Open Source Maintainer  
**Goal**: Identify when contributors hit milestones

**Scenario**:
```
As an OSS maintainer, I want to track when contributors cross
significant thresholds (100 PRs, 1000 stars, etc.) to celebrate
achievements and maintain community engagement.

Expected Output:
- Milestone detection
- Threshold crossing events
- Achievement badges
- Trend analysis
```

**Example Request**:
```
GET /api/diff?username=alice&days=7&milestones=true
```

**Value**: Community building, recognition, retention.

---

### Use Case 4: Competitive Leaderboards

**Actor**: Community Manager / Event Organizer  
**Goal**: Create competitive leaderboards for hackathons or coding challenges

**Scenario**:
```
During a month-long coding challenge, I want to compare multiple
participants' contribution stats to generate dynamic leaderboards.

Expected Output:
- Multi-user comparison data
- Rankings by different metrics
- Progress over challenge duration
- Delta changes during event period
```

**Example Request**:
```
GET /api/compare?user1=alice&user2=bob&user3=charlie&format=leaderboard
```

**Value**: Event gamification, participant motivation, transparent competition.

---

### Use Case 5: Team Analytics

**Actor**: Engineering Manager  
**Goal**: Analyze team contribution patterns over time

**Scenario**:
```
As an engineering manager, I want to understand how my team's
contribution patterns have evolved over the quarter to inform
sprint planning and resource allocation.

Expected Output:
- Team aggregate statistics
- Individual trends
- Comparative analysis
- Velocity indicators
```

**Value**: Data-driven management, sprint planning, resource optimization.

---

## Solution Overview

### Two-Endpoint Approach

We propose implementing two distinct endpoints with different capabilities:

#### 1. `/api/compare` - User-to-User Comparison (Phase 1)
- **Stateless**: No historical storage required
- **Real-time**: Fetches current data for both users
- **Simple**: Can be implemented immediately
- **Limited**: Only compares current snapshots

#### 2. `/api/diff` - Historical Tracking (Phase 2)
- **Stateful**: Requires persistent storage
- **Historical**: Compares against stored snapshots
- **Complex**: Requires storage infrastructure
- **Powerful**: Enables trend analysis

### Implementation Phases

**Phase 1: Comparison Endpoint (MVP)**
- Implement `/api/compare` without storage
- Focus on real-time user-to-user comparison
- JSON response format
- Basic caching strategy
- ~3-4 days effort

**Phase 2: Storage Layer (Foundation)**
- Design snapshot storage schema
- Implement storage adapter (Redis/Database)
- Create snapshot capture system
- Retention policy implementation
- ~2-3 days effort

**Phase 3: Diff Endpoint (Full Feature)**
- Implement `/api/diff` with historical data
- Snapshot comparison logic
- Trend calculation
- Milestone detection
- ~2-3 days effort

---

## Detailed Requirements

### Functional Requirements

#### FR-1: Compare Endpoint
- **MUST** accept two usernames via query parameters
- **MUST** fetch current stats for both users concurrently
- **MUST** return JSON format (not SVG)
- **MUST** include difference calculations (absolute and percentage)
- **MUST** handle errors gracefully (one user not found, etc.)
- **SHOULD** support comparison of specific stats only
- **SHOULD** include rank comparison
- **COULD** support more than 2 users (up to 5)

#### FR-2: Diff Endpoint (Phase 2)
- **MUST** accept username and time period parameters
- **MUST** fetch current stats and historical snapshot
- **MUST** calculate changes between timeframes
- **MUST** return trend indicators (up/down/stable)
- **SHOULD** detect milestone crossings
- **SHOULD** support multiple time periods (7, 30, 90 days)
- **COULD** provide growth rate projections

#### FR-3: Data Accuracy
- **MUST** use the same data fetching logic as existing cards
- **MUST** respect GitHub API rate limits
- **MUST** apply same filtering rules (exclude_repo, etc.)
- **SHOULD** include data freshness timestamps
- **SHOULD** warn about cache staleness

#### FR-4: Response Format
- **MUST** return valid JSON
- **MUST** include HTTP status codes appropriately
- **MUST** provide clear error messages
- **SHOULD** support multiple output formats (compact, detailed)
- **COULD** support CSV format for data analysis

### Non-Functional Requirements

#### NFR-1: Performance
- Response time **MUST** be under 5 seconds for comparison
- Response time **SHOULD** be under 2 seconds for diff (cached)
- Concurrent requests **MUST NOT** cause rate limit exhaustion
- **MUST** implement request caching

#### NFR-2: Scalability
- **MUST** handle burst traffic without crashes
- Storage solution **MUST** scale with user growth
- **SHOULD** implement pagination for large datasets
- **SHOULD** support horizontal scaling

#### NFR-3: Reliability
- Endpoint **MUST** have 99% uptime
- **MUST** handle partial failures gracefully
- **SHOULD** provide fallback data when historical unavailable
- **SHOULD** implement retry logic for transient failures

#### NFR-4: Security
- **MUST** respect access controls (whitelist/blacklist)
- **MUST** implement rate limiting per IP/user
- **SHOULD** sanitize all input parameters
- **SHOULD** protect against injection attacks
- **MUST NOT** expose sensitive PAT information

#### NFR-5: Maintainability
- Code **MUST** follow existing project conventions
- **MUST** include comprehensive JSDoc comments
- **MUST** have unit test coverage > 80%
- **SHOULD** include integration tests
- **MUST** update relevant documentation

#### NFR-6: Privacy
- **MUST** only use publicly available GitHub data
- **SHOULD** allow users to opt-out of historical tracking
- **SHOULD** implement data retention policies
- **MUST** comply with data protection regulations

---

## API Specification

### Endpoint 1: `/api/compare`

#### Description
Compare GitHub statistics between two or more users in real-time.

#### HTTP Method
`GET`

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `user1` | string | **Yes** | - | First GitHub username |
| `user2` | string | **Yes** | - | Second GitHub username |
| `user3` | string | No | - | Third GitHub username (optional) |
| `user4` | string | No | - | Fourth GitHub username (optional) |
| `user5` | string | No | - | Fifth GitHub username (optional) |
| `stats` | string | No | `all` | Comma-separated stats to compare: `commits,prs,issues,stars,rank` |
| `format` | string | No | `detailed` | Response format: `detailed`, `compact`, `leaderboard` |
| `include_all_commits` | boolean | No | `false` | Include all commits (same as stats card) |
| `exclude_repo` | string | No | - | Repositories to exclude (comma-separated) |
| `cache_seconds` | number | No | 3600 | Cache duration in seconds |

#### Response Format (Detailed)

```json
{
  "comparison": {
    "users": ["alice", "bob"],
    "timestamp": "2024-01-15T10:30:00Z",
    "cached": false
  },
  "data": {
    "alice": {
      "name": "Alice Smith",
      "totalCommits": 1234,
      "totalPRs": 567,
      "totalPRsMerged": 543,
      "mergedPRsPercentage": 95.76,
      "totalReviews": 123,
      "totalIssues": 89,
      "totalStars": 4567,
      "totalDiscussionsStarted": 12,
      "totalDiscussionsAnswered": 34,
      "contributedTo": 45,
      "rank": {
        "level": "A+",
        "percentile": 98.5
      }
    },
    "bob": {
      "name": "Bob Johnson",
      "totalCommits": 987,
      "totalPRs": 432,
      "totalPRsMerged": 410,
      "mergedPRsPercentage": 94.91,
      "totalReviews": 98,
      "totalIssues": 67,
      "totalStars": 3456,
      "totalDiscussionsStarted": 8,
      "totalDiscussionsAnswered": 23,
      "contributedTo": 34,
      "rank": {
        "level": "A",
        "percentile": 95.2
      }
    }
  },
  "diff": {
    "totalCommits": {
      "alice": 1234,
      "bob": 987,
      "difference": 247,
      "percentage": 25.02,
      "leader": "alice"
    },
    "totalPRs": {
      "alice": 567,
      "bob": 432,
      "difference": 135,
      "percentage": 31.25,
      "leader": "alice"
    },
    "totalStars": {
      "alice": 4567,
      "bob": 3456,
      "difference": 1111,
      "percentage": 32.15,
      "leader": "alice"
    },
    "rank": {
      "alice": { "level": "A+", "percentile": 98.5 },
      "bob": { "level": "A", "percentile": 95.2 },
      "percentileDifference": 3.3,
      "leader": "alice"
    }
  },
  "summary": {
    "overall_leader": "alice",
    "stats_won": {
      "alice": 8,
      "bob": 2
    },
    "close_stats": ["mergedPRsPercentage"],
    "significant_differences": ["totalStars", "totalCommits"]
  }
}
```

#### Response Format (Compact)

```json
{
  "users": ["alice", "bob"],
  "timestamp": "2024-01-15T10:30:00Z",
  "diff": {
    "totalCommits": { "alice": 1234, "bob": 987, "delta": 247, "leader": "alice" },
    "totalPRs": { "alice": 567, "bob": 432, "delta": 135, "leader": "alice" },
    "totalStars": { "alice": 4567, "bob": 3456, "delta": 1111, "leader": "alice" }
  },
  "leader": "alice"
}
```

#### Response Format (Leaderboard)

```json
{
  "leaderboard": [
    {
      "rank": 1,
      "username": "alice",
      "totalScore": 6800,
      "stats": {
        "totalCommits": 1234,
        "totalPRs": 567,
        "totalStars": 4567,
        "rank": { "level": "A+", "percentile": 98.5 }
      }
    },
    {
      "rank": 2,
      "username": "bob",
      "totalScore": 5374,
      "stats": {
        "totalCommits": 987,
        "totalPRs": 432,
        "totalStars": 3456,
        "rank": { "level": "A", "percentile": 95.2 }
      }
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Error Responses

```json
// 400 Bad Request - Missing parameters
{
  "error": "Bad Request",
  "message": "Missing required parameters: user1, user2",
  "code": "MISSING_PARAMS"
}

// 404 Not Found - User doesn't exist
{
  "error": "Not Found",
  "message": "User 'nonexistent' not found on GitHub",
  "code": "USER_NOT_FOUND",
  "failed_users": ["nonexistent"],
  "partial_data": { /* data for users that were found */ }
}

// 429 Too Many Requests - Rate limited
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 120 seconds.",
  "code": "RATE_LIMITED",
  "retry_after": 120
}

// 500 Internal Server Error
{
  "error": "Internal Server Error",
  "message": "Failed to fetch statistics",
  "code": "FETCH_ERROR"
}
```

#### HTTP Status Codes

- `200 OK` - Successful comparison
- `206 Partial Content` - Some users found, others failed
- `400 Bad Request` - Invalid parameters
- `404 Not Found` - User(s) not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - GitHub API unavailable

#### Example Usage

```bash
# Basic comparison
curl "https://github-readme-stats.vercel.app/api/compare?user1=torvalds&user2=gvanrossum"

# Compact format
curl "https://github-readme-stats.vercel.app/api/compare?user1=alice&user2=bob&format=compact"

# Specific stats only
curl "https://github-readme-stats.vercel.app/api/compare?user1=alice&user2=bob&stats=commits,prs,stars"

# Three-way comparison
curl "https://github-readme-stats.vercel.app/api/compare?user1=alice&user2=bob&user3=charlie&format=leaderboard"
```

---

### Endpoint 2: `/api/diff` (Phase 2)

#### Description
Compare a user's current GitHub statistics against their historical data.

#### HTTP Method
`GET`

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `username` | string | **Yes** | - | GitHub username |
| `days` | number | No | `30` | Days to look back: `7`, `30`, `90`, `365` |
| `stats` | string | No | `all` | Comma-separated stats to track |
| `milestones` | boolean | No | `false` | Include milestone detection |
| `trends` | boolean | No | `true` | Include trend analysis |
| `format` | string | No | `detailed` | Response format: `detailed`, `compact` |
| `include_all_commits` | boolean | No | `false` | Include all commits |
| `exclude_repo` | string | No | - | Repositories to exclude |

#### Response Format (Detailed)

```json
{
  "diff": {
    "username": "alice",
    "period": {
      "days": 30,
      "start": "2023-12-16T00:00:00Z",
      "end": "2024-01-15T10:30:00Z"
    }
  },
  "current": {
    "timestamp": "2024-01-15T10:30:00Z",
    "name": "Alice Smith",
    "totalCommits": 1234,
    "totalPRs": 567,
    "totalPRsMerged": 543,
    "totalStars": 4567,
    "rank": { "level": "A+", "percentile": 98.5 }
  },
  "previous": {
    "timestamp": "2023-12-16T00:00:00Z",
    "totalCommits": 1150,
    "totalPRs": 540,
    "totalPRsMerged": 518,
    "totalStars": 4320,
    "rank": { "level": "A+", "percentile": 97.8 }
  },
  "changes": {
    "totalCommits": {
      "previous": 1150,
      "current": 1234,
      "absolute": 84,
      "percentage": 7.30,
      "trend": "up",
      "daily_average": 2.8,
      "growth_rate": "moderate"
    },
    "totalPRs": {
      "previous": 540,
      "current": 567,
      "absolute": 27,
      "percentage": 5.0,
      "trend": "up",
      "daily_average": 0.9,
      "growth_rate": "steady"
    },
    "totalStars": {
      "previous": 4320,
      "current": 4567,
      "absolute": 247,
      "percentage": 5.72,
      "trend": "up",
      "daily_average": 8.23,
      "growth_rate": "moderate"
    },
    "rank": {
      "previous": { "level": "A+", "percentile": 97.8 },
      "current": { "level": "A+", "percentile": 98.5 },
      "percentile_change": 0.7,
      "trend": "up",
      "level_changed": false
    }
  },
  "milestones": [
    {
      "type": "threshold",
      "stat": "totalCommits",
      "value": 1200,
      "achieved_at": "2024-01-10T14:22:00Z",
      "days_ago": 5
    }
  ],
  "trends": {
    "most_improved": "totalStars",
    "stagnant": [],
    "declining": [],
    "velocity": {
      "overall": "increasing",
      "acceleration": "positive"
    }
  },
  "summary": {
    "overall_growth": "positive",
    "stats_improved": 10,
    "stats_declined": 0,
    "stats_stable": 0,
    "milestones_hit": 1,
    "percentile_rank_change": "improved"
  }
}
```

#### Response Format (Compact)

```json
{
  "username": "alice",
  "period_days": 30,
  "changes": {
    "totalCommits": { "delta": 84, "percent": 7.30, "trend": "↑" },
    "totalPRs": { "delta": 27, "percent": 5.0, "trend": "↑" },
    "totalStars": { "delta": 247, "percent": 5.72, "trend": "↑" },
    "rank_percentile": { "delta": 0.7, "trend": "↑" }
  },
  "summary": "positive growth"
}
```

#### Error Responses

```json
// 404 Not Found - No historical data
{
  "error": "Not Found",
  "message": "No historical data available for user 'alice' from 30 days ago",
  "code": "NO_HISTORICAL_DATA",
  "suggestion": "Historical tracking may not have been enabled, or data retention period has expired"
}

// 400 Bad Request - Invalid period
{
  "error": "Bad Request",
  "message": "Invalid days parameter. Supported values: 7, 30, 90, 365",
  "code": "INVALID_PERIOD"
}
```

#### Example Usage

```bash
# 30-day progress tracking
curl "https://github-readme-stats.vercel.app/api/diff?username=alice&days=30"

# Weekly update with milestones
curl "https://github-readme-stats.vercel.app/api/diff?username=alice&days=7&milestones=true"

# Compact format for quick checks
curl "https://github-readme-stats.vercel.app/api/diff?username=alice&format=compact"

# Specific stats only
curl "https://github-readme-stats.vercel.app/api/diff?username=alice&stats=commits,prs&days=90"
```

---

## Data Models

### Comparison Result Model

```typescript
interface ComparisonResult {
  comparison: {
    users: string[];
    timestamp: string; // ISO 8601
    cached: boolean;
  };
  data: Record<string, StatsData>;
  diff: Record<string, StatDifference>;
  summary: ComparisonSummary;
}

interface StatDifference {
  [username: string]: number;
  difference: number;
  percentage: number;
  leader: string;
}

interface ComparisonSummary {
  overall_leader: string;
  stats_won: Record<string, number>;
  close_stats: string[];
  significant_differences: string[];
}
```

### Diff Result Model

```typescript
interface DiffResult {
  diff: {
    username: string;
    period: {
      days: number;
      start: string; // ISO 8601
      end: string; // ISO 8601
    };
  };
  current: StatsDataWithTimestamp;
  previous: StatsDataWithTimestamp;
  changes: Record<string, StatChange>;
  milestones?: Milestone[];
  trends?: TrendAnalysis;
  summary: DiffSummary;
}

interface StatsDataWithTimestamp extends StatsData {
  timestamp: string; // ISO 8601
}

interface StatChange {
  previous: number;
  current: number;
  absolute: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  daily_average?: number;
  growth_rate?: 'rapid' | 'moderate' | 'steady' | 'slow' | 'stagnant';
}

interface Milestone {
  type: 'threshold' | 'rank_change' | 'achievement';
  stat: string;
  value: number;
  achieved_at: string; // ISO 8601
  days_ago: number;
}

interface TrendAnalysis {
  most_improved: string;
  stagnant: string[];
  declining: string[];
  velocity: {
    overall: 'increasing' | 'decreasing' | 'stable';
    acceleration: 'positive' | 'negative' | 'neutral';
  };
}

interface DiffSummary {
  overall_growth: 'positive' | 'negative' | 'neutral';
  stats_improved: number;
  stats_declined: number;
  stats_stable: number;
  milestones_hit: number;
  percentile_rank_change: 'improved' | 'declined' | 'stable';
}
```

### Snapshot Storage Model (Phase 2)

```typescript
interface StatsSnapshot {
  id: string; // Unique snapshot ID
  username: string;
  timestamp: string; // ISO 8601
  data: StatsData;
  metadata: {
    github_api_version: string;
    fetcher_version: string;
    include_all_commits: boolean;
    excluded_repos: string[];
  };
}

interface SnapshotIndex {
  username: string;
  snapshots: {
    timestamp: string;
    snapshot_id: string;
  }[];
  oldest_snapshot: string; // ISO 8601
  newest_snapshot: string; // ISO 8601
  total_snapshots: number;
}
```

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway / Vercel                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  /api/index  │    │ /api/compare │    │  /api/diff   │
│  (stats card)│    │   (Phase 1)  │    │  (Phase 2)   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
        ┌──────────────┐      ┌──────────────┐
        │   Fetchers   │      │   Storage    │
        │   (stats,    │      │   Adapter    │
        │   languages) │      │  (Phase 2)   │
        └──────┬───────┘      └──────┬───────┘
               │                     │
               ▼                     ▼
        ┌──────────────┐      ┌──────────────┐
        │  GitHub API  │      │   Redis /    │
        │              │      │   Database   │
        └──────────────┘      └──────────────┘
```

### Data Flow - Comparison Endpoint

```
1. User Request
   └─> GET /api/compare?user1=alice&user2=bob

2. Parameter Validation
   └─> Validate usernames
   └─> Check whitelist/blacklist
   └─> Sanitize inputs

3. Rate Limiting Check
   └─> Check IP rate limit
   └─> Check per-user rate limit

4. Cache Check
   └─> Generate cache key: "compare:alice:bob:timestamp"
   └─> Check if cached comparison exists
   └─> If cache hit, return cached data

5. Parallel Data Fetch
   ├─> Fetch alice's stats (fetchStats)
   └─> Fetch bob's stats (fetchStats)

6. Comparison Calculation
   └─> Calculate differences
   └─> Calculate percentages
   └─> Determine leaders
   └─> Generate summary

7. Response Formatting
   └─> Format according to requested format
   └─> Add metadata (timestamp, cached flag)

8. Cache Result
   └─> Store in cache with TTL

9. Return Response
   └─> JSON with comparison data
```

### Data Flow - Diff Endpoint (Phase 2)

```
1. User Request
   └─> GET /api/diff?username=alice&days=30

2. Parameter Validation
   └─> Validate username and period
   └─> Check whitelist/blacklist

3. Historical Data Retrieval
   └─> Query snapshot index for user
   └─> Find snapshot closest to target date (30 days ago)
   └─> Retrieve historical snapshot from storage

4. Current Data Fetch
   └─> Fetch current stats (fetchStats)
   └─> Cache current stats

5. Diff Calculation
   └─> Calculate absolute changes
   └─> Calculate percentages
   └─> Determine trends
   └─> Detect milestones
   └─> Analyze velocity

6. Response Formatting
   └─> Build diff response object
   └─> Add trend indicators
   └─> Include milestones if requested

7. Return Response
   └─> JSON with diff data
```

### Storage Schema (Phase 2)

#### Snapshot Table/Collection

```javascript
{
  _id: "snapshot_alice_2024-01-15",
  username: "alice",
  timestamp: "2024-01-15T10:30:00Z",
  ttl: 7776000, // 90 days in seconds
  data: {
    totalCommits: 1234,
    totalPRs: 567,
    // ... full StatsData
  },
  metadata: {
    github_api_version: "v4",
    fetcher_version: "1.0.0",
    include_all_commits: false,
    excluded_repos: []
  }
}
```

#### Snapshot Index Table/Collection

```javascript
{
  _id: "index_alice",
  username: "alice",
  snapshots: [
    { timestamp: "2024-01-15T10:30:00Z", id: "snapshot_alice_2024-01-15" },
    { timestamp: "2024-01-08T10:30:00Z", id: "snapshot_alice_2024-01-08" },
    // ... more snapshots
  ],
  oldest_snapshot: "2023-10-17T10:30:00Z",
  newest_snapshot: "2024-01-15T10:30:00Z",
  total_snapshots: 13
}
```

#### Storage Requirements

- **Snapshot Size**: ~2KB per snapshot (compressed JSON)
- **Storage per User**: ~104KB for 52 snapshots (1 year, weekly)
- **Storage for 10K Users**: ~1GB
- **Storage for 100K Users**: ~10GB
- **Retention**: 90 days default, configurable

#### Storage Options

1. **Redis** (Recommended for Phase 2)
   - Fast access
   - TTL support built-in
   - Existing Vercel integration
   - Limitations: Memory cost at scale

2. **Vercel KV** (Alternative)
   - Serverless-friendly
   - Built-in on Vercel
   - Good performance
   - Cost-effective

3. **PostgreSQL/MySQL** (For scale)
   - Best for large deployments
   - Complex queries supported
   - Reliable retention
   - Requires separate hosting

4. **MongoDB** (Alternative)
   - Document-based (natural fit)
   - Good query capabilities
   - Flexible schema
   - Requires separate hosting

---

## Implementation Plan

### Phase 1: Comparison Endpoint (MVP)

**Goal**: Implement `/api/compare` without requiring storage infrastructure.

#### Tasks

1. **Create API Endpoint** (1 day)
   - [ ] Create `api/compare.js`
   - [ ] Implement request handler
   - [ ] Add parameter validation
   - [ ] Integrate with existing access guards

2. **Implement Comparison Logic** (1 day)
   - [ ] Create `src/comparison/compare.js`
   - [ ] Implement parallel stats fetching
   - [ ] Create difference calculator
   - [ ] Add percentage calculator
   - [ ] Implement leader determination

3. **Response Formatting** (0.5 days)
   - [ ] Implement detailed format
   - [ ] Implement compact format
   - [ ] Implement leaderboard format
   - [ ] Add metadata (timestamps, cache flags)

4. **Caching Strategy** (0.5 days)
   - [ ] Design cache key structure
   - [ ] Implement cache lookup
   - [ ] Implement cache storage
   - [ ] Set appropriate TTLs

5. **Testing** (1 day)
   - [ ] Unit tests for comparison logic
   - [ ] Integration tests for endpoint
   - [ ] Error handling tests
   - [ ] Performance tests

**Total**: ~4 days

### Phase 2: Storage Infrastructure

**Goal**: Implement snapshot storage for historical tracking.

#### Tasks

1. **Storage Design** (0.5 days)
   - [ ] Choose storage solution (Redis/Vercel KV)
   - [ ] Design schema
   - [ ] Plan retention policy
   - [ ] Design index structure

2. **Storage Adapter** (1 day)
   - [ ] Create `src/storage/adapter.js`
   - [ ] Implement save snapshot
   - [ ] Implement retrieve snapshot
   - [ ] Implement list snapshots
   - [ ] Implement delete old snapshots

3. **Snapshot Capture System** (1 day)
   - [ ] Create snapshot scheduler (cron/webhook)
   - [ ] Implement snapshot capture logic
   - [ ] Add snapshot validation
   - [ ] Implement retention cleanup

4. **Testing** (0.5 days)
   - [ ] Unit tests for storage adapter
   - [ ] Integration tests
   - [ ] Test retention policy

**Total**: ~3 days

### Phase 3: Diff Endpoint

**Goal**: Implement `/api/diff` with historical comparison.

#### Tasks

1. **Create API Endpoint** (0.5 days)
   - [ ] Create `api/diff.js`
   - [ ] Implement request handler
   - [ ] Add parameter validation

2. **Historical Data Retrieval** (0.5 days)
   - [ ] Implement snapshot lookup by date
   - [ ] Add fallback logic for missing snapshots
   - [ ] Handle edge cases

3. **Diff Calculation** (1 day)
   - [ ] Create `src/comparison/diff.js`
   - [ ] Implement change calculator
   - [ ] Add trend analysis
   - [ ] Implement milestone detection
   - [ ] Calculate growth rates

4. **Response Formatting** (0.5 days)
   - [ ] Implement detailed format
   - [ ] Implement compact format
   - [ ] Add trend indicators

5. **Testing** (0.5 days)
   - [ ] Unit tests for diff logic
   - [ ] Integration tests
   - [ ] Edge case tests

**Total**: ~3 days

### Total Estimated Effort: 10 days (including buffer)

---

## Security Considerations

### Input Validation

1. **Username Validation**
   - Use existing `github-username-regex` validator
   - Prevent injection attacks
   - Limit username length

2. **Parameter Sanitization**
   - Sanitize all query parameters
   - Validate numeric ranges
   - Whitelist allowed values

3. **Query Limits**
   - Max 5 users per comparison
   - Limit stats list length
   - Prevent excessively long cache times

### Access Control

1. **Whitelist/Blacklist**
   - Apply existing access guards
   - Respect whitelist when configured
   - Block blacklisted users

2. **Rate Limiting**
   - Implement per-IP rate limits
   - Implement per-user rate limits
   - Different limits for comparison vs diff

### Data Privacy

1. **Public Data Only**
   - Only use publicly available GitHub data
   - Same privacy guarantees as existing cards
   - No private repository data

2. **Opt-Out Mechanism** (Phase 2)
   - Allow users to opt-out of historical tracking
   - Respect GitHub privacy settings
   - Provide data deletion endpoint

### Storage Security (Phase 2)

1. **Data Encryption**
   - Encrypt snapshots at rest (if using database)
   - Use secure connections (TLS)

2. **Access Credentials**
   - Store storage credentials securely
   - Use environment variables
   - Rotate credentials regularly

3. **Data Retention**
   - Implement automatic cleanup
   - Respect retention policies
   - Provide manual cleanup options

---

## Performance Considerations

### Optimization Strategies

1. **Parallel Fetching**
   - Fetch multiple users' stats in parallel
   - Use `Promise.all()` for concurrent requests
   - Implement timeout handling

2. **Caching**
   - Cache comparison results
   - Use composite cache keys
   - Implement smart TTLs based on data freshness

3. **Response Compression**
   - Compress JSON responses
   - Use gzip/brotli encoding

4. **Pagination** (Future)
   - For multi-user comparisons (>5 users)
   - For historical snapshot lists

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response Time (Cached) | < 200ms | 95th percentile |
| Response Time (Uncached) | < 3s | 95th percentile |
| Parallel Fetch Time | < 2s | 2 users |
| Storage Write | < 100ms | Snapshot save |
| Storage Read | < 50ms | Snapshot retrieve |
| Cache Hit Rate | > 70% | Comparison endpoint |

### Load Testing

1. **Scenarios**
   - 100 concurrent requests to `/api/compare`
   - 1000 requests/minute sustained load
   - Cache warm vs cold scenarios
   - PAT rotation under load

2. **Metrics to Monitor**
   - Response time distribution
   - Error rate
   - GitHub API quota consumption
   - Memory usage
   - Cache hit/miss ratio

---

## Testing Strategy

### Unit Tests

#### Test Coverage Requirements
- Minimum 80% code coverage
- 100% coverage for core comparison logic
- All error paths tested

#### Key Test Cases

1. **Comparison Logic**
   ```javascript
   // tests/comparison.test.js
   - calculateDifference() with positive values
   - calculateDifference() with negative values
   - calculatePercentage() with zero values
   - determineLeader() with ties
   - formatComparisonResult() for all formats
   ```

2. **Diff Logic**
   ```javascript
   // tests/diff.test.js
   - calculateChange() with growth
   - calculateChange() with decline
   - detectTrend() for various patterns
   - detectMilestones() threshold crossing
   - calculateGrowthRate() for different rates
   ```

3. **Storage Adapter** (Phase 2)
   ```javascript
   // tests/storage.test.js
   - saveSnapshot() success case
   - retrieveSnapshot() with valid ID
   - retrieveSnapshot() with missing snapshot
   - listSnapshots() with pagination
   - deleteOldSnapshots() retention policy
   ```

### Integration Tests

#### Test Scenarios

1. **Endpoint Tests**
   ```javascript
   // tests/api-compare.test.js
   describe("/api/compare", () => {
     it("should compare two valid users");
     it("should handle invalid usernames");
     it("should respect rate limits");
     it("should return cached results");
     it("should handle GitHub API errors");
     it("should support multiple formats");
   });
   ```

2. **End-to-End Tests**
   ```javascript
   // tests/e2e/comparison.e2e.test.js
   - Full flow: request → fetch → compare → cache → response
   - Parallel user fetching
   - PAT rotation during comparison
   - Cache invalidation
   ```

### Performance Tests

```javascript
// tests/performance/compare.bench.js
describe("Performance benchmarks", () => {
  it("should complete comparison in < 3s");
  it("should handle 100 concurrent requests");
  it("should maintain < 5% error rate under load");
});
```

### Test Data

1. **Mock Users**
   - Create test fixtures with known stats
   - Include edge cases (zero values, very large values)
   - Test with real GitHub users (public data)

2. **Mock Responses**
   - GitHub API responses
   - Error responses (404, 403, 500)
   - Rate limit responses

---

## Success Criteria

### Phase 1 Success Criteria

The `/api/compare` endpoint is considered successful when:

1. **Functional**
   - ✅ Compares 2-5 users correctly
   - ✅ Returns accurate difference calculations
   - ✅ Supports all three output formats
   - ✅ Handles errors gracefully
   - ✅ Respects access controls

2. **Performance**
   - ✅ 95th percentile response time < 3s (uncached)
   - ✅ 95th percentile response time < 200ms (cached)
   - ✅ Cache hit rate > 70% after warmup
   - ✅ No increase in GitHub API quota exhaustion

3. **Quality**
   - ✅ Test coverage > 80%
   - ✅ No critical bugs in production
   - ✅ Passes all linting/formatting checks
   - ✅ Documentation complete

4. **Adoption**
   - ✅ Successfully processes 100+ requests/day
   - ✅ Error rate < 1%
   - ✅ Positive user feedback

### Phase 2 Success Criteria

The storage infrastructure is considered successful when:

1. **Functional**
   - ✅ Snapshots saved reliably
   - ✅ Snapshots retrieved accurately
   - ✅ Retention policy works correctly
   - ✅ No data loss

2. **Performance**
   - ✅ Snapshot write < 100ms
   - ✅ Snapshot read < 50ms
   - ✅ Storage costs within budget

3. **Reliability**
   - ✅ 99.9% snapshot save success rate
   - ✅ Automatic cleanup functioning
   - ✅ No storage exhaustion issues

### Phase 3 Success Criteria

The `/api/diff` endpoint is considered successful when:

1. **Functional**
   - ✅ Accurately calculates changes
   - ✅ Detects trends correctly
   - ✅ Identifies milestones
   - ✅ Handles missing historical data gracefully

2. **Performance**
   - ✅ 95th percentile response time < 1s
   - ✅ Efficient historical data queries

3. **Adoption**
   - ✅ Successfully processes 50+ requests/day
   - ✅ Users track progress regularly
   - ✅ Positive feedback on insights

---

## Future Enhancements

### Short-term Enhancements

1. **Webhook Integration**
   - Notify users of significant changes
   - Integration with Discord/Slack
   - Automated progress reports

2. **Visualization Endpoints**
   - Generate simple charts/graphs
   - SVG trend visualizations
   - Progress bars for growth

3. **Custom Thresholds**
   - User-defined milestone values
   - Custom comparison weights
   - Personalized growth targets

### Medium-term Enhancements

1. **Multi-period Comparison**
   - Compare multiple time periods at once
   - Quarter-over-quarter analysis
   - Year-over-year comparison

2. **Team Aggregation**
   - Aggregate stats for organizations
   - Team-level comparisons
   - Department analytics

3. **Export Formats**
   - CSV export
   - PDF reports
   - Excel-compatible formats

### Long-term Enhancements

1. **Machine Learning Insights**
   - Predict future stats
   - Anomaly detection
   - Contribution pattern analysis

2. **Leaderboard Service**
   - Public/private leaderboards
   - Community competitions
   - Achievement badges

3. **GraphQL API**
   - More flexible queries
   - Subscription support
   - Better performance for complex queries

---

## Appendix

### Related Issues
- Issue tracking comparison feature requests
- Historical tracking discussions
- Privacy concerns

### References
- GitHub API documentation
- Vercel serverless best practices
- Redis/storage documentation

### Contributors
- Feature specification author
- Technical reviewers
- Community feedback

### Changelog
- 2024-01-15: Initial specification created
- Future: Updates based on implementation feedback

---

**Document Status**: DRAFT  
**Review Status**: Pending  
**Approval Status**: Pending

