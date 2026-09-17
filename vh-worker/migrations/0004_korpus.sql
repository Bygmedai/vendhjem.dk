-- BYG-567 E1 · Korpus og stemmeprofil
-- Arbejdsgrundlaget AI'en skal læse. Ikke skriveren.
--
-- Tre slags, fordi de bruges forskelligt og ikke må blandes:
--   stemme   — tekster I selv har skrevet. Ordvalg og rytme. Aldrig fakta.
--   fakta    — aktuelle oplysninger, med kilde og dato.
--   historik — tidligere ansøgninger og fondsbreve. Hvad der er lovet før,
--              ikke hvad der er sandt nu.
--
-- Filer i R2 (præfiks korpus/), metadata og tekst i D1.
-- Et dokument uden godkendelse kan ikke bruges som grundlag — det håndhæves
-- i koden, ikke i en vejledning.
--
-- Remote apply: wrangler d1 migrations apply vendhjem-fonde --remote
-- Denne agent har ikke Cloudflare-token. Steven kører apply, når D1 Write
-- er på det token der deployer. Opfind ikke at tokenet findes her.

CREATE TABLE korpus_dokumenter (
  id                 TEXT PRIMARY KEY,
  titel              TEXT NOT NULL,
  slags              TEXT NOT NULL CHECK (slags IN ('stemme','fakta','historik')),
  oprindelse         TEXT,
  version            INTEGER NOT NULL DEFAULT 1,
  dato               TEXT,                 -- dokumentets egen dato, ikke uploadtid
  projekt            TEXT,
  tilladt_brug       TEXT,
  godkendelsesstatus TEXT NOT NULL DEFAULT 'kladde'
                     CHECK (godkendelsesstatus IN ('kladde','godkendt','trukket')),
  godkendt_af        TEXT,
  godkendt           TEXT,
  r2_key             TEXT UNIQUE,
  filnavn            TEXT,
  mime               TEXT,
  bytes              INTEGER,
  sha256             TEXT,
  indhold            TEXT,                 -- det agenten læser. Kan stå uden fil.
  rolle              TEXT,                 -- NULL, eller 'stemmeprofil'
  oprettet           TEXT NOT NULL,
  opdateret          TEXT NOT NULL,
  oprettet_af        TEXT NOT NULL
);
CREATE INDEX idx_korpus_slags ON korpus_dokumenter(slags, godkendelsesstatus);

-- Arbejdsgrundlag der bygger på korpus-dokumenter. Ændres et kildedokument,
-- markeres de berørte grundlag til genvurdering. Allerede indsendte
-- ansøgninger omskrives ikke.
CREATE TABLE arbejdsgrundlag (
  id             TEXT PRIMARY KEY,
  titel          TEXT NOT NULL,
  application_id TEXT REFERENCES applications(id),
  status         TEXT NOT NULL DEFAULT 'kladde'
                 CHECK (status IN ('kladde','aktuelt','til_genvurdering')),
  oprettet       TEXT NOT NULL,
  opdateret      TEXT NOT NULL
);
CREATE INDEX idx_grundlag_app ON arbejdsgrundlag(application_id);

CREATE TABLE arbejdsgrundlag_kilder (
  grundlag_id      TEXT NOT NULL REFERENCES arbejdsgrundlag(id) ON DELETE CASCADE,
  dokument_id      TEXT NOT NULL REFERENCES korpus_dokumenter(id),
  dokument_version INTEGER NOT NULL,
  oprettet         TEXT NOT NULL,
  PRIMARY KEY (grundlag_id, dokument_id)
);

-- Stemmeprofilen agenten læser senere. Godkendt ved seed, fordi de fem
-- forbudte mønstre allerede er besluttet i BYG-544 — de er ikke et udkast.
INSERT INTO korpus_dokumenter (
  id, titel, slags, oprindelse, version, dato, projekt, tilladt_brug,
  godkendelsesstatus, godkendt_af, godkendt, indhold, rolle,
  oprettet, opdateret, oprettet_af
) VALUES (
  'korpus-stemmeprofil',
  'Stemmeprofil · Vend Hjem',
  'stemme',
  'BYG-544 · Steven, 15.09.2026',
  1,
  '2026-09-15',
  NULL,
  'Ordvalg, rytme og formuleringer der skal undgås. Aldrig som fakta.',
  'godkendt',
  'Steven Wensley',
  datetime('now'),
  'Stemmeprofil · Vend Hjem

Det her er stemme: ordvalg, rytme, metaforer. Det er ikke fakta. En god sætning herfra må ikke komme ud som et aktuelt tal, en dato eller et løfte.

Gode eksempler
- Syv bygninger fra 1920. 25 senge, en sal til 50, 60.000 kvadratmeter.
- Sig tingen, og lad den ligge. Hele sætninger. Kort.

Foretrukne begreber
stedet, rummet, sagen, fristen, kilden, ansøgningen, fællesskabet.
Når det er Egholmvej 23, skriv stedet — ikke projektet, ikke platformen.

Formuleringer der skal undgås — de fem forbudte AI-mønstre fra BYG-544

1. Sitet der forklarer eller forsvarer sig selv.
   Ingen har spurgt. Sig tingen, og lad den ligge.
   Fjernet fra sitet: «Vi lægger det frem, som det er, før der står noget pænt», «Hvorfor prisen ser sådan ud», «Det står her, fordi det skal være svært at lave om på».

2. Aforismen til sidst.
   Ingen taler sådan. Ingen afsluttende visdomssætning efter substansen.
   Fjernet: «Et sted, der kan fylde 52 uger, brænder sine ejere af i år ét.»

3. Definition ved benægtelse.
   Fire benægtelser i træk siger intet om, hvad det er.
   Fjernet: «Det er ikke terapi, og det er ikke et kursus. Du får ikke et diplom, og der er ingen der spørger…»

4. Spejlet symmetri / parallelisme brugt som sandhedsbevis.
   To sideordnede led i balance er ikke et argument. Parallelisme er ikke sandhed.

5. Statusfliser.
   «Hvem står bag», «Lige nu», «Med nu: 2 faste · 4 i samtale» hører til i et pitchdeck, ikke i brødteksten.

Citer ikke manifestet som sitets eller ansøgningens tekst. Opfind ikke tal, datoer, navne eller antal. De eneste faste tal er dem, der allerede står: syv bygninger fra 1920, 25 senge, sal til 50, 60.000 m², færge fra Stigsnæs cirka et kvarter, omkring 170 fastboende, 15 pladser og 850 kr. på en mandeweekend.',
  'stemmeprofil',
  datetime('now'),
  datetime('now'),
  'seed'
);
