-- Vagter — den halvdel af BYG-569, der aldrig blev bygget (BYG-583)
--
-- EN VAGT ER ET TIDSPUNKT MED PLADSER. IKKE EN OPGAVE MED EN ANSVARLIG.
--
-- Lånt fra Karrots tænkning, ikke deres kode. Forskellen er hele pointen: en
-- opgave med en ansvarlig bliver til en pligt, man kan svigte, og den skaber
-- en, der skal rykke. Et tidspunkt med pladser bliver til noget, man møder op
-- til — og den, der ikke kan, skriver sig af, uden at skulle forklare sig.
--
-- Derfor er der ingen «ansvarlig»-kolonne og ingen «status». En vagt er
-- dækket, når der står folk på den, og udækket, når der ikke gør. Det er den
-- eneste tilstand, den har, og den kan udregnes — ikke sættes forkert.
--
-- HVORFOR pladser ER NOT NULL OG > 0
--
-- En vagt uden et tal er en vagt, ingen ved om de mangler folk til. Tallet er
-- hele grunden til, at listen kan sorteres efter det, der mangler.

CREATE TABLE IF NOT EXISTS vagter (
  id           TEXT PRIMARY KEY,
  hvad         TEXT NOT NULL,
  dato         TEXT NOT NULL,
  fra          TEXT,
  til          TEXT,
  pladser      INTEGER NOT NULL CHECK (pladser > 0 AND pladser <= 50),
  hvor         TEXT,
  ophold_id    TEXT REFERENCES ophold(id),
  note         TEXT,
  oprettet_af  TEXT NOT NULL REFERENCES people(id),
  oprettet     TEXT NOT NULL
);

-- Den rækkefølge, listen faktisk vises i. Nærmeste dato først.
CREATE INDEX IF NOT EXISTS idx_vagter_dato ON vagter(dato, fra);

-- Hvem der står på. «paa» og ikke «tilmeldinger», fordi det er det ord, folk
-- bruger: man står på en vagt.
--
-- PRIMARY KEY (vagt_id, person_id) ER SPÆRREN MOD DOBBELT TILMELDING.
--
-- Den ligger i skemaet og ikke i en handler med vilje. Et dobbeltklik på en
-- telefon med dårligt net sender to gange, og to samtidige INSERT'er kan begge
-- se «nej, hun står der ikke endnu». Databasen er det eneste sted, hvor de to
-- møder hinanden.
CREATE TABLE IF NOT EXISTS paa (
  vagt_id     TEXT NOT NULL REFERENCES vagter(id) ON DELETE CASCADE,
  person_id   TEXT NOT NULL REFERENCES people(id),
  skrevet_paa TEXT NOT NULL,
  PRIMARY KEY (vagt_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_paa_person ON paa(person_id);

-- Kapaciteten, håndhævet af skemaet.
--
-- Samme grund som ovenfor: to mennesker, der trykker i samme sekund på hver
-- sin telefon, kan begge have talt seks ud af otte. Tællingen skal ske dér,
-- hvor rækken bliver skrevet, ikke dér hvor siden blev tegnet.
--
-- Fejlteksten er skrevet til at kunne vises til et menneske, ikke kun stå i en
-- log. Den samme regel som opholdenes egne triggere følger.
CREATE TRIGGER IF NOT EXISTS paa_kapacitet_ins
BEFORE INSERT ON paa
WHEN (SELECT COUNT(*) FROM paa WHERE vagt_id = NEW.vagt_id)
     >= (SELECT pladser FROM vagter WHERE id = NEW.vagt_id)
BEGIN
  SELECT RAISE(ABORT, 'vagten er fuld');
END;

-- En vagt, der er gået, kan ikke tilmeldes.
--
-- Den står her og ikke kun i handleren, fordi en gammel side i en fane er en
-- knap, der stadig virker. Datoen sammenlignes som tekst, hvilket er i orden,
-- så længe begge er ÅÅÅÅ-MM-DD — og det håndhæves af formatet ovenfor.
CREATE TRIGGER IF NOT EXISTS paa_ikke_fortid
BEFORE INSERT ON paa
WHEN (SELECT dato FROM vagter WHERE id = NEW.vagt_id) < date('now')
BEGIN
  SELECT RAISE(ABORT, 'vagten er gaaet');
END;
