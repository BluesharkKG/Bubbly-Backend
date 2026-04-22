import { describe, it, expect } from "vitest";
import { sanitizeHtml, extractTitle, extractFavicon } from "../sanitizer.js";
 
describe("sanitizeHtml", () => {
  it("strips <script> blocks", () => {
    const html = '<p>Hi</p><script>alert("xss")</script>';
    expect(sanitizeHtml(html)).not.toContain("<script>");
    expect(sanitizeHtml(html)).not.toContain("alert");
  });
 
  it("strips inline event handlers", () => {
    const html = '<a href="#" onclick="steal()">click</a>';
    const clean = sanitizeHtml(html);
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("click");
  });
 
  it("strips javascript: hrefs", () => {
    const html = '<a href="javascript:void(0)">bad</a>';
    const clean = sanitizeHtml(html);
    expect(clean).not.toContain("javascript:");
  });
 
  it("strips <style> blocks", () => {
    const html = "<style>body { display:none }</style><p>visible</p>";
    const clean = sanitizeHtml(html);
    expect(clean).not.toContain("<style>");
    expect(clean).toContain("visible");
  });
 
  it("strips iframes", () => {
    const html = '<iframe src="https://evil.com"></iframe>';
    expect(sanitizeHtml(html)).not.toContain("<iframe");
  });
 
  it("strips <meta> tags", () => {
    const html = '<meta http-equiv="refresh" content="0;url=evil.com"><p>hi</p>';
    const clean = sanitizeHtml(html);
    expect(clean).not.toContain("<meta");
  });
 
  it("preserves safe content", () => {
    const html = "<h1>Hello</h1><p>World</p>";
    const clean = sanitizeHtml(html);
    expect(clean).toContain("<h1>Hello</h1>");
    expect(clean).toContain("<p>World</p>");
  });
});
 
describe("extractTitle", () => {
  it("extracts page title", () => {
    const html = "<html><head><title>My Page</title></head></html>";
    expect(extractTitle(html)).toBe("My Page");
  });
 
  it("returns empty string when no title", () => {
    expect(extractTitle("<html></html>")).toBe("");
  });
});
 
describe("extractFavicon", () => {
  it("returns /favicon.ico when no link tag", () => {
    const base = new URL("https://example.com/page");
    expect(extractFavicon("<html></html>", base)).toBe(
      "https://example.com/favicon.ico"
    );
  });
 
  it("resolves relative favicon path", () => {
    const html = '<link rel="icon" href="/images/icon.png">';
    const base = new URL("https://example.com/");
    expect(extractFavicon(html, base)).toBe("https://example.com/images/icon.png");
  });
});
