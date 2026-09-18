// Laeser en SQL-eksport fra D1 tilbage i en tom database og spoerger den, om
// den haenger sammen.
//
//   node docs/laes-tilbage.mjs vendhjem-2026-09-18.sql
//
// HVORFOR DEN FINDES VED SIDEN AF PROEVE 37
//
// Proeve 37 laeser JSON-kopien tilbage. Den koerer ved hver portkoersel og
// passer paa formatet. Det her er den anden vej: SQL-eksporten fra
// `wrangler d1 export`, koert i haanden den dag, en database er vaek.
//
// De to veje moeder hver sin faelde, og det er vaerd at kende begge:
//
//   JSON-kopien   moeder de syv triggere, der vogter opholdene. De fyrer under
//                 gendannelsen og afviser den kalender, de beskytter.
//                 genskabSql tager dem ned og saetter dem op igen.
//
//   SQL-eksporten slipper forbi triggerne, fordi eksporten skriver
//                 CREATE TRIGGER EFTER sidste INSERT. Maalt 18.09.2026:
//                 tabeller linje 2-283, INSERT 3-295, INDEX 296-323,
//                 TRIGGER 324-410. Triggerne findes altsaa ikke endnu, naar
//                 raekkerne gaar ind.
//
// DEN RAEKKEFOELGE ER SQLITES DUMP-KONVENTION, IKKE ET LOEFTE FRA D1.
//
// Skifter den en dag i en wrangler-udgivelse, holder SQL-eksporten op med at
// kunne laeses tilbage — og ingen port opdager det, for porten kan ikke naa
// wrangler. Derfor taeller scriptet her triggerne i FILEN og triggerne i den
// GENSKABTE database og siger fra, hvis de to tal ikke er ens. Hegnet staar
// der, hvor det kan naas: i det oejeblik nogen faktisk laeser tilbage.
//
// FAELDEN, DER FIK EN SUND KOPI TIL AT LIGNE EN OEDELAGT
//
// node:sqlite slaar fremmednoegler til som standard. D1's eksport regner med,
// at `PRAGMA defer_foreign_keys` holder dem tilbage — og den virker KUN inde
// i en transaktion. Uden `enableForeignKeyConstraints: false` doer
// indlaesningen paa `no such table: main.people`, og kopien faar skylden.
//
// (Spejlbilledet staar i src/sikkerhedskopi.js: `PRAGMA foreign_keys = OFF`
// virker kun UDEN FOR en transaktion. De to pragmaer er ikke til at bytte om.)

import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Hegnene, skemaet KRAEVER — laest af migrationerne, ikke af kopien.
//
// Foerste udgave af det her taelte triggere i filen og triggere i databasen og
// sammenlignede de to tal. Den var ubrugelig: forsvandt triggerne fra
// eksporten, gik begge tal til nul, og proeven sagde god for det. Den blev
// falsificeret 18.09.2026 ved at klippe alle syv ud af en rigtig eksport —
// og den bestod. En proeve, der aldrig har vaeret roed, er ikke en proeve endnu.
//
// Kilden skal vaere uafhaengig af det, den maaler. Migrationerne er den kilde.
function forventedeTriggere() {
  const mappe = join(dirname(fileURLToPath(import.meta.url)), "..", "vh-worker", "migrations");
  const navne = new Set();
  for (const f of readdirSync(mappe).filter((f) => f.endsWith(".sql"))) {
    const t = readFileSync(join(mappe, f), "utf8");
    for (const m of t.matchAll(/CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi)) {
      navne.add(m[1]);
    }
  }
  return [...navne].sort();
}

const fil = process.argv[2];
if (!fil) {
  console.error("brug: node docs/laes-tilbage.mjs <eksport.sql>");
  process.exit(2);
}

const sql = readFileSync(fil, "utf8");
const forventet = forventedeTriggere();

const db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: false });
try {
  db.exec(sql);
} catch (e) {
  console.error(`Indlaesningen doede: ${e.message}`);
  if (/no such table/.test(e.message)) {
    console.error("\nDet her er som regel IKKE en oedelagt kopi. Koerer du den");
    console.error("et andet sted end herfra, saa slaa fremmednoegler fra foerst.");
  }
  process.exit(1);
}

const tabeller = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
).all();
const rejste = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name"
).all().map((r) => r.name);
const manglende = forventet.filter((n) => !rejste.includes(n));

let raekker = 0;
const linjer = [];
for (const { name } of tabeller) {
  const n = db.prepare(`SELECT count(*) AS n FROM "${name}"`).get().n;
  raekker += n;
  linjer.push(`  ${String(n).padStart(5)}  ${name}`);
}

const fk = db.prepare("PRAGMA foreign_key_check").all();
const helhed = db.prepare("PRAGMA integrity_check").get();
const helhedOk = Object.values(helhed)[0] === "ok";

console.log(`${fil}\n`);
console.log(linjer.join("\n"));
console.log(`\n  ${tabeller.length} tabeller, ${raekker} raekker`);
console.log(`  ${rejste.length} af ${forventet.length} triggere rejst${manglende.length ? ` — mangler: ${manglende.join(", ")}` : ""}`);
console.log(`  fremmednoegler: ${fk.length ? `${fk.length} brud` : "ingen brud"}`);
console.log(`  integrity_check: ${helhedOk ? "ok" : JSON.stringify(helhed)}`);

const problemer = [];
if (!tabeller.length) problemer.push("ingen tabeller — filen er tom eller ikke en eksport");
if (fk.length) problemer.push(`${fk.length} brudte fremmednoegler`);
if (!helhedOk) problemer.push("integrity_check klager");
if (manglende.length) {
  problemer.push(
    `hegnene om opholdene er ikke rejst: ${manglende.join(", ")} — ` +
    "raekkefoelgen i eksporten kan have aendret sig, og databasen staar uden sine spaerrer"
  );
}

if (problemer.length) {
  console.error(`\nIKKE GODKENDT:\n  ${problemer.join("\n  ")}`);
  process.exit(1);
}
console.log("\nGodkendt. Kopien kan laeses tilbage.");
