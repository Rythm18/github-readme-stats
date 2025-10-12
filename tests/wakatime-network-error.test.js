import { describe, expect, it, afterEach } from "@jest/globals";
import "@testing-library/jest-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { fetchWakatimeStats } from "../src/fetchers/wakatime.js";

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

describe("WakaTime Network Error Handling - Issue #4510", () => {
  describe("Network Level Errors", () => {
    it("should handle connection refused errors gracefully", async () => {
      const username = "testuser";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .networkError();

      await expect(fetchWakatimeStats({ username })).rejects.toThrow(
        "Network error while fetching WakaTime data"
      );
    });

    it("should handle timeout errors without crashing", async () => {
      const username = "timeout_user";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .timeout();

      await expect(fetchWakatimeStats({ username })).rejects.toThrow(
        "Network error while fetching WakaTime data"
      );
    });

    it("should handle DNS resolution failures", async () => {
      const username = "dns_fail_user";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .networkErrorOnce();

      await expect(fetchWakatimeStats({ username })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining("Network error"),
          type: "WAKATIME_NETWORK_ERROR"
        })
      );
    });
  });

  describe("HTTP Response Errors", () => {
    it("should handle 500 errors with response object properly", async () => {
      const username = "server_error_user";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .reply(500, { error: "Internal Server Error" });

      await expect(fetchWakatimeStats({ username })).rejects.toThrow(
        "Could not resolve to a User"
      );
    });

    it("should handle 401 unauthorized with response object", async () => {
      const username = "unauthorized_user";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .reply(401, { message: "Unauthorized" });

      await expect(fetchWakatimeStats({ username })).rejects.toThrow(
        "Could not resolve to a User"
      );
    });

    it("should handle 404 not found with response object", async () => {
      const username = "not_found_user";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .reply(404, { message: "Not Found" });

      await expect(fetchWakatimeStats({ username })).rejects.toThrow(
        "Could not resolve to a User with the login of 'not_found_user'"
      );
    });
  });

  describe("Error Type Categorization", () => {
    it("should distinguish network errors from HTTP errors", async () => {
      const username = "categorization_test";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .networkError();

      try {
        await fetchWakatimeStats({ username });
        expect(false).toBe(true);
      } catch (err) {
        expect(err.type).toBe("WAKATIME_NETWORK_ERROR");
        expect(err.message).toContain("Network error");
      }

      mock.reset();

      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .reply(403, { message: "Forbidden" });

      try {
        await fetchWakatimeStats({ username });
        expect(false).toBe(true);
      } catch (err) {
        expect(err.type).toBe("WAKATIME_USER_NOT_FOUND");
        expect(err.message).toContain("Could not resolve to a User");
      }
    });
  });

  describe("Optional Chaining Validation", () => {
    it("should safely access err.response.status with optional chaining", async () => {
      const username = "optional_chaining_test";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .networkError();

      let caughtError;
      try {
        await fetchWakatimeStats({ username });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.type).toBe("WAKATIME_NETWORK_ERROR");
      expect(caughtError.name).not.toBe("TypeError");
    });
  });
});