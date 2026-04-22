import { safeFetch } from "../safe-fetch.js";
import {
  extractTitle,
  extractMetaTitle,
  extractFavicon,
} from "../sanitizer.js";
import { validateUrl } from "../url-validator.js";
import type { FetchResponse } from "../types.js";
 
export async function handleFetchMeta(rawUrl: string): Promise<FetchResponse> {
  const validation = validateUrl(rawUrl);
  if (!validation.ok) {
    throw new Error(`Blocked URL: ${validation.reason}`);
  }
 
  const { url } = validation;
  const domain = url.hostname;
 
  const response = await safeFetch(rawUrl, { timeoutMs: 6_000 });
  const contentType = response.headers.get("Content-Type") ?? "";
 
  let title = domain;
  let favicon = `${url.protocol}//${url.host}/favicon.ico`;
 
  if (contentType.includes("text/html")) {
    // Read only the first 64 KB — enough for <head> metadata
    const reader = response.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (bytes < 65_536) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        bytes += value.byteLength;
        chunks.push(value);
      }
      await reader.cancel();
 
      const head = new TextDecoder().decode(
        chunks.reduce((acc, c) => {
          const m = new Uint8Array(acc.length + c.length);
          m.set(acc);
          m.set(c, acc.length);
          return m;
        }, new Uint8Array(0))
      );
 
      const resolved = response.url ? new URL(response.url) : url;
      title = extractTitle(head) || extractMetaTitle(head) || domain;
      favicon = extractFavicon(head, resolved);
    }
  }
 
  return { title, favicon, domain };
}
