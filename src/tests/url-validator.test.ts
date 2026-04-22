import { describe, it, expect } from "vitest";
import { validateUrl } from "../url-validator.js";
 
describe("validateUrl", () => {
  it("allows normal https URLs", () => {
    const r = validateUrl("https://example.com/path?q=1");
    expect(r.ok).toBe(true);
  });
 
  it("allows normal http URLs", () => {
    const r = validateUrl("http://example.com");
    expect(r.ok).toBe(true);
  });
 
  it("blocks localhost", () => {
    expect(validateUrl("http://localhost/admin").ok).toBe(false);
  });
 
  it("blocks 127.0.0.1", () => {
    expect(validateUrl("http://127.0.0.1:8080").ok).toBe(false);
  });
 
  it("blocks 10.x.x.x", () => {
    expect(validateUrl("http://10.0.0.1").ok).toBe(false);
  });
 
  it("blocks 192.168.x.x", () => {
    expect(validateUrl("http://192.168.1.1").ok).toBe(false);
  });
 
  it("blocks 172.16.x.x", () => {
    expect(validateUrl("http://172.16.0.1").ok).toBe(false);
  });
 
  it("blocks 172.31.x.x", () => {
    expect(validateUrl("http://172.31.255.255").ok).toBe(false);
  });
 
  it("allows 172.15.x.x (not in private range)", () => {
    const r = validateUrl("http://172.15.0.1");
    expect(r.ok).toBe(true);
  });
 
  it("blocks 169.254.x.x link-local", () => {
    expect(validateUrl("http://169.254.0.1").ok).toBe(false);
  });
 
  it("blocks AWS metadata endpoint", () => {
    expect(validateUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
  });
 
  it("blocks GCP metadata endpoint", () => {
    expect(validateUrl("http://metadata.google.internal").ok).toBe(false);
  });
 
  it("blocks file:// scheme", () => {
    expect(validateUrl("file:///etc/passwd").ok).toBe(false);
  });
 
  it("blocks ftp:// scheme", () => {
    expect(validateUrl("ftp://example.com").ok).toBe(false);
  });
 
  it("blocks IPv6 loopback ::1", () => {
    expect(validateUrl("http://[::1]").ok).toBe(false);
  });
 
  it("blocks IPv6 link-local fe80::", () => {
    expect(validateUrl("http://[fe80::1]").ok).toBe(false);
  });
 
  it("rejects malformed URLs", () => {
    expect(validateUrl("not a url").ok).toBe(false);
  });
});
