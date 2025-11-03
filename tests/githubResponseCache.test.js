// @ts-check

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  clearGitHubResponseCache,
  DEFAULT_TTL_SECONDS,
} from "../src/common/github-cache.js";
import { retryer } from "../src/common/retryer.js";

const ORIGINAL_ENV = process.env.GITHUB_RESPONSE_CACHE_SECONDS;

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
    expect(second).toBe(first);
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
    expect(first).not.toBe(second);
  });
});
