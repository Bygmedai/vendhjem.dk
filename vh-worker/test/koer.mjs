// Integrationsprøve af hele Fonds-CRM'et: rigtige migrationer, rigtig SQL,
// rigtige handlere. Kun D1/R2/Access er stubbet.
//
// Kør: node test/koer.mjs
import { readFileSync } from "node:fs";
import { lavD1, lavR2, lavAssets } from "./stubs.mjs";
import { hentPerson, roller, harRolle, opretPerson, tildelRolle, udloebRolle, skiftMail } from "../src/db.js";

const init = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
const seed = readFileSync(new URL("../migrations/0002_seed_ldp.sql", import.meta.url), "utf8");
const peopleSql = readFileSync(new URL("../migrations/0003_people.sql", import.meta.url), "utf8");
const mitSql = readFileSync(new URL("../migrations/0004_mit.sql", import.meta.url), "utf8");

let ok = 0, fejl = 0;
const t = (navn, betingelse, ekstra = "") => {
  if (betingelse) { ok++; console.log("  ✓", navn); }
  else { fejl++; console.log("  ✗", navn, ekstra); }
};

// Access stubbes ved at overskrive modulets identitet gennem LOKAL_TEST-grenen.
const worker = (await import("../src/index.js")).default;

const mails = [];
const env = {
  FONDE_DB: lavD1([init, seed, peopleSql, mitSql]),
  FONDE_FILER: lavR2(),
  ASSETS: lavAssets(),
  LOKAL_TEST: "1",
  SESSION_NOEGLE: "test-session-noegle-32bytes-min!",
  MIT_SVARTID_MS: "40",
  mailSink: async (m) => { mails.push(m); },
};
const BASE = "http://localhost:8788";
const A = "app-ldp-2026";

const hent = (sti, init2) => worker.fetch(new Request(BASE + sti, init2), env, {});
const tekst = async (r) => await r.text();

class Jar {
  constructor() { this.c = {}; }
  eat(r) {
    const linjer = typeof r.headers.getSetCookie === "function"
      ? r.headers.getSetCookie()
      : (r.headers.get("set-cookie") ? [r.headers.get("set-cookie")] : []);
    for (const linje of linjer) {
      if (!linje) continue;
      const [nv, ...rest] = linje.split(";");
      const eq = nv.indexOf("=");
      const navn = nv.slice(0, eq).trim();
      const value = nv.slice(eq + 1).trim();
      const attrs = rest.map((s) => s.trim().toLowerCase());
      if (attrs.some((a) => a === "max-age=0" || a.startsWith("expires=thu, 01 jan 1970")))
        delete this.c[navn];
      else this.c[navn] = { value, linje, attrs };
    }
  }
  header() {
    return Object.entries(this.c).map(([k, v]) => `${k}=${v.value}`).join("; ");
  }
  async hent(sti, init2 = {}) {
    const headers = new Headers(init2.headers || {});
    const h = this.header();
    if (h) headers.set("Cookie", h);
    const r = await hent(sti, { ...init2, headers });
    this.eat(r);
    return r;
  }
}

const linkIMail = (m) => {
  const t = m?.text || m?.html || "";
  const m2 = t.match(/https?:\/\/[^\s]+/);
  return m2 ? m2[0] : null;
};
const stiFraUrl = (u) => {
  const x = new URL(u);
  return x.pathname + x.search;
};

console.log("\n1 · Oversigten");
{
  const r = await hent("/internt/fonde/");
  const h = await tekst(r);
  t("svarer 200", r.status === 200, r.status);
  t("viser LDP-sagen", h.includes("LDP Småøer 2026"));
  t("viser Steven som ansvarlig", h.includes("Steven Wensley"));
  t("viser fristen 9. oktober", h.includes("09. oktober 2026"));
  t("viser at 7 bilag mangler", h.includes("7 af 7 mangler"), h.match(/\d+ af \d+ mangler/)?.[0]);
  t("viser at CVR mangler", h.includes("Intet CVR"));
  t("siger at den ikke indsender selv", h.includes("Det indsender ikke for jer"));
}

