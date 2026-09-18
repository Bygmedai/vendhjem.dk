# Smoke test — med øjnene

**Til et menneske med en browser, en telefon og tyve minutter.**
Dækker det, der blev merget 17. september 2026: PR #24, #25, #26, #27, #28, #30 og #31 — og #32, når den er inde.

`vh-worker/test/flader.sh` måler. **Det her kigger.** De to overlapper med vilje ikke: en maskine kan se at en side svarer 200, men den kan ikke se at mailen lød som et menneske, eller at knappen sad et sted man fandt den. Kør `flader.sh` efter hvert deploy. Kør det her, når du vil vide om det, I byggede, virker.

Du skal bruge: en browser, en mailadresse systemet ikke kender, og en telefon. Sæt tyve minutter af. Har du travlt, så tag **trin 0, 1 og 2** og spring resten — de tre er dem, der afgør, om nogen kan booke noget.

---

## Før du går i gang — to minutter, og de er ikke spildte

**Målt 17/9 kl. ~22:40 på det levende site.** Halvdelen er på plads, halvdelen er ikke:

| | Målt | |
|---|---|---|
| Kalenderen (`0009`) | **kørt** | `/sporene` viser tre mandeweekender — den første 14.–16. maj 2027 · 850 kr. — plus retreat, festival og syv lukkede uger |
| C2-fladen (deploy) | **mangler** | der er ingen forespørg-linje under datoerne. Koden på main skriver én på hvert åbent ophold; den levende side har den ikke |

Så **trin 1 består allerede**, og **trin 2 kan ikke køres endnu**. Ikke fordi noget er i stykker, men fordi Workeren med forespørgslen ikke er sendt ud.

**Sådan sender du den ud — ingen terminal:**

