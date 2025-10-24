// @ts-check

import {
  compareUsers,
  formatCompact,
  formatLeaderboard,
} from "../src/comparison/compare.js";
import {
  CACHE_TTL,
  resolveCacheSeconds,
  setCacheHeaders,
} from "../src/common/cache.js";
import { CustomError } from "../src/common/error.js";
import { parseArray, parseBoolean } from "../src/common/ops.js";
import { whitelist } from "../src/common/envs.js";
import { blacklist } from "../src/common/blacklist.js";
import { fetchStats } from "../src/fetchers/stats.js";

/**
 * Validate and extract user parameters from query.
 *
 * @param {Object} query Request query object.
 * @returns {{usernames: Array<string>, error?: string}} Validation result.
 */
const extractUsernames = (query) => {
  const usernames = [];

  // Extract user1 through user5
  for (let i = 1; i <= 5; i++) {
    const userParam = `user${i}`;
    if (query[userParam]) {
      usernames.push(query[userParam].trim());
    }
  }

  if (usernames.length === 0) {
    return {
      usernames: [],
      error: "Missing required parameters: user1, user2",
    };
  }

  if (usernames.length === 1) {
    return {
      usernames: [],
      error: "Please provide at least 2 users (user1 and user2)",
    };
  }

  return { usernames };
};

/**
 * Validate stats parameter.
 *
 * @param {string|undefined} statsParam Stats query parameter.
 * @returns {{stats: Array<string>, error?: string}} Validation result.
 */
const validateStats = (statsParam) => {
  if (!statsParam) {
    return { stats: [] }; // Empty means all stats
  }

  const validStats = [
    "commits",
    "prs",
    "issues",
    "stars",
    "reviews",
    "discussions_started",
    "discussions_answered",
    "contributed_to",
    "rank",
  ];

  const requestedStats = statsParam.split(",").map((s) => s.trim());
  const invalidStats = requestedStats.filter((s) => !validStats.includes(s));

  if (invalidStats.length > 0) {
    return {
      stats: [],
      error: `Invalid stats: ${invalidStats.join(", ")}. Valid options: ${validStats.join(", ")}`,
    };
  }

  // Map short names to full property names
  const statsMapping = {
    commits: "totalCommits",
    prs: "totalPRs",
    issues: "totalIssues",
    stars: "totalStars",
    reviews: "totalReviews",
    discussions_started: "totalDiscussionsStarted",
    discussions_answered: "totalDiscussionsAnswered",
    contributed_to: "contributedTo",
    rank: "rank",
  };

  return {
    stats: requestedStats.map((s) => statsMapping[s]),
  };
};

/**
 * Validate format parameter.
 *
 * @param {string|undefined} formatParam Format query parameter.
 * @returns {{format: string, error?: string}} Validation result.
 */
const validateFormat = (formatParam) => {
  const format = formatParam || "detailed";
  const validFormats = ["detailed", "compact", "leaderboard"];

  if (!validFormats.includes(format)) {
    return {
      format: "detailed",
      error: `Invalid format: ${format}. Valid options: ${validFormats.join(", ")}`,
    };
  }

  return { format };
};

/**
 * API handler for comparing multiple GitHub users.
 *
 * @param {Object} req Request object.
 * @param {Object} res Response object.
 * @returns {Promise<void>} Promise that resolves when response is sent.
 */
export default async function compareHandler(req, res) {
  const {
    format: formatParam,
    stats: statsParam,
    include_all_commits,
    exclude_repo,
    cache_seconds,
  } = req.query;

  // Set JSON content type
  res.setHeader("Content-Type", "application/json");

  // Extract and validate usernames
  const { usernames, error: usernamesError } = extractUsernames(req.query);
  if (usernamesError) {
    res.status(400);
    return res.json({
      error: "Bad Request",
      message: usernamesError,
      code: "MISSING_PARAMS",
    });
  }

  // Validate format
  const { format, error: formatError } = validateFormat(formatParam);
  if (formatError) {
    res.status(400);
    return res.json({
      error: "Bad Request",
      message: formatError,
      code: "INVALID_FORMAT",
    });
  }

  // Validate stats
  const { stats, error: statsError } = validateStats(statsParam);
  if (statsError) {
    res.status(400);
    return res.json({
      error: "Bad Request",
      message: statsError,
      code: "INVALID_STATS",
    });
  }

  // Check access control for all usernames
  // Note: We implement custom access logic here because guardAccess is designed for SVG responses
  for (const username of usernames) {
    // Check whitelist
    if (Array.isArray(whitelist) && !whitelist.includes(username)) {
      res.status(403);
      return res.json({
        error: "Forbidden",
        message: "This username is not whitelisted",
        code: "ACCESS_DENIED",
      });
    }

    // Check blacklist
    if (whitelist === undefined && blacklist.includes(username)) {
      res.status(403);
      return res.json({
        error: "Forbidden",
        message: "This username is blacklisted",
        code: "ACCESS_DENIED",
      });
    }
  }

  try {
    const includeAllCommits = parseBoolean(include_all_commits);
    const excludeRepos = parseArray(exclude_repo);

    // Determine what additional data to fetch based on stats requested
    const needsMergedPRs =
      stats.length === 0 || stats.includes("totalPRsMerged");
    const needsDiscussions =
      stats.length === 0 || stats.includes("totalDiscussionsStarted");
    const needsDiscussionsAnswered =
      stats.length === 0 || stats.includes("totalDiscussionsAnswered");

    // Fetch stats for all users in parallel
    const statsPromises = usernames.map((username) =>
      fetchStats(
        username,
        includeAllCommits,
        excludeRepos,
        needsMergedPRs,
        needsDiscussions,
        needsDiscussionsAnswered,
      ),
    );

    const allStats = await Promise.all(statsPromises);

    // Compare users
    const comparison = compareUsers(allStats, usernames, stats);

    // Set cache headers
    const cacheSeconds = resolveCacheSeconds({
      requested: parseInt(cache_seconds, 10),
      def: CACHE_TTL.COMPARE_API.DEFAULT,
      min: CACHE_TTL.COMPARE_API.MIN,
      max: CACHE_TTL.COMPARE_API.MAX,
    });
    setCacheHeaders(res, cacheSeconds);

    // Format response based on requested format
    let response;
    if (format === "compact") {
      response = formatCompact(comparison);
    } else if (format === "leaderboard") {
      response = formatLeaderboard(comparison);
    } else {
      response = comparison; // detailed is the default full format
    }

    res.status(200);
    return res.json(response);
  } catch (err) {
    // Handle specific error types
    if (err instanceof CustomError) {
      if (err.type === CustomError.USER_NOT_FOUND) {
        res.status(404);
        return res.json({
          error: "Not Found",
          message: err.message,
          code: "USER_NOT_FOUND",
        });
      }

      if (err.type === CustomError.GRAPHQL_ERROR) {
        res.status(500);
        return res.json({
          error: "Internal Server Error",
          message: err.message,
          code: "FETCH_ERROR",
        });
      }
    }

    // Generic error handling
    res.status(500);
    return res.json({
      error: "Internal Server Error",
      message: err instanceof Error ? err.message : "Failed to compare users",
      code: "INTERNAL_ERROR",
    });
  }
}
