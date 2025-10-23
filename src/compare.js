// @ts-check

/**
 * Compare multiple users and determine leader.
 *
 * @param {Array<Object>} users Array of user stats objects
 * @returns {{leader: string, comparisons: Array<Object>, diffs: Object}} Comparison result
 */
export const compareUsers = (users) => {
  if (!users || users.length < 2) {
    throw new Error("At least 2 users required for comparison");
  }

  // Calculate total score for each user
  const usersWithScores = users.map((user) => ({
    ...user,
    score:
      (user.totalStars || 0) +
      (user.totalCommits || 0) +
      (user.totalPRs || 0) +
      (user.totalIssues || 0),
  }));

  // Find leader (highest score)
  const leader = usersWithScores.reduce((max, user) =>
    user.score > max.score ? user : max,
  );

  // Calculate differences from leader for each metric
  const diffs = {
    totalStars: [],
    totalCommits: [],
    totalPRs: [],
    totalIssues: [],
  };

  usersWithScores.forEach((user) => {
    diffs.totalStars.push((leader.totalStars || 0) - (user.totalStars || 0));
    diffs.totalCommits.push(
      (leader.totalCommits || 0) - (user.totalCommits || 0),
    );
    diffs.totalPRs.push((leader.totalPRs || 0) - (user.totalPRs || 0));
    diffs.totalIssues.push((leader.totalIssues || 0) - (user.totalIssues || 0));
  });

  return {
    leader: leader.username,
    comparisons: usersWithScores,
    diffs,
  };
};

/**
 * Format comparison result in specified format.
 *
 * @param {Object} comparison Comparison result
 * @param {string} format Output format (json or markdown)
 * @returns {string} Formatted output
 */
export const formatComparison = (comparison, format = "json") => {
  if (format === "markdown") {
    let output = `# User Comparison\n\n`;
    output += `## Leader: ${comparison.leader}\n\n`;
    output += `| Username | Stars | Commits | PRs | Issues | Score |\n`;
    output += `|----------|-------|---------|-----|--------|-------|\n`;

    comparison.comparisons.forEach((user) => {
      output += `| ${user.username} | ${user.totalStars || 0} | ${user.totalCommits || 0} | ${user.totalPRs || 0} | ${user.totalIssues || 0} | ${user.score || 0} |\n`;
    });

    output += `\n## Differences from Leader\n\n`;
    output += `| Username | Stars Diff | Commits Diff | PRs Diff | Issues Diff |\n`;
    output += `|----------|------------|--------------|----------|-------------|\n`;

    comparison.comparisons.forEach((user, idx) => {
      const starsDiff = comparison.diffs.totalStars?.[idx] ?? 0;
      const commitsDiff = comparison.diffs.totalCommits?.[idx] ?? 0;
      const prsDiff = comparison.diffs.totalPRs?.[idx] ?? 0;
      const issuesDiff = comparison.diffs.totalIssues?.[idx] ?? 0;
      output += `| ${user.username} | ${starsDiff} | ${commitsDiff} | ${prsDiff} | ${issuesDiff} |\n`;
    });

    return output;
  }

  // Default: JSON format
  return JSON.stringify(comparison, null, 2);
};
