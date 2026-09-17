# Agersø år 0 — hvad der holder driften i live

**17. september 2026 · Vilde Serra (kreativ chef, Agersø/Vendhjem) · til Steven**
**Status:** Arbejdsgrundlag. Hvert punkt er enten **målt** (med kald eller kilde) eller **vurdering** (overrulbar uden begrundelse). Ingen regler.
**Grundlag:** `AGERSOE-VISION-AAR-0-3.md` (S586), `AGERSOE-PLAN-S586.md` v7.5, `AGERSOE-DRIFT-2027-v2.xlsx`, fuldt sweep af `vendhjem.dk`, `governance`, `bygmedai-portal`, `bygmedai-adskillelse` og Linear-projekterne «Agersø — stedet» og «Vendhjem — platformen».

---

## 0. Det korte

**Tre ting, sweepet fandt, som ændrer hvad der skal bygges.**

**1. Platformen er ikke uskrevet — den er tændt og tom.** Repoets README siger at `0007_ophold` «ikke er applied remote». Det er ikke længere sandt. Målt 17/9 kl. ~12: `/sporene` serveres fra Workeren og henter de seks spor fra D1 (den leverede side bruger tankestregen i «Retreats — vi er værter», som kun findes i seed-rækken; den statiske fil bruger bindestreg). `/mit` svarer 200 med login-formularen, altså er `0003` og `0004` kørt og `SESSION_NOEGLE` sat. `/internt` svarer 302 til Access. `/sundhed/fonde` svarer 404 uden header. **Bookingmotoren, personregistret, login og fondsværktøjet kører. Der ligger nul ophold i kalenderen.** Opgaven i år 0 er ikke at bygge mere maskineri. Den er at fylde det, der står der.

**2. Året hænger på én uge.** I regnearkets realistiske scenarie er årsresultatet 169.719 kr. Juli alene giver 115.200. **68 % af året ligger i én måned**, og den måned er festivalen i uge 27. Arket siger det selv (A35): aflyses den, forsvinder en femtedel af resultatet. Målt på månedstallene er det værre end det — det er to tredjedele. Alt, hvad software kan gøre for år 0, bør måles mod ét spørgsmål: **gør det juli mindre skrøbelig?**

**3. De syv lukkede uger findes på sitet og ikke i budgettet.** `/sporene` lover «Syv uger om året er lukkede … Et sted, der kan fylde 52 uger, brænder sine ejere af i år ét.» Talt i `Kalender 2027`: **nul uger har koden LUKKET.** Der er ni JER-uger (arbejde, ingen gæster) — alle sammen i januar–april. Fra uge 17 til uge 52 er der **36 uger i træk med gæster på stedet.** Det er ikke en risiko, det er en plan for udbrændthed, og den står i modstrid med et løfte, der allerede er offentligt.

**Vurdering:** de tre fund peger samme vej. År 0's stabilitet afgøres ikke af flere funktioner, men af tre ting, ingen af jer måler endnu: **kommer folk faktisk, hvad koster de faktisk, og hvornår kommer pengene.** Featureforslagene i §3 er skåret efter det.

---

## 1. Hvad sweepet målte

### 1.1 Den levende flade (målt 17/9)

| Kald | Svar | Hvad det betyder |
|---|---|---|
| `GET vendhjem.dk/sporene` | 200, indhold fra D1 | `0007_ophold` **er** applied; seks spor seedet; nul ophold |
| `GET vendhjem.dk/mit` | 200, magic-link-formular | `0003`+`0004` applied, `SESSION_NOEGLE` sat |
| `GET vendhjem.dk/internt` | 302 → Access | Hegnet fra S593 holder |
| `GET vendhjem.dk/sundhed/fonde` (uden header) | 404 | Korrekt — røber ikke at den findes |

**Det jeg ikke kunne måle:** om `RESEND_API_KEY` er sat. Uden den logges magic-link-URL'en til Workerens logs i stedet for at blive sendt. Det er den bevidste dev-sti, og den er stille. **Send dig selv et login, før nogen anden gør det.** Det er ét tryk, og det er forskellen på en levende dør og en dør der ser levende ud.

### 1.2 Repoet

