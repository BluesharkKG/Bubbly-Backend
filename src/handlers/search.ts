import { safeFetch, SafeFetchError } from "../safe-fetch.js";
import type { SearchResponse, SearchResult, Env } from "../types.js";
 
// ── DuckDuckGo Instant Answer API (zero-auth, structured) ─────────────────
// For richer web results, set BRAVE_API_KEY and the handler will use
// Brave Search API automatically.
 
const DDG_API = "https://api.duckduckgo.com/";
const BRAVE_API = "https://api.search.brave.com/res/v1/web/search";
 
interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
}
 
interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}
 
interface DdgRelatedTopic {
  Text?: string;
  FirstURL?: string;
  Result?: string;
}
 
interface DdgResponse {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  RelatedTopics?: DdgRelatedTopic[];
}
 
async function searchBrave(
  query: string,
  apiKey: string
): Promise<SearchResult[]> {
  const url = `${BRAVE_API}?q=${encodeURIComponent(query)}&count=10&safesearch=moderate`;
  const response = await safeFetch(url, {
    additionalHeaders: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });
 
  if (!response.ok) {
    throw new SafeFetchError(
      `Brave API returned ${response.status}`,
      "SEARCH_API_ERROR"
    );
  }
 
  const data: BraveResponse = await response.json();
  const webResults = data.web?.results ?? [];
 
  return webResults.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description ?? "",
  }));
}
 
async function searchDdg(query: string): Promise<SearchResult[]> {
  const url =
    `${DDG_API}?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
 
  const response = await safeFetch(url, {
    additionalHeaders: { Accept: "application/json" },
  });
 
  if (!response.ok) {
    throw new SafeFetchError(
      `DuckDuckGo API returned ${response.status}`,
      "SEARCH_API_ERROR"
    );
  }
 
  const data: DdgResponse = await response.json();
  const results: SearchResult[] = [];
 
  // Abstract answer (if any)
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.Heading ?? "Answer",
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }
 
  // Related topics
  for (const topic of data.RelatedTopics ?? []) {
    if (!topic.FirstURL || !topic.Text) continue;
    const title = topic.Text.split(" - ")[0] ?? topic.Text;
    const snippet = topic.Text;
    results.push({ title, url: topic.FirstURL, snippet });
    if (results.length >= 10) break;
  }
 
  return results;
}
 
export async function handleSearch(
  query: string,
  env: Env
): Promise<SearchResponse> {
  if (!query || query.trim().length === 0) {
    throw new Error("Search query must not be empty");
  }
 
  const trimmed = query.trim().slice(0, 500); // cap query length
 
  const results = env.BRAVE_API_KEY
    ? await searchBrave(trimmed, env.BRAVE_API_KEY)
    : await searchDdg(trimmed);
 
  return { results };
}
