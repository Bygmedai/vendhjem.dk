-- BYG-561 C1 · Ophold og kalender
-- Det sitet sælger, skal kunne bookes. Seks spor plus lukkede uger.
-- Dobbeltbooking på hele stedet er umulig her, ikke i fladen.
--
-- 0004 er A2 /mit, 0005–0006 er korpus/fonde i åbne PR'er. C1 tager 0007
-- med vilje, så migrationerne ikke kolliderer ved merge.
--
-- Remote apply: wrangler d1 migrations apply vendhjem-fonde --remote
-- Denne agent har ikke Cloudflare-token. Steven kører apply, når D1 Write
-- er på det token der deployer. Opfind ikke at tokenet findes her.

-- En type er et spor (eller lukkede uger). Pris er et fra-beløb, når vi
-- har ét; NULL er ikke nul kroner — det er «ikke sat», og fladen skal
-- sige hvorfor, ikke lade feltet stå tomt.
CREATE TABLE opholdstyper (
  id          TEXT PRIMARY KEY,
  spor        TEXT NOT NULL UNIQUE,
  navn        TEXT NOT NULL,
  beskrivelse TEXT,
  kapacitet   INTEGER,                 -- default for nye ophold. NULL = skal sættes på opholdet.
  prismodel   TEXT NOT NULL CHECK (prismodel IN ('per_person','hele_stedet')),
  hele_stedet INTEGER NOT NULL DEFAULT 0 CHECK (hele_stedet IN (0,1)),
  pris_fra    INTEGER,                 -- hele kroner. NULL = ikke sat.
  pris_note   TEXT,                    -- hvorfor der ikke er pris, eller hvad prisen dækker.
  inkluderet  TEXT,                    -- fx «seng, mad, sauna»
  sortering   INTEGER NOT NULL DEFAULT 0,
  oprettet    TEXT NOT NULL
);

-- Dates are inclusive. Adjacent days (ends the 8th, starts the 9th) are
-- free. Sharing a calendar day is overlap. Checkout/checkin same day is
-- not supported: the house cannot hold two exclusive groups on one date.
CREATE TABLE ophold (
  id         TEXT PRIMARY KEY,
  type_id    TEXT NOT NULL REFERENCES opholdstyper(id),
  start_dato TEXT NOT NULL,
  slut_dato  TEXT NOT NULL,
  kapacitet  INTEGER NOT NULL CHECK (kapacitet >= 0),
  status     TEXT NOT NULL DEFAULT 'planlagt'
             CHECK (status IN ('planlagt','åben','fuld','lukket','afholdt')),
  pris       INTEGER,                  -- override af typens fra-beløb. NULL = brug typen.
  note       TEXT,
  oprettet   TEXT NOT NULL,
  CHECK (start_dato <= slut_dato)
);
CREATE INDEX idx_ophold_dato ON ophold(start_dato, slut_dato);
CREATE INDEX idx_ophold_type ON ophold(type_id);
CREATE INDEX idx_ophold_status ON ophold(status);

-- Person ↔ ophold. Afbudt tæller ikke med i kapacitet og må gentages.
CREATE TABLE pladser (
  id         TEXT PRIMARY KEY,
  ophold_id  TEXT NOT NULL REFERENCES ophold(id),
  person_id  TEXT NOT NULL REFERENCES people(id),
  status     TEXT NOT NULL DEFAULT 'forespurgt'
             CHECK (status IN ('forespurgt','bekræftet','betalt','afbudt')),
  pris       INTEGER,
  oprettet   TEXT NOT NULL
);
CREATE INDEX idx_pladser_ophold ON pladser(ophold_id);
CREATE UNIQUE INDEX idx_pladser_person ON pladser(ophold_id, person_id)
  WHERE status != 'afbudt';

