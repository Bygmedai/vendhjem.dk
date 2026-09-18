-- Et mislykket login må ikke være usynligt
--
-- MÅLT 18.09.2026: Steven kunne ikke komme ind på /mit fra sin telefon. Han
-- havde to personposter — steven@bygmedai.dk med rollen kerne, og
-- steven.wensley@gmail.com uden rolle, oprettet da han testede brevformularen.
-- Login kræver en gyldig rolle, så der blev ikke sendt noget.
--
-- Siden svarer med vilje det samme til kendte og ukendte adresser: kunne man
-- se forskel, kunne man gætte sig til medlemslisten. Den regel er rigtig og
-- bliver stående. Men den betød også, at ingen — heller ikke Lai — kunne se,
-- at et rigtigt menneske havde banket på og ikke var kommet ind.
--
-- Herfra logges hvert forsøg med sit udfald. Fladen lyver stadig pænt udadtil;
-- indadtil står der, hvad der faktisk skete.
--
-- Rækker ældre end 90 dage ryddes ved hver skrivning. En login-log er et
-- driftsværktøj, ikke et arkiv over fremmede menneskers mailadresser.

CREATE TABLE IF NOT EXISTS login_forsoeg (
  id        TEXT PRIMARY KEY,
  mail      TEXT NOT NULL,
  resultat  TEXT NOT NULL CHECK (resultat IN ('sendt','ukendt_mail','uden_rolle','mail_fejlede')),
  person_id TEXT REFERENCES people(id),
  detalje   TEXT,
  oprettet  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_forsoeg_tid ON login_forsoeg(oprettet DESC);
