# Non-UI Feature Proposals

This document outlines potential backend and infrastructure feature enhancements for GitHub Readme Stats that do not involve UI/visual changes to the SVG cards.

**Date:** 2024  
**Context:** Research based on commit `6d6b87c` (Jest 30.2.0 update)

---

## Executive Summary

The following proposals focus on improving reliability, security, performance, and extensibility of the service through backend enhancements. These features would benefit both public instance operators and self-hosted deployments.

---

## 1. Rate Limiting per User/IP Address

**Priority:** HIGH  
**Complexity:** MEDIUM  
**Impact:** HIGH

### Problem Statement
Currently, there is no rate limiting on individual users or IP addresses, making the service vulnerable to abuse and potential DoS attacks. The only rate limiting exists on status endpoints.

### Proposed Solution
Implement per-user and per-IP rate limiting middleware that:
- Tracks requests using an in-memory store or Redis
- Implements sliding window rate limiting
- Returns HTTP 429 with `Retry-After` headers
- Configurable limits via environment variables

### Technical Implementation
```javascript
// New file: src/common/rate-limiter.js
// - Use Map or Redis for request tracking
// - Implement sliding window algorithm
// - Clean up old entries periodically
// - Environment variables:
//   - RATE_LIMIT_ENABLED=true
//   - RATE_LIMIT_WINDOW_MS=60000
//   - RATE_LIMIT_MAX_REQUESTS=60
//   - RATE_LIMIT_BY_IP=true
//   - RATE_LIMIT_BY_USERNAME=true
```

### Benefits
- Prevents abuse and ensures fair usage
- Reduces API costs by limiting excessive requests
- Protects GitHub PAT quota
- Improves service availability for all users
- Better resource allocation

### Considerations
- Memory usage for tracking requests
- Need for distributed rate limiting in scaled deployments
- Proper cache key generation for different endpoints

---

## 2. Enhanced PAT Auto-Rotation & Health Monitoring

**Priority:** HIGH  
**Complexity:** MEDIUM  
**Impact:** HIGH

### Problem Statement
Current PAT management is reactive - tokens are only checked when they fail. The existing `/api/status/pat-info` endpoint provides information but doesn't actively manage token health during requests.

### Proposed Solution
Implement intelligent PAT selection and rotation:
- Monitor PAT health in real-time during requests
- Automatically skip exhausted/expired tokens
- Select PAT with highest remaining quota
- Track success/error rates per token
- Proactive health checks

### Technical Implementation
```javascript
// Enhance: src/common/retryer.js
// New features:
// - PAT health cache with TTL
// - Smart token selection based on remaining quota
// - Automatic failover when token exhausted
// - Token performance metrics
// - Configurable rotation strategy

// Environment variables:
//   - PAT_AUTO_ROTATION=true
//   - PAT_HEALTH_CHECK_INTERVAL_MS=300000
//   - PAT_MIN_REMAINING_QUOTA=100
//   - PAT_ROTATION_STRATEGY=least-used|round-robin|random
```

### Benefits
- Reduced downtime from exhausted tokens
- Better utilization of available quota across all PATs
- Fewer errors reaching end users
- Improved service reliability
- Better capacity planning with health metrics

### Considerations
- Need to cache PAT health to avoid excessive API calls
- Race conditions in concurrent requests
- Proper error handling when all PATs exhausted

---

## 3. Request Validation & Sanitization Middleware

**Priority:** HIGH  
**Complexity:** LOW-MEDIUM  
**Impact:** MEDIUM-HIGH

### Problem Statement
Current query parameter validation is scattered across individual endpoint handlers. No centralized validation or sanitization layer exists, leading to potential security issues and inconsistent error handling.

### Proposed Solution
Create a validation middleware layer that:
- Validates all query parameters against schemas
- Sanitizes inputs to prevent injection attacks
- Enforces type checking and range validation
- Provides consistent error messages
- Implements request size limits

### Technical Implementation
```javascript
// New file: src/common/validation.js
// - Parameter schemas for each endpoint
// - Validation functions for common types
// - Sanitization utilities
// - Error formatting

// New file: src/common/middleware/validate.js
// - Middleware factory for endpoint validation
// - Schema-based validation
// - Early return with proper error cards

// Apply to all endpoints in /api/*.js
```