- **`vendhjem.dk/vh-worker`** — 4.144 linjer. Personregister, roller med gyldighedsperiode, magic-link-login, passkeys, korpus med tre slags og hash-binding, fondssager med `pakke_hash`, ophold/pladser med overlap- og kapacitetstriggere i databasen. Det er godt bygget. Hegnene står i SQL, ikke i vejledninger.
- **`/internt/timer`** — statisk mock-up i `build.py` med opdigtede tal (148,5 timer, 1.480 timer i alt, «tagene er 62 % tætte»). Siden kalder sig selv «den vigtigste tabel på hele stedet». Den er en tegning. BYG-569 (H1) erstatter den.
- **`/internt/oekonomi`** — tallene er hardkodet i `build.py` med kildeangivelse **`AGERSOE-DRIFT-2027-v4.xlsx`**. Arket jeg har fået er **v2**, og tallene er ikke de samme (omsætning A: 777.910 på siden mod 672.024 i v2). Enten er v4 nyere end det, jeg har, eller også er siden forkert. **Uanset hvad er det driften selv:** et regneark kopieret i hånden ind i HTML driver fra sin kilde inden for to dage.
- **Forsiden påstår «Lai Yde ejer stedet».** Målt i planen (§1.4b, CVR): ejendommen ligger i Ejendomsselskabet Egholmvej 23 ApS, ejet 100 % af Buddhi Holding ApS, som Lai ejer 50 % af sammen med ESH Holding. Lai ejer ikke stedet — han ejer halvdelen af et holding, der ejer et selskab, der ejer stedet, og han er i konflikt om det. Sætningen står på en offentlig side i en sag, hvor modparten læser med. **Det er ikke en designfejl, det er en påstand.**

### 1.3 Linear

«Vendhjem — platformen»: 19 sager, 6 leveret (A1 personregister, A2 login, C1 ophold, E1 korpus, E2 fonde, G1 fladesprog), 13 åbne. «Agersø — stedet»: 9 sager, 3 leveret.

Køen er god. Rækkefølgen er ikke helt. De to sager, der har direkte betydning for om der kommer penge ind i 2027 — **C2 (forespørg på et ophold)** og **D1 (betaling)** — ligger begge i Backlog, mens der er brugt to dage på at bygge korpus og fondsværktøj til en forening, der **ikke har CVR endnu**.

**Det største enkeltfund i Linear er noget, der ikke står der:**

