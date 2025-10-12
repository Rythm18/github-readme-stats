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

const mockNetworkErrorThenSuccessFetcher = jest.fn((variables, token, retries) => {
  if (retries < 1) {
    const networkError = new Error("ECONNREFUSED");
    return Promise.reject(networkError);
  }
  return Promise.resolve({ data: "success" });
});

describe("Network Error Handling Tests - Issue #4510", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Network Error Scenarios", () => {
    it("should handle ECONNREFUSED without crashing and attempt retries", async () => {
      const result = await retryer(mockNetworkErrorFetcher, {});
      
      expect(result).toBeDefined();
      expect(mockNetworkErrorFetcher).toHaveBeenCalledTimes(8);
    });

    it("should handle ETIMEDOUT without crashing and attempt retries", async () => {
      const result = await retryer(mockTimeoutErrorFetcher, {});
      
      expect(result).toBeDefined();
      expect(mockTimeoutErrorFetcher).toHaveBeenCalledTimes(8);
    });

    it("should handle DNS resolution failures without crashing and attempt retries", async () => {
      const result = await retryer(mockDNSErrorFetcher, {});
      
      expect(result).toBeDefined();
      expect(mockDNSErrorFetcher).toHaveBeenCalledTimes(8);
    });

    it("should retry network errors with different PAT tokens", async () => {
      await retryer(mockNetworkErrorFetcher, {});
      
      const calls = mockNetworkErrorFetcher.mock.calls;
      expect(calls.length).toBe(8);
      
      for (let i = 0; i < calls.length; i++) {
        const [, token] = calls[i];
        expect(token).toBe(process.env[`PAT_${i + 1}`]);
      }
    });

    it("should recover from network error on retry with next PAT token", async () => {
      const result = await retryer(mockNetworkErrorThenSuccessFetcher, {});
      
      expect(result).toEqual({ data: "success" });
      expect(mockNetworkErrorThenSuccessFetcher).toHaveBeenCalledTimes(2);
      
      const [, firstToken] = mockNetworkErrorThenSuccessFetcher.mock.calls[0];
      const [, secondToken] = mockNetworkErrorThenSuccessFetcher.mock.calls[1];
      expect(firstToken).toBe(process.env.PAT_1);
      expect(secondToken).toBe(process.env.PAT_2);
    });
  });
});