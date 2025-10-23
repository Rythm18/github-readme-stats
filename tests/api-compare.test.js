// @ts-check

import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import compareHandler from "../api/compare.js";

const mock = new MockAdapter(axios);

const createMockStats = (username, stars, commits, prs, issues) => ({
  data: {
    user: {
      name: username,
      repositoriesContributedTo: { totalCount: 10 },
      commits: { totalCommitContributions: commits },
      reviews: { totalPullRequestReviewContributions: 10 },
      pullRequests: { totalCount: prs },
      mergedPullRequests: { totalCount: prs - 5 },
      openIssues: { totalCount: issues },
      closedIssues: { totalCount: 0 },
      followers: { totalCount: 0 },
      repositoryDiscussions: { totalCount: 0 },
      repositoryDiscussionComments: { totalCount: 0 },
      repositories: {
        totalCount: 1,
        nodes: [{ stargazers: { totalCount: stars } }],
        pageInfo: { hasNextPage: false, endCursor: "cursor" },
      },
    },
  },
});

beforeEach(() => {
  mock.reset();
});

afterEach(() => {
  mock.reset();
});

describe("GET /api/compare", () => {
  it("should return 400 if no usernames provided", async () => {
    const req = { query: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await compareHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("usernames"),
      }),
    );
  });

  it("should return 400 if less than 2 usernames", async () => {
    const req = { query: { usernames: "user1" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await compareHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("2-5"),
      }),
    );
  });

  it("should return 400 if more than 5 usernames", async () => {
    const req = { query: { usernames: "u1,u2,u3,u4,u5,u6" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await compareHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("2-5"),
      }),
    );
  });

  it("should compare two users and return JSON", async () => {
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user1", 100, 200, 50, 30))
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user2", 150, 180, 60, 25));

    const req = { query: { usernames: "user1,user2" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await compareHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();

    const response = res.json.mock.calls[0][0];
    expect(response.leader).toBeDefined();
    expect(response.comparisons).toHaveLength(2);
    expect(response.comparisons[0].username).toBe("user1");
    expect(response.comparisons[1].username).toBe("user2");
  });

  it("should include differences in response", async () => {
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user1", 100, 200, 50, 30))
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user2", 150, 180, 60, 25));

    const req = { query: { usernames: "user1,user2" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await compareHandler(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.diffs).toBeDefined();
    expect(response.diffs.totalStars).toBeDefined();
    expect(response.diffs.totalCommits).toBeDefined();
  });

  it("should support format parameter for markdown output", async () => {
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user1", 100, 200, 50, 30))
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user2", 150, 180, 60, 25));

    const req = { query: { usernames: "user1,user2", format: "markdown" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn(),
    };

    await compareHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/markdown");
    expect(res.send).toHaveBeenCalled();

    const response = res.send.mock.calls[0][0];
    expect(response).toContain("user1");
    expect(response).toContain("user2");
  });

  it("should set cache headers", async () => {
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user1", 100, 200, 50, 30))
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user2", 150, 180, 60, 25));

    const req = { query: { usernames: "user1,user2" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await compareHandler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("max-age"),
    );
  });

  it("should handle errors when fetching user stats", async () => {
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, { errors: [{ message: "User not found" }] });

    const req = { query: { usernames: "user1,user2" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await compareHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
      }),
    );
  });

  it("should compare 3-5 users", async () => {
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user1", 100, 200, 50, 30))
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user2", 150, 180, 60, 25))
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, createMockStats("user3", 120, 220, 55, 28));

    const req = { query: { usernames: "user1,user2,user3" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await compareHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const response = res.json.mock.calls[0][0];
    expect(response.comparisons).toHaveLength(3);
    expect(response.leader).toBeDefined();
  });
});
