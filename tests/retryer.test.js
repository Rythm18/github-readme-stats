import { describe, expect, it, jest } from "@jest/globals";
import "@testing-library/jest-dom";
import { RETRIES, retryer } from "../src/common/retryer.js";
import { logger } from "../src/common/utils.js";

const fetcher = jest.fn((variables, token) => {
  logger.log(variables, token);
  return new Promise((res) => res({ data: "ok" }));
});

const fetcherFail = jest.fn(() => {
  return new Promise((res) =>
    res({ data: { errors: [{ type: "RATE_LIMITED" }] } }),
  );
});

const fetcherFailOnSecondTry = jest.fn((_vars, _token, retries) => {
  return new Promise((res) => {
    // faking rate limit
    if (retries < 1) {
      return res({ data: { errors: [{ type: "RATE_LIMITED" }] } });
    }
    return res({ data: "ok" });
  });
});

const fetcherFailWithMessageBasedRateLimitErr = jest.fn(
  (_vars, _token, retries) => {
    return new Promise((res) => {
      // faking rate limit
      if (retries < 1) {
        return res({
          data: {
            errors: [
              {
                type: "ASDF",
                message: "API rate limit already exceeded for user ID 11111111",
              },
            ],
          },
        });
      }
      return res({ data: "ok" });
    });
  },
);

// Network error scenarios - these will throw without err.response
const fetcherNetworkError = jest.fn(() => {
  const networkError = new Error("ECONNREFUSED");
  // Simulate network error - no response property
  return Promise.reject(networkError);
});

const fetcherTimeoutError = jest.fn(() => {
  const timeoutError = new Error("ETIMEDOUT");
  // Simulate timeout error - no response property  
  return Promise.reject(timeoutError);
});

const fetcherDNSError = jest.fn(() => {
  const dnsError = new Error("ENOTFOUND api.github.com");
  // Simulate DNS error - no response property
  return Promise.reject(dnsError);
});

const fetcherBadCredentials = jest.fn(() => {
  const badCredError = new Error("Bad credentials");
  badCredError.response = {
    data: { message: "Bad credentials" },
    status: 401
  };
  return Promise.reject(badCredError);
});

const fetcherSuspendedAccount = jest.fn(() => {
  const suspendedError = new Error("Account suspended");
  suspendedError.response = {
    data: { message: "Sorry. Your account was suspended." },
    status: 403
  };
  return Promise.reject(suspendedError);
});

const fetcherNetworkErrorThenSuccess = jest.fn((_vars, _token, retries) => {
  if (retries < 1) {
    const networkError = new Error("ECONNREFUSED");
    return Promise.reject(networkError);
  }
  return new Promise((res) => res({ data: "ok" }));
});

describe("Test Retryer", () => {
  it("retryer should return value and have zero retries on first try", async () => {
    let res = await retryer(fetcher, {});

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(res).toStrictEqual({ data: "ok" });
  });

  it("retryer should return value and have 2 retries", async () => {
    let res = await retryer(fetcherFailOnSecondTry, {});

    expect(fetcherFailOnSecondTry).toHaveBeenCalledTimes(2);
    expect(res).toStrictEqual({ data: "ok" });
  });

  it("retryer should return value and have 2 retries with message based rate limit error", async () => {
    let res = await retryer(fetcherFailWithMessageBasedRateLimitErr, {});

    expect(fetcherFailWithMessageBasedRateLimitErr).toHaveBeenCalledTimes(2);
    expect(res).toStrictEqual({ data: "ok" });
  });

  it("retryer should throw specific error if maximum retries reached", async () => {
    try {
      await retryer(fetcherFail, {});
    } catch (err) {
      expect(fetcherFail).toHaveBeenCalledTimes(RETRIES + 1);
      expect(err.message).toBe("Downtime due to GitHub API rate limiting");
    }
  });

  // New tests for network error handling
  it("retryer should handle network errors gracefully and return structured error after all retries", async () => {
    const result = await retryer(fetcherNetworkError, {});
    
    expect(fetcherNetworkError).toHaveBeenCalledTimes(RETRIES + 1);
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('errors');
    expect(result.data.errors[0]).toMatchObject({
      type: "NETWORK_ERROR",
      message: expect.stringContaining("ECONNREFUSED")
    });
  });

  it("retryer should retry on network timeout errors", async () => {
    const result = await retryer(fetcherTimeoutError, {});
    
    expect(fetcherTimeoutError).toHaveBeenCalledTimes(RETRIES + 1);
    expect(result.data.errors[0]).toMatchObject({
      type: "NETWORK_ERROR",
      message: expect.stringContaining("ETIMEDOUT")
    });
  });

  it("retryer should retry on DNS errors", async () => {
    const result = await retryer(fetcherDNSError, {});
    
    expect(fetcherDNSError).toHaveBeenCalledTimes(RETRIES + 1);
    expect(result.data.errors[0]).toMatchObject({
      type: "NETWORK_ERROR",
      message: expect.stringContaining("ENOTFOUND")
    });
  });

  it("retryer should recover from network error on retry", async () => {
    const result = await retryer(fetcherNetworkErrorThenSuccess, {});
    
    expect(fetcherNetworkErrorThenSuccess).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({ data: "ok" });
  });

  it("retryer should handle bad credentials error correctly with optional chaining", async () => {
    try {
      await retryer(fetcherBadCredentials, {});
    } catch (err) {
      expect(fetcherBadCredentials).toHaveBeenCalledTimes(RETRIES + 1);
      expect(err.message).toBe("Downtime due to GitHub API rate limiting");
    }
  });

  it("retryer should handle suspended account error correctly with optional chaining", async () => {
    try {
      await retryer(fetcherSuspendedAccount, {});
    } catch (err) {
      expect(fetcherSuspendedAccount).toHaveBeenCalledTimes(RETRIES + 1);
      expect(err.message).toBe("Downtime due to GitHub API rate limiting");
    }
  });
});
