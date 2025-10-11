// @ts-check

import axios from "axios";
import { CustomError, MissingParamError } from "../common/error.js";

/**
 * WakaTime data fetcher.
 *
 * @param {{username: string, api_domain: string }} props Fetcher props.
 * @returns {Promise<import("./types").WakaTimeData>} WakaTime data response.
 */
const fetchWakatimeStats = async ({ username, api_domain }) => {
  if (!username) {
    throw new MissingParamError(["username"]);
  }

  try {
    const { data } = await axios.get(
      `https://${
        api_domain ? api_domain.replace(/\/$/gi, "") : "wakatime.com"
      }/api/v1/users/${username}/stats?is_including_today=true`,
    );

    return data.data;
  } catch (err) {
    // Handle network errors gracefully when err.response doesn't exist
    if (!err.response) {
      // Network-level error (ECONNREFUSED, ETIMEDOUT, DNS failure, etc.)
      throw new CustomError(
        `Network error while fetching WakaTime data for user '${username}': ${err.message}`,
        "WAKATIME_NETWORK_ERROR",
      );
    }
    
    // Safe property access with proper status code checking
    const status = err.response.status;
    if (status && (status < 200 || status > 299)) {
      throw new CustomError(
        `Could not resolve to a User with the login of '${username}'`,
        "WAKATIME_USER_NOT_FOUND",
      );
    }
    throw err;
  }
};

export { fetchWakatimeStats };
export default fetchWakatimeStats;
