// Integrationsprøve af hele Fonds-CRM'et: rigtige migrationer, rigtig SQL,
// rigtige handlere. Kun D1/R2/Access er stubbet.
//
// Kør: node test/koer.mjs
import { readFileSync, existsSync } from "node:fs";
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
const foresporgSql = readFileSync(new URL("../migrations/0008_foresporgsel.sql", import.meta.url), "utf8");
const kalenderSql = readFileSync(new URL("../migrations/0009_kalender_2027.sql", import.meta.url), "utf8");
const breveSql = readFileSync(new URL("../migrations/0011_breve.sql", import.meta.url), "utf8");
const timerSql = readFileSync(new URL("../migrations/0012_timer.sql", import.meta.url), "utf8");
const loginSql = readFileSync(new URL("../migrations/0013_login_forsoeg.sql", import.meta.url), "utf8");
const fundSql = readFileSync(new URL("../migrations/0014_fund.sql", import.meta.url), "utf8");
const vagterSql = readFileSync(new URL("../migrations/0015_vagter.sql", import.meta.url), "utf8");
const SKELET = [init, seed, peopleSql, mitSql, korpusSql, fondeE2, opholdSql, foresporgSql];
const MIGRATIONER = [...SKELET, kalenderSql, breveSql, timerSql, loginSql, fundSql, vagterSql];

let ok = 0, fejl = 0;
const t = (navn, betingelse, ekstra = "") => {
  if (betingelse) { ok++; console.log("  ✓", navn); }
  else { fejl++; console.log("  ✗", navn, ekstra); }
};

// Access stubbes ved at overskrive modulets identitet gennem LOKAL_TEST-grenen.
const worker = (await import("../src/index.js")).default;

const mails = [];
const env = {
  FONDE_DB: lavD1(MIGRATIONER),
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
  // Begge sider laeses med samme moenster. Siden build.py skriver absolutte
  // stier (se HVORFOR-ABSOLUTTE-STIER), er formen den samme paa de statiske
  // sider og i Workeren — og proeven kan ikke laengere bestaas af to
  // navigationer, der bare ligner hinanden i hver sin notation.
  const stierStatisk = [...navStatisk.matchAll(/href="\/([^"]*)"/g)].map((m) => m[1]);

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

  const kilder = ["flade.js", "sider.js", "views.js", "index.js", "tekst.js", "mit.js", "session.js", "mail.js", "webauthn.js", "krypto.js", "korpus.js", "runde.js", "ophold.js", "ophold-sider.js", "breve.js", "fotos.js", "fod.js", "stigen.js", "sikkerhedskopi.js", "fund.js", "aftalt.js"]
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

  const tomEnv = { ...env, FONDE_DB: lavD1(SKELET), FONDE_FILER: env.FONDE_FILER, ASSETS: env.ASSETS, LOKAL_TEST: "1" };
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

  const overlapHttp = await hent("/internt/ophold/opret", {
    method: "POST",
    body: new URLSearchParams({
      type_id: "ot-retreats",
      start_dato: "2027-04-17",
      slut_dato: "2027-04-22",
      kapacitet: "25",
      status: "åben",
    }),
  });
  const overlapLoc = decodeURIComponent(overlapHttp.headers.get("Location") || "");
  t("fladen viser overlap på dansk, uden D1_ERROR",
     overlapLoc.includes("hele stedet er optaget") && !/D1_ERROR|SQLITE/i.test(overlapLoc),
     overlapLoc);

  const nede = { ...env, FONDE_DB: { prepare() { throw new Error("D1 nede"); } }, LOKAL_TEST: "1" };
  const fald = await worker.fetch(new Request(BASE + "/sporene"), nede, {});
  t("kalender falder tilbage til assets ved D1-fejl", (await tekst(fald)) === "asset", fald.status);
}

console.log("\n24 · Forespørgsel (BYG-562 C2)");
{
  const db = env.FONDE_DB;
  const april = await db.prepare(
    `SELECT id FROM ophold WHERE start_dato = '2027-04-16' AND type_id = 'ot-mandegrupper'`
  ).first();
  t("C1-opholdet fra april ligger klar til forespørgsel", Boolean(april?.id), april?.id);

  const sporene = await tekst(await hent("/sporene"));
  t("åbent ophold har forespørg-knap på /sporene",
     sporene.includes(`/sporene/forespørg/${april.id}`), sporene.slice(0, 400));

  const form = await hent(`/sporene/forespørg/${april.id}`);
  const formHtml = await tekst(form);
  t("formularen svarer 200 uden Access", form.status === 200, form.status);
  t("formularen har navn, mail og fritekst",
     /name="navn"/.test(formHtml) && /name="mail"/.test(formHtml) && /name="besked"/.test(formHtml));
  t("formularen har ikke telefon, adresse eller attribution",
     !/name="telefon"/.test(formHtml) && !/name="adresse"/.test(formHtml) &&
     !/hørte du/i.test(formHtml) && !/name="kilde"/.test(formHtml));

  mails.length = 0;
  const ukendt = await hent(`/sporene/forespørg/${april.id}`, {
    method: "POST",
    body: new URLSearchParams({
      navn: "Anna Ny",
      mail: "anna.ny@example.com",
      besked: "Kommer med tog til Stigsnæs",
    }),
  });
  const ukendtHtml = await tekst(ukendt);
  t("ukendt person får kvittering på skærmen",
     ukendt.status === 200 && /tak/i.test(ukendtHtml) && /vender tilbage/i.test(ukendtHtml),
     ukendt.status);
  const anna = await db.prepare(
    `SELECT * FROM people WHERE lower(mail) = 'anna.ny@example.com'`
  ).first();
  t("ukendt person oprettes", Boolean(anna?.id) && anna.navn === "Anna Ny", JSON.stringify(anna));
  const annaPlads = await db.prepare(
    `SELECT * FROM pladser WHERE ophold_id = ?1 AND person_id = ?2`
  ).bind(april.id, anna?.id).first();
  t("ukendt person får én plads med status forespurgt",
     annaPlads?.status === "forespurgt" && annaPlads.besked === "Kommer med tog til Stigsnæs",
     JSON.stringify(annaPlads));
  t("kvitteringsmail er sendt",
     mails.some((m) => m.to === "anna.ny@example.com" && /vender tilbage|tre dage|skriver/i.test(m.text || "")),
     JSON.stringify(mails.map((m) => ({ to: m.to, subject: m.subject }))));

  const folkFoer = await db.prepare(
    `SELECT COUNT(*) n FROM people WHERE lower(mail) = 'steven@bygmedai.dk'`
  ).first();
  mails.length = 0;
  const kendt = await hent(`/sporene/forespørg/${april.id}`, {
    method: "POST",
    body: new URLSearchParams({ navn: "Steven Wensley", mail: "steven@bygmedai.dk" }),
  });
  const folkEfter = await db.prepare(
    `SELECT COUNT(*) n FROM people WHERE lower(mail) = 'steven@bygmedai.dk'`
  ).first();
  const stevenPlads = await db.prepare(
    `SELECT * FROM pladser WHERE ophold_id = ?1 AND person_id = 'p-steven'`
  ).bind(april.id).first();
  t("kendt person genkendes, ikke duplikeres",
     kendt.status === 200 && folkFoer.n === 1 && folkEfter.n === 1 && stevenPlads?.status === "forespurgt",
     JSON.stringify({ status: kendt.status, foer: folkFoer.n, efter: folkEfter.n, plads: stevenPlads }));

  mails.length = 0;
  const dobbelt = await hent(`/sporene/forespørg/${april.id}`, {
    method: "POST",
    body: new URLSearchParams({ navn: "Anna Ny", mail: "anna.ny@example.com" }),
  });
  const annaIgen = await db.prepare(
    `SELECT COUNT(*) n FROM people WHERE lower(mail) = 'anna.ny@example.com'`
  ).first();
  const annaPladser = await db.prepare(
    `SELECT COUNT(*) n FROM pladser WHERE ophold_id = ?1 AND person_id = ?2 AND status != 'afbudt'`
  ).bind(april.id, anna?.id).first();
  t("dobbelt forespørgsel bliver én person og én plads",
     dobbelt.status === 200 && annaIgen.n === 1 && annaPladser.n === 1,
     JSON.stringify({ status: dobbelt.status, personer: annaIgen.n, pladser: annaPladser.n }));

  db._raw.prepare(`INSERT INTO ophold (id, type_id, start_dato, slut_dato, kapacitet, status, oprettet)
                   VALUES ('op-fuld-c2', 'ot-stille', '2027-12-01', '2027-12-07', 1, 'åben', datetime('now'))`).run();
  db._raw.prepare(`INSERT INTO pladser (id, ophold_id, person_id, status, pris, oprettet)
                   VALUES ('pl-fuld-c2', 'op-fuld-c2', 'p-lai', 'bekræftet', 0, datetime('now'))`).run();
  t("fuldt ophold skifter til fuld",
     db._raw.prepare("SELECT status FROM ophold WHERE id = 'op-fuld-c2'").get().status === "fuld");

  const sporeneFuld = await tekst(await hent("/sporene"));
  t("fuldt ophold har ingen forespørg-knap",
     !sporeneFuld.includes("/sporene/forespørg/op-fuld-c2"));
  const fuldPost = await hent("/sporene/forespørg/op-fuld-c2", {
    method: "POST",
    body: new URLSearchParams({ navn: "Ude Lukket", mail: "ude.lukket@example.com" }),
  });
  const ude = await db.prepare(
    `SELECT COUNT(*) n FROM people WHERE lower(mail) = 'ude.lukket@example.com'`
  ).first();
  const fuldPlads = await db.prepare(
    `SELECT COUNT(*) n FROM pladser WHERE ophold_id = 'op-fuld-c2'`
  ).first();
  t("endpoint afviser forespørgsel på fuldt ophold",
     fuldPost.status >= 400 && ude.n === 0 && fuldPlads.n === 1,
     JSON.stringify({ status: fuldPost.status, personer: ude.n, pladser: fuldPlads.n }));

  const intern = await tekst(await hent("/internt/ophold/"));
  t("intern oversigt har ét-tryks bekræft og afvis",
     intern.includes("Bekræft") && intern.includes("Afvis") && intern.includes("Anna Ny"));
  const sagApril = await tekst(await hent(`/internt/ophold/${april.id}`));
  t("siden har bekræft og afvis pr. person",
     sagApril.includes("Bekræft") && sagApril.includes("Afvis"));

  mails.length = 0;
  const bekraeft = annaPlads ? await hent(`/internt/ophold/${april.id}/plads/${annaPlads.id}/status`, {
    method: "POST",
    body: new URLSearchParams({ status: "bekræftet" }),
  }) : { status: 0 };
  t("bekræft omdirigerer", bekraeft.status === 303, bekraeft.status);
  const bekraeftMail = mails.find((m) => m.to === "anna.ny@example.com");
  t("bekræftelsesmail har det man skal bruge for at møde op",
     Boolean(bekraeftMail) &&
     /færge|Stigsnæs/i.test(bekraeftMail.text) &&
     /sovepose|sengetøj|have med/i.test(bekraeftMail.text) &&
     /seng|mad|sauna|inkluderet/i.test(bekraeftMail.text),
     bekraeftMail?.text?.slice(0, 400));

  const gammelSink = env.mailSink;
  env.mailSink = async () => { throw new Error("Resend svarede 500: test-fejl"); };
  const mailFejl = await hent(`/sporene/forespørg/${april.id}`, {
    method: "POST",
    body: new URLSearchParams({ navn: "Bo Fejl", mail: "bo.fejl@example.com" }),
  });
  env.mailSink = gammelSink;
  const bo = await db.prepare(
    `SELECT * FROM people WHERE lower(mail) = 'bo.fejl@example.com'`
  ).first();
  const boPlads = bo ? await db.prepare(
    `SELECT * FROM pladser WHERE ophold_id = ?1 AND person_id = ?2`
  ).bind(april.id, bo.id).first() : null;
  const internFejl = await tekst(await hent("/internt/ophold/"));
  const internSagFejl = await tekst(await hent(`/internt/ophold/${april.id}`));
  t("mailfejl gemmer stadig pladsen",
     mailFejl.status === 200 && boPlads?.status === "forespurgt",
     JSON.stringify({ status: mailFejl.status, plads: boPlads }));
  t("mailfejl er synlig på /internt/ophold",
     /Resend svarede 500|mailfejl|mail fejlede|ikke sendt/i.test(internFejl) ||
     /Resend svarede 500|mailfejl|mail fejlede|ikke sendt/i.test(internSagFejl),
     internSagFejl.includes("Bo Fejl") ? "Bo vises, men fejlen mangler" : internFejl.slice(0, 200));

  const udenAccess = { ...env, LOKAL_TEST: undefined };
  t("forespørgsel er offentlig",
     (await worker.fetch(new Request(BASE + `/sporene/forespørg/${april.id}`), udenAccess, {})).status === 200);

  mails.length = 0;
  const jarMit = new Jar();
  await jarMit.hent("/mit");
  await jarMit.hent("/mit/login", {
    method: "POST",
    body: new URLSearchParams({ mail: "steven@bygmedai.dk" }),
  });
  const magic = mails[0];
  const magicUrl = linkIMail(magic);
  await jarMit.hent(magicUrl ? stiFraUrl(magicUrl) : "/mit/link/mangler");
  const indeForm = await tekst(await jarMit.hent(`/sporene/forespørg/${april.id}`));
  t("logget ind via /mit: navn og mail er kendt",
     indeForm.includes("Steven Wensley") && indeForm.includes("steven@bygmedai.dk") &&
     !/<input[^>]*name="navn"[^>]*required/i.test(indeForm),
     indeForm.slice(0, 500));
  t("session-cookie gælder på hele sitet, så /sporene kan se den",
     /path=\//i.test(jarMit.c.vh_session?.linje || "") &&
     !/path=\/mit/i.test(jarMit.c.vh_session?.linje || ""),
     jarMit.c.vh_session?.linje);

  const sider = await import("../src/ophold-sider.js");
  const { ukendteKlasser, farverUdenforPalet } = await import("../src/kontrakt.js");
  const css = readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8");
  t("C2-fladen eksporterer formular og kvittering",
     typeof sider.sporeneForesporgSide === "function" && typeof sider.sporeneTakSide === "function");
  const c2Html = (typeof sider.sporeneForesporgSide === "function" && typeof sider.sporeneTakSide === "function") ? [
    sider.opholdOversigt({
      bruger: { navn: "x" },
      liste: [],
      typer: [{ id: "ot-x", navn: "x" }],
      forespurgte: [{
        id: "pl-x", ophold_id: "op-x", person_navn: "A", person_mail: "a@b.dk",
        type_navn: "x", start_dato: "2027-01-01", slut_dato: "2027-01-03", mail_fejl: "x",
      }],
    }),
    sider.opholdSide({
      bruger: { navn: "x" },
      o: {
        id: "op-x", type_navn: "x", start_dato: "2027-01-01", slut_dato: "2027-01-03",
        status: "åben", kapacitet: 2, optaget: 0, hele_stedet: 1, pris: 850, pris_fra: 850, note: "",
        pladser: [{ id: "pl-x", person_navn: "A", person_mail: "a@b.dk", status: "forespurgt", pris: null, mail_fejl: "x" }],
      },
      personer: [],
    }),
    sider.sporeneForesporgSide({
      o: { id: "op-x", type_navn: "x", start_dato: "2027-01-01", slut_dato: "2027-01-03", status: "åben" },
      person: null,
    }),
    sider.sporeneTakSide({
      o: { type_navn: "x", start_dato: "2027-01-01", slut_dato: "2027-01-03" },
      person: { navn: "A" },
    }),
  ].join("\n") : "";
  const ukendtC2 = ukendteKlasser(c2Html, css);
  t("C2-fladen bruger kun klasser fra vh.css", ukendtC2.length === 0, ukendtC2.join(", "));
  const farverC2 = farverUdenforPalet(c2Html, css);
  t("C2-fladen indfører ingen farve uden for paletten", farverC2.ok, JSON.stringify(farverC2));
}

