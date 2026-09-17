-- BYG-568 E2 · Find fondene: vi ejer sagerne, ikke katalogerne.
-- Nummer 0006: 0004 er A2 (PR #20), 0005 er korpus (E1). Merge #20 først.
--
-- Manuel import af fond og runde. Krav udledes med kilde på hvert;
-- uden kilde er det en antagelse. Adgangskrav og vurderingskriterier
-- er to forskellige ting — kun det første kan diskvalificere.
--
-- Fonde.dk via Slagelse Kommune er IKKE verificeret. Afhænger af CVR.
-- Vi scraper ikke Fonde.dk. Svaret fra et menneske skrives i feltet.
--
-- Remote apply: wrangler d1 migrations apply vendhjem-fonde --remote
-- Denne agent har ikke Cloudflare-token. Steven kører apply.

-- Krav på sagen: slags og om adgangen er opfyldt.
-- slags: adgangskrav | vurderingskriterium
-- adgang: uafklaret | opfyldt | ikke_opfyldt  (kun meningsfuldt for adgangskrav)
ALTER TABLE requirements ADD COLUMN slags TEXT NOT NULL DEFAULT 'adgangskrav';
ALTER TABLE requirements ADD COLUMN adgang TEXT NOT NULL DEFAULT 'uafklaret';

UPDATE requirements SET slags = 'vurderingskriterium' WHERE id = 'req-5';

-- Kravskabelon på runden. Kopieres ind på sagen, når sagen oprettes.
CREATE TABLE call_requirements (
  id         TEXT PRIMARY KEY,
  call_id    TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  slags      TEXT NOT NULL DEFAULT 'adgangskrav'
             CHECK (slags IN ('adgangskrav','vurderingskriterium')),
  paakraevet INTEGER NOT NULL DEFAULT 1,
  note       TEXT,
  kilde      TEXT,                  -- tom = antagelse
  sortering  INTEGER NOT NULL DEFAULT 0,
  oprettet   TEXT NOT NULL
);
CREATE INDEX idx_creq_call ON call_requirements(call_id);

INSERT INTO call_requirements (id, call_id, label, slags, paakraevet, note, kilde, sortering, oprettet)
SELECT 'cr-' || id, 'call-ldp-2026-2', label, slags, paakraevet, note, kilde, sortering, datetime('now')
  FROM requirements WHERE application_id = 'app-ldp-2026';

-- Vejledning på runden (fil i R2). Ikke et sagsbilag.
ALTER TABLE calls ADD COLUMN vejledning_r2_key TEXT;
ALTER TABLE calls ADD COLUMN vejledning_filnavn TEXT;

-- Historisk indsendelse: registrér at noget blev sendt, uden at sagen var klar.
ALTER TABLE submissions ADD COLUMN historisk INTEGER NOT NULL DEFAULT 0;

-- Fonde.dk via kommunen. Status er uafklaret indtil et menneske skriver svaret.
ALTER TABLE organizations ADD COLUMN fondedk_status TEXT NOT NULL DEFAULT 'uafklaret';
ALTER TABLE organizations ADD COLUMN fondedk_note TEXT;
ALTER TABLE organizations ADD COLUMN fondedk_tjekket TEXT;

UPDATE organizations SET
  fondedk_status = 'afventer_cvr',
  fondedk_note = 'Slagelse Kommune tilbyder gratis adgang til Fonde.dk for foreninger med CVR registreret i kommunen — op til tre bestyrelsesbrugere. Kilde: https://www.slagelse.dk/da/fritid-og-faellesskab/tilskud-og-puljer/faa-gratis-adgang-til-fondedk/ (set 17.09.2026). Egholmvej 23 ligger i Slagelse Kommune. Det er ikke verificeret for Vendhjem. Afhænger af at foreningen har CVR. Vi scraper ikke Fonde.dk. Skriv kommunens svar her, når det foreligger.',
  fondedk_tjekket = NULL
WHERE id = 'org-vendhjem';