> [Actions → «Udrul til Cloudflare» → Run workflow](https://github.com/Bygmedai/vendhjem.dk/actions/workflows/udrul.yml)

Den bygger siderne, kører migrationer, deployer og måler bagefter. Går noget galt, stopper den og siger hvad — mangler nøglen, rører den ikke databasen overhovedet.

Kommer den grønt tilbage, skal der stå en **forespørg**-linje under hver dato på `/sporene`. Gør der ikke det, så stop og sig til; så er der noget galt, som ikke er dokumentets skyld.

*Tidligere stod her en opskrift med `wrangler` og en token-fil i `/tmp`. Den fil er en sandkasse-konvention for en Linux-agent og findes ikke på en Windows-maskine — et menneske, der fulgte linjen, fik wrangler til at falde tilbage på en udløbet session. Den slags hører ikke hjemme i en vejledning til et menneske.*

---

## Trin 0 · Svarer alle de interne sider? — 20 sekunder

**Haruki fandt et hul, ingen af de andre trin ville have set** (review på #29, 17/9): `/internt/registrering` var **404 i produktion**. Feltværktøjet lå kun på en container, aldrig i git, og forsvandt ved et deploy fra et rent checkout. Registreringsweekenden er 19.–21. september.

Og `/internt/timer` var 404 oven i — **det var min fejl.** I #30 gjorde jeg stierne absolutte og gav to interne links `/timer` og `/stedet` i stedet for `/internt/timer` og `/internt/stedet`. Hegnet i `build.py` fangede det ikke: det tjekker at en sti er *absolut*, ikke at den peger et sted, der findes. Rettet i #32.

**Gør dette:** log ind, og klik hver eneste linje i den interne menu.

> Oversigt · Stedet · Ophold · Økonomi · Anlæg · Timer og indskud · Korpus · Fonde · Registrering

**Du skal se:** en side. Hver gang. Ingen 404, ingen tom skal.

**Hvorfor det er trin 0 og ikke trin 6:** readbacket i udrulningen tjekker, at `/internt` ikke ligger *åbent*. Det tjekker ikke, at siderne bag login *virker*. De sider er gitignored og bygges ved deploy, så de kan forsvinde uden at nogen automatisk prøve siger noget. **Et menneske med en session er det eneste, der kan se det.** Tyve sekunder.

## Trin 1 · Findes kalenderen? — 2 minutter

**PR #28.** Sitet har siden september lovet syv lukkede uger og seks spor. Indtil i aften var alle seks tomme. **Nu er de der** — det her trin er blevet en bekræftelse i stedet for en forhindring, men kør det alligevel: det er det eneste sted, tallene bliver holdt op mod noget.

**Gør dette:** åbn [vendhjem.dk/sporene](https://vendhjem.dk/sporene) i en browser, hvor du **ikke** er logget ind.

**Du skal se:**

- **Mandegrupper:** tre datoer. Den første er **14.–16. maj 2027** og står med **850 kr.**
- **Festival:** én uge, 5.–11. juli 2027, uden pris — der står *hvorfor* prisen mangler, ikke bare ingenting.
- **Retreats:** én, 20.–25. oktober 2027.
- **Byg-med-uger, stille uger, campingvogne:** stadig «Ingen datoer åbne på det her spor endnu.» Det er rigtigt — der er ikke seedet nogen.
- **Nederst, «Syv uger om året er lukkede»:** syv datolinjer. Ikke et løfte om at de kommer. Syv rigtige uger.

**Hvis der stadig står «ingen datoer» overalt:** migrationen er rullet tilbage eller databasen er en anden. Det ville være nyt — sig til.

**Datoer uden forespørg-linje** betyder derimod, at kalenderen er inde, men Workeren ikke er deployet. De to ting ligner hinanden på skærmen og løses hvert sit sted: den ene er `apply`, den anden er `deploy`. Knappen gør begge dele.

**Hvis der står datoer, men ingen lukkede uger:** kun halvdelen af seedet gik ind. Sig til — det skal undersøges, ikke gentages.

---

## Trin 2 · Kan en fremmed forespørge? — 5 minutter

> **Stop, hvis der ikke står en forespørg-linje under datoerne.** Den sidder på hvert **åbent** ophold, og den kommer først, når Workeren er deployet — datoerne alene er ikke nok. Målt 17/9 kl. 22:40: linjen mangler stadig. Tryk «Udrul til Cloudflare» først. Trin 2 kan ikke bestås uden.

**PR #27.** Det her er den vigtigste test på hele siden, for det er den eneste vej fra «nogen så sitet» til «nogen kommer».

**Gør dette — og tæl trykkene undervejs.** Brug et privat vindue, så du er en fremmed.

1. Åbn `/sporene`.
2. Tryk **FORESPØRG** på mandeweekenden i maj. *(tryk 1)*
3. Skriv et navn og en mailadresse, systemet ikke kender. Skriv en linje i fritekstfeltet.
4. Tryk **SEND FORESPØRGSEL**. *(tryk 2)*

**Du skal se:** en kvittering på skærmen med det samme. Ikke «tak for din henvendelse» — der skal stå hvad der sker nu, og hvornår du hører fra dem.

**Du skal have:** en mail. Tjek den på telefonen. **Læs den højt.** Lyder den som et menneske, der glæder sig til at se dig — eller som et system, der har registreret dig? Det er den eneste del af testen, en maskine ikke kan lave.

**Tællingen:** to tryk. Kom du over tre, er budgettet sprængt, og det skal siges højt.

**Prøv så at gøre det igen** med samme mail på samme ophold. Du skal **ikke** blive til to personer eller to pladser. Sker det, er der en dublet i databasen, og det er værre end det lyder — det er et menneske, der findes to gange.

**Hvis mailen ikke kommer:** pladsen skal stadig være gemt. Det tjekker du i trin 3. En tabt mail må aldrig blive til en tabt gæst.

---

## Trin 3 · Kan du svare? — 3 minutter

**PR #27, den interne side.**

**Gør dette:** log ind på `/internt/ophold`.

**Du skal se:** forespørgslen fra trin 2, med navn og den linje, de skrev. Bekræft den med ét tryk.

**Du skal have:** endnu en mail — den praktiske. Læs den på telefonen som om du aldrig har været på Agersø. **Kan du finde derhen?** Står der noget om færgen fra Stigsnæs, om hvad du skal have med, om hvad der er inkluderet?

**Den ærlige prøve:** giv mailen til en, der ikke kender stedet, og spørg om de ville turde tage af sted. Hvis svaret er «jeg ville ringe først», mangler mailen noget.

**Hvis mailen fejlede i trin 2:** der skal stå en synlig fejl på pladsen her. Står der ingenting, og kom mailen heller ikke, så fejler systemet i tavshed — og det er den slags, ingen opdager før det er for sent.

---

## Trin 4 · Står hegnene endnu? — 3 minutter

**Den vigtigste test efter ethvert deploy, og den der ikke handler om nye funktioner.**

PR #27 ændrede login-cookien, så `/sporene` kan se om du er logget ind. Det er en rimelig ændring, og det er også præcis den slags, der utilsigtet kan lade én bruger se en andens navn.

**Gør dette:**

1. Log ind på `/mit` i din almindelige browser.
2. Åbn `/sporene` **i et privat vindue**.

**Du skal se:** ingenting personligt. Ingen navn, ingen mail, intet «velkommen tilbage». Det private vindue er en fremmed og skal behandles som en.

3. Prøv at åbne `vendhjem.dk/internt` uden at være logget ind.
4. Prøv **`www.vendhjem.dk/internt`** — med www foran.

**Du skal se:** en login-skærm begge gange. Aldrig indhold.

Det andet punkt ser overflødigt ud og er det ikke. I september lå `/internt` åbent på www i et døgn med BBR-tal og økonomi frit læsbart, fordi Access var bundet til apex og www er en anden vært. **En flade, der ikke er målt, er ikke sikker.** Det er også derfor `flader.sh` findes — kør den også.

---

## Trin 5 · Er gaten grøn — og betyder det noget? — 2 minutter

**PR #25 og #30.** Indtil i går kunne CI'en sige at et link var brudt, men ikke hvilket; den stod rød i to dage, og ingen kunne se hvorfor. #25 gav den stemme. #30 fjernede grunden til at råbe.

**Gør dette:** åbn den nyeste kørsel under **Actions → Quality Gate**.

**Du skal se:** fire grønne. Broken Link Check skriver et tal, også når alt er godt:

```
28 links checked, 0 broken
```

**Det er nyt.** Gaten var rød på hver eneste PR fra 15. august til 17. september — først tavst, så med tyve navngivne fejl, der alle sammen var falske. De var falske, fordi siderne brugte relative stier og crawleren læste dem som mapper. Nu skriver `build.py` absolutte stier, og den **nægter at bygge**, hvis nogen skriver en relativ igen.

**Hvis den er rød:** læs linjen. Den fortæller nu, hvilket link og hvilken side. Det er hele forskellen fra i går.

**Én ærlighed om det hegn:** det tjekker, at en sti er absolut — ikke at den peger et sted, der findes. `/timer` er lige så absolut som `/internt/timer`, og kun den ene virker. Den fejl slap igennem og blev fanget af et menneske, ikke af en maskine. Det er derfor trin 0 findes.

---

## Trin 6 · Passer papiret på virkeligheden? — 5 minutter

**PR #24 og #26.** To dokumenter. Testen af et dokument er ikke at det findes — det er om det stadig er sandt.

**`vh-worker/README.md`, afsnittet «Migrationer»:** der står en tabel med en række pr. migration og en kolonne, der siger *hvordan* status er målt.

**Rækken for `0009` er forkert lige nu.** Den siger «IKKE applied». Migrationen blev kørt 17/9 kl. 22:15, og `/sporene` viser datoerne. Ret rækken, og skriv hvordan du målte det.

Det er ikke pedanteri. Den tabel stod forkert i to dage og kostede en hel formiddag, fordi nogen troede på den — og rækken blev netop skrevet for at gøre den slags synlig. En tabel om forældet status, der selv er forældet, er værre end ingen tabel.

**`docs/AAR-0-DRIFTSPLAN-2026-09-17.md`, §7:** et register over ting, ingen havde målt. Løb de otte rækker igennem. Er nogen af dem afklaret siden i går, så luk dem — med **hvem** der målte det og **hvornår**, ikke ved at slette rækken.

---

## Når du er færdig

Gik alt: sig det. Gik noget galt: sig **hvad du så**, ikke hvad du tror der er galt. «Knappen var der ikke» er brugbart. «Der er vist noget med databasen» er det ikke.

Og et sidste blik, som ingen automatisk prøve kan tage: **gå ind på sitet, som om du aldrig har set det.** Er der stadig en dato, du kan booke, og en pris, du kan forstå? Det er hele pointen med de fem PR'er. Alt det andet er maskineri.
