-- Hegn om den offentlige forespørgsel
--
-- MÅLT 19.09.2026: POST /sporene/forespørg var åben. Ingen CSRF, ingen
-- honningkrukke, ingen rate. En curl uden session lavede en plads og kunne
-- sende mail. Det er den vej, der sælger 2027 — den må ikke være en åben
-- sluse til people og Resend.
--
-- Her logges hvert forsøg pr. IP og pr. mail, så samme afsender ikke kan
-- fylde kalenderen. Rækker ældre end to døgn ryddes ved hver skrivning.
-- Det er et driftshegn, ikke et arkiv over fremmede menneskers adresser.

CREATE TABLE IF NOT EXISTS foresporg_forsoeg (
  id        TEXT PRIMARY KEY,
  slags     TEXT NOT NULL CHECK (slags IN ('ip','mail')),
  noegle    TEXT NOT NULL,
  oprettet  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_foresporg_forsoeg_noegle
  ON foresporg_forsoeg(slags, noegle, oprettet);
