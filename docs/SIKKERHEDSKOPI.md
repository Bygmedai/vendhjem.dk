# Sikkerhedskopi — og hvordan man læser den tilbage

**Målt 18. september 2026.** Alt herunder er kørt, ikke skrevet ud fra hukommelsen.

Filen er skrevet til den dag, hvor nogen står med en tom database og skal have
2027-kalenderen og brevene tilbage. Den dag er der ingen, der har tid til at
regne noget ud.

## Hvad der findes

To kopier af det samme, med hver sin styrke.

**JSON-kopien** skrives af Workeren selv, hver nat klokken 04:00 UTC, til
R2-bøtten `vendhjem-fonde-bilag` under `sikkerhedskopi/ÅÅÅÅ-MM-DD.json`. Den
bærer skema, triggere og alle rækker. `genskabSql()` i
`vh-worker/src/sikkerhedskopi.js` laver den om til SQL, man kan køre ind i en
database. Prøve 37 læser den tilbage ved hver portkørsel.

**SQL-eksporten** tages i hånden med `wrangler d1 export`. Den er D1's eget
format og den, man griber til, hvis Workeren selv er en del af problemet.
`docs/laes-tilbage.mjs` læser den tilbage og siger fra, hvis noget mangler.

De to møder hver sin fælde. Begge står beskrevet nedenfor, fordi begge har
kostet tid at finde.

## Se hvordan det står til

Bag Access, til et menneske, der spørger:

    https://vendhjem.dk/internt/sikkerhedskopi

Siden viser nyeste dato, hvor mange døgn siden, og hvor mange kopier der
ligger. Der er en knap, der tager en nu. Tal og datoer, aldrig indhold.

Maskinlæsbart, til noget der spørger uden at nogen beder om det:

    curl -sS https://vendhjem.dk/sundhed/sikkerhedskopi \
      -H "X-VH-Sundhed: $SUNDHED_NOEGLE"

`200` når nyeste kopi er højst to døgn gammel, `503` når den er ældre eller
slet ikke findes. Statuskoden bærer svaret alene, så en overvågning kan rejse
sig uden at læse JSON. Uden nøglen svarer den `404` og røber ikke, at den
findes. Nøglen er den samme som `/sundhed/fonde` bruger og ligger som
Worker-hemmelighed — ikke en ny hemmelighed at passe på.

Tag en kopi nu, uden at vente på klokken fire — til lige før en migration:

    curl -sS -X POST https://vendhjem.dk/sundhed/sikkerhedskopi \
      -H "X-VH-Sundhed: $SUNDHED_NOEGLE"

## Den fulde kopi: D1-eksport

    cd vh-worker
    CLOUDFLARE_API_TOKEN=... npx wrangler@4 d1 export vendhjem-fonde --remote \
      --output=vendhjem-$(date -u +%F).sql

Læg den i R2 ved siden af de natlige:

    npx wrangler@4 r2 object put \
      "vendhjem-fonde-bilag/sikkerhedskopi/$(date -u +%F)-manuel.sql" \
      --file=vendhjem-$(date -u +%F).sql --content-type="application/sql" --remote

## Læs den tilbage

    node docs/laes-tilbage.mjs vendhjem-2026-09-18.sql

Den rejser kopien i en tom database og spørger den, om den hænger sammen:
tabeller, rækker, triggere, fremmednøgler, `integrity_check`. Den skriver
ingenting nogen steder. Går noget galt, går den i rødt.

Målt på en rigtig eksport fra produktion 18.09.2026:

    27 tabeller, 93 rækker
    7 af 7 triggere rejst
    fremmednøgler: ingen brud
    integrity_check: ok

Tælling mod den levende database, tabel for tabel: `people` 4/4, `ophold`
12/12, `opholdstyper` 7/7, `breve` 1/1, `timer` 2/2, `aftaler` 2/2, `roles`
3/3, `requirements` 8/8. Kopien blev lagt i R2, hentet ned igen og
sammenlignet byte for byte.

