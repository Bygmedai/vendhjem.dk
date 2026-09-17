// WebAuthn (passkeys) med crypto.subtle. Ingen Clerk/Auth0/WorkOS.
// ES256 / P-256, attestation none, resident key preferred.

import { b64url, b64urlDecode, sha256, hex, tilfældigeBytes } from "./krypto.js";

function cborDecode(u8) {
  let i = 0;
  const extra = (n) => {
    if (n < 24) return n;
    if (n === 24) return u8[i++];
    if (n === 25) { const v = (u8[i] << 8) | u8[i + 1]; i += 2; return v; }
    if (n === 26) {
      const v = ((u8[i] << 24) | (u8[i + 1] << 16) | (u8[i + 2] << 8) | u8[i + 3]) >>> 0;
      i += 4; return v;
    }
    throw new Error("cbor");
  };
  const one = () => {
    const ib = u8[i++];
    const mt = ib >> 5;
    const ai = ib & 31;
    if (mt === 0) return extra(ai);
    if (mt === 1) return -1 - extra(ai);
    if (mt === 2) { const n = extra(ai); const s = u8.subarray(i, i + n); i += n; return s; }
    if (mt === 3) {
      const n = extra(ai); const s = u8.subarray(i, i + n); i += n;
      return new TextDecoder().decode(s);
    }
    if (mt === 4) { const n = extra(ai); const a = []; for (let k = 0; k < n; k++) a.push(one()); return a; }
    if (mt === 5) {
      const n = extra(ai); const m = new Map();
      for (let k = 0; k < n; k++) m.set(one(), one());
      return m;
    }
    if (mt === 6) { extra(ai); return one(); }
    if (mt === 7) {
      if (ai === 20) return false;
      if (ai === 21) return true;
      if (ai === 22) return null;
      throw new Error("cbor simple");
    }
    throw new Error("cbor mt");
  };
  return one();
}

function parseAuthData(ad) {
  const rpIdHash = ad.subarray(0, 32);
  const flags = ad[32];
  const counter = new DataView(ad.buffer, ad.byteOffset + 33, 4).getUint32(0);
  let cred = null;
  if (flags & 0x40) {
    const rest = ad.subarray(37);
    const credIdLen = (rest[16] << 8) | rest[17];
    const credId = rest.subarray(18, 18 + credIdLen);
    const cose = cborDecode(rest.subarray(18 + credIdLen));
    cred = { credId, cose };
  }
  return { rpIdHash, flags, counter, cred };
}

export function coseToJwk(cose) {
  const kty = cose.get(1);
  const crv = cose.get(-1);
  const x = cose.get(-2);
  const y = cose.get(-3);
  if (kty !== 2 || crv !== 1) throw new Error("kun ES256/P-256");
  return { kty: "EC", crv: "P-256", x: b64url(x), y: b64url(y), alg: "ES256" };
}

function ecdsaDerToRaw(der) {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("der");
  let seqLen = der[i++];
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f; seqLen = 0;
    for (let j = 0; j < n; j++) seqLen = (seqLen << 8) | der[i++];
  }
  const int = () => {
    if (der[i++] !== 0x02) throw new Error("der int");
    const n = der[i++];
    let v = der.subarray(i, i + n); i += n;
    while (v.length > 32 && v[0] === 0) v = v.subarray(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = int(), s = int();
  const out = new Uint8Array(64);
  out.set(r, 0); out.set(s, 32);
  return out;
}

async function verifyEcdsa(jwk, signed, signature) {
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
  );
  const sig = signature.length === 64 ? signature : ecdsaDerToRaw(signature);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig, signed);
}

export function rpFra(url) {
  return { rpId: url.hostname, origin: url.origin };
}

export function nyChallenge() {
  return b64url(tilfældigeBytes(32));
}

export function createOptions({ rpId, userId, userName, challenge, exclude = [] }) {
  return {
    rp: { id: rpId, name: "Vendhjem" },
    user: { id: userId, name: userName, displayName: userName },
    challenge,
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: exclude.map((id) => ({ type: "public-key", id })),
  };
}

export function getOptions({ rpId, challenge, allow = [] }) {
  const o = { rpId, challenge, timeout: 60000, userVerification: "preferred" };
  if (allow.length)
    o.allowCredentials = allow.map((id) => ({ type: "public-key", id }));
  return o;
}

export async function parseRegistration({ attestationObject, clientDataJSON, challenge, origin, rpId }) {
  const cd = JSON.parse(new TextDecoder().decode(clientDataJSON));
  if (cd.type !== "webauthn.create") return { ok: false, grund: "type" };
  if (cd.challenge !== challenge) return { ok: false, grund: "challenge" };
  if (cd.origin !== origin) return { ok: false, grund: "origin" };
  const att = cborDecode(new Uint8Array(attestationObject));
  const authData = att instanceof Map ? att.get("authData") : att.authData;
  const parsed = parseAuthData(new Uint8Array(authData));
  const rpHash = await sha256(rpId);
  if (hex(parsed.rpIdHash) !== hex(rpHash)) return { ok: false, grund: "rpid" };
  if (!(parsed.flags & 0x01) || !parsed.cred) return { ok: false, grund: "authData" };
  const jwk = coseToJwk(parsed.cred.cose);
  return {
    ok: true,
    credentialId: b64url(parsed.cred.credId),
    publicKey: JSON.stringify(jwk),
    counter: parsed.counter,
  };
}

export async function verifyAssertion({
  publicKeyJwk, authenticatorData, clientDataJSON, signature, challenge, origin, rpId, storedCounter,
}) {
  const cd = JSON.parse(new TextDecoder().decode(clientDataJSON));
  if (cd.type !== "webauthn.get") return { ok: false, grund: "type" };
  if (cd.challenge !== challenge) return { ok: false, grund: "challenge" };
  if (cd.origin !== origin) return { ok: false, grund: "origin" };
  const ad = new Uint8Array(authenticatorData);
  const parsed = parseAuthData(ad);
  const rpHash = await sha256(rpId);
  if (hex(parsed.rpIdHash) !== hex(rpHash)) return { ok: false, grund: "rpid" };
  if (!(parsed.flags & 0x01)) return { ok: false, grund: "up" };
  if (storedCounter > 0 && parsed.counter <= storedCounter) return { ok: false, grund: "counter" };
  const signed = new Uint8Array(ad.length + 32);
  signed.set(ad, 0);
  signed.set(await sha256(clientDataJSON), ad.length);
  const sig = new Uint8Array(signature);
  const jwk = typeof publicKeyJwk === "string" ? JSON.parse(publicKeyJwk) : publicKeyJwk;
  const ok = await verifyEcdsa(jwk, signed, sig);
  return ok ? { ok: true, counter: parsed.counter } : { ok: false, grund: "sig" };
}

export { b64url, b64urlDecode };
