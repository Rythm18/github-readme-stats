// @ts-check

import { clampValue } from "./ops.js";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes
const MIN_TTL_SECONDS = 1;
const MAX_TTL_SECONDS = 86400; // 24 hours

/**
 * Internal store for cached GitHub responses keyed by fetcher + variables.
 * @type {Map<Function, Map<string, { value: any, expiresAt: number }>>}
 */
const cacheStore = new Map();

/**
 * Compute the effective TTL in seconds based on environment configuration.
 *  - Undefined env -> default TTL.
 *  - Non-numeric env -> default TTL.
 *  - Values <= 0 -> disables caching.
 *  - Otherwise clamp between MIN_TTL_SECONDS and MAX_TTL_SECONDS.
 *
 * @returns {number} Effective TTL in seconds. 0 means disabled.
 */
const getGitHubCacheTTL = () => {
  const raw = process.env.GITHUB_RESPONSE_CACHE_SECONDS;
  if (raw === undefined || raw === "") {
    return process.env.NODE_ENV === "test" ? 0 : DEFAULT_TTL_SECONDS;
  }

  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_TTL_SECONDS;
  }

  if (parsed <= 0) {
    return 0;
  }

  return clampValue(parsed, MIN_TTL_SECONDS, MAX_TTL_SECONDS);
};

/**
 * Serialize variables into a deterministic cache key.
 *
 * @param {any} value Value to serialize.
 * @returns {string} Serialized key.
 */
const serialize = (value) => {
  if (value === null || value === undefined) {
    return String(value);
  }

  const type = typeof value;
  if (type === "string") {
    return `s:${value}`;
  }
  if (type === "number" || type === "bigint") {
    return `n:${value}`;
  }
  if (type === "boolean") {
    return `b:${value}`;
  }
  if (Array.isArray(value)) {
    return `a:[${value.map(serialize).join(",")}]`;
  }

  if (value instanceof Date) {
    return `d:${value.toISOString()}`;
  }

  // Objects
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${serialize(key)}=>${serialize(value[key])}`);
  return `o:{${entries.join(",")}}`;
};

/**
 * Build a composite cache key for the fetcher and variables.
 *
 * @param {Function} fetcher Fetcher reference.
 * @param {any} variables Variables passed to fetcher.
 * @returns {string}
 */
const buildCacheKey = (fetcher, variables) => {
  const id = fetcher.name || "anonymous";
  return `${id}|${serialize(variables)}`;
};

/**
 * Retrieve a cached response if present and still valid.
 *
 * @param {Function} fetcher Fetcher reference.
 * @param {any} variables Fetcher variables.
 * @param {number} now Current timestamp in milliseconds.
 * @returns {any|null}
 */
const getCachedGitHubResponse = (fetcher, variables, now = Date.now()) => {
  const ttl = getGitHubCacheTTL();
  if (ttl <= 0) {
    return null;
  }

  const fetcherCache = cacheStore.get(fetcher);
  if (!fetcherCache) {
    return null;
  }

  const key = buildCacheKey(fetcher, variables);
  const entry = fetcherCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    fetcherCache.delete(key);
    return null;
  }

  return entry.value;
};

/**
 * Persist a response in the cache store respecting the configured TTL.
 *
 * @param {Function} fetcher Fetcher reference.
 * @param {any} variables Fetcher variables.
 * @param {any} value Response value to cache.
 * @param {number} now Current timestamp in milliseconds.
 */
const setCachedGitHubResponse = (fetcher, variables, value, now = Date.now()) => {
  const ttl = getGitHubCacheTTL();
  if (ttl <= 0) {
    return;
  }

  let fetcherCache = cacheStore.get(fetcher);
  if (!fetcherCache) {
    fetcherCache = new Map();
    cacheStore.set(fetcher, fetcherCache);
  }

  const key = buildCacheKey(fetcher, variables);
  const expiresAt = now + ttl * 1000;
  fetcherCache.set(key, { value, expiresAt });
};

/**
 * Clear all cached GitHub responses.
 */
const clearGitHubResponseCache = () => {
  cacheStore.clear();
};

export {
  getGitHubCacheTTL,
  getCachedGitHubResponse,
  setCachedGitHubResponse,
  clearGitHubResponseCache,
  DEFAULT_TTL_SECONDS,
  MIN_TTL_SECONDS,
  MAX_TTL_SECONDS,
};
