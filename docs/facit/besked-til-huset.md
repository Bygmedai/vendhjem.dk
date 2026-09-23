# Facit — besked til huset

## Køber / job

Lai, der skal sælge 2027-kalenderen. Jobbet er: **vide at nogen har spurgt**,
mens de stadig overvejer.

## Hvorfor

Målt 21.09.2026 i den dybe UX-gennemgang, som fund **F1**:

```
grep -rn "LAI_MAIL\|NOTIFY\|til_huset" vh-worker/src/   →  ingen træffere
ophold.js:229  await sendKvittering(env, { person, o })  ←  kun til gæsten
```

Kvitteringen lover: *«Inden tre dage skriver vi tilbage, om pladsen er din.»*
Ingen kode fortalte et menneske på Agersø, at uret var startet.
Forespørgslen lå i D1, til nogen tilfældigvis åbnede `/internt/ophold` bag
Access.

Brevsporet på `/bliv-en-del/skriv` har gjort det rigtigt fra dag ét — sender
til huset **og** kvitterer. Den vej, der skal sælge året, var den svagest
bevogtede af de to.

Branchetallet, for proportionernes skyld: korttidsudlejning ser ~25 % højere
konvertering ved svar inden for en time. Det kan man ikke, hvis man ikke ved,
der er noget at svare på.

## Ikke

- **Ikke** en ny adresse at passe på. `modtagere(env)` er eksporteret fra
  `breve.js` og genbrugt. Ét sted; kopieres den, siger de to spor en dag hver
  sit om, hvem der skal have post.
- **Ikke** et referat. Gæstens besked står ordret i mailen — et referat er en
  ekstra chance for at misforstå.
- **Ikke** en notifikationsindstilling, et dashboard eller en kø. Én mail.
- **Ikke** F4 (uret på de tre dage). Det er en egen skive, og den er ikke
  bygget her.

## Kilde

UX-QA 21.09.2026, fund F1 · `vh-worker/src/breve.js` (mønstret) ·
`docs/AAR-0-DRIFTSPLAN-2026-09-17.md` (kalenderen skal bære året).

## Kill

Rives ud, hvis huset en dag får en rigtig indbakke — et sted hvor
forespørgsler samles og tildeles. Indtil da er en mail med `reply_to` den
korteste vej fra «nogen spurgte» til «nogen svarede».
