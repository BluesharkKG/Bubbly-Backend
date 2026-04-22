export interface Env {
  BRAVE_API_KEY?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
}
 
// ── Request / Response shapes ──────────────────────────────────────────────
 
export type RequestType = "search" | "navigate" | "fetch";
 
export interface ProxyRequest {
  type: RequestType;
  query?: string;
  url?: string;
}
 
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}
 
export interface SearchResponse {
  results: SearchResult[];
}
 
export interface NavigateResponse {
  title: string;
  content: string;
  finalUrl: string;
}
 
export interface FetchResponse {
  title: string;
  favicon: string;
  domain: string;
}
 
export interface ErrorResponse {
  error: string;
  code: string;
}
 
export type ProxyResponse =
  | SearchResponse
  | NavigateResponse
  | FetchResponse
  | ErrorResponse;
