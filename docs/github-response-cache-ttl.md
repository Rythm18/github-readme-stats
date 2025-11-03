Problem Title: Configurable GitHub Response Cache TTL

Problem Brief:
Add an in-memory cache for successful GitHub API responses so repeated requests reuse recent data instead of refetching. Allow operators to tune or disable the cache via configuration. The outcome should lower GitHub rate consumption without surfacing stale failures and expose the controls clearly in project docs.

Agent Instructions:
1. Introduce a shared cache utility that stores fetcher responses with TTL controls driven by the `GITHUB_RESPONSE_CACHE_SECONDS` environment variable (default 300 seconds, clamp between 1 and 86,400, treat `0` as disabled, auto-disable in test env).
2. Wire the cache into the GitHub retryer so it serves cached successes before acquiring tokens, only caching responses with successful HTTP status and no GraphQL `errors` payload.
3. Ensure rate-limit handling and error paths keep their current behaviour and do not poison the cache.
4. Add targeted Jest coverage that exercises cache hits, expiry, disabling, and error handling without affecting the broader suite.
5. Document the new environment variable in `readme.md` and provide a `test.sh` helper with `base` and `new` modes (new runs just the added tests).

Test Assumptions (optional):
- `src/common/github-cache.js` exports `getGitHubCacheTTL`, `getCachedGitHubResponse`, `setCachedGitHubResponse`, `clearGitHubResponseCache`, `DEFAULT_TTL_SECONDS`, `MIN_TTL_SECONDS`, `MAX_TTL_SECONDS`.
- Jest test added at `tests/githubResponseCache.test.js` uses the public API above; caching defaults to disabled in test env until the env var is set.
- `test.sh new` leverages `npx jest --runTestsByPath tests/githubResponseCache.test.js`.
