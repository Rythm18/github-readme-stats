// @ts-check

import { parseArray, parseBoolean } from "../src/common/ops.js";
import {
  CACHE_TTL,
  resolveCacheSeconds,
  setCacheHeaders,
  setErrorCacheHeaders,
} from "../src/common/cache.js";
import { whitelist } from "../src/common/envs.js";
import { blacklist } from "../src/common/blacklist.js";
import { CustomError } from "../src/common/error.js";
import { logger } from "../src/common/log.js";
import { fetchStats } from "../src/fetchers/stats.js";

/**
 * In-memory cache for compare results.
 * @type {Map<string, { expiresAt: number, createdAt: number, payload: any }>}
 */
const compareCache = new Map();

/**
 * Normalize and build a deterministic cache key based on the request options.
 * @param {object} args
 */
const buildCacheKey = (args) => {
  const {
    users,
    include_all_commits,
    exclude_repo,
    stats,
    format,
    commits_year,
  } = args;

  const key = {
    users: [...users].sort(),
    include_all_commits: !!include_all_commits,
    exclude_repo: [...(exclude_repo || [])].sort(),
    stats: [...(stats || [])].sort(),
    format: format || "detailed",
    commits_year: commits_year || undefined,
  };
  return JSON.stringify(key);
};

/**
 * Validate a possibly provided PAT token.
 * Reject obviously invalid tokens early to avoid unnecessary processing.
 *
 * @param {string|undefined} token
 * @returns {boolean}
 */
const isLikelyValidToken = (token) => {
  if (!token) return true; // nothing to validate
  // Accept common GitHub token formats: classic (ghp_) or fine-grained (github_pat_)
  const trimmed = String(token).trim();
  if (trimmed.startsWith("ghp_") && trimmed.length >= 20) return true;
  if (trimmed.startsWith("github_pat_") && trimmed.length >= 25) return true;
  return false;
};

/**
 * Select numeric stats keys that can be compared.
 *
 * @type {readonly string[]}
 */
const NUMERIC_STATS = [
  "totalStars",
  "totalCommits",
  "totalIssues",
  "totalPRs",
  "totalPRsMerged",
  "mergedPRsPercentage",
  "totalReviews",
  "totalDiscussionsStarted",
  "totalDiscussionsAnswered",
  "contributedTo",
];

/**
 * Compute per-stat leaders and differences.
 *
 * @param {Record<string, Record<string, number>>} userStatsMap map of username -> stats object (numeric values only)
 * @param {string[]} includeStats which stats to include in diff
 */
const computeDiff = (userStatsMap, includeStats) => {
  const diff = {};
  const statsToUse = includeStats && includeStats.length ? includeStats : NUMERIC_STATS;

  for (const stat of statsToUse) {
    const entries = Object.entries(userStatsMap).map(([user, s]) => ({
      user,
      value: Number(s[stat] ?? 0),
    }));
    if (!entries.length) continue;
    entries.sort((a, b) => b.value - a.value);
    const leaderEntry = entries[0];
    const secondEntry = entries[1] || { user: undefined, value: 0 };

    const difference = leaderEntry.value - secondEntry.value;
    const percentDifference = secondEntry.value === 0
      ? (leaderEntry.value > 0 ? 100 : 0)
      : (difference / secondEntry.value) * 100;

    diff[stat] = {
      leader: leaderEntry.user,
      difference,
      percentDifference,
    };
  }

  return diff;
};

/**
 * Build leaderboard from user stats.
 *
 * @param {Record<string, Record<string, number>>} userStatsMap map of username -> stats object (numeric values only)
 * @param {string[]} includeStats which stats to include when scoring
 */
const buildLeaderboard = (userStatsMap, includeStats) => {
  const statsToUse = includeStats && includeStats.length ? includeStats : NUMERIC_STATS;
  // Simple scoring: sum of selected stats; percentage stats are down-weighted
  const scoreFor = (s) => {
    return statsToUse.reduce((acc, key) => {
      const val = Number(s[key] ?? 0);
      // avoid overweighting percentage metric
      if (key === "mergedPRsPercentage") return acc + val / 100;
      return acc + val;
    }, 0);
  };

  const rows = Object.entries(userStatsMap).map(([user, s]) => ({
    user,
    score: scoreFor(s),
  }));
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, idx) => ({ rank: idx + 1, username: r.user, score: r.score }));
};

/**
 * Pick only numeric comparable props from the full stats object.
 * @param {import('../src/fetchers/stats').StatsData | Record<string, any>} stats
 */
const pickNumericStats = (stats) => {
  const out = {};
  for (const k of NUMERIC_STATS) {
    // @ts-ignore
    if (typeof stats[k] === "number") out[k] = stats[k];
  }
  return out;
};

/**
 * Main compare API handler.
 *
 * Supported query params:
 * - user1..user5 or users (comma-separated)
 * - format: detailed | compact | leaderboard (default: detailed)
 * - stats: comma-separated subset of numeric stats to compare
 * - include_all_commits: boolean
 * - exclude_repo: comma-separated list
 * - cache_seconds: custom cache TTL
 * - token: optional GitHub PAT to validate format; invalid tokens rejected with 400
 */