### Benefits
- Improved security against injection attacks
- Prevents crashes from malformed input
- Consistent error messages across endpoints
- Easier to maintain validation logic
- Better developer experience with clear errors
- Reduces processing of invalid requests

### Considerations
- Need to maintain validation schemas
- Backward compatibility with existing query parameters
- Performance impact of validation (should be minimal)

---

## 4. Webhook/Event Notification System

**Priority:** MEDIUM  
**Complexity:** MEDIUM-HIGH  
**Impact:** MEDIUM

### Problem Statement
No mechanism exists for external services to be notified of stats changes or milestones. Users must poll the API to detect changes.

### Proposed Solution
Implement a webhook system that:
- Sends POST requests to configured webhook URLs
- Triggers on specific events (rank changes, milestones, etc.)
- Includes event payload with relevant data
- Implements retry logic for failed deliveries
- Supports HMAC signature verification

### Technical Implementation
```javascript
// New file: src/webhooks/manager.js
// New file: src/webhooks/events.js
// New file: src/webhooks/delivery.js

// Event types:
// - rank_changed
// - star_milestone (1k, 5k, 10k, etc.)
// - contribution_milestone
// - new_language_detected

// Environment variables:
//   - WEBHOOKS_ENABLED=true
//   - WEBHOOK_URL=https://example.com/webhook
//   - WEBHOOK_SECRET=xxx
//   - WEBHOOK_EVENTS=rank_changed,star_milestone
//   - WEBHOOK_RETRY_ATTEMPTS=3
```

### Benefits
- Enables real-time integrations with Discord, Slack, etc.
- Supports gamification and achievement systems
- Reduces need for polling
- Opens up new use cases for the service
- Better user engagement

### Considerations
- Need to store previous stats for comparison
- Webhook delivery failures and retry logic
- Security: validate webhook signatures
- Performance impact of webhook delivery
- Privacy concerns with external notifications

---

## 5. Usage Analytics & Metrics Endpoint

**Priority:** MEDIUM  
**Complexity:** MEDIUM  
**Impact:** MEDIUM

### Problem Statement
Instance operators have limited visibility into usage patterns, making capacity planning and optimization difficult. No metrics are exposed for monitoring tools.

### Proposed Solution
Create a metrics endpoint that exposes:
- Request rates (per minute/hour/day)
- Most requested usernames
- Cache hit/miss ratios
- Response time percentiles
- Error rates by type
- PAT usage statistics

### Technical Implementation
```javascript
// New file: src/metrics/collector.js
// New file: api/status/metrics.js

// Metrics collected:
// - Request counters by endpoint
// - Response time histograms
// - Cache statistics
// - Error counters by type
// - Top requested users
// - Request patterns by hour/day

// Output formats:
// - JSON (default)
// - Prometheus format (?format=prometheus)

// Environment variables:
//   - METRICS_ENABLED=true
//   - METRICS_AUTH_TOKEN=xxx (required for access)
//   - METRICS_RETENTION_HOURS=24
```

### Benefits
- Better capacity planning
- Identify performance bottlenecks
- Understand usage patterns
- Proactive issue detection
- Integration with monitoring tools (Prometheus, Grafana)
- Data-driven optimization decisions

### Considerations
- Memory usage for metrics storage
- Need for authentication to prevent abuse
- Metric retention and cleanup
- Performance overhead of collecting metrics

---

## 6. Data Export/Backup API

**Priority:** LOW-MEDIUM  
**Complexity:** MEDIUM  
**Impact:** LOW-MEDIUM

### Problem Statement
Users cannot export or download their historical stats data for analysis or backup purposes. All data is ephemeral based on cache TTL.

### Proposed Solution
Create endpoints for data export:
- Export current stats in JSON/CSV format
- Optional historical data if available
- Support for all card types
- Compression for large exports
- Rate limiting to prevent abuse

### Technical Implementation
```javascript
// New endpoint: api/export.js
// Supported formats:
// - JSON (default)
// - CSV (?format=csv)
// - Compressed (?compress=true)

// Query parameters:
// - username (required)
// - type=stats|langs|wakatime|all
// - format=json|csv
// - compress=true|false

// Environment variables:
//   - EXPORT_ENABLED=true
//   - EXPORT_RATE_LIMIT=10 (per hour)
```