console.log("\n25 · År-0-kalender 2027 (syv lukkede uger + åbne datoer)");
{
  const db = env.FONDE_DB;
  const lukkede = (await db.prepare(`
    SELECT o.id, o.start_dato, o.slut_dato, o.status, t.spor, t.hele_stedet
      FROM ophold o JOIN opholdstyper t ON t.id = o.type_id
     WHERE t.spor = 'lukket' AND o.status = 'lukket'
     ORDER BY o.start_dato
  `).all()).results;
  t("syv lukkede uger ligger i kalenderen", lukkede.length === 7, JSON.stringify(lukkede.map((o) => o.id)));
  t("lukkede uger bruger ot-lukket og hele_stedet",
     lukkede.every((o) => o.spor === "lukket" && o.hele_stedet === 1 && o.status === "lukket"));

  const uger = lukkede.map((o) => o.start_dato);
  t("ugerne er spredt, ikke klemt i januar",
     uger[0] === "2027-02-08" && uger[6] === "2027-12-20" &&
     new Set(uger.map((d) => d.slice(5, 7))).size >= 6,
     uger.join(", "));

  const overlapLukket = await hent("/internt/ophold/opret", {
    method: "POST",
    body: new URLSearchParams({
      type_id: "ot-mandegrupper",
      start_dato: "2027-02-10",
      slut_dato: "2027-02-12",
      kapacitet: "15",
      status: "åben",
    }),
  });
  const overlapLukketLoc = decodeURIComponent(overlapLukket.headers.get("Location") || "");
  t("hele_stedet lukket uge nægter et andet beboende ophold",
     overlapLukketLoc.includes("hele stedet er optaget"),
     overlapLukketLoc);
  const smuglet = await db.prepare(
    `SELECT COUNT(*) n FROM ophold WHERE start_dato = '2027-02-10' AND type_id = 'ot-mandegrupper'`
  ).first();
  t("det overlappinge ophold blev ikke gemt", smuglet?.n === 0, JSON.stringify(smuglet));

  const aabne = (await db.prepare(`
    SELECT o.id, o.start_dato, t.spor, o.status, COALESCE(o.pris, t.pris_fra) AS vis_pris
      FROM ophold o JOIN opholdstyper t ON t.id = o.type_id
     WHERE o.status IN ('åben','fuld') AND t.spor != 'lukket'
     ORDER BY o.start_dato
  `).all()).results;
  const mande = aabne.filter((o) => o.spor === "mandegrupper" && o.start_dato.startsWith("2027-"));
  t("mindst tre åbne mandeweekender er seedet", mande.length >= 3, JSON.stringify(mande.map((o) => o.id)));
  t("en mandeweekend bærer 850 kr.", mande.some((o) => o.vis_pris === 850));
  t("festival- og retreat-pladsholdere er åbne",
     aabne.some((o) => o.spor === "festival") && aabne.some((o) => o.spor === "retreats"),
     JSON.stringify(aabne.map((o) => o.spor)));

  const htmlSporene = await tekst(await hent("/sporene"));
  t("/sporene viser ikke længere den tomme kalender",
     !/ingen datoer i kalenderen endnu/i.test(htmlSporene), htmlSporene.slice(0, 400));
  t("/sporene HTML viser lukkede uger",
     /februar/i.test(htmlSporene) && /december/i.test(htmlSporene) &&
     !/når ugerne er sat/i.test(htmlSporene),
     htmlSporene.match(/Syv uger[\s\S]{0,400}/)?.[0]);
  t("/sporene HTML viser mindst én åben dato",
     /14\.|14-|maj|oktober|december/i.test(htmlSporene) && htmlSporene.includes("850"),
     htmlSporene.match(/Mandegrupper[\s\S]{0,500}/)?.[0]);

  const jsonSporene = await worker.fetch(new Request(BASE + "/sporene", {
    headers: { accept: "application/json" },
  }), env, {});
  const jsonKrop = await tekst(jsonSporene);
  t("/sporene JSON-kald viser stadig lukket og åben dato i HTML",
     jsonSporene.status === 200 && /februar/i.test(jsonKrop) && /850/.test(jsonKrop),
     jsonSporene.status);
}

