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
    it("should handle connection refused errors without TypeError crash", async () => {
      const username = "testuser";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .networkError();

      try {
        await fetchWakatimeStats({ username });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).not.toBeInstanceOf(TypeError);
        expect(err).toBeDefined();
      }
    });

    it("should handle timeout errors without TypeError crash", async () => {
      const username = "timeout_user";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .timeout();

      try {
        await fetchWakatimeStats({ username });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).not.toBeInstanceOf(TypeError);
        expect(err).toBeDefined();
      }
    });

    it("should handle DNS resolution failures without TypeError crash", async () => {
      const username = "dns_fail_user";
      
      mock
        .onGet(`https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`)
        .networkErrorOnce();

      try {
        await fetchWakatimeStats({ username });
        expect(true).toBe(false);
      } catch (err) {
        expect(err).not.toBeInstanceOf(TypeError);
        expect(err).toBeDefined();
      }
    });
  });
});