### Benefits
- Data portability for users
- Enables custom analysis and dashboards
- Backup capability
- Transparency
- Supports GDPR data export requirements

### Considerations
- Storage for historical data (if implemented)
- Rate limiting to prevent abuse
- Format compatibility
- Data size limits

---

## 7. Configurable Retry Strategy

**Priority:** LOW  
**Complexity:** LOW  
**Impact:** LOW-MEDIUM

### Problem Statement
The retry logic in `src/common/retryer.js` has hardcoded values for retry attempts, timeouts, and backoff strategy. Different deployment scenarios may benefit from different retry configurations.

### Proposed Solution
Make retry behavior configurable via environment variables:
- Number of retry attempts
- Initial backoff delay
- Backoff multiplier
- Total timeout
- Retry strategy (exponential, linear, custom)

### Technical Implementation
```javascript
// Enhance: src/common/retryer.js
// Environment variables:
//   - RETRY_MAX_ATTEMPTS=3
//   - RETRY_INITIAL_DELAY_MS=1000
//   - RETRY_BACKOFF_MULTIPLIER=2
//   - RETRY_MAX_DELAY_MS=10000
//   - RETRY_TIMEOUT_MS=30000
//   - RETRY_STRATEGY=exponential|linear|constant

// Allow per-endpoint overrides via function parameters
```

### Benefits
- Better control over API behavior
- Adapt to different GitHub API rate limits
- Optimize for different deployment scenarios
- Reduce timeout errors with appropriate settings
- Fine-tune performance vs. reliability tradeoff

### Considerations
- Backward compatibility with existing behavior
- Documentation of recommended settings
- Testing different strategies

---

## 8. Batch Stats Fetching

**Priority:** LOW-MEDIUM  
**Complexity:** MEDIUM  
**Impact:** MEDIUM

### Problem Statement
Services that need stats for multiple users must make individual requests for each user, increasing API calls and latency. No efficient way to fetch stats for multiple users.

### Proposed Solution
Create a batch endpoint that:
- Accepts multiple usernames in a single request
- Fetches stats in parallel with concurrency control
- Returns array of results
- Implements batch-specific caching
- Limits batch size to prevent abuse

### Technical Implementation
```javascript
// New endpoint: api/batch.js
// Query format: ?usernames=user1,user2,user3
// Or POST body: { usernames: [...] }

// Features:
// - Parallel fetching with concurrency limit
// - Individual error handling (partial success)
// - Batch cache keys
// - Max batch size limit

// Environment variables:
//   - BATCH_ENABLED=true
//   - BATCH_MAX_SIZE=10
//   - BATCH_CONCURRENCY=3
//   - BATCH_TIMEOUT_MS=30000
```

### Benefits
- More efficient for dashboards and comparison tools
- Reduced total request time
- Lower API overhead
- Better resource utilization
- Enables new use cases

### Considerations
- Complexity of error handling (partial failures)
- Cache key generation for batches
- Rate limiting for batch requests
- Response format and size

---

## 9. Stats Comparison/Diff Endpoint

**Priority:** LOW  
**Complexity:** MEDIUM-HIGH  
**Impact:** LOW-MEDIUM

### Problem Statement
No built-in way to compare stats between two users or track a user's progress over time. Users must manually compare values from multiple card requests.

### Proposed Solution
Create comparison endpoints:
- `/api/compare` - Compare two users
- `/api/diff` - Compare user's current vs historical stats
- Returns JSON with differences
- Highlights significant changes

### Technical Implementation
```javascript
// New endpoint: api/compare.js
// Query: ?user1=alice&user2=bob
// Returns: { user1: {...}, user2: {...}, diff: {...} }

// New endpoint: api/diff.js
// Query: ?username=alice&days=30
// Requires: Historical data storage
// Returns: { current: {...}, previous: {...}, changes: {...} }

// Environment variables:
//   - COMPARISON_ENABLED=true
//   - DIFF_ENABLED=true
//   - DIFF_SNAPSHOT_INTERVAL_DAYS=7
```

### Benefits
- Competitive analysis capabilities
- Progress tracking for individuals
- Motivation through visible improvements
- Insights into stat changes
- New use cases for the API

