-- BYG-556 A2 · Login til fællesskabet (/mit)
-- Magic links, passkeys, og om vi har spurgt om at huske enheden.
-- /mit ligger UDEN for Access. /internt røres ikke.

-- NULL = ikke spurgt endnu. 'nej' = spørg aldrig igen. 'ja' = har sagt ja.
ALTER TABLE people ADD COLUMN passkey_tilbud TEXT;

CREATE TABLE magic_links (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  person_id  TEXT NOT NULL REFERENCES people(id),
  enhed_hash TEXT NOT NULL,
  udloeb     TEXT NOT NULL,
  brugt      TEXT,
  oprettet   TEXT NOT NULL
);
CREATE INDEX idx_magic_udloeb ON magic_links(udloeb);

CREATE TABLE passkeys (
  id            TEXT PRIMARY KEY,
  person_id     TEXT NOT NULL REFERENCES people(id),
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  counter       INTEGER NOT NULL DEFAULT 0,
  oprettet      TEXT NOT NULL
);
CREATE INDEX idx_passkeys_person ON passkeys(person_id);

CREATE TABLE webauthn_udfordringer (
  id         TEXT PRIMARY KEY,
  person_id  TEXT,
  form       TEXT NOT NULL,
  challenge  TEXT NOT NULL,
  enhed_hash TEXT,
  udloeb     TEXT NOT NULL,
  oprettet   TEXT NOT NULL
);
