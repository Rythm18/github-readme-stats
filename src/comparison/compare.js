// @ts-check

/**
 * Calculate the percentage change between two values relative to a baseline.
 *
 * @param {number} value Value to compare.
 * @param {number} baseline Baseline value.
 * @returns {number} Percentage change.
 */
const calculatePercentageChange = (value, baseline) => {
  if (baseline === 0) {
    return value === 0 ? 0 : 100;
  }

  return ((value - baseline) / baseline) * 100;
};

/**
 * Determine the leader for a specific metric.
 *
 * @param {Object.<string, number>} userValues Object mapping username to value for the metric.
 * @returns {{leader: string, leaderValue: number, runnerUpValue: number}} Leader info.
 */
const determineLeader = (userValues) => {
  let leader = "";
  let leaderValue = -Infinity;

  for (const [username, value] of Object.entries(userValues)) {
    if (value > leaderValue) {
      leaderValue = value;
      leader = username;
    }
  }

  const sortedValues = Object.values(userValues).sort((a, b) => b - a);
  const runnerUpValue = sortedValues.length > 1 ? sortedValues[1] : 0;

  return { leader, leaderValue, runnerUpValue };
};

/**
 * Count how many metrics each user leads in.
 *
 * @param {Object} diff Diff object with leader info per metric.
 * @returns {Object.<string, number>} Object mapping username to win count.
 */
const countStatsWon = (diff) => {
  const counts = {};

  for (const [, data] of Object.entries(diff)) {
    if (data.leader && typeof data.leader === "string") {
      counts[data.leader] = (counts[data.leader] || 0) + 1;
    }
  }

  return counts;
};

/**
 * Identify stats where differences are close (within 10%).
 *
 * @param {Object} diff Diff object.
 * @returns {Array<string>} Array of metric names that are close.
 */
const identifyCloseStats = (diff) => {
  const closeStats = [];

  for (const [metric, data] of Object.entries(diff)) {
    if (data.percentage !== undefined && Math.abs(data.percentage) < 10) {
      closeStats.push(metric);
    }
  }

  return closeStats;
};

/**
 * Identify stats with significant differences (over 50%).
 *
 * @param {Object} diff Diff object.
 * @returns {Array<string>} Array of metric names with significant differences.
 */
const identifySignificantDifferences = (diff) => {
  const significantStats = [];

  for (const [metric, data] of Object.entries(diff)) {
    if (data.percentage !== undefined && Math.abs(data.percentage) > 50) {
      significantStats.push(metric);
    }
  }

  return significantStats;
};

/**
 * Compare GitHub statistics between multiple users.
 *
 * @param {Array<Object>} usersStats Array of user stats objects from fetchStats.
 * @param {Array<string>} usernames Array of usernames in the same order.
 * @param {Array<string>} statsToCompare Array of stat keys to compare (or empty for all).
 * @returns {Object} Comparison result with detailed, compact, and leaderboard formats.
 */
