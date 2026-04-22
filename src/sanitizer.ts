// HTML sanitizer — runs on raw page HTML before we return it to the frontend.
// Implemented with regex transforms because the Workers runtime does not ship
// a full DOM parser (DOMParser is not available). The transforms are
// intentionally conservative: when in doubt, strip it out.
 
// Patterns that must be removed entirely (tag + all content inside them).
const BLOCK_ELEMENTS = [
  "script",
  "style",   // prevents injected CSS keyloggers / exfil
  "noscript",
  "template",
  "svg",     // can embed scripts
  "math",
  "object",
  "embed",
  "applet",
  "link",    // external resources
  "meta",    // redirect meta-refresh, etc.
];
 
const BLOCK_ELEMENT_RE = new RegExp(
  `<(${BLOCK_ELEMENTS.join("|")})(\\s[^>]*)?>(?:[\\s\\S]*?)<\\/\\1>`,
  "gim"
);
 
// Self-closing variants (e.g. <link />, <meta ... />)
const BLOCK_SELF_CLOSING_RE = new RegExp(
  `<(link|meta|base)(\\s[^>]*)?>`,
  "gim"
);
 
// Dangerous iframes (allow only sandbox-safe ones — strip all for now)
const IFRAME_RE = /<iframe[\s\S]*?<\/iframe>/gim;
 
// Inline event handlers (onclick, onload, onerror, etc.)
const INLINE_EVENT_RE = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gim;
 
// javascript: / vbscript: / data: in href/src attributes
const DANGEROUS_ATTR_RE =
  /(\s(?:href|src|action|formaction|xlink:href)\s*=\s*["'])(?:javascript|vbscript|data):[^"']*/gim;
 
// Known tracker domains used in <img>/<script> src — best-effort strip
const TRACKER_SRC_RE =
  /\s+src\s*=\s*["'][^"']*(?:google-analytics|doubleclick|googletagmanager|facebook\.net|connect\.facebook|hotjar|segment\.io|mixpanel|amplitude)[^"']*["']/gim;
 
export function sanitizeHtml(html: string): string {
  return html
    .replace(BLOCK_ELEMENT_RE, "")
    .replace(BLOCK_SELF_CLOSING_RE, "")
    .replace(IFRAME_RE, "")
    .replace(INLINE_EVENT_RE, "")
    .replace(DANGEROUS_ATTR_RE, "$1#")
    .replace(TRACKER_SRC_RE, "");
}
 
/** Extract <title> text from raw HTML. */
export function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}
 
/** Extract og:title or twitter:title meta tags as a fallback. */
export function extractMetaTitle(html: string): string {
  const ogMatch = html.match(
    /<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']*)["']/i
  );
  if (ogMatch) return decodeHtmlEntities(ogMatch[1].trim());
 
  const twMatch = html.match(
    /<meta[^>]+name\s*=\s*["']twitter:title["'][^>]+content\s*=\s*["']([^"']*)["']/i
  );
  if (twMatch) return decodeHtmlEntities(twMatch[1].trim());
 
  return "";
}
 
/** Extract favicon URL from raw HTML. Falls back to /favicon.ico. */
export function extractFavicon(html: string, baseUrl: URL): string {
  // <link rel="icon" href="...">
  const iconMatch = html.match(
    /<link[^>]+rel\s*=\s*["'](?:shortcut )?icon["'][^>]+href\s*=\s*["']([^"']*)["']/i
  );
  if (iconMatch) {
    try {
      return new URL(iconMatch[1], baseUrl).toString();
    } catch {
      /* fall through */
    }
  }
  return `${baseUrl.protocol}//${baseUrl.host}/favicon.ico`;
}
 
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
