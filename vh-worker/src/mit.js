// /mit — login til fællesskabet. UDEN for Access.
// Magic link (engangs, 15 min, bundet til browseren) + signeret session-cookie.
// Passkey som tilbud, aldrig krav.

import { personMedGyldigRolle, sætSidstSet, sætPasskeyTilbud, id, nu } from "./db.js";
import { mitSide, felt, knap, esc } from "./flade.js";
import { TEKST } from "./tekst.js";
import { sendMagicMail } from "./mail.js";
import {
  signerSession, enhedFraRequest, sessionPerson,
  sessionCookie, rydSessionCookie, enhedCookie, SESSION_TTL,
} from "./session.js";
import { sha256Hex, hex, tilfældigeBytes, vent, b64url, b64urlDecode } from "./krypto.js";
import {
  nyChallenge, createOptions, getOptions, parseRegistration, verifyAssertion, rpFra,
} from "./webauthn.js";

const LINK_MIN = 15;
const SVAR = TEKST.mitSvar;

function html(s, { status = 200, cookies = [] } = {}) {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(s, { status, headers });
}

function json(obj, { status = 200, cookies = [] } = {}) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify(obj), { status, headers });
}

function redirect(til, cookies = []) {
  const headers = new Headers({ Location: til, "cache-control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 303, headers });
}

function sideHtml({ titel, bruger, indhold }) {
  return mitSide({ titel, bruger, indhold });
}

function loginIndhold(besked) {
  return `<section class="stage sektion">
<p class="sec">Mit</p>
<h1 class="stor maxw">${esc(TEKST.mitLoginH1)}</h1>
<p class="lead maxw mt3">${esc(TEKST.mitLoginLead)}</p>
${besked ? `<p class="small mt3">${esc(besked)}</p>` : ""}
<form method="post" action="/mit/login" class="maxw mt4" style="max-width:420px">
${felt({ label: TEKST.mitMailLabel, name: "mail", type: "email", required: true, placeholder: "din@mail.dk", klasse: "mt2" })}
<p class="mt3">${knap({ label: TEKST.mitKnap, accent: true })}</p>
<p class="meta mt2">${esc(TEKST.mitNote)}</p>
</form>
</section>`;
}

function indeIndhold(person) {
  const tilbud = !person.passkey_tilbud
    ? `<div class="ramme ramme-loeft mt3">
<p class="small">${esc(TEKST.mitPasskeyTilbud)}</p>
<form method="post" action="/mit/enhed/ja" class="mt2">${knap({ label: TEKST.mitPasskeyJa, accent: true })}</form>
<form method="post" action="/mit/enhed/nej" class="mt2">${knap({ label: TEKST.mitPasskeyNej })}</form>
</div>`
    : "";
  return `<section class="stage sektion">
<p class="sec">Mit</p>
<h1 class="stor maxw">Du er her, ${esc(person.navn)}.</h1>
<p class="lead maxw mt3">${esc(TEKST.mitIndeLead)}</p>
${tilbud}
</section>`;
}

function beskedSide(titel, broed, bruger = null) {
  return sideHtml({
    titel, bruger,
    indhold: `<section class="stage sektion">
<p class="sec">Mit</p>
<h1 class="stor maxw">${esc(titel)}</h1>
<p class="lead maxw mt3">${esc(broed)}</p>
<p class="mt3"><a class="lnk" href="/mit">Bed om et nyt link</a></p>
</section>`,
  });
}

async function enhedAf(request, cookiesUd) {
  let v = enhedFraRequest(request);
  if (!v) {
    v = hex(tilfældigeBytes(32));
    cookiesUd.push(enhedCookie(v));
  }
  return v;
}

async function personFraSession(env, request) {
  const p = await sessionPerson(env, request);
  if (!p) return null;
  const gyldig = await personMedGyldigRolle(env.FONDE_DB, p.mail);
  return gyldig ? p : null;
}

async function sessionCookies(env, person, extra = []) {
  const tok = await signerSession(env.SESSION_NOEGLE, { person_id: person.id });
  return [sessionCookie(tok), ...extra];
}

async function loginPost(request, env, cookiesUd, start) {
  let mail = "";
  try {
    const fd = await request.formData();
    mail = String(fd.get("mail") || "").trim();
  } catch { /* tom */ }

  const enhed = await enhedAf(request, cookiesUd);
  const person = mail ? await personMedGyldigRolle(env.FONDE_DB, mail) : null;
  if (person) {
    const token = hex(tilfældigeBytes(32));
    const token_hash = await sha256Hex(token);
    const enhed_hash = await sha256Hex(enhed);
    const udloeb = new Date(Date.now() + LINK_MIN * 60 * 1000).toISOString();
    await env.FONDE_DB.prepare(
      `INSERT INTO magic_links (id, token_hash, person_id, enhed_hash, udloeb, brugt, oprettet)
       VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)`
    ).bind(id(), token_hash, person.id, enhed_hash, udloeb, nu()).run();
    const url = new URL(request.url);
    const link = `${url.origin}/mit/link/${token}`;
    await sendMagicMail(env, { to: person.mail, url: link });
  }

  const min = Number(env.MIT_SVARTID_MS ?? 400);
  const rest = min - (Date.now() - start);
  await vent(rest);
  return html(sideHtml({
    titel: "Tjek din mail",
    indhold: `<section class="stage sektion">
<p class="sec">Mit</p>
<h1 class="stor maxw">Tjek din mail.</h1>
<p class="lead maxw mt3">${esc(SVAR)}</p>
<p class="small soft maxw mt3">${esc(TEKST.mitNote)}</p>
</section>`,
  }), { cookies: cookiesUd });
}

async function brugLink(request, env, token, cookiesUd) {
  const token_hash = await sha256Hex(token);
  const row = await env.FONDE_DB.prepare(
    `SELECT * FROM magic_links WHERE token_hash = ?1`
  ).bind(token_hash).first();
  if (!row) {
    return html(beskedSide("Det link virker ikke", TEKST.mitLinkUgyldigt), { status: 400, cookies: cookiesUd });
  }
  if (row.brugt) {
    return html(beskedSide("Allerede brugt", TEKST.mitLinkBrugt), { status: 400, cookies: cookiesUd });
  }
  if (row.udloeb <= nu()) {
    return html(beskedSide("For gammelt", TEKST.mitLinkGammelt), { status: 400, cookies: cookiesUd });
  }
  const enhed = enhedFraRequest(request);
  const enhed_hash = enhed ? await sha256Hex(enhed) : "";
  if (!enhed || enhed_hash !== row.enhed_hash) {
    return html(beskedSide("Forkert browser", TEKST.mitLinkAndenBrowser), { status: 400, cookies: cookiesUd });
  }
  const person = await env.FONDE_DB.prepare(`SELECT * FROM people WHERE id = ?1`).bind(row.person_id).first();
  const gyldig = person ? await personMedGyldigRolle(env.FONDE_DB, person.mail) : null;
  if (!gyldig) {
    return html(beskedSide("Det link virker ikke", TEKST.mitLinkUgyldigt), { status: 400, cookies: cookiesUd });
  }
  const opdater = await env.FONDE_DB.prepare(
    `UPDATE magic_links SET brugt = ?2 WHERE id = ?1 AND brugt IS NULL`
  ).bind(row.id, nu()).run();
  if (!opdater.meta?.changes) {
    return html(beskedSide("Allerede brugt", TEKST.mitLinkBrugt), { status: 400, cookies: cookiesUd });
  }
  await sætSidstSet(env.FONDE_DB, person.id);
  const sc = await sessionCookies(env, person, cookiesUd);
  return redirect("/mit", sc);
}

async function passkeyBeginRegister(request, env, person, cookiesUd) {
  await sætPasskeyTilbud(env.FONDE_DB, person.id, "ja");
  const url = new URL(request.url);
  const { rpId } = rpFra(url);
  const challenge = nyChallenge();
  await env.FONDE_DB.prepare(
    `INSERT INTO webauthn_udfordringer (id, person_id, form, challenge, enhed_hash, udloeb, oprettet)
     VALUES (?1, ?2, 'register', ?3, ?4, ?5, ?6)`
  ).bind(id(), person.id, challenge, await sha256Hex(enhedFraRequest(request) || ""), new Date(Date.now() + 5 * 60 * 1000).toISOString(), nu()).run();
  const { results: eksisterende } = await env.FONDE_DB.prepare(
    `SELECT credential_id FROM passkeys WHERE person_id = ?1`
  ).bind(person.id).all();
  const opt = createOptions({
    rpId,
    userId: b64url(new TextEncoder().encode(person.id)),
    userName: person.mail || person.navn,
    challenge,
    exclude: eksisterende.map((r) => r.credential_id),
  });
  const js = `<script id="wa" type="application/json">${JSON.stringify(opt)}</script>
<script>
(function(){
  function b64(s){ s=s.replace(/-/g,"+").replace(/_/g,"/"); s+= "=".repeat((4-s.length%4)%4); var bin=atob(s), u=new Uint8Array(bin.length); for (var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u.buffer; }
  function b64u(buf){ var u=new Uint8Array(buf), s=""; for (var i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/g,""); }
  var opt = JSON.parse(document.getElementById("wa").textContent);
  opt.challenge = b64(opt.challenge);
  opt.user.id = b64(opt.user.id);
  if (opt.excludeCredentials) opt.excludeCredentials.forEach(function(c){ c.id = b64(c.id); });
  if (!window.PublicKeyCredential) { location.href = "/mit"; return; }
  navigator.credentials.create({ publicKey: opt }).then(function(cred){
    return fetch("/mit/enhed/faerdig",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({
      id: cred.id, rawId: b64u(cred.rawId),
      response: { clientDataJSON: b64u(cred.response.clientDataJSON), attestationObject: b64u(cred.response.attestationObject) }
    })});
  }).then(function(){ location.href = "/mit"; }).catch(function(){ location.href = "/mit"; });
})();
</script>`;
  return html(sideHtml({
    titel: "Husk enheden",
    bruger: person,
    indhold: `<section class="stage sektion">
<p class="sec">Mit</p>
<h1 class="stor maxw">${esc(TEKST.mitPasskeyIgang)}</h1>
<p class="lead maxw mt3">${esc(TEKST.mitPasskeyTilbud)}</p>
</section>${js}`,
  }), { cookies: cookiesUd });
}

async function passkeyFinishRegister(request, env, person) {
  const body = await request.json();
  const url = new URL(request.url);
  const { rpId, origin } = rpFra(url);
  const u = await env.FONDE_DB.prepare(
    `SELECT * FROM webauthn_udfordringer WHERE person_id = ?1 AND form = 'register' AND udloeb > ?2 ORDER BY oprettet DESC LIMIT 1`
  ).bind(person.id, nu()).first();
  if (!u) return json({ ok: false }, { status: 400 });
  const parsed = await parseRegistration({
    attestationObject: b64urlDecode(body.response.attestationObject),
    clientDataJSON: b64urlDecode(body.response.clientDataJSON),
    challenge: u.challenge,
    origin, rpId,
  });
  if (!parsed.ok) return json({ ok: false, grund: parsed.grund }, { status: 400 });
  await env.FONDE_DB.prepare(
    `INSERT INTO passkeys (id, person_id, credential_id, public_key, counter, oprettet)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(id(), person.id, parsed.credentialId, parsed.publicKey, parsed.counter, nu()).run();
  await env.FONDE_DB.prepare(`DELETE FROM webauthn_udfordringer WHERE id = ?1`).bind(u.id).run();
  return json({ ok: true });
}

async function passkeyBeginLogin(request, env, cookiesUd) {
  const url = new URL(request.url);
  const { rpId } = rpFra(url);
  const challenge = nyChallenge();
  const enhed = await enhedAf(request, cookiesUd);
  await env.FONDE_DB.prepare(
    `INSERT INTO webauthn_udfordringer (id, person_id, form, challenge, enhed_hash, udloeb, oprettet)
     VALUES (?1, NULL, 'login', ?2, ?3, ?4, ?5)`
  ).bind(id(), challenge, await sha256Hex(enhed), new Date(Date.now() + 5 * 60 * 1000).toISOString(), nu()).run();
  const { results } = await env.FONDE_DB.prepare(`SELECT credential_id FROM passkeys`).all();
  return json(getOptions({
    rpId, challenge, allow: results.map((r) => r.credential_id),
  }), { cookies: cookiesUd });
}

async function passkeyFinishLogin(request, env, cookiesUd) {
  const body = await request.json();
  const url = new URL(request.url);
  const { rpId, origin } = rpFra(url);
  const credId = body.rawId || body.id;
  const pk = await env.FONDE_DB.prepare(
    `SELECT * FROM passkeys WHERE credential_id = ?1`
  ).bind(credId).first();
  if (!pk) return json({ ok: false }, { status: 400 });
  const u = await env.FONDE_DB.prepare(
    `SELECT * FROM webauthn_udfordringer WHERE form = 'login' AND udloeb > ?1 ORDER BY oprettet DESC LIMIT 1`
  ).bind(nu()).first();
  if (!u) return json({ ok: false }, { status: 400 });
  const ver = await verifyAssertion({
    publicKeyJwk: pk.public_key,
    authenticatorData: b64urlDecode(body.response.authenticatorData),
    clientDataJSON: b64urlDecode(body.response.clientDataJSON),
    signature: b64urlDecode(body.response.signature),
    challenge: u.challenge,
    origin, rpId,
    storedCounter: pk.counter,
  });
  if (!ver.ok) return json({ ok: false, grund: ver.grund }, { status: 400 });
  const person = await env.FONDE_DB.prepare(`SELECT * FROM people WHERE id = ?1`).bind(pk.person_id).first();
  const gyldig = person ? await personMedGyldigRolle(env.FONDE_DB, person.mail) : null;
  if (!gyldig) return json({ ok: false }, { status: 403 });
  await env.FONDE_DB.prepare(`UPDATE passkeys SET counter = ?2 WHERE id = ?1`).bind(pk.id, ver.counter).run();
  await env.FONDE_DB.prepare(`DELETE FROM webauthn_udfordringer WHERE id = ?1`).bind(u.id).run();
  await sætSidstSet(env.FONDE_DB, person.id);
  const sc = await sessionCookies(env, person, cookiesUd);
  return json({ ok: true }, { cookies: sc });
}

export async function mitFetch(request, env) {
  const url = new URL(request.url);
  const sti = url.pathname.replace(/\/+$/, "") || "/mit";
  const cookiesUd = [];
  const start = Date.now();

  try {
    if (!env.SESSION_NOEGLE) {
      return html(beskedSide("Ikke sat op", TEKST.mitSessionMangler), { status: 500 });
    }

    const person = await personFraSession(env, request);
    if (person && request.method === "GET" && sti === "/mit") {
      const sc = await sessionCookies(env, person, cookiesUd);
      await enhedAf(request, sc);
      return html(sideHtml({ titel: "Mit", bruger: person, indhold: indeIndhold(person) }), { cookies: sc });
    }

    if (request.method === "GET" && sti === "/mit") {
      await enhedAf(request, cookiesUd);
      return html(sideHtml({ titel: "Log ind", indhold: loginIndhold() }), { cookies: cookiesUd });
    }

    if (request.method === "POST" && sti === "/mit/login") {
      return loginPost(request, env, cookiesUd, start);
    }

    const mLink = sti.match(/^\/mit\/link\/([A-Fa-f0-9]{64})$/);
    if (request.method === "GET" && mLink) {
      await enhedAf(request, cookiesUd);
      return brugLink(request, env, mLink[1], cookiesUd);
    }

    if (request.method === "POST" && sti === "/mit/logud") {
      return redirect("/mit", [rydSessionCookie(), ...cookiesUd]);
    }

    if (request.method === "POST" && sti === "/mit/enhed/nej") {
      if (!person) return redirect("/mit", cookiesUd);
      await sætPasskeyTilbud(env.FONDE_DB, person.id, "nej");
      return redirect("/mit", cookiesUd);
    }

    if (request.method === "POST" && sti === "/mit/enhed/ja") {
      if (!person) return redirect("/mit", cookiesUd);
      return passkeyBeginRegister(request, env, person, cookiesUd);
    }

    if (request.method === "POST" && sti === "/mit/enhed/faerdig") {
      if (!person) return json({ ok: false }, { status: 401 });
      return passkeyFinishRegister(request, env, person);
    }

    if (request.method === "POST" && sti === "/mit/passkey/begin") {
      return passkeyBeginLogin(request, env, cookiesUd);
    }

    if (request.method === "POST" && sti === "/mit/passkey/faerdig") {
      return passkeyFinishLogin(request, env, cookiesUd);
    }

    return html(beskedSide("Findes ikke", TEKST.mitLinkUgyldigt), { status: 404, cookies: cookiesUd });
  } catch (e) {
    return html(beskedSide(TEKST.fejl, String(e.message || e)), { status: 500, cookies: cookiesUd });
  }
}

export { SESSION_TTL };
