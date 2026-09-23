# Facit — Det praktiske

## Køber / job

Mennesket, der overvejer en weekend på en ø, det aldrig har set, hos folk det
ikke kender, på et sted uden en eneste anmeldelse. Jobbet er ikke at blive
overbevist. Det er at få nok at vide til at turde trykke **Forespørg** — og til
at vide, hvad der sker bagefter.

## Hvorfor

**Svarene fandtes. De blev bare leveret for sent.**

Færgen fra Stigsnæs, sengetøjet, maden i de stille uger — alt sammen stod
skrevet ned, ordentligt og præcist, i `bekraeftelsesBrev`. Altså i den mail, et
menneske først får, **når det allerede har sagt ja.** Den information, der får
nogen til at turde, blev sendt efter at de turde.

Der fandtes ingen side at læse den på. «Alt du vil vide om BuddhiCamp» lå på
`agersoe.html` og blev 301'et til `/sporene` i #63. `/sporene` svarer ikke på
noget praktisk: den viser datoer, priser og en knap.

Målt 23.09.2026 på den levende flade: ordene «færge», «Stigsnæs», «sovepose» og
«bad» giver nul træffere på hele det offentlige site.

## Ikke

**Ikke en marketingside.** Ingen «hvorfor vælge os», ingen udsagn om oplevelsen,
ingen billeder af glade mennesker. Stedet har ingen anmeldelser, og en side, der
lyder som om det har, er en løgn, der bliver opdaget ved færgelejet.

**Ikke et gæt.** Hver linje har en kilde i repoet, listet i `build.py` over
sidens blok. Bad, strøm, wifi, hund, barn og ankomsttidspunkt står som **det, vi
ikke har svaret på** — for de er ikke skrevet ned nogen steder, og en FAQ, der
gætter, er ikke en service. Det er et løfte, nogen skal indfri, når gæsten står
der.

**Ikke en ny copy-stemme.** Sætningerne om færgen, sengetøjet og maden er dem,
der allerede står i bekræftelsesmailen. De er skrevet én gang og godkendt én
gang; at omskrive dem på en side ville give huset to versioner af samme
oplysning — samme fejlklasse som navnet, der stod to steder.

**Ikke en kontaktformular mere.** Siden peger på de to, der findes, og siger
hvilket løfte der hører til hver: tre dage på en forespørgsel, syv på et brev.

## Kilde

- `vh-worker/src/tekst.js` — `bekraeftelsesBrev`, `kvitteringBrev`, `afslagsBrev`, `brevKvittering`
- `vh-worker/migrations/0007_ophold.sql` — `opholdstyper`: pris, inkluderet, pris_note
- `vh-worker/src/ophold-sider.js` — de syv lukkede uger
- `vh-worker/src/ophold.js` — afbud findes kun som en intern knap
- `docs/facit/svarvejen-og-navnet.md` — svarvejen, som siden henviser til

## Kill

Siden rives ud eller skrives om den dag, `bekraeftelsesBrev` holder op med at
være sandheden om færgen og sengetøjet. Prøve 43 holder de to sammen på
tallene: ændrer brevet «tre dage» til noget andet uden at siden følger med,
bliver porten rød. Den fanger ikke alt — færgen kan ændre sig uden at nogen
retter nogen af dem.

Afsnittet «Det, vi ikke har svaret på her» rives ud, når svarene findes. Står
det der om et år, er det ikke ærlighed længere; så er det en undskyldning.
