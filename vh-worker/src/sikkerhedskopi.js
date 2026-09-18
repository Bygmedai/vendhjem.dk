// Daglig sikkerhedskopi af hele D1 til R2.
//
// HVORFOR
//
// Alt, stedet ved om sig selv — mennesker, roller, aftaler, timer, ophold,
// breve, fondssager — ligger i én database, som én agent har sat op. Hvis
// hverken Haruki eller Cloudflare-kontoen er der en dag, skal Steven og Lai
// stadig kunne åbne en fil og se, hvad der stod. Derfor: en almindelig
// JSON-fil, ingen hemmeligt format, ingen værktøj nødvendigt for at læse den.
//
// Den kører hver nat klokken 04:00 UTC og skriver til R2 under
// sikkerhedskopi/ÅÅÅÅ-MM-DD.json. Filerne overskrives ikke; de er små.
//
// HVORFOR DAGLIG OG IKKE MÅNEDLIG
//
// Den stod til den 1. i måneden, indtil 18.09.2026. Workeren blev udrullet
// den 18., så den FØRSTE kopi ville være blevet skrevet 1. oktober — tretten
// døgn, hvor 2027-kalenderen, brevene og timerne kun fandtes ét sted. Og var
// databasen gået tabt den 30. september, ville en månedlig kopi have kostet
// hele september. Filen er nogle få hundrede kilobyte. Prisen for at tage den
// hver nat er ingenting; prisen for at lade være er en måneds arbejde.
//
// HVAD DER ELLERS MANGLEDE
//
// koerSikkerhedskopi kunne kun kaldes af cron. Der var altså ingen måde at
// tage en kopi NU — heller ikke for Steven, heller ikke før en risikabel
// ændring. Og ingen havde nogensinde læst en tilbage. En sikkerhedskopi, man
// ikke kan udløse, ikke kan se, og aldrig har prøvet at bruge, er et håb med
// et filnavn. Derfor: en knap bag Access, et readback på /sundhed, og en
// prøve der GENSKABER databasen af filen.
//
// Hvad den IKKE gør: den rører ikke ved noget, den sender ikke noget, og den
// kan ikke slette. En sikkerhedskopi, der kan skrive i databasen, er ikke en
// sikkerhedskopi.

