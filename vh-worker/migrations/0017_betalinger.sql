-- Betalingsvejen (BYG, 23.09.2026).
--
-- HVORFOR DEN HER TABEL FINDES
--
-- `pladser.status` kunne allerede staa paa 'betalt'. Ingen kode har nogensinde
-- sat den. Bekraeftelsesmailen naevnte en pris og sagde ikke med ét ord,
-- hvordan pengene skulle skifte haender — et menneske, der havde faaet ja, sad
-- med et loefte om en seng og ingen maade at betale for den.
--
-- REGLERNE LIGGER HER, IKKE I EN HANDLER
--
-- To ting kan gaa galt med penge, og begge dele er stille:
--
--   1. Den samme plads bliver betalt to gange. Stripe sender webhooks om igen
--      ved enhver tvivl, og en handler, der bare siger UPDATE, siger ja hver
--      gang. `betaling_hoejst_en_betalt` naegter.
--
--   2. Det samme event bliver behandlet to gange. Stripes egen dokumentation:
--      «Webhook endpoints might occasionally receive the same event more than
--      once.» `event_id` er UNIQUE, saa det andet forsoeg falder paa en
--      constraint i stedet for paa en if-saetning, nogen kan komme til at
--      flytte.
--
-- Flytter du dem op i JavaScript, fordi det er lettere at laese, holder de op
-- med at virke i praecis de tilfaelde, de er bygget til. Samme regel som
-- vagternes tre hegn i 0015.

CREATE TABLE betalinger (
  id          TEXT PRIMARY KEY,
  plads_id    TEXT NOT NULL REFERENCES pladser(id),

  -- Oere, ikke kroner. Stripe regner i mindste enhed, og en afrunding et sted
  -- paa vejen er en fejl, ingen opdager foer regnskabet.
  belob_oere  INTEGER NOT NULL CHECK (belob_oere > 0),
  valuta      TEXT NOT NULL DEFAULT 'dkk' CHECK (valuta = lower(valuta)),

  -- cs_... Sessionen UDLOEBER (24 timer hos Stripe), saa der kan vaere flere
  -- rundt om den samme plads. Det er ikke en fejl: mailen baerer VORES adresse,
  -- og der mintes en ny session ved hvert klik.
  session_id  TEXT UNIQUE,

  status      TEXT NOT NULL DEFAULT 'aabnet'
              CHECK (status IN ('aabnet','betalt','annulleret')),

  -- evt_... Idempotensen. NULL indtil et event lander; UNIQUE bagefter.
  event_id    TEXT UNIQUE,

  oprettet    TEXT NOT NULL,
  betalt_at   TEXT
);

CREATE INDEX idx_betalinger_plads ON betalinger(plads_id);

-- Pengehegnet. En plads kan betales én gang. Det er den her linje, der staar
-- mellem os og at traekke 850 kr. to gange af den samme mand, fordi et netvaerk
-- hikkede.
CREATE UNIQUE INDEX betaling_hoejst_en_betalt
  ON betalinger(plads_id) WHERE status = 'betalt';
