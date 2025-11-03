// @ts-check

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  clearGitHubResponseCache,
  DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
  getGitHubCacheTTL,
} from "../src/common/github-cache.js";
import { retryer } from "../src/common/retryer.js";

const ORIGINAL_ENV = process.env.GITHUB_RESPONSE_CACHE_SECONDS;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("GitHub response caching", () => {
  beforeEach(() => {
    clearGitHubResponseCache();
    delete process.env.GITHUB_RESPONSE_CACHE_SECONDS;
    jest.useRealTimers();
  });

  afterEach(() => {
    clearGitHubResponseCache();

    if (ORIGINAL_ENV === undefined) {
      delete process.env.GITHUB_RESPONSE_CACHE_SECONDS;
    } else {
      process.env.GITHUB_RESPONSE_CACHE_SECONDS = ORIGINAL_ENV;
    }
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    jest.useRealTimers();
  });

  it("reuses cached response for identical requests within the TTL", async () => {
    process.env.GITHUB_RESPONSE_CACHE_SECONDS = "120";
    const fetcher = jest.fn(() =>
      Promise.resolve({
        status: 200,
        data: { data: { viewer: { login: "octocat" } } },
      }),
    );

    const first = await retryer(fetcher, { login: "octocat" });
    const second = await retryer(fetcher, { login: "octocat" });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.data).toEqual({ data: { viewer: { login: "octocat" } } });
    expect(second.data).toEqual({ data: { viewer: { login: "octocat" } } });
  });

  it("does not cache responses when disabled via environment variable", async () => {
    process.env.GITHUB_RESPONSE_CACHE_SECONDS = "0";
    const fetcher = jest.fn(() =>
      Promise.resolve({
        status: 200,
        data: { data: { viewer: { login: "octocat" } } },
      }),
    );

    await retryer(fetcher, { login: "octocat" });
    await retryer(fetcher, { login: "octocat" });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("expires cached responses after the configured TTL", async () => {
    process.env.GITHUB_RESPONSE_CACHE_SECONDS = "1";
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    const fetcher = jest.fn(() =>
      Promise.resolve({
        status: 200,
        data: { data: { viewer: { login: "octocat" } } },
      }),
    );

    await retryer(fetcher, { login: "octocat" });
    jest.advanceTimersByTime(500);
    await retryer(fetcher, { login: "octocat" });
    jest.advanceTimersByTime(600);
    await retryer(fetcher, { login: "octocat" });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not cache GraphQL error payloads", async () => {
    process.env.GITHUB_RESPONSE_CACHE_SECONDS = `${DEFAULT_TTL_SECONDS}`;
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: { errors: [{ message: "Oops" }] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { viewer: { login: "octocat" } } },
      });

    const first = await retryer(fetcher, { login: "octocat" });
    const second = await retryer(fetcher, { login: "octocat" });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(first.data).toEqual({ errors: [{ message: "Oops" }] });
    expect(second.data).toEqual({ data: { viewer: { login: "octocat" } } });
  });

  it("falls back to default TTL when unset outside test env", () => {
    process.env.NODE_ENV = "production";
    delete process.env.GITHUB_RESPONSE_CACHE_SECONDS;

    expect(getGitHubCacheTTL()).toBe(DEFAULT_TTL_SECONDS);
  });

  it("clamps cache seconds to the documented maximum", () => {
    process.env.NODE_ENV = "production";
    process.env.GITHUB_RESPONSE_CACHE_SECONDS = "999999";

    expect(getGitHubCacheTTL()).toBe(MAX_TTL_SECONDS);
  });

  it("does not cache non-successful HTTP responses", async () => {
    process.env.GITHUB_RESPONSE_CACHE_SECONDS = "120";
    const fetcher = jest.fn(() =>
      Promise.resolve({
        status: 500,
        data: { message: "something went wrong" },
      }),
    );

    await retryer(fetcher, { login: "octocat" });
    await retryer(fetcher, { login: "octocat" });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("caches the eventual success after a rate limit response", async () => {
    process.env.GITHUB_RESPONSE_CACHE_SECONDS = "120";
    const successResponse = {
      status: 200,
      data: { data: { viewer: { login: "octocat" } } },
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: { errors: [{ type: "RATE_LIMITED" }] },
      })
      .mockResolvedValueOnce(successResponse);

    const first = await retryer(fetcher, { login: "octocat" });
    const second = await retryer(fetcher, { login: "octocat" });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(first.data).toEqual(successResponse.data);
    expect(second.data).toEqual(successResponse.data);
  });
});