console.log("\n26 · Brevet på /bliv-en-del lander i systemet (BYG-558 B1)");
{
  const db = env.FONDE_DB;
  const gaaet = String(Date.now() - 10000);

  const get = await hent("/bliv-en-del/skriv");
  t("GET på /bliv-en-del/skriv sendes tilbage til formularen",
     get.status === 303 && /\/bliv-en-del/.test(get.headers.get("location") || ""), get.status);

  mails.length = 0;
  const tomt = await hent("/bliv-en-del/skriv", {
    method: "POST", body: new URLSearchParams({ navn: "", mail: "x", brevet: "", t: gaaet }),
  });
  t("tomt brev afvises med 400 og ingen mail", tomt.status === 400 && mails.length === 0, tomt.status);
  const kort = await hent("/bliv-en-del/skriv", {
    method: "POST", body: new URLSearchParams({ navn: "Kort Karl", mail: "karl@example.com", brevet: "Hej", t: gaaet }),
  });
  t("for kort brev afvises", kort.status === 400 && /for kort/i.test(await tekst(kort)), kort.status);

  const robot = await hent("/bliv-en-del/skriv", {
    method: "POST", body: new URLSearchParams({
      navn: "Robot", mail: "robot@example.com", brevet: "Jeg er en robot og skriver meget hurtigt.", website: "http://spam", t: gaaet,
    }),
  });
  t("honningkrukke: udfyldt skjult felt giver tak-side men intet brev og ingen mail",
     robot.status === 200 && mails.length === 0 &&
     !(await db.prepare(`SELECT 1 FROM breve WHERE mail = 'robot@example.com'`).first()),
     robot.status);
  const hurtig = await hent("/bliv-en-del/skriv", {
    method: "POST", body: new URLSearchParams({
      navn: "Hurtig Hans", mail: "hans@example.com", brevet: "Skrevet på under et sekund, det er ikke et menneske.", t: String(Date.now()),
    }),
  });
  t("under tre sekunder afvises", hurtig.status === 400 && mails.length === 0, hurtig.status);

  const brevTekst = "Jeg hedder Mette, er 41 og bor i Slagelse. Jeg har læst om Agersø og vil gerne høre mere om prøveaftalen.";
  const ok1 = await hent("/bliv-en-del/skriv", {
    method: "POST", body: new URLSearchParams({ navn: "Mette Ny", mail: "mette.ny@example.com", brevet: brevTekst, t: gaaet }),
  });
  const ok1Html = await tekst(ok1);
  t("rigtigt brev giver tak-side", ok1.status === 200 && /tak for dit brev/i.test(ok1Html) && /7 dage/.test(ok1Html), ok1.status);
  const mette = await db.prepare(`SELECT * FROM people WHERE lower(mail) = 'mette.ny@example.com'`).first();
  t("afsenderen oprettes som person", Boolean(mette?.id) && mette.navn === "Mette Ny", JSON.stringify(mette));
  const brev = await db.prepare(`SELECT * FROM breve WHERE person_id = ?1`).bind(mette?.id).first();
  t("brevet ligger i D1 med status nyt", brev?.status === "nyt" && brev.tekst === brevTekst && brev.mail_fejl == null, JSON.stringify(brev));
  t("brevet er sendt til os med reply-to afsender",
     mails.some((m) => m.to === "laiydeh@gmail.com" && m.reply_to === "mette.ny@example.com" && m.text.includes(brevTekst)),
     JSON.stringify(mails.map((m) => ({ to: m.to, subject: m.subject }))));
  t("afsenderen får kvittering",
     mails.some((m) => m.to === "mette.ny@example.com" && /vi har dit brev/i.test(m.subject)),
     JSON.stringify(mails.map((m) => m.to)));
  t("tak-siden bruger kun klasser fra vh.css", (await import("../src/kontrakt.js")).ukendteKlasser(ok1Html,
     readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8")).length === 0);

  // Uden JS: t mangler — brevet skal stadig gå igennem.
  mails.length = 0;
  const udenJs = await hent("/bliv-en-del/skriv", {
    method: "POST", body: new URLSearchParams({ navn: "Uden Js", mail: "udenjs@example.com", brevet: "Jeg har slået JavaScript fra og skriver alligevel et rigtigt brev." }),
  });
  t("uden tidsstempel går brevet igennem", udenJs.status === 200 && mails.length === 2, udenJs.status);

  // Mailfejl bliver synlig, brevet gemmes alligevel.
  const gammelSink = env.mailSink;
  env.mailSink = async () => { throw new Error("Resend nede"); };
  const fejlet = await hent("/bliv-en-del/skriv", {
    method: "POST", body: new URLSearchParams({ navn: "Fejl Frida", mail: "frida@example.com", brevet: "Mit brev skal gemmes, selv om mailen fejler undervejs.", t: gaaet }),
  });
  env.mailSink = gammelSink;
  const frida = await db.prepare(`SELECT * FROM breve WHERE mail = 'frida@example.com'`).first();
  t("mailfejl: brevet gemmes og fejlen står på brevet",
     fejlet.status === 200 && frida?.status === "nyt" && /Resend nede/.test(frida.mail_fejl || ""), JSON.stringify(frida));

  // Intern liste bag identitet.
  const listeUden = await worker.fetch(new Request("http://vendhjem.dk/internt/breve"), { ...env, LOKAL_TEST: "0" }, {});
  t("/internt/breve uden identitet er 401", listeUden.status === 401, listeUden.status);
  const liste = await hent("/internt/breve");
  const listeHtml = await tekst(liste);
  t("/internt/breve viser brevene", liste.status === 200 && listeHtml.includes("Mette Ny") && listeHtml.includes(brevTekst), liste.status);
  t("listen viser mailfejlen på Fridas brev", /Resend nede/.test(listeHtml));
  // Siden lover svar inden 7 dage. Et brev, der har ventet 8, skal sige det selv.
  const forOtteDage = new Date(Date.now() - 8 * 86400000).toISOString();
  await db.prepare(`INSERT INTO breve (id, person_id, navn, mail, tekst, status, oprettet) VALUES ('brev_gammel', ?1, 'Gamle Gorm', 'gorm@example.com', 'Jeg skrev for otte dage siden og har ikke hørt noget endnu.', 'nyt', ?2)`)
    .bind(mette.id, forOtteDage).run();
  const listeGammel = await tekst(await hent("/internt/breve"));
  t("et ubesvaret brev på 8 dage markeres som ventende", /har ventet 8 dage/.test(listeGammel) && /Gamle Gorm/.test(listeGammel));
  t("et nyt brev fra i dag markeres ikke som ventende", !/Mette Ny[\s\S]{0,600}har ventet/.test(listeGammel));
  t("listen har Breve i navigationen", /href="\/internt\/breve"[^>]*aria-current="page"/.test(listeHtml));
  const kontraktBreve = (await import("../src/kontrakt.js")).ukendteKlasser(listeHtml,
     readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8"));
  t("/internt/breve bruger kun klasser fra vh.css", kontraktBreve.length === 0, kontraktBreve.join(", "));

  const skift = await hent(`/internt/breve/${brev.id}/status`, {
    method: "POST", body: new URLSearchParams({ status: "besvaret" }),
  });
  const efter = await db.prepare(`SELECT * FROM breve WHERE id = ?1`).bind(brev.id).first();
  t("markér besvaret sætter status og tidspunkt", skift.status === 303 && efter.status === "besvaret" && Boolean(efter.besvaret), JSON.stringify(efter));
  const tilbage = await hent(`/internt/breve/${brev.id}/status`, {
    method: "POST", body: new URLSearchParams({ status: "nyt" }),
  });
  const igen = await db.prepare(`SELECT * FROM breve WHERE id = ?1`).bind(brev.id).first();
  t("markér nyt fjerner tidspunktet", tilbage.status === 303 && igen.status === "nyt" && igen.besvaret == null);
}

console.log("\n27 · Fotos paa den LEVENDE /sporene (ikke den statiske fil)");
{
  // /sporene serveres af Workeren fra D1. sporene.html er kun noedudgangen.
  // 18.09.2026 laa fotoene i den statiske fil og ALDRIG paa den levende side,
  // fordi de blev lagt ét sted og maalt et andet. Steven fandt det.
  const html = await tekst(await hent("/sporene"));
  const slugs = [...html.matchAll(/images\/sted\/([a-z0-9-]+?)(?:-s)?\.(?:webp|avif)/g)].map((m) => m[1]);
  const unikke = [...new Set(slugs)];
  t("den levende /sporene har mindst tre fotos", unikke.length >= 3, unikke.join(", "));
  t("fotoene kommer fra det genererede modul, ikke fra haanden",
     html.includes('type="image/avif"') && html.includes('type="image/webp"'));
  const imgs = html.match(/<img [^>]*>/g) || [];
  t("alle <img> paa /sporene har en alt-tekst der siger noget",
     imgs.length > 0 && imgs.every((i) => /alt="[^"]{10,}"/.test(i)), imgs.length + " billeder");
  t("staaende fotos har et fokuspunkt, saa de ikke beskaeres til himmel",
     html.includes("object-position:"), "ingen object-position");

  const { FOTO, ALT } = await import("../src/fotos.js");
  t("hvert foto i modulet har baade maal og alt-tekst",
     Object.keys(FOTO).every((k) => ALT[k] && FOTO[k].w > 0 && FOTO[k].h > 0),
     Object.keys(FOTO).filter((k) => !ALT[k]).join(", "));
}

console.log("\n28 · Stigen har én kilde (BYG-576)");
{
  const kilde = JSON.parse(readFileSync(new URL("../../stigen.json", import.meta.url), "utf8")).lag;
  const { LAG } = await import("../src/stigen.js");
  t("stigen.js er genereret fra stigen.json", JSON.stringify(LAG) === JSON.stringify(kilde));
  t("tre lag med navn, timer, giver, får og vej ind",
     kilde.length === 3 && kilde.every((l) => l.navn && l.timer && l.giver && l.faar && l.vej),
     kilde.map((l) => l.navn).join(", "));
  const side = readFileSync(new URL("../../bliv-en-del.html", import.meta.url), "utf8");
  t("hvert lags timetal staar paa /bliv-en-del, saa kilden og siden ikke kan drive",
     kilde.every((l) => side.includes(l.timer) && side.includes(l.navn)),
     kilde.filter((l) => !side.includes(l.timer)).map((l) => l.navn).join(", "));
  t("ingen «altid», «aldrig» eller «hver gang» i stigen",
     !/\b(altid|aldrig|hver gang)\b/i.test(JSON.stringify(kilde)));
}

console.log("\n29 · Timer, aftale og appen på /mit (BYG-569 H1)");
{
  const db = env.FONDE_DB;
  const css = readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8");
  const { ukendteKlasser, farverUdenforPalet } = await import("../src/kontrakt.js");

  // Log ind som Steven, som i afsnit 13.
  mails.length = 0;
  const jar = new Jar();
  await jar.hent("/mit");
  await jar.hent("/mit/login", { method: "POST", body: new URLSearchParams({ mail: "steven@bygmedai.dk" }) });
  const lenke = linkIMail(mails[0]);
  await jar.hent(lenke ? stiFraUrl(lenke) : "/mit/link/x");

  const nu0 = await tekst(await jar.hent("/mit"));
  t("Nu viser aftalen fra migrationen", /Bærer/.test(nu0) && /200 timer om året/.test(nu0), nu0.slice(0, 200));
  t("Nu har de tre faner", /href="\/mit"/.test(nu0) && /href="\/mit\/skriv"/.test(nu0) && /href="\/mit\/overblik"/.test(nu0));
  t("appen kan lægges på hjemmeskærmen", /rel="manifest" href="\/assets\/mit\.webmanifest"/.test(nu0) && /mit-sw\.js/.test(nu0));
  t("Nu bruger kun klasser fra vh.css", ukendteKlasser(nu0, css).length === 0, ukendteKlasser(nu0, css).join(", "));

  // Skriv: en rigtig dag.
  const iforgaars = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const r1 = await jar.hent("/mit/timer", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ hvad: "Ryddede op i laden og kørte to læs på genbrugspladsen", timer: "5", dato: iforgaars }),
  });
  const j1 = await r1.json();
  t("en dag kan skrives ind", r1.status === 200 && j1.ok === true, JSON.stringify(j1));

  const linje = await db.prepare(`SELECT * FROM timer WHERE id = ?1`).bind(j1.id).first();
  t("linjen bærer sit eget grundlag og lag fra aftalen",
     linje.grundlag === "frivillig" && linje.lag === "baerer" && linje.aftale_id === "a-steven",
     JSON.stringify(linje));
  t("linjen står på den dato der blev skrevet", linje.dato === iforgaars && linje.timer === 5, linje.dato);

  // Aftalen kan genforhandles UDEN at gamle linjer skrives om. Fundamentets regel.
  await db.prepare(`UPDATE aftaler SET grundlag = 'betalt', lag = 'med' WHERE id = 'a-steven'`).run();
  const efter = await db.prepare(`SELECT * FROM timer WHERE id = ?1`).bind(j1.id).first();
  t("en ændret aftale skriver IKKE gamle timer om",
     efter.grundlag === "frivillig" && efter.lag === "baerer",
     `${efter.grundlag}/${efter.lag}`);
  await db.prepare(`UPDATE aftaler SET grundlag = 'frivillig', lag = 'baerer' WHERE id = 'a-steven'`).run();

  // Afvisninger — hver med sin egen besked, ikke én generisk fejl.
  const tom = await jar.hent("/mit/timer", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ hvad: "", timer: "", dato: iforgaars }),
  });
  t("tom linje afvises med 400", tom.status === 400, tom.status);
  const forMange = await jar.hent("/mit/timer", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ hvad: "Arbejdede i døgndrift", timer: "20", dato: iforgaars }),
  });
  t("over 16 timer på én dag afvises", forMange.status === 400 && /del den op/i.test(JSON.stringify(await forMange.json())), forMange.status);
  const imorgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const frem = await jar.hent("/mit/timer", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ hvad: "Noget jeg har tænkt mig at lave", timer: "3", dato: imorgen }),
  });
  t("en dag i fremtiden afvises", frem.status === 400, frem.status);

  const uden = await worker.fetch(new Request("http://vendhjem.dk/mit/timer", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  }), env, {});
  t("timer kan ikke skrives uden login", uden.status === 401, uden.status);

  // Overblik.
  const ov = await tekst(await jar.hent("/mit/overblik"));
  t("Overblik viser linjen igen", /Ryddede op i laden/.test(ov));
  t("Overblik måler mod det aftalte", /af 200 aftalte timer/.test(ov), ov.slice(0, 200));
  t("Overblik siger højt at der ikke er en rangliste", /ikke, hvem der har lagt hvad/.test(ov));
  t("Overblik holder paletten", farverUdenforPalet(ov, css).ok, JSON.stringify(farverUdenforPalet(ov, css)));
  t("Overblik bruger kun klasser fra vh.css", ukendteKlasser(ov, css).length === 0, ukendteKlasser(ov, css).join(", "));

  // Fællestallet tæller alle, men nævner ingen ved navn.
  await db.prepare(
    `INSERT INTO timer (id, person_id, dato, timer, hvad, grundlag, lag, oprettet)
     VALUES ('t-lai-1', 'p-lai', ?1, 6, 'Malede sovesalen', 'frivillig', 'baerer', ?2)`
  ).bind(iforgaars, new Date().toISOString()).run();
  const ov2 = await tekst(await jar.hent("/mit/overblik"));
  t("stedets total tæller begge, uden at nævne hvem", /2 mennesker/.test(ov2) && !/Lai Yde/.test(ov2), ov2.slice(0, 200));

  // Uden login er fanerne ikke en genvej udenom døren.
  const udenLogin = await worker.fetch(new Request("http://vendhjem.dk/mit/overblik"), env, {});
  t("/mit/overblik uden login sender til login", udenLogin.status === 303, udenLogin.status);

  // Appens filer findes, og køen har samme nøgle begge steder.
  const rod = new URL("../../", import.meta.url);
  const man = JSON.parse(readFileSync(new URL("assets/mit.webmanifest", rod), "utf8"));
  t("manifestet starter i appen og bliver i den", man.start_url === "/mit" && man.scope === "/mit" && man.display === "standalone");
  t("manifestet har et maskable ikon", man.icons.some((i) => i.purpose === "maskable"));
  for (const i of man.icons) {
    t(`ikonet ${i.src} findes`, existsSync(new URL(i.src.replace(/^\//, ""), rod)));
  }
  const sw = readFileSync(new URL("mit-sw.js", rod), "utf8");
  const offline = readFileSync(new URL("mit-offline.html", rod), "utf8");
  t("service workeren cacher ALDRIG en personlig /mit-side",
     !/["']\/mit["']/.test(sw) && /mode === "navigate"/.test(sw));
  // En rettelse i stilarket skal vise sig FØRSTE gang appen åbnes, ikke anden.
  t("stilarket hentes fra nettet først, så en udrulning ses med det samme",
     /var FRISK = \[OFFLINE, "\/assets\/vh\.css"\]/.test(sw) &&
     /FRISK\.indexOf\(url\.pathname\) !== -1[\s\S]{0,120}fetch\(req\)/.test(sw));
  t("skrifter og ikoner bliver i cachen — de ændrer sig ikke",
     /var FAST = \[/.test(sw) && /lora-var\.woff2/.test(sw.slice(sw.indexOf("var FAST"))));
  t("offline-siden er den, service workeren falder tilbage på", /var OFFLINE = "\/mit-offline"/.test(sw));
  t("køen bruger samme nøgle i appen og på offline-siden",
     /vh-timer-koe/.test(offline) && /vh-timer-koe/.test(readFileSync(new URL("vh-worker/src/mit.js", rod), "utf8")));
  t("offline-siden er noindex", /noindex/.test(offline));
  t("offline-siden bruger kun klasser fra vh.css", ukendteKlasser(offline, css).length === 0, ukendteKlasser(offline, css).join(", "));
}

console.log("\n30 · Månedlig sikkerhedskopi af D1 til R2");
{
  const { lavKopi, kopiNavn, koerSikkerhedskopi } = await import("../src/sikkerhedskopi.js");
  const kopi = await lavKopi(env.FONDE_DB);
  t("kopien har alle tabeller med", kopi.tabeller.includes("people") && kopi.tabeller.includes("timer") && kopi.tabeller.includes("aftaler"));
  t("kopien har rigtige rækker i sig", kopi.data.people.length >= 3 && kopi.antal.people === kopi.data.people.length);
  t("kopien springer sqlite's egne tabeller over", !kopi.tabeller.some((n) => n.startsWith("sqlite_") || n.startsWith("_cf_")));
  t("filnavnet er en dato man kan læse", kopiNavn(new Date("2027-01-01T04:00:00Z")) === "sikkerhedskopi/2027-01-01.json");

  const r = await koerSikkerhedskopi(env, new Date("2027-01-01T04:00:00Z"));
  t("kørslen skriver filen i R2", r.ok && r.navn === "sikkerhedskopi/2027-01-01.json" && r.raekker > 0, JSON.stringify(r));
  const gemt = await env.FONDE_FILER.get("sikkerhedskopi/2027-01-01.json");
  const igen = JSON.parse(await gemt.text());
  t("filen kan læses igen som almindelig JSON", igen.database === "vendhjem-fonde" && igen.data.people.length >= 3);
}

console.log("\n31 · Et mislykket login er ikke længere usynligt (målt 18.09.2026)");
{
  const db = env.FONDE_DB;
  const SVAR = "Hvis adressen hører til nogen her, ligger der en mail nu.";
  // Baggrunden: Steven havde to personposter — én med rolle, én uden, oprettet
  // af brevformularen. Han skrev den uden rolle på telefonen, og siden svarede
  // «Tjek din mail» uden at der var nogen mail.
  await db.prepare(
    `INSERT INTO people (id, navn, mail, status, oprettet) VALUES ('p-dublet', 'Uden Rolle', 'udenrolle@example.com', 'aktiv', ?1)`
  ).bind(new Date().toISOString()).run();

  mails.length = 0;
  const jarU = new Jar();
  await jarU.hent("/mit");
  const svarUdenRolle = await tekst(await jarU.hent("/mit/login", {
    method: "POST", body: new URLSearchParams({ mail: "udenrolle@example.com" }),
  }));
  const jarF = new Jar();
  await jarF.hent("/mit");
  const svarUkendt = await tekst(await jarF.hent("/mit/login", {
    method: "POST", body: new URLSearchParams({ mail: "findes-slet-ikke@example.com" }),
  }));

  t("fladen siger stadig det samme til begge — medlemslisten kan ikke gættes",
     svarUdenRolle.includes(SVAR) && svarUkendt.includes(SVAR));
  t("og der blev ikke sendt en eneste mail", mails.length === 0, mails.length);

  const { results: log } = await db.prepare(
    `SELECT mail, resultat, person_id FROM login_forsoeg ORDER BY oprettet DESC`
  ).all();
  t("men loggen kender forskel på kendt uden rolle og ukendt",
     log.some((r) => r.mail === "udenrolle@example.com" && r.resultat === "uden_rolle" && r.person_id === "p-dublet") &&
     log.some((r) => r.mail === "findes-slet-ikke@example.com" && r.resultat === "ukendt_mail" && r.person_id === null),
     JSON.stringify(log.slice(0, 3)));

  mails.length = 0;
  const jarOk = new Jar();
  await jarOk.hent("/mit");
  await jarOk.hent("/mit/login", { method: "POST", body: new URLSearchParams({ mail: "laiydeh@gmail.com" }) });
  const { results: efter } = await db.prepare(
    `SELECT resultat FROM login_forsoeg ORDER BY oprettet DESC LIMIT 1`
  ).all();
  t("et vellykket forsøg logges som sendt", efter[0].resultat === "sendt", JSON.stringify(efter));

  const liste = await tekst(await hent("/internt/breve"));
  t("/internt/breve viser dem, der ikke kom ind",
     /udenrolle@example\.com/.test(liste) && /Kendt person uden gyldig rolle/.test(liste));
  t("de vellykkede fylder ikke listen", !/laiydeh@gmail\.com[\s\S]{0,200}Ukendt adresse/.test(liste));
  const kontraktLogin = (await import("../src/kontrakt.js")).ukendteKlasser(liste,
     readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8"));
  t("afsnittet bruger kun klasser fra vh.css", kontraktLogin.length === 0, kontraktLogin.join(", "));

  // «Forkert browser» skal sige hvad man gør, ikke kun hvad der gik galt.
  mails.length = 0;
  const jarA2 = new Jar();
  await jarA2.hent("/mit");
  await jarA2.hent("/mit/login", { method: "POST", body: new URLSearchParams({ mail: "laiydeh@gmail.com" }) });
  const u2 = linkIMail(mails[0]);
  const jarB2 = new Jar();
  await jarB2.hent("/mit");
  const forkert = await tekst(await jarB2.hent(u2 ? stiFraUrl(u2) : "/mit/link/x"));
  t("forkert browser fortæller hvad man gør i stedet", /Bed om et nyt link herfra/.test(forkert), forkert.slice(0, 300));

  // Mail uden nøgle må ikke melde ok.
  const { sendMail } = await import("../src/mail.js");
  const svar = await sendMail({}, { to: "a@b.dk", subject: "x", text: "y" });
  t("sendMail melder IKKE ok, når der ingen nøgle er", svar.ok === false && svar.via === "ingen-noegle", JSON.stringify(svar));

  // Loggen er et driftsværktøj, ikke et arkiv.
  await db.prepare(
    `INSERT INTO login_forsoeg (id, mail, resultat, oprettet) VALUES ('gammel', 'for@gammel.dk', 'ukendt_mail', ?1)`
  ).bind(new Date(Date.now() - 100 * 86400000).toISOString()).run();
  await jarF.hent("/mit/login", { method: "POST", body: new URLSearchParams({ mail: "endnu-en@example.com" }) });
  const gammel = await db.prepare(`SELECT 1 FROM login_forsoeg WHERE id = 'gammel'`).first();
  t("forsøg ældre end 90 dage ryddes ved næste skrivning", !gammel);
}

console.log("\n32 · «Noget jeg så» — samme skærm som timerne");
{
  const db = env.FONDE_DB;
  const css = readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8");
  const { ukendteKlasser } = await import("../src/kontrakt.js");

  mails.length = 0;
  const jar = new Jar();
  await jar.hent("/mit");
  await jar.hent("/mit/login", { method: "POST", body: new URLSearchParams({ mail: "steven@bygmedai.dk" }) });
  const lenke = linkIMail(mails[0]);
  await jar.hent(lenke ? stiFraUrl(lenke) : "/mit/link/x");

  const skriv = await tekst(await jar.hent("/mit/skriv"));
  t("Skriv tilbyder begge slags", /value="timer"/.test(skriv) && /value="fund"/.test(skriv));
  t("begge felt-sæt står i HTML, så formularen virker uden JavaScript",
     /name="hvad_timer"/.test(skriv) && /name="hvad_fund"/.test(skriv) && /name="hvor"/.test(skriv));
  t("Skriv bruger kun klasser fra vh.css", ukendteKlasser(skriv, css).length === 0, ukendteKlasser(skriv, css).join(", "));

  const igaar = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const r = await jar.hent("/mit/skriv", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ slags: "fund", hvad: "Taget drypper over sovesalen, en spand står under", hvor: "Hovedhuset, østenden", haster: 1, dato: igaar }),
  });
  const j = await r.json();
  t("et fund kan skrives ind", r.status === 200 && j.ok === true, JSON.stringify(j));
  const f = await db.prepare(`SELECT * FROM fund WHERE id = ?1`).bind(j.id).first();
  t("fundet står med sted, hastegrad og status nyt",
     f.hvor === "Hovedhuset, østenden" && f.haster === 1 && f.status === "nyt" && f.dato === igaar,
     JSON.stringify(f));

  // Samme dør: timer uden slags går stadig til timerne.
  const rt = await jar.hent("/mit/skriv", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ slags: "timer", hvad: "Bar spande og gamle brædder ud af laden", timer: "3", dato: igaar }),
  });
  t("timer går stadig igennem den samme dør", (await rt.json()).ok === true, rt.status);
  const rGammel = await jar.hent("/mit/timer", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ hvad: "En linje fra en gammel kø på en telefon", timer: "2", dato: igaar }),
  });
  t("en linje fra den gamle kø kan stadig sendes", (await rGammel.json()).ok === true, rGammel.status);

  const tomtFund = await jar.hent("/mit/skriv", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ slags: "fund", hvad: "  ", dato: igaar }),
  });
  t("et tomt fund afvises", tomtFund.status === 400, tomtFund.status);
  const fremFund = await jar.hent("/mit/skriv", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ slags: "fund", hvad: "Noget jeg ser i morgen", dato: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }),
  });
  t("et fund i fremtiden afvises", fremFund.status === 400, fremFund.status);

  const ov = await tekst(await jar.hent("/mit/overblik"));
  t("Overblik viser dine egne fund", /Taget drypper over sovesalen/.test(ov) && /Hovedhuset, østenden/.test(ov));
  t("et hastende fund er mærket som sådan", /Haster/.test(ov));

  // Den interne liste.
  const liste = await tekst(await hent("/internt/fund"));
  t("/internt/fund viser fundet med hvem der så det", /Taget drypper/.test(liste) && /Steven Wensley/.test(liste));
  t("listen har Fund i navigationen", /href="\/internt\/fund"[^>]*aria-current="page"/.test(liste));
  const kontraktFund = ukendteKlasser(liste, css);
  t("/internt/fund bruger kun klasser fra vh.css", kontraktFund.length === 0, kontraktFund.join(", "));

  const udenLogin = await worker.fetch(new Request("http://vendhjem.dk/internt/fund"), { ...env, LOKAL_TEST: "0" }, {});
  t("/internt/fund uden identitet er 401", udenLogin.status === 401, udenLogin.status);

  // Status: nyt → set → klaret, og én vej tilbage.
  await hent(`/internt/fund/${j.id}/status`, { method: "POST", body: new URLSearchParams({ status: "set" }) });
  t("markér set virker", (await db.prepare(`SELECT status FROM fund WHERE id=?1`).bind(j.id).first()).status === "set");
  await hent(`/internt/fund/${j.id}/status`, { method: "POST", body: new URLSearchParams({ status: "klaret" }) });
  t("markér klaret virker", (await db.prepare(`SELECT status FROM fund WHERE id=?1`).bind(j.id).first()).status === "klaret");
  await hent(`/internt/fund/${j.id}/status`, { method: "POST", body: new URLSearchParams({ status: "noget-andet" }) });
  t("en ukendt status bliver ikke skrevet i databasen",
     (await db.prepare(`SELECT status FROM fund WHERE id=?1`).bind(j.id).first()).status === "nyt");

  // Rækkefølgen er listens pointe.
  const { fundListe } = await import("../src/db.js");
  await db.prepare(`INSERT INTO fund (id,person_id,dato,hvad,hvor,haster,status,oprettet) VALUES ('f-haster','p-lai',?1,'Stikkontakt hænger løs i køkkenet',NULL,1,'nyt',?2)`).bind(igaar, new Date().toISOString()).run();
  await db.prepare(`INSERT INTO fund (id,person_id,dato,hvad,hvor,haster,status,oprettet) VALUES ('f-klaret','p-lai',?1,'Pære skiftet i gangen',NULL,0,'klaret',?2)`).bind(igaar, new Date().toISOString()).run();
  const sorteret = await fundListe(db);
  t("det, der haster, ligger øverst og det klarede nederst",
     sorteret[0].id === "f-haster" && sorteret[sorteret.length - 1].status === "klaret",
     sorteret.map((x) => `${x.id}:${x.status}`).join(", "));
}

