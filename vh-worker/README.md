# Vendhjem Fonds-CRM

Bor på `vendhjem.dk/internt/fonde`, `/internt/korpus` og `/internt/ophold`,
bag den Cloudflare Access der allerede står foran `/internt`. `/mit`
(fællesskabets login) ligger uden for Access. Den offentlige kalender er
`/sporene`. Data i D1, filer i R2. Alt andet på domænet serveres som
statiske filer af `[assets]` og rører aldrig denne kode.

## Læs det her, før du bygger en flade

Kontrakten står øverst i `assets/vh.css`. Én skærm. Hvis den er længere, følger
ingen den.

- Brug `src/flade.js` (side, mitSide, nav, tabel, felt, knap, statusPil, tomTilstand,
  fejlTilstand) og `src/tekst.js`. Opfind ikke en ottende variant. Ophold
  (`src/ophold-sider.js`) bruger det samme.
- `/mit` er fællesskabets login og ligger uden for Access. `/internt` røres ikke.
- Kun klasser der findes i `vh.css`. Ingen runde hjørner, ingen skygger, ingen
  kort i rækker. `--accent` højst to gange pr. sektion. Ny farve er forbudt.
- Navigationen kommer fra `nav-internt.json`. Ret aldrig `src/nav-internt.js`.
- Prøve 11 og 13 i `test/koer.mjs` fanger drift: to navigationer, ukendt klasse,
  farve uden for paletten. Prøve 14 dækker `/mit`. Prøve 15–21 dækker korpus
  og fondimport. Prøve 22 og 23 dækker ophold og `/sporene`.

Sådan bygger du en korrekt flade uden at spørge. Redesign, nye farver og React
er uden for scope.

## Hvorfor det ikke ligger i bygmedai-portalen

Sirius' arkitektur (BYG-545) foreslog at forke portalen og bygge ovenpå, med
delt Supabase-database. Det er fravalgt i S593, og det skal stå her, så ingen
tror det var en forglemmelse:

- Auth findes allerede. Access slipper kun gruppen «Vend Hjem – medlemmer»
  igennem og sender en signeret identitet med hvert kald. Nul auth-kode.
- Arkitekturens §7 bruger et helt afsnit på delt-database-problemet:
  rollekollision, org-adskillelse, at fuld restore rammer begge forretninger.
  Det problem opstår ikke, når Vendhjems data ikke ligger i BygMedAIs database.
- Acceptkriterie 9 («BygMedAI kan stadig sende en faktura») og 14 (ingen
  hardkodet portal-titel) opfyldes ved ikke at røre portalen.
- Et nyt Supabase-projekt koster 10 USD/md. D1 og R2 er gratis i denne
  størrelse. Vendhjem har ingen omsætning endnu.

Prisen: hvis værktøjet en dag skal sælges til andre foreninger, skal det
flyttes. SQLite → Postgres er en trådt sti, og datamodellen er skrevet så den
kan bære det.

## Identitet

`src/access.js` verificerer selv JWT'en fra Access mod teamets certifikater
— signatur, `aud`, `iss` og `exp`. Vi stoler ikke på headeren alene, for så
kunne enhver der nåede Workeren uden om Access påstå at være hvem som helst.

Servicetokens kan læse. De kan ikke godkende eller indsende: en maskine må ikke
stå som den, der traf beslutningen.

## Den mekanik, der bærer det hele

Hver godkendelse bindes til `pakke_hash` — et SHA-256 over sagens
beslutningsbærende felter og præcis hvilke bilagsversioner der lå der.

Ændrer nogen et bilag eller beløbet bagefter, passer hashen ikke længere:
sagen siger det højt, og forsøg på at registrere den som indsendt afvises.
Det er hele pointen. En godkendelse gælder det, bestyrelsen faktisk så.

## Navigationen har én kilde

`nav-internt.json` i repo-roden. `build.py` renderer de statiske interne sider
fra den og **genererer** `src/nav-internt.js`, som `flade.js` importerer.

Redigér aldrig `src/nav-internt.js` i hånden — den overskrives ved hvert build.

Baggrund: listen lå to steder og drev fra hinanden. Fonde manglede på de
statiske sider, Registrering manglede i fondsværktøjet, og man kunne derfor
ikke komme fra Økonomi til Fonde. To lister holdt i sync af hukommelse er et
løfte, hukommelsen ikke kan holde. Prøve 11 i `test/koer.mjs` sammenligner de
to renderede navigationer og fejler, hvis de igen er forskellige.

