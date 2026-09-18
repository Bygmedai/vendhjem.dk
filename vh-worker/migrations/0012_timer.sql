-- BYG-569 H1 · Aftaler og timer — motoren bag Stigen
--
-- Stigen står nu offentligt på /bliv-en-del med timetal på: Gæst 0, Med ca.
-- 100, Bærer 200+. Indtil videre er det et løfte uden noget bag. Her er det,
-- der bærer det.
--
-- To regler fra fundamentet er skrevet ind i skemaet, ikke kun i teksten:
--
-- 1. «Dine timer opgøres på det grundlag, de blev aftalt på. Ikke på hvad
--    nogen husker.» Derfor bærer HVER timelinje sit eget grundlag og sit eget
--    lag som et øjebliksbillede — kopieret fra aftalen den blev lagt under,
--    ikke slået op i den bagefter. Ændrer aftalen sig i morgen, står de gamle
--    linjer uberørt. Det er hele pointen: en aftale kan genforhandles, en
--    registrering kan ikke omskrives af den.
--
-- 2. «Slutdatoen står i aftalen fra begyndelsen.» slut_dato er NOT NULL for
--    med og baerer. Kun en gæst har ingen slutdato, fordi en gæst ingen aftale
--    har ud over opholdet.
--
-- Og én regel, der IKKE står her, fordi den er et fravalg: der findes ingen
-- kolonne, der rangerer mennesker. Summen pr. person kan kun ses af personen
-- selv og af kernen. Stedets fælles total er offentlig for fællesskabet.
--
-- Remote apply: wrangler d1 migrations apply vendhjem-fonde --remote
-- (kører automatisk i udrul.yml efter merge).

CREATE TABLE IF NOT EXISTS aftaler (
  id          TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL REFERENCES people(id),
  lag         TEXT NOT NULL CHECK (lag IN ('gaest','med','baerer')),
  timer_aar   INTEGER CHECK (timer_aar IS NULL OR timer_aar >= 0),
  grundlag    TEXT NOT NULL DEFAULT 'frivillig'
              CHECK (grundlag IN ('frivillig','aftalt_modydelse','betalt')),
  start_dato  TEXT NOT NULL,
  slut_dato   TEXT,
  note        TEXT,
  oprettet    TEXT NOT NULL,
  CHECK (slut_dato IS NULL OR slut_dato >= start_dato),
  -- Slutdatoen kendes fra begyndelsen for alle andre end gæster.
  CHECK (lag = 'gaest' OR slut_dato IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_aftaler_person ON aftaler(person_id, start_dato);

CREATE TABLE IF NOT EXISTS timer (
  id         TEXT PRIMARY KEY,
  person_id  TEXT NOT NULL REFERENCES people(id),
  aftale_id  TEXT REFERENCES aftaler(id),
  dato       TEXT NOT NULL,
  timer      REAL NOT NULL CHECK (timer > 0 AND timer <= 16),
  hvad       TEXT NOT NULL,
  -- Øjebliksbillede fra aftalen. Rør dem aldrig bagefter.
  grundlag   TEXT NOT NULL
             CHECK (grundlag IN ('frivillig','aftalt_modydelse','betalt')),
  lag        TEXT CHECK (lag IS NULL OR lag IN ('gaest','med','baerer')),
  oprettet   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timer_person ON timer(person_id, dato);
CREATE INDEX IF NOT EXISTS idx_timer_dato ON timer(dato);

-- De tre kernefolk får en aftale, så /mit har noget at vise fra første login.
-- Timetallene er dem, Steven og Lai godkendte 18.09.2026; rettes i stigen.json
-- og her, hvis Lai sætter andre.
INSERT OR IGNORE INTO aftaler (id, person_id, lag, timer_aar, grundlag, start_dato, slut_dato, note, oprettet) VALUES
 ('a-steven', 'p-steven', 'baerer', 200, 'frivillig', '2026-09-01', '2027-08-31', 'Platform og drift', datetime('now')),
 ('a-lai',    'p-lai',    'baerer', 200, 'frivillig', '2026-09-01', '2027-08-31', 'Stedet og værtskabet', datetime('now'));