console.log("\n33 · Sitet lover ikke en side, der ikke er der");
{
  // Maalt 18.09.2026: /noter laa i foden paa hver eneste side, i sitemap og
  // paa forsiden — og der var ikke en eneste note paa den. Reglen herfra:
  // linket, sitemap-linjen og indekseringen foelger, om der faktisk er noget
  // at laese. Proeven laeser kilden og de byggede filer og sammenligner.
  const rod = new URL("../../", import.meta.url);
  const l = (f) => readFileSync(new URL(f, rod), "utf8");
  const { readdirSync } = await import("node:fs");
  const noter = readdirSync(new URL("noter-kilder", rod))
    .filter((f) => /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(f));
  const harNoter = noter.length > 0;

  const forside = l("index.html");
  const noterSide = l("noter.html");
  const sitemap = l("sitemap.xml");
  const rss = l("noter.xml");

  t("foden nævner ikke Noter — foden er stedet med det småt",
     !/<footer[\s\S]*?href="\/noter"[\s\S]*?<\/footer>/.test(forside));
  t(`forsiden linker til /noter kun når der ER noter (${noter.length} noter)`,
     /href="\/noter"/.test(forside) === harNoter);
  t("en tom /noter bliver ikke indekseret", /noindex/.test(noterSide) === !harNoter);
  t("men den beholder den offentlige menu, ikke den interne",
     /aria-label="Hovedmenu"/.test(noterSide) && !/aria-label="Internt"/.test(noterSide));
  t("/noter står i sitemap kun når der er noget at læse",
     /vendhjem\.dk\/noter</.test(sitemap) === harNoter);
  t("RSS har lige så mange poster, som der er noter",
     (rss.match(/<item>/g) || []).length === noter.length);
  t("sitemap er genereret, ikke håndholdt — alle offentlige sider står i den",
     ["", "fundamentet", "sporene", "permakultur", "maend", "bliv-en-del", "privatlivspolitik", "cookies"]
       .every((sti) => sitemap.includes(`https://vendhjem.dk/${sti}<`)));
}

