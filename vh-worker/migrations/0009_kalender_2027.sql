-- År-0-kalender 2027 · syv lukkede uger + et minimalt sæt åbne ophold.
--
-- `/sporene` lover syv lukkede uger. `ot-lukket` ligger i 0007 med
-- hele_stedet = 1; overlap-triggeren gør en lukket uge usælgelig.
--
-- Kalender 2027 / AGERSOE-DRIFT-2027 ligger ikke i repoet. Vildes
-- driftsplan (PR #24) målte arket: nul uger med koden LUKKET, ni JER-uger
-- i jan–apr, gæstesæson fra uge 17, festival i uge 27. Vi opfinder ikke
-- 52 uger. Syv rigtige ISO-uger spredt over året, plus en håndfuld åbne
-- ophold med de typer der allerede findes.
--
-- De syv uger er ISO 8601 mandag–søndag, ikke klemt i januar:
--   6, 18, 28, 36, 40, 45, 51. Uge 28 ligger lige efter festivalen.
--
-- Remote apply: wrangler d1 migrations apply vendhjem-fonde --remote
-- Denne agent har ikke Cloudflare-token. 0009 er seed og SKAL applies
-- remote, ellers bliver `/sporene` ved med at sige «ingen datoer».
-- Opfind ikke at tokenet findes her.

INSERT INTO ophold
  (id, type_id, start_dato, slut_dato, kapacitet, status, pris, note, oprettet)
VALUES
 -- Syv lukkede uger. Status lukket, kapacitet 0, ikke til salg.
 ('op-lukket-2027-u06', 'ot-lukket', '2027-02-08', '2027-02-14', 0, 'lukket', NULL,
  'ISO-uge 6 · vinterro. Ingen gæster, intet salg.', datetime('now')),
 ('op-lukket-2027-u18', 'ot-lukket', '2027-05-03', '2027-05-09', 0, 'lukket', NULL,
  'ISO-uge 18 · pause efter sæsonstart (uge 17).', datetime('now')),
 ('op-lukket-2027-u28', 'ot-lukket', '2027-07-12', '2027-07-18', 0, 'lukket', NULL,
  'ISO-uge 28 · ro efter festivalen i uge 27.', datetime('now')),
 ('op-lukket-2027-u36', 'ot-lukket', '2027-09-06', '2027-09-12', 0, 'lukket', NULL,
  'ISO-uge 36 · efterår.', datetime('now')),
 ('op-lukket-2027-u40', 'ot-lukket', '2027-10-04', '2027-10-10', 0, 'lukket', NULL,
  'ISO-uge 40 · efterår.', datetime('now')),
 ('op-lukket-2027-u45', 'ot-lukket', '2027-11-08', '2027-11-14', 0, 'lukket', NULL,
  'ISO-uge 45 · senhøst.', datetime('now')),
 ('op-lukket-2027-u51', 'ot-lukket', '2027-12-20', '2027-12-26', 0, 'lukket', NULL,
  'ISO-uge 51 · jul. Ingen gæster, intet salg.', datetime('now')),

 -- Tre mandeweekender (fredag–søndag). Én bærer 850 kr. eksplicit;
 -- de to andre bruger typens fra-beløb.
 ('op-mande-2027-05', 'ot-mandegrupper', '2027-05-14', '2027-05-16', 15, 'åben', 850,
  'Mandeweekend. Seng, mad, sauna. Færgen betaler du selv.', datetime('now')),
 ('op-mande-2027-10', 'ot-mandegrupper', '2027-10-15', '2027-10-17', 15, 'åben', NULL,
  'Mandeweekend. Seng, mad, sauna. Færgen betaler du selv.', datetime('now')),
 ('op-mande-2027-12', 'ot-mandegrupper', '2027-12-10', '2027-12-12', 15, 'åben', NULL,
  'Mandeweekend. Seng, mad, sauna. Færgen betaler du selv.', datetime('now')),

 -- Festival uge 27, som driftsplanen navngiver. Prisen er ikke sat.
 ('op-festival-2027-u27', 'ot-festival', '2027-07-05', '2027-07-11', 50, 'åben', NULL,
  'ISO-uge 27 · egen festival. Prisen sættes, når billetterne åbner.', datetime('now')),

 -- Retreat-pladsholder: onsdag–mandag, som typen beskriver. Prisen aftales.
 ('op-retreat-2027-10', 'ot-retreats', '2027-10-20', '2027-10-25', 25, 'åben', NULL,
  'Retreat. Hele stedet onsdag–mandag. Prisen aftales med facilitatorerne.', datetime('now'));
