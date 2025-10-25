// @ts-check

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

const fetchStatsMock = jest.fn();
const guardAccessMock = jest.fn();

jest.unstable_mockModule("../src/fetchers/stats.js", () => ({
  fetchStats: fetchStatsMock,
  default: fetchStatsMock,
}));

jest.unstable_mockModule("../src/common/access.js", () => ({
  guardAccess: guardAccessMock,
}));

const loadCompareHandler = async () => {
  if (loadCompareHandler.cached) {
    return loadCompareHandler.cached;
  }

  const candidates = ["../api/compare.js", "../api/compare.ts"];
  let lastError;

  for (const candidate of candidates) {
    try {
      const module = await import(candidate);
      loadCompareHandler.cached = module.default;
      return loadCompareHandler.cached;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

/**
 * @typedef {import("../src/fetchers/stats.js").StatsData} StatsData
 */

/**
 * Build a StatsData mock for a given user.
 *
 * @param {string} username
 * @param {Partial<StatsData>} [overrides]
 * @returns {StatsData}
 */
const makeStats = (username, overrides = {}) => ({
  name: `${username} Doe`,
  totalCommits: 200,
  totalPRs: 50,
  totalPRsMerged: 30,
  mergedPRsPercentage: 60,
  totalReviews: 25,
  totalIssues: 40,
  totalStars: 120,
  totalDiscussionsStarted: 5,
  totalDiscussionsAnswered: 3,
  contributedTo: 10,
  rank: { level: "A", percentile: 90 },
  ...overrides,
});

/**
 * Create a mock Express-style response.
 */
const createMockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  setHeader: jest.fn(),
});

/**
 * Invoke the compare handler with a query object.
 *
 * @param {Record<string, unknown>} query
 */
const invokeCompare = async (query) => {
  const handler = await loadCompareHandler();
  const req = { query };
  const res = createMockResponse();

  await handler(req, res);

  return res;
};

/**
 * Extract the last JSON payload sent through res.json.
 */
const getPayload = (res) => res.json.mock.calls.at(-1)?.[0];

beforeEach(() => {
  fetchStatsMock.mockReset();
  guardAccessMock.mockReset();
  guardAccessMock.mockReturnValue({ isPassed: true, result: undefined });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/compare", () => {
  describe("parameter validation", () => {
    it("returns 400 when fewer than two users are provided", async () => {
      const res = await invokeCompare({});

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/user/i),
        }),
      );
      expect(fetchStatsMock).not.toHaveBeenCalled();
    });

    it("accepts exactly two users", async () => {
      fetchStatsMock
        .mockResolvedValueOnce(makeStats("alice", { totalStars: 100 }))
        .mockResolvedValueOnce(makeStats("bob", { totalStars: 150 }));

      const res = await invokeCompare({ user1: "alice", user2: "bob" });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });

    it("accepts up to five users", async () => {
      const users = ["alice", "bob", "charlie", "dave", "eve"];
      users.forEach((username, index) => {
        fetchStatsMock.mockResolvedValueOnce(
          makeStats(username, { totalStars: 100 + index * 10 }),
        );
      });

      const res = await invokeCompare({
        user1: users[0],
        user2: users[1],
        user3: users[2],
        user4: users[3],
        user5: users[4],
      });

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = getPayload(res);
      expect(payload?.comparison?.users).toHaveLength(5);
      expect(payload.comparison.users).toEqual(expect.arrayContaining(users));
    });

    it("rejects unsupported formats", async () => {
      const res = await invokeCompare({
        user1: "alice",
        user2: "bob",
        format: "markdown",
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/format/i),
        }),
      );
    });

    it("rejects unsupported stats filters", async () => {
      const res = await invokeCompare({
        user1: "alice",
        user2: "bob",
        stats: "commits,invalid",
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/stats/i),
        }),
      );
    });
  });

  describe("response format: detailed", () => {
    it("returns detailed format with cached indicator", async () => {
      fetchStatsMock
        .mockResolvedValueOnce(makeStats("alice", { totalStars: 100 }))
        .mockResolvedValueOnce(makeStats("bob", { totalStars: 150 }));

      const res = await invokeCompare({ user1: "alice", user2: "bob" });
      const payload = getPayload(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(payload).toEqual(
        expect.objectContaining({
          comparison: expect.objectContaining({
            users: expect.arrayContaining(["alice", "bob"]),
            timestamp: expect.any(String),
            cached: expect.any(Boolean),
            stats_compared: expect.any(Array),
          }),
          data: expect.objectContaining({
            alice: expect.objectContaining({ name: expect.any(String) }),
            bob: expect.objectContaining({ name: expect.any(String) }),
          }),
          diff: expect.any(Object),
          summary: expect.any(Object),
        }),
      );

      expect(new Date(payload.comparison.timestamp).toString()).not.toBe(
        "Invalid Date",
      );
      expect(payload.summary.overall_leader).toMatch(/alice|bob/);
    });

    it("includes percentage differences and leaders", async () => {
      fetchStatsMock
        .mockResolvedValueOnce(
          makeStats("alice", { totalStars: 80, totalCommits: 200 }),
        )
        .mockResolvedValueOnce(
          makeStats("bob", { totalStars: 160, totalCommits: 150 }),
        );

      const res = await invokeCompare({ user1: "alice", user2: "bob" });
      const payload = getPayload(res);
      const { diff } = payload;

      expect(diff.totalStars).toEqual(
        expect.objectContaining({
          leader: "bob",
          difference: expect.any(Number),
          percentage: expect.any(Number),
        }),
      );
      expect(Number.isFinite(diff.totalStars.percentage)).toBe(true);

      expect(diff.totalCommits).toEqual(
        expect.objectContaining({
          leader: "alice",
          difference: expect.any(Number),
        }),
      );
    });
  });

  describe("response format: compact", () => {
    it("returns compact payload when requested", async () => {
      fetchStatsMock
        .mockResolvedValueOnce(makeStats("alice"))
        .mockResolvedValueOnce(makeStats("bob"));

      const res = await invokeCompare({
        user1: "alice",
        user2: "bob",
        format: "compact",
      });
      const payload = getPayload(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(payload).toEqual(
        expect.objectContaining({
          users: expect.arrayContaining(["alice", "bob"]),
          timestamp: expect.any(String),
          diff: expect.any(Object),
          leader: expect.any(String),
        }),
      );
      expect(payload).not.toHaveProperty("comparison");
      expect(payload).not.toHaveProperty("summary");
      Object.values(payload.diff).forEach((entry) => {
        expect(entry).toEqual(
          expect.objectContaining({
            delta: expect.any(Number),
            leader: expect.any(String),
          }),
        );
      });
    });
  });

  describe("response format: leaderboard", () => {
    it("returns ranked leaderboard when requested", async () => {
      const users = [
        { username: "alice", stars: 200, commits: 220 },
        { username: "bob", stars: 150, commits: 180 },
        { username: "charlie", stars: 180, commits: 200 },
      ];

      users.forEach(({ username, stars, commits }) => {
        fetchStatsMock.mockResolvedValueOnce(
          makeStats(username, { totalStars: stars, totalCommits: commits }),
        );
      });

      const res = await invokeCompare({
        user1: "alice",
        user2: "bob",
        user3: "charlie",
        format: "leaderboard",
      });
      const payload = getPayload(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(Array.isArray(payload.leaderboard)).toBe(true);
      expect(payload.leaderboard).toHaveLength(3);
      payload.leaderboard.forEach((entry) => {
        expect(entry).toEqual(
          expect.objectContaining({
            rank: expect.any(Number),
            username: expect.any(String),
            stats: expect.any(Object),
          }),
        );
      });
      const ranks = payload.leaderboard.map((entry) => entry.rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    });
  });

  describe("stats filtering", () => {
    it("includes only requested stats in diff", async () => {
      fetchStatsMock
        .mockResolvedValueOnce(makeStats("alice"))
        .mockResolvedValueOnce(makeStats("bob"));

      const res = await invokeCompare({
        user1: "alice",
        user2: "bob",
        stats: "commits,stars",
      });
      const payload = getPayload(res);
      const diffKeys = Object.keys(payload.diff);

      expect(diffKeys).toEqual(
        expect.arrayContaining(["totalCommits", "totalStars"]),
      );
      expect(diffKeys).toHaveLength(2);
      expect(payload.comparison.stats_compared).toEqual(
        expect.arrayContaining(["commits", "stars"]),
      );
    });
  });

  describe("parameter handling", () => {
    it("respects include_all_commits flag", async () => {
      fetchStatsMock.mockImplementation((username, includeAllCommits) =>
        Promise.resolve(
          makeStats(username, {
            totalCommits: includeAllCommits ? 999 : 123,
          }),
        ),
      );

      const res = await invokeCompare({
        user1: "alice",
        user2: "bob",
        include_all_commits: "true",
      });
      const payload = getPayload(res);

      expect(payload.data.alice.totalCommits).toBe(999);
      expect(payload.data.bob.totalCommits).toBe(999);
    });

    it("respects exclude_repo parameter", async () => {
      fetchStatsMock.mockImplementation((username, _includeAll, excludeRepos) =>
        Promise.resolve(
          makeStats(username, {
            totalStars: excludeRepos?.includes("repo2") ? 50 : 120,
          }),
        ),
      );

      const res = await invokeCompare({
        user1: "alice",
        user2: "bob",
        exclude_repo: "repo1,repo2",
      });
      const payload = getPayload(res);

      expect(payload.data.alice.totalStars).toBe(50);
      expect(payload.data.bob.totalStars).toBe(50);
    });

    it("sets default cache headers", async () => {
      fetchStatsMock
        .mockResolvedValueOnce(makeStats("alice"))
        .mockResolvedValueOnce(makeStats("bob"));

      const res = await invokeCompare({ user1: "alice", user2: "bob" });

      expect(res.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        expect.stringMatching(/max-age/),
      );
    });

    it("applies custom cache_seconds", async () => {
      fetchStatsMock
        .mockResolvedValueOnce(makeStats("alice"))
        .mockResolvedValueOnce(makeStats("bob"));

      const res = await invokeCompare({
        user1: "alice",
        user2: "bob",
        cache_seconds: "7200",
      });

      expect(res.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        expect.stringMatching(/7200/),
      );
    });
  });

  describe("error handling", () => {
    it("returns 404 when a user cannot be found", async () => {
      const error = new Error("User not found");
      error.code = "USER_NOT_FOUND";
      fetchStatsMock.mockRejectedValueOnce(error);

      const res = await invokeCompare({ user1: "ghost", user2: "bob" });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/not found/i),
        }),
      );
    });

    it("returns 500 when fetcher reports an error", async () => {
      fetchStatsMock.mockRejectedValueOnce(new Error("GraphQL error"));

      const res = await invokeCompare({ user1: "alice", user2: "bob" });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/error/i),
        }),
      );
    });

    it("returns 500 on unexpected failures", async () => {
      fetchStatsMock.mockRejectedValueOnce(new Error("network down"));

      const res = await invokeCompare({ user1: "alice", user2: "bob" });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/error/i),
        }),
      );
    });
  });

  describe("access control", () => {
    it("returns 429 when rate limited", async () => {
      const res = createMockResponse();
      guardAccessMock.mockReturnValueOnce({
        isPassed: false,
        result: res.status(429).json({ message: "Rate limit exceeded" }),
      });

      const handler = await loadCompareHandler();
      await handler({ query: { user1: "alice", user2: "bob" } }, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/rate/i),
        }),
      );
    });
  });

  describe("summary insights", () => {
    it("provides leader summaries", async () => {
      fetchStatsMock
        .mockResolvedValueOnce(
          makeStats("alice", { totalStars: 50, totalCommits: 100 }),
        )
        .mockResolvedValueOnce(
          makeStats("bob", { totalStars: 200, totalCommits: 250 }),
        );

      const res = await invokeCompare({ user1: "alice", user2: "bob" });
      const payload = getPayload(res);

      expect(payload.summary.overall_leader).toMatch(/alice|bob/);
      expect(payload.summary.stats_won).toEqual(
        expect.objectContaining({
          alice: expect.any(Number),
          bob: expect.any(Number),
        }),
      );
      expect(Array.isArray(payload.summary.close_stats)).toBe(true);
      expect(Array.isArray(payload.summary.significant_differences)).toBe(true);
    });
  });
});