console.log("\n34 · Natten flyttede derhen, hvor den kan læses");
{
  const css = readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8");
  const { ukendteKlasser, farverUdenforPalet } = await import("../src/kontrakt.js");
  const { NATTEN, GAAR_GALT } = await import("../src/aftalt.js");

  mails.length = 0;
  const jar = new Jar();
  await jar.hent("/mit");
  await jar.hent("/mit/login", { method: "POST", body: new URLSearchParams({ mail: "steven@bygmedai.dk" }) });
  const lenke = linkIMail(mails[0]);
  await jar.hent(lenke ? stiFraUrl(lenke) : "/mit/link/x");

  const side = await tekst(await jar.hent("/mit/aftalt"));
  t("fællesskabet kan læse nattens regler", /Én, der er vågen/.test(side) && /Et nej er et nej/.test(side));
  t("alle fem afsnit står der",
     NATTEN.every((n) => side.includes(n.sec)) && /Når noget går galt/.test(side),
     NATTEN.filter((n) => !side.includes(n.sec)).map((n) => n.sec).join(", "));
  t("nødnumrene står der, som man skal kunne slå dem op klokken tre",
     GAAR_GALT.every((l) => side.includes(l.slice(0, 40))));
  t("det, der stadig mangler, står som udestående — ikke som et gæt", /Udestår · Lai/.test(side));
  // Den skal PEGE paa det offentlige, ikke gentage det. En regel, der staar to
  // steder, bliver til to regler. «do-ocracy» som tre ord i et link er en
  // henvisning; fundamentets egne saetninger maa ikke staa her.
  t("den peger videre til det, der ER offentligt, i stedet for at gentage det",
     /href="\/fundamentet"/.test(side) && /href="\/bliv-en-del"/.test(side) &&
     !/Taget lægges ikke efter stemmetal/.test(side) &&
     !/tre måneders varsel/.test(side));
  t("«Nu» linker derhen", /href="\/mit\/aftalt"/.test(await tekst(await jar.hent("/mit"))));
  t("siden bruger kun klasser fra vh.css", ukendteKlasser(side, css).length === 0, ukendteKlasser(side, css).join(", "));
  t("siden holder paletten", farverUdenforPalet(side, css).ok);

  const uden = await worker.fetch(new Request("http://vendhjem.dk/mit/aftalt"), env, {});
  t("uden login sender den til døren, ikke til en 404", uden.status === 303, uden.status);

  // Teksten bor ét sted. To steder bliver til to regler.
  const rod = new URL("../../", import.meta.url);
  const { existsSync: findes } = await import("node:fs");
  t("den gamle interne side findes ikke mere", !findes(new URL("internt/natten.html", rod)));
  t("build.py bygger den ikke længere", !/internt\/natten/.test(readFileSync(new URL("build.py", rod), "utf8")));
  t("nav-internt.json har ikke et punkt, der peger på ingenting",
     !/internt\/natten/.test(readFileSync(new URL("nav-internt.json", rod), "utf8")));
  t("den gamle adresse sender videre i stedet for at dø",
     /\/internt\/natten \/mit\/aftalt 301/.test(readFileSync(new URL("_redirects", rod), "utf8")));
}