## De to fælder

### `no such table: main.people`

Rammer SQL-eksporten. Det ligner en ødelagt kopi. Det er det ikke.

`node:sqlite` slår fremmednøgler til som standard. D1's eksport regner med, at
`PRAGMA defer_foreign_keys` holder dem tilbage — og den virker **kun inde i en
transaktion**. Uden for én bliver den ignoreret i stilhed. Så falder hver
`INSERT`, der peger på en tabel, der endnu ikke er fyldt.

`laes-tilbage.mjs` åbner derfor databasen med
`enableForeignKeyConstraints: false`. Kører du kopien ind et andet sted, skal
du slå dem fra selv.

### `hele stedet er optaget i den periode`

Rammer JSON-kopien. Fundet af Vilde, 18.09.2026, og det er det værste af de to,
fordi det først ville vise sig den dag, det gjaldt.

Skemaet har syv triggere, der vogter opholdene mod overlap og overbookning. De
fyrer også under en gendannelse og afviser dermed præcis den kalender, de er
bygget til at beskytte. `genskabSql()` tager dem ned omkring indsættelsen og
sætter dem op igen bagefter — af kopiens egen tekst, ikke af en liste, nogen
skal huske at vedligeholde.

**Spejlbilledet er værd at holde styr på:** `PRAGMA foreign_keys = OFF` virker
kun **uden for** en transaktion, og `PRAGMA defer_foreign_keys` virker kun
**inde i** én. De to pragmaer har hver sin side af `BEGIN`, og de er ikke til
at bytte om.

### Hvorfor SQL-eksporten slipper forbi triggerne

Ikke fordi den er klogere. Fordi rækkefølgen i filen redder den. Målt på
eksporten fra 18.09.2026:

    CREATE TABLE     linje   2-283
    INSERT INTO      linje   3-295
    CREATE INDEX     linje 296-323
    CREATE TRIGGER   linje 324-410

Triggerne skabes efter sidste `INSERT`. De findes ikke endnu, når rækkerne går
ind, så de kan ikke fyre.

**Det er SQLites dump-konvention, ikke et løfte fra D1.** Skifter den en dag i
en wrangler-udgivelse, holder SQL-eksporten op med at kunne læses tilbage — og
ingen port opdager det, for porten kan ikke nå wrangler. Derfor henter
`laes-tilbage.mjs` de forventede triggernavne fra migrationerne og siger fra,
hvis de ikke står i den genskabte database. Hegnet står der, hvor det kan nås:
i det øjeblik nogen faktisk læser tilbage.

En tidligere udgave af det hegn sammenlignede triggere i filen med triggere i
databasen. Den var grøn, også da alle syv var klippet ud af eksporten, fordi
begge tal gik til nul. En kilde, der måler sig selv, måler ingenting.

## Gendannelse: det ene, scriptet ikke gør for dig

`genskabSql()` bruger `INSERT OR REPLACE`, fordi en ny D1 ikke er tom —
migrationerne lægger selv roller, opholdstyper og kalenderen ind. Den **sletter
intet**. Står der en række i databasen, som ikke er i kopien, bliver den
stående.

Vil du have præcis kopiens tilstand og intet andet, skal du køre den ind i en
frisk database.

## Det, der stadig ikke er gjort

1. **R2-bøtten selv er ikke kopieret.** Bilagene ligger ét sted. En kopi af
   databasen redder ikke de filer, sagerne peger på.
2. **Intet ligger uden for Cloudflare.** Forsvinder kontoen, forsvinder begge
   kopier med den.
3. **Alarmen er en dør, ikke en vagt.** `/sundhed/sikkerhedskopi` svarer 503,
   når kopien er gammel — men der er endnu ingen, der spørger den. Indtil noget
   kalder den på en plan, er den et sted at kigge hen, ikke en besked, der kommer.

De tre er ikke gemt væk. De står her, så den, der læser filen, ved præcis hvor
langt den rækker.
