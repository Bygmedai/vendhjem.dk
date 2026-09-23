# Facit — Betalingsvejen

## Køber / job

Mennesket, der har fået ja til en plads, og som nu skylder 850 kr. Jobbet er at
kunne betale dem — én gang, uden at ringe til nogen, og uden at nogen på Agersø
skal føre regnskab i hovedet.

## Hvorfor

**`pladser.status` har kunnet stå på `'betalt'` siden `0007_ophold.sql` blev
skrevet. Ingen kode har nogensinde sat den.**

Målt i koden 23.09.2026: `betalt` optræder fem steder — en CHECK-constraint, en
`OPTAGENDE`-liste, en label i en dropdown, en sum på `/mit` og et `Set` af
gyldige statusser. Ingen `UPDATE`. Statussen var en tom skuffe med et skilt på.

Bekræftelsesmailen nævnte en pris (`850 kr. — seng og al mad indgår`) og sagde
ikke med ét ord, hvordan pengene skulle skifte hænder. Et menneske, der havde
fået ja, sad med et løfte om en seng og ingen måde at betale for den.

Og `/praktisk` — merget en time før den her sag blev åbnet — siger nu højt:
*«Du bliver ikke bedt om penge, før du har fået et ja.»* Sandt om rækkefølgen.
Men der stod ikke noget om, at man heller ikke blev bedt om dem bagefter.

## Ikke

**Ikke en betaling, der kører.** Hverken `STRIPE_SECRET_KEY` eller
`STRIPE_WEBHOOK_SECRET` findes. Uden dem bærer bekræftelsen intet link, og
webhooken svarer 503. **Ingen bliver trukket for noget, før et menneske sætter
to hemmeligheder.** Samme form som `mail.js` uden Resend-nøgle: en funktion, der
returnerer ok for noget, den ikke har gjort, gør fejlen usynlig hele vejen op.

**Ikke et link fra Stripe i en mail.** En Checkout Session udløber efter et
døgn. Et link, gæsten åbner tre dage senere, er dødt — og en død betalingsside
siger ikke «prøv igen», den siger at noget er galt med stedet. Mailen bærer
`vendhjem.dk/betaling/<plads>/<signatur>`, som ikke udløber; sessionen mintes
ved hvert klik.

**Ikke et kortnummer, vi rører.** Hosted Checkout. Kortfelterne ligger hos
Stripe. Det er hele grunden til at vælge den form frem for Elements.

**Ikke idempotens i JavaScript.** `event_id` er UNIQUE, og
`betaling_hoejst_en_betalt` er et partielt unikt indeks. Stripes egen
dokumentation: *«Webhook endpoints might occasionally receive the same event
more than once.»* To samtidige leveringer kommer begge forbi en `if`-sætning;
ingen af dem kommer forbi en constraint. Samme regel som vagternes tre hegn i
`0015`.

**Ikke en beslutning om, hvis konto pengene lander på.** Den eneste Stripe-konto
i sessionen hedder **Bygmedai** og er i livemode. Foreningen er «under
stiftelse». Penge fra femten mænd for en seng på Agersø ville altså gå ind i et
andet selskabs regnskab. Det er ikke en kodefejl, og koden er ligeglad — nøglen
er en hemmelighed, og den kan pege på hvad som helst. **Men det er en beslutning,
der skal træffes af et menneske med åbne øjne, før nøglen sættes.** Det samme
gælder moms: 850 × 15 × 3 weekender er under registreringsgrænsen, retreats og
festival er ikke.

**Ikke selvbetjent afbud eller refusion.** En refusion går gennem Stripes
dashboard og et menneske. Der er ingen knap, og der bliver det ikke i den her
skive.

## Kilde

- Stripe: https://docs.stripe.com/webhooks (§Verify manually — signeringsformatet, ordret)
- Stripe: https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted
- `stripe_implementation_planner`, 23.09.2026 → `{checkout_type: hosted, origin_context: web}`
- `vh-worker/migrations/0007_ophold.sql` — statussen, der aldrig blev sat
- `docs/facit/det-praktiske.md` — sætningen om, hvornår man bliver bedt om penge

## Kill

Rives ud, hvis betalingen flytter væk fra Stripe. Hele vejen: migration,
`betaling.js`, ruten i `index.js`, linjen i `bekraeftelsesBrev` og prøve 44.
Halvt fjernet er værre end helt — en bekræftelse med et link til en rute, der
ikke findes, er det eneste, der er værre end ingen betalingsvej.

`betaling_hoejst_en_betalt` ryger aldrig ud. Den dag nogen mener, en plads skal
kunne betales to gange, er det et nyt produkt, ikke en ændret constraint.