console.log("\n35 · .assetsignore er en deny-liste — og den skal rammes af en prøve");
{
  // Skrevet af Vilde og gennemgaaet af Haruki (#52). Se hans review dér for
  // falsifikationen: fjern stigen.json fra listen, og den bliver roed.
  //
  // HVORFOR DEN HER PROEVE FINDES
  //
  // [assets] directory = "../" uploader HELE repoet til Cloudflare. Den 17.09.2026
  // laa /.git/, /vh-worker/src/, wrangler.toml og build.py aabent paa vendhjem.dk,
  // fordi .assetsignore kun laa paa forken. Filen kom paa plads samme dag.
  //
  // Men et hegn ingen proeve rammer, er ubevist — og .assetsignore er en
  // DENY-liste: en ny fil i roden er offentlig, indtil nogen husker at skrive
  // den paa listen. Maalt 18.09.2026: /stigen.json og
  // /images/sted/_manifest.json svarede 200, fordi ingen huskede det.
  //
  // Proeven vender listen om. Hver fil i roden skal vaere BESLUTTET: enten staar
  // den paa OFFENTLIGT nedenfor, fordi den skal ud, eller ogsaa staar den paa
  // .assetsignore. En ny fil, der er ingen af delene, faelder porten — og saa er
  // spoergsmaalet «skal den her ud paa nettet?» stillet FOER udrulningen,
  // ikke bagefter.
  const rod = new URL("../../", import.meta.url);
  const { readdirSync } = await import("node:fs");

  // Filer i roden, der MED VILJE ligger offentligt. Tilfoej kun her, naar du
  // har svaret ja til: «maa en fremmed hente den her?»
  const OFFENTLIGT = new Set([
    // Byggede sider fra build.py
    "index.html", "fundamentet.html", "permakultur.html", "sporene.html",
    "maend.html", "bliv-en-del.html", "privatlivspolitik.html", "cookies.html",
    "noter.html", "404.html",
    // Appen paa telefonen — statiske med vilje, se «Faelden i navnet» i CLAUDE.md
    "mit-offline.html", "mit-sw.js",
    // Det nettet selv beder om
    "sitemap.xml", "noter.xml", "robots.txt",
    // Cloudflares egen konfiguration. Vilde satte dem paa listen med forbehold
    // («de ER offentlige i dag, og jeg har ladet dem vaere det»). Maalt af
    // Haruki 18.09.2026: /_headers og /_redirects svarer begge **404** — de
    // laeses af Cloudflare som konfiguration og serveres ikke.
    //
    // De skal derfor blive staaende HER og ikke flyttes til .assetsignore:
    // listen styrer, hvad der uploades, og en fil, der ikke uploades, kan
    // Cloudflare ikke laese. Flytter du dem, holder alle 301'erne op med at
    // virke. De er hverken offentlige eller ignorerede — de er platformens.
    "_headers", "_redirects",
  ]);

  const ignoreret = readdirSync(rod, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name === ".assetsignore")
    .length === 1
    ? readFileSync(new URL(".assetsignore", rod), "utf8")
        .split("\n").map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    : [];

  const daekket = (navn) => ignoreret.some((m) =>
    m === navn || (m.startsWith("*.") && navn.endsWith(m.slice(1))));

  const filerIRoden = readdirSync(rod, { withFileTypes: true })
    .filter((d) => d.isFile()).map((d) => d.name);

  const ubesluttede = filerIRoden.filter((f) => !OFFENTLIGT.has(f) && !daekket(f));

  t(".assetsignore findes overhovedet", ignoreret.length > 0);
  t("hver fil i roden er besluttet — offentlig med vilje eller paa .assetsignore",
     ubesluttede.length === 0,
     ubesluttede.length ? `ubesluttede: ${ubesluttede.join(", ")}` : "");

  // Negativt vidne. Uden det kan proeven bestaa, fordi den ikke maaler noget.
  t("og proeven bider: en opdigtet ny fil ville falde igennem",
     !OFFENTLIGT.has("hemmelig-ny-fil.json") && !daekket("hemmelig-ny-fil.json"));

  // De fire, der laa aabne. De skal blive paa listen.
  for (const f of ["build.py", "nav-internt.json", "stigen.json"]) {
    t(`${f} er lukket`, daekket(f));
  }
  t("vh-worker er lukket", ignoreret.includes("vh-worker"));
  t(".git er lukket", ignoreret.includes(".git"));

  // Maalt 18.09.2026: begge svarer 404 paa vendhjem.dk. Staar de en dag paa
  // .assetsignore, bliver de ikke uploadet, og redirects og headers falder ud.
  t("_headers og _redirects er platformens — hverken offentlige eller ignorerede",
     !daekket("_headers") && !daekket("_redirects") &&
     OFFENTLIGT.has("_headers") && OFFENTLIGT.has("_redirects"));
}

console.log("\n36 · Ingen gammel adresse peger ud i ingenting");
{
  // HVORFOR DEN HER PROEVE FINDES
  //
  // Maalt 18.09.2026 paa den levende flade:
  //   /blog.html        301 -> /          men /blog        404
  //   /integral.html    301 -> /fundamentet   men /integral    404
  //   /integral-typer.html  404            og /integral-typer 404
  //
  // _redirects pegede paa integral1.html … integral5.html og manifest.html —
  // seks filer, der aldrig har ligget i repoet — mens de fem, der FINDES
  // (integral-kvadranter, -linjer, -niveauer, -tilstande, -typer), ikke stod
  // der. Kortet var tegnet efter en aeldre navngivning end sitets egen.
  //
  // Cloudflare matcher paa den eksakte sti, saa `/blog` og `/blog.html` er to
  // adresser. Begge er blevet delt. Proeven kraever derfor begge former, og
  // den kraever at hver kilde peger paa noget, der findes — ellers er kortet
  // en paastand om et site, der ikke er her mere.
  const rod = new URL("../../", import.meta.url);
  const { readdirSync, existsSync: findes } = await import("node:fs");
  const linjer = readFileSync(new URL("_redirects", rod), "utf8")
    .split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const kilder = new Set(linjer.map((l) => l.split(/\s+/)[0]));

  // Sider build.py skriver, plus appens egne. De skal IKKE omdirigeres.
  const LEVENDE = new Set([
    "index.html", "fundamentet.html", "permakultur.html", "sporene.html",
    "maend.html", "bliv-en-del.html", "privatlivspolitik.html", "cookies.html",
    "noter.html", "404.html", "mit-offline.html",
  ]);

  const foraeldreloese = readdirSync(rod, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".html") && !LEVENDE.has(d.name))
    .map((d) => d.name);

  const uden = foraeldreloese.filter((f) =>
    !kilder.has("/" + f) || !kilder.has("/" + f.replace(/\.html$/, "")));
  t("hver foraeldreloes side har en adresse — i BEGGE former",
     uden.length === 0, uden.length ? `mangler: ${uden.join(", ")}` : "");

  const doede = [...kilder].filter((k) =>
    k.endsWith(".html") && !findes(new URL(k.slice(1), rod)));
  t("ingen linje peger paa en fil, der ikke findes",
     doede.length === 0, doede.length ? `doede kilder: ${doede.join(", ")}` : "");

  t("og proeven bider: en opdigtet gammel side ville mangle",
     !kilder.has("/noget-der-aldrig-fandtes.html"));

  // Natten. /internt/* fanges af Access foer denne fil, saa den offentlige
  // vej er den eneste, faellesskabet kan bruge.
  t("Natten har en offentlig vej, ikke kun en bag Access",
     kilder.has("/natten") && linjer.some((l) => /^\/natten\s+\/mit\/aftalt/.test(l)));

  t("ingen linje sender et sted hen, der selv omdirigerer",
     linjer.every((l) => {
       const maal = l.split(/\s+/)[1] || "";
       return !maal.startsWith("/") || !kilder.has(maal);
     }));
}

