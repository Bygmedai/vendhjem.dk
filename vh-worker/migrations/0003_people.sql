-- BYG-555 A1 · Personregister
-- Ét menneske, én post. Mail er nuværende kontaktpunkt, ikke identitet:
-- en person kan skifte mail uden at miste historik (sager peger på person_id).
--
-- applications.ansvarlig går fra fritekst til person_id. Den ene eksisterende
-- værdi er «Steven» (seed 0002) og knyttes til Steven Wensley.
--
-- Remote apply: wrangler d1 migrations apply vendhjem-fonde --remote
-- Denne agent har ikke Cloudflare-token. Steven kører apply, når D1 Write
-- er på det token der deployer. Opfind ikke at tokenet findes her.

CREATE TABLE people (
  id        TEXT PRIMARY KEY,
  navn      TEXT NOT NULL,
  mail      TEXT,                 -- nuværende kontakt. NULL = ukendt. Skiftes uden nyt id.
  telefon   TEXT,
  status    TEXT NOT NULL DEFAULT 'aktiv',
  oprettet  TEXT NOT NULL,
  sidst_set TEXT
);
-- En sat mail peger på højst ét menneske. Flere personer uden mail er tilladt.
CREATE UNIQUE INDEX idx_people_mail ON people(mail) WHERE mail IS NOT NULL;

CREATE TABLE roles (
  id         TEXT PRIMARY KEY,
  person_id  TEXT NOT NULL REFERENCES people(id),
  rolle      TEXT NOT NULL CHECK (rolle IN ('kerne','bestyrelse','medlem','proeve','gaest','ansoeger')),
  gyldig_fra TEXT NOT NULL,
  gyldig_til TEXT,                -- NULL = stadig gyldig. Udløb rører ikke personposten.
  oprettet   TEXT NOT NULL
);
CREATE INDEX idx_roles_person ON roles(person_id);

-- Tre nuværende Access-identiteter i gruppen «Vend Hjem – medlemmer».
-- Proveniens (Access-API kunne ikke listes herfra — ingen Cloudflare-token):
--   steven@bygmedai.dk  GitHub-org admin, Linear, Access-fladen er hans at se
--   laiydeh@gmail.com   Lais driftskontakt på det live site (BYG-547)
--   haruki@bygmedai.dk  Worker-forfatter, GitHub-identitet bygmedai-haruki
INSERT INTO people (id, navn, mail, telefon, status, oprettet) VALUES
 ('p-steven', 'Steven Wensley', 'steven@bygmedai.dk', NULL, 'aktiv', datetime('now')),
 ('p-lai',    'Lai Yde',        'laiydeh@gmail.com',  NULL, 'aktiv', datetime('now')),
 ('p-haruki', 'Haruki Kino',    'haruki@bygmedai.dk', NULL, 'aktiv', datetime('now'));

INSERT INTO roles (id, person_id, rolle, gyldig_fra, gyldig_til, oprettet) VALUES
 ('r-steven-kerne', 'p-steven', 'kerne', datetime('now'), NULL, datetime('now')),
 ('r-lai-kerne',    'p-lai',    'kerne', datetime('now'), NULL, datetime('now')),
 ('r-haruki-kerne', 'p-haruki', 'kerne', datetime('now'), NULL, datetime('now'));

-- Fritekst → person_id. SQLite: ny kolonne, flyt, drop gammel, omdøb.
ALTER TABLE applications ADD COLUMN ansvarlig_id TEXT REFERENCES people(id);
UPDATE applications SET ansvarlig_id = 'p-steven' WHERE ansvarlig = 'Steven';
ALTER TABLE applications DROP COLUMN ansvarlig;
ALTER TABLE applications RENAME COLUMN ansvarlig_id TO ansvarlig;
