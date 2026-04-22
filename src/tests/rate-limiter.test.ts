import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../rate-limiter.js";
 
describe("checkRateLimit", () => {
  it("allows requests within the limit", () => {
    const ip = `test-${Date.now()}-allow`;
    const r = checkRateLimit(ip, 60_000, 5);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });
 
  it("blocks requests that exceed the limit", () => {
    const ip = `test-${Date.now()}-block`;
    for (let i = 0; i < 5; i++) checkRateLimit(ip, 60_000, 5);
    const r = checkRateLimit(ip, 60_000, 5); // 6th request
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });
 
  it("resets after the window expires", async () => {
    const ip = `test-${Date.now()}-reset`;
    for (let i = 0; i < 5; i++) checkRateLimit(ip, 10, 5); // 10ms window
    // Wait for the window to expire
    await new Promise((r) => setTimeout(r, 20));
    const result = checkRateLimit(ip, 10, 5);
    expect(result.allowed).toBe(true);
  });
 
  it("tracks different IPs independently", () => {
    const ts = Date.now();
    const ip1 = `test-${ts}-ip1`;
    const ip2 = `test-${ts}-ip2`;
    for (let i = 0; i < 5; i++) checkRateLimit(ip1, 60_000, 5);
    const r = checkRateLimit(ip2, 60_000, 5);
    expect(r.allowed).toBe(true);
  });
});
