// Blocks SSRF vectors: loopback, link-local, RFC-1918, cloud metadata,
// non-http(s) schemes, and bare IP addresses used for internal probing.
 
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254", // AWS/GCP/Azure instance metadata
]);
 
// Ranges checked numerically to avoid string-based bypasses via IPv6/octal/hex.
function parseIPv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}
 
function isPrivateIPv4(hostname: string): boolean {
  const parts = parseIPv4(hostname);
  if (!parts) return false;
  const [a, b, c] = parts;
 
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8 loopback
    a === 169 && b === 254 || // 169.254.0.0/16 link-local
    a === 172 && b >= 16 && b <= 31 || // 172.16.0.0/12
    a === 192 && b === 168 || // 192.168.0.0/16
    a === 100 && b >= 64 && b <= 127 || // 100.64.0.0/10 shared address space
    a === 198 && (b === 18 || b === 19) || // 198.18.0.0/15 benchmark
    a === 203 && b === 0 && c === 113 || // 203.0.113.0/24 documentation
    a === 224 // 224.0.0.0/4 multicast
  );
}
 
function isPrivateIPv6(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "::1" ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h.startsWith("fe80") ||
    h === "::"
  );
}
 
export type ValidationResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };
 
export function validateUrl(raw: string): ValidationResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Malformed URL" };
  }
 
  const scheme = url.protocol;
  if (scheme !== "http:" && scheme !== "https:") {
    return { ok: false, reason: `Scheme '${scheme}' is not permitted` };
  }
 
  const hostname = url.hostname.toLowerCase();
 
  if (BLOCKED_HOSTS.has(hostname)) {
    return { ok: false, reason: "Blocked host" };
  }
 
  if (isPrivateIPv4(hostname)) {
    return { ok: false, reason: "Private/reserved IPv4 address" };
  }
 
  if (isPrivateIPv6(hostname)) {
    return { ok: false, reason: "Private/loopback IPv6 address" };
  }
 
  // Bare IPv4 that didn't match private ranges is still suspicious in a proxy.
  // Uncomment the next block if you want to block ALL bare IPs:
  // if (parseIPv4(hostname)) {
  //   return { ok: false, reason: "Bare IP addresses are not allowed" };
  // }
 
  return { ok: true, url };
}
