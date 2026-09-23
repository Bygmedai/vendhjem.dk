# Facit — foden uden dato

## Køber / job

Et menneske, der overvejer en weekend på Agersø, og som læser siden på sin
telefon. Jobbet er: forstå stedet og beslutte sig. Ingen del af det job
kræver at vide, hvornår filen sidst blev rørt.

## Hvorfor

Steven, 23.09.2026: *«Fjern "seneste ændret", det er AI meta og meningsløst
for et menneske der læser siden.»*

Han har ret, og målingen bag er ældre end beslutningen. Datoen kom fra
HEAD-committets dato og skiftede ved merge. Run #163 (18.09, 22:07 UTC):
main blev rød og udrullet på samme tid, fordi elleve filer og `fod.js` kun
afveg i den dato. Svaret dengang var at holde de to datolinjer uden for
portens sammenligning med `git diff -I`. Det virkede — og det efterlod et
felt på hver eneste offentlige side, som fortalte læseren om filen i stedet
for om stedet, og en undtagelse i porten, der skulle vedligeholdes for
evigt for et felts skyld, ingen læser havde brug for.

Med datoen væk er foden determineret af kilden alene. Undtagelserne kan
derfor fjernes, og porten sammenligner igen alt.

## Ikke

- **Ikke** en «opdateret»-visning et andet sted. Et sted er ikke et
  dokument, og der er intet job, der kræver den oplysning.
- **Ikke** rørt `_redirects`, sitemap eller `<lastmod>` — maskinlæsbare
  datoer til søgemaskiner er noget andet end en linje til et menneske.
- **Ikke** rørt `git log`. Hvornår noget ændrede sig, står stadig i
  historikken, hvor det hører hjemme.

## Kilde

`.github/workflows/test.yml` (dato-undtagelserne, fjernet her) ·
`CLAUDE.md` §Byg og prøv, «[Vilde 19.09] — undtagen datoen» ·
run #163, 18.09.2026 22:07 UTC.

## Kill

Rives ud igen, hvis nogen kan navngive et menneske, der skal bruge datoen
til at træffe en beslutning. Indtil da: en oplysning, ingen har et job til,
er ikke en oplysning — det er støj med en dato på.