## Kør prøverne

    node test/koer.mjs

Kør `python3 build.py` først, så `internt/oekonomi.html` findes (gitignored) —
prøve 11 sammenligner den interne navigation. Rigtige migrationer og rigtig
SQL mod `node:sqlite`; kun D1, R2 og Access er stubbet. Prøverne skal være
grønne før deploy.

## Flader — mål dem, husk dem ikke

    ./test/flader.sh

Køres efter **hvert** deploy. Den måler hver intern sti på **begge** værter og
leder efter interne tal i svarene, også gennem redirects.

Baggrund: i S592 målte jeg kun apex og meldte grønt. `www.vendhjem.dk/internt`
lå åbent med BBR-data og økonomi frit læsbart, indtil Steven fandt det dagen
efter. Access var bundet til `vendhjem.dk`-stier; www er en anden vært og var
ikke dækket.

Lukket i to lag, med vilje:

1. Egne Access-apps på `www.vendhjem.dk/internt` og `/internt/*`.
2. Workeren sender alt på www til apex, før noget serveres.

Ét lag ville have været nok. To betyder, at et fejlgreb i konfigurationen ikke
åbner hullet igen alene.

## Migrationer

`0001_init.sql` og `0002_seed_ldp.sql` blev kørt i produktion gennem
Cloudflare-connectoren, før tokenet havde skriveadgang, og er bagefter
registreret i `d1_migrations`. De køres ikke igen.

`0003`–`0007` ligger alle på main. **Status i produktion, målt 17.09.2026
med kald mod den levende flade — ikke læst i en fil:**

| Migration | Målt | Hvordan |
|---|---|---|
| `0003_people` · `0004_mit` | **applied** | `GET /mit` → 200 med magic-link-formularen. Uden `people`, `magic_links` og `passkeys` kan den side ikke rendere; uden `SESSION_NOEGLE` svarer den 500 |
| `0005_korpus` · `0006_fonde_e2` | **ikke målt herfra** | `/internt/korpus` ligger bag Access (302), og `/sundhed/fonde` kræver headeren. Mål det med sundhedstjekket — det tæller `korpus_dokumenter` |
| `0007_ophold` | **applied** | `GET /sporene` serveres fra D1, ikke fra assets: den leverede side skriver «Retreats — vi er værter» med tankestreg, og den tankestreg findes kun i seed-rækken i `0007`. Den statiske `sporene.html` har bindestreg |

Denne tabel stod indtil 17/9 som «`0007_ophold.sql` er **ikke** applied
remote fra denne PR». Det var sandt da PR'en blev skrevet og forkert
bagefter, og en agent, der troede på den, brugte en time på at planlægge
en bygning af noget, der allerede kørte. **Det er derfor rækken siger
hvordan den er målt og ikke bare hvad der gælder** — jf. repoets egen
regel: enhver påstand om tilstand skal komme fra et kald.

Kører du en migration, så mål bagefter og ret tabellen her. En status
skrevet ud fra hvad man lige har gjort, er en hukommelse, ikke en måling.

En agent uden Cloudflare-token (`/tmp/.cf_token_vh` findes ikke i alle
kørsler) kan ikke køre apply. Steven kører, når D1 Write er på det token
der deployer:

    npx wrangler@4 d1 migrations apply vendhjem-fonde --remote

Opfind ikke at D1 Write eller Workers R2 Storage Write findes i en given
kørsel. Uden D1 Write nægter wrangler apply. Uden R2 Write kan bilag og
korpusfiler ikke lægges op, selv om GET-sundhedstjekket kan svare.

Workeren med A1-koden skal ikke deployes, før 0003 er applied: `ansvarlig`
er person_id, og fladen slår navnet op i `people`. A2 (`/mit`) skal ikke
deployes, før 0004 er applied: magic_links/passkeys-tabellerne. E1/E2-koden
skal ikke deployes, før 0005 og 0006 er applied: korpus-tabellerne og
`requirements.slags` findes ellers ikke, og sundhedstjekket tæller
`korpus_dokumenter`. Workeren med C1 skal ikke deployes, før 0007 er
applied: `/sporene` og `/internt/ophold` læser `opholdstyper` / `ophold` /
`pladser`.

