import { safeFetch } from "../safe-fetch.js";
import { sanitizeHtml, extractTitle, extractMetaTitle } from "../sanitizer.js";
import { validateUrl } from "../url-validator.js";
import type { NavigateResponse } from "../types.js";
 
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB cap — keeps responses fast
 
export async function handleNavigate(url: string): Promise<NavigateResponse> {
  const validation = validateUrl(url);
  if (!validation.ok) {
    throw new Error(`Blocked URL: ${validation.reason}`);
  }
 
  const response = await safeFetch(url, { timeoutMs: 10_000 });
 
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    // Non-HTML resource: return a minimal navigation result
    return {
      title: new URL(response.url || url).hostname,
      content: `<p>This resource is not an HTML page (${contentType.split(";")[0].trim()}).</p>`,
      finalUrl: response.url || url,
    };
  }
 
  // Read with a size cap to prevent memory exhaustion from huge pages
  const reader = response.body?.getReader();
  if (!reader) {
    return { title: "", content: "", finalUrl: response.url || url };
  }
 
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    bytes += value.byteLength;
    chunks.push(value);
    if (bytes >= MAX_BODY_BYTES) {
      await reader.cancel();
      break;
    }
  }
 
  const raw = new TextDecoder().decode(
    chunks.reduce((acc, c) => {
      const merged = new Uint8Array(acc.length + c.length);
      merged.set(acc);
      merged.set(c, acc.length);
      return merged;
    }, new Uint8Array(0))
  );
 
  const title = extractTitle(raw) || extractMetaTitle(raw);
  const sanitized = sanitizeHtml(raw);
 
  return {
    title,
    content: sanitized,
    finalUrl: response.url || url,
  };
}