console.log("\n2 · Sagssiden");
{
  const h = await tekst(await hent(`/internt/fonde/sag/${A}`));
  t("har bilagscheckliste", h.includes("Bilagscheckliste"));
  t("otte krav vises", (h.match(/Markér kontrolleret|mangler<\/span>/g) || []).length >= 7);
  t("ugedagsfejlen står der", h.includes("er en fredag"));
  t("ingen beslutning endnu", h.includes("Ingen beslutning endnu"));
  t("kan ikke registrere indsendelse uden godkendelse",
     h.includes("Kan først registreres, når en gældende godkendelse"));
}

console.log("\n3 · Gem felter");
{
  const r = await hent(`/internt/fonde/sag/${A}/gem`, {
    method: "POST", body: new URLSearchParams({ beloeb: "485000", ansvarlig: "p-steven", naeste: "Stiftende generalforsamling" }),
  });
  t("omdirigerer", r.status === 303, r.status);
  const h = await tekst(await hent(`/internt/fonde/sag/${A}`));
  t("beløbet er gemt", h.includes("485000") || h.includes("485.000"));
  t("fladen viser stadig Steven", h.includes("Steven Wensley"));
  t("aktivitetslog fik en linje", h.includes("rettede sagens felter"));
}

console.log("\n4 · Upload bilag");
{
  const fd = new FormData();
  fd.set("krav", "req-2");
  fd.set("fil", new File(["budget 2026\n"], "budget.txt", { type: "text/plain" }));
  const r = await hent(`/internt/fonde/sag/${A}/upload`, { method: "POST", body: fd });
  t("omdirigerer", r.status === 303, r.status);
  const h = await tekst(await hent(`/internt/fonde/sag/${A}`));
  t("filen vises på kravet", h.includes("budget.txt"));
  t("R2 fik filen", env.FONDE_FILER._size() === 1);
  const o = await tekst(await hent("/internt/fonde/"));
  t("oversigten tæller nu 6 manglende", o.includes("6 af 7 mangler"), o.match(/\d+ af \d+ mangler/)?.[0]);
}

console.log("\n5 · Godkendelse binder til pakken");
let hash1;
{
  const r = await hent(`/internt/fonde/sag/${A}/godkend`, {
    method: "POST", body: new URLSearchParams({ beslutning: "godkendt", kommentar: "Godkendt på bestyrelsesmøde" }),
  });
  t("omdirigerer", r.status === 303, r.status);
  const h = await tekst(await hent(`/internt/fonde/sag/${A}`));
  t("beslutningen vises", h.includes("Godkendt på bestyrelsesmøde"));
  t("indsendelse er nu mulig", h.includes("Registrér som indsendt"));
  t("pakken er IKKE markeret som ændret", !h.includes("Pakken er ændret"));
  hash1 = (await env.FONDE_DB.prepare("SELECT pakke_hash FROM approvals LIMIT 1").bind().first()).pakke_hash;
}

console.log("\n6 · Ændring efter godkendelse ugyldiggør den");
{
  const fd = new FormData();
  fd.set("krav", "req-4");
  fd.set("fil", new File(["projektbeskrivelse\n"], "projekt.txt", { type: "text/plain" }));
  await hent(`/internt/fonde/sag/${A}/upload`, { method: "POST", body: fd });
  const h = await tekst(await hent(`/internt/fonde/sag/${A}`));
  t("systemet siger at pakken er ændret", h.includes("Pakken er ændret"));
  t("indsendelse er blokeret igen", !h.includes("Registrér som indsendt"));

  const r = await hent(`/internt/fonde/sag/${A}/indsendt`, {
    method: "POST", body: new URLSearchParams({ ref: "snyd-123" }),
  });
  const loc = r.headers.get("Location") || "";
  t("forsøg på indsendelse afvises", loc.includes("Pakken%20er%20%C3%A6ndret") || decodeURIComponent(loc).includes("Pakken er ændret"), loc);
  const n = await env.FONDE_DB.prepare("SELECT COUNT(*) n FROM submissions").bind().first();
  t("ingen indsendelse blev registreret", n.n === 0, n.n);
}

