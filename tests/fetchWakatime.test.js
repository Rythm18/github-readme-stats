import { afterEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { fetchWakatimeStats } from "../src/fetchers/wakatime.js";

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

const wakaTimeData = {
  data: {
    categories: [
      {
        digital: "22:40",
        hours: 22,
        minutes: 40,
        name: "Coding",
        percent: 100,
        text: "22 hrs 40 mins",
        total_seconds: 81643.570077,
      },
    ],
    daily_average: 16095,
    daily_average_including_other_language: 16329,
    days_including_holidays: 7,
    days_minus_holidays: 5,
    editors: [
      {
        digital: "22:40",
        hours: 22,
        minutes: 40,
        name: "VS Code",
        percent: 100,
        text: "22 hrs 40 mins",
        total_seconds: 81643.570077,
      },
    ],
    holidays: 2,
    human_readable_daily_average: "4 hrs 28 mins",
    human_readable_daily_average_including_other_language: "4 hrs 32 mins",
    human_readable_total: "22 hrs 21 mins",
    human_readable_total_including_other_language: "22 hrs 40 mins",
    id: "random hash",
    is_already_updating: false,
    is_coding_activity_visible: true,
    is_including_today: false,
    is_other_usage_visible: true,
    is_stuck: false,
    is_up_to_date: true,
    languages: [
      {
        digital: "0:19",
        hours: 0,
        minutes: 19,
        name: "Other",
        percent: 1.43,
        text: "19 mins",
        total_seconds: 1170.434361,
      },
      {
        digital: "0:01",
        hours: 0,
        minutes: 1,
        name: "TypeScript",
        percent: 0.1,
        text: "1 min",
        total_seconds: 83.293809,
      },
      {
        digital: "0:00",
        hours: 0,
        minutes: 0,
        name: "YAML",
        percent: 0.07,
        text: "0 secs",
        total_seconds: 54.975151,
      },
    ],
    operating_systems: [
      {
        digital: "22:40",
        hours: 22,
        minutes: 40,
        name: "Mac",
        percent: 100,
        text: "22 hrs 40 mins",
        total_seconds: 81643.570077,
      },
    ],
    percent_calculated: 100,
    range: "last_7_days",
    status: "ok",
    timeout: 15,
    total_seconds: 80473.135716,
    total_seconds_including_other_language: 81643.570077,
    user_id: "random hash",
    username: "anuraghazra",
    writes_only: false,
  },
};

describe("WakaTime fetcher", () => {
  it("should fetch correct WakaTime data", async () => {
    const username = "anuraghazra";
    mock
      .onGet(
        `https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`,
      )
      .reply(200, wakaTimeData);

    const repo = await fetchWakatimeStats({ username });
    expect(repo).toStrictEqual(wakaTimeData.data);
  });

  it("should throw error if username param missing", async () => {
    mock.onGet(/\/https:\/\/wakatime\.com\/api/).reply(404, wakaTimeData);

    await expect(fetchWakatimeStats("noone")).rejects.toThrow(
      'Missing params "username" make sure you pass the parameters in URL',
    );
  });

  it("should throw error if username is not found", async () => {
    mock.onGet(/\/https:\/\/wakatime\.com\/api/).reply(404, wakaTimeData);

    await expect(fetchWakatimeStats({ username: "noone" })).rejects.toThrow(
      "Could not resolve to a User with the login of 'noone'",
    );
  });

  // New tests for network error handling
  it("should handle network errors gracefully (no response object)", async () => {
    const username = "testuser";
    // Simulate network error (ECONNREFUSED, ETIMEDOUT, etc.)
    mock
      .onGet(
        `https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`,
      )
      .networkError();

    await expect(fetchWakatimeStats({ username })).rejects.toThrow(
      "Network error while fetching WakaTime data for user 'testuser'",
    );
  });

  it("should handle timeout errors gracefully", async () => {
    const username = "testuser";
    // Simulate timeout error
    mock
      .onGet(
        `https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`,
      )
      .timeout();

    await expect(fetchWakatimeStats({ username })).rejects.toThrow(
      "Network error while fetching WakaTime data for user 'testuser'",
    );
  });

  it("should handle HTTP status errors with response object", async () => {
    const username = "testuser";
    // Simulate 500 Internal Server Error with response object
    mock
      .onGet(
        `https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`,
      )
      .reply(500, { error: "Internal Server Error" });

    await expect(fetchWakatimeStats({ username })).rejects.toThrow(
      "Could not resolve to a User with the login of 'testuser'",
    );
  });

  it("should handle 401 Unauthorized errors", async () => {
    const username = "testuser";
    mock
      .onGet(
        `https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`,
      )
      .reply(401, { error: "Unauthorized" });

    await expect(fetchWakatimeStats({ username })).rejects.toThrow(
      "Could not resolve to a User with the login of 'testuser'",
    );
  });

  it("should handle 403 Forbidden errors", async () => {
    const username = "testuser";
    mock
      .onGet(
        `https://wakatime.com/api/v1/users/${username}/stats?is_including_today=true`,
      )
      .reply(403, { error: "Forbidden" });

    await expect(fetchWakatimeStats({ username })).rejects.toThrow(
      "Could not resolve to a User with the login of 'testuser'",
    );
  });
});

export { wakaTimeData };
