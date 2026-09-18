# CLAUDE.md — vendhjem.dk

**Status:** gældende. Skrevet af Vilde 18.09.2026 efter QA på `fb1fe61`, merged af
Steven, og gennemgået af Haruki samme dag på `977ee30`. Alt herunder er målt, ikke
husket. Hvor det ikke er målt, står det. Rettelser fra gennemgangen er markeret
**[målt 18.09, Haruki]** — de erstatter det, der stod før, og ikke andet.

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

**Sådan afgør du hvilken der gælder:** `vh-worker/src/index.js` linje ~122.
Fanger Workeren stien, ejer Workeren siden. Ellers er det `env.ASSETS.fetch`, og
så er det filen.

Workeren ejer i dag: `/sporene`, `/sporene/*`, **`/sporene.html`**, `/mit`,
`/mit/*`, `/bliv-en-del/skriv`, `/internt/ophold*`, `/internt/breve*`,
`/internt/fund*`, `/internt/fonde*`, `/internt/korpus*`, `/sundhed/fonde`.
Resten er statiske filer.

**[målt 18.09, Haruki]** `/internt/fund*` kom til i #48 og manglede i listen.
Den her liste forældes, hver gang nogen tilføjer en rute — læs `index.js`, hvis
det står på spil. Listen er en hjælp, ikke en kilde.

Bemærk `/sporene.html`: Workeren fanger også filnavnet, så selv den direkte vej
til filen giver den levende side. Du kan altså ikke omgå den ved at skrive `.html`
i adresselinjen.

---

## Byg og prøv

```
python3 build.py                 # skriver siderne + fire genererede JS-moduler
node vh-worker/test/koer.mjs     # 308 prøver (977ee30). Kører nu i CI på hver PR
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

**[målt 18.09, Haruki]** Det fanges nu af CI, ikke af en enkelt prøve: portneren
`Worker-prøver` kører `build.py` og fejler, hvis et committet resultat ændrer sig.
Det dækker alle fire moduler og de byggede sider på én gang.

Til gengæld var beskrivelsen af prøverne ikke rigtig. Prøve 28 sammenligner
`stigen.json` med `stigen.js` — den er en ægte kilde-mod-genereret-prøve. Prøve 27
gør **ikke** det samme for `fotos.js`; den tjekker kun, at modulet er internt
konsistent (hvert foto har mål og alt-tekst). Prøve 11 sammenligner de to
navigationer med hinanden, ikke med `nav-internt.json` — er begge forældede, består
den. Portneren ovenfor er det, der dækker hullet.

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
- **[målt 18.09, Haruki — RETTET]** Der stod: «Ingen ejer nævnes ved navn på den
  offentlige flade før udkøbet. Afgjort i #33.» Den regel gælder ikke som skrevet.
  Målt på den levende flade samme dag: `/bliv-en-del` siger «Lai svarer inden 7
  dage» og «brevet går til Lai», og `/privatlivspolitik` siger «Vend Hjem drives af
  Lai Yde, Egholmvej 23». Det er ikke en fejl — **Steven bad udtrykkeligt om det**
  («Sæt Lais navn på», 18.09.2026, bygget i #38), og en privatlivspolitik uden en
  navngiven dataansvarlig er ikke en privatlivspolitik.

  Det, der gælder: **Lai står som vært og som den, man skriver til. Ejerforholdet
  og en fremtidig medejerkreds omtales ikke offentligt før udkøbet.** Hvis #33
  besluttede noget andet, er det overhalet af Steven selv.

  En fremtidig session, der læser den gamle formulering som lov, ville fjerne Lais
  navn og dermed rulle en beslutning tilbage, principalen havde truffet. Det er
  grunden til, at det her afsnit fylder så meget.

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

Målt 18.09.2026 på `fb1fe61`. De står her, fordi et hul, ingen har skrevet ned,
bliver til en overraskelse.

1. ~~**De 234 Worker-prøver kører ikke i CI.**~~ **LUKKET 18.09.2026.** Vilde
   havde ret: `koer.mjs` stod ingen steder i nogen workflow, og merge udruller.
   Portneren `Worker-prøver` i `test.yml` kører dem nu på hver PR og hver push.
2. ~~**`build.py` kører ikke i Quality Gate.**~~ **LUKKET samme sted.** Portneren
   kører `build.py` først — både fordi de interne sider er gitignored og skal
   findes, før prøve 11 kan læse dem, og fordi sti-hegnet dermed fyrer *før*
   merge i stedet for efter. Den fejler også, hvis `build.py` ændrer en committet
   fil: så er kilde og bygget resultat drevet fra hinanden, og det er præcis den
   fejl, der ellers valideres i én tekst og udrulles i en anden.
3. **Ingen prøve rammer `.assetsignore`.** Hegnet, der lukkede `/.git/`, er
   ubevist.
4. **GitHub Pages kører stadig** og bygger repoet på hver merge. `.assetsignore`
   gælder ikke der. Hullet er lukket af en 301 til vendhjem.dk (målt), altså af
   `CNAME` og af at Cloudflare ejer DNS'en. Pages gør ikke andet nyttigt.
5. **23 forældreløse HTML-filer** — 11 i roden, 12 i `design/`. `build.py` rører
   dem ikke, ingen side linker til dem, og de står ikke i sitemap. Men porten
   validerer dem, og de bærer copy, ingen har godkendt.

   **[målt 18.09, Haruki]** «404 på fladen» er ikke rigtigt, og forskellen er
   værd at kende. De er på `.assetsignore`, så de serveres ikke — men ti af dem
   fanges af `_redirects` og svarer **301** til en nulevende side
   (`/agersoe.html` → `/sporene`, `/blog.html` → `/`, `/finddinvej.html` →
   humandirection.dk). De fem `integral-*.html` (kvadranter, linjer, niveauer,
   tilstande, typer) har **ingen** redirect og svarer 404. Hvis de fem adresser
   har været delt et sted, er det fem døde links, der kunne have været 301.

6. **[målt 18.09, Haruki]** `.assetsignore` er en deny-liste, og hvert nyt hold
   filer skal skrives på. `/stigen.json` og `/images/sted/_manifest.json` svarede
   200. Indholdet er harmløst — det er kilden til sider, der i forvejen er
   offentlige — men mekanikken er ikke. Begge er tilføjet, sammen med
   `noter-kilder` og permakultur-manifestet. **Reglen er ikke «tjek listen», men
   «en ny fil i roden er offentlig, indtil nogen skriver den på listen».**

---

## Hvad det her dokument er — og ikke er

**[målt 18.09, Haruki]** Målingerne herover er efterprøvbare: de har en dato, en
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
