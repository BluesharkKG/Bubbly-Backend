import { handleOptions, jsonResponse, errorResponse } from "./cors.js";
import { checkRateLimit, getClientIp } from "./rate-limiter.js";
import { handleSearch } from "./handlers/search.js";
import { handleNavigate } from "./handlers/navigate.js";
import { handleFetchMeta } from "./handlers/fetch-meta.js";
import { SafeFetchError } from "./safe-fetch.js";
import type { Env, ProxyRequest } from "./types.js";
 
// ── Rate-limit defaults ────────────────────────────────────────────────────
const WINDOW_MS = 60_000;     // 1-minute sliding window
const MAX_REQUESTS = 30;      // 30 requests per IP per window
 
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const { method } = request;
 
    // ── CORS preflight ─────────────────────────────────────────────────────
    if (method === "OPTIONS") {
      return handleOptions();
    }
 
    // ── Health check ───────────────────────────────────────────────────────
    if (pathname === "/" || pathname === "/health") {
      return jsonResponse({ status: "ok", service: "bubble-browser-backend" });
    }
 
    // ── Route guard ────────────────────────────────────────────────────────
    if (pathname !== "/api/proxy") {
      return errorResponse("Not found", "NOT_FOUND", 404);
    }
 
    if (method !== "POST") {
      return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
 
    // ── Rate limiting ──────────────────────────────────────────────────────
    const clientIp = getClientIp(request);
    const windowMs = parseInt(env.RATE_LIMIT_WINDOW_MS ?? String(WINDOW_MS), 10);
    const maxReqs = parseInt(env.RATE_LIMIT_MAX_REQUESTS ?? String(MAX_REQUESTS), 10);
    const rl = checkRateLimit(clientIp, windowMs, maxReqs);
 
    const rateLimitHeaders: Record<string, string> = {
      "X-RateLimit-Limit": String(maxReqs),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
    };
 
    if (!rl.allowed) {
      return errorResponse("Too many requests", "RATE_LIMITED", 429);
    }
 
    // ── Parse body ─────────────────────────────────────────────────────────
    let body: ProxyRequest;
    try {
      const contentType = request.headers.get("Content-Type") ?? "";
      if (!contentType.includes("application/json")) {
        return errorResponse(
          "Content-Type must be application/json",
          "INVALID_CONTENT_TYPE"
        );
      }
      body = await request.json<ProxyRequest>();
    } catch {
      return errorResponse("Invalid JSON body", "INVALID_JSON");
    }
 
    if (!body.type || !["search", "navigate", "fetch"].includes(body.type)) {
      return errorResponse(
        "Field 'type' must be one of: search, navigate, fetch",
        "INVALID_TYPE"
      );
    }
 
    // ── Dispatch ───────────────────────────────────────────────────────────
    try {
      switch (body.type) {
        case "search": {
          if (!body.query?.trim()) {
            return errorResponse("Field 'query' is required for search", "MISSING_QUERY");
          }
          const result = await handleSearch(body.query, env);
          return jsonResponse(result, 200, rateLimitHeaders);
        }
 
        case "navigate": {
          if (!body.url?.trim()) {
            return errorResponse("Field 'url' is required for navigate", "MISSING_URL");
          }
          const result = await handleNavigate(body.url);
          return jsonResponse(result, 200, rateLimitHeaders);
        }
 
        case "fetch": {
          if (!body.url?.trim()) {
            return errorResponse("Field 'url' is required for fetch", "MISSING_URL");
          }
          const result = await handleFetchMeta(body.url);
          return jsonResponse(result, 200, rateLimitHeaders);
        }
      }
    } catch (err) {
      if (err instanceof SafeFetchError) {
        const statusMap: Record<string, number> = {
          BLOCKED_URL: 403,
          TIMEOUT: 504,
          FETCH_ERROR: 502,
        };
        const status = statusMap[err.code] ?? 502;
        return errorResponse(err.message, err.code, status);
      }
 
      if (err instanceof Error && err.message.startsWith("Blocked URL:")) {
        return errorResponse(err.message, "BLOCKED_URL", 403);
      }
 
      // Unexpected errors — log internally, return generic message
      console.error("[bubble-browser] Unhandled error:", err);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  },
} satisfies ExportedHandler<Env>;