console.log("\n7 · Godkend igen, så indsend");
{
  await hent(`/internt/fonde/sag/${A}/godkend`, {
    method: "POST", body: new URLSearchParams({ beslutning: "godkendt", kommentar: "Godkendt igen efter nyt bilag" }),
  });
  const hash2 = (await env.FONDE_DB.prepare(
    "SELECT pakke_hash FROM approvals ORDER BY besluttet DESC LIMIT 1").bind().first()).pakke_hash;
  t("pakke-hash ændrede sig", hash1 !== hash2);

  const fd = new FormData();
  fd.set("ref", "PLST-2026-0042");
  fd.set("kvittering", new File(["kvittering"], "kvittering.pdf", { type: "application/pdf" }));
  const r = await hent(`/internt/fonde/sag/${A}/indsendt`, { method: "POST", body: fd });
  t("omdirigerer", r.status === 303, r.status);
  const h = await tekst(await hent(`/internt/fonde/sag/${A}`));
  t("indsendelsen vises med reference", h.includes("PLST-2026-0042"));
  const st = await env.FONDE_DB.prepare("SELECT status FROM applications WHERE id = ?1").bind(A).first();
  t("status i databasen er indsendt", st.status === "indsendt", st.status);
}

console.log("\n8 · Indsendt sag kan ikke ændres");
{
  const r = await hent(`/internt/fonde/sag/${A}/upload`, { method: "POST", body: (() => {
    const fd = new FormData(); fd.set("krav", "req-1");
    fd.set("fil", new File(["x"], "efter.txt", { type: "text/plain" })); return fd;
  })() });
  t("afvises", decodeURIComponent(r.headers.get("Location") || "").includes("kan ikke ændres"),
     r.headers.get("Location"));
}

console.log("\n9 · Uden identitet er der intet");
{
  const uden = { ...env, LOKAL_TEST: undefined };
  const r = await worker.fetch(new Request(BASE + "/internt/fonde/"), uden, {});
  t("401 uden Access-JWT", r.status === 401, r.status);
}

console.log("\n10 · Stier uden for fonde rører ikke koden");
{
  const r = await hent("/internt/stedet");
  t("sendes til assets", (await tekst(r)) === "asset");
}

console.log("\n11 · Navigationen er den samme begge steder");
{
  // Den her proeve findes, fordi navigationen laa to steder og drev fra
  // hinanden: Fonde manglede paa de statiske sider, Registrering manglede i
  // fondsvaerktoejet, og man kunne ikke komme fra OEkonomi til Fonde.
  const { PUNKTER } = await import("../src/nav-internt.js");
  const statisk = readFileSync(new URL("../../internt/oekonomi.html", import.meta.url), "utf8");
  const navStatisk = statisk.match(/<nav class="nav" aria-label="Internt">([\s\S]*?)<\/nav>/)?.[1] ?? "";
  const stierStatisk = [...navStatisk.matchAll(/href="\.\.\/([^"]*)"/g)].map((m) => m[1]);

  const h = await tekst(await hent("/internt/fonde/"));
  const navWorker = h.match(/<nav class="nav" aria-label="Internt">([\s\S]*?)<\/nav>/)?.[1] ?? "";
  const stierWorker = [...navWorker.matchAll(/href="\/([^"]*)"/g)].map((m) => m[1]);

  const forventet = PUNKTER.map((p) => p.sti);
  t("kilden har baade fonde og registrering",
     forventet.includes("internt/fonde/") && forventet.includes("internt/registrering"));
  t("statiske sider har alle punkter",
     JSON.stringify(stierStatisk) === JSON.stringify(forventet),
     JSON.stringify(stierStatisk));
  t("fondsvaerktoejet har alle punkter",
     JSON.stringify(stierWorker) === JSON.stringify(forventet),
     JSON.stringify(stierWorker));
  t("de to navigationer er identiske",
     JSON.stringify(stierStatisk) === JSON.stringify(stierWorker));
}

