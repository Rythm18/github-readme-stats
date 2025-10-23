// @ts-check

import { compareUsers, formatComparison } from "../src/compare.js";
import { fetchStats } from "../src/fetchers/stats.js";
import { CACHE_TTL } from "../src/common/cache.js";

/**
 * API handler for comparing multiple GitHub users.
 *
 * @param {Object} req Request object
 * @param {Object} res Response object
 * @returns {Promise<void>} Promise that resolves when response is sent
 */
export default async function compareHandler(req, res) {
  const { usernames, format = "json" } = req.query;

  // Validate input
  if (!usernames) {
    res.status(400);
    return res.json({
      error: "Missing required parameter: usernames",
    });
  }

  const usernameList = usernames.split(",").map((u) => u.trim());

  if (usernameList.length < 2 || usernameList.length > 5) {
    res.status(400);
    return res.json({
      error: "Please provide between 2-5 usernames",
    });
  }

  try {
    // Fetch stats for all users in parallel
    const statsPromises = usernameList.map((username) =>
      fetchStats(username, false, [], false, false, false),
    );

    const allStats = await Promise.all(statsPromises);

    // Prepare user data for comparison
    const users = allStats.map((stats, idx) => ({
      username: usernameList[idx],
      totalStars: stats.totalStars,
      totalCommits: stats.totalCommits,
      totalPRs: stats.totalPRs,
      totalIssues: stats.totalIssues,
    }));

    // Compare users
    const comparison = compareUsers(users);

    // Set cache headers
    res.setHeader(
      "Cache-Control",
      `max-age=${CACHE_TTL.STATS_CARD.DEFAULT}, s-maxage=${CACHE_TTL.STATS_CARD.DEFAULT}`,
    );

    // Format and return response
    if (format === "markdown") {
      res.status(200);
      res.setHeader("Content-Type", "text/markdown");
      return res.send(formatComparison(comparison, "markdown"));
    }

    // Default: JSON response
    res.status(200);
    return res.json(comparison);
  } catch (error) {
    res.status(500);
    return res.json({
      error: error instanceof Error ? error.message : "Failed to compare users",
    });
  }
}
