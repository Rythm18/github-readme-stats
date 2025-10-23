// @ts-check

import { describe, expect, it } from "@jest/globals";
import { compareUsers, formatComparison } from "../src/compare.js";

describe("compareUsers", () => {
  it("should compare two users and identify leader", () => {
    const users = [
      {
        username: "user1",
        totalStars: 100,
        totalCommits: 200,
        totalPRs: 50,
        totalIssues: 30,
      },
      {
        username: "user2",
        totalStars: 150,
        totalCommits: 180,
        totalPRs: 60,
        totalIssues: 25,
      },
    ];

    const result = compareUsers(users);

    expect(result.leader).toBe("user2");
    expect(result.comparisons).toHaveLength(2);
    expect(result.comparisons[0].username).toBe("user1");
    expect(result.comparisons[1].username).toBe("user2");
  });

  it("should calculate differences between users", () => {
    const users = [
      {
        username: "user1",
        totalStars: 100,
        totalCommits: 200,
        totalPRs: 50,
        totalIssues: 30,
      },
      {
        username: "user2",
        totalStars: 150,
        totalCommits: 180,
        totalPRs: 60,
        totalIssues: 25,
      },
    ];

    const result = compareUsers(users);

    expect(result.diffs).toBeDefined();
    expect(result.diffs.totalStars).toEqual([50, 0]);
    expect(result.diffs.totalCommits).toEqual([-20, 0]);
  });

  it("should handle 3-5 users", () => {
    const users = [
      {
        username: "user1",
        totalStars: 100,
        totalCommits: 200,
        totalPRs: 50,
        totalIssues: 30,
      },
      {
        username: "user2",
        totalStars: 150,
        totalCommits: 180,
        totalPRs: 60,
        totalIssues: 25,
      },
      {
        username: "user3",
        totalStars: 120,
        totalCommits: 220,
        totalPRs: 55,
        totalIssues: 28,
      },
    ];

    const result = compareUsers(users);

    expect(result.comparisons).toHaveLength(3);
    expect(result.leader).toBeDefined();
    expect(result.diffs.totalStars).toHaveLength(3);
  });

  it("should identify correct leader based on total score", () => {
    const users = [
      {
        username: "user1",
        totalStars: 50,
        totalCommits: 50,
        totalPRs: 50,
        totalIssues: 50,
      },
      {
        username: "user2",
        totalStars: 200,
        totalCommits: 200,
        totalPRs: 200,
        totalIssues: 200,
      },
    ];

    const result = compareUsers(users);

    expect(result.leader).toBe("user2");
  });
});

describe("formatComparison", () => {
  it("should format comparison as JSON", () => {
    const comparison = {
      leader: "user1",
      comparisons: [
        { username: "user1", totalStars: 100 },
        { username: "user2", totalStars: 50 },
      ],
      diffs: { totalStars: [50, 0] },
    };

    const result = formatComparison(comparison, "json");

    expect(result).toContain("user1");
    expect(result).toContain("user2");
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("should format comparison as markdown", () => {
    const comparison = {
      leader: "user1",
      comparisons: [
        { username: "user1", totalStars: 100 },
        { username: "user2", totalStars: 50 },
      ],
      diffs: { totalStars: [50, 0] },
    };

    const result = formatComparison(comparison, "markdown");

    expect(result).toContain("user1");
    expect(result).toContain("user2");
    expect(result).toContain("#");
  });
});