-- Hele stedet udlejet blokerer alt andet i perioden. To ikke-eksklusive
-- spor (stille uger, campingvogne) må gerne overlappe. Afholdte ophold
-- optager ikke kalenderen.
CREATE TRIGGER ophold_ingen_overlap_ins
BEFORE INSERT ON ophold
WHEN NEW.status IN ('planlagt','åben','fuld','lukket')
BEGIN
  SELECT RAISE(ABORT, 'hele stedet er optaget i den periode')
  WHERE EXISTS (
    SELECT 1 FROM ophold o
    JOIN opholdstyper t_o ON t_o.id = o.type_id
    JOIN opholdstyper t_n ON t_n.id = NEW.type_id
    WHERE o.status IN ('planlagt','åben','fuld','lukket')
      AND NEW.start_dato <= o.slut_dato
      AND o.start_dato <= NEW.slut_dato
      AND (t_o.hele_stedet = 1 OR t_n.hele_stedet = 1)
  );
END;

CREATE TRIGGER ophold_ingen_overlap_upd
BEFORE UPDATE ON ophold
WHEN NEW.status IN ('planlagt','åben','fuld','lukket')
BEGIN
  SELECT RAISE(ABORT, 'hele stedet er optaget i den periode')
  WHERE EXISTS (
    SELECT 1 FROM ophold o
    JOIN opholdstyper t_o ON t_o.id = o.type_id
    JOIN opholdstyper t_n ON t_n.id = NEW.type_id
    WHERE o.id != NEW.id
      AND o.status IN ('planlagt','åben','fuld','lukket')
      AND NEW.start_dato <= o.slut_dato
      AND o.start_dato <= NEW.slut_dato
      AND (t_o.hele_stedet = 1 OR t_n.hele_stedet = 1)
  );
END;

-- Kapacitet: en optagende plads mere end der er rum til, afvises.
-- Når antallet rammer kapaciteten, skifter et åbent ophold selv til fuld.
-- Afbud tæller ikke, og opholdet åbner igen.
CREATE TRIGGER pladser_kapacitet_ins
BEFORE INSERT ON pladser
WHEN NEW.status IN ('forespurgt','bekræftet','betalt')
BEGIN
  SELECT RAISE(ABORT, 'opholdet er fuldt')
  WHERE (
    SELECT COUNT(*) FROM pladser
     WHERE ophold_id = NEW.ophold_id
       AND status IN ('forespurgt','bekræftet','betalt')
  ) >= (SELECT kapacitet FROM ophold WHERE id = NEW.ophold_id);
END;

CREATE TRIGGER pladser_kapacitet_upd
BEFORE UPDATE OF status ON pladser
WHEN NEW.status IN ('forespurgt','bekræftet','betalt')
 AND OLD.status NOT IN ('forespurgt','bekræftet','betalt')
BEGIN
  SELECT RAISE(ABORT, 'opholdet er fuldt')
  WHERE (
    SELECT COUNT(*) FROM pladser
     WHERE ophold_id = NEW.ophold_id
       AND status IN ('forespurgt','bekræftet','betalt')
  ) >= (SELECT kapacitet FROM ophold WHERE id = NEW.ophold_id);
END;

CREATE TRIGGER pladser_efter_ins
AFTER INSERT ON pladser
BEGIN
  UPDATE ophold SET status = 'fuld'
   WHERE id = NEW.ophold_id
     AND status = 'åben'
     AND kapacitet <= (
       SELECT COUNT(*) FROM pladser
        WHERE ophold_id = NEW.ophold_id
          AND status IN ('forespurgt','bekræftet','betalt')
     );
END;

CREATE TRIGGER pladser_efter_upd
AFTER UPDATE OF status ON pladser
BEGIN
  UPDATE ophold SET status = 'fuld'
   WHERE id = NEW.ophold_id
     AND status = 'åben'
     AND kapacitet <= (
       SELECT COUNT(*) FROM pladser
        WHERE ophold_id = NEW.ophold_id
          AND status IN ('forespurgt','bekræftet','betalt')
     );
  UPDATE ophold SET status = 'åben'
   WHERE id = NEW.ophold_id
     AND status = 'fuld'
     AND kapacitet > (
       SELECT COUNT(*) FROM pladser
        WHERE ophold_id = NEW.ophold_id
          AND status IN ('forespurgt','bekræftet','betalt')
     );
