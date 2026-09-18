// /mit — login til fællesskabet. UDEN for Access.
// Magic link (engangs, 15 min, bundet til browseren) + signeret session-cookie.
// Passkey som tilbud, aldrig krav.

import {
  personMedGyldigRolle, sætSidstSet, sætPasskeyTilbud, id, nu,
  gaeldendeAftale, opretTime, mineTimer, mineTimerSum, stedetsTimer, mitNaesteOphold,
  logLoginForsoeg, hentPerson, opretFund, mineFund,
} from "./db.js";
import { mitSide, felt, knap, esc, tomTilstand } from "./flade.js";
import { periodeTekst } from "./ophold-sider.js";
import { aftaltIndhold } from "./aftalt.js";
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

function sideHtml({ titel, bruger, indhold, fane }) {
  return mitSide({ titel, bruger, indhold, fane });
}

// ── De tre faner (BYG-569 H1) ────────────────────────────────────────────────
//
// Nu · Skriv · Overblik. Ikke fire, ikke seks. «Nu» viser én ting ad gangen,
// «Skriv» er den, hele systemet står og falder med — tager den mere end et
// minut efter en arbejdsdag, bliver den ikke brugt — og «Overblik» findes,
// fordi «Skriv» uden den er en kirkegård: man holder op med at skrive noget
// ned, der aldrig bliver regnet sammen.

const DAGE = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MDR = ["januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december"];

function datoDk(iso, medAar = false) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso || "");
  // Året med, hvor det betyder noget. En slutdato uden årstal er ikke en
  // slutdato — «31. august» kan være hvad som helst.
  return `${d.getUTCDate()}. ${MDR[d.getUTCMonth()]}${medAar ? ` ${d.getUTCFullYear()}` : ""}`;
}

function idagIso(env) {
  return String(env?.MIT_IDAG || new Date().toISOString().slice(0, 10)).slice(0, 10);
}

/** Timer uden falsk præcision: 3, ikke 3,0. Halve timer får en halv. */
function timerTekst(n) {
  const v = Math.round(Number(n) * 2) / 2;
  return (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",")) + " t";
}

function aftaleKort(aftale) {
  if (!aftale) {
    return `<div class="ramme mt3">
<p class="meta-s">${esc(TEKST.aftaleH)}</p>
<p class="small mt1">${esc(TEKST.ingenAftale)}</p>
</div>`;
  }
  const lagNavn = { gaest: "Gæst", med: "Med", baerer: "Bærer" }[aftale.lag] || aftale.lag;
  const timer = aftale.timer_aar
    ? TEKST.aftaleTimer(aftale.timer_aar)
    : TEKST.aftaleUdenTimer;
  const slut = aftale.slut_dato
    ? TEKST.aftaleSlut(datoDk(aftale.slut_dato, true))
    : TEKST.aftaleUdenSlut;
  return `<div class="ramme mt3">
<p class="meta-s">${esc(TEKST.aftaleH)}</p>
<p class="small mt1"><strong>${esc(lagNavn)}</strong> · ${esc(timer)}</p>
<p class="meta mt1">${esc(slut)}</p>
${aftale.note ? `<p class="xs soft mt1">${esc(aftale.note)}</p>` : ""}
</div>`;
}

function nuIndhold({ person, aftale, ophold, minSum, tilbud }) {
  const opholdHtml = ophold
    ? `<p class="small mt1"><strong>${esc(ophold.type_navn)}</strong></p>
<p class="meta mt1">${esc(periodeTekst(ophold.start_dato, ophold.slut_dato))} · ${esc(ophold.plads_status)}</p>`
    : `<p class="small mt1">${esc(TEKST.mitIntetOphold)}</p>
<p class="mt2"><a class="lnk" href="/sporene">Se hvad der er åbent →</a></p>`;

  const maal = aftale?.timer_aar
    ? `<p class="meta mt1">af ${aftale.timer_aar} aftalte</p>`
    : "";

  return `<section class="stage sektion">
<p class="sec">Nu</p>
<h1 class="stor maxw">Godmorgen, ${esc(person.navn.split(" ")[0])}.</h1>

<div class="g g-2 nb mt4">
<div>
<p class="meta-s">Dit næste ophold</p>
${opholdHtml}
</div>
<div>
<p class="meta-s">Dine timer i år</p>
<p class="small mt1"><strong>${esc(timerTekst(minSum.i_alt))}</strong> på ${minSum.dage} ${minSum.dage === 1 ? "dag" : "dage"}</p>
${maal}
</div>
</div>

${aftaleKort(aftale)}

<p class="mt4"><a class="lnk lnk-accent" href="/mit/skriv">Skriv dagens timer →</a></p>
<p class="meta mt3"><a href="/mit/aftalt">${esc(TEKST.aftaltLink)}</a></p>
${tilbud}
</section>`;
}