console.log("\n37 · Sikkerhedskopien kan udloeses, ses — og laeses tilbage");
{
  // HVORFOR DEN HER PROEVE FINDES
  //
  // Kopien blev bygget i #45 og var rigtigt bygget. Men maalt 18.09.2026:
  //   - cron stod til den 1. i maaneden, og Workeren blev udrullet den 18.,
  //     saa foerste kopi ville vaere skrevet 1. oktober. Nul kopier fandtes.
  //   - koerSikkerhedskopi kunne KUN kaldes af cron. Ingen kunne tage én nu.
  //   - ingen havde nogensinde laest en tilbage.
  //
  // Den sidste er den vaerste. En fil, ingen har proevet at gendanne fra, er
  // ikke en sikkerhedskopi — den er et haab med et filnavn. Proeven her tager
  // en rigtig kopi, bygger en TOM database af de samme migrationer, kykker
  // kopien ind i den med genskabSql, og sammenligner raekke for raekke.
  const { lavKopi, genskabSql, sidsteKopi, koerSikkerhedskopi, kopiNavn } =
    await import("../src/sikkerhedskopi.js");

  // --- Genskabelsen. Det er den, der betyder noget. ---
  const kopi = await lavKopi(env.FONDE_DB);
  const tom = lavD1(MIGRATIONER);
  tom._raw.exec(genskabSql(kopi));

  const tabellerMedIndhold = kopi.tabeller.filter((n) => (kopi.data[n] || []).length > 0);
  t("der ER noget at gendanne (ellers maaler proeven ingenting)",
     tabellerMedIndhold.length >= 3, `${tabellerMedIndhold.length} tabeller med raekker`);

  const afvigelser = [];
  for (const navn of kopi.tabeller) {
    const foer = JSON.stringify(kopi.data[navn] || []);
    const efter = JSON.stringify(tom._raw.prepare(`SELECT * FROM "${navn}"`).all());
    if (foer !== efter) afvigelser.push(navn);
  }
  t("en tom database fyldt af kopien er raekke for raekke den samme",
     afvigelser.length === 0, afvigelser.length ? `afviger: ${afvigelser.join(", ")}` : "");

  // Negativt vidne. Uden det kan de to ovenfor bestaa, fordi migrationerne
  // selv seeder en del — saa «ens» ville vaere sandt uden at gendanne noget.
  const tom2 = lavD1(MIGRATIONER);
  const forskelUdenGendannelse = kopi.tabeller.filter((navn) =>
    JSON.stringify(kopi.data[navn] || []) !==
    JSON.stringify(tom2._raw.prepare(`SELECT * FROM "${navn}"`).all()));
  t("og proeven bider: uden genskabelsen ER de to databaser forskellige",
     forskelUdenGendannelse.length > 0, `${forskelUdenGendannelse.length} tabeller afveg`);

  // --- Knappen bag Access ---
  const foerAntal = (await sidsteKopi(env)).antal;
  const svar = await hent("/internt/sikkerhedskopi/nu", { method: "POST" });
  t("knappen tager en kopi og sender tilbage til siden",
     svar.status === 303 && (svar.headers.get("Location") || "").startsWith("/internt/sikkerhedskopi"),
     `${svar.status} ${svar.headers.get("Location")}`);
  t("og der ligger en kopi mere end foer", (await sidsteKopi(env)).antal === foerAntal + 1);

  // --- Readbacket: kan vi SE at der findes en, uden at logge paa Cloudflare ---
  const k = await sidsteKopi(env);
  t("readbacket kender den nyeste kopis dato", k.ok && k.findes && /^\d{4}-\d{2}-\d{2}$/.test(k.nyeste), JSON.stringify(k));

  // Alderen maales paa en REN R2. Den delte har filer fra afsnit 30 med
  // opdigtede datoer, og en proeve, der maaler paa andres skrald, maaler ikke.
  const rentEnv = { FONDE_DB: env.FONDE_DB, FONDE_FILER: lavR2() };
  await koerSikkerhedskopi(rentEnv, new Date("2026-09-18T04:00:00Z"));
  const kr = await sidsteKopi(rentEnv, new Date("2026-09-20T09:00:00Z"));
  t("og hvor gammel den er i doegn", kr.alder_doegn === 2, String(kr.alder_doegn));
  t("filnavnet er datoen, ikke et loebenummer", kr.nyeste === "2026-09-18", kr.nyeste);

  const side37 = await tekst(await hent("/internt/sikkerhedskopi"));
  t("siden viser datoen, ikke bare at der findes noget", side37.includes("Nyeste kopi"));
  t("siden har knappen", /action="\/internt\/sikkerhedskopi\/nu"/.test(side37));
  t("og den skriver gendannelsesvejen ned, saa den ikke skal opfindes den dag",
     /genskabSql/.test(side37));
  // Denne var tom i foerste udgave: den strippede bygmedai-adresser og ledte
  // saa efter @. En tilfoejet mailadresse slap lige igennem. Nu maales der paa
  // det, der faktisk er farligt: raekker FRA databasen paa en side, hvis hele
  // formaal er at sige, at de findes — ikke hvad de indeholder.
  const enPerson = env.FONDE_DB._raw.prepare("SELECT navn, mail FROM people WHERE mail IS NOT NULL LIMIT 1").get();
  t("der ER en person at laekke (ellers maaler proeven ingenting)", Boolean(enPerson && enPerson.mail));
  t("siden naevner ingen mailadresse fra databasen",
     Boolean(enPerson) && !side37.includes(enPerson.mail), enPerson ? enPerson.mail : "");
  t("og intet navn fra databasen", Boolean(enPerson) && !side37.includes(enPerson.navn), enPerson ? enPerson.navn : "");
  t("siden indeholder overhovedet ingen @", !/@/.test(side37));

  // --- En tom R2 skal SIGE at den er tom, ikke se rask ud ---
  const tomR2 = await sidsteKopi({ FONDE_FILER: lavR2() });
  t("ingen kopier siger «der findes ingen», ikke «ok»", tomR2.ok === true && tomR2.findes === false);

  // --- Cron'en er daglig, ikke maanedlig ---
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  t("cron koerer hver nat, ikke den 1. i maaneden", /crons\s*=\s*\["0 4 \* \* \*"\]/.test(toml),
     (toml.match(/crons.*/) || [""])[0]);

  // --- Kopien maa aldrig kunne skrive i databasen ---
  const sql = genskabSql(kopi);
  // Den maa roere triggere — de skal ned, mens dataene gaar ind, og op igen
  // bagefter. Den maa ALDRIG roere en tabel eller en raekke, der ikke er
  // kopiens egen.
  // Triggernes EGEN tekst indeholder UPDATE — det er deres arbejde (fx
  // ophold_aabnes_fuld, der saetter status). Den maa ikke taelle med, saa vi
  // maaler paa det, genskabSql selv skriver: alt uden om trigger-kroppene.
  const udenTriggere = (kopi.triggere || [])
    .reduce((tekst, tr) => tekst.split(String(tr.sql).trim().replace(/;*$/, "")).join(""), sql);
  t("det, genskabelsen selv skriver, sletter ingen tabel og ingen raekke",
     !/\bDROP\s+TABLE\b/i.test(udenTriggere) && !/\bDELETE\s+FROM\b/i.test(udenTriggere) &&
     !/\bUPDATE\s+/i.test(udenTriggere) && !/\bALTER\s+/i.test(udenTriggere),
     (udenTriggere.match(/\b(DROP\s+TABLE|DELETE\s+FROM|UPDATE|ALTER)\b/i) || [""])[0]);
  t("og det eneste, den dropper, er triggere — som den selv saetter op igen",
     [...udenTriggere.matchAll(/\bDROP\s+(\w+)/gi)].every((m) => /trigger/i.test(m[1])));
  t("den saetter hegnene op igen, den tog ned",
     (kopi.triggere || []).length > 0 &&
     (kopi.triggere || []).every((tr) =>
       new RegExp(`DROP TRIGGER IF EXISTS "${tr.name}"`).test(sql) &&
       sql.includes(String(tr.sql).trim().replace(/;*$/, ""))),
     `${(kopi.triggere || []).length} triggere`);
  t("og den er tekst, ikke en handling — intet er skrevet nogen steder",
     typeof sql === "string" && sql.startsWith("PRAGMA foreign_keys = OFF;"));

  // --- Apostroffer og NULL. Den klassiske maade en kopi loeber i staa paa. ---
  const stikprov = lavD1(MIGRATIONER);
  stikprov._raw.exec(`INSERT INTO people (id, navn, mail, oprettet) VALUES ('t-1', 'O''Brien ''—'' test', NULL, '2026-09-18T00:00:00Z')`);
  const k2 = await lavKopi(stikprov);
  const tom3 = lavD1(MIGRATIONER);
  tom3._raw.exec(genskabSql(k2));
  const hentet = tom3._raw.prepare("SELECT navn, mail FROM people WHERE id = 't-1'").get();
  t("et navn med apostroffer overlever turen", hentet && hentet.navn === "O'Brien '—' test", JSON.stringify(hentet));
  t("og NULL bliver ved med at vaere NULL, ikke tom streng", hentet && hentet.mail === null);
}

console.log("\n38 · Alarmen: noget kan spoerge, uden at et menneske husker det");
{
  // HVORFOR DEN HER DOER FINDES VED SIDEN AF /internt/sikkerhedskopi
  //
  // Af de tre ting, der manglede efter #57, var den sidste: ingen siger til,
  // hvis den natlige koersel fejler. Siden bag Access svarer et menneske, der
  // spoerger. Den her svarer noget, der spoerger af sig selv.
  //
  // Et menneske, der skal huske at aabne en side for at opdage, at kopien er
  // holdt op med at blive taget, er ikke en alarm. Det er et haab.
  //
  // Statuskoden baerer svaret alene — 200 frisk, 503 gammel eller vaek — saa en
  // overvaagning kan rejse sig uden at forstaa JSON.

  const noegle = "test-sundhed-noegle";
  const dor = "http://vendhjem.dk/sundhed/sikkerhedskopi";
  const medNoegle = (init2 = {}) => new Request(dor, {
    ...init2, headers: { ...(init2.headers || {}), "X-VH-Sundhed": noegle },
  });

  // --- Uden noegle findes doeren ikke. Heller ikke med en forkert. ---
  const enUdenNoegle = await worker.fetch(new Request(dor), { ...env, SUNDHED_NOEGLE: noegle }, {});
  t("uden noegle svarer den 404 og roeber ikke at den findes", enUdenNoegle.status === 404, String(enUdenNoegle.status));

  const enForkert = await worker.fetch(
    new Request(dor, { headers: { "X-VH-Sundhed": "noget-andet" } }),
    { ...env, SUNDHED_NOEGLE: noegle }, {});
  t("en forkert noegle faar samme svar som ingen noegle", enForkert.status === 404, String(enForkert.status));

  const udenOpsat = await worker.fetch(medNoegle(), { ...env, SUNDHED_NOEGLE: undefined }, {});
  t("er noeglen ikke sat paa Workeren, er doeren heller ikke der", udenOpsat.status === 404, String(udenOpsat.status));

  // --- Ingen kopi overhovedet: det skal larme, ikke svare paent. ---
  const tomR2 = { ...env, FONDE_FILER: lavR2(), SUNDHED_NOEGLE: noegle };
  const ingen = await worker.fetch(medNoegle(), tomR2, {});
  const ingenKrop = await ingen.json();
  t("findes der ingen kopi, svarer den 503", ingen.status === 503, String(ingen.status));
  t("og siger det rent ud, ikke som en tom liste", ingenKrop.frisk === false && ingenKrop.findes === false,
     JSON.stringify(ingenKrop));

  // --- POST tager en nu. Til lige foer en migration. ---
  const tag = await worker.fetch(medNoegle({ method: "POST" }), tomR2, {});
  const tagKrop = await tag.json();
  t("POST tager en kopi med det samme", tag.status === 200 && tagKrop.ok === true, JSON.stringify(tagKrop));
  t("og fortaeller hvad der blev skrevet, saa svaret kan efterproeves",
     typeof tagKrop.navn === "string" && tagKrop.navn.startsWith("sikkerhedskopi/") && tagKrop.raekker > 0,
     JSON.stringify(tagKrop));

  // --- Og bagefter er den frisk. ---
  const efter = await worker.fetch(medNoegle(), tomR2, {});
  const efterKrop = await efter.json();
  t("umiddelbart efter er svaret 200 og frisk", efter.status === 200 && efterKrop.frisk === true,
     JSON.stringify(efterKrop));
  t("den siger hvor gammel den er, ikke bare at den findes", efterKrop.alder_doegn === 0,
     JSON.stringify(efterKrop));

  // --- En gammel kopi er det, alarmen er til for. ---
  // Negativt vidne: der ER en kopi. Den er bare fra i forgaars-forgaars.
  const gammelR2 = lavR2();
  await gammelR2.put("sikkerhedskopi/2026-09-10.json", JSON.stringify({ tabeller: [], antal: {}, data: {} }));
  const gammel = await worker.fetch(medNoegle(), { ...env, FONDE_FILER: gammelR2, SUNDHED_NOEGLE: noegle }, {});
  const gammelKrop = await gammel.json();
  t("en kopi, der er holdt op med at blive fornyet, svarer 503", gammel.status === 503, String(gammel.status));
  t("selv om den findes — det er alderen, der larmer", gammelKrop.findes === true && gammelKrop.frisk === false,
     JSON.stringify(gammelKrop));

  // --- Ingenting laekker. Samme regel som resten af /sundhed. ---
  const raat = JSON.stringify(gammelKrop) + JSON.stringify(efterKrop);
  t("svaret baerer tal og datoer, aldrig indhold", !/@/.test(raat) && !/navn"\s*:\s*"[A-ZÆØÅ]/.test(raat), raat.slice(0, 200));

  // --- Alt andet end GET og POST er en fejl, ikke en gaet. ---
  const slet = await worker.fetch(medNoegle({ method: "DELETE" }), tomR2, {});
  t("DELETE er ikke en maade at tage en kopi paa", slet.status === 405, String(slet.status));
}

console.log("\n39 · Readback-vaerktoejet til SQL-eksporten");
{
  // SQL-eksporten fra `wrangler d1 export` er den anden vej tilbage — den, et
  // menneske koerer i haanden den dag, databasen er vaek. Proeve 37 daekker
  // JSON-vejen; det her daekker, at vaerktoejet til den anden vej findes og
  // maaler det rigtige.
  //
  // Den vigtigste paastand: vaerktoejet skal hente sine forventede triggere fra
  // MIGRATIONERNE, ikke fra den fil, det undersoeger. Foerste udgave taelte
  // triggere i filen og triggere i databasen og sammenlignede de to — den var
  // groen, ogsaa da alle syv var klippet ud af eksporten, fordi begge tal gik
  // til nul. Falsificeret 18.09.2026. En kilde, der maaler sig selv, maaler intet.
  const vaerktoej = readFileSync(new URL("../../docs/laes-tilbage.mjs", import.meta.url), "utf8");
  t("vaerktoejet ligger i repoet", vaerktoej.length > 500);
  t("det henter de forventede triggere fra migrationerne, ikke fra filen",
     /migrations/.test(vaerktoej) && /readdirSync/.test(vaerktoej));
  t("det slaar fremmednoegler fra — ellers doer indlaesningen paa no such table",
     /enableForeignKeyConstraints:\s*false/.test(vaerktoej));
  t("det spoerger baade om fremmednoegler og helhed",
     /foreign_key_check/.test(vaerktoej) && /integrity_check/.test(vaerktoej));
  t("og det gaar i roedt, ikke bare skriver noget ud", /process\.exit\(1\)/.test(vaerktoej));

  const koereplan = readFileSync(new URL("../../docs/SIKKERHEDSKOPI.md", import.meta.url), "utf8");
  t("koereplanen findes", koereplan.length > 1000);
  t("den naevner fremmednoegle-faelden ved navn", /no such table: main\.people/.test(koereplan));
  t("den naevner trigger-faelden ved navn", /hele stedet er optaget/.test(koereplan));
  t("den siger hoejt hvad der STADIG ikke er gjort",
     /stadig ikke/i.test(koereplan) && /R2/.test(koereplan));
}

