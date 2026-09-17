# Smoke test — med øjnene

**Til et menneske med en browser, en telefon og tyve minutter.**
Dækker det, der blev merget 17. september 2026: PR #24, #25, #26, #27 og #28.

`vh-worker/test/flader.sh` måler. **Det her kigger.** De to overlapper med vilje ikke: en maskine kan se at en side svarer 200, men den kan ikke se at mailen lød som et menneske, eller at knappen sad et sted man fandt den. Kør `flader.sh` efter hvert deploy. Kør det her, når du vil vide om det, I byggede, virker.

Du skal bruge: en browser, en mailadresse systemet ikke kender, og en telefon. Sæt tyve minutter af. Har du travlt, så tag trin 1–3 og spring resten.

---

## Før du går i gang — ellers fejler tre af fem

**Målt 17/9 kl. ~19:50 på det levende site:** `/sporene` siger «Ingen datoer åbne» seks steder. Ingen FORESPØRG-knap. Ingen 2027-dato.

Fire PR'er blev merget i dag. **Ingen af dem er i databasen.** Koden ligger på main; tabellerne og datoerne gør ikke. Kører du testen nu, fejler trin 1, 2 og 3 — ikke fordi noget er i stykker, men fordi der ikke er noget at se på endnu.

To kommandoer, i den rækkefølge:

```
npx wrangler@4 d1 migrations apply vendhjem-fonde --remote
cd vh-worker && CLOUDFLARE_API_TOKEN=$(cat /tmp/.cf_token_vh) npx wrangler@4 deploy
```

Den første lægger `0008` (forespørgselsfelterne) og `0009` (kalenderen) i databasen. Den anden sender koden ud. **Rækkefølgen er ikke til forhandling** — deployer du først, kigger den nye flade efter kolonner, der ikke findes endnu.

Gå videre, når begge er kørt uden fejl.

---

## Trin 1 · Findes kalenderen? — 2 minutter

**PR #28.** Sitet har siden september lovet syv lukkede uger og seks spor. Indtil i dag var alle seks tomme.

**Gør dette:** åbn [vendhjem.dk/sporene](https://vendhjem.dk/sporene) i en browser, hvor du **ikke** er logget ind.

**Du skal se:**

- **Mandegrupper:** tre datoer. Den første er **14.–16. maj 2027** og står med **850 kr.**
- **Festival:** én uge, 5.–11. juli 2027, uden pris — der står *hvorfor* prisen mangler, ikke bare ingenting.
- **Retreats:** én, 20.–25. oktober 2027.
- **Byg-med-uger, stille uger, campingvogne:** stadig «Ingen datoer åbne på det her spor endnu.» Det er rigtigt — der er ikke seedet nogen.
- **Nederst, «Syv uger om året er lukkede»:** syv datolinjer. Ikke et løfte om at de kommer. Syv rigtige uger.

**Hvis der stadig står «ingen datoer» overalt:** migrationen er ikke kørt. Tilbage til «Før du går i gang».

**Hvis der står datoer, men ingen lukkede uger:** kun halvdelen af seedet gik ind. Sig til — det skal undersøges, ikke gentages.

---

## Trin 2 · Kan en fremmed forespørge? — 5 minutter

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

## Trin 5 · Kan gaten tale? — 2 minutter

**PR #25.** Indtil i går kunne CI'en sige at et link var brudt, men ikke hvilket. Den stod rød i to dage, og ingen kunne se hvorfor.

**Gør dette:** åbn den nyeste kørsel under **Actions → Quality Gate → Broken Link Check**.

**Du skal se:** en linje som

```
404 http://localhost:8080/fundamentet/assets/vh.css  <- linked from .../fundamentet
28 links checked, 20 broken
```

Altså: et tal, en adresse, og hvilken side linket stod på.

**Du skal IKKE se:** «Broken links found» efterfulgt af en tom linje. Det var den gamle fejl.

**Bemærk:** jobbet er stadig **rødt**, og det er forventet. De 20 er falske — linkinator opløser relative stier, som om `/fundamentet` var en mappe. På det levende site sender Cloudflare `/fundamentet/` tilbage til `/fundamentet`, så adresserne findes ikke. **Ingen side er i stykker.** Der venter et valg (absolutte stier i `build.py`, eller skråstreg-kanonisering i test-harnesset), og det er ikke lavet endnu.

Testen her er altså ikke «er den grøn». Den er: **kan den fortælle dig hvad der er galt.**

---

## Trin 6 · Passer papiret på virkeligheden? — 5 minutter

**PR #24 og #26.** To dokumenter. Testen af et dokument er ikke at det findes — det er om det stadig er sandt.

**`vh-worker/README.md`, afsnittet «Migrationer»:** der står en tabel med en række pr. migration og en kolonne, der siger *hvordan* status er målt.

Har du lige kørt `apply` i «Før du går i gang», så er **rækken for `0009` forkert nu** — den siger «IKKE applied». Ret den, og skriv hvordan du målte det. Det er ikke pedanteri: den tabel stod forkert i to dage og kostede en hel formiddag, fordi nogen troede på den.

**`docs/AAR-0-DRIFTSPLAN-2026-09-17.md`, §7:** et register over ting, ingen havde målt. Løb de otte rækker igennem. Er nogen af dem afklaret siden i går, så luk dem — med **hvem** der målte det og **hvornår**, ikke ved at slette rækken.

---

## Når du er færdig

Gik alt: sig det. Gik noget galt: sig **hvad du så**, ikke hvad du tror der er galt. «Knappen var der ikke» er brugbart. «Der er vist noget med databasen» er det ikke.

Og et sidste blik, som ingen automatisk prøve kan tage: **gå ind på sitet, som om du aldrig har set det.** Er der stadig en dato, du kan booke, og en pris, du kan forstå? Det er hele pointen med de fem PR'er. Alt det andet er maskineri.
