import { describe, expect, it, jest } from "@jest/globals";
import "@testing-library/jest-dom";
import { retryer } from "../src/common/retryer.js";

const mockNetworkErrorFetcher = jest.fn(() => {
  const networkError = new Error("ECONNREFUSED");
  return Promise.reject(networkError);
});

const mockTimeoutErrorFetcher = jest.fn(() => {
  const timeoutError = new Error("ETIMEDOUT");
  return Promise.reject(timeoutError);
});

const mockDNSErrorFetcher = jest.fn(() => {
  const dnsError = new Error("ENOTFOUND api.github.com");
  return Promise.reject(dnsError);
});

const mockBadCredentialsFetcher = jest.fn(() => {
  const credError = new Error("Bad credentials");
  credError.response = {
    data: { message: "Bad credentials" },
    status: 401
  };
  return Promise.reject(credError);
});

const mockNetworkRecoveryFetcher = jest.fn((_vars, _token, retries) => {
  if (retries < 1) {
    const networkError = new Error("ECONNREFUSED");
    return Promise.reject(networkError);
  }
  return Promise.resolve({ data: { user: { login: "testuser" } } });
});

describe("Network Error Handling Tests - Issue #4510", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Network Error Scenarios", () => {
    it("should handle ECONNREFUSED without crashing", async () => {
      const result = await retryer(mockNetworkErrorFetcher, {});
      
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('errors');
      expect(result.data.errors[0]).toMatchObject({
        type: "NETWORK_ERROR",
        message: expect.stringContaining("ECONNREFUSED")
      });
    });

    it("should handle ETIMEDOUT gracefully", async () => {
      const result = await retryer(mockTimeoutErrorFetcher, {});
      
      expect(result.data.errors[0]).toMatchObject({
        type: "NETWORK_ERROR", 
        message: expect.stringContaining("ETIMEDOUT")
      });
    });

    it("should handle DNS resolution failures", async () => {
      const result = await retryer(mockDNSErrorFetcher, {});
      
      expect(result.data.errors[0]).toMatchObject({
        type: "NETWORK_ERROR",
        message: expect.stringContaining("ENOTFOUND")
      });
    });

    it("should recover from network errors on retry", async () => {
      const result = await retryer(mockNetworkRecoveryFetcher, {});
      
      expect(result).toMatchObject({
        data: { user: { login: "testuser" } }
      });
      
      expect(mockNetworkRecoveryFetcher).toHaveBeenCalledTimes(2);
    });

    it("should preserve existing bad credentials handling with optional chaining", async () => {
      try {
        await retryer(mockBadCredentialsFetcher, {});
        expect(true).toBe(false);
      } catch (err) {
        expect(err.message).toBe("Downtime due to GitHub API rate limiting");
      }
    });
  });

  describe("Error Property Access Safety", () => {
    it("should safely access err.response.data with optional chaining", async () => {
      const unsafeAccessFetcher = jest.fn(() => {
        const err = new Error("Network failure");
        return Promise.reject(err);
      });

      const result = await retryer(unsafeAccessFetcher, {});
      
      expect(result).toBeDefined();
      expect(result.data.errors[0].type).toBe("NETWORK_ERROR");
    });
  });
});