## Community-login /mit (BYG-556 A2)

`/mit` ligger **uden for** Access. Cloudflare Access bliver på `/internt`
(fonde, økonomi, kerne, korpus, ophold). Fællesskabet kan ikke sidde på Access — det
gratis loft er 50 brugere.

Flow: skriv mail → få et link → klik → inde. Linket er engangs, 15 minutter,
og bundet til den browser der bad om det (cookie `vh_enhed`, HttpOnly).
Ukendt mail og udløbet rolle får **samme svar og samme svartid** som kendt:
«Hvis adressen hører til nogen her, ligger der en mail nu.»

Session: cookie `vh_session`, HttpOnly, Secure, SameSite=Lax, HMAC-SHA256
med `SESSION_NOEGLE` via `crypto.subtle`. 90 dage, fornyes stille ved brug.

Passkey er et **tilbud** efter første login, aldrig et krav. Afvisning
huskes (`people.passkey_tilbud = 'nej'`). Ingen Clerk/Auth0/WorkOS.

### Hemmeligheder og mail

Sæt i Workeren (aldrig i `wrangler.toml`):

    npx wrangler@4 secret put SESSION_NOEGLE
    npx wrangler@4 secret put RESEND_API_KEY

- `SESSION_NOEGLE` — mindst 32 tilfældige bytes. Uden den svarer `/mit` 500.
- `RESEND_API_KEY` — sender magic-link-mailen. **Uden den logges URL'en
  til Worker's logs** (`[mit] ingen RESEND_API_KEY`). Det er den bevidste
  dev-sti. Produktionssending virker ikke, før nøglen er sat **og**
  afsenderdomænet er verificeret hos Resend.
- `MAIL_FRA` — valgfri. Default `Vendhjem <besked@vendhjem.dk>`. Skal
  matche et verificeret Resend-domæne.

Opfind ikke at mail virker i produktion uden de nøgler. Prøverne bruger
en `mailSink` og rører ikke Resend.

`./test/flader.sh` måler at `/mit` **ikke** sender til `cloudflareaccess.com`,
og at `/internt` stadig aldrig svarer 200.

Produktionsdatabasen: `vendhjem-fonde`, `f1cacc8c-2720-400e-906a-64f2627789e8`,
WEUR. Bilag i R2-bucket'en `vendhjem-fonde-bilag`.

## Sundhedstjek

    curl -H "X-VH-Sundhed: $(cat /tmp/.vh_sundhed)" https://vendhjem.dk/sundhed/fonde

Ligger **uden for** `/internt`, fordi Access ellers svarer før Workeren og
tjekket aldrig når frem. Uden den rigtige header svarer den 404 og røber ikke
engang at den findes. Nøglen hedder «Vendhjem sundhedsnøgle» i Bitwarden.

Den returnerer **tal, aldrig indhold**: antal sager, krav, bilag, godkendelser,
indsendelser og korpus-dokumenter, plus om D1 og R2 svarer. Ingen titler, beløb,
navne eller filnavne. Formålet er at opdage at en binding er faldet ud, før et
menneske opdager det. `test/flader.sh` bruger den.

## Deploy

    CLOUDFLARE_API_TOKEN=$(cat /tmp/.cf_token_vh) npx wrangler@4 deploy

`workers_dev = false` og `preview_urls = false` i `wrangler.toml` **må ikke
fjernes**. Uden dem slår wrangler workers.dev til igen ved hvert deploy, og så
ligger `/internt` åbent uden for Access. Målt åbent i S592.

`LOKAL_TEST` sættes kun på kommandolinjen ved `wrangler dev`, står aldrig i
`wrangler.toml`, og grenen kræver desuden at værten er localhost. Efter hvert
deploy måles det, at den ikke kan nås i produktion.

## Personregister (BYG-555 A1)

`people` er ét menneske, én post. `roles` er person ↔ rolle med
`gyldig_fra` / `gyldig_til`. Udløb rører ikke personposten.

Mail er nuværende kontaktpunkt, ikke identitet. `hentPerson(mail)` slår op på
den mail der står nu. Skiftes mailen, finder den gamle ikke personen, og
sager der peger på `person_id` bliver stående.

