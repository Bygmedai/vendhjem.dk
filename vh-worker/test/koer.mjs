// Integrationsprøve af hele Fonds-CRM'et: rigtige migrationer, rigtig SQL,
// rigtige handlere. Kun D1/R2/Access er stubbet.
//
// Kør: node test/koer.mjs
import { readFileSync } from "node:fs";
import { lavD1, lavR2, lavAssets } from "./stubs.mjs";

const init = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
const seed = readFileSync(new URL("../migrations/0002_seed_ldp.sql", import.meta.url), "utf8");

let ok = 0, fejl = 0;
const t = (navn, betingelse, ekstra = "") => {
  if (betingelse) { ok++; console.log("  ✓", navn); }
  else { fejl++; console.log("  ✗", navn, ekstra); }
};

// Access stubbes ved at overskrive modulets identitet gennem LOKAL_TEST-grenen.
const worker = (await import("../src/index.js")).default;

const env = { FONDE_DB: lavD1([init, seed]), FONDE_FILER: lavR2(), ASSETS: lavAssets(), LOKAL_TEST: "1" };
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
    method: "POST", body: new URLSearchParams({ beloeb: "485000", ansvarlig: "Steven", naeste: "Stiftende generalforsamling" }),
  });
  t("omdirigerer", r.status === 303, r.status);
  const h = await tekst(await hent(`/internt/fonde/sag/${A}`));
  t("beløbet er gemt", h.includes("485000") || h.includes("485.000"));
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

console.log(`\n${ok} bestået, ${fejl} fejlet\n`);
process.exit(fejl ? 1 : 0);
