# CLAUDE.md — vendhjem.dk

**Status:** ratificeret 18.09.2026 (#46). Sidst målt på `29cf955`, samme dag.
Alt herunder er målt, ikke husket. Hvor jeg ikke har målt, står det.

Filen blev forældet under en time efter den blev merget — #45, #47, #48 og #49
landede imens. Det er ikke en undskyldning, det er et arbejdsvilkår: **ændrer du
en sti, en migration eller antallet af prøver, så ret den her fil i samme PR.**

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
`/internt/fund*`, `/internt/fonde*`, `/internt/korpus*`, `/sundhed/fonde`.
Resten er statiske filer.

**Fælden i navnet:** `/mit-offline` og `/mit-sw.js` hedder noget med «mit», men
Workeren fanger dem **ikke** — grenen matcher `/mit` og `/mit/*`, ikke `/mit-*`.
De er almindelige filer i roden (`mit-offline.html`, `mit-sw.js`,
`assets/mit.webmanifest`), og de skal blive ved med at være det: en service worker,
der bliver bygget af den Worker, den skal kunne overleve, er ikke offline-sikker.

Bemærk `/sporene.html`: Workeren fanger også filnavnet, så selv den direkte vej
til filen giver den levende side. Du kan altså ikke omgå den ved at skrive `.html`
i adresselinjen.

---

## Byg og prøv

```
python3 build.py                 # skriver siderne + fire genererede JS-moduler
node vh-worker/test/koer.mjs     # 306 prøver (29cf955). Kører IKKE i CI — se nedenfor
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
hinanden. Prøve 28 fanger det for `stigen.js`, prøve 27 for `fotos.js`. For
`nav-internt.js` fanger ingenting det.

---

## Hegnene

De står, fordi de er blevet brudt. Fjern dem ikke, fordi de ser overflødige ud.

| Hegn | Hvor | Hvorfor det står |
|---|---|---|
| `workers_dev = false`, `preview_urls = false` | `vh-worker/wrangler.toml` | Uden dem slår wrangler workers.dev til igen, og `/internt` ligger åbent uden om Access. Målt åbent i S592. |
| `.assetsignore` | roden | `[assets] directory = "../"` uploader **hele repoet**. Uden filen lå `/.git/`, `/vh-worker/src/`, `wrangler.toml` og `build.py` åbent på vendhjem.dk. Målt 17.09.2026 (S594). |
| Sti-hegnet i `build.py` | `RELATIV` / `_find_relative` | En relativ sti virker på `/fundamentet` og knækker på `/internt/timer`. Bygget i PR #30. **Det tjekker at en sti er absolut — ikke at den peger på noget, der findes.** Jeg lavede præcis den fejl selv i #30; Haruki fandt den. |
| Overlaps- og kapacitets-triggere | `0007_ophold.sql` | To ophold må ikke dække samme nat, og et ophold må ikke overbookes. Håndhævet i databasen, ikke i app-kode. |
| Access på `/internt` **og** `www.vendhjem.dk/internt` | Cloudflare | www-varianten lå åben i et døgn i september. `udrul.yml` måler begge i sit readback. |

`.assetsignore` er en **deny-liste**. En ny fil i roden er offentlig, indtil nogen
skriver den på listen. Målt 18.09.2026: `/stigen.json` svarer 200. Indholdet er
harmløst, men mekanikken er det ikke.

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

Workeren har også en **cron** (`[triggers] crons = ["0 4 1 * *"]`): den 1. i
måneden kl. 04:00 UTC skrives hele D1 som almindelig JSON til R2. Se
`src/sikkerhedskopi.js`. Den kører uden for enhver anmodning — ændrer du skemaet,
så husk at den også læser det.

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
- **Ingen ejer nævnes ved navn på den offentlige flade før udkøbet.** Afgjort i #33.

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

1. **De 306 Worker-prøver kører ikke i CI.** Quality Gate har fire jobs —
   html-validate, broken-links, Lighthouse, Playwright — og ingen af dem rører
   `vh-worker/`. Hele beviset for brevet, opholdene, overlaps-triggeren og
   kalenderen ligger i en fil, kun et menneske kører. Siden merge nu udruller
   automatisk, er der ingen automat mellem «grøn PR» og «ude i produktion».
2. **`build.py` kører ikke i Quality Gate**, kun i `udrul.yml`. Sti-hegnet fyrer
   altså først efter merge. Og porten validerer de *committede* HTML-filer —
   glemmer nogen at køre `build.py` før commit, valideres én tekst og udrulles en
   anden. På `fb1fe61` er de i sync; intet holder dem der.
3. **Ingen prøve rammer `.assetsignore`.** Hegnet, der lukkede `/.git/`, er
   ubevist.
4. **GitHub Pages kører stadig** og bygger repoet på hver merge. `.assetsignore`
   gælder ikke der. Hullet er lukket af en 301 til vendhjem.dk (målt), altså af
   `CNAME` og af at Cloudflare ejer DNS'en. Pages gør ikke andet nyttigt.
5. **23 forældreløse HTML-filer** — 11 i roden, 12 i `design/`. `build.py` rører
   dem ikke, ingen side linker til dem, de står ikke i sitemap, og de er 404 på
   fladen. Men porten validerer dem, og de bærer copy, ingen har godkendt.

---

*Repoet og fladen er sandheden. Hukommelse er ikke.*