console.log("\n40 · Vagter: et tidspunkt med pladser (BYG-583)");
{
  // De seks acceptkriterier fra BYG-569, som aldrig blev proevet, fordi
  // vagterne aldrig blev bygget. Sagen blev lukket som Done alligevel.
  //
  // Reglerne er i SKEMAET, ikke i handleren — se 0015_vagter.sql. Proeven her
  // gaar gennem den rigtige flade, saa den ogsaa maaler, at handleren ikke
  // omgaar dem.

  const db = env.FONDE_DB;
  const css = readFileSync(new URL("../../assets/vh.css", import.meta.url), "utf8");
  const { ukendteKlasser } = await import("../src/kontrakt.js");
  const { opretVagt, skrivPaa, kommendeVagter, hvemStaarPaa, vagtTal, opretPerson } = await import("../src/db.js");
  const { laesVagt } = await import("../src/vagter-sider.js");
  const { TEKST } = await import("../src/tekst.js");

  const imorgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const steven = await hentPerson(db, "steven@bygmedai.dk");

  // --- 1 · En vagt kan oprettes og tilmeldes paa ét tryk hver vej. ---
  const jar = new Jar();
  mails.length = 0;
  await jar.hent("/mit");
  await jar.hent("/mit/login", { method: "POST", body: new URLSearchParams({ mail: "steven@bygmedai.dk" }) });
  const l = linkIMail(mails[0]);
  await jar.hent(l ? stiFraUrl(l) : "/mit/link/x");

  const kokken = await opretVagt(db, {
    hvad: "Køkken, aftensmad", dato: imorgen, fra: "16:00", til: "19:00",
    pladser: 2, hvor: "Hovedhuset", oprettet_af: steven.id,
  });

  const nuFoer = await tekst(await jar.hent("/mit"));
  t("vagten staar paa Nu, uden at man skal lede", /Køkken, aftensmad/.test(nuFoer));
  t("og siger hvor mange der mangler, i ord", /0 af 2 pladser/.test(nuFoer) && /mangler 2/.test(nuFoer),
     (nuFoer.match(/\d af \d pladser[^<]*/) || [""])[0]);
  t("Nu bruger stadig kun klasser fra vh.css", ukendteKlasser(nuFoer, css).length === 0,
     ukendteKlasser(nuFoer, css).join(", "));

  const paaSvar = await jar.hent(`/mit/vagter/${kokken.id}/paa`, { method: "POST" });
  t("ét tryk skriver dig paa", paaSvar.status === 303, String(paaSvar.status));
  t("og sender dig et sted hen, en genindlaesning ikke kan gentage",
     paaSvar.headers.get("Location") === "/mit/vagter", paaSvar.headers.get("Location"));

  const liste1 = await tekst(await jar.hent("/mit/vagter"));
  t("listen siger at du er paa", /Du er på/.test(liste1));
  t("og tilbyder vejen ud, ikke vejen ind igen", /vagter\/[^"]+\/af/.test(liste1) && !/vagter\/[^"]+\/paa/.test(liste1));

  // --- 2 · Dobbelt tilmelding. To tryk skal give samme tilstand som ét. ---
  await jar.hent(`/mit/vagter/${kokken.id}/paa`, { method: "POST" });
  const efterTo = await db.prepare(`SELECT COUNT(*) AS n FROM paa WHERE vagt_id = ?1`).bind(kokken.id).first();
  t("to tryk paa samme vagt giver én tilmelding, ikke to", efterTo.n === 1, String(efterTo.n));

  // --- 3 · Afmelding frigiver pladsen med det samme. ---
  const afSvar = await jar.hent(`/mit/vagter/${kokken.id}/af`, { method: "POST" });
  const efterAf = await db.prepare(`SELECT COUNT(*) AS n FROM paa WHERE vagt_id = ?1`).bind(kokken.id).first();
  t("ét tryk skriver dig af igen", afSvar.status === 303 && efterAf.n === 0, String(efterAf.n));
  const liste2 = await tekst(await jar.hent("/mit/vagter"));
  t("og pladsen er fri i samme oejeblik", /0 af 2 pladser/.test(liste2));

  // --- 4 · En fuld vagt afviser. Skemaet, ikke handleren. ---
  const a = await opretPerson(db, { navn: "Prøve A", mail: "proeve-a@vendhjem.dk" });
  const b = await opretPerson(db, { navn: "Prøve B", mail: "proeve-b@vendhjem.dk" });
  await skrivPaa(db, kokken.id, a.id);
  await skrivPaa(db, kokken.id, b.id);
  const fuld = await skrivPaa(db, kokken.id, steven.id);
  t("den tredje paa en vagt med to pladser bliver afvist", fuld.ok === false && fuld.grund === "fuld",
     JSON.stringify(fuld));

  const fuldSvar = await jar.hent(`/mit/vagter/${kokken.id}/paa`, { method: "POST" });
  t("og fladen siger det paa dansk i stedet for at fejle",
     fuldSvar.status === 303 && fuldSvar.headers.get("Location") === "/mit/vagter?m=fuld",
     fuldSvar.headers.get("Location"));
  const medBesked = await tekst(await jar.hent("/mit/vagter?m=fuld"));
  t("beskeden staar paa siden, ikke kun i adressen", /blev fuld, mens du kiggede/.test(medBesked));
  t("og en fuld vagt tilbyder ingen knap, man ikke kan bruge",
     /Fuld/.test(medBesked) && !new RegExp(`vagter/${kokken.id}/paa`).test(medBesked));

  // --- 5 · En vagt i fortiden kan ikke tilmeldes, men kan stadig ses. ---
  const gammel = await opretVagt(db, { hvad: "Gammel vagt", dato: "2020-01-01", pladser: 5, oprettet_af: steven.id });
  const fortid = await skrivPaa(db, gammel.id, steven.id);
  t("en vagt, der er gaaet, afviser tilmelding", fortid.ok === false && fortid.grund === "fortid",
     JSON.stringify(fortid));
  const stadigDer = await db.prepare(`SELECT hvad FROM vagter WHERE id = ?1`).bind(gammel.id).first();
  t("men vagten er der stadig — den blev ikke slettet", stadigDer.hvad === "Gammel vagt");
  const listeUdenFortid = await tekst(await jar.hent("/mit/vagter"));
  t("og den staar ikke og roder paa listen over det kommende", !/Gammel vagt/.test(listeUdenFortid));

  // --- 6 · Daekningstallet kommer fra posterne, ikke fra et felt. ---
  const set = await kommendeVagter(db, steven.id, { fra_dato: imorgen });
  const k = set.find((v) => v.id === kokken.id);
  const rigtigt = await db.prepare(`SELECT COUNT(*) AS n FROM paa WHERE vagt_id = ?1`).bind(kokken.id).first();
  t("daekningen er talt, ikke gemt", k.paa_antal === rigtigt.n && k.mangler === Math.max(0, k.pladser - rigtigt.n),
     `${k.paa_antal}/${rigtigt.n}`);
  const navne = (await hvemStaarPaa(db, kokken.id)).map((p) => p.navn);
  t("og hvem der staar paa kan slaas op ved navn", navne.includes("Prøve A") && navne.includes("Prøve B"), navne.join(", "));

  const tal = await vagtTal(db, imorgen);
  t("tallet til oversigten taeller kun det kommende", tal.vagter >= 1 && typeof tal.mangler === "number",
     JSON.stringify(tal));

  // Én plads er en plads, ikke «1 pladser». Fundet ved at rendere, ikke ved at laese.
  const { daekning } = await import("../src/vagter.js");
  t("én plads hedder en plads", daekning({ paa_antal: 0, pladser: 1, mangler: 1 }).tekst === "0 af 1 plads",
     daekning({ paa_antal: 0, pladser: 1, mangler: 1 }).tekst);
  t("og to hedder pladser", daekning({ paa_antal: 1, pladser: 2, mangler: 1 }).tekst === "1 af 2 pladser");

  // --- Ingen rangliste. Den staar der som en paastand, siden siger hoejt. ---
  t("siden siger hoejt, at der ikke er en rangliste", /ikke, hvem der er på mest/.test(listeUdenFortid));

  // --- Formularen siger fra paa dansk, ikke paa SQL. ---
  const fd = (o) => ({ get: (k) => (k in o ? o[k] : null) });
  t("en vagt uden pladser bliver afvist", laesVagt(fd({ hvad: "X", dato: imorgen }), imorgen).fejl === TEKST.vagtMangelFelter);
  t("nul pladser er ikke en vagt", laesVagt(fd({ hvad: "X", dato: imorgen, pladser: "0" }), imorgen).fejl === TEKST.vagtPladserTal);
  t("og 51 er ikke et moede, det er en fejl", laesVagt(fd({ hvad: "X", dato: imorgen, pladser: "51" }), imorgen).fejl === TEKST.vagtPladserTal);
  t("en vagt bagud kan ikke oprettes", laesVagt(fd({ hvad: "X", dato: "2020-01-01", pladser: "2" }), imorgen).fejl === TEKST.vagtDatoFortid);
  const god = laesVagt(fd({ hvad: "Gate", dato: imorgen, pladser: "3", fra: "08:00", til: "", hvor: " Porten " }), imorgen);
  t("og en rigtig vagt slipper igennem med felterne trimmet",
     god.vagt && god.vagt.pladser === 3 && god.vagt.fra === "08:00" && god.vagt.til === null && god.vagt.hvor === "Porten",
     JSON.stringify(god));

  // --- Den interne side har sin egen kontrakt, og den blev ikke maalt foer. ---
  //
  // mt5 fandtes ikke i vh.css. Det opdagede jeg ved at RENDERE siden, ikke ved
  // at laese den: overskriften «Kommende» klistrede op ad kassen over sig.
  // Proeven her maaler nu den interne flade ogsaa, saa naeste gang faelder den
  // i porten i stedet for paa en skaerm.
  const internSvar = await worker.fetch(
    new Request("http://localhost:8788/internt/vagter"), env, {});
  const internHtml = await internSvar.text();
  t("den interne side svarer", internSvar.status === 200, String(internSvar.status));
  t("og bruger kun klasser fra vh.css", ukendteKlasser(internHtml, css).length === 0,
     ukendteKlasser(internHtml, css).join(", "));
  t("den staar ikke og lover en knap til en, der ikke er i personregisteret",
     /ikke i personregisteret/.test(internHtml) && !/Opret vagt/.test(internHtml),
     internHtml.slice(0, 120));

  // --- Uden login er der ingen vagter at se. ---
  const uden = await hent("/mit/vagter");
  t("uden login sendes man til doeren", uden.status === 303 && uden.headers.get("Location") === "/mit",
     `${uden.status} ${uden.headers.get("Location")}`);
}

console.log(`\n${ok} bestået, ${fejl} fejlet\n`);
process.exit(fejl ? 1 : 0);