function skrivIndhold({ idag, besked }) {
  const b = besked
    ? `<p class="small mt3"${besked.ok ? "" : ' style="color:var(--accent)"'}>${esc(besked.t)}</p>`
    : "";
  return `<section class="stage sektion">
<p class="sec">Skriv</p>
<h1 class="stor maxw">${esc(TEKST.skrivH1)}</h1>
<p class="lead maxw mt3">${esc(TEKST.skrivLead)}</p>
${b}
<form method="post" action="/mit/skriv" id="timeform" class="maxw mt4" style="max-width:480px">

<div class="chips" role="group" aria-label="Hvad skriver du">
<label class="chip"><input type="radio" name="slags" value="timer" checked> ${esc(TEKST.slagsTimer)}</label>
<label class="chip"><input type="radio" name="slags" value="fund"> ${esc(TEKST.slagsFund)}</label>
</div>

<div id="f-timer" class="mt3">
${felt({ label: TEKST.timerHvad, name: "hvad_timer", placeholder: "Ryddede op i laden" })}
<p class="xs soft mt1">${esc(TEKST.timerHvadNote)}</p>
${felt({ label: TEKST.timerAntal, name: "timer", type: "number", placeholder: "4", klasse: "mt3" })}
</div>

<div id="f-fund" class="mt3">
${felt({ label: TEKST.fundHvad, name: "hvad_fund", placeholder: "Taget drypper over sovesalen" })}
<p class="xs soft mt1">${esc(TEKST.fundHvadNote)}</p>
${felt({ label: TEKST.fundHvor, name: "hvor", placeholder: "Laden, nordvæggen", klasse: "mt3" })}
<p class="xs soft mt1">${esc(TEKST.fundHvorNote)}</p>
<p class="mt3"><label class="chip"><input type="checkbox" name="haster" value="1"> ${esc(TEKST.fundHaster)}</label></p>
</div>

<div class="mt3">${felt({ label: TEKST.timerDato, name: "dato", type: "date", value: idag, required: true })}</div>
<p class="mt3">${knap({ label: TEKST.timerGem, accent: true })}</p>
</form>
<p class="meta mt4"><a href="/mit/overblik">Se det, du har skrevet →</a></p>
</section>${koeScript()}`;
}

/**
 * Køen og de to slags.
 *
 * På en ø med dårligt net er en knap, der fejler, det samme som ingen knap:
 * linjen skrives aldrig igen. Går POST'en ikke igennem, lægges den i
 * telefonens egen hukommelse og sendes, når nettet kommer tilbage. Den ligger
 * kun på den ene telefon og forsvinder, hvis browserdata ryddes — derfor står
 * der, at den venter, indtil serveren har svaret ja.
 *
 * Valget øverst skifter felterne. Uden JavaScript står begge sæt åbne, og
 * serveren vælger ud fra `slags` — en formular, der kræver JavaScript for at
 * kunne udfyldes, er en formular, der en dag ikke kan udfyldes.
 */