console.log("\n12 · Personregister (BYG-555 A1)");
{
  const db = env.FONDE_DB;

  const steven = await hentPerson(db, "steven@bygmedai.dk");
  t("seed: Steven findes på Access-mail", steven?.navn === "Steven Wensley", steven?.navn);
  t("seed: de tre kerne-mails findes",
     Boolean(await hentPerson(db, "laiydeh@gmail.com")) &&
     Boolean(await hentPerson(db, "haruki@bygmedai.dk")));
  t("seed: Steven har rollen kerne", await harRolle(db, "p-steven", "kerne"));

  const app = await db.prepare(`SELECT ansvarlig FROM applications WHERE id = ?1`).bind(A).first();
  t("LDP-sagens ansvarlig er person_id, ikke fritekst", app.ansvarlig === "p-steven", app.ansvarlig);

  const ny = await opretPerson(db, { navn: "Prøveperson", mail: "proeve@vendhjem.test" });
  t("opret person", ny?.id && ny.navn === "Prøveperson", ny?.id);

  const rolle = await tildelRolle(db, { person_id: ny.id, rolle: "medlem" });
  t("tildel rolle", rolle?.rolle === "medlem" && await harRolle(db, ny.id, "medlem"));

  await udloebRolle(db, rolle.id);
  t("udløb rolle — personposten er urørt",
     !(await harRolle(db, ny.id, "medlem")) &&
     (await hentPerson(db, "proeve@vendhjem.test"))?.id === ny.id);

  const mangler = await hentPerson(db, "findes-ikke@vendhjem.test");
  t("opslag på mail der ikke findes returnerer null", mangler === null, mangler);

  // Mail er kontakt, ikke identitet: skift, gammel slår ikke længere op.
  await skiftMail(db, ny.id, "nyt@vendhjem.test");
  t("efter mailskift: gammel mail → null, ny mail → samme person",
     (await hentPerson(db, "proeve@vendhjem.test")) === null &&
     (await hentPerson(db, "nyt@vendhjem.test"))?.id === ny.id);

  const rollerNu = await roller(db, ny.id);
  t("roller() returnerer historikken, også udløbne",
     rollerNu.length === 1 && rollerNu[0].gyldig_til != null);
}

