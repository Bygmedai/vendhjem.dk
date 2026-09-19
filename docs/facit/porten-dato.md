# Porten og datoen i foden

## Køber / job

Steven, der merger — og dermed udruller. Jobbet: at en merge, hvor kun datoen
har flyttet sig, ikke gør main rød.

## Hvorfor

«Senest ændret» i foden er HEAD-committets dato (`git log -1 --format=%cs`).
Stevens merge-commit får merge-dagens dato, PR'en havde sin egen, og porten
på main faldt (run #163, 18.09.2026 22:07 UTC) over ti sider og `fod.js`, der
kun afveg i datoen. Merge udruller, så main var rød og live på samme tid.

Rettelsen er to lag, fordi ét ikke er nok: `git diff -I` på de to datolinjer i
`test.yml`, og en pladsholder i `build.py`, så `fod.js` bærer datoen i én linje
(`SENEST`) og fodens *ord* i en linje uden dato. Uden pladsholderen ville `-I`
gøre hele foden usynlig for porten.

## Ikke

Ikke en fast dato i foden. Ikke en dato fra filens egen mtime. Ikke en port,
der ignorerer `fod.js` som helhed. Ikke en regel om at committe datodrift.

## Kilde

https://github.com/Bygmedai/vendhjem.dk/pull/60

https://github.com/Bygmedai/vendhjem.dk/actions/runs/35422600000 — run #163
(nævnt i `CLAUDE.md` §Byg og prøv, «undtagen datoen»)

Falsificeret i PR'en: kun dato → grøn · et ord i foden → rød · ny fil → rød.

## Kill

Får foden en dato fra et andet sted end HEAD (f.eks. udrulningstidspunktet
skrevet af `udrul.yml`), rives `-I`-linjerne og pladsholderen ud samme dag.
Så er de et hul, ikke et hegn.