function koeScript() {
  return `<script>
(function(){
  var NØGLE = "vh-timer-koe";
  var f = document.getElementById("timeform");
  if (!f || !window.fetch) return;
  var bokse = { timer: document.getElementById("f-timer"), fund: document.getElementById("f-fund") };

  function valgt(){
    var r = f.querySelector('input[name="slags"]:checked');
    return r ? r.value : "timer";
  }
  function skift(){
    var v = valgt();
    for (var k in bokse) if (bokse[k]) bokse[k].hidden = (k !== v);
  }
  Array.prototype.forEach.call(f.querySelectorAll('input[name="slags"]'), function(r){
    r.addEventListener("change", skift);
  });
  skift();

  function koe(){ try { return JSON.parse(localStorage.getItem(NØGLE) || "[]"); } catch (e) { return []; } }
  function gem(k){ try { localStorage.setItem(NØGLE, JSON.stringify(k)); } catch (e) {} }
  function vis(t, ok){
    var p = document.getElementById("koebesked");
    if (!p) { p = document.createElement("p"); p.id = "koebesked"; p.className = "small mt3"; f.parentNode.insertBefore(p, f); }
    p.textContent = t;
    p.style.color = ok ? "" : "var(--accent)";
  }
  function send(rk){
    return fetch(rk.sti || "/mit/skriv", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rk)
    }).then(function(r){ return r.json().catch(function(){ return { ok: false }; }); });
  }
  function toem(){
    var k = koe();
    if (!k.length) return Promise.resolve();
    return send(k[0]).then(function(j){
      if (!j.ok) return;
      k.shift(); gem(k);
      vis(k.length ? (k.length + " venter stadig på net.") : "Det, du skrev uden net, er sendt nu.", true);
      return toem();
    }).catch(function(){});
  }
  f.addEventListener("submit", function(e){
    e.preventDefault();
    var v = valgt();
    var rk = v === "fund"
      ? { slags: "fund", hvad: f.hvad_fund.value, hvor: f.hvor.value, haster: f.haster.checked ? 1 : 0, dato: f.dato.value }
      : { slags: "timer", hvad: f.hvad_timer.value, timer: f.timer.value, dato: f.dato.value };
    if (!String(rk.hvad).trim() || (v === "timer" && !rk.timer)) {
      vis(v === "fund" ? ${JSON.stringify(TEKST.fundMangler)} : ${JSON.stringify(TEKST.timerMangler)}, false);
      return;
    }
    send(rk).then(function(j){
      if (j.ok) { location.href = "/mit/overblik?m=" + v; return; }
      vis(j.grund || ${JSON.stringify(TEKST.timerFejl)}, false);
    }).catch(function(){
      var k = koe(); k.push(rk); gem(k);
      f.reset(); f.dato.value = new Date().toISOString().slice(0,10); skift();
      vis(${JSON.stringify(TEKST.timerKoe)}, true);
    });
  });
  window.addEventListener("online", toem);
  toem();
})();
</script>`;
}

function overblikIndhold({ aftale, minSum, mine, fund, sted, aar, besked }) {
  const maal = aftale?.timer_aar || 0;
  const andel = maal ? Math.min(100, Math.round((minSum.i_alt / maal) * 100)) : 0;
  const bjaelke = maal
    ? `<div class="ramme mt2" style="padding:0;height:10px;background:var(--papir-loeft)">
<div style="height:10px;width:${andel}%;background:var(--hav)"></div>
</div>
<p class="meta mt1">${esc(timerTekst(minSum.i_alt))} af ${maal} aftalte timer i ${aar}</p>`
    : `<p class="meta mt1">${esc(timerTekst(minSum.i_alt))} i ${aar} · ingen aftalt sum at måle mod</p>`;

  const fordelt = [
    ["Frivillige", minSum.frivillig],
    ["Aftalt modydelse", minSum.aftalt_modydelse],
    ["Betalt", minSum.betalt],
  ].filter(([, v]) => v > 0);

  const mineRaekker = mine.length
    ? `<ul class="liste mt2">${mine.map((r) =>
        `<li><span>${esc(datoDk(r.dato))} · ${esc(r.hvad)}</span><span class="r">${esc(timerTekst(r.timer))}</span></li>`
      ).join("")}</ul>`
    : tomTilstand(TEKST.timerTom);

  const stedRaekker = sted.linjer
    ? `<p class="small mt1"><strong>${esc(timerTekst(sted.timer))}</strong> lagt af ${sted.folk} ${sted.folk === 1 ? "person" : "mennesker"}</p>
<ul class="liste mt2">${sted.seneste.map((r) =>
        `<li><span>${esc(datoDk(r.dato))} · ${esc(r.hvad)}</span><span class="r">${esc(timerTekst(r.timer))}</span></li>`
      ).join("")}</ul>
<p class="xs soft mt2">${esc(TEKST.mitIngenRangliste)}</p>`
    : tomTilstand(TEKST.mitFaellesTom);

  const mineFundHtml = fund.length
    ? `<ul class="liste mt2">${fund.map((f) =>
        `<li><span>${esc(datoDk(f.dato))} · ${esc(f.hvad)}${f.hvor ? ` <span class="soft">(${esc(f.hvor)})</span>` : ""}</span>` +
        `<span class="r">${esc(f.status === "klaret" ? TEKST.fundKlaret : f.haster ? TEKST.fundHasterMaerke : TEKST.fundNyt)}</span></li>`
      ).join("")}</ul>`
    : tomTilstand(TEKST.fundTom);

  return `<section class="stage sektion">
<p class="sec">Overblik</p>
<h1 class="stor maxw">Det, du har lagt i stedet.</h1>
${besked ? `<p class="small mt3">${esc(besked)}</p>` : ""}

<div class="maxw mt4">
${bjaelke}
${fordelt.length > 1
    ? `<p class="xs soft mt2">${fordelt.map(([n, v]) => `${esc(n)}: ${esc(timerTekst(v))}`).join(" · ")}</p>`
    : ""}
</div>

<div class="g g-2 nb mt4">
<div>
<p class="meta-s">Dine seneste linjer</p>
${mineRaekker}
</div>
<div>
<p class="meta-s">${esc(TEKST.mitFaellesH)}</p>
${stedRaekker}
</div>
</div>

<div class="mt4">
<p class="meta-s">${esc(TEKST.fundMine)}</p>
${mineFundHtml}
</div>

<p class="mt4"><a class="lnk" href="/mit/skriv">Skriv en dag mere →</a></p>
</section>`;
}

