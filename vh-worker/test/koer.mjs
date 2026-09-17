// Integrationsprøve af hele Fonds-CRM'et: rigtige migrationer, rigtig SQL,
// rigtige handlere. Kun D1/R2/Access er stubbet.
//
// Kør: node test/koer.mjs
import { readFileSync } from "node:fs";
import { lavD1, lavR2, lavAssets } from "./stubs.mjs";
import { hentPerson, roller, harRolle, opretPerson, tildelRolle, udloebRolle, skiftMail } from "../src/db.js";
import {
  somGrundlag, KorpusAfvisning, hentStemmeprofil, hentDokument,
  opretArbejdsgrundlag, knytKilde, godkendDokument, nyVersion,
} from "../src/korpus.js";
import {
  erAntagelse, kanMarkeresKlar, uopfyldteAdgangskrav, fristUgedagsKonflikt, lokalTilUtc,
} from "../src/runde.js";

const init = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
const seed = readFileSync(new URL("../migrations/0002_seed_ldp.sql", import.meta.url), "utf8");
const peopleSql = readFileSync(new URL("../migrations/0003_people.sql", import.meta.url), "utf8");
const mitSql = readFileSync(new URL("../migrations/0004_mit.sql", import.meta.url), "utf8");
const korpusSql = readFileSync(new URL("../migrations/0005_korpus.sql", import.meta.url), "utf8");
const fondeE2 = readFileSync(new URL("../migrations/0006_fonde_e2.sql", import.meta.url), "utf8");
const opholdSql = readFileSync(new URL("../migrations/0007_ophold.sql", import.meta.url), "utf8");

let ok = 0, fejl = 0;
const t = (navn, betingelse, ekstra = "") => {
  if (betingelse) { ok++; console.log("  ✓", navn); }
  else { fejl++; console.log("  ✗", navn, ekstra); }
};

// Access stubbes ved at overskrive modulets identitet gennem LOKAL_TEST-grenen.
const worker = (await import("../src/index.js")).default;