Interne helpers i `src/db.js`: `hentPerson`, `roller`, `harRolle`,
`opretPerson`, `tildelRolle`, `udloebRolle`, `skiftMail`,
`personMedGyldigRolle`. Login-UI er `/mit` (A2). Invitationer er B.

## Korpus og stemmeprofil (BYG-567 E1)

`/internt/korpus`, bag samme Access. Metadata i D1 (`korpus_dokumenter`),
filer i R2 under præfikset `korpus/`.

Tre slags, håndhævet i `src/korpus.js` — ikke i en vejledning:

- **stemme** — ordvalg og rytme. `somGrundlag(..., 'fakta')` afviser.
- **fakta** — aktuelle oplysninger.
- **historik** — hvad der er lovet før. Ikke det der er sandt nu.

Et dokument uden `godkendelsesstatus = godkendt` kan ikke bruges som grundlag.
Ændres et kildedokument, markeres tilknyttede `arbejdsgrundlag` til
`til_genvurdering`. Arbejdsgrundlag knyttet til en **indsendt** ansøgning
springes over; ansøgningen omskrives ikke.

Stemmeprofilen er dokumentet `korpus-stemmeprofil` (slags stemme). Den
indeholder de fem forbudte AI-mønstre fra BYG-544. Agenten kan læse den
senere via `hentStemmeprofil`. Der skrives ikke ansøgninger her.

## Find fondene (BYG-568 E2)

Vi ejer sagerne. Vi bygger ikke et fondskatalog og scraper ikke Fonde.dk.

`/internt/fonde/ny` lægger fond, runde, frist og krav ind. Fristens
**ordlyd** gemmes som kilden skriver den. Hvis ugedagen ikke passer med
datoen, står det som `frist_note`. Datoen rettes aldrig i stilhed.

Krav uden kilde er **antagelse**. `adgangskrav` og `vurderingskriterium`
er adskilt. Et bekræftet uopfyldt adgangskrav blokerer «Markér klar», men
ikke arkiv og ikke historisk indsendelse.

LDP-sagen i seed er et eksempel. Den kan genskabes fra importfladen.
Landdistriktspuljen er ikke produktets mål.

### Fonde.dk via Slagelse Kommune — uafklaret

Slagelse Kommune tilbyder gratis Fonde.dk-adgang til foreninger med CVR
i kommunen (op til tre bestyrelsesbrugere):
<https://www.slagelse.dk/da/fritid-og-faellesskab/tilskud-og-puljer/faa-gratis-adgang-til-fondedk/>

Egholmvej 23 ligger i Slagelse Kommune. **Det er ikke verificeret for
Vendhjem.** Foreningen har ikke CVR endnu (`cvr_status = under_stiftelse`).
Feltet `organizations.fondedk_note` er til menneskets svar, når kommunen
har svaret. Status i seed: `afventer_cvr`. Vi scraper ikke Fonde.dk.

## Ophold og kalender (BYG-561 C1)

`opholdstyper` er de seks spor plus lukkede uger. `ophold` er et konkret
dato-interval. `pladser` er person ↔ ophold.

Dobbeltbooking på hele stedet er umulig i databasen: et ophold med
`hele_stedet = 1` overlapper ikke et andet beboende ophold
(planlagt/åben/fuld/lukket). Stille uger og campingvogne er ikke
eksklusive og må gerne ligge samtidig. Fyldt kapacitet skifter selv til
`fuld`; afbud tæller ikke og åbner opholdet igen.

Intern flade: `/internt/ophold`, bag den samme Access som resten af
`/internt`. Offentlig kalender: `/sporene`, uden Access, uden `/mit`.
Er kalenderen tom, står der det — ikke «datoer kommer». Priser vises når
de er sat (850 kr. på mandegrupper); ellers står der hvorfor.

Betaling er D1. Selvbetjent forespørgsel er C2. Airbnb og rengøring er
uden for scope.

## Det, der bevidst ikke er bygget endnu

AI-skriveren fra BYG-545-AI-KERNE. Fondssøgning, embeddings, automatisk
kravudtræk fra PDF, match-scoring og svarudkast. `awards`, `obligations`,
`disbursements` og budgetversioner kommer, når det første tilsagn findes.
Rækkefølgen er med vilje: korpus og sager skal kunne bæres af mennesker,
før en model får lov at skrive i dem.
