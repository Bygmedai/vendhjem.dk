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

let ok = 0, fejl = 0;
const t = (navn, betingelse, ekstra = "") => {
  if (betingelse) { ok++; console.log("  ✓", navn); }
  else { fejl++; console.log("  ✗", navn, ekstra); }
};

// Access stubbes ved at overskrive modulets identitet gennem LOKAL_TEST-grenen.
const worker = (await import("../src/index.js")).default;

const env = { FONDE_DB: lavD1([init, seed, peopleSql]), FONDE_FILER: lavR2(), ASSETS: lavAssets(), LOKAL_TEST: "1" };
const BASE = "http://localhost:8788";
const A = "app-ldp-2026";

const hent = (sti, init2) => worker.fetch(new Request(BASE + sti, init2), env, {});
const tekst = async (r) => await r.text();

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

console.log(`\n${ok} bestået, ${fejl} fejlet\n`);
process.exit(fejl ? 1 : 0);
