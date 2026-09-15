// Identitet fra Cloudflare Access.
//
// Access står allerede foran /internt og slipper kun gruppen «Vend Hjem –
// medlemmer» igennem. Den sender en signeret JWT med hvert kald. Vi verificerer
// signaturen selv i stedet for at stole på headeren — ellers ville enhver, der
// kunne nå Workeren uden om Access, kunne påstå at være hvem som helst.
//
// Derfor er der ingen login-kode, ingen sessions og ingen kodeord i dette
// projekt. Det er med vilje.

const TEAM = "patient-feather-24c6";
const CERTS_URL = `https://${TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`;

// De to Access-apps foran /internt og /internt/*. Wildcard dækker ikke den bare
// sti, derfor to. En JWT skal matche en af dem.
const AUDS = new Set([
  "74d960b84cc99d57e0e08379121a03579aa4d0af5ba958e657b6c7b4d2056f25",
  "15086cf3a68d08a2597e1a9fd360dfaba6bc969bf2a061b2bf8623849b5c1a92",
]);

let certCache = { keys: null, hentet: 0 };

async function hentNoegler() {
  const nu = Date.now();
  if (certCache.keys && nu - certCache.hentet < 3600_000) return certCache.keys;
  const r = await fetch(CERTS_URL);
  if (!r.ok) throw new Error(`Access-certifikater svarede ${r.status}`);
  const j = await r.json();
  certCache = { keys: j.keys || [], hentet: nu };
  return certCache.keys;
}

function b64url(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * Returnerer { email, sub } ved gyldig JWT, ellers null.
 * Kaster ikke — en ugyldig token er et normalt svar, ikke en fejl.
 */
export async function identitet(request) {
  const tok =
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    (request.headers.get("Cookie") || "").match(/CF_Authorization=([^;]+)/)?.[1];
  if (!tok) return null;

  const dele = tok.split(".");
  if (dele.length !== 3) return null;

  let head, krav;
  try {
    head = JSON.parse(new TextDecoder().decode(b64url(dele[0])));
    krav = JSON.parse(new TextDecoder().decode(b64url(dele[1])));
  } catch { return null; }

  if (head.alg !== "RS256") return null;

  const aud = Array.isArray(krav.aud) ? krav.aud : [krav.aud];
  if (!aud.some((a) => AUDS.has(a))) return null;

  const nu = Math.floor(Date.now() / 1000);
  if (typeof krav.exp !== "number" || krav.exp < nu) return null;
  if (typeof krav.nbf === "number" && krav.nbf > nu + 60) return null;
  if (krav.iss !== `https://${TEAM}.cloudflareaccess.com`) return null;

  const noegler = await hentNoegler();
  const jwk = noegler.find((k) => k.kid === head.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk", jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key,
    b64url(dele[2]),
    new TextEncoder().encode(`${dele[0]}.${dele[1]}`)
  );
  if (!ok) return null;

  // Service tokens har ingen email. De bruges kun til drift og verifikation,
  // og de må ikke kunne godkende noget som et menneske.
  const email = krav.email || null;
  return {
    email,
    sub: krav.sub || krav.common_name || "ukendt",
    menneske: Boolean(email),
    navn: email ? email.split("@")[0] : `service:${krav.common_name || "ukendt"}`,
  };
}
