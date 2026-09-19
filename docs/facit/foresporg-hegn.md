# Forespørg-hegnet

## Køber / job

Gæst der vil booke ophold / Lai der skal kunne sniffe ægte interesse.

## Hvorfor

POST på den offentlige formular var åben. ASCII-slug `/sporene/foresporg/{id}` svarede 200 med listen — soft-200, et falsk hit. HEAD på ø gav 404. Ingen CSRF, ingen honningkrukke, ingen rate, ingen sikkerhedshoveder. En curl uden session lavede en plads og kunne sende mail: sluse til `people` og Resend. Målt 19.09.2026, lukket i PR #61.

Genkoloniserings-copy og `laiydeh@gmail.com` er uændret med vilje. Steven bad om Lais navn på fladen.

## Ikke

Ikke betaling. Ikke ny auth. Ikke omskrivning af copy. Ikke ny privatlivs-mail. Ikke en booking-motor.

## Kilde

https://github.com/Bygmedai/vendhjem.dk/pull/61

`vh-worker/migrations/0016_foresporg_hegn.sql` (målingen i filhovedet)

## Kill

Riv CSRF/rate ud, hvis de spærrer ægte gæster. Læg ikke betaling her, før CVR/Stripe-porten står.
