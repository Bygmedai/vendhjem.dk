-- Vendhjem Fonds-CRM · første slice
-- S593 · 16.09.2026 · D1 (SQLite)
-- Model skåret fra DESIGN-FONDS-CRM §2 og BYG-545-ARKITEKTUR §5 til det,
-- LDP-sprinten faktisk kræver. Alt, der ikke er nødvendigt før 9. oktober,
-- er udeladt med vilje, ikke glemt: awards, obligations, disbursements,
-- budget_versions og funding_allocations kommer, når første tilsagn findes.

CREATE TABLE organizations (
  id            TEXT PRIMARY KEY,
  navn          TEXT NOT NULL,
  cvr           TEXT,                    -- NULL = endnu ikke registreret. Må ikke vises som om den findes.
  cvr_status    TEXT NOT NULL DEFAULT 'ukendt',  -- ukendt | under_stiftelse | registreret
  formaal       TEXT,
  adresse       TEXT,
  tegningsregel TEXT,                    -- fritekst; en boolsk markering er ikke hele reglen
  oprettet      TEXT NOT NULL
);

CREATE TABLE funds (
  id       TEXT PRIMARY KEY,
  navn     TEXT NOT NULL,
  program  TEXT,
  url      TEXT,
  noter    TEXT,
  oprettet TEXT NOT NULL
);

-- En runde. Fristen gemmes i UTC, men både den oprindelige ordlyd, tidszonen
-- og kilden bevares, så vi aldrig opfinder et klokkeslæt.
CREATE TABLE calls (
  id                TEXT PRIMARY KEY,
  fund_id           TEXT NOT NULL REFERENCES funds(id),
  navn              TEXT NOT NULL,
  frist_utc         TEXT,                -- ISO8601 Z. NULL hvis ingen frist er oplyst.
  frist_tz          TEXT DEFAULT 'Europe/Copenhagen',
  frist_ordlyd      TEXT,                -- præcis som kilden skriver den
  frist_kilde_url   TEXT,
  frist_verificeret TEXT,                -- hvornår vi sidst så kilden med egne øjne
  frist_note        TEXT,                -- fx uoverensstemmelser vi ikke selv må bortforklare
  oprettet          TEXT NOT NULL
);

CREATE TABLE applications (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES organizations(id),
  call_id        TEXT NOT NULL REFERENCES calls(id),
  titel          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'kladde',
                 -- kladde | til_godkendelse | godkendt | indsendt | trukket | afvist | arkiveret
  beloeb_ansoegt INTEGER,               -- hele kroner. NULL = ikke fastlagt.
  valuta         TEXT NOT NULL DEFAULT 'DKK',
  ansvarlig      TEXT,
  naeste_handling TEXT,
  intern_frist   TEXT,                  -- vores egen afleveringsfrist, adskilt fra fondens
  oprettet       TEXT NOT NULL,
  opdateret      TEXT NOT NULL
);
CREATE INDEX idx_app_org ON applications(org_id);
CREATE INDEX idx_app_call ON applications(call_id);

-- Bilagscheckliste. «Mangler» er en beregning, ikke et felt der kan lyve.
CREATE TABLE requirements (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  paakraevet     INTEGER NOT NULL DEFAULT 1,
  note           TEXT,
  kilde          TEXT,                  -- hvor kravet står. Et krav uden kilde er en antagelse.
  sortering      INTEGER NOT NULL DEFAULT 0,
  kontrolleret   TEXT,                  -- tidspunkt for menneskelig kontrol; uploadet != kontrolleret
  kontrolleret_af TEXT
);
CREATE INDEX idx_req_app ON requirements(application_id);

CREATE TABLE documents (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  requirement_id TEXT REFERENCES requirements(id),
  filnavn        TEXT NOT NULL,
  r2_key         TEXT NOT NULL UNIQUE,
  bytes          INTEGER NOT NULL,
  mime           TEXT,
  sha256         TEXT,
  version        INTEGER NOT NULL DEFAULT 1,
  slags          TEXT NOT NULL DEFAULT 'bilag',  -- bilag | kvittering | tilsagn
  uploadet_af    TEXT NOT NULL,
  uploadet       TEXT NOT NULL
);
CREATE INDEX idx_doc_app ON documents(application_id);
CREATE INDEX idx_doc_req ON documents(requirement_id);

-- Godkendelse bindes til et indholds-fingeraftryk. Ændres pakken bagefter,
-- gælder godkendelsen ikke længere for den nye pakke.
CREATE TABLE approvals (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  beslutning     TEXT NOT NULL,          -- godkendt | afvist
  aktoer         TEXT NOT NULL,
  kommentar      TEXT,
  pakke_hash     TEXT NOT NULL,          -- identificerer indholdet; er ikke en juridisk signatur
  besluttet      TEXT NOT NULL
);
CREATE INDEX idx_apr_app ON approvals(application_id);

CREATE TABLE submissions (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  indsendt       TEXT NOT NULL,
  indsendt_af    TEXT NOT NULL,
  ekstern_ref    TEXT,
  kvittering_id  TEXT REFERENCES documents(id),
  pakke_hash     TEXT NOT NULL,
  note           TEXT
);
CREATE INDEX idx_sub_app ON submissions(application_id);

-- Revisionsspor. Skrives i samme transaktion som den handling, den beskriver.
CREATE TABLE activity_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT,
  aktoer         TEXT NOT NULL,
  handling       TEXT NOT NULL,
  detalje        TEXT,
  tidspunkt      TEXT NOT NULL
);
CREATE INDEX idx_log_app ON activity_log(application_id, id DESC);
