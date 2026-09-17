// crypto.subtle-hjælpere. Ingen tredjepart.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function b64urlDecode(s) {
  const pad = String(s).replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (String(s).length % 4)) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function tilfældigeBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

export function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(bytes) {
  const buf = typeof bytes === "string" ? enc.encode(bytes) : new Uint8Array(bytes);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

export async function sha256Hex(s) {
  return hex(await sha256(s));
}

export async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, typeof data === "string" ? enc.encode(data) : data);
  return new Uint8Array(sig);
}

export function ens(a, b) {
  if (a == null || b == null || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function cookie(navn, value, { maxAge, path = "/mit" } = {}) {
  const dele = [`${navn}=${value}`, `Path=${path}`, "HttpOnly", "Secure", "SameSite=Lax"];
  if (maxAge != null) dele.push(`Max-Age=${maxAge}`);
  return dele.join("; ");
}

export function laesCookie(request, navn) {
  const raw = request.headers.get("Cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${navn}=([^;]*)`));
  return m ? m[1] : null;
}

export function vent(ms) {
  const n = Number(ms);
  if (!n || n <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, n));
}

export { enc, dec };