END;

CREATE TRIGGER ophold_aabnes_fuld
AFTER UPDATE OF status ON ophold
WHEN NEW.status = 'åben'
BEGIN
  UPDATE ophold SET status = 'fuld'
   WHERE id = NEW.id
     AND kapacitet <= (
       SELECT COUNT(*) FROM pladser
        WHERE ophold_id = NEW.id
          AND status IN ('forespurgt','bekræftet','betalt')
     );
END;

-- De seks spor sitet lover, plus lukkede uger. Priser: kun det, der
-- faktisk står på sitet i dag (850 kr. på mandegrupper). Resten har
-- en note om hvorfor beløbet mangler — ikke et opdigtet fra-beløb.
INSERT INTO opholdstyper
  (id, spor, navn, beskrivelse, kapacitet, prismodel, hele_stedet,
   pris_fra, pris_note, inkluderet, sortering, oprettet)
VALUES
 ('ot-mandegrupper', 'mandegrupper', 'Mandegrupper og rites of passage',
  'Stevens spor. Weekender for femten mænd: seng, mad, tre-fire timers arbejde på stedet og noget alvorligt om aftenen. Arbejdet er ikke betaling - det er grunden til, at prisen er en tredjedel af markedets.',
  15, 'per_person', 1, 850,
  'seng og al mad indgår · sauna · færgen betaler du selv',
  'seng, mad, sauna', 1, datetime('now')),
 ('ot-retreats', 'retreats', 'Retreats — vi er værter',
  'Andres forløb, midt i ugen. Hele stedet fra onsdag til mandag, med eller uden mad fra vores køkken. De første facilitatorer tager en chance på et sted uden anmeldelser - og det ved vi godt.',
  25, 'hele_stedet', 1, NULL,
  'Prisen aftales med facilitatorerne, når den første dato ligger fast.',
  NULL, 2, datetime('now')),
 ('ot-festival', 'festival', 'Festival',
  'Én vi selv laver, og én vi lægger plads til. Steven var partner i og medskaber af Tribal Vibe, så det er ikke et forsøg - det er dét, han kommer fra.',
  50, 'hele_stedet', 1, NULL,
  'Prisen sættes, når den første festivaldato ligger fast.',
  NULL, 3, datetime('now')),
 ('ot-bygmed', 'byg-med', 'Byg-med-uger',
  'En uge, hvor man arbejder på stedet, spiser med og bor her. Længere end en weekend og roligere. Ligger ikke samtidig med andet.',
  15, 'per_person', 1, NULL,
  'Prisen sættes, når den første uge ligger fast.',
  'seng, mad', 4, datetime('now')),
 ('ot-stille', 'stille', 'Stille uger og vinter',
  'Eget værelse, intet program, ingen mad. For dem der skal skrive, tænke eller bare væk. Om vinteren kan et værelse lejes på måneden.',
  8, 'per_person', 0, NULL,
  'Prisen sættes, når de første uger ligger fast.',
  NULL, 5, datetime('now')),
 ('ot-campingvogne', 'campingvogne', 'Campingvogne',
  'Plads til dem, der vil bo her i perioder. To priser: én for dem der kommer for at være, og en lavere for dem der kommer for at arbejde med.',
  6, 'per_person', 0, NULL,
  'To priser: én for at være, en lavere for at arbejde med. Beløbene sættes, når pladserne åbner.',
  NULL, 6, datetime('now')),
 ('ot-lukket', 'lukket', 'Lukkede uger',
  'Ingen gæster, intet salg. Et sted, der kan fylde 52 uger, brænder sine ejere af i år ét.',
  0, 'hele_stedet', 1, NULL,
  'Ikke til salg.',
  NULL, 7, datetime('now'));
