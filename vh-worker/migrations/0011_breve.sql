-- BYG-558 B1 · Brevet på /bliv-en-del lander i systemet
-- Før: formularen byggede en mailto: og åbnede brugerens eget mailprogram.
-- På telefon og i browsere uden mailklient skete der ingenting (målt af
-- Steven 18.09.2026). Nu POSTer formularen til Workeren, brevet gemmes her,
-- går videre pr. mail til den der svarer, og afsenderen får en kvittering.
--
-- Personen genkendes på mail i people (0003). Brevet selv ligger her.
-- status: 'nyt' | 'besvaret'. mail_fejl: sidste fejl fra Resend, ellers NULL.
--
-- Remote apply: wrangler d1 migrations apply vendhjem-fonde --remote
-- (kører automatisk i udrul.yml efter denne PR).

CREATE TABLE IF NOT EXISTS breve (
  id         TEXT PRIMARY KEY,
  person_id  TEXT NOT NULL REFERENCES people(id),
  navn       TEXT NOT NULL,
  mail       TEXT NOT NULL,
  tekst      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'nyt',
  mail_fejl  TEXT,
  oprettet   TEXT NOT NULL,
  besvaret   TEXT
);
CREATE INDEX IF NOT EXISTS breve_status ON breve(status, oprettet);
