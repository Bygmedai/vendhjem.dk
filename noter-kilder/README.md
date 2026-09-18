# Noter

Én fil pr. note. Filnavn: `ÅÅÅÅ-MM-DD-slug.md` (kun små bogstaver, tal og bindestreg i slug).
Nyeste dato øverst på /noter. Datoen i filnavnet er den, der vises.

Format:

```
titel: Registreringen, første weekend
foto: udeplads

Første afsnit. Afsnit adskilles af en tom linje.

## En mellemrubrik

*Kursiv*, **fed** og [et link](https://…) virker. Ikke mere end det.
```

`foto:` er valgfri og skal være en slug fra `images/sted/_manifest.json`.
Mappen hedder `noter-kilder`, ikke `noter`: en mappe ved navn `noter` ville skygge for siden `/noter`.
`python3 build.py` bygger `/noter` og `/noter.xml` (RSS). Ingen tags, ingen kommentarer.
