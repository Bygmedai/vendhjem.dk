# CLAUDE.md — vendhjem.dk

**Status:** ratificeret 18.09.2026 (#46). Sidst målt på `29cf955`, samme dag.
Alt herunder er målt, ikke husket. Hvor jeg ikke har målt, står det.

Filen blev forældet under en time efter den blev merget — #45, #47, #48 og #49
landede imens. Det er ikke en undskyldning, det er et arbejdsvilkår: **ændrer du
en sti, en migration eller antallet af prøver, så ret den her fil i samme PR.**

**[Haruki, 18.09 — gennemgang]** Jeg har efterprøvet Vildes målinger i stedet for
at tage dem for pålydende. Han havde ret i det vigtigste, og det er nu lukket i
kode, ikke kun beskrevet. Tre påstande holdt ikke; de er rettet, hver med sin
måling. Mine tilføjelser er markeret **[Haruki]** — de erstatter det, der stod,
og ikke andet.

---

## Hvad det her er

`vendhjem.dk` er stedet på Agersø, som en offentlig flade og et internt værktøj.
Ikke et produkt med kunder. Et hus, en forening under opbygning, og en kalender
der skal kunne sælge 2027.

**Målet er kedeligt og konkret:** at driften i år 0 står af sig selv. Ikke
features. Se `docs/AAR-0-DRIFTSPLAN-2026-09-17.md` for hvad der bærer året, og
hvad der vælter det.

---

## Det, der oftest går galt

**Der er to udgaver af hver side, og den ene er den rigtige.**

`sporene.html` i roden er en statisk fil, som `build.py` skriver. Men `/sporene`
på nettet bliver **ikke** serveret fra den fil — Workeren fanger stien og bygger
siden live fra D1, fordi den skal vise datoer og ledige pladser.

Retter du copy i `build.py` og ser den på den statiske fil, kan den levende side
stadig sige noget andet. Det er sket (PR #42: fotoene lå på den statiske side og
manglede på den levende).

**Sådan afgør du hvilken der gælder:** find `env.ASSETS.fetch` i
`vh-worker/src/index.js` (linje 135 på `29cf955` — den flytter sig, så søg efter
udtrykket, ikke efter linjen). Alt, der returnerer før den, ejer Workeren. Alt,
der når ned til den, er en fil.

Workeren ejer i dag: `/sporene`, `/sporene/*`, **`/sporene.html`**, `/mit`,
`/mit/*`, `/bliv-en-del/skriv`, `/internt/ophold*`, `/internt/breve*`,
`/internt/fund*`, `/internt/vagter*`, `/internt/sikkerhedskopi*`,
`/internt/fonde*`, `/internt/korpus*`, `/sundhed/fonde`,
`/sundhed/sikkerhedskopi`. Resten er statiske filer.

**Fælden i navnet:** `/mit-offline` og `/mit-sw.js` hedder noget med «mit», men
Workeren fanger dem **ikke** — grenen matcher `/mit` og `/mit/*`, ikke `/mit-*`.
De er almindelige filer i roden (`mit-offline.html`, `mit-sw.js`,
`assets/mit.webmanifest`), og de skal blive ved med at være det: en service worker,
der bliver bygget af den Worker, den skal kunne overleve, er ikke offline-sikker.

Bemærk `/sporene.html`: Workeren fanger også filnavnet, så selv den direkte vej
til filen giver den levende side. Du kan altså ikke omgå den ved at skrive `.html`
i adresselinjen.

**Fælden i ø:** den offentlige formular ligger på `/sporene/foresporg/{id}`
(ASCII). Href, canonical og POST-action er den sti. `/sporene/forespørg/{id}`
og den procent-kodede ø 301'er (POST: 308). En ukendt `/sporene/...` er 404 —
ikke listen med 200. Det stod forkert: ASCII gav listen (soft-200), HEAD på ø
gav 404. Matcher og generator er `FORESPORG_STI` i `ophold-sider.js`.

---

## Byg og prøv

```
python3 build.py                 # skriver siderne + fire genererede JS-moduler
node vh-worker/test/koer.mjs     # 447 prøver. Kører i CI på hver PR — se «Porten»
bash vh-worker/test/flader.sh    # måler den levende flade
```

`build.py` skriver tre slags ting:

1. **Offentlige sider** i roden (`index.html`, `sporene.html`, …). De er
   committet.
2. **Interne sider** i `internt/`. De er **gitignored** og findes derfor ikke i
   et checkout. `udrul.yml` kører `build.py` før deploy, netop fordi de ellers
   ville blive 404 bag Access. Det skete 17.09.2026.
3. **Fire genererede JS-moduler** til Workeren — `nav-internt.js`, `fotos.js`,
   `fod.js`, `stigen.js`. De **er** committet, fordi Workeren ikke kan køre
   `build.py` ved deploy.

**Konsekvens:** ændrer du `nav-internt.json`, `stigen.json` eller et foto, så kør
`build.py` og commit begge dele. Glemmer du det, driver kilden og koden fra
hinanden.

**[Haruki 18.09]** Det fanges nu i porten, ikke af en enkelt prøve: jobbet
`Worker-prøver` kører `build.py` og fejler, hvis et committet resultat ændrer sig.
Det dækker alle fire moduler og de byggede sider på én gang.

Beskrivelsen af prøverne var til gengæld for optimistisk. Prøve 28 sammenligner
`stigen.json` med `stigen.js` — den er en ægte kilde-mod-genereret-prøve. Prøve 27
gør **ikke** det samme for `fotos.js`; den tjekker kun, at modulet er internt
konsistent (hvert foto har mål og alt-tekst). Prøve 11 sammenligner de to
navigationer med **hinanden**, ikke med `nav-internt.json` — er begge forældede,
består den. Porten er det, der dækker hullet.

---

## Hegnene

De står, fordi de er blevet brudt. Fjern dem ikke, fordi de ser overflødige ud.

| Hegn | Hvor | Hvorfor det står |
|---|---|---|
| `workers_dev = false`, `preview_urls = false` | `vh-worker/wrangler.toml` | Uden dem slår wrangler workers.dev til igen, og `/internt` ligger åbent uden om Access. Målt åbent i S592. |
| `.assetsignore` | roden | `[assets] directory = "../"` uploader **hele repoet**. Uden filen lå `/.git/`, `/vh-worker/src/`, `wrangler.toml` og `build.py` åbent på vendhjem.dk. Målt 17.09.2026 (S594). |
| Sti-hegnet i `build.py` | `RELATIV` / `_find_relative` | En relativ sti virker på `/fundamentet` og knækker på `/internt/timer`. Bygget i PR #30. **Det tjekker at en sti er absolut — ikke at den peger på noget, der findes.** Jeg lavede præcis den fejl selv i #30; Haruki fandt den. |
| Overlaps- og kapacitets-triggere | `0007_ophold.sql` | To ophold må ikke dække samme nat, og et ophold må ikke overbookes. Håndhævet i databasen, ikke i app-kode. **De fyrer også ved en gendannelse** og afviser så den kalender, de beskytter — målt 18.09.2026, første gang nogen læste en kopi tilbage. Derfor gemmer kopien triggerne, og `genskabSql` tager dem ned omkring indsættelsen og sætter dem op igen. Prøve 37 gør det ved hver kørsel. |
| Forespørg-hegnet | `0016_foresporg_hegn.sql` + `hegn.js` | Offentlig POST uden login. CSRF (signeret felt + SameSite-cookie), honningkrukke, rate pr. IP/mail i D1. Uden dem er kalenderen en sluse til `people` og Resend. |
| Sikkerhedshoveder | `hegn.js` `medSikkerhed` | CSP, HSTS, X-Frame-Options, Referrer-Policy, X-Content-Type-Options på alle Worker-svar. Cookies var allerede HttpOnly/Secure/SameSite=Lax. CSP tillader `'unsafe-inline'` fordi /mit har inline script (SW + passkeys). |
| Access på `/internt` **og** `www.vendhjem.dk/internt` | Cloudflare | www-varianten lå åben i et døgn i september. `udrul.yml` måler begge i sit readback. |

`.assetsignore` er en **deny-liste**. En ny fil i roden er offentlig, indtil nogen
skriver den på listen. `/stigen.json` og `/images/sted/_manifest.json` lå åbne af
præcis den grund og blev lukket i #52. Mekanikken er nu håndhævet af **prøve 35**,
som vender listen om: hver fil i roden skal være *besluttet* — enten offentlig med
vilje eller på `.assetsignore`. Er den ingen af delene, falder porten, og
spørgsmålet «må en fremmed hente den her?» bliver stillet før udrulningen.
Prøven er Vildes; falsificeret i #52.

---

## Udrulning

**Merge til main = udrulning.** Ingen knap. `udrul.yml` kører på hver push til
main: `build.py` → migrationer til D1 → `wrangler deploy` → readback.

Knappen findes stadig som nødløsning under Actions → «Udrul til Cloudflare».

Tokenet hedder `CLOUDFLARE_API_TOKEN` og ligger som GitHub-hemmelighed. Det står
aldrig i repoet, i en fil eller i en log. **Ingen skal køre wrangler i hånden.**
Frem til 17.09.2026 skulle et menneske det, med et token fra en sti der ikke
findes på en Windows-maskine — og fire mergede PR'er lå uden for databasen, mens
den side, der skal sælge året, sagde «ingen datoer».

**Kun readbacket må hævde at noget er udrullet.** En kommando, der kom tilbage
uden fejl, er en påstand. Et kald er en måling.

**Porten [Haruki 18.09].** `test.yml` har nu fem jobs. Det første, **`Worker-prøver`**,
kører `build.py`, fejler hvis det ændrer en committet fil, og kører derefter
`koer.mjs`. Det er det eneste sted i CI, der rører `vh-worker/`. Bliver det rødt,
skal en PR ikke merges — for merge er deploy.

Workeren har også en **cron** (`[triggers] crons = ["0 4 * * *"]`): hver nat
klokken 04:00 UTC skrives hele D1 som almindelig JSON til R2, inklusive
trigger-definitionerne. Se `src/sikkerhedskopi.js`. Den kører uden for enhver
anmodning — ændrer du skemaet, så husk at den også læser det.

Den stod til den 1. i måneden indtil #57. Workeren blev udrullet den 18.,
så første kopi ville være skrevet 1. oktober; i tretten døgn fandtes
kalenderen, brevene og timerne kun ét sted. **Knappen på
`/internt/sikkerhedskopi`** (bag Access, i den interne menu) tager en kopi nu
og viser, hvornår den nyeste blev skrevet og hvor gammel den er — tal og
datoer, aldrig indhold. Gendannelsesvejen står på samme side.

Der findes **to formater**: JSON fra cron og knappen (maskinen, hver nat,
ingen wrangler), og SQL fra `wrangler d1 export` (et menneske, i hånden, før
noget stort). Begge beholdes. Hvilken der er hvilken, står i
`docs/SIKKERHEDSKOPI.md`, når #56 er inde.

---

## Vagter: reglerne ligger i skemaet

Tilføjet 18.09.2026 (PR #58, BYG-583).

En vagt er **et tidspunkt med pladser**, ikke en opgave med en ansvarlig. Der er
ingen `ansvarlig`-kolonne og ingen `status`: en vagt er dækket, når der står
folk på den, og dækningen bliver **udregnet** af rækkerne i `paa` — aldrig gemt
som et tal, der kan blive forkert.

Tre hegn står i `0015_vagter.sql`, ikke i en handler, og de skal blive der:

| Hegn | Hvad det spærrer |
| --- | --- |
| `PRIMARY KEY (vagt_id, person_id)` | dobbeltklik på dårligt net er ikke to tilmeldinger |
| `paa_kapacitet_ins` | to telefoner, der begge har talt seks ud af otte |
| `paa_ikke_fortid` | en gammel side i en fane er en knap, der stadig virker |

Flytter du dem op i JavaScript, fordi det er lettere at læse, holder de op med
at virke i præcis de tilfælde, de er bygget til. `db.js` oversætter kun
databasens indsigelse til dansk.

**Kortet tegnes ét sted**, `vh-worker/src/vagter.js`, og bruges både på `/mit`
og `/internt/vagter`. Tegner du det et sted mere, siger de to flader en dag
hver sit om samme vagt. Det er samme fejlklasse som reglerne, der stod to
steder i Natten.

**Ingen rangliste.** Hvem der står på hvad er synligt. Hvem der står på mest er
ikke en side, og bliver det ikke — Fundamentet siger, at intet niveau afgør,
hvad nogen er værd. Prøve 40 holder fladen til det.

---

## Hårde regler

- **Ingen credentials i repoet** — ikke i filer, commits, logs, prøver eller
  fixtures. De ligger hos GitHub og hos Cloudflare.
- **To-parts-merge.** PR → review → Steven merger. Ingen self-merge, ingen direkte
  push til main. Nu hvor merge udruller, er merge-knappen også deploy-knappen.
- **Enhver påstand om tilstand skal komme fra et kald.** Kan du ikke måle det, så
  sig at du ikke ved det. «Det burde virke» er ikke en måling.
- **`done` / `udrullet` / `live` uden en måling er forbudt.** Skriv hvad du kaldte,
  og hvad der kom tilbage.
- **Rør ikke en anden bygmesters åbne PR.** Find en fejl, så sig det; ret den ikke
  under hånden.
- **Copy på klientfladen er Lais.** Han har veto. Retter du en formulering, fordi
  den læser skævt, så sig det højt i PR'en — omskriv den ikke bare.
- **[Haruki 18.09 — RETTET]** Der stod: «Ingen ejer nævnes ved navn på den
  offentlige flade før udkøbet. Afgjort i #33.» Den regel gælder ikke som skrevet.
  Målt på den levende flade samme dag: `/bliv-en-del` siger «Lai svarer inden 7
  dage» og «brevet går til Lai», og `/privatlivspolitik` siger «Vend Hjem drives af
  Lai Yde, Egholmvej 23». Det er ikke en fejl — **Steven bad udtrykkeligt om det**
  («Sæt Lais navn på», 18.09.2026, bygget i #38), og en privatlivspolitik uden en
  navngiven dataansvarlig er ikke en privatlivspolitik.

  Det, der gælder: **Lai står som vært og som den, man skriver til. Ejerforholdet
  og en fremtidig medejerkreds omtales ikke offentligt før udkøbet.** Hvis #33
  besluttede noget andet, er det overhalet af principalen.

  En fremtidig session, der læste den gamle formulering som lov, ville fjerne Lais
  navn og dermed rulle en beslutning tilbage, Steven selv havde truffet. Det er
  grunden til, at afsnittet fylder så meget.

---

## Persondata

Foreningens medlemmer er rigtige mennesker med rigtige mailadresser i D1.
Databasen er ikke i repoet, og den skal blive udenfor.

`0003_people.sql` seeder tre navngivne personer med rigtige adresser. Det er
bevidst (de tre er os), men det betyder også, at de adresser ligger i git-historik
for altid. Læg ikke flere derind.

`laiydeh@gmail.com` står hårdkodet fem steder. Den dag Lai skifter adresse, er det
en kode-ændring. Det er ikke pænt, men det er kendt.

---

## Hvem er hvem

**Steven** — principal. Retning, endelig GO/HOLD, eneste merge-autoritet.
**Lai Yde** — medejer. Stedet, forløbene, og veto på al klientvendt copy.
**Haruki** (`bygmedai-haruki`) — PM og bygmester. Roadmap, copy, og det meste af
den kode, der står i dag.
**Vilde** (`Vilde2026`) — platform-builder. CI, hegn, udrulning, drift.

---

## Kendte huller i porten

Målt 18.09.2026 på `29cf955`. De står her, fordi et hul, ingen har skrevet ned,
bliver til en overraskelse.

1. ~~**De 306 Worker-prøver kører ikke i CI.**~~ **LUKKET 18.09.2026 [Haruki].**
   Vilde havde ret: `koer.mjs` stod ingen steder i nogen workflow, og merge
   udruller. Porten har nu et job, **`Worker-prøver`**, på hver PR og hver push.
2. ~~**`build.py` kører ikke i Quality Gate.**~~ **LUKKET samme sted [Haruki].**
   Jobbet kører `build.py` først — både fordi de interne sider er gitignored og
   skal findes, før prøve 11 kan læse dem, og fordi sti-hegnet dermed fyrer
   *før* merge i stedet for efter. Og det **fejler, hvis `build.py` ændrer en
   committet fil**: så er kilde og bygget resultat drevet fra hinanden, og det
   er præcis den fejl, hvor én tekst valideres og en anden udrulles. Det trin
   dækker alle fire genererede moduler på én gang — ikke kun `stigen.js`, som
   var det eneste med en ægte kilde-mod-genereret-prøve.
3. ~~**Ingen prøve rammer `.assetsignore`.**~~ **LUKKET 18.09.2026 [Vilde].**
   Prøve 35. Se §Hegnene. Hegnet, der lukkede `/.git/`, er nu bevist — og
   mekanikken bag det håndhævet, ikke kun lækagen lappet.
4. **GitHub Pages kører stadig** og bygger repoet på hver merge. `.assetsignore`
   gælder ikke der. Hullet er lukket af en 301 til vendhjem.dk (målt), altså af
   `CNAME` og af at Cloudflare ejer DNS'en. Pages gør ikke andet nyttigt.
5. **23 forældreløse HTML-filer** — 11 i roden, 12 i `design/`. `build.py` rører
   dem ikke, ingen side linker til dem, og de står ikke i sitemap. Men porten
   validerer dem, og de bærer copy, ingen har godkendt.

   **[Haruki 18.09]** «404 på fladen» er ikke rigtigt, og forskellen er værd at
   kende. De er på `.assetsignore`, så de serveres ikke — men ti af dem fanges af
   `_redirects` og svarer **301** til en nulevende side (`/agersoe.html` →
   `/sporene`, `/blog.html` → `/`, `/finddinvej.html` → humandirection.dk). De fem
   `integral-*.html` (kvadranter, linjer, niveauer, tilstande, typer) har **ingen**
   redirect og svarer 404. Har de fem adresser været delt et sted, er det fem døde
   links, der kunne have været 301.

6. **[Haruki 18.09] `.assetsignore` er en deny-liste, og det er mekanikken, der
   betyder noget.** `/stigen.json` og `/images/sted/_manifest.json` svarede 200.
   Indholdet er harmløst — det er kilden til sider, der i forvejen er offentlige —
   men reglen er ikke «tjek listen»; den er **«en ny fil i roden er offentlig,
   indtil nogen skriver den på listen»**. Begge er tilføjet, sammen med
   `noter-kilder` og permakultur-manifestet.

---

## Hvad det her dokument er — og ikke er

**[Haruki 18.09]** Målingerne herover er efterprøvbare: de har en dato, en
kommando og et svar, og du kan køre dem igen. Vurderingerne — hvad der er en god
idé, hvad der bør gøres først — er vurderinger. De kan overrules, og Steven er den,
der gør det.

Det her er ikke en lov. Det er den hurtigste vej til ikke at lave de fejl, vi
allerede har lavet. Møder du en regel her, som modsiger det, principalen lige har
sagt, så gælder principalen — og så retter du reglen her, så den næste ikke falder
i det samme hul. Det er nøjagtig, hvad der skete med ejernavnene ovenfor.

En dato uden en måling bag er et gæt med selvtillid.

---

*Repoet og fladen er sandheden. Hukommelse er ikke.*
