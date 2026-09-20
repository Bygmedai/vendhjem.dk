# Stale cut — orphan HTML og cookies-sandhed

## Køber / job

Steven, der merger. Jobbet: at gamle mock-sider ikke ligger i repoet, og at
`/cookies` siger det, Workeren faktisk sætter.

## Hvorfor

`cookies.html` sagde «sitet sætter ingen cookies». Det var forkert efter `/mit`
(`vh_session`, `vh_enhed`) og CSRF (`vh_csrf`) plus Cloudflare Access
(`CF_Authorization`). Målt i `krypto.js` / `session.js` / `hegn.js` 20.09.2026:
HttpOnly, Secure, SameSite=Lax.

De elleve forældreløse HTML-filer i roden og de tolv i `design/` blev ikke
bygget, ikke linket fra den levende menu og ikke serveret (`.assetsignore`).
De bar copy, ingen har godkendt. `_redirects` fanger de gamle adresser i begge
former; HTML-filerne behøver ikke at ligge der.

Prøve 36 krævede før, at en 301-kilde, der endte på `.html`, fandtes som fil.
Det stod i vejen for at slette dem. Den tjekker nu destinationen, og at de
pensionerede adresser stadig har begge former.

## Ikke

Ikke sletning af sider `build.py` stadig skriver (`fundamentet`, `permakultur`,
`maend`, `noter`, `sporene`, …). Ikke `mit-offline.html` (service worker).
Ikke sluk af GitHub Pages. Ikke ændring af Worker-logik.

## Kilde

`vh-worker/src/krypto.js` `cookie()` — HttpOnly, Secure, SameSite=Lax.

`vh-worker/src/session.js` — `vh_session` Path=/, 90 dage; `vh_enhed` Path=/mit, 1 time.

`vh-worker/src/hegn.js` — `vh_csrf` Path=/sporene, 8 timer.

Live `/cookies` 20.09.2026: «Sitet sætter ingen cookies.» CSP på
`https://vendhjem.dk/sporene` tillader ikke `static.cloudflareinsights.com`.

## Kill

Kommer en af de slettede sider tilbage som levende destination, rives
redirecten ud samme dag, og siden skal bygges af `build.py`. Bliver
cookie-sættet et andet, rettes `/cookies` og prøven i samme PR.
