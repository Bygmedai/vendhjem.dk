# Facit — svarvejen, navnet, uret og modtagerne

## Køber / job

Mennesket, der har spurgt om en uge på Agersø, og som nu har et spørgsmål:
*kan jeg komme dagen før? har I plads til to? hvad koster færgen?* Jobbet er
at kunne stille det spørgsmål — og for Lai: at se, hvem der har ventet for
længe, uden at læse datoer i en database.

## Hvorfor

Fire målinger, alle 23.09.2026.

**1 · Svarvejen gik kun den ene vej.** Mailen *til huset* bar
`reply_to: person.mail`. De fire, der gik den anden vej — kvittering på
forespørgsel, bekræftelse, afslag, brevkvittering — bar ingen. Målt i koden:
`sendMail(env, { to: person.mail, ...brev })`. Lai kunne svare gæsten med ét
klik; gæsten kunne kun trykke Reply, og den gik til `besked@vendhjem.dk`.
Ingen linje i repoet siger, at nogen læser den adresse.

**2 · Huset talte med to stemmer.** Brevkvitteringen underskrev
`Lai Yde / Vend Hjem, Agersø`. Forespørgselskvitteringen underskrev
`Vendhjem / Agersø`. Afslaget `Vend Hjem`. Bekræftelsen `Vendhjem`. Samme mand,
samme ø, fire breve, to navne — afhængigt af hvilken formular man kom ind ad.
Steven, 23.09.2026: **huset hedder Vendhjem.**

**3 · Modtagerne stod ingen steder.** `BREV_TIL` var ikke deklareret i
`wrangler.toml`, i CI eller i nogen fil. Cloudflares egen dokumentation:
*«When not used (or set to false), Wrangler will delete all vars before setting
those found in the Wrangler configuration.»* `keep_vars` var ikke sat. Hver
udrulning slettede altså variablen, og fallbacken i koden overtog i stilhed.
Ingen kunne læse ud af repoet, hvem der faktisk fik besked om penge i 2027.

**4 · Uret blev aldrig startet.** Kvitteringen lover «inden tre dage skriver vi
tilbage, om pladsen er din». `/internt/breve` har talt dage siden den blev
bygget. `/internt/ophold` talte ingenting: listen viste hvem der havde spurgt,
aldrig hvornår. En forespørgsel fra i går så præcis ud som en fra i forfjor.

## Ikke

**Ikke en omdøbning af sitet.** 32 steder i kilden siger «Vend Hjem», 9 siger
«Vendhjem». Stevens beslutning besvarede spørgsmålet om *mailene*. Logoet,
privatlivspolitikkens dataansvarlige, foreningsnavnet i `0002_seed_ldp.sql` og
Cloudflare Access-gruppen «Vend Hjem – medlemmer» er ikke rørt — to af dem er
formelle navne, og den ene er ikke engang kode. Det er en egen beslutning med
en egen pris.

**Ikke en kopi til flere modtagere.** Mekanikken er ét komma væk, og
`BREV_TIL` er nu deklareret, så kommaet kan sættes i en PR. Men en mailadresse
i `wrangler.toml` ligger i git-historik for altid på et offentligt repo, og
CLAUDE.md §Persondata siger: *«Læg ikke flere derind.»* Den beslutning tages
af et menneske, ikke af en builder, der fik at vide «go».

**Ikke en påmindelse.** Uret viser alderen; det sender ingenting. En
notifikation om en notifikation, ingen har bedt om, er støj — og den ville
kræve en cron, der kender en modtager, vi lige har konstateret ikke var
deklareret.

**Ikke et svar på, om `besked@vendhjem.dk` er en rigtig indbakke.** Det kan
ikke måles herfra. `reply_to` gør spørgsmålet ligegyldigt for gæsten: svaret
lander hos den, der i forvejen har forespørgslen.

## Kilde

- `docs/facit/besked-til-huset.md` — F1, som det her bygger ovenpå
- Cloudflare: https://developers.cloudflare.com/workers/wrangler/configuration/ (§Source of truth)
- Stevens test 23.09.2026 kl. 12:45:45Z — `pladser.dbd43b90…`, `mail_fejl: null`

## Kill

`reply_to` ryger ud, den dag `besked@vendhjem.dk` bliver en bemandet indbakke,
nogen beviseligt læser — altså når der findes en måling, ikke en hensigt.

Uret ryger ud, hvis løftet i kvitteringen ryger ud. Står der ikke længere «inden
tre dage», er der ingen frist at overskride, og `SVARFRIST_DAGE` er en løgn på
en flade.

`tid.js` ryger ud, hvis der kun er én flade tilbage, der tæller dage.
