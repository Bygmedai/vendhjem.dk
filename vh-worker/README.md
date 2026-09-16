# Vendhjem Fonds-CRM

Bor på `vendhjem.dk/internt/fonde`, bag den Cloudflare Access der allerede står
foran `/internt`. Data i D1, bilag i R2. Alt andet på domænet serveres som
statiske filer af `[assets]` og rører aldrig denne kode.

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

## Kør prøverne

    node test/koer.mjs

33 prøver. Rigtige migrationer og rigtig SQL mod `node:sqlite`; kun D1, R2 og
Access er stubbet. Prøverne skal være grønne før deploy.

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

## Deploy

    CLOUDFLARE_API_TOKEN=$(cat /tmp/.cf_token_vh) npx wrangler@4 deploy

`workers_dev = false` og `preview_urls = false` i `wrangler.toml` **må ikke
fjernes**. Uden dem slår wrangler workers.dev til igen ved hvert deploy, og så
ligger `/internt` åbent uden for Access. Målt åbent i S592.

`LOKAL_TEST` sættes kun på kommandolinjen ved `wrangler dev`, står aldrig i
`wrangler.toml`, og grenen kræver desuden at værten er localhost. Efter hvert
deploy måles det, at den ikke kan nås i produktion.

## Det, der bevidst ikke er bygget endnu

AI-skriveren fra BYG-545-AI-KERNE. Korpus, stemmeprofil, fondssøgning,
kravudtræk og svarudkast. Modellen her er skåret til det, LDP-fristen kræver;
`awards`, `obligations`, `disbursements` og budgetversioner kommer, når det
første tilsagn findes. Rækkefølgen er med vilje: sagen skal kunne bæres af
mennesker, før en model får lov at skrive i den.