### Considerations
- Historical data storage (for diff endpoint)
- Snapshot frequency and retention
- Storage costs
- Query performance
- Privacy implications

---

## 10. Repository Filtering Enhancements

**Priority:** LOW  
**Complexity:** LOW-MEDIUM  
**Impact:** LOW-MEDIUM

### Problem Statement
Current `exclude_repo` parameter only supports exact repository names. Users cannot filter by patterns, visibility, or other attributes.

### Proposed Solution
Enhanced repository filtering:
- Pattern matching (e.g., `*-fork`, `test-*`)
- Filter by visibility (public/private)
- Filter by star count range
- Filter by primary language
- Filter by repository age

### Technical Implementation
```javascript
// Enhance: src/fetchers/stats.js
// New query parameters:
// - exclude_repo_pattern=*-fork,test-*
// - exclude_private=true
// - exclude_stars_below=10
// - exclude_languages=JavaScript,HTML
// - exclude_newer_than_days=30

// Environment variables:
//   - ADVANCED_FILTERING_ENABLED=true
```

### Benefits
- More accurate stats representation
- Flexibility in what's counted
- Better control for users with many repos
- Cleaner stats for specific use cases

### Considerations
- Query parameter complexity
- Performance impact of filtering
- Documentation of filter syntax
- Backward compatibility

---

## Implementation Priority Matrix

| Feature | Priority | Complexity | Impact | Effort (days) |
|---------|----------|------------|--------|---------------|
| Rate Limiting | HIGH | MEDIUM | HIGH | 3-5 |
| PAT Auto-Rotation | HIGH | MEDIUM | HIGH | 4-6 |
| Request Validation | HIGH | LOW-MEDIUM | MEDIUM-HIGH | 2-4 |
| Webhook System | MEDIUM | MEDIUM-HIGH | MEDIUM | 5-8 |
| Usage Metrics | MEDIUM | MEDIUM | MEDIUM | 3-5 |
| Data Export | LOW-MEDIUM | MEDIUM | LOW-MEDIUM | 3-4 |
| Configurable Retry | LOW | LOW | LOW-MEDIUM | 1-2 |
| Batch Fetching | LOW-MEDIUM | MEDIUM | MEDIUM | 4-5 |
| Stats Comparison | LOW | MEDIUM-HIGH | LOW-MEDIUM | 5-7 |
| Repo Filtering | LOW | LOW-MEDIUM | LOW-MEDIUM | 2-3 |

---

## Recommended Implementation Phases

### Phase 1: Stability & Security (Critical)
1. Rate Limiting per User/IP
2. Request Validation Middleware
3. Enhanced PAT Auto-Rotation

**Rationale:** These features directly improve service reliability, security, and uptime.

### Phase 2: Observability (Important)
4. Usage Analytics & Metrics
5. Configurable Retry Strategy

**Rationale:** Better visibility into service behavior enables data-driven optimization.

### Phase 3: Extensibility (Nice-to-have)
6. Webhook/Event System
7. Batch Stats Fetching
8. Data Export API

**Rationale:** Opens up new use cases and integrations.

### Phase 4: Enhancement (Optional)
9. Stats Comparison/Diff
10. Repository Filtering Enhancements

**Rationale:** Improves user experience but not critical for core functionality.

---

## Technical Considerations

### Environment Variables
All new features should be controllable via environment variables with sensible defaults, following the existing pattern in the codebase.

### Backward Compatibility
All features should be implemented as opt-in with feature flags to avoid breaking existing deployments.

### Testing
Each feature should include:
- Unit tests for core logic
- Integration tests for API endpoints
- Performance benchmarks where applicable

### Documentation
Each feature requires:
- README updates
- Environment variable documentation
- API endpoint documentation
- Example usage

### Performance
Features should be designed with performance in mind:
- Minimal overhead when disabled
- Efficient algorithms and data structures
- Proper caching strategies
- Async/non-blocking operations

---

## Conclusion

These proposed features focus on making GitHub Readme Stats more robust, secure, and extensible without changing the user-facing SVG cards. The priority should be on stability and security features first, followed by observability, and finally extensibility enhancements.

The recommendations are based on:
- Analysis of the current codebase architecture
- Common pain points in API services
- Best practices for serverless deployments
- Real-world operational needs

Implementation should be incremental, with proper testing and documentation at each phase.
