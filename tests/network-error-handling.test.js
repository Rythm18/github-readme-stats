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

describe("Network Error Handling Tests - Issue #4510", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Network Error Scenarios", () => {
    it("should handle ECONNREFUSED without crashing", async () => {
      try {
        await retryer(mockNetworkErrorFetcher, {});
      } catch (err) {
        expect(err).not.toBeInstanceOf(TypeError);
      }
    });

    it("should handle ETIMEDOUT without crashing", async () => {
      try {
        await retryer(mockTimeoutErrorFetcher, {});
      } catch (err) {
        expect(err).not.toBeInstanceOf(TypeError);
      }
    });

    it("should handle DNS resolution failures without crashing", async () => {
      try {
        await retryer(mockDNSErrorFetcher, {});
      } catch (err) {
        expect(err).not.toBeInstanceOf(TypeError);
      }
    });
  });
});