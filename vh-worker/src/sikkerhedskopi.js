// Månedlig sikkerhedskopi af hele D1 til R2.
//
// HVORFOR
//
// Alt, stedet ved om sig selv — mennesker, roller, aftaler, timer, ophold,
// breve, fondssager — ligger i én database, som én agent har sat op. Hvis
// hverken Haruki eller Cloudflare-kontoen er der en dag, skal Steven og Lai
// stadig kunne åbne en fil og se, hvad der stod. Derfor: en almindelig
// JSON-fil, ingen hemmeligt format, ingen værktøj nødvendigt for at læse den.
//
// Den kører den 1. i måneden klokken 04:00 UTC og skriver til R2 under
// sikkerhedskopi/ÅÅÅÅ-MM-DD.json. Filerne overskrives ikke; de er små.
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
  return {
    skrevet: new Date().toISOString(),
    database: "vendhjem-fonde",
    tabeller: navne,
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
