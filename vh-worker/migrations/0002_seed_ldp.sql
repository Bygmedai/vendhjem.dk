-- Seed: ansøger, LDP-runde og LDP-sagen med bilagsliste.
-- S593 · 16.09.2026
--
-- Alt her er enten målt mod en kilde eller markeret som uafklaret. Intet er
-- gættet. Foreningen står som «under_stiftelse», fordi den ikke er registreret
-- — værktøjet må ikke få den til at se ud som om den findes.

INSERT INTO organizations (id, navn, cvr, cvr_status, formaal, adresse, tegningsregel, oprettet) VALUES (
  'org-vendhjem',
  'Vend Hjem (forening under stiftelse)',
  NULL,
  'under_stiftelse',
  'Almennyttig drift af stedet på Egholmvej 23, Agersø: ophold, fællesskab, værksted og kulturelle aktiviteter.',
  'Egholmvej 23, Agersø, 4230 Skælskør',
  'Ikke fastlagt. Vedtægter og bestyrelse mangler. Uden tegningsregel kan ingen underskrive på foreningens vegne.',
  datetime('now')
);

INSERT INTO funds (id, navn, program, url, noter, oprettet) VALUES (
  'fond-ldp',
  'Den Nationale Landdistriktspulje',
  'Småøer',
  'https://www.livogland.dk/den-nationale-landdistriktspulje/projekter-paa-de-smaa-oeer',
  '2,7 mio. kr. er afsat til projekter på de små øer i denne runde (kilde: livogland.dk, set 16.09.2026). Agersø er på listen over de 27 småøer. Ansøgerkreds omfatter ifølge puljen også enkeltpersoner og virksomheder, ikke kun foreninger — den faktiske ansøgerform skal vurderes konkret.',
  datetime('now')
);

INSERT INTO calls (id, fund_id, navn, frist_utc, frist_tz, frist_ordlyd,
                   frist_kilde_url, frist_verificeret, frist_note, oprettet) VALUES (
  'call-ldp-2026-2',
  'fond-ldp',
  '2. runde 2026 · småøer',
  '2026-10-09T13:00:00Z',
  'Europe/Copenhagen',
  'torsdag 9. oktober 2026 kl. 15.00',
  'https://www.livogland.dk/nyheder/2026/aug/aabning-af-den-nationale-landdistriktspulje-2-runde-2026',
  '2026-09-16T00:00:00Z',
  'Kilden skriver «torsdag», men 9. oktober 2026 er en fredag. Datoen bruges som den står; ugedagen er uafklaret og skal bekræftes i ansøgningsportalen eller hos styrelsen, før planen låses. Fristen udskydes ikke på grund af uoverensstemmelsen.',
  datetime('now')
);

INSERT INTO applications (id, org_id, call_id, titel, status, beloeb_ansoegt, valuta,
                          ansvarlig, naeste_handling, intern_frist, oprettet, opdateret) VALUES (
  'app-ldp-2026',
  'org-vendhjem',
  'call-ldp-2026-2',
  'LDP Småøer 2026',
  'kladde',
  NULL,
  'DKK',
  'Steven',
  'Stift foreningen og få et CVR. Uden ansøgeridentitet kan resten ikke afsluttes.',
  '2026-10-02T12:00:00',
  datetime('now'), datetime('now')
);

-- Bilagsliste fra DESIGN-FONDS-CRM appendix. Hvert krav har en kilde, eller
-- er markeret som antagelse. Et krav uden kilde er en antagelse, ikke en regel.
INSERT INTO requirements (id, application_id, label, paakraevet, note, kilde, sortering) VALUES
 ('req-1','app-ldp-2026','Vedtægter',1,
  'Kræver at foreningen er stiftet.','LDP-vejledning · ansøgergrundlag',1),
 ('req-2','app-ldp-2026','Budget og finansieringsplan',1,
  'Skal kunne summeres og stemme med det ansøgte beløb.','LDP-vejledning',2),
 ('req-3','app-ldp-2026','Dokumentation for medfinansiering',1,
  'Kræves ved endeligt tilsagn. Lægges ind nu, så det ikke bliver en hastesag senere.','LDP-vejledning',3),
 ('req-4','app-ldp-2026','Projektbeskrivelse',1,
  NULL,'LDP-ansøgningsskema',4),
 ('req-5','app-ldp-2026','Interessetilkendegivelser / lokal opbakning',1,
  'Vurderingskriterium, ikke adgangskrav — men det er dét, ansøgninger typisk vindes og tabes på.','LDP-kriterier · småøer',5),
 ('req-6','app-ldp-2026','Bestyrelsesbeslutning om at søge',1,
  'Kan først laves, når der er en bestyrelse.','Almindelig foreningspraksis · ANTAGELSE',6),
 ('req-7','app-ldp-2026','CVR-registrering',1,
  'Mangler. Kritisk sti.','LDP-vejledning · ansøgergrundlag',7),
 ('req-8','app-ldp-2026','Rådighed over stedet: lejekontrakt eller tinglysning',0,
  'Det tidligere notat skrev «leje ≥ 5 år» som et ubetinget krav. Det er IKKE verificeret for denne runde og må ikke behandles som en regel, før anvendelsesområdet er dokumenteret. Frivilligt indtil da.','UVERIFICERET — skal tjekkes i vejledningen',8);

INSERT INTO activity_log (application_id, aktoer, handling, detalje, tidspunkt) VALUES
 ('app-ldp-2026','haruki','oprettede sagen','seed S593 · 16.09.2026', datetime('now'));