const mails = [];
const env = {
  FONDE_DB: lavD1([init, seed, peopleSql, mitSql, korpusSql, fondeE2, opholdSql]),
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
  t("kilden har baade fonde, korpus, ophold og registrering",
     forventet.includes("internt/fonde/") &&
     forventet.includes("internt/korpus/") &&
     forventet.includes("internt/ophold/") &&
     forventet.includes("internt/registrering"));
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

  const { opholdOversigt, opholdSide } = await import("../src/ophold-sider.js");
  const fladeHtml = [
    await tekst(await hent("/internt/fonde/")),
    await tekst(await hent(`/internt/fonde/sag/${A}`)),
    await tekst(await hent("/internt/fonde/ny")),
    await tekst(await hent("/internt/korpus/")),
    await tekst(await hent("/internt/korpus/dok/korpus-stemmeprofil")),
    await tekst(await hent("/internt/ophold/")),
    opholdOversigt({ bruger: { navn: "x" }, liste: [], typer: [{ id: "ot-x", navn: "x" }] }),
    opholdSide({
      bruger: { navn: "x" },
      o: {
        id: "op-x", type_navn: "x", start_dato: "2027-01-01", slut_dato: "2027-01-03",
        status: "åben", kapacitet: 2, optaget: 0, hele_stedet: 1, pris: 850, pris_fra: 850, note: "",
        pladser: [],
      },
      personer: [],
    }),
    await tekst(await hent("/sporene")),
    oversigt({ bruger: { navn: "x" }, sager: [], org: {} }),
    side({ titel: "Fejl", aktiv: "fonde", bruger: { navn: "x" }, indhold: fejlTilstand() }),
    tomTilstand(),
  ].join("\n");

  const ukendt = ukendteKlasser(fladeHtml, css);
  t("fondsfladen bruger kun klasser fra vh.css", ukendt.length === 0, ukendt.join(", "));

  const farver = farverUdenforPalet(fladeHtml, css);
  t("fondsfladen indfører ingen farve uden for paletten",
     farver.ok, JSON.stringify(farver));

  const kilder = ["flade.js", "sider.js", "views.js", "index.js", "tekst.js", "mit.js", "session.js", "mail.js", "webauthn.js", "krypto.js", "korpus.js", "runde.js", "ophold.js", "ophold-sider.js"]
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

console.log("\n15 · Korpus: læg op, mærk, godkend (BYG-567)");
{
  const h0 = await tekst(await hent("/internt/korpus/"));
  t("korpus-fladen svarer", h0.includes("Materiale til ansøgninger"));
  t("stemmeprofilen står på listen", h0.includes("Stemmeprofil · Vend Hjem"));

  const fd = new FormData();
  fd.set("titel", "Lai om stedet");
  fd.set("slags", "stemme");
  fd.set("oprindelse", "Lai, 2024");
  fd.set("tilladt_brug", "ordvalg");
  fd.set("indhold", "Syv bygninger fra 1920. Det er det, vi har.");
  const r = await hent("/internt/korpus/upload", { method: "POST", body: fd });
  t("upload omdirigerer", r.status === 303, r.status);
  const loc = r.headers.get("Location") || "";
  const stemmeId = loc.split("/").pop();
  t("får et dokument-id", stemmeId && stemmeId.length > 8, loc);

  const kladde = await hentDokument(env.FONDE_DB, stemmeId);
  t("nyt dokument er kladde", kladde?.godkendelsesstatus === "kladde", kladde?.godkendelsesstatus);
  t("mærket stemme", kladde?.slags === "stemme");

  await hent(`/internt/korpus/dok/${stemmeId}/godkend`, { method: "POST", body: new URLSearchParams() });
  const god = await hentDokument(env.FONDE_DB, stemmeId);
  t("kan godkendes til brug", god?.godkendelsesstatus === "godkendt");

  const fdF = new FormData();
  fdF.set("titel", "BBR-tal Egholmvej 23");
  fdF.set("slags", "fakta");
  fdF.set("dato", "2026-09-01");
  fdF.set("oprindelse", "BBR");
  fdF.set("fil", new File(["60.922 m2\n"], "bbr.txt", { type: "text/plain" }));
  const rF = await hent("/internt/korpus/upload", { method: "POST", body: fdF });
  const faktaId = (rF.headers.get("Location") || "").split("/").pop();
  t("fakta-fil landede i R2", env.FONDE_FILER._size() >= 1);

  console.log("\n16 · Ikke-godkendt og stemme-som-fakta afvises");
  {
    let kode1 = null;
    try { await somGrundlag(env.FONDE_DB, faktaId, "fakta"); }
    catch (e) { kode1 = e instanceof KorpusAfvisning ? e.kode : e.message; }
    t("ikke-godkendt fakta kan ikke bruges som grundlag", kode1 === "ikke_godkendt", kode1);

    await godkendDokument(env.FONDE_DB, faktaId, "test");
    const okFakta = await somGrundlag(env.FONDE_DB, faktaId, "fakta");
    t("godkendt fakta kan bruges som fakta", okFakta?.id === faktaId);

    let kode2 = null;
    try { await somGrundlag(env.FONDE_DB, stemmeId, "fakta"); }
    catch (e) { kode2 = e instanceof KorpusAfvisning ? e.kode : e.message; }
    t("godkendt stemme kan IKKE bruges som fakta", kode2 === "stemme_er_ikke_fakta", kode2);

    const okStemme = await somGrundlag(env.FONDE_DB, stemmeId, "stemme");
    t("godkendt stemme kan bruges som stemme", okStemme?.id === stemmeId);

    const fdH = new FormData();
    fdH.set("titel", "LDP-ansøgning 2025");
    fdH.set("slags", "historik");
    fdH.set("indhold", "Vi lovede et åbent værksted i 2025.");
    const rH = await hent("/internt/korpus/upload", { method: "POST", body: fdH });
    const histId = (rH.headers.get("Location") || "").split("/").pop();
    await godkendDokument(env.FONDE_DB, histId, "test");
    let kode3 = null;
    try { await somGrundlag(env.FONDE_DB, histId, "fakta"); }
    catch (e) { kode3 = e instanceof KorpusAfvisning ? e.kode : e.message; }
    t("historik kan ikke bruges som aktuelt faktum", kode3 === "historik_er_ikke_fakta", kode3);
  }

  console.log("\n17 · Kildedokument ændret: genvurdering, indsendt urørt");
  {
    const gAktiv = await opretArbejdsgrundlag(env.FONDE_DB, { titel: "Udkast værksted" });
    const gSendt = await opretArbejdsgrundlag(env.FONDE_DB, { titel: "LDP indsendt pakke", application_id: A });
    await knytKilde(env.FONDE_DB, gAktiv.id, faktaId);
    await knytKilde(env.FONDE_DB, gSendt.id, faktaId);

    const før = await env.FONDE_DB.prepare(`SELECT titel, status FROM applications WHERE id = ?1`).bind(A).first();
    t("LDP er indsendt før ændringen", før.status === "indsendt", før.status);

    const ud = await nyVersion(env.FONDE_DB, faktaId, { indhold: "Opdateret areal." }, "test");
    t("aktivt grundlag markeret til genvurdering", ud.genvurdering === 1, JSON.stringify(ud));
    t("indsendt sags grundlag sprang over", ud.sprunget_indsendt === 1, JSON.stringify(ud));

    const gAktivNu = await env.FONDE_DB.prepare(`SELECT status FROM arbejdsgrundlag WHERE id = ?1`).bind(gAktiv.id).first();
    const gSendtNu = await env.FONDE_DB.prepare(`SELECT status FROM arbejdsgrundlag WHERE id = ?1`).bind(gSendt.id).first();
    t("aktivt = til_genvurdering", gAktivNu.status === "til_genvurdering", gAktivNu.status);
    t("indsendt grundlag uændret status", gSendtNu.status === "kladde", gSendtNu.status);

    const efter = await env.FONDE_DB.prepare(`SELECT titel, status FROM applications WHERE id = ?1`).bind(A).first();
    t("indsendt ansøgning omskrives ikke", efter.status === "indsendt" && efter.titel === før.titel);

    const dok = await hentDokument(env.FONDE_DB, faktaId);
    t("ny version kræver ny godkendelse", dok.godkendelsesstatus === "kladde" && dok.version === 2);
  }

  console.log("\n18 · Stemmeprofilen har de fem forbudte mønstre");
  {
    const p = await hentStemmeprofil(env.FONDE_DB);
    t("stemmeprofilen findes og er godkendt", p?.godkendelsesstatus === "godkendt" && p.slags === "stemme");
    const txt = p?.indhold || "";
    t("mønster 1: sitet forklarer/forsvarer sig", txt.includes("forklarer eller forsvarer"));
    t("mønster 2: aforismen til sidst", /aforismen til sidst/i.test(txt));
    t("mønster 3: definition ved benægtelse", /benægtelse/i.test(txt));
    t("mønster 4: spejlet symmetri / parallelisme", /spejlet symmetri/i.test(txt) && /parallelisme/i.test(txt));
    t("mønster 5: statusfliser", /statusfliser/i.test(txt));
    let kode = null;
    try { await somGrundlag(env.FONDE_DB, p.id, "fakta"); }
    catch (e) { kode = e.kode; }
    t("stemmeprofilen er stemme, ikke fakta", kode === "stemme_er_ikke_fakta", kode);
  }
}

console.log("\n19 · Import af runde og LDP-mønster (BYG-568)");
let genApp;
{
  t("lokal 9. okt 15:00 er 13:00Z", lokalTilUtc("2026-10-09T15:00") === "2026-10-09T13:00:00.000Z",
     lokalTilUtc("2026-10-09T15:00"));
  const konflikt = fristUgedagsKonflikt("torsdag 9. oktober 2026 kl. 15.00", "2026-10-09T13:00:00Z");
  t("ugedagsfejl opdages, datoen rettes ikke",
     konflikt && konflikt.includes("fredag") && konflikt.includes("torsdag"), konflikt);

  const fd = new FormData();
  fd.set("fond_navn", "Den Nationale Landdistriktspulje");
  fd.set("fond_program", "Småøer");
  fd.set("fond_url", "https://www.livogland.dk/den-nationale-landdistriktspulje/projekter-paa-de-smaa-oeer");
  fd.set("runde_navn", "2. runde 2026 · småøer");
  fd.set("frist", "2026-10-09T15:00");
  fd.set("frist_ordlyd", "torsdag 9. oktober 2026 kl. 15.00");
  fd.set("frist_kilde_url", "https://www.livogland.dk/nyheder/2026/aug/aabning-af-den-nationale-landdistriktspulje-2-runde-2026");
  fd.set("krav_label_0", "Vedtægter");
  fd.set("krav_slags_0", "adgangskrav");
  fd.set("krav_kilde_0", "LDP-vejledning · ansøgergrundlag");
  fd.set("krav_label_1", "Interessetilkendegivelser / lokal opbakning");
  fd.set("krav_slags_1", "vurderingskriterium");
  fd.set("krav_kilde_1", "LDP-kriterier · småøer");
  fd.set("krav_label_2", "Rådighed over stedet: lejekontrakt eller tinglysning");
  fd.set("krav_slags_2", "adgangskrav");
  fd.set("krav_kilde_2", "");
  fd.set("krav_note_2", "Ikke verificeret for denne runde.");
  fd.set("sag_titel", "LDP genskabt");
  const r = await hent("/internt/fonde/ny", { method: "POST", body: fd });
  t("import omdirigerer til sagen", r.status === 303 && (r.headers.get("Location") || "").includes("/sag/"), r.headers.get("Location"));
  genApp = (r.headers.get("Location") || "").split("/").pop();

  const h = await tekst(await hent(`/internt/fonde/sag/${genApp}`));
  t("genskabt sag har LDP-titlen", h.includes("LDP genskabt"));
  t("kildens ordlyd er bevaret", h.includes("torsdag 9. oktober 2026 kl. 15.00"));
  t("ugedagsfejlen står som note, ikke rettet i stilhed", h.includes("er en fredag"));
  t("vurderingskriterium er adskilt", h.includes("Vurdering") && h.includes("Interessetilkendegivelser"));
  t("krav uden kilde er antagelse", h.includes("antagelse"));

  const utc = await env.FONDE_DB.prepare(
    `SELECT c.frist_utc, c.frist_ordlyd FROM applications a JOIN calls c ON c.id = a.call_id WHERE a.id = ?1`
  ).bind(genApp).first();
  t("frist_utc er 13:00Z, ordlyden stadig torsdag",
     utc.frist_utc.startsWith("2026-10-09T13:00:00") && utc.frist_ordlyd.includes("torsdag"),
     JSON.stringify(utc));
}

console.log("\n20 · Adgangskrav vs vurdering, klar-blokering");
{
  const krav = await env.FONDE_DB.prepare(
    `SELECT * FROM requirements WHERE application_id = ?1 ORDER BY sortering`
  ).bind(genApp).all();
  const liste = krav.results;
  const vedtaegter = liste.find((k) => k.label.startsWith("Vedtægter"));
  const vurdering = liste.find((k) => k.slags === "vurderingskriterium");
  const antag = liste.find((k) => !k.kilde);
  t("adgangskrav og vurdering i modellen",
     vedtaegter?.slags === "adgangskrav" && vurdering?.slags === "vurderingskriterium");
  t("usourcet krav er antagelse", erAntagelse(antag));
  t("sourced adgangskrav er ikke antagelse", !erAntagelse(vedtaegter));

  await hent(`/internt/fonde/sag/${genApp}/adgang`, {
    method: "POST", body: new URLSearchParams({ krav: vurdering.id, adgang: "ikke_opfyldt" }),
  });
  // vurdering shouldn't be set via UI (hidden), but if set it must not block
  await env.FONDE_DB.prepare(`UPDATE requirements SET adgang = 'ikke_opfyldt' WHERE id = ?1`).bind(vurdering.id).run();
  const efterV = (await env.FONDE_DB.prepare(`SELECT * FROM requirements WHERE application_id = ?1`).bind(genApp).all()).results;
  t("uopfyldt vurdering blokerer ikke klar", kanMarkeresKlar(efterV) && uopfyldteAdgangskrav(efterV).length === 0);

  await hent(`/internt/fonde/sag/${genApp}/adgang`, {
    method: "POST", body: new URLSearchParams({ krav: vedtaegter.id, adgang: "ikke_opfyldt" }),
  });
  const efterA = (await env.FONDE_DB.prepare(`SELECT * FROM requirements WHERE application_id = ?1`).bind(genApp).all()).results;
  t("bekræftet uopfyldt adgangskrav blokerer klar", !kanMarkeresKlar(efterA));

  const rKlar = await hent(`/internt/fonde/sag/${genApp}/klar`, { method: "POST", body: new URLSearchParams() });
  const locKlar = decodeURIComponent(rKlar.headers.get("Location") || "");
  t("POST klar afvises", locKlar.includes("uopfyldt"), locKlar);
  const st1 = await env.FONDE_DB.prepare(`SELECT status FROM applications WHERE id = ?1`).bind(genApp).first();
  t("status forbliver kladde", st1.status === "kladde", st1.status);

  const rArk = await hent(`/internt/fonde/sag/${genApp}/arkiver`, { method: "POST", body: new URLSearchParams() });
  t("arkiv omdirigerer", rArk.status === 303);
  const st2 = await env.FONDE_DB.prepare(`SELECT status FROM applications WHERE id = ?1`).bind(genApp).first();
  t("uopfyldt adgangskrav blokerer ikke arkiv", st2.status === "arkiveret", st2.status);

  // Ny sag til historisk indsendelse (arkiveret sag er færdig)
  const fd2 = new FormData();
  fd2.set("fond_navn", "Testfond historisk");
  fd2.set("fond_program", "Pulje");
  fd2.set("runde_navn", "Runde historisk");
  fd2.set("frist_ordlyd", "1. januar 2026");
  fd2.set("krav_label_0", "CVR");
  fd2.set("krav_slags_0", "adgangskrav");
  fd2.set("krav_kilde_0", "vejledning");
  fd2.set("sag_titel", "Historisk sag");
  const rNy = await hent("/internt/fonde/ny", { method: "POST", body: fd2 });
  const histApp = (rNy.headers.get("Location") || "").split("/").pop();
  const kravH = (await env.FONDE_DB.prepare(`SELECT id FROM requirements WHERE application_id = ?1`).bind(histApp).all()).results[0];
  await hent(`/internt/fonde/sag/${histApp}/adgang`, {
    method: "POST", body: new URLSearchParams({ krav: kravH.id, adgang: "ikke_opfyldt" }),
  });
  const rHist = await hent(`/internt/fonde/sag/${histApp}/historisk`, {
    method: "POST", body: new URLSearchParams({ ref: "GAMMEL-1", note: "Sendt på papir i 2025" }),
  });
  t("historisk indsendelse omdirigerer", rHist.status === 303);
  const sub = await env.FONDE_DB.prepare(
    `SELECT historisk, ekstern_ref FROM submissions WHERE application_id = ?1`
  ).bind(histApp).first();
  t("historisk indsendelse registreres trods uopfyldt adgangskrav",
     sub?.historisk === 1 && sub.ekstern_ref === "GAMMEL-1", JSON.stringify(sub));
}

console.log("\n21 · Fonde.dk-feltet er uafklaret og uden scraping");
{
  const org = await env.FONDE_DB.prepare(`SELECT * FROM organizations LIMIT 1`).first();
  t("status afventer CVR", org.fondedk_status === "afventer_cvr", org.fondedk_status);
  t("noten siger at det ikke er verificeret", /ikke verificeret/i.test(org.fondedk_note || ""));
  t("noten siger at vi ikke scraper", /scraper ikke Fonde\.dk/i.test(org.fondedk_note || ""));
  const ny = await tekst(await hent("/internt/fonde/ny"));
  t("import-fladen har felt til menneskets svar", ny.includes("Svar fra kommunen"));
  t("oversigten nævner Fonde.dk", (await tekst(await hent("/internt/fonde/"))).includes("Fonde.dk"));
}

console.log("\n22 · Ophold: overlap og kapacitet (BYG-561 C1)");
{
  const db = env.FONDE_DB;
  const raw = db._raw;
  const fejlBesked = (fn) => {
    try { fn(); return null; }
    catch (e) { return String(e.message || e); }
  };

  const typer = raw.prepare("SELECT id, spor, hele_stedet, pris_fra FROM opholdstyper ORDER BY sortering").all();
  t("seks spor plus lukkede uger er seedet", typer.length === 7, typer.length);
  t("mandegrupper har 850 kr.",
     typer.find((x) => x.spor === "mandegrupper")?.pris_fra === 850);
  t("retreats og campingvogne har ikke en opdigtet pris",
     typer.find((x) => x.spor === "retreats")?.pris_fra == null &&
     typer.find((x) => x.spor === "campingvogne")?.pris_fra == null);

  raw.prepare(`INSERT INTO ophold (id, type_id, start_dato, slut_dato, kapacitet, status, oprettet)
               VALUES ('op-mand-1', 'ot-mandegrupper', '2027-03-05', '2027-03-08', 15, 'åben', datetime('now'))`).run();
  t("et eksklusivt ophold kan oprettes",
     raw.prepare("SELECT status FROM ophold WHERE id = 'op-mand-1'").get().status === "åben");

  const overlap = fejlBesked(() => {
    raw.prepare(`INSERT INTO ophold (id, type_id, start_dato, slut_dato, kapacitet, status, oprettet)
                 VALUES ('op-ret-1', 'ot-retreats', '2027-03-07', '2027-03-12', 25, 'åben', datetime('now'))`).run();
  });
  t("overlap på hele stedet afvises af databasen",
     overlap != null && /hele stedet/i.test(overlap), overlap);
  t("det overlappinge retreat blev ikke gemt",
     raw.prepare("SELECT COUNT(*) n FROM ophold WHERE id = 'op-ret-1'").get().n === 0);

  raw.prepare(`INSERT INTO ophold (id, type_id, start_dato, slut_dato, kapacitet, status, oprettet)
               VALUES ('op-camp-1', 'ot-campingvogne', '2027-06-01', '2027-06-30', 4, 'åben', datetime('now'))`).run();
  raw.prepare(`INSERT INTO ophold (id, type_id, start_dato, slut_dato, kapacitet, status, oprettet)
               VALUES ('op-stille-1', 'ot-stille', '2027-06-10', '2027-06-17', 2, 'åben', datetime('now'))`).run();
  t("to ikke-eksklusive spor må overlappe",
     raw.prepare("SELECT COUNT(*) n FROM ophold WHERE id IN ('op-camp-1','op-stille-1')").get().n === 2);

  raw.prepare(`INSERT INTO ophold (id, type_id, start_dato, slut_dato, kapacitet, status, oprettet)
               VALUES ('op-lille', 'ot-stille', '2027-11-01', '2027-11-07', 2, 'åben', datetime('now'))`).run();
  raw.prepare(`INSERT INTO pladser (id, ophold_id, person_id, status, pris, oprettet)
               VALUES ('pl-1', 'op-lille', 'p-steven', 'bekræftet', 0, datetime('now'))`).run();
  t("én plads fylder ikke et ophold med kapacitet 2",
     raw.prepare("SELECT status FROM ophold WHERE id = 'op-lille'").get().status === "åben");

  raw.prepare(`INSERT INTO pladser (id, ophold_id, person_id, status, pris, oprettet)
               VALUES ('pl-2', 'op-lille', 'p-lai', 'bekræftet', 0, datetime('now'))`).run();
  t("fyldt kapacitet skifter selv til fuld",
     raw.prepare("SELECT status FROM ophold WHERE id = 'op-lille'").get().status === "fuld");

  const over = fejlBesked(() => {
    raw.prepare(`INSERT INTO pladser (id, ophold_id, person_id, status, pris, oprettet)
                 VALUES ('pl-3', 'op-lille', 'p-haruki', 'bekræftet', 0, datetime('now'))`).run();
  });
  t("plads ud over kapacitet afvises", over != null, over);

  raw.prepare(`UPDATE pladser SET status = 'afbudt' WHERE id = 'pl-2'`).run();
  t("afbud frigiver plads og åbner opholdet igen",
     raw.prepare("SELECT status FROM ophold WHERE id = 'op-lille'").get().status === "åben");

  const nabo = fejlBesked(() => {
    raw.prepare(`INSERT INTO ophold (id, type_id, start_dato, slut_dato, kapacitet, status, oprettet)
                 VALUES ('op-ret-nabo', 'ot-retreats', '2027-03-09', '2027-03-14', 25, 'åben', datetime('now'))`).run();
  });
  t("dagen efter et eksklusivt ophold er fri",
     nabo == null && raw.prepare("SELECT COUNT(*) n FROM ophold WHERE id = 'op-ret-nabo'").get().n === 1,
     nabo);

  raw.prepare(`INSERT INTO ophold (id, type_id, start_dato, slut_dato, kapacitet, status, oprettet)
               VALUES ('op-ret-lukket', 'ot-retreats', '2027-08-01', '2027-08-06', 25, 'lukket', datetime('now'))`).run();
}

console.log("\n23 · Ophold-fladen og offentlig kalender");
{
  const liste = await hent("/internt/ophold/");
  const lh = await tekst(liste);
  t("intern ophold svarer 200", liste.status === 200, liste.status);
  t("intern ophold bruger flade-sproget", lh.includes("Ophold") && lh.includes("opret"));

  const r = await hent("/internt/ophold/opret", {
    method: "POST",
    body: new URLSearchParams({
      type_id: "ot-mandegrupper",
      start_dato: "2027-04-16",
      slut_dato: "2027-04-18",
      kapacitet: "15",
      status: "åben",
      pris: "850",
    }),
  });
  t("opret ophold omdirigerer", r.status === 303, r.status);
  const oprettet = await env.FONDE_DB.prepare(
    `SELECT id FROM ophold WHERE start_dato = '2027-04-16' AND type_id = 'ot-mandegrupper'`
  ).first();
  t("opholdet ligger i databasen", Boolean(oprettet?.id), oprettet?.id);

  const sag = await tekst(await hent(`/internt/ophold/${oprettet.id}`));
  t("siden viser type og datoer", sag.includes("Mandegrupper") && sag.includes("2027"));

  const plads = await hent(`/internt/ophold/${oprettet.id}/plads`, {
    method: "POST",
    body: new URLSearchParams({ person_id: "p-haruki", status: "bekræftet", pris: "850" }),
  });
  t("plads omdirigerer", plads.status === 303, plads.status);
  const sag2 = await tekst(await hent(`/internt/ophold/${oprettet.id}`));
  t("Haruki står på opholdet", sag2.includes("Haruki Kino"));

  const tomEnv = { ...env, FONDE_DB: lavD1([init, seed, peopleSql, mitSql, korpusSql, fondeE2, opholdSql]), FONDE_FILER: env.FONDE_FILER, ASSETS: env.ASSETS, LOKAL_TEST: "1" };
  const tomKal = await tekst(await worker.fetch(new Request(BASE + "/sporene"), tomEnv, {}));
  t("tom kalender siger det højt", /ingen datoer/i.test(tomKal), tomKal.slice(0, 200));
  t("tom kalender siger ikke «datoer kommer»", !/datoer kommer/i.test(tomKal));
  t("mandegrupper viser 850 kr. på sporene", tomKal.includes("850"));
  t("spor uden pris forklarer hvorfor", tomKal.includes("Prisen") || tomKal.includes("prisen"));

  const offentlig = await tekst(await hent("/sporene"));
  t("åbent ophold vises på /sporene", offentlig.includes("2027") && /16\.|16-|april|04/.test(offentlig));
  t("åben kalender siger ikke «datoer kommer»", !/datoer kommer/i.test(offentlig));
  t("/sporene kræver ikke Access", (await worker.fetch(new Request(BASE + "/sporene"), { ...env, LOKAL_TEST: undefined }, {})).status === 200);

  const uden = { ...env, LOKAL_TEST: undefined };
  const internUden = await worker.fetch(new Request(BASE + "/internt/ophold/"), uden, {});
  t("/internt/ophold er 401 uden Access", internUden.status === 401, internUden.status);

  const gemTom = await hent(`/internt/ophold/${oprettet.id}/gem`, {
    method: "POST", body: new URLSearchParams({ start_dato: "", slut_dato: "", kapacitet: "15", status: "åben" }),
  });
  t("gem uden datoer afvises", decodeURIComponent(gemTom.headers.get("Location") || "").includes("Datoer mangler"),
     gemTom.headers.get("Location"));

  const offentligLukket = await tekst(await hent("/sporene"));
  t("lukket retreat vises ikke som åben dato eller lukket uge", !/august/i.test(offentligLukket));

  const nede = { ...env, FONDE_DB: { prepare() { throw new Error("D1 nede"); } }, LOKAL_TEST: "1" };
  const fald = await worker.fetch(new Request(BASE + "/sporene"), nede, {});
  t("kalender falder tilbage til assets ved D1-fejl", (await tekst(fald)) === "asset", fald.status);
}

console.log(`\n${ok} bestået, ${fejl} fejlet\n`);
process.exit(fejl ? 1 : 0);