export const compareUsers = (usersStats, usernames, statsToCompare = []) => {
  const timestamp = new Date().toISOString();

  // Build the data object with each user's stats
  const data = {};
  usersStats.forEach((stats, idx) => {
    const username = usernames[idx];
    data[username] = {
      name: stats.name || username,
      totalCommits: stats.totalCommits || 0,
      totalPRs: stats.totalPRs || 0,
      totalPRsMerged: stats.totalPRsMerged || 0,
      mergedPRsPercentage: stats.mergedPRsPercentage || 0,
      totalReviews: stats.totalReviews || 0,
      totalIssues: stats.totalIssues || 0,
      totalStars: stats.totalStars || 0,
      totalDiscussionsStarted: stats.totalDiscussionsStarted || 0,
      totalDiscussionsAnswered: stats.totalDiscussionsAnswered || 0,
      contributedTo: stats.contributedTo || 0,
      rank: stats.rank || { level: "C", percentile: 0 },
    };
  });

  // Determine which metrics to compare
  const metricsToCompare =
    statsToCompare.length > 0
      ? statsToCompare
      : [
          "totalCommits",
          "totalPRs",
          "totalPRsMerged",
          "mergedPRsPercentage",
          "totalReviews",
          "totalIssues",
          "totalStars",
          "totalDiscussionsStarted",
          "totalDiscussionsAnswered",
          "contributedTo",
        ];

  // Calculate differences for each metric
  const diff = {};

  metricsToCompare.forEach((metric) => {
    const userValues = {};
    usernames.forEach((username) => {
      userValues[username] = data[username][metric] || 0;
    });

    const { leader, leaderValue, runnerUpValue } = determineLeader(userValues);

    const differences = {};
    const percentages = {};

    usernames.forEach((username) => {
      differences[username] = userValues[username] - leaderValue;
      percentages[username] = calculatePercentageChange(
        userValues[username],
        leaderValue,
      );
    });

    const difference = leaderValue - runnerUpValue;
    const percentage =
      runnerUpValue === 0
        ? difference === 0
          ? 0
          : 100
        : (difference / runnerUpValue) * 100;

    diff[metric] = {
      ...userValues,
      difference,
      percentage: Math.abs(percentage),
      leader,
      differences,
      percentages,
    };
  });

  // Add rank comparison
  if (usernames.every((u) => data[u].rank)) {
    const rankPercentiles = {};
    usernames.forEach((username) => {
      rankPercentiles[username] = data[username].rank.percentile;
    });

    const { leader: rankLeader } = determineLeader(rankPercentiles);
    const rankDifferences = {};

    usernames.forEach((username) => {
      rankDifferences[username] =
        rankPercentiles[username] - rankPercentiles[rankLeader];
    });

    diff.rank = {};
    usernames.forEach((username) => {
      diff.rank[username] = data[username].rank;
    });
    diff.rank.percentileDifference =
      Math.max(...Object.values(rankPercentiles)) -
      Math.min(...Object.values(rankPercentiles));
    diff.rank.leader = rankLeader;
  }

  // Calculate summary
  const statsWon = countStatsWon(diff);

  // Ensure every user appears in stats_won map
  usernames.forEach((username) => {
    if (statsWon[username] === undefined) {
      statsWon[username] = 0;
    }
  });

  const statsWonEntries = Object.entries(statsWon).sort((a, b) => b[1] - a[1]);
  const overallLeader = statsWonEntries.length
    ? statsWonEntries[0][0]
    : usernames[0];

  const summary = {
    overall_leader: overallLeader,
    stats_won: statsWon,
    close_stats: identifyCloseStats(diff),
    significant_differences: identifySignificantDifferences(diff),
  };

  return {
    comparison: {
      users: usernames,
      timestamp,
      cached: false,
    },
    data,
    diff,
    summary,
  };
};

/**
 * Format comparison result for compact output.
 *
 * @param {Object} fullComparison Full comparison result from compareUsers.
 * @returns {Object} Compact format.
 */
export const formatCompact = (fullComparison) => {
  const { comparison, diff, summary } = fullComparison;

  const compactDiff = {};

  for (const [metric, data] of Object.entries(diff)) {
    if (metric === "rank") {
      continue;
    }

    const userValues = {};
    comparison.users.forEach((username) => {
      userValues[username] = data[username];
    });

    compactDiff[metric] = {
      ...userValues,
      delta: data.difference,
      leader: data.leader,
    };
  }

  return {
    users: comparison.users,
    timestamp: comparison.timestamp,
    diff: compactDiff,
    leader: summary.overall_leader,
  };
};

/**
 * Format comparison result for leaderboard output.
 *
 * @param {Object} fullComparison Full comparison result from compareUsers.
 * @returns {Object} Leaderboard format.
 */
export const formatLeaderboard = (fullComparison) => {
  const { comparison, data, summary } = fullComparison;

  const leaderboard = comparison.users.map((username) => {
    const userData = data[username];

    // Calculate total score for sorting
    const totalScore =
      userData.totalCommits * 1 +
      userData.totalPRs * 2 +
      userData.totalStars * 0.5 +
      userData.totalIssues * 1 +
      userData.totalReviews * 2 +
      (userData.rank?.percentile || 0) * 10;

    return {
      username,
      totalScore: Math.round(totalScore),
      stats: {
        totalCommits: userData.totalCommits,
        totalPRs: userData.totalPRs,
        totalStars: userData.totalStars,
        totalIssues: userData.totalIssues,
        totalReviews: userData.totalReviews,
        rank: userData.rank,
      },
      wins: summary.stats_won[username] || 0,
    };
  });

  // Sort by total score descending
  leaderboard.sort((a, b) => b.totalScore - a.totalScore);

  // Add rank positions
  leaderboard.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return {
    leaderboard,
    timestamp: comparison.timestamp,
  };
};
