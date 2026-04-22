# Bubble Browser Backend — Deployment Guide
 
## Cloudflare GitHub Builds root-directory fix (for nested repos)

If your repository is a monorepo or your Worker lives in a subfolder, Cloudflare Workers Builds must run from the Worker folder (the folder containing `package.json` and `wrangler.toml`).

For this project, set **Workers & Pages → your Worker → Settings → Builds → Root directory** to:

```
bubble-backend
```

Then keep the deploy command as:

```
npx wrangler deploy
```

> Note: Workers Builds does not use Wrangler `custom build` config for this setting; Root directory must be configured in the dashboard build settings.

---

## Prerequisites
 
- Node.js ≥ 18
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- `wrangler` CLI (installed as a dev dependency)
---
 
## Local development
 
```bash
npm install
npm run dev
```
 
The worker will be available at `http://localhost:8787`.
 
---
 
## Deploy to Cloudflare Workers
 
```bash
npm install
npx wrangler login          # authenticate with your Cloudflare account
npm run deploy
```
 
The worker URL will be printed after a successful deploy:
 
```
https://bubble-browser-backend.<your-subdomain>.workers.dev
```
 
---
 
## Optional: Brave Search API (richer results)
 
The backend uses the **DuckDuckGo Instant Answer API** by default (no key
required). For full web search results with snippets, set a Brave Search API
key:
 
1. Get a free API key at https://api.search.brave.com/
2. Add it as a secret (never commit it to the repo):
```bash
npx wrangler secret put BRAVE_API_KEY
# paste your key when prompted
```
 
The worker will automatically use Brave Search when `BRAVE_API_KEY` is set.
 
---
 
## Rate-limit tuning
 
Override defaults via `wrangler.toml` `[vars]` or environment variables:
 
| Variable                  | Default | Description                           |
|---------------------------|---------|---------------------------------------|
| `RATE_LIMIT_WINDOW_MS`    | `60000` | Sliding window in milliseconds        |
| `RATE_LIMIT_MAX_REQUESTS` | `30`    | Max requests per IP per window        |
 
---
 
## API Reference
 
### POST `/api/proxy`
 
**Search**
```json
{ "type": "search", "query": "cloudflare workers" }
```
Response:
```json
{ "results": [{ "title": "...", "url": "...", "snippet": "..." }] }
```
 
**Navigate**
```json
{ "type": "navigate", "url": "https://example.com" }
```
Response:
```json
{ "title": "...", "content": "<sanitized html>", "finalUrl": "https://example.com" }
```
 
**Fetch metadata**
```json
{ "type": "fetch", "url": "https://example.com" }
```
Response:
```json
{ "title": "Example Domain", "favicon": "https://example.com/favicon.ico", "domain": "example.com" }
```
 
---
 
## Error responses
 
All errors are returned as JSON:
 
```json
{ "error": "Human-readable message", "code": "MACHINE_CODE" }
```
 
| Code                   | HTTP Status | Meaning                              |
|------------------------|-------------|--------------------------------------|
| `BLOCKED_URL`          | 403         | Private/unsafe URL blocked           |
| `TIMEOUT`              | 504         | Upstream request timed out           |
| `FETCH_ERROR`          | 502         | Upstream request failed              |
| `RATE_LIMITED`         | 429         | Too many requests from this IP       |
| `INVALID_JSON`         | 400         | Request body is not valid JSON       |
| `INVALID_TYPE`         | 400         | Unknown `type` field                 |
| `MISSING_QUERY`        | 400         | `query` required for search          |
| `MISSING_URL`          | 400         | `url` required for navigate/fetch    |
| `NOT_FOUND`            | 404         | Unknown route                        |
| `METHOD_NOT_ALLOWED`   | 405         | Non-POST request to `/api/proxy`     |
| `INTERNAL_ERROR`       | 500         | Unexpected server-side error         |
| `SEARCH_API_ERROR`     | 502         | Search API returned an error         |
 
---
 
## Security notes
 
- All URLs are validated before any outbound fetch is made.
- Private IP ranges, loopback addresses, link-local, and cloud metadata
  endpoints are blocked (SSRF prevention).
- Fetched HTML is sanitized: `<script>`, `<style>`, `<iframe>`, inline event
  handlers, and `javascript:` URIs are stripped before the response is sent.
- Cookies and sensitive headers are never forwarded to upstream hosts.
- All outbound requests time out after 8–10 seconds.
- CORS is open (`*`) by design since the frontend is a browser-side app.
  Restrict to specific origins if you add authentication.