// @ts-ignore
export default async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  // Build users list from query
  const q = req.query || {};
  /** @type {string[]} */
  let users = [];
  if (q.users) {
    users = parseArray(q.users).filter(Boolean);
  }
  for (let i = 1; i <= 5; i++) {
    const key = `user${i}`;
    if (q[key]) users.push(q[key]);
  }
  // De-duplicate while preserving order
  users = users.filter((u, idx) => users.indexOf(u) === idx);

  // Basic validation of user count
  if (users.length < 2) {
    if (typeof res.status === "function") res.status(400);
    return res.json({ error: "At least two users must be provided" });
  }
  if (users.length > 5) {
    if (typeof res.status === "function") res.status(400);
    return res.json({ error: "A maximum of five users can be compared" });
  }

  // Validate token (if provided) to avoid accepting obviously invalid PATs.
  const token = q.token;
  if (!isLikelyValidToken(token)) {
    if (typeof res.status === "function") res.status(400);
    return res.json({ error: "Invalid GitHub token format" });
  }

  // Access control using whitelist/blacklist semantics
  if (Array.isArray(whitelist)) {
    const notWhitelisted = users.find((u) => !whitelist.includes(u));
    if (notWhitelisted) {
      if (typeof res.status === "function") res.status(403);
      return res.json({ error: "This username is not whitelisted" });
    }
  } else {
    const isBlacklisted = users.some((u) => blacklist.includes(u));
    if (isBlacklisted) {
      if (typeof res.status === "function") res.status(403);
      return res.json({ error: "This username is blacklisted" });
    }
  }

  // Parse options
  const format = (q.format ? String(q.format).toLowerCase() : "detailed");
  const allowedFormats = ["detailed", "compact", "leaderboard"];
  if (!allowedFormats.includes(format)) {
    if (typeof res.status === "function") res.status(400);
    return res.json({ error: "Unsupported format" });
  }

  const includeStats = parseArray(q.stats)
    .map((s) => s.trim())
    .filter((s) => NUMERIC_STATS.includes(s));

  const include_all_commits = parseBoolean(q.include_all_commits);
  const exclude_repo = parseArray(q.exclude_repo);
  const commits_year = q.commits_year ? parseInt(q.commits_year, 10) : undefined;

  // Cache handling
  const cacheSeconds = resolveCacheSeconds({
    requested: parseInt(q.cache_seconds, 10),
    def: CACHE_TTL.STATS_CARD.DEFAULT,
    min: CACHE_TTL.STATS_CARD.MIN,
    max: CACHE_TTL.STATS_CARD.MAX,
  });

  setCacheHeaders(res, cacheSeconds);

  const cacheKey = buildCacheKey({
    users,
    include_all_commits,
    exclude_repo,
    stats: includeStats,
    format,
    commits_year,
  });

  const now = Date.now();
  const cached = compareCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    const payload = { ...cached.payload, cached: true };
    if (typeof res.status === "function") res.status(200);
    return res.json(payload);
  }

  try {
    // Determine which auxiliary fields are needed based on requested stats
    const needMergedPRs = includeStats.includes("totalPRsMerged") || includeStats.includes("mergedPRsPercentage");
    const needDiscussions = includeStats.includes("totalDiscussionsStarted");
    const needDiscussionAnswers = includeStats.includes("totalDiscussionsAnswered");

    // Fetch each user's stats
    const results = await Promise.all(
      users.map((u) =>
        fetchStats(
          u,
          !!include_all_commits,
          exclude_repo,
          needMergedPRs,
          needDiscussions,
          needDiscussionAnswers,
          commits_year,
        ).then((s) => ({ username: u, stats: s }))
      ),
    );

    // Build per-user numeric stats map
    /** @type {Record<string, Record<string, number>>} */
    const dataMap = {};
    for (const r of results) {
      dataMap[r.username] = pickNumericStats(r.stats);
    }

    const diff = computeDiff(dataMap, includeStats);

    const timestamp = new Date().toISOString();

    /** @type {any} */
    let payload;
    if (format === "leaderboard") {
      const leaderboard = buildLeaderboard(dataMap, includeStats);
      payload = {
        users,
        leaderboard,
        timestamp,
        cached: false,
      };
    } else if (format === "compact") {
      payload = {
        users,
        diff,
        timestamp,
        cached: false,
      };
    } else {
      // detailed
      payload = {
        users,
        data: dataMap,
        diff,
        // Provide simple insights: leader summaries and classification
        summary: Object.keys(diff).map((stat) => {
          const d = diff[stat];
          const classification = d.percentDifference < 5 ? "close" : d.percentDifference >= 25 ? "significant" : "moderate";
          return {
            stat,
            leader: d.leader,
            percentDifference: d.percentDifference,
            classification,
          };
        }),
        timestamp,
        cached: false,
      };
    }

    // Store in cache
    compareCache.set(cacheKey, {
      payload,
      createdAt: now,
      expiresAt: now + cacheSeconds * 1000,
    });

    if (typeof res.status === "function") res.status(200);
    return res.json(payload);
  } catch (err) {
    // Map known errors to HTTP codes and neutral messages
    let status = 500;
    let message = "Internal Server Error";

    if (err instanceof CustomError) {
      // specific handling
      if (err.type === CustomError.USER_NOT_FOUND) {
        status = 404;
        message = err.message || "User not found";
      } else if (err.type === CustomError.MAX_RETRY) {
        status = 429;
        message = err.message || "Rate limited";
      } else if (err.type === CustomError.NO_TOKENS) {
        status = 500;
        message = "No GitHub API tokens found";
      } else {
        status = 500;
        message = err.message || message;
      }
    } else if (err instanceof Error) {
      // network or unexpected errors
      message = err.message || message;
    }

    // set shorter cache for errors
    setErrorCacheHeaders(res);

    logger.error(err);
    if (typeof res.status === "function") res.status(status);
    // Do not leak internal details: only send message
    return res.json({ error: message });
  }
};
