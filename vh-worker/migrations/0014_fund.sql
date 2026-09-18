-- «Noget jeg så» — det, man snubler over, mens man laver noget andet
--
-- /internt/registrering er den systematiske gennemgang: rum for rum, med mål
-- og tilstand, og den bliver liggende. Den her er det modsatte — et utæt tag,
-- en dør der binder, en stikkontakt der hænger løs. Det, man opdager på vej
-- gennem laden med en trillebør, og som ellers forsvinder på færgen hjem.
--
-- Samme skærm som timerne, fordi en anden skærm er en skærm, man ikke åbner.
-- Ét valg øverst, samme knap, samme sekund.
--
-- «hvor» er fritekst med vilje. Et rum-ID kræver, at man kender rum-ID'erne,
-- og så bliver feltet tomt. «laden, nordvæggen» er nok til at finde derhen.
--
-- «haster» er ja/nej, ikke en skala fra 1 til 5. En skala bliver til en
-- forhandling med sig selv; et ja/nej bliver besvaret.

CREATE TABLE IF NOT EXISTS fund (
  id         TEXT PRIMARY KEY,
  person_id  TEXT NOT NULL REFERENCES people(id),
  dato       TEXT NOT NULL,
  hvad       TEXT NOT NULL,
  hvor       TEXT,
  haster     INTEGER NOT NULL DEFAULT 0 CHECK (haster IN (0,1)),
  status     TEXT NOT NULL DEFAULT 'nyt' CHECK (status IN ('nyt','set','klaret')),
  oprettet   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fund_status ON fund(status, haster DESC, dato DESC);
CREATE INDEX IF NOT EXISTS idx_fund_person ON fund(person_id, dato DESC);
