/**
 * Cinema Nest — TMDB API Proxy
 * netlify/functions/tmdb.js
 *
 * All TMDB requests from the browser go through here.
 * The API key lives only in Netlify's environment — never in client code.
 *
 * Usage from your HTML/JS:
 *   fetch('/.netlify/functions/tmdb?endpoint=trending/movie/week')
 *   fetch('/.netlify/functions/tmdb?endpoint=search/multi&query=inception')
 *   fetch('/.netlify/functions/tmdb?endpoint=movie/550&append_to_response=videos,credits')
 */

const TMDB_BASE = "https://api.themoviedb.org/3";

// Endpoints your pages are allowed to call.
// Any request NOT on this list is rejected — prevents your function
// from being abused as a general TMDB proxy by others.
const ALLOWED_ENDPOINTS = [
  /^trending\/movie\/week$/,
  /^trending\/tv\/week$/,
  /^movie\/top_rated$/,
  /^movie\/popular$/,
  /^tv\/popular$/,
  /^search\/multi$/,
  /^discover\/movie$/,
  /^discover\/tv$/,
  /^movie\/\d+$/,
  /^tv\/\d+$/,
  /^tv\/\d+\/season\/\d+$/,
];

exports.handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { endpoint, ...rest } = event.queryStringParameters || {};

  if (!endpoint) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required 'endpoint' parameter." }),
    };
  }

  // Validate the endpoint against the allowlist
  const isAllowed = ALLOWED_ENDPOINTS.some((pattern) => pattern.test(endpoint));
  if (!isAllowed) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: `Endpoint '${endpoint}' is not permitted.` }),
    };
  }

  const API_KEY = process.env.TMDB_API_KEY;
  if (!API_KEY) {
    console.error("TMDB_API_KEY environment variable is not set.");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error." }),
    };
  }

  // Build the upstream URL, forwarding any extra query params (e.g. query=, with_genres=, page=)
  const extraParams = new URLSearchParams(rest).toString();
  const upstreamUrl = `${TMDB_BASE}/${endpoint}?api_key=${API_KEY}${extraParams ? "&" + extraParams : ""}`;

  try {
    const response = await fetch(upstreamUrl);
    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        // Allow your own site to call this function.
        // Replace with your actual Netlify URL before deploying.
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("TMDB fetch failed:", err);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Failed to reach TMDB API." }),
    };
  }
};