/** Tabeller vi selv har lavet. sqlite_* og D1's egne springes over. */
async function tabeller(db) {
  const { results } = await db.prepare(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
      ORDER BY name`
  ).all();
  return results.map((r) => r.name);
}

/**
 * Hele databasen som ét objekt. Rækkerne kommer, som de står — ingen
 * omskrivning, ingen udeladelse. En kopi, der er pænere end originalen, er
 * ikke en kopi.
 */
export async function lavKopi(db) {
  const navne = await tabeller(db);
  const data = {};
  const antal = {};
  for (const navn of navne) {
    const { results } = await db.prepare(`SELECT * FROM "${navn}"`).all();
    data[navn] = results;
    antal[navn] = results.length;
  }

  // Triggerne skal MED. Uden dem kan kopien ikke laeses tilbage.
  //
  // Maalt 18.09.2026, foerste gang nogen forsoegte en gendannelse: databasen
  // har syv triggere, der vogter opholdene — ingen overlappende naetter, ingen
  // overbookning. De fyrer ogsaa ved en gendannelse, og saa afviser de den
  // kalender, de er bygget til at beskytte, med «hele stedet er optaget i den
  // periode». Hegnet, der beskytter dataene, gjorde dem umulige at faa
  // tilbage. Det opdager man kun ved at proeve.
  //
  // Derfor gemmes trigger-definitionerne i kopien, og genskabSql slaar dem fra
  // omkring indsaettelsen og saetter dem op igen bagefter — af kopiens egen
  // tekst, ikke af en liste nogen skal huske at vedligeholde.
  const { results: skema } = await db.prepare(
    `SELECT name, sql FROM sqlite_master
      WHERE type = 'trigger' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
      ORDER BY name`
  ).all();

  return {
    skrevet: new Date().toISOString(),
    database: "vendhjem-fonde",
    tabeller: navne,
    triggere: skema,
    antal,
    data,
  };
}

export function kopiNavn(dato = new Date()) {
  return `sikkerhedskopi/${dato.toISOString().slice(0, 10)}.json`;
}

/** Kaldes af cron. Returnerer det, der blev skrevet, så prøven kan se det. */
export async function koerSikkerhedskopi(env, dato = new Date()) {
  if (!env.FONDE_FILER) return { ok: false, grund: "ingen R2-binding" };
  const kopi = await lavKopi(env.FONDE_DB);
  const navn = kopiNavn(dato);
  await env.FONDE_FILER.put(navn, JSON.stringify(kopi, null, 1), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  const raekker = Object.values(kopi.antal).reduce((a, b) => a + b, 0);
  return { ok: true, navn, tabeller: kopi.tabeller.length, raekker };
}

/**
 * SQL, der bygger indholdet op igen af en kopi.
 *
 * HVORFOR DEN FINDES
 *
 * En sikkerhedskopi, ingen har prøvet at læse tilbage, er ikke en
 * sikkerhedskopi. Prøve 37 tager en kopi af en database, bygger en TOM
 * database af de samme migrationer, kører det her ind i den, og sammenligner
 * række for række. Går formatet i stykker — en kolonne der forsvinder, en
 * dato der bliver til noget andet — fælder prøven porten, ikke virkeligheden.
 *
 * Den skriver INTET selv. Den returnerer tekst. Den, der kører den, er et
 * menneske med en tom database foran sig, og det skal blive ved med at være
 * sådan: gendannelse er ikke noget, en Worker skal kunne gøre ved et uheld.
 *
 * Rækkefølgen er kopiens egen (tabeller sorteret efter navn), så
 * fremmednøgler kan pege på rækker, der endnu ikke er indsat. Derfor slås de
 * fra omkring det hele — det er den samme rækkefølge, dataene ALLEREDE stod i
 * med succes, ikke en ny påstand om hvad der hører til hvad.
 *
 * INSERT OR REPLACE, og det er med vilje. En ny D1 er ikke tom: migrationerne
 * lægger selv seed-rækker ind (roller, opholdstyper, kalenderen). Et rent
 * INSERT ville støde på dem og stoppe midt i gendannelsen. Kopien er
 * sandheden, så den skriver over.
 *
 * MEN DEN SLETTER INTET. Står der en række i databasen, som ikke er i kopien,
 * bliver den stående. Vil du have præcis kopiens tilstand og intet andet, skal
 * du køre den ind i en FRISK database. Det er den ene ting, scriptet ikke kan
 * gøre for dig, og derfor står det her frem for i et hoved.
 */
export function genskabSql(kopi) {
  const v = (x) => {
    if (x === null || x === undefined) return "NULL";
    if (typeof x === "number") return String(x);
    if (typeof x === "bigint") return String(x);
    if (x instanceof Uint8Array || x instanceof ArrayBuffer) {
      const b = x instanceof ArrayBuffer ? new Uint8Array(x) : x;
      return "X'" + [...b].map((n) => n.toString(16).padStart(2, "0")).join("") + "'";
    }
    return "'" + String(x).replace(/'/g, "''") + "'";
  };

  const triggere = kopi.triggere || [];
  const ud = ["PRAGMA foreign_keys = OFF;", "BEGIN;"];

  // Triggerne ned, mens dataene gaar ind. De vogter opholdene mod overlap og
  // overbookning — regler, kopiens egne raekker ALLEREDE overholder, for de
  // stod i databasen. Lader man dem staa, afviser de gendannelsen af den
  // kalender, de beskytter. Se lavKopi om hvordan det blev fundet.
  for (const tr of triggere) ud.push(`DROP TRIGGER IF EXISTS "${tr.name}";`);
  for (const navn of kopi.tabeller) {
    const raekker = kopi.data[navn] || [];
    if (!raekker.length) continue;
    const kolonner = Object.keys(raekker[0]);
    for (const r of raekker) {
      ud.push(
        `INSERT OR REPLACE INTO "${navn}" (${kolonner.map((k) => `"${k}"`).join(", ")}) ` +
        `VALUES (${kolonner.map((k) => v(r[k])).join(", ")});`
      );
    }
  }
  // Og op igen, af kopiens egen tekst. Glemmer man det her, staar databasen
  // tilbage uden sine hegn, og den foerste dobbeltbooking opdages af et
  // menneske i stedet for af skemaet.
  for (const tr of triggere) ud.push(String(tr.sql).trim().replace(/;*$/, "") + ";");

  ud.push("COMMIT;", "PRAGMA foreign_keys = ON;");
  return ud.join("\n");
}

/**
 * Hvad der FAKTISK ligger i R2 — ikke hvad cron'en burde have gjort.
 *
 * Returnerer tal og datoer, aldrig indhold. Den er til for at besvare det ene
 * spørgsmål, ingen kunne besvare før: «hvornår blev der sidst taget en kopi,
 * og hvor gammel er den?»
 */
export async function sidsteKopi(env, nu = new Date()) {
  if (!env.FONDE_FILER) return { ok: false, grund: "ingen R2-binding" };
  if (typeof env.FONDE_FILER.list !== "function") return { ok: false, grund: "R2 kan ikke listes" };
  const { objects = [] } = await env.FONDE_FILER.list({ prefix: "sikkerhedskopi/" });
  if (!objects.length) return { ok: true, findes: false, antal: 0 };

  const sorteret = [...objects].sort((a, b) => (a.key < b.key ? 1 : -1));
  const nyeste = sorteret[0];
  const dag = String(nyeste.key).slice("sikkerhedskopi/".length, "sikkerhedskopi/".length + 10);
  const alder = Math.floor((nu.getTime() - Date.parse(dag + "T00:00:00Z")) / 86400000);
  return {
    ok: true,
    findes: true,
    antal: objects.length,
    nyeste: dag,
    alder_doegn: Number.isFinite(alder) ? alder : null,
    stoerrelse: nyeste.size ?? null,
  };
}