/** Læser både JSON (fra køen) og en almindelig formular. */
async function krop(request) {
  try {
    return request.headers.get("content-type")?.includes("json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch { return {}; }
}

async function fundPost(rk, env, person) {
  const hvad = String(rk.hvad ?? rk.hvad_fund ?? "").trim().slice(0, 1000);
  const hvor = String(rk.hvor ?? "").trim().slice(0, 300) || null;
  const haster = rk.haster === 1 || rk.haster === "1" || rk.haster === true || rk.haster === "on";
  const dato = String(rk.dato ?? "").slice(0, 10);
  const idag = idagIso(env);

  if (!hvad || !/^\d{4}-\d{2}-\d{2}$/.test(dato)) {
    return json({ ok: false, grund: TEKST.fundMangler }, { status: 400 });
  }
  if (dato > idag) return json({ ok: false, grund: TEKST.timerFremtid }, { status: 400 });

  const f = await opretFund(env.FONDE_DB, { person_id: person.id, dato, hvad, hvor, haster });
  return json({ ok: true, id: f.id });
}

/** POST /mit/timer — bevaret, så en linje, der allerede ligger i en telefons
 *  kø, stadig kan sendes. Køen bruger /mit/skriv fra nu af. */
async function timerPost(rk, env, person) {
  const hvad = String(rk.hvad ?? rk.hvad_timer ?? "").trim().slice(0, 500);
  const antal = Number(String(rk.timer ?? "").replace(",", "."));
  const dato = String(rk.dato ?? "").slice(0, 10);
  const idag = idagIso(env);

  if (!hvad || !Number.isFinite(antal) || antal <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dato)) {
    return json({ ok: false, grund: TEKST.timerMangler }, { status: 400 });
  }
  if (antal > 16) return json({ ok: false, grund: TEKST.timerForMange }, { status: 400 });
  if (dato > idag) return json({ ok: false, grund: TEKST.timerFremtid }, { status: 400 });

  const aftale = await gaeldendeAftale(env.FONDE_DB, person.id, dato);
  const linje = await opretTime(env.FONDE_DB, {
    person_id: person.id, dato, timer: antal, hvad, aftale,
  });
  return json({ ok: true, id: linje.id });
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

function passkeyTilbud(person) {
  if (person.passkey_tilbud) return "";
  return `<div class="ramme ramme-loeft mt4">
<p class="small">${esc(TEKST.mitPasskeyTilbud)}</p>
<form method="post" action="/mit/enhed/ja" class="mt2">${knap({ label: TEKST.mitPasskeyJa, accent: true })}</form>
<form method="post" action="/mit/enhed/nej" class="mt2">${knap({ label: TEKST.mitPasskeyNej })}</form>
</div>`;
}

function beskedSide(titel, broed, bruger = null, hjaelp = "") {
  return sideHtml({
    titel, bruger,
    indhold: `<section class="stage sektion">
<p class="sec">Mit</p>
<h1 class="stor maxw">${esc(titel)}</h1>
<p class="lead maxw mt3">${esc(broed)}</p>
${hjaelp ? `<p class="small soft maxw mt3">${esc(hjaelp)}</p>` : ""}
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

  // Fladen svarer det samme til alle. Loggen gør ikke. Se migration 0013:
  // uden den kan et rigtigt menneske banke på, uden at nogen opdager det.
  if (mail) {
    const kendt = await hentPerson(env.FONDE_DB, mail);
    const resultat = person ? "sendt" : (kendt ? "uden_rolle" : "ukendt_mail");
    await logLoginForsoeg(env.FONDE_DB, {
      mail, resultat, person_id: kendt?.id ?? null,
    }).catch(() => {});
  }

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
    return html(beskedSide("Forkert browser", TEKST.mitLinkAndenBrowser, null, TEKST.mitLinkAndenBrowserHjaelp), { status: 400, cookies: cookiesUd });
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
      const idag = idagIso(env);
      const aar = idag.slice(0, 4);
      const [aftale, ophold, minSum] = await Promise.all([
        gaeldendeAftale(env.FONDE_DB, person.id, idag),
        mitNaesteOphold(env.FONDE_DB, person.id, idag),
        mineTimerSum(env.FONDE_DB, person.id, `${aar}-01-01`, `${aar}-12-31`),
      ]);
      return html(sideHtml({
        titel: "Mit", bruger: person, fane: "nu",
        indhold: nuIndhold({ person, aftale, ophold, minSum, tilbud: passkeyTilbud(person) }),
      }), { cookies: sc });
    }

    if (person && request.method === "GET" && sti === "/mit/skriv") {
      const sc = await sessionCookies(env, person, cookiesUd);
      return html(sideHtml({
        titel: TEKST.fanerSkriv, bruger: person, fane: "skriv",
        indhold: skrivIndhold({ idag: idagIso(env) }),
      }), { cookies: sc });
    }

    if (person && request.method === "GET" && sti === "/mit/aftalt") {
      const sc = await sessionCookies(env, person, cookiesUd);
      return html(sideHtml({
        titel: TEKST.aftalt, bruger: person, fane: "nu",
        indhold: aftaltIndhold(),
      }), { cookies: sc });
    }

    if (person && request.method === "GET" && sti === "/mit/overblik") {
      const sc = await sessionCookies(env, person, cookiesUd);
      const idag = idagIso(env);
      const aar = idag.slice(0, 4);
      const [aftale, minSum, mine, fund, sted] = await Promise.all([
        gaeldendeAftale(env.FONDE_DB, person.id, idag),
        mineTimerSum(env.FONDE_DB, person.id, `${aar}-01-01`, `${aar}-12-31`),
        mineTimer(env.FONDE_DB, person.id, { graense: 12 }),
        mineFund(env.FONDE_DB, person.id, { graense: 12 }),
        stedetsTimer(env.FONDE_DB, `${aar}-01-01`, `${aar}-12-31`),
      ]);
      const m = url.searchParams.get("m");
      const besked = m === "fund" ? TEKST.fundGemt : (m ? TEKST.timerGemt : "");
      return html(sideHtml({
        titel: TEKST.fanerOverblik, bruger: person, fane: "overblik",
        indhold: overblikIndhold({ aftale, minSum, mine, fund, sted, aar, besked }),
      }), { cookies: sc });
    }

    if (request.method === "POST" && (sti === "/mit/skriv" || sti === "/mit/timer")) {
      if (!person) return json({ ok: false, grund: TEKST.ingenAdgang }, { status: 401 });
      const rk = await krop(request);
      if (sti === "/mit/timer") return timerPost(rk, env, person);
      return String(rk.slags || "timer") === "fund"
        ? fundPost(rk, env, person)
        : timerPost(rk, env, person);
    }

    if (!person && request.method === "GET" && (sti === "/mit/skriv" || sti === "/mit/overblik" || sti === "/mit/aftalt")) {
      await enhedAf(request, cookiesUd);
      return redirect("/mit", cookiesUd);
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
