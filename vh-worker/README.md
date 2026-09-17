# Vendhjem Fonds-CRM

Bor på `vendhjem.dk/internt/fonde`, bag den Cloudflare Access der allerede står
foran `/internt`. Data i D1, bilag i R2. Alt andet på domænet serveres som
statiske filer af `[assets]` og rører aldrig denne kode.

## Læs det her, før du bygger en flade

Kontrakten står øverst i `assets/vh.css`. Én skærm. Hvis den er længere, følger
ingen den.

- Brug `src/flade.js` (side, mitSide, nav, tabel, felt, knap, statusPil, tomTilstand,
  fejlTilstand) og `src/tekst.js`. Opfind ikke en ottende variant.
- `/mit` er fællesskabets login og ligger uden for Access. `/internt` røres ikke.
- Kun klasser der findes i `vh.css`. Ingen runde hjørner, ingen skygger, ingen
  kort i rækker. `--accent` højst to gange pr. sektion. Ny farve er forbudt.
- Navigationen kommer fra `nav-internt.json`. Ret aldrig `src/nav-internt.js`.
- Prøve 11 og 13 i `test/koer.mjs` fanger drift: to navigationer, ukendt klasse,
  farve uden for paletten. Prøve 14 dækker `/mit`.

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

`0003_people.sql` (BYG-555 A1) og `0004_mit.sql` (BYG-556 A2) er **ikke**
applied remote fra denne PR. Denne agent har ingen Cloudflare-token
(`/tmp/.cf_token_vh` findes ikke her). Steven kører, når D1 Write er på
det token der deployer:

    npx wrangler@4 d1 migrations apply vendhjem-fonde --remote

Opfind ikke at D1 Write eller Workers R2 Storage Write findes i en given
kørsel. Uden D1 Write nægter wrangler apply. Uden R2 Write kan bilag ikke
lægges op, selv om GET-sundhedstjekket kan svare.

Workeren med A1-koden skal ikke deployes, før 0003 er applied: `ansvarlig`
er person_id, og fladen slår navnet op i `people`. A2 (`/mit`) skal ikke
deployes, før 0004 er applied: magic_links/passkeys-tabellerne.

## Community-login /mit (BYG-556 A2)

`/mit` ligger **uden for** Access. Cloudflare Access bliver på `/internt`
(fonde, økonomi, kerne). Fællesskabet kan ikke sidde på Access — det
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

Den returnerer **tal, aldrig indhold**: antal sager, krav, bilag, godkendelser
og indsendelser, plus om D1 og R2 svarer. Ingen titler, beløb, navne eller
filnavne. Formålet er at opdage at en binding er faldet ud, før et menneske
opdager det. `test/flader.sh` bruger den.

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

## Det, der bevidst ikke er bygget endnu

AI-skriveren fra BYG-545-AI-KERNE. Korpus, stemmeprofil, fondssøgning,
kravudtræk og svarudkast. Modellen her er skåret til det, LDP-fristen kræver;
`awards`, `obligations`, `disbursements` og budgetversioner kommer, når det
første tilsagn findes. Rækkefølgen er med vilje: sagen skal kunne bæres af
mennesker, før en model får lov at skrive i den.