> **CVR'et blokerer tre spor samtidig, og der findes ingen sag på det.**
>
> `organizations.cvr_status = 'under_stiftelse'` i seed. Uden CVR: ingen Stripe-konto (D1/BYG-563 siger det selv), ingen LAG-ansøgning (LAG Småøerne kræver digital medarbejdersignatur og dermed CVR), ingen gratis Fonde.dk gennem Slagelse Kommune (E2's egen note), ingen momsregistrering, og ingen faktura til en retreatfacilitator, der skal have et bilag til sit regnskab. **Fondsværktøjet og betalingssporet er begge bygget eller planlagt oven på en forudsætning, ingen har sat en dato på.**

---

## 2. Hvad der vælter år 0, rangordnet

Regnet på `AGERSOE-DRIFT-2027-v2.xlsx`. Alle tal er arkets egne, medmindre andet står.

**1. Festivalen i juli — 68 % af det realistiske årsresultat.**
115.200 af 169.719 kr. Ét vejrlig, én aflysning, én myndighed, og året er scenarie C.

**2. Mandeweekenden under 11 mand.**
Breakeven er 11 af 15 (A39). Ved 15 giver weekenden 1.505 kr. kontant. Ved 9 — scenarie C's tal — koster den ca. 700 kr., og den værdi, der ellers ville være kommet ind som arbejde, falder fra 45.738 til 27.443 kr. på året. **Otte weekender, hvor produktet er, at folk møder op, og hvor ingen ved hvor mange der kommer, før de står på færgen.**

**3. Vintervarmen — arkets mest usikre tal, sagt af arket selv (A41).**
22 kr. pr. gæstedøgn er en vurdering ud fra Bolius, i en bygningsmasse fra 1920 på 536 m². Er den 45 i stedet, ændrer det hver eneste pris på stedet, og alle tretten AB-V-uger bliver dyrere end de sælges for. **Det er den eneste af de tre store usikkerheder, der kan retires med et tal på en måler.**

**4. Momsen på vinterværelserne.**
Arket regner vinterfællesskab (2 værelser à 4.000 kr./md) som **momsfrit** ved udlejning over en måned (A101). Momslovens § 13, stk. 1, nr. 8 undtager korttidsudlejning under en måned — **men undtagelsen for «værelser i hoteller og lign.» gælder uanset lejemålets længde**, og BBR registrerer bygning 2 på Egholmvej 23 som «hotel/kro/konferencecenter med overnatning». Tre oplysninger, der ikke er enige. Det koster 4.000 kr./md i fem måneder, hvis arket tager fejl — og mere, hvis vinterresidens skaleres (§3.9). **Ét spørgsmål til revisoren, før prisen trykkes.** Kilde: [SKAT D.A.5.8.6](https://info.skat.dk/data.aspx?oid=1947105), [momsloven § 13](https://danskelove.dk/momsloven/13).

**5. 36 uger i træk med gæster.**
Se §0.3. Ingen krone i modellen, hele året i virkeligheden.

**6. Brandkravene til midlertidig overnatning.**
Bygning 2 er registreret til overnatning; stuehuset er bolig. Bruges **salen eller restaurantbygningen** til at sove femten mand i, gælder reglerne om midlertidig overnatning: anmeldelse til kommunen mindst to uger før ved op til 50 personer, og **højst 50 døgn pr. år pr. lokale**. Otte mandeweekender à 2 nætter er 16 døgn — der er luft, men ikke uendelig, og anmeldelsen er ikke valgfri. Kilde: [Vejle Brandvæsen om midlertidig overnatning](https://www.vejlebrandvaesen.dk/virksomheder-og-institutioner/midlertidig-overnatning/), BR18 bilag 11b. **Afklares med Slagelse Kommune samtidig med udlejningstilladelsen (plan §3.3), ikke bagefter.**

**7. Færgen.**
Femten mand, begrænset bilkapacitet, sidste afgang 23.10, reservation via [ao-ferry.teambooking.dk](https://ao-ferry.teambooking.dk/new-booking). Koster ingenting i regnearket og hele fredag aften i virkeligheden, den gang det går galt.

---

## 3. Ti features, rangordnet efter kroner pr. linje kode

### 3.1 Tærskel-forsalg — den ene mekanik, der de-risker alle tre indtægtslinjer

**Det bærende forslag. Alt andet på listen er mindre end det her.**

Et `ophold` får tre felter mere: `minimum` (hvor mange der skal til), `beslutningsdato` (hvornår det afgøres), og `forudbetaling` (betales ved booking, ikke ved ankomst). Fladen og `/sporene` viser det åbent:

> **Mandeweekend 15.–17. januar. 15 pladser, 11 skal bruges. Beslutning 5. januar. Du betaler nu — aflyses den, får du pengene tilbage.**

Hvad det løser, i rækkefølge efter hvad det er værd:

- **Festivalen bliver en beslutning i maj i stedet for en overraskelse i juli.** Sælg billetten i februar med en offentlig tærskel. Ved 100 solgte kører den; under, aflyses den 1. maj, og pengene går tilbage. Året går fra at hænge på vejret i uge 27 til at hænge på et tal, I kan se vokse fra februar. Det er Burner-logik, ikke kommerciel logik: deltagerne er med til at beslutte, om den findes.
- **Likviditeten flytter sig derhen, hvor hullet er.** Arket viser fire underskudsmåneder i januar–april (scenarie B). Festivalforsalg lander præcis dér. Det er ikke ny omsætning — det er den omsætning, I alligevel får, betalt fem måneder før. Med 100 billetter à ~3.400 kr. er det en trecifret sum ind i den måned, kassen er lavest.
- **Mandeweekenden holder op med at være en gætteleg.** 11-tallet står i regnearket i dag og bliver til en offentlig linje, deltagerne kan se. En weekend med 9 tilmeldte aflyses den 5., ikke den 15., og I mister en weekend i stedet for 700 kr. og to arbejdsdage.
- **No-shows forsvinder.** Betalte 850 kr. filtrerer anderledes end et ja i en tråd.

Databasen kan det næsten allerede: `pladser` har status `forespurgt/bekræftet/betalt/afbudt`, kapacitetstriggeren tæller de optagende. Der mangler et gulv, en dato og en refusionsvej.

**Afhænger af:** C2 (BYG-562), D1 (BYG-563), CVR.
**Målt i dag, så I ikke skal:** Stripe tager for MobilePay i Danmark **1,5 % + 2,80 kr. pr. transaktion plus 35 kr./md** ([Stripe DK, lokale betalingsmetoder](https://stripe.com/dk/pricing/local-payment-methods), målt 17/9-2026). På en mandeweekend med 15 × 850 kr. er det 218 kr., altså 1,7 %. Det er acceptkriterium 7 på BYG-563, besvaret med kilde og dato.

### 3.2 Måleren — de tre gæt, der kan retires med to felter

El, vand og varme aflæst med dato. Telefonen, to tal, offline, samme mønster som feltregistreringen fra BYG-550, der allerede virker. Gæstedøgn kommer fra `ophold` og `pladser`, som systemet allerede kender.

Efter én fyringssæson: divider. Så er «22 kr. pr. gæstedøgn, VURDERING» blevet til et tal med et kald bag sig, og hver eneste pris på stedet kan forsvares. **Det er den billigste ting på hele listen, og den retirer arkets største usikkerhed.** Samme mekanik tager forsikringspolicen og ejendomsskattebilletten (arkets næststørste gæt, 5.000 kr./md).

**Krav:** aflæsningen skal kunne skrives ned på under ti sekunder med kolde fingre i november. Alt andet bliver ikke gjort.

### 3.3 Likviditetslinjen — ét tal på `/internt`

Ikke et dashboard. Ét tal og én sætning:

> **Kassen 1. februar: 186.000 kr. Laveste punkt i de næste 90 dage: 141.000 den 12. januar.**

Fodret af rigtige ophold i D1, rigtige faste udgifter, og de målte forbrugstal fra §3.2. Regnearket er en model; det her er en tilbagelæsning. Lige nu står tallene hardkodet i `build.py` fra en regnearksversion, der allerede afviger fra den, jeg har fået. **En kopi af et regneark i HTML er en påstand med udløbsdato.**

**Vurdering:** det her er det, Steven faktisk skal kigge på hver mandag morgen i 2027. Ikke belægningsprocent, ikke omsætning — afstanden til bunden.

### 3.4 Færgen som en del af bookingen

Ingen integration, ingen API. Ét felt på pladsen (**ankommer med bil: ja/nej, hvilken afgang**) og en bekræftelsesmail, der siger det, man faktisk skal vide: afgangen fra Stigsnæs, at bilpladser skal reserveres, linket, og at man skal være der ti minutter før. På `/internt/ophold`: hvor mange biler kommer på hvilken afgang.

**Højeste værdi pr. linje kode på hele listen.** Det er ren stedkundskab omsat til to felter, og det er forskellen på at en weekend begynder ved bålet eller på en kaj.

### 3.5 De syv lukkede uger, lagt ind før året sælges

`ot-lukket` findes allerede som opholdstype med `hele_stedet = 1`. Overlap-triggeren i `0007` betyder, at **en lukket uge i databasen gør det fysisk umuligt at sælge den væk.** Syv INSERTs. Det er hele funktionen.

Det er den eneste strukturelle beskyttelse mod de 36 uger, og den koster ingenting. **Læg dem ind, før kalenderen fyldes, ikke bagefter — bagefter er der altid en grund.** Og så skal budgettet regnes igen med dem, for de koster omsætning. Det er prisen, og den skal stå i arket, ikke i en god intention.

### 3.6 Prisen som en knap, ikke som tre kopier

850 kr. står tre steder i dag: i regnearket (B23), i seed-rækken `ot-mandegrupper.pris_fra`, og i HTML på `sporene.html` og `maend.html`. Arket kalder selv prisen «den billigste knap på hele arket» (A37): ved 1.200 kr. stiger nettoen pr. weekend markant.

**Gør `opholdstyper.pris_fra` til eneste kilde og render sitet fra den.** Så er den billigste knap på arket ét UPDATE i stedet for et deploy.

*Sidebemærkning, som I selv skal afgøre:* arket sætter nettoen ved 1.200 kr. til «ca. 6.800 kr.». Regnet med arkets egne tal — 20 % moms, 3.000 kr. materialer, 1.000 kr. markedsføring, 100 kr. mad pr. gæstedøgn, 56,50 kr. forbrug pr. gæstedøgn ved 50 % vinter — får jeg **5.705 kr.** Ved 850 kr. rammer jeg arkets 1.505 kr. præcist, så modellen er forstået rigtigt. Forskellen ved 1.200 er ~1.100 kr., og den skal findes i én celle, ikke forklares.

### 3.7 Brevet, der ikke lander i en privat indbakke (BYG-558)

`/bliv-en-del` lover «svar inden 7 dage» og åbner et `mailto:` til en privat gmail. Sitets eneste dør ind er en blindgyde med et løfte på. BYG-547 er lukket som Done, men `mailto:`-formularen står stadig i `build.py`.

I år 0 kommer indtægten fra en håndfuld mennesker, der skriver. **Ryk den op.** Sagen er allerede skåret rigtigt, inklusive honeypot i stedet for CAPTCHA.

### 3.8 Vagter og bidrag, læst som år 0-instrument (BYG-569)

H1 er skrevet som retfærdighedsregnskab. I år 0 er den noget andet og mere konkret: **mandeweekendens produkt er 52,5 timers arbejde, og modellen bogfører 40 % af værdien som sparet kontant — 45.738 kr. over otte weekender.** Ingen måler, om det sker. En vagt, der bliver registreret, er kvitteringen for forretningsmodellen.

Byg den lille: en vagt er et tidspunkt med pladser, ikke en opgave med en ansvarlig. Timer mod person og vagt. Kapital, lån og udlæg aldrig lagt sammen — det løfte står allerede på `/bliv-en-del`.

### 3.9 Vinterresidens — den ene indtægtslinje, der ligger urørt i jeres eget ark

Arket sælger januar–april som «stille uger»: 4 personer × 1.500 kr./uge = ca. 6.000 kr./md. Og separat 2 værelser til vinterfællesskab à 4.000 kr./md. Visionen siger det hårdt: *«En ø i februar er ikke en festival. Det er dér, folk rejser.»* Ni JER-uger uden en krone ligger i præcis den periode.

**Sælg vinteren som måneder, ikke som uger.** Fire værelser à 4.000 kr. er 16.000 kr./md mod 6.000. Målgruppen findes og er nem at nå: folk, der skal skrive noget færdigt, remote-arbejdere, og præcis den type, der senere bliver rejsende i Hjulet. Det er også den eneste indtægtslinje, der **bygger fællesskabet i stedet for at belaste det** — månedsgæster om vinteren er den naturlige rekrutteringskanal til bærere, og de er der i den årstid, hvor kulturen laves.

Platformen kan det allerede: `ophold` er dato-intervaller, `ot-stille` er ikke-eksklusiv. Det, der mangler, er en pris og en side. **Og momsspørgsmålet i §2.4 skal afklares først** — hvis hotelundtagelsen gælder, forsvinder en fjerdedel af regnestykket.

### 3.10 Ting med en dato

En tabel. Ikke et compliance-system.

| Ting | Dato | Kilde |
|---|---|---|
| Udlejningstilladelse — **dør ved ejerskifte**, ny skal søges | ved closing | Campingreglementet § 5 |
| Campingretten — bortfalder efter 3 år uden drift | afklares før bud | Planloven § 56, stk. 4 (B23) |
| Energimærke E, udløbet | **24/6-2021** — skal fornys ved udlejning | dingeo |
| Radon «meget høj» — mål før helårsudlejning | før første vintergæst | dingeo |
| Bopælspligt ved landbrugsnotering | 6 mdr. efter erhvervelse | BBR/B12 |
| Anmeldelse af midlertidig overnatning | 2 uger før hver gang | BR18 bilag 11b |
| Forsikringspolice og ejendomsskattebillet | hentes — de er gæt i dag | arkets A42 |

Samme mekanik som genbesøgsdatoen i H3 (BYG-571). **To features, én tabel.** Det er også her, H3's egentlige værdi ligger i år 0: ikke at kunne beslutte, men at kunne finde beslutningen igen, når kommunen spørger.

---

## 4. Det jeg ikke ville bygge nu

**Heynabo eller Hylo (BYG-566 / BYG-572).** Beslutningen er Groks og skal træffes — men læs den mod noget, der står på `/maend`: *«Ingen gruppe på nettet bagefter.»* Produktet lover udtrykkeligt fravær af digitalt efterliv. Et samtalerum er måske det rigtige for **kernen**; det er ikke det, gæsterne er blevet lovet, og de to må ikke forveksles. Målt i øvrigt: Heynabo! ApS har **to ansatte** ([proff.dk](https://www.proff.dk/firma/heynabo!-aps/hvidovre/internetdesign-og-programmering/0O9XM6I0C2C)). Et fællesskab på tyve mennesker klarer sig på en tråd. Udskyd til der er tredive.

**eID-underskrift (BYG-560).** Ingen skriver under på noget i år 0, som ikke kan skrives under på papir ved køkkenbordet.

**Billy-integration (BYG-564).** Bogfør manuelt indtil der er nok bilag til at det gør ondt. Det gør det ikke ved 15 ophold.

**AI-skriveren i fondssporet.** Korpus og stemmeprofil er bygget. Modellen får lov at skrive, når der er et CVR og en frist. Rækkefølgen i E1's egen note er rigtig.

**Mere release-mekanik nogen steder.** Jf. adskillelses-repoets regel: ingen bygger mere hegn omkring et tomt rum.

---

## 5. Portalen og Vendhjem — analysen du bad om

**Kort svar: nej, ikke nu, og formentlig aldrig som én kodebase. Men lån én ting, og læg én dato ind.**

**Hvad portalen er, målt.** Next.js 16, Supabase med RLS, Drizzle, Inngest, Sentry, Checkly, Vercel. Kunder, projekter, leads, kalender, mødebooking, og et fakturadomæne med PDF-generering og rykkerflow. Reelt bygget og reelt testet. **Og pauset siden maj med nul åbne issues** — Linear kalder den selv «producer-uden-consumer; genstart kræver en navngiven kunde».

**Hvorfor ikke.**

1. **Den er ikke multi-tenant.** Repoets egen audit (`PORTAL-AUDIT-DEL3`) lister BygMedAI hardkodet i fjorten filer: brandnavn i navigationen, CVR 37244449 og Halfdansgade-adressen i faktura-PDF'en, **bankkonto og MobilePay-nummer i to mailskabeloner**, afsenderadresse, OG-tags. Det er ikke en konfigurationsopgave, det er en ombygning.
2. **At lægge to pre-revenue-produkter sammen giver ét pre-revenue-produkt.** Portalen venter på en kunde. Vendhjem venter på et CVR. Fusionen fjerner ingen af de to ventetider og tilføjer en integrationsopgave.
3. **Argumentet fra S593 holder stadig, og det er godt.** Access giver auth gratis for `/internt`; D1 og R2 er gratis i denne størrelse; et Supabase-projekt koster 10 USD/md. Vendhjems data i BygMedAIs database betyder at en restore rammer to forretninger. Det står allerede skrevet ned i `vh-worker/README.md`, og det skal ikke skrives om.
4. **Persondata.** Vendhjem kommer til at holde noget af det mest private, et system kan holde: hvem der har søgt om at bo et sted, og hvad de skrev i brevet om deres største frygt. Det skal ikke ligge i samme base som kundefakturaer. Det er ikke jura, det er anstændighed.

**Hvad jeg ville låne — én ting, ved én lejlighed.**
Et retreat til 30.000 kr. og en udlejet festival til 50.000 kr. er B2B. De skal have en faktura med CVR, ikke et MobilePay-link. Portalen har et fungerende faktura-PDF-modul (`pdf-lib`, `src/app/api/invoices/[id]/pdf`) og et rykkerflow på Inngest.

Når den første retreatfaktura skal skrives — **vurdering: omkring marts 2027, ved uge 10's intro-retreat** — er der to veje: fakturér fra et eksisterende selskabs bogholderi, eller løft faktura-modulet ud som et lille bibliotek. **Løft modulet, ikke appen.** Og først når fakturaen findes, ikke før.

**Den dato, der skal lægges ind nu.**
Ikke en fusion. **En stiftelsesdato for foreningen med CVR.** Den blokerer Stripe, LAG, Fonde.dk-adgangen gennem Slagelse Kommune, momsregistreringen og enhver faktura. Der er ingen Linear-sag på den. Det er det billigste, mest blokerende punkt i hele materialet.

**Om to år.** Hvis Vendhjems værktøj skal sælges til andre fællesskaber — og det kunne det godt, for der findes ikke noget dansk, der gør det her ordentligt — så er det **Vendhjem**, der bliver produktet, og portalen, der bliver lånt fra. Ikke omvendt. `vh-worker/README.md` navngiver allerede exit-prisen: SQLite → Postgres, en trådt sti. Det er en god pris. Betal den den dag, der er en anden forening, der spørger.

---

## 6. Rækkefølge

**Nu — før noget bygges (uge 38–39)**

1. Send dig selv et magic link. Virker mailen i produktion, eller logges URL'en? (§1.1)
2. Afklar hvilken regnearksversion der er sand — v2 eller v4 — og ret `/internt/oekonomi`. (§1.2)
3. Ret forsiden: hvem ejer stedet, skrevet så det tåler at modparten læser det. (§1.2)
4. Sæt en dato på foreningens stiftelse og CVR. Opret sagen i Linear. (§5)
5. Læg de syv lukkede uger ind i kalenderen og regn budgettet igen med dem. (§3.5)

**Uge 39–41 — fyld det, der allerede kører**

6. 52 ophold i D1 fra `Kalender 2027`. Kalenderen på `/sporene` er i dag tom seks steder på en side, der skal sælge året.
7. B1 — brevet ind i systemet (BYG-558).
8. Måleren (§3.2). Den skal stå, før fyringssæsonen starter, ellers er vinteren tabt som måling.

**Uge 41–46 — tærskel-forsalg**

9. C2 (BYG-562) + D1/betaling (BYG-563) + tærskel, minimum, beslutningsdato, refusion (§3.1).
10. Færgefeltet og bekræftelsesmailen (§3.4).
11. Prisen fra databasen (§3.6).

**Vinteren 2026/27 — instrumenterne**

12. Likviditetslinjen (§3.3), når måleren har leveret to måneders tal.
13. H1 vagter og bidrag (BYG-569) — klar før den første byg-med-uge.
14. Ting med en dato (§3.10).

**Foråret 2027**

15. Festival-forsalget åbnes i februar med offentlig tærskel og beslutningsdato 1. maj.
16. H2 tilbagevendende (BYG-570) — efter den første mandeweekend, ikke før.

---

## 7. Antagelser jeg ikke kunne måle

| # | Antagelse | Hvem afklarer |
|---|---|---|
| V01 | At `RESEND_API_KEY` er sat, så magic links faktisk leveres | Steven — send dig selv et login |
| V02 | Hvilken regnearksversion der er gældende (v2 eller v4) | Steven |
| V03 | At bygning 2 (hotel/kro med overnatning) må bruges til overnatning uden yderligere tilladelse — og hvad der gælder for salen | Slagelse Kommune, Plan & Byg |
| V04 | Om momsfriheden over 1 måned gælder, når BBR siger «hotel og lign.» | revisor, før vinterpriserne trykkes |
| V05 | Om closing 1/12-2026 holder — hele arket regner fra den dato | Steven og Lai |
| V06 | Hvor mange biler færgen tager pr. afgang (siden svarede 403 herfra) | Agersø Omø Færgerne, ét opkald |
| V07 | Om de 850 kr. skal være 1.200 kr. | Steven — det er arkets egen «billigste knap» |
| V08 | Om `pris_fra`-seedet i D1 er blevet ændret siden migrationen | kun målbart med D1-adgang |

---

## 8. Hvad jeg ikke har gjort

Ikke skrevet kode. Ikke oprettet eller ændret Linear-sager — forslagene i §3 er forslag, og køen er Stevens. Ikke rørt `bygmedai-adskillelse`; det produkt har sine egne hegn og sin egen frist, og Agersø må ikke låne af det. Ikke læst Eriks materiale — det hører til Lais advokat. Ikke moderet §0: du bad om, at jeg ikke gætter, og det, der er værd at vide i dag, er at maskinen kører, kalenderen er tom, og året hænger på en uge i juli.

*— Vilde Serra, 17. september 2026. Målinger med kald eller kilde; vurderinger mærket; ingen regler.*
