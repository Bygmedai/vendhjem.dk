// Community-session på /mit. Ikke Access.
// Signeret cookie: HttpOnly, Secure, SameSite=Lax, 90 dage, fornyes ved brug.

import { b64url, b64urlDecode, hmacSign, cookie, laesCookie, ens } from "./krypto.js";

export const SESSION_TTL = 90 * 24 * 3600;
export const SESSION_NAVN = "vh_session";
export const ENHED_NAVN = "vh_enhed";
export const ENHED_TTL = 60 * 60;
const enc = new TextEncoder();
const dec = new TextDecoder();

export async function signerSession(noegle, { person_id }) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_TTL;
  const krop = b64url(enc.encode(JSON.stringify({ pid: person_id, iat, exp })));
  const sig = b64url(await hmacSign(noegle, krop));
  return `v1.${krop}.${sig}`;
}

export async function laesSession(noegle, token) {
  if (!token || !noegle) return null;
  const dele = String(token).split(".");
  if (dele.length !== 3 || dele[0] !== "v1") return null;
  const [, krop, sig] = dele;
  const forventet = b64url(await hmacSign(noegle, krop));
  if (!ens(forventet, sig)) return null;
  let krav;
  try { krav = JSON.parse(dec.decode(b64urlDecode(krop))); }
  catch { return null; }
  const nu = Math.floor(Date.now() / 1000);
  if (typeof krav.exp !== "number" || krav.exp < nu) return null;
  if (!krav.pid) return null;
  return { person_id: krav.pid, iat: krav.iat, exp: krav.exp };
}

export function sessionFraRequest(request) {
  return laesCookie(request, SESSION_NAVN);
}

export function enhedFraRequest(request) {
  return laesCookie(request, ENHED_NAVN);
}

export function sessionCookie(token) {
  return cookie(SESSION_NAVN, token, { maxAge: SESSION_TTL });
}

export function rydSessionCookie() {
  return cookie(SESSION_NAVN, "", { maxAge: 0 });
}

export function enhedCookie(value) {
  return cookie(ENHED_NAVN, value, { maxAge: ENHED_TTL });
}