console.log("\n13 · Fladekontrakt (BYG-565 G1)");
{
  const { ukendteKlasser, farverUdenforPalet } = await import("../src/kontrakt.js");
  const { oversigt } = await import("../src/sider.js");
  const { side, fejlTilstand, tomTilstand } = await import("../src/flade.js");
  const css = readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8");

  t("ukendt klasse fejler",
     ukendteKlasser('<div class="kort-xyz">x</div>', css).includes("kort-xyz"));
  t("farve uden for paletten fejler",
     !farverUdenforPalet("color:#ff00aa", css).ok);
  t("palettens papir-farve er tilladt",
     farverUdenforPalet("color:#e9e7e0", css).ok);

  const fladeHtml = [
    await tekst(await hent("/internt/fonde/")),
    await tekst(await hent(`/internt/fonde/sag/${A}`)),
    oversigt({ bruger: { navn: "x" }, sager: [], org: {} }),
    side({ titel: "Fejl", aktiv: "fonde", bruger: { navn: "x" }, indhold: fejlTilstand() }),
    tomTilstand(),
  ].join("\n");

  const ukendt = ukendteKlasser(fladeHtml, css);
  t("fondsfladen bruger kun klasser fra vh.css", ukendt.length === 0, ukendt.join(", "));

  const farver = farverUdenforPalet(fladeHtml, css);
  t("fondsfladen indfører ingen farve uden for paletten",
     farver.ok, JSON.stringify(farver));

  const kilder = ["flade.js", "sider.js", "views.js", "index.js", "tekst.js", "mit.js", "session.js", "mail.js", "webauthn.js", "krypto.js"]
    .map((f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")).join("\n");
  const kildeFarver = farverUdenforPalet(kilder, css);
  t("flade-kilden indfører ingen farve uden for paletten",
     kildeFarver.ok, JSON.stringify(kildeFarver));
  t("tom liste bruger TEKST.tomListe", fladeHtml.includes("Ingen sager endnu."));
}

console.log("\n14 · Community-login /mit (BYG-556 A2)");
{
  const SVAR = "Hvis adressen hører til nogen her, ligger der en mail nu.";

  // /mit er uden for Access — Workeren svarer selv, uden JWT.
  const udenAccess = { ...env, LOKAL_TEST: undefined };
  const aaben = await worker.fetch(new Request(BASE + "/mit"), udenAccess, {});
  const aabenHtml = await tekst(aaben);
  t("/mit svarer 200 uden Access-JWT", aaben.status === 200, aaben.status);
  t("/mit er ikke en asset-genvej", aabenHtml !== "asset");
  t("/mit viser loginformular på dansk",
     aabenHtml.includes("Din mail") && aabenHtml.includes("Send mig et link"));
  t("/mit bruger ikke intern nav (Økonomi/Fonde)",
     !aabenHtml.includes("/internt/fonde") && !aabenHtml.includes(">Økonomi<"));

  const internUden = await worker.fetch(new Request(BASE + "/internt/fonde/"), udenAccess, {});
  t("/internt er uændret bag Access (401 uden JWT)", internUden.status === 401, internUden.status);

  // Ukendt og kendt: samme svar, samme timing, kun kendt får mail.
  mails.length = 0;
  const jarUkendt = new Jar();
  await jarUkendt.hent("/mit");
  const tUkendt0 = Date.now();
  const rUkendt = await jarUkendt.hent("/mit/login", {
    method: "POST", body: new URLSearchParams({ mail: "findes-ikke@vendhjem.test" }),
  });
  const tUkendt = Date.now() - tUkendt0;
  const hUkendt = await tekst(rUkendt);
  t("ukendt mail: samme svartekst", hUkendt.includes(SVAR), hUkendt.slice(0, 180));
  t("ukendt mail: ingen mail sendt", mails.length === 0, mails.length);

  const jarKendt = new Jar();
  await jarKendt.hent("/mit");
  const tKendt0 = Date.now();
  const rKendt = await jarKendt.hent("/mit/login", {
    method: "POST", body: new URLSearchParams({ mail: "steven@bygmedai.dk" }),
  });
  const tKendt = Date.now() - tKendt0;
  const hKendt = await tekst(rKendt);
  t("kendt mail: samme svartekst", hKendt.includes(SVAR));
  t("kendt mail: én mail med link", mails.length === 1 && Boolean(linkIMail(mails[0])), mails.length);
  t("ukendt og kendt svarer inden for 80 ms af hinanden",
     Math.abs(tUkendt - tKendt) <= 80, `ukendt ${tUkendt}ms, kendt ${tKendt}ms`);

  const magicUrl = linkIMail(mails[0]);
  const magicSti = magicUrl ? stiFraUrl(magicUrl) : "/mit/link/mangler";

  // Klik i samme browser → inde, session-cookie.
  const rLink = await jarKendt.hent(magicSti);
  t("gyldigt link omdirigerer ind", rLink.status === 303, rLink.status);
  const loc = rLink.headers.get("Location") || "";
  t("omdirigerer til /mit", loc === "/mit" || loc.endsWith("/mit"), loc);
  t("session-cookie er HttpOnly Secure SameSite=Lax",
     Boolean(jarKendt.c.vh_session) &&
     jarKendt.c.vh_session.linje.toLowerCase().includes("httponly") &&
     jarKendt.c.vh_session.linje.toLowerCase().includes("secure") &&
     /samesite=lax/i.test(jarKendt.c.vh_session.linje),
     jarKendt.c.vh_session?.linje);
  t("session-cookie lever 90 dage",
     /max-age=7776000/i.test(jarKendt.c.vh_session?.linje || ""),
     jarKendt.c.vh_session?.linje);

  const rInde = await jarKendt.hent("/mit");
  const hInde = await tekst(rInde);
  t("efter klik: inde, ikke loginformular",
     rInde.status === 200 && hInde.includes("Steven") && !hInde.includes("Send mig et link"),
     hInde.slice(0, 200));
  t("passkey tilbydes efter første login",
     hInde.includes("huske dig") || hInde.includes("Husk den"),
     hInde.includes("passkey") ? "passkey" : hInde.slice(0, 240));
  t("session fornyes stille ved brug (Set-Cookie igen)",
     Boolean(jarKendt.c.vh_session) && /max-age=7776000/i.test(jarKendt.c.vh_session.linje));

  // Genbrugt link.
  const rGenbrug = await jarKendt.hent(magicSti);
  const hGenbrug = await tekst(rGenbrug);
  t("brugt link virker ikke igen",
     rGenbrug.status !== 303 && (hGenbrug.includes("allerede brugt") || hGenbrug.includes("Bed om et nyt")),
     `status ${rGenbrug.status}`);

  // Forkert browser: samme token, anden enhed-cookie.
  mails.length = 0;
  const jarA = new Jar();
  await jarA.hent("/mit");
  await jarA.hent("/mit/login", {
    method: "POST", body: new URLSearchParams({ mail: "laiydeh@gmail.com" }),
  });
  const urlA = linkIMail(mails[0]);
  const jarB = new Jar();
  await jarB.hent("/mit");
  const rForkert = await jarB.hent(urlA ? stiFraUrl(urlA) : "/mit/link/x");
  const hForkert = await tekst(rForkert);
  t("link i anden browser virker ikke",
     rForkert.status !== 303 && (hForkert.includes("anden browser") || hForkert.includes("dér, hvor du bad")),
     `status ${rForkert.status}`);

  // Udløbet link (15 min): sæt udloeb i fortiden.
  mails.length = 0;
  const jarUdl = new Jar();
  await jarUdl.hent("/mit");
  await jarUdl.hent("/mit/login", {
    method: "POST", body: new URLSearchParams({ mail: "haruki@bygmedai.dk" }),
  });
  const urlUdl = linkIMail(mails[0]);
  await env.FONDE_DB.prepare(`UPDATE magic_links SET udloeb = '2000-01-01T00:00:00.000Z' WHERE brugt IS NULL`).run();
  const rUdl = await jarUdl.hent(urlUdl ? stiFraUrl(urlUdl) : "/mit/link/x");
  const hUdl = await tekst(rUdl);
  t("link ældre end 15 minutter virker ikke",
     rUdl.status !== 303 && (hUdl.includes("for gammelt") || hUdl.includes("Bed om et nyt")),
     `status ${rUdl.status}`);

  // Udløbet rolle: person findes, men rollen er udløbet → ingen mail, samme svar.
  const udloebet = await opretPerson(env.FONDE_DB, { navn: "Udløbet", mail: "udloebet@vendhjem.test" });
  const rolleUdl = await tildelRolle(env.FONDE_DB, { person_id: udloebet.id, rolle: "medlem" });
  await udloebRolle(env.FONDE_DB, rolleUdl.id);
  mails.length = 0;
  const jarRolle = new Jar();
  await jarRolle.hent("/mit");
  const rRolle = await jarRolle.hent("/mit/login", {
    method: "POST", body: new URLSearchParams({ mail: "udloebet@vendhjem.test" }),
  });
  t("udløbet rolle: samme svar, ingen mail",
     (await tekst(rRolle)).includes(SVAR) && mails.length === 0, mails.length);

  // Afvis passkey — huskes for evigt.
  const rNej = await jarKendt.hent("/mit/enhed/nej", { method: "POST" });
  t("afvis passkey omdirigerer", rNej.status === 303, rNej.status);
  const hEfterNej = await tekst(await jarKendt.hent("/mit"));
  t("afvisning huskes: tilbud vises ikke igen",
     !hEfterNej.includes("huske dig") && !hEfterNej.includes("Husk den"));
  const steven = await env.FONDE_DB.prepare(`SELECT passkey_tilbud FROM people WHERE id = 'p-steven'`).first();
  t("passkey_tilbud er nej i databasen", steven?.passkey_tilbud === "nej", steven?.passkey_tilbud);

  // Fladekontrakt på /mit.
  const { ukendteKlasser: uk2, farverUdenforPalet: fu2 } = await import("../src/kontrakt.js");
  const css = readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8");
  const mitHtml = aabenHtml + hInde + hKendt;
  const ukendtMit = uk2(mitHtml, css);
  t("/mit bruger kun klasser fra vh.css", ukendtMit.length === 0, ukendtMit.join(", "));
  const farverMit = fu2(mitHtml, css);
  t("/mit indfører ingen farve uden for paletten", farverMit.ok, JSON.stringify(farverMit));
}

console.log(`\n${ok} bestået, ${fejl} fejlet\n`);
process.exit(fejl ? 1 : 0);
