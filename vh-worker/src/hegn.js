// Hegn, der står fordi de er blevet brudt.
//
// Sikkerhedshoveder på ALLE Worker-svar, og CSRF til den offentlige
// forespørgsel. Cookies er allerede HttpOnly/Secure/SameSite=Lax (krypto.js);
// det her er det, der manglede rundt om dem.
//
// CSP er bevidst løs nok til /mit: inline script (service worker + passkeys)
// og inline style (fladen bruger style= i dag). Den spærrer fremmede scripts,
// frames og object. Stram, når fladen ikke længere har inline script.

import { b64url, b64urlDecode, hmacSign, cookie, ens, enc, dec } from "./krypto.js";

export const CSRF_NAVN = "vh_csrf";
export const CSRF_TTL = 8 * 3600;

export const SIKKERHED_HOVEDER = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
};

export function medSikkerhed(res) {
  if (!res) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SIKKERHED_HOVEDER)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function lavCsrf(noegle, { form, id }) {
  if (!noegle) return "";
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + CSRF_TTL;
  const krop = b64url(enc.encode(JSON.stringify({ f: form, id, iat, exp })));
  const sig = b64url(await hmacSign(noegle, krop));
  return `v1.${krop}.${sig}`;
}

export async function tjekCsrf(noegle, felt, cookieVal, { form, id }) {
  if (!noegle || !felt || !cookieVal) return false;
  const a = String(felt);
  const b = String(cookieVal);
  if (!ens(a, b)) return false;
  const dele = a.split(".");
  if (dele.length !== 3 || dele[0] !== "v1") return false;
  const [, krop, sig] = dele;
  const forventet = b64url(await hmacSign(noegle, krop));
  if (!ens(forventet, sig)) return false;
  let krav;
  try { krav = JSON.parse(dec.decode(b64urlDecode(krop))); }
  catch { return false; }
  const nu = Math.floor(Date.now() / 1000);
  if (typeof krav.exp !== "number" || krav.exp < nu) return false;
  if (krav.f !== form || krav.id !== id) return false;
  return true;
}

export function csrfCookie(token) {
  return cookie(CSRF_NAVN, token, { maxAge: CSRF_TTL, path: "/sporene" });
}

export function klientIp(request) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf && cf.trim()) return cf.trim().slice(0, 64);
  const xff = request.headers.get("X-Forwarded-For");
  if (xff && xff.trim()) return xff.split(",")[0].trim().slice(0, 64);
  return "ukendt";
}
