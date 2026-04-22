import { validateUrl } from "./url-validator.js";
 
const DEFAULT_TIMEOUT_MS = 8_000;
 
// Headers we explicitly never forward to upstream services.
const STRIPPED_REQUEST_HEADERS = new Set([
  "cookie",
  "authorization",
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "cf-ray",
  "host",
]);
 
export interface SafeFetchOptions {
  timeoutMs?: number;
  method?: string;
  additionalHeaders?: Record<string, string>;
}
 
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const validation = validateUrl(rawUrl);
  if (!validation.ok) {
    throw new SafeFetchError(validation.reason, "BLOCKED_URL");
  }
 
  const { url } = validation;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
 
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
 
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (compatible; BubbleBrowser/1.0; +https://bubblebrowser.app)",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    ...options.additionalHeaders,
  };
 
  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      signal: controller.signal,
      redirect: "follow",
    });
    return response;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new SafeFetchError("Request timed out", "TIMEOUT");
    }
    throw new SafeFetchError(
      `Upstream request failed: ${err instanceof Error ? err.message : String(err)}`,
      "FETCH_ERROR"
    );
  } finally {
    clearTimeout(timer);
  }
}
 
export class SafeFetchError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}
 
/** Strip unsafe/tracking request headers before forwarding. */
export function sanitizeRequestHeaders(
  headers: Headers
): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
      out[key] = value;
    }
  });
  return out;
}
