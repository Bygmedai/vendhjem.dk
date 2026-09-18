#!/usr/bin/env python3
"""Vend Hjem · Havkant — bygger de statiske sider.
Ingen build-kæde på serveren: dette script skriver almindelige HTML-filer,
som ligger færdige i repoet. Kør: python3 build.py
"""
import json as _json
import os, re
ROOT = os.path.dirname(os.path.abspath(__file__))

FOOT_DATE = "15. september 2026"

# Intern navigation har ÉN kilde: nav-internt.json. Den blev delt i to —
# build.py og fondsværktøjets views.js — og listerne drev fra hinanden, så
# man ikke kunne komme fra Økonomi til Fonde. To lister holdt i sync af
# hukommelse er et løfte, hukommelsen ikke kan holde.
NAV_INTERNT = _json.load(open(os.path.join(ROOT, "nav-internt.json"), encoding="utf-8"))["punkter"]

def nav_internt(depth, current):
    ud = []
    for pkt in NAV_INTERNT:
        her = ' aria-current="page"' if pkt["id"] == current else ""
        ud.append(f'<a href="{depth}{pkt["sti"]}"{her}>{pkt["label"]}</a>')
    return "\n".join(ud)

# "Log ind" peger paa det live Access-beskyttede /internt/ paa vendhjem.dk.
# Relativt internt/ maa ikke ligge i de offentlige HTML-filer: internt/ er
# gitignored (maa aldrig paa GitHub Pages), og CI's static crawl ville 404.
# workers.dev er bevidst lukket (workers_dev = false) og maa ikke vaere maalet.
INTERN_BASE = "https://vendhjem.dk"

def head(title, desc, path, intern=False, current=None):
    # Alle stier er absolutte. Se HVORFOR-ABSOLUTTE-STIER nederst i filen.
    depth = "/"
    robots = '<meta name="robots" content="noindex, nofollow">\n' if intern else ""
    canon = "" if intern else f'<link rel="canonical" href="https://vendhjem.dk/{path.replace("index.html","").replace(".html","")}">\n'
    if intern:
        nav = f'''<nav class="nav" aria-label="Internt">
{nav_internt(depth, current)}
</nav>'''
        brand = f'<a class="brand" href="{depth}internt/">Vend <em>Hjem</em> <span class="meta" style="margin-left:10px">Internt</span></a>'
    else:
        nav = f'''<nav class="nav" aria-label="Hovedmenu">
<a href="{depth}fundamentet"{' aria-current="page"' if current=="fundamentet" else ""}>Fundamentet</a>
<a href="{depth}sporene"{' aria-current="page"' if current=="sporene" else ""}>Sporene</a>
<a href="{depth}permakultur"{' aria-current="page"' if current=="permakultur" else ""}>Permakultur</a>
<a href="{depth}bliv-en-del"{' aria-current="page"' if current=="bliv" else ""}>Bliv en del</a>
<a href="{INTERN_BASE or depth}{"/" if INTERN_BASE else ""}internt/">Log ind →</a>
</nav>'''
        brand = f'<a class="brand" href="{depth}">Vend <em>Hjem</em></a>'
    return f'''<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
{robots}{canon}<meta name="theme-color" content="#e9e7e0">
<link rel="preload" href="{depth}assets/fonts/lora-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{depth}assets/fonts/jetbrains-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="{depth}assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{depth}assets/vh.css">
</head>
<body>
<header class="site-head{' intern' if intern else ''}">
<div class="stage row">
{brand}
{nav}
</div>
</header>
<main>
'''

def foot(intern=False, path=""):
    depth = "/"
    if intern:
        return f'''</main>
<footer class="site-foot">
<div class="stage row">
<p>Intern side · bag login · del ikke links herfra videre</p>
<p>Tal på disse sider er en model, ikke et regnskab. Kilde og dato står ved hver tabel.</p>
</div>
</footer>
</body>
</html>
'''
    return f'''</main>
<footer class="site-foot">
<div class="stage row">
<p>Vend Hjem · Agersø · Slagelse Kommune</p>
<p>Udkast · {FOOT_DATE} · Lederudvikling og foredrag ligger på <a href="https://www.humandirection.dk/">humandirection.dk</a></p>
<p><a href="{depth}privatlivspolitik">Privatlivspolitik</a> · <a href="{depth}cookies">Cookies</a></p>
</div>
</footer>
</body>
</html>
'''

# ─── Fotos fra stedet ───────────────────────────────────────────────────────
# Kilderne er ca. 900 px brede (skærmbilleder, ikke rå foto), så billederne
# vises bevidst i spaltebredde og aldrig full-bleed. Se BYG-551.
import json as _json
FOTO_MAN = _json.load(open(os.path.join(ROOT, "images/sted/_manifest.json"), encoding="utf-8"))
FOTO_ALT = {
 "oppefra": "Stedet set fra luften i aftensol: seks hektar eng og læhegn med Storebælt bagved.",
 "udefra": "Sti gennem hæk og buske op mod det hvide hus med rødt tag.",
 "salen": "Salen med sofaer og tæpper under et loft af tang og synlige bjælker.",
 "salen-2": "Salen med sofa, tæppe og maleri under skråt træloft.",
 "koekken": "Industrikøkkenet med stålborde, komfur, opvaskemaskine og et langt træbord i midten.",
 "koekken-2": "Mindre køkken med hvide skabe, komfur og køleskab.",
 "spisestue": "Langbord med stole og bænk langs vinduet i spisestuen.",
 "sovesal": "Sovesal med senge under skråvæg og gardiner imellem.",
 "vaerelse": "Værelse med dobbeltseng, hvide vægge og et rødt maleri.",
 "vaerelse-dobbelt": "Værelse med dobbeltseng op ad en rå murstensvæg.",
 "hyggekrog": "Overdækket terrasse med bord, stole og en bemalet væg.",
 "solnedgang": "Solnedgang over engen.",
 "bordet-i-marken": "Et langt dækket bord midt i engen med horisonten bagved.",
 "udeplads": "Udendørs opholdsplads med bålsted og bænke.",
 "cafe": "Udendørs bar med tavler og skilte i aftenlys.",
 "faellesspisning": "Mange mennesker spiser sammen ved langborde udenfor.",
}

# Hvor motivet ligger, naar et staaende foto beskaeres til et liggende felt.
# Uden det tager object-fit: cover midten, og et portraetfoto af mennesker ved
# et langbord bliver til et billede af himmel og et tag. Kun de fotos der
# behoever det staar her; resten centreres.
FOTO_FOKUS = {
 "faellesspisning": "center 78%",
 "udeplads": "center 88%",
 "cafe": "center 62%",
 "bordet-i-marken": "center 62%",
}

def _srcset(slug, d, ext):
    w = FOTO_MAN[slug]["w"]
    parts = []
    if w > 480:
        parts.append(f"{d}images/sted/{slug}-s.{ext} 480w")
    parts.append(f"{d}images/sted/{slug}.{ext} {w}w")
    return ", ".join(parts)

def _pic(slug, d, sizes):
    m = FOTO_MAN[slug]
    return (f'<picture>\n'
            f'<source type="image/avif" srcset="{_srcset(slug, d, "avif")}" sizes="{sizes}">\n'
            f'<source type="image/webp" srcset="{_srcset(slug, d, "webp")}" sizes="{sizes}">\n'
            f'<img src="{d}images/sted/{slug}.webp" width="{m["w"]}" height="{m["h"]}" '
            f'alt="{FOTO_ALT[slug]}" loading="lazy" decoding="async"'
            + (f' style="object-position:{FOTO_FOKUS[slug]}"' if slug in FOTO_FOKUS else "")
            + '>\n'
            f'</picture>')

def foto(slug, cap, path="", sizes="(max-width: 760px) 100vw, 700px", cls=""):
    """Foto som figur i spalten: billede, 1px streg, mono-tekst. Ingen ramme, ingen skygge."""
    d = "/"  # alle stier absolutte, se HVORFOR-ABSOLUTTE-STIER
    k = (" " + cls) if cls else ""
    return (f'<figure class="foto{k}">\n' + _pic(slug, d, sizes) +
            f'\n<figcaption class="meta">{cap}</figcaption>\n</figure>')

def foto_i_horisont(slug, cap, path="", cls="h-side", stil="", sizes=None):
    """Foto der udfylder en horisont-figur (designsystemets .horizon > img).

    stil: inline min-height naar cellen er bred (to-spalters baand), saa
    udsnittet ikke bliver en kikkertspalte. Kilderne er 4:3, saa en celle
    paa 589 px skal have ca. 300 px hoejde for at beholde motivet."""
    d = "/"  # alle stier absolutte, se HVORFOR-ABSOLUTTE-STIER
    sizes = sizes or "(max-width: 860px) 100vw, 420px"
    st = f' style="{stil}"' if stil else ""
    tekst = f'\n<p class="cap">{cap}</p>' if cap else ""
    return (f'<div class="horizon {cls}"{st}>\n' + _pic(slug, d, sizes) + tekst + '\n</div>')


def foto_baand(items, sizes="(max-width: 600px) 100vw, (max-width: 860px) 50vw, 390px", stil="min-height:300px"):
    """Baand af fotos i gitteret: hver celle er fyldt ud, teksten ligger i
    hjoernet i mono. Samme greb som salen paa /maend, bare flere ved siden
    af hinanden. Ingen ny klasse, ingen ny farve."""
    n = len(items)
    kol = {2: "g-2", 3: "g-3", 4: "g-4"}[n]
    celler = "\n".join(
        f'<div class="media">' + foto_i_horisont(slug, "", stil=stil, sizes=sizes) + '</div>'
        for slug in items)
    return f'<div class="g {kol} nb">\n{celler}\n</div>'




def foto_gitter(items, path=""):
    """Dokumentarisk gitter: smaa fotos med mono-label. Kun internt."""
    d = "/"  # alle stier absolutte, se HVORFOR-ABSOLUTTE-STIER
    sizes = "(max-width: 600px) 50vw, (max-width: 900px) 33vw, 260px"
    ud = []
    for slug, label in items:
        m = FOTO_MAN[slug]
        ud.append(f'<figure class="fg-i">\n' + _pic(slug, d, sizes) +
                  f'\n<figcaption class="meta-s">{label}</figcaption>\n</figure>')
    return '<div class="fg mt3">\n' + "\n".join(ud) + '\n</div>'

HORIZON = lambda cls, h, cap, tag="": f'''<div class="horizon {cls}" style="--h:{h}" aria-hidden="true">{f'<p class="tag-tr">{tag}</p>' if tag else ''}<p class="cap">{cap}</p></div>'''

pages = {}

# ───────────────────────────── FORSIDE (1a) ─────────────────────────────
pages["index.html"] = head("Vend Hjem · Agersø", "Vi laver en gammel campingplads på Agersø om til en genkolonisering af Jorden ud fra integrale modeller og humanistiske idealer.", "index.html", current=None) + '''
<section class="horizon h-hero" style="--h:38%">
<video id="hero" muted loop playsinline preload="none" poster="/images/hero-strand-poster.jpg" aria-hidden="true" data-src="/images/hero-strand.mp4"></video>
<script>
(function(){
  var v=document.getElementById('hero'); if(!v) return;
  var c=navigator.connection||{}; var slow=c.saveData||/2g/.test(c.effectiveType||'');
  var still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(slow||still) return;
  v.src=v.dataset.src; v.play().catch(function(){});
})();
</script>
<div class="over"><div class="inner">
<p class="meta">§ Agersø · Storebælt · færgen fra Stigsnæs</p>
<h1>Vi laver en gammel campingplads på Agersø om til en <em>genkolonisering</em> af Jorden ud fra integrale modeller og humanistiske idealer.</h1>
</div></div>
</section>

<section class="stage">
<div class="g g-32 nb">
<div>
<p class="lead" style="color:var(--blaek)">En unik oase på 6 hektar med syv bygninger, de ældste fra 1920. 25 senge, en sal til 50, industrikøkken og plads til at drømme stort.</p>
<p class="lead">Her bor man og driver stedet sammen. Nogle er her fast, andre kommer for at arbejde med i perioder, og nogle lejer sig ind til deres eget forløb.</p>
<p class="mt3"><a class="lnk" href="/bliv-en-del">Skriv → én vej ind</a></p>
</div>
<div class="fakta">
<div><p class="meta-s">Færge fra Stigsnæs</p><p class="v">Et kvarter · omkring 170 fastboende</p></div>
</div>
</div>
</section>

<section class="stage mt4">
''' + foto("oppefra", "Stedet fra luften · 6 hektar · Storebælt mod vest", sizes="(max-width: 1180px) 100vw, 1100px", cls="foto-bred") + '''
</section>

<section class="stage sektion">
<p class="sec">Det, der står på stedet</p>
<p class="lead maxw mt2">Syv bygninger, de ældste fra 1920. Det meste virker, noget skal rives ned, og resten bygger vi om sammen med dem, der kommer.</p>
</section>

<section class="stage mt4">
''' + foto_baand(["salen-2", "koekken", "sovesal"]) + '''
</section>

<section class="stage sektion">
<div class="g g-4 nb">
<div><p class="sec">Sporene</p><p class="small soft">Mandeweekender, retreats, byg-med-uger, festivaler, burns, raves og stille uger. <a class="lnk" href="/sporene">Se →</a></p></div>
<div><p class="sec">Permakultur</p><p class="small soft">Jorden som styrende princip: vandhul, læhegn, overdrev og et driftsår, vi gør sammen. <a class="lnk" href="/permakultur">Læs →</a></p></div>
<div><p class="sec">Fundamentet</p><p class="small soft">Sådan træffer vi beslutninger, fordeler ansvar og taler sammen, når vi er uenige. <a class="lnk" href="/fundamentet">Læs →</a></p></div>
<div><p class="sec">Bliv en del</p><p class="small soft">Forløbet fra den første samtale til en aftale, og hvad der gælder, hvis du vil stoppe. <a class="lnk" href="/bliv-en-del">Se forløbet →</a></p></div>
</div>
</section>
''' + foot()

# ───────────────────────────── FUNDAMENTET (1d) ─────────────────────────────
pages["fundamentet.html"] = head("Fundamentet · Vend Hjem", "Det, stedet hviler på: fire perspektiver, to måder at beslutte på, og fem energier.", "fundamentet.html", current="fundamentet") + '''
<section class="stage topmeta">
<p class="meta">Fundamentet · manifestet lægges op med version og dato</p>
</section>

<section class="stage blok">
<p class="sec">Fire perspektiver på alt, der er stort nok</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Hvert rum og hvert projekt beskrives fire gange.</h1>
<p class="lead maxw mt2">Når vi planlægger et rum eller begynder et projekt, bruger vi de fire perspektiver til at få de berørtes erfaringer med og undersøge, hvad opgaven kræver. Det indgår i beslutningen om, hvad vi gør, og hvem der tager ansvar.</p>
</section>

<section class="stage">
<div class="quad">
<div><p class="q-akse">INDRE · INDIVIDUELT</p><p class="q-navn">JEG</p><p class="q-tekst">Hvad gør det ved mig at være her? Hvad betyder det? Bliver jeg et bedre menneske af at stå i det?</p></div>
<div><p class="q-akse">YDRE · INDIVIDUELT</p><p class="q-navn">DET</p><p class="q-tekst">Hvad skal der konkret gøres? Hvad kræver det af hænder, timer, værktøj - og kan jeg det?</p></div>
<div><p class="q-akse">INDRE · FÆLLES</p><p class="q-navn">VI</p><p class="q-tekst">Hvordan taler vi sammen om det? Går vi til kilden - eller til hinanden om hinanden?</p></div>
<div><p class="q-akse">YDRE · FÆLLES</p><p class="q-navn">DET HELE</p><p class="q-tekst">Hvad koster det, hvad slider det på øen, og holder det om tre år uden at nogen brænder ud?</p></div>
</div>
</section>

<section class="stage sektion">
<div class="g g-2">
<div>
<p class="sec">Sådan beslutter vi</p>
<div class="stak">
<div class="ramme"><p class="meta-s" style="color:var(--accent);font-weight:500">FAGLIG</p><p class="small mt1">Den, der kan det, bestemmer hvordan - inden for formål, budget og aftalte grænser. Taget lægges ikke efter stemmetal. Alle andre kan være med som lærende.</p></div>
<div class="ramme"><p class="meta-s" style="color:var(--accent);font-weight:500">FÆLLES</p><p class="small mt1">De berørte er med. Hvad salen bruges til om lørdagen, afgør den, der kan snedkerere, ikke. Der noteres bidrag, aftale og en dato, hvor det tages op igen.</p></div>
<div class="ramme"><p class="meta-s" style="color:var(--accent);font-weight:500">DO-OCRACY</p><p class="small mt1">Den, der tager fat, har fortrinsret. Processen er til for at gøre det nemt at komme i gang, ikke for at holde nogen tilbage. Kan du opgaven, og ligger den inden for formål, budget og aftalte grænser, skal du ikke vente på et møde. Berører den andre, tager du dem med først.</p></div>
</div>
<p class="xs soft mt2">Når en opgave både rummer faglige valg og fælles hensyn, aftaler den fagligt ansvarlige løsningen med dem, den berører. Alle kan sige til ved fare, fejl eller brud på en aftale; den ansvarlige tager det op, før arbejdet fortsætter.</p>
</div>
<div>
<p class="sec">Fem energier - spørgsmål, ikke karakterer</p>
<ul class="liste">
<li><span>Fysisk</span><span class="r">bærer rummet kroppen?</span></li>
<li><span>Mental</span><span class="r">kan man tænke her?</span></li>
<li><span>Følelsesmæssig</span><span class="r">er der plads til at falde?</span></li>
<li><span>Seksuel</span><span class="r">er grænserne sagt højt?</span></li>
<li><span>Åndelig</span><span class="r">er der stille nogensinde?</span></li>
</ul>
<p class="xs soft mt2">Spørgsmålene bruges, når vi indretter et rum eller planlægger en aktivitet. Svarene kan føre til bedre plads at bevæge sig på, tid til en pause eller tydeligere aftaler om nærhed og grænser.</p>
</div>
</div>
</section>

<section class="stage">
<div class="g g-54 nb">
<div><div class="maxw">
<p class="sec">Største drøm og største frygt</p>
<p class="small">Før du skriver under på en aftale, taler vi om din største drøm for at være med og det, du frygter mest. Samtalen hjælper os med at få dine ønsker og forbehold med i det, vi aftaler.</p>
<p class="xs soft mt3">Den samtale tages to ad gangen, i et rum med en dør. Ikke på et møde.</p>
</div></div>
<div class="media">''' + foto_i_horisont("vaerelse", "", stil="min-height:300px") + '''</div>
</div>
</section>

<section class="stage sektion">
<div class="g g-2">
<div>
<p class="sec">Refleksionssprog, ikke adgangskrav</p>
<p class="small">Spiral Dynamics, Enneagrammet, arketyperne og udviklingslinjerne kan bruges til at undersøge egne mønstre og tale om forskelle. Ingen farve, type eller niveau afgør, om nogen kan være her, hvad de må bestemme, eller hvad de er værd.</p>
</div>
<div>
<p class="sec">Det integrale landkort</p>
<p class="small">Lais grundlag er Ken Wilbers integrale kort: fem måder at se det samme på, som ikke udelukker hinanden. Ingen tilgang har hele sandheden, og de fleste konflikter opstår, fordi man graver sig ned i ét perspektiv og afviser resten. Kortet er et sprog til at forstå sig selv, hinanden og stedet.</p>
</div>
</div>
</section>

<section class="stage">
<div class="g g-3 nb">
<div>
<p class="sec">Kvadranter</p>
<p class="small">Alt, der er stort nok, ses gennem fire vinduer: det indre i den enkelte — hvad det gør ved mig; det ydre i den enkelte — hvad der konkret bliver gjort; det indre i fællesskabet — hvordan vi taler sammen om det; og det ydre i fællesskabet — økonomi, drift, øen. Ægte forandring kræver arbejde i alle fire. Ændrer man kun strukturen, dør det stille hen.</p>
</div>
<div>
<p class="sec">Niveauer</p>
<p class="small">Vi vokser ikke kun udad, men opad, og hvert niveau rummer de foregående som russiske dukker. Intet niveau er bedre end et andet; hvert løser noget, det forrige ikke kunne. Det, vi øver os på her, er at kunne rumme alle perspektiver og stadig handle klart.</p>
</div>
<div>
<p class="sec">Linjer</p>
<p class="small">Man udvikler sig ikke jævnt. Skarp i hovedet og tonedøv i følelserne er ikke en fejl, det er linjer: kognitiv, emotionel, moralsk, interpersonel, somatisk, æstetisk, åndelig. Det handler ikke om at være længst fremme på én, men om at kende sine blinde pletter.</p>
</div>
<div>
<p class="sec">Tilstande</p>
<p class="small">Flow, nærvær, dyb ro er midlertidige og demokratiske: alle har adgang, uanset hvor langt de er nået. Scenekunst er i sin kerne en praksis i at skifte tilstand bevidst i stedet for at vente på, at den dukker op. Det er den praksis, stedet bygger på.</p>
</div>
<div>
<p class="sec">Typer</p>
<p class="small">De mønstre, man bærer med sig overalt: præferencer, tendenser, maskulin og feminin energi uafhængigt af køn. Ikke bokse. Type er det, du starter med; niveau er det, du vokser til. At kende begge dele er at kende sig selv uden at reducere sig selv.</p>
</div>
<div class="loeft"><p class="small soft">Fem linser på det samme. Ingen af dem er hele billedet, og det er pointen.</p><p class="meta mt2">Landkortet og manifestet · dateret version · kommer</p></div>
</div>
</section>
''' + foot()


# ───────────────────────────── PERMAKULTUR ─────────────────────────────
# Kilde: Lais og Eriks ideoplæg «Buddhi Camp / BUILD / Nature» (URBANCORE,
# maj 2021) — landskabsdelen. Bygningerne derfra er udeladt med vilje;
# Vendhjem bygger ikke boliger. Artslister og principper er taget derfra.
# Alt her er et sigte, ikke noget der er anlagt. Målt: intet endnu.
pages["permakultur.html"] = head("Permakultur · Vend Hjem", "Jorden på Agersø som styrende princip: fem landskabsprincipper, tre lag, seks beplantningstyper og et driftsår, hvor naturpleje er noget, vi gør sammen.", "permakultur.html", current="permakultur") + '''
<section class="stage topmeta">
<p class="meta">Permakultur · sigtet for de 6 hektar · udkast 18. september 2026</p>
</section>

<section class="stage blok">
<div class="g g-32 nb">
<div>
<p class="sec">Naturen som styrende princip</p>
<h1 class="stor maxw">Jorden er ikke en byggegrund. Den er det, vi bygger med.</h1>
<p class="lead maxw mt3">Seks hektar gammel campingplads. Vi lægger ikke stedet ud som en byggemodning, hvor naturen er det, der bliver tilbage mellem tingene. Landskabet bestemmer, hvor tingene kommer til at ligge. Biodiversitet og naturnær drift er med fra starten - ikke for at undgå at skade, men for at hæve naturkvaliteten på stedet og bidrage til øens økosystemer.</p>
<p class="small maxw mt3">Permakultur er for os tre ting, som hænger sammen: jorden skal have det bedre af, at vi er her. Menneskene også. Og det, der bliver til overs, deles. Det er samme tanke som <a href="/fundamentet">fundamentets</a> fjerde perspektiv - hvad koster det, hvad slider det på øen, og holder det om tre år - bare stillet til jorden.</p>
</div>
<div class="media" style="display:flex;align-items:center;justify-content:center;padding:24px">
<img src="/images/permakultur/tre-lag.webp" width="900" height="1250" alt="Tre lag oven på hinanden: nederst vandet og den beskyttede natur, så veje og stier, øverst jordlodderne." loading="lazy" style="width:100%;max-width:420px;height:auto;">
</div>
</div>
<p class="xs soft mt2">Tegninger på siden: fra Lais og Eriks landskabsoplæg for stedet, maj 2021.</p>
</section>

<section class="stage">
<div class="g g-3 nb">
<div><p class="sec">Landbrug</p><p class="small">Agersø er dyrket i tusind år. Læhegn, stendiger, frugtlunde og græsning er ikke pynt, det er øens egen måde at holde jord, læ og vand på. Vi genbruger den.</p></div>
<div><p class="sec">Kystpåvirket natur</p><p class="small">Salt, vind og sand. Overdrev på de tørre jorde, strandenge og vådområder på de lave. De arter, der trives her, har valgt stedet selv. Vi planter dem, ikke det, vi synes er pænt.</p></div>
<div><p class="sec">Kulturbotanik</p><p class="small">Fra middelalderen til 1700-tallet dyrkede øboerne lægeplanter og troldomsurter ved husene. Mange står stadig forvildet i hegn og grøfter. De er en del af øens egenart og kommer med.</p></div>
</div>
<p class="xs soft mt3 maxw">Øens egenart er den røde tråd. Det, vi planter, skal blande sig med Agersøs nuværende landskaber - og hæve dem. Ikke ligne noget andet sted.</p>
</section>

<section class="stage sektion">
<p class="sec">Fem landskabsprincipper</p>
<div class="g g-3 nb mt4">
<div class="loeft"><p class="lead">Devisen er, at menneskelige fællesskaber kan være lige så positive bidragydere til verdens økosystemer, som vi i dag er ødelæggende.</p><p class="small soft mt2">De fem principper er, hvordan vi vil vise det på seks hektar.</p></div>
<div><img src="/images/permakultur/princip-terraen.webp" width="640" height="443" alt="Gravemaskine former lavninger, der samler vand." loading="lazy" style="width:auto;max-width:100%;height:170px;object-fit:contain;object-position:left bottom;margin-bottom:12px"><p class="sec">Naturlig terrænformation</p><p class="small">Der genskabes naturlige terrænformer - lavninger, grøfter, små bakker - så arealet kobler sig på øens habitatforbindelser i stedet for at ligge som en flad plæne mellem dem.</p></div>
<div><img src="/images/permakultur/princip-mikroklima.webp" width="640" height="548" alt="Et træ tager vinden, og der er læ og vand bag det." loading="lazy" style="width:auto;max-width:100%;height:170px;object-fit:contain;object-position:left bottom;margin-bottom:12px"><p class="sec">Godt mikroklima</p><p class="small">Læ, skygge og vand, hvor mennesker, dyr og insekter har brug for det. Læhegn og lunde tager de stærke vestenvinde, binder jorden og holder på vandet ved skybrud.</p></div>
<div><img src="/images/permakultur/princip-anlaeg.webp" width="640" height="510" alt="Stendynge og grusvej, der er levested." loading="lazy" style="width:auto;max-width:100%;height:170px;object-fit:contain;object-position:left bottom;margin-bottom:12px"><p class="sec">Naturlige anlæg</p><p class="small">Veje, stier og de faste elementer skal indgå i landskabet og selv være habitat: makadam, der gror til i kanterne, stendiger til firben, insekthoteller, fugle- og flagermushuse.</p></div>
<div><img src="/images/permakultur/princip-naturtyper.webp" width="640" height="598" alt="Træ og urter med rødder i lokal jord." loading="lazy" style="width:auto;max-width:100%;height:170px;object-fit:contain;object-position:left bottom;margin-bottom:12px"><p class="sec">Lokale naturtyper</p><p class="small">Overdrev, eng, krat, hegn og vådområde som de findes på Agersø, med arter herfra. Formålet er at bevare og øge den lokale artsrigdom - og fortælle øens kulturhistorie gennem det, der gror.</p></div>
<div><img src="/images/permakultur/princip-drift.webp" width="640" height="429" alt="Et menneske slår eng med le." loading="lazy" style="width:auto;max-width:100%;height:170px;object-fit:contain;object-position:left bottom;margin-bottom:12px"><p class="sec">Naturnær drift</p><p class="small">En langsigtet driftsstrategi, hvor naturpleje er en del af fællesskabet og af oplevelsen af stedet. Le-slåning, afbrænding, bekæmpelse af invasive arter og overvågning - gjort af dem, der er her.</p></div>
</div>
</section>

<section class="stage sektion">
<p class="sec">Tre lag</p>
<p class="lead maxw mt2">Anlægget tænkes i tre lag oven på hinanden. Nederst vandet og den beskyttede natur, ovenpå veje og stier, øverst jordlodderne. Lagene er fleksible brikker, som kan flyttes, når forundersøgelserne viser, hvad jorden faktisk kan.</p>
<div class="g g-3 nb mt4">
<div class="loeft">
<p class="meta-s" style="color:var(--accent);font-weight:500">1 · VAND OG PADDER</p>
<p class="small mt1">Et anlagt vandhul på mindst 1.000 m² og en fold med græssende dyr af samme størrelse. Vandhullet er lagt ud som levested for øens nøglearter, klokkefrø og stor vandsalamander, og kobles til et netværk af mindre regnhuller, som håndterer regnvand lokalt og giver flere føde- og ynglesteder. Vi vil deltage i øens tælling og udsætning af padder.</p>
</div>
<div>
<p class="meta-s" style="color:var(--accent);font-weight:500">2 · VEJE OG STIER</p>
<p class="small mt1">Brandvej, hovedvej og forbindelser ud i naturen anlægges i makadam: knust granit eller strandsten med grus og sand i mellemrummene, som med tiden gror til i græs og urter. Vejen bærer tunge køretøjer og forsvinder alligevel i landskabet. Forløbene er smalle og snoede som gaderne i Agersø by.</p>
</div>
<div>
<img src="/images/permakultur/brik-3.webp" width="800" height="573" alt="En jordlod som puslespilsbrik: træer, krat, eng og en sti gennem den." loading="lazy" style="width:100%;max-width:300px;height:auto;margin-bottom:12px">
<p class="meta-s" style="color:var(--accent);font-weight:500">3 · JORDLODDER</p>
<p class="small mt1">Arealet deles i mindre lodder som puslespilsbrikker. Hver brik rummer to til fire beplantningstyper og de faste landskabselementer: stendiger, insekthoteller, fuglehuse, hus til flagermus. Størrelse og form afgøres af praktiske, landskabelige og økologiske hensyn - ikke af en lineal.</p>
</div>
</div>
<div class="g g-2 nb mt4">
<div>
<p class="sec">Padder og krybdyr, vandhullet er til</p>
<ul class="liste">
<li><span>Klokkefrø · nøgleart</span><span class="r">Bombina bombina</span></li>
<li><span>Stor vandsalamander · nøgleart</span><span class="r">Triturus cristatus</span></li>
<li><span>Grønbroget tudse</span><span class="r">Bufotes viridis</span></li>
<li><span>Spidssnudet frø</span><span class="r">Rana arvalis</span></li>
<li><span>Strandtudse</span><span class="r">Epidalea calamita</span></li>
<li><span>Markfirben</span><span class="r">Lacerta agilis</span></li>
</ul>
</div>
<div>
<p class="sec">Før vi graver</p>
<ul class="tjek">
<li><span>Klimaanalyse: nedbør, vind, sol og temperatur på netop den grund.</span></li>
<li><span>Landskabsanalyse: rum, sigtelinjer og terrænformationer.</span></li>
<li><span>Baselinerapport: hvilke arter er her nu. Uden den kan ingen måle, om det blev bedre.</span></li>
<li><span>Jordbundsanalyse: hvad kan dyrkes hvor.</span></li>
</ul>
<p class="xs soft mt2">Anlægget ændrer sig efter det, undersøgelserne finder. Det er meningen.</p>
</div>
</div>
</section>

<section class="stage sektion">
<p class="sec">Seks beplantningstyper</p>
<p class="lead maxw mt2">Alle med arter fra øen. Træernes samlede kronedække må højst fylde 10 % af arealet - Agersø er et åbent landskab, og det skal det blive ved med at være.</p>
<div class="g g-3 nb mt4">
<div>
<img src="/images/permakultur/bep-laehegn.webp" width="640" height="616" alt="Læhegn: to træer og en busk, vinden bøjer af over dem." loading="lazy" style="width:auto;max-width:100%;height:190px;object-fit:contain;object-position:left bottom;margin-bottom:12px">
<p class="sec">Læhegn</p>
<p class="small">Gammel landbrugstradition: binder jorden, giver læ, suger store vandmængder. Lagt i små sektioner på udvalgte lodder bliver de spiselige, artsrige heller for mennesker, dyr og insekter.</p>
<ul class="liste mt2">
<li><span>Skovfyr</span><span class="r">Pinus sylvestris</span></li>
<li><span>Hæg</span><span class="r">Prunus padus</span></li>
<li><span>Hassel</span><span class="r">Corylus avellana</span></li>
<li><span>Røn</span><span class="r">Sorbus aucuparia</span></li>
<li><span>Kræge</span><span class="r">Prunus domestica insititia</span></li>
</ul>
</div>
<div>
<img src="/images/permakultur/bep-baerkrat.webp" width="612" height="599" alt="Bærkrat med en kurv bær og en solsort." loading="lazy" style="width:auto;max-width:100%;height:190px;object-fit:contain;object-position:left bottom;margin-bottom:12px">
<p class="sec">Bærkrat</p>
<p class="small">Føde og levesteder. Hindbær, tjørn, hyld og brombær kan plukkes af dem, der er her. Den vilde kaprifolie dufter om aftenen og trækker natsværmere til.</p>
<ul class="liste mt2">
<li><span>Hyld</span><span class="r">Sambucus nigra</span></li>
<li><span>Tjørn</span><span class="r">Crataegus laevigata</span></li>
<li><span>Hindbær</span><span class="r">Rubus idaeus</span></li>
<li><span>Brombær</span><span class="r">Rubus fruticosus</span></li>
<li><span>Vild kaprifolie</span><span class="r">Lonicera periclymenum</span></li>
</ul>
</div>
<div>
<img src="/images/permakultur/bep-karaktertrae.webp" width="640" height="742" alt="Et enkelt frugttræ med et egern ved roden." loading="lazy" style="width:auto;max-width:100%;height:190px;object-fit:contain;object-position:left bottom;margin-bottom:12px">
<p class="sec">Karaktertræ</p>
<p class="small">Spiselige træer med nødder og frugt, plantet enkeltvis som reference til de gamle frugtlunde. Ét træ, der kan ses på afstand, ikke en plantage.</p>
<ul class="liste mt2">
<li><span>Vintereg</span><span class="r">Quercus petraea</span></li>
<li><span>Fuglekirsebær</span><span class="r">Prunus avium</span></li>
<li><span>Valnød</span><span class="r">Juglans regia</span></li>
<li><span>Skovæble</span><span class="r">Malus sylvestris</span></li>
<li><span>Blomme</span><span class="r">Prunus domestica</span></li>
</ul>
</div>
<div>
<img src="/images/permakultur/bep-overdrev.webp" width="640" height="675" alt="Overdrev med blomster og et stendige." loading="lazy" style="width:auto;max-width:100%;height:190px;object-fit:contain;object-position:left bottom;margin-bottom:12px">
<p class="sec">Overdrev og stendiger</p>
<p class="small">Tørre, stenede jorde, som aldrig egnede sig til plov, blev til græsning. Her bliver de blomsterrige enge for insekter og bestøvere. Stendigerne er varmesteder for firben og reference til øens gamle haver.</p>
<ul class="liste mt2">
<li><span>Djævelsbid</span><span class="r">Succisa pratensis</span></li>
<li><span>Merian</span><span class="r">Origanum vulgare</span></li>
<li><span>Hjertegræs</span><span class="r">Briza media</span></li>
<li><span>Timian</span><span class="r">Thymus serpyllum</span></li>
<li><span>Slangehoved</span><span class="r">Echium vulgare</span></li>
</ul>
</div>
<div>
<img src="/images/permakultur/bep-eng.webp" width="640" height="644" alt="Eng med et vandhul, en frø og guldsmede." loading="lazy" style="width:auto;max-width:100%;height:190px;object-fit:contain;object-position:left bottom;margin-bottom:12px">
<p class="sec">Eng og vådområder</p>
<p class="small">Lavninger og grøfter, der samler regnvand og danner et netværk af små vådområder. Vandstanden følger regnen. Midlertidige yngle- og fødesteder for padder og vandinsekter.</p>
<ul class="liste mt2">
<li><span>Dagpragtstjerne</span><span class="r">Silene dioica</span></li>
<li><span>Musevikke</span><span class="r">Vicia cracca</span></li>
<li><span>Hvid okseøje</span><span class="r">Leucanthemum vulgare</span></li>
<li><span>Engnellikerod</span><span class="r">Geum rivale</span></li>
<li><span>Trævlekrone</span><span class="r">Lychnis flos-cuculi</span></li>
</ul>
</div>
<div>
<img src="/images/permakultur/bep-relikt.webp" width="640" height="560" alt="Fingerbøl, kamille og en kurv urter." loading="lazy" style="width:auto;max-width:100%;height:190px;object-fit:contain;object-position:left bottom;margin-bottom:12px">
<p class="sec">Reliktplanter</p>
<p class="small">Øens forvildede lægeplanter og troldomsurter fra dengang, de hørte til husholdningen. Nektarrige, med form og farve. De får plads ved bygningerne, i hegn og i krat.</p>
<ul class="liste mt2">
<li><span>Bulmeurt</span><span class="r">Hyoscyamus niger</span></li>
<li><span>Lægebaldrian</span><span class="r">Valeriana officinalis</span></li>
<li><span>Fingerbøl</span><span class="r">Digitalis purpurea</span></li>
<li><span>Humle</span><span class="r">Humulus lupulus</span></li>
<li><span>Lægestokrose</span><span class="r">Althaea officinalis</span></li>
</ul>
</div>
</div>
</section>

<section class="stage sektion">
<div class="g g-2">
<div>
<p class="sec">Driftsåret</p>
<p class="small">Driften er en social indsats, ikke en gartner på kontrakt. Naturpleje og overvågning lægges ind i årets højtider og ophold, så det bliver noget, man lærer og gør sammen - med fingrene i mulden.</p>
<ul class="liste mt3">
<li><span>Vinter</span><span class="r">beskæring · kompost · stjernenætter</span></li>
<li><span>Forår</span><span class="r">såning · udplantning · haletudser</span></li>
<li><span>Sommer</span><span class="r">lugning · vanding · invasive arter · bær</span></li>
<li><span>Efterår</span><span class="r">frugt og nødder · le-slåning · afbrænding</span></li>
</ul>
</div>
<div>
<p class="sec">Det, vi kan måles på</p>
<ul class="tjek">
<li><span>Baseline for arter og jord, før det første spadestik.</span></li>
<li><span>Vandhul og fold på mindst 1.000 m² hver.</span></li>
<li><span>Seks beplantningstyper med arter fra øen. Kronedække under 10 %.</span></li>
<li><span>Årlig optælling af padder, insekter og planter - lagt frem.</span></li>
<li><span>Driften gjort af dem, der bor og er her, som en del af opholdene.</span></li>
</ul>
<p class="xs soft mt3">Det er også listen, vi tager med, når vi søger fonde og samarbejder om jorden. Ejerformen henter inspiration hos Grobund og Andelsgaarde: jorden skal ikke kunne sælges ud under fællesskabet.</p>
</div>
</div>
</section>

<section class="stage sektion">
<div class="g g-54 nb">
<div>
<p class="sec">Vil du grave med</p>
<p class="lead maxw mt2">Byg-med-ugerne er også jord. Hegn, vandhul, stendiger og såning af enge er noget, man kan komme og være med til.</p>
<p class="mt3"><a class="lnk" href="/sporene">Se datoerne →</a> &nbsp;&nbsp; <a class="lnk" href="/bliv-en-del">Skriv til Lai →</a></p>
</div>
<div class="media">''' + foto_i_horisont("udeplads", "", stil="min-height:300px") + '''</div>
</div>
</section>
''' + foot()


# ───────────────────────────── SPORENE (oversigt) ─────────────────────────────
pages["sporene.html"] = head("Sporene · Vend Hjem", "Det, der sker på stedet: mandegrupper og rites of passage, retreats, festival, byg-med-uger, stille uger, campingvogne.", "sporene.html", current="sporene") + '''
<section class="stage blok">
<p class="sec">Sporene</p>
<h1>Det, der sker på stedet.</h1>
<div class="g g-54 nb mt3" style="background:transparent;border:0;gap:32px">
<div style="padding:0">
<p class="lead">Seks spor på ét sted. Noget laver vi selv, noget lægger vi plads til, og det meste bliver til sammen med dem, der er her.</p>
</div>
<div style="padding:0">''' + foto("bordet-i-marken", "Bordet i marken · sommer", sizes="(max-width: 600px) 100vw, 380px") + '''</div>
</div>
</section>

<section class="stage">
<div class="g g-2">
<div class="loeft">
<p class="sec">Mandegrupper og rites of passage</p>
<p class="small">Weekender for femten mænd. Vi laver mad sammen, arbejder nogle timer på stedet og mødes om aftenen i en talerunde, hvor hver mand taler uden at blive afbrudt.</p>
<p class="meta mt2">Weekender · 2027 · datoer kommer</p>
<p class="mt2"><a class="lnk" href="/maend">Sådan ligger en weekend →</a></p>
</div>
<div>
<p class="sec">Retreats - vi er værter</p>
<p class="small">Du kan holde dit eget forløb her. Hele stedet fra onsdag til mandag, plads til femogtyve overnattende, med eller uden mad fra køkkenet. Du står selv for indholdet.</p>
<p class="meta mt2">Onsdag til mandag · op til 25 senge</p>
</div>
<div>
<p class="sec">Festival, burns og raves</p>
<p class="small">Vi laver vores egen, og vi lægger plads til dem, andre arrangerer. Sal, køkken og seks hektar gør stedet brugbart til både festival, burn og rave.</p>
<p class="meta mt2">Vores egen: fire dage i juli</p>
</div>
<div>
<p class="sec">Byg-med-uger</p>
<p class="small">En uge, hvor du bor her, spiser med og arbejder på stedets opgaver. Vi går på værkstedet og i bygningerne sammen.</p>
<p class="meta mt2">Forår og efterår</p>
</div>
<div>
<p class="sec">Stille uger og vinter</p>
<p class="small">Et værelse og fred til at skrive, tænke eller holde fri i dit eget tempo. Du står selv for maden og for dagens indhold. Om vinteren kan et værelse lejes månedsvis.</p>
<p class="meta mt2">November til april</p>
</div>
<div>
<p class="sec">Campingvogne</p>
<p class="small">Plads til at bo i din egen campingvogn i perioder. Prisen afhænger af, om opholdet også omfatter en aftale om at arbejde med.</p>
<p class="meta mt2">Månedsvis</p>
</div>
</div>
</section>

<section class="stage sektion">
<p class="sec">Fra stedet</p>
</section>

<section class="stage mt3">
''' + foto_baand(["faellesspisning", "cafe"], sizes="(max-width: 600px) 100vw, 589px", stil="min-height:320px") + '''
<p class="xs soft mt3 maxw">Billederne er fra stedet, som det er blevet brugt indtil nu. Det meste af det herover er ikke sket endnu.</p>
</section>
''' + foot()

# ───────────────────────────── MÆND (1e) ─────────────────────────────
pages["maend.html"] = head("Mandegrupper · Vend Hjem", "Femten mænd, en weekend på en ø, tre-fire timers arbejde og noget alvorligt om aftenen.", "maend.html", current="sporene") + '''
<section class="stage topmeta">
<p class="meta">Sporene / Mandegrupper</p>
</section>

<section class="stage">
<div class="g g-54">
<div>
<p class="sec">Det, der fylder weekenderne</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Femten mænd, en sal, og ingen der skal <em>ordnes</em>.</h1>
<p class="mt3">Værten har været i det danske mandegruppemiljø i ti år — begyndte hos Tomas Friis og var partner i og medskaber af Tribal Vibe.</p>
<p class="soft">Om dagen arbejder vi på stedet. Om aftenen dykker vi dybt og bygger bro mellem dem vi var og dem vi gerne vil være, omringet af andre mænd der lytter og spejler os.</p>
</div>
<div class="media">''' + foto_i_horisont("salen", "") + '''</div>
</div>
</section>

<section class="stage blok blok-rule">
<p class="sec">Sådan ligger en weekend</p>
<div class="tl">
<div><div class="pkt"></div><p class="t">Fredag eftermiddag</p><p class="b">Færgen fra Stigsnæs, et kvarter. Kaffe, rundtur - og telefonen i en kasse ved døren, hvis du vil. De fleste lægger den.</p></div>
<div><div class="pkt"></div><p class="t">Fredag aften</p><p class="b">Mad fra storkøkkenet. Bål. En runde: hvorfor er du kommet, og hvad er du bange for at sige. Ingen kommenterer.</p></div>
<div><div class="pkt a"></div><p class="t">Lørdag</p><p class="b">Arbejde om formiddagen - rigtigt arbejde, valgt fordi femten utrænede hænder faktisk kan flytte det. Sauna og havet om eftermiddagen. Workshop om aftenen.</p></div>
<div><div class="pkt"></div><p class="t">Søndag</p><p class="b">Morgenmad, oprydning, en sidste runde: hvad tager du med. Så færgen igen. Ingen gruppe på nettet bagefter.</p></div>
</div>
</section>

<section class="stage mt4">
''' + foto_baand(["spisestue", "solnedgang"], sizes="(max-width: 600px) 100vw, 589px", stil="min-height:320px") + '''
</section>

<section class="stage sektion">
<div class="g g-3 nb">
<div><p class="meta-s">Praktisk</p><p class="small mt1">15 pladser · 850 kr. · seng og al mad indgår · sauna · færgen og sovepose selv</p></div>
<div><p class="meta-s">Næste</p><p class="small mt1">Datoer for 2027 kommer, når stedet er registreret og kalenderen ligger fast.</p></div>
<div><p class="meta-s">Hvis du vil med</p><p class="mt1"><a class="lnk" href="/bliv-en-del">Skriv → vi ringer</a></p></div>
</div>
</section>

<section class="stage sektion">
<div class="g nbb" style="grid-template-columns:1fr">
<div>
<p class="sec">Hvad vi laver, når vi arbejder</p>
<ul class="liste">
<li><span>Nedrivning og oprydning</span><span class="r">det, der skal væk først</span></li>
<li><span>Grovmaling og klargøring</span><span class="r">rum til foråret</span></li>
<li><span>Isolering</span><span class="r">loft og vægge</span></li>
<li><span>Udearealer</span><span class="r">stier, hegn, bålplads, bænke</span></li>
</ul>
<p class="note mt2">Tag, el, VVS og alt bærende laves af folk med papir på det. Femten frivillige på et tag er en dårlig idé, uanset hvor gode intentionerne er.</p>
</div>
</div>
</section>
''' + foot()

# ───────────────────────────── BLIV EN DEL (1f) ─────────────────────────────
pages["bliv-en-del.html"] = head("Bliv en del · Vend Hjem", "Forløbet fra brev til medlem. Slutdato og udtræden kendes fra begyndelsen.", "bliv-en-del.html", current="bliv") + '''
<section class="stage blok">
<div class="maxw">
<p class="sec">Forløbet</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Der er en dør ind, og der er en dør ud - og den sidste skal du kende, før du går ind ad den første.</h1>
<p class="lead mt2">Du og vi aftaler fra begyndelsen, hvornår forløbet slutter, hvordan du kan stoppe undervejs, og hvordan en mægler kommer ind, hvis vi bliver uenige.</p>
''' + foto("udefra", "Vejen op til huset", sizes="(max-width: 760px) 100vw, 700px", cls="mt3") + '''
</div>
</section>

<section class="stage">
<div class="g g-4">
<div class="trin"><p class="nr">01</p><p class="t">Du skriver</p><p class="b">Et brev. Ikke en formular med felter til "interesseområde".</p><p class="m">Lai svarer inden 7 dage</p></div>
<div class="trin"><p class="nr">02</p><p class="t">To samtaler</p><p class="b">Én om hvad du vil. Én om hvad du har svært ved. Den anden er den vigtige.</p><p class="m">3–6 uger</p></div>
<div class="trin loeft"><p class="nr a">03</p><p class="t">Prøveaftale</p><p class="b">Du bor og arbejder her. Slutdatoen står i aftalen fra begyndelsen.</p><p class="m">6 måneder · skriftlig</p></div>
<div class="trin"><p class="nr">04</p><p class="t">Medlem</p><p class="b">Begge siger ja igen. Timer, indskud og mandat skrives ned, som de er aftalt.</p><p class="m">Tages op hvert år</p></div>
</div>
</section>

<section class="stage mt4">
''' + foto_baand(["vaerelse-dobbelt", "hyggekrog"], sizes="(max-width: 600px) 100vw, 589px", stil="min-height:320px") + '''
</section>

<section class="stage sektion">
<div class="g g-2 nb">
<div>
<p class="sec">Døren ud - sådan ser den ud</p>
<ul class="tjek">
<li><span>Du siger op med tre måneders varsel. Ingen skal forklare sig.</span></li>
<li><span>Dine indskud har en aftalt karakter - kapital, lån eller udlæg. Det står på papir fra dag ét.</span></li>
<li><span>Dine timer opgøres på det grundlag, de blev aftalt på. Ikke på hvad nogen husker.</span></li>
<li><span>Går det i hårdknude, kommer der en tredje part ind. Aftalt på forhånd.</span></li>
</ul>
<p class="xs soft mt3">Prøveaftalen beskriver dit ophold, dine opgaver og den periode, vi sammen har aftalt. Den giver dig ikke en ejerandel eller tilsagn om en bolig eller en varig plads i fællesskabet.</p>
</div>
<div>
<p class="sec">Skriv</p>
<form class="ramme ramme-loeft" id="brev" method="post" action="/bliv-en-del/skriv" style="padding:18px 20px">
<p class="small soft">Skriv, hvem du er, og hvorfor du skriver. Det behøver ikke være langt.</p>
<label class="felt-label" for="navn">Navn</label>
<input class="felt" id="navn" name="navn" type="text" autocomplete="name" maxlength="200" required>
<label class="felt-label" for="mail">Mail</label>
<input class="felt" id="mail" name="mail" type="email" autocomplete="email" maxlength="200" required>
<label class="felt-label" for="brevet">Brevet</label>
<textarea class="felt" id="brevet" name="brevet" minlength="20" maxlength="20000" required></textarea>
<div style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" aria-hidden="true"><label for="website">Website</label><input id="website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
<input type="hidden" name="t" value="">
<button class="lnk" type="submit">Send →</button>
<p class="note mt2">Brevet gemmes hos os og går til Lai. Du får en kvittering på mail. Lai svarer inden 7 dage.</p>
</form>
</div>
</div>
</section>
<script>
(function(){
  var f=document.getElementById('brev'); if(!f) return;
  var t=f.querySelector('input[name="t"]'); if(t) t.value=String(Date.now());
})();
</script>
''' + foot()

# ───────────────────────────── INTERNT / OVERSIGT ─────────────────────────────
# ─────────────────────── PRIVATLIV OG COOKIES ───────────────────────
# De gamle sider laa stadig live og beskrev et site, der ikke findes mere:
# YouTube-videoer paa forsiden, CDN-biblioteker og en formular med telefon
# og "interessefelt". Maalt 15-09-2026: sitet henter fra vendhjem.dk og
# static.cloudflareinsights.com, og saetter ingen cookies.
pages["privatlivspolitik.html"] = head("Privatlivspolitik · Vend Hjem", "Hvilke oplysninger vi behandler, hvorfor, og hvor længe.", "privatlivspolitik.html") + '''
<section class="stage stage-n sektion">
<p class="sec">Privatlivspolitik</p>
<h1 class="stor">Hvad vi gør med det, du skriver.</h1>
<p class="meta mt3">Senest opdateret 18. september 2026</p>

<p class="lead mt4">Vi behandler kun det, du selv sender os. Vi indsamler intet i det skjulte, profilerer ikke og videresælger ikke.</p>

<div class="stak mt4">
<div><p class="sec">Dataansvarlig</p><p class="small">Vend Hjem drives af Lai Yde, Egholmvej 23, Agersø. Spørgsmål til behandlingen af dine oplysninger: <a href="mailto:laiydeh@gmail.com">laiydeh@gmail.com</a>.</p></div>

<div><p class="sec">Hvad vi får</p><p class="small">Brevet på <a href="/bliv-en-del">Bliv en del</a> beder om navn, mailadresse og din tekst. Når du trykker send, gemmes de tre ting i vores eget system, brevet sendes pr. mail til den, der svarer, og du får en kvittering på den mail, du skrev. Forespørgsler på <a href="/sporene">Sporene</a> gemmes på samme måde: navn, mail og det, du skriver til os.</p></div>

<div><p class="sec">Hvorfor</p><p class="small">For at kunne svare dig og for at forberede eller indgå en aftale om ophold, medlemskab eller leje. Retsgrundlag: databeskyttelsesforordningens artikel 6, stk. 1, litra b, og litra a, hvor du har givet samtykke.</p></div>

<div><p class="sec">Hvor længe</p><p class="small">Henvendelser, der ikke fører til noget, slettes senest efter to år. Fører de til en aftale, gemmer vi det, aftalen kræver, så længe den løber, og derefter så længe bogførings- og forældelsesregler kræver det.</p></div>

<div><p class="sec">Hvem ser det</p><p class="small">Kun de mennesker i Vend Hjem, der skal svare dig. Brevet ligger i vores system hos Cloudflare og hos vores mailudbyder. Vi overfører ikke oplysninger til tredjelande på eget initiativ.</p></div>

<div><p class="sec">Dine rettigheder</p><p class="small">Du kan bede om indsigt, rettelse eller sletning, om begrænsning, og du kan gøre indsigelse. Skriv til <a href="mailto:laiydeh@gmail.com">laiydeh@gmail.com</a>. Er du utilfreds med vores svar, kan du klage til Datatilsynet, <a href="https://www.datatilsynet.dk/">datatilsynet.dk</a>.</p></div>
</div>

<p class="meta mt4"><a href="/cookies">Cookies og tredjepart →</a></p>
</section>
''' + foot()

pages["cookies.html"] = head("Cookies · Vend Hjem", "Sitet sætter ingen cookies. Her står, hvad der så hentes udefra.", "cookies.html") + '''
<section class="stage stage-n sektion">
<p class="sec">Cookies</p>
<h1 class="stor">Sitet sætter ingen cookies.</h1>
<p class="meta mt3">Senest opdateret 15. september 2026 · målt samme dag</p>

<p class="lead mt4">Ingen sporings-cookies, ingen analyse-cookies, ingen samtykkeboks - fordi der ikke er noget at give samtykke til. Ingen Google Analytics, ingen Facebook-pixel, ingen profilering.</p>

<div class="stak mt4">
<div><p class="sec">Hvad der hentes udefra</p><p class="small">Skrifttyper og video ligger på vores eget domæne. Det eneste, der hentes et andet sted fra, er Cloudflares besøgstælling fra <span class="mono">static.cloudflareinsights.com</span>. Den tæller sidevisninger uden cookies og uden at følge dig mellem sites.</p></div>

<div><p class="sec">Log hos vores udbyder</p><p class="small">Cloudflare leverer sitet og logger som enhver webserver IP-adresse, tidspunkt og hvilken side der blev hentet, af drifts- og sikkerhedshensyn. Det er ikke noget, vi bruger til at genkende dig.</p></div>

<div><p class="sec">Bag login</p><p class="small">Logger du ind på de interne sider, sætter Cloudflare Access en cookie, som holder dig logget ind. Den er nødvendig for at siderne virker, og den findes kun for medlemmer.</p></div>

<div><p class="sec">Sådan styrer du det</p><p class="small">Du kan altid slette eller blokere cookies i din browsers indstillinger. Datatilsynet har en vejledning på <a href="https://www.datatilsynet.dk/">datatilsynet.dk</a>.</p></div>
</div>

<p class="meta mt4"><a href="/privatlivspolitik">Privatlivspolitik →</a></p>
</section>
''' + foot()

# ───────────────────────────── 404 ─────────────────────────────
# Et tomt 404-svar er en blind vej. Siden giver vej tilbage.
pages["404.html"] = head("Siden findes ikke · Vend Hjem", "Siden findes ikke.", "404.html") + '''
<section class="stage sektion">
<p class="sec">404</p>
<h1 class="stor maxw">Den side findes ikke.</h1>
<p class="lead maxw mt3">Måske er den flyttet, da sitet blev bygget om. Herfra kommer du videre:</p>
<ul class="liste maxw mt3">
<li><a href="/">Forsiden</a><span class="r">Vend Hjem</span></li>
<li><a href="/fundamentet">Fundamentet</a><span class="r">Sådan beslutter vi</span></li>
<li><a href="/sporene">Sporene</a><span class="r">Det, der sker på stedet</span></li>
<li><a href="/bliv-en-del">Bliv en del</a><span class="r">Forløbet</span></li>
</ul>
</section>
''' + foot()

pages["internt/index.html"] = head("Internt · Vend Hjem", "Agersø-projektet bag login.", "internt/index.html", intern=True, current="internt") + '''
<section class="stage blok">
<p class="sec">Internt · bag login</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Agersø-projektet</h1>
<p class="lead maxw mt2">Det, der ikke er offentligt: økonomien, anlægsprojekterne, timerne og indskuddene. Åbent for alle, der er med - ikke for internettet.</p>
</section>
<section class="stage">
<div class="g g-3">
<div><p class="sec">Stedet</p><p class="small soft">Bygningerne som BBR kender dem, plan- og naturforhold, og registreringen 19.–21. september.</p><p class="mt2"><a class="lnk" href="/internt/stedet">Åbn →</a></p></div>
<div><p class="sec">Økonomi</p><p class="small soft">Faste udgifter, hvad en gæst koster, og tre scenarier for 2027.</p><p class="mt2"><a class="lnk" href="/internt/oekonomi">Åbn →</a></p></div>
<div><p class="sec">Anlæg</p><p class="small soft">Bygning for bygning, rum for rum. Registrering, fund og hvad det koster at rette.</p><p class="mt2"><a class="lnk" href="/internt/anlaeg">Åbn →</a></p></div>
<div class="loeft"><p class="sec">Timer og indskud</p><p class="small soft">Hvem har lagt hvad, hvornår, og hvad blev der aftalt. Den vigtigste tabel på hele stedet.</p><p class="mt2"><a class="lnk" href="/internt/timer">Åbn →</a></p></div>
<div><p class="sec">Beslutninger</p><p class="small soft">Hvem har mandat til hvad, med hvilken ramme, og hvornår det tages op igen.</p><p class="meta mt2">Kommer</p></div>
<div><p class="sec">Kalender</p><p class="small soft">Hvad der sker i dag, hvad du har meldt dig til, og hvilke uger der er lukkede.</p><p class="meta mt2">Kommer</p></div>
</div>
</section>
<section class="stage blok">
<div class="maxw">
<p class="sec">Hvorfor der er en mur her</p>
<p class="small">Som medlem har du adgang til fællesskabets økonomi, indskud og aftaler her. Oplysningerne deles i medlemsområdet bag login.</p>
<p class="small soft">Udadtil viser vi fremdrift. Indadtil viser vi tallene. Ingen rangliste over, hvem der har knoklet mest, nogen af stederne.</p>
</div>
</section>
''' + foot(intern=True, path="internt/index.html")

# ───────────────────────────── INTERNT / TIMER (1g) ─────────────────────────────
pages["internt/timer.html"] = head("Timer og indskud · Internt", "Hvem har lagt hvad, hvornår, aftalt som hvad.", "internt/timer.html", intern=True, current="timer") + '''
<section class="stage blok">
<p class="sec">Internt · timer og indskud</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Hvem har lagt hvad.</h1>
<p class="lead maxw mt2">Den vigtigste tabel på hele stedet. Ikke fordi timerne skal gøres op mod hinanden, men fordi det modsatte er det, der har ødelagt stedet før.</p>
<p class="meta mt2" style="color:var(--accent)">Eksempeldata · tabellen fyldes fra den dag, stedet er i drift</p>
</section>

<section class="stage">
<div class="g g-side">
<div style="padding:0;background:var(--papir)">
<div style="max-width:420px">
  <div style="padding:22px 18px 18px;border-bottom:1px solid var(--streg)">
    <p class="meta-s">Dine timer i alt</p>
    <p class="stor mt1">148,5</p>
    <p class="small soft mt1">siden 4. marts. Senest i dag - taget på hovedhuset.</p>
  </div>
  <form style="padding:18px;border-bottom:1px solid var(--streg);background:var(--papir-loeft)" onsubmit="return false">
    <p class="meta-s" style="margin-bottom:12px">Skriv dagens ind</p>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <input class="felt-boks" style="flex:1;min-width:0" type="text" inputmode="decimal" value="4,0 timer" aria-label="Timer">
      <input class="felt-boks" style="flex:1;min-width:0;color:var(--blaek-mat)" type="text" value="15.09.2026" aria-label="Dato">
    </div>
    <textarea class="felt-boks" style="width:100%;margin-bottom:10px;font-family:var(--serif);color:var(--blaek-mat);min-height:56px" aria-label="Hvad lavede du">Hvad lavede du? Tag gerne et billede.</textarea>
    <div class="tags" style="margin-bottom:12px"><span class="tag tag-accent">Frivillig</span><span class="tag">Indskud</span><span class="tag">Betalt</span></div>
    <button class="knap" type="submit">Gem</button>
    <p class="note mt2">Dårlig forbindelse? Den gemmes lokalt og siger "venter på synkronisering".</p>
  </form>
  <div style="padding:18px;border-bottom:1px solid var(--streg)">
    <p class="meta-s" style="margin-bottom:14px">Dine seneste - nyeste først</p>
    <div class="post"><div class="h"><span>Tag, hovedhuset</span><span class="n">4,0</span></div><p class="m">15.09 · Frivillig · venter på synk</p></div>
    <div class="post"><div class="h"><span>Kloak, sydskur</span><span class="n">7,5</span></div><p class="m">12.09 · Indskud · aftalt 11.09 med Lai</p></div>
    <div class="post"><div class="h"><span>Materialer, udlæg</span><span class="n">2.140 kr.</span></div><p class="m">09.09 · Udlæg · bilag vedhæftet</p></div>
    <div class="post"><div class="h"><span>Rydning, engen</span><span class="n">6,0</span></div><p class="m">30.08 · Frivillig · rettet 31.08 af dig</p></div>
  </div>
  <div style="padding:18px;border-bottom:1px solid var(--streg)">
    <p class="meta-s" style="margin-bottom:10px">Din aftale</p>
    <p class="small">Prøveaftale · slutter 1. april 2027. Aftalte timer: 12 om måneden. Indskud: 40.000 kr. som lån.</p>
    <p class="meta mt1">Aftalen ligger ikke digitalt endnu</p>
  </div>
  <div style="padding:18px">
    <p class="meta-s" style="margin-bottom:10px">Fælles fremdrift</p>
    <div class="frem" style="--p:62%"></div>
    <p class="small soft">1.480 timer lagt i stedet i alt. Tagene er 62 % tætte.</p>
    <p class="note mt1">Ingen liste over hvem der har lagt mest. Aldrig. Timerne "vokser" for den, der lagde dem, og "daler" for alle andre - derfor står aftalegrundlaget på hver linje.</p>
  </div>
</div>
</div>
<div>
<p class="sec">Reglen</p>
<ul class="liste">
<li><span>Hvert indskud har en karakter</span><span class="r">kapital · lån · gave · udlæg · uafklaret</span></li>
<li><span>Uafklaret bliver stående</span><span class="r">laves aldrig stille om</span></li>
<li><span>Timer har et aftalegrundlag</span><span class="r">frivillig · betalt · aftalt modydelse</span></li>
<li><span>Alt har en dato og et ophav</span><span class="r">rettelser slettes ikke</span></li>
<li><span>Ingen samlet score</span><span class="r">timer, kroner og kWh hver for sig</span></li>
</ul>
<p class="small mt3">Karakteren vælges, når pengene går ind, ikke bagefter. En beregnet værdi af frivilligt arbejde er ikke en kontant udgift og heller ikke et krav på løn.</p>
<p class="sec mt4">Paradokset, tabellen løser</p>
<p class="small soft">Din egen indsats kan fylde mere i hukommelsen med tiden, mens den træder i baggrunden hos andre. Registrér timerne, mens du kan huske arbejdet, og knyt dem til den aftale, de er udført under.</p>
<p class="sec mt4">Hvad der ligger under</p>
<p class="small soft">Registreringen på telefonen skriver til én fælles tabel. Mandater, beløbsrammer og aftaler ligger i samme system, så en linje altid kan slås op mod det, den blev aftalt under. Systemvalget er beskrevet i den digitale plan.</p>
</div>
</div>
</section>
''' + foot(intern=True, path="internt/timer.html")

# ───────────────────────────── INTERNT / STEDET ─────────────────────────────
pages["internt/stedet.html"] = head("Stedet · Internt", "Bygningerne som BBR kender dem, plan- og naturforhold.", "internt/stedet.html", intern=True, current="stedet") + '''
<section class="stage blok">
<p class="sec">Internt · stedet</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Egholmvej 23, Agersø</h1>
<p class="lead maxw mt2">Matrikel 1c, 60.922 m², seks bygninger i BBR og mindst én der ikke står der. Alt herunder er hentet fra offentlige registre den 15. september 2026.</p>
</section>

<section class="stage">
<p class="sec">Bygningerne</p>
<p class="small soft maxw">Tallene er BBR's. Kolonnen "tilstand" er tom, fordi ingen har set efter endnu. Den fyldes ud i weekenden.</p>
<div class="tabel-wrap mt3">
<table class="tabel">
<thead><tr><th scope="col">ID</th><th scope="col" class="n">Opført</th><th scope="col" class="n">Ombygget</th><th scope="col" class="n">Areal</th><th scope="col">Ydervæg</th><th scope="col">Tag</th><th scope="col" class="n">SAVE</th><th scope="col">Tilstand</th></tr></thead>
<tbody>
<tr><td>B01</td><td class="n">1920</td><td class="n">—</td><td class="n">83 m²</td><td>Mursten</td><td>Tegl</td><td class="n">4</td><td class="soft">ikke registreret</td></tr>
<tr><td>B02</td><td class="n">1920</td><td class="n">1994</td><td class="n">100 m²</td><td>Mursten</td><td><span class="tag tag-accent">fibercement m. asbest</span></td><td class="n">4</td><td class="soft">ikke registreret</td></tr>
<tr><td>B03</td><td class="n">1920</td><td class="n">1999</td><td class="n">171 m²</td><td>Mursten</td><td><span class="tag tag-accent">fibercement m. asbest</span></td><td class="n">4</td><td class="soft">ikke registreret</td></tr>
<tr><td>B04</td><td colspan="6"><span class="tag tag-accent">findes ikke i BBR</span> <span class="xs soft">nummerrækken springer fra 3 til 5</span></td><td class="soft">ikke registreret</td></tr>
<tr><td>B05</td><td class="n">1920</td><td class="n">—</td><td class="n">25 m²</td><td>Mursten</td><td><span class="tag tag-accent">fibercement m. asbest</span></td><td class="n">—</td><td class="soft">ikke registreret</td></tr>
<tr><td>B06</td><td class="n">1955</td><td class="n">—</td><td class="n">150 m²</td><td>Metalplader</td><td>Metal</td><td class="n">—</td><td class="soft">ikke registreret</td></tr>
<tr><td>B07</td><td class="n soft">1100</td><td class="n">—</td><td class="n">7 m²</td><td>Glas</td><td>Glas</td><td class="n">—</td><td class="soft">ikke registreret</td></tr>
</tbody>
</table>
</div>
<p class="note mt2">Kilde: BBR via Fredede og Bevaringsværdige Bygninger, hentet 15-09-2026. Bevaringsværdi efter SAVE, registreret 12-08-1993.</p>
<p class="small mt2 maxw"><strong>Tre tage står registreret med asbest, og ét årstal er en tastefejl.</strong> B07 er et drivhus på syv kvadratmeter, ikke en bygning fra 1100-tallet. Begge dele bliver kontrolleret og rettet i BBR - uoverensstemmelser bliver til opgaver, ikke til tavse rettelser.</p>
</section>

<section class="stage sektion">
<p class="sec">Hvad der gælder for grunden</p>
<div class="g g-2">
<div><p class="meta-500 meta-s">Kommuneplanramme 11.R2</p><p class="small mt1">"Agersø campinggård". Rekreativt område, campingplads og vandrehjem. Vedtaget 25. september 2023. Hverken bebyggelsesprocent, etageantal eller bygningshøjde er fastsat.</p><p class="note mt1">Plandata.dk</p></div>
<div><p class="meta-500 meta-s">Ingen lokalplan</p><p class="small mt1">Landzone uden lokalplan. Ændret anvendelse og nybyggeri kræver landzonetilladelse sag for sag. Rammen giver rygdækning i en ansøgning, ikke byggeret.</p><p class="note mt1">Plandata.dk, alle lag søgt</p></div>
<div><p class="meta-500 meta-s">Beskyttet dige</p><p class="small mt1">Et udskiftningsdige på cirka 591 meter ligger på matriklen. Det må ikke gennembrydes eller fjernes uden dispensation. Markeres på kortet, før der graves nogen steder.</p><p class="note mt1">BD.056.813 · Slots- og Kulturstyrelsen</p></div>
<div><p class="meta-500 meta-s">Natura 2000</p><p class="small mt1">Habitatområdet "Skælskør Fjord og havet og kysten mellem Agersø og Glænø" gav træf på begge testede punkter på matriklen. Skal bekræftes visuelt, før der lægges tidsplan for noget som helst.</p><p class="note mt1">DK005Y229 · Danmarks Miljøportal · <em>skal verificeres</em></p></div>
<div><p class="meta-500 meta-s">Campingtilladelse</p><p class="small mt1">Slagelse Kommune, 4. maj 2021, sagsnr. 2020-140542. Gyldig til 4. maj 2029, 250 enheder. Udstedt til ejendomsselskabet - den følger selskabet, ikke ejendommen.</p><p class="note mt1">Kommunens afgørelse</p></div>
</div>
</section>

<section class="stage sektion">
<p class="sec">Rum og bygninger · foto</p>
<p class="small soft maxw">Billeder fra stedet, som det ser ud nu. De er ikke registreringsfotos - de har hverken ID, målestok eller dato. Weekendens registrering leverer dem, og så udskiftes disse.</p>
''' + foto_gitter([
 ("salen", "Salen"),
 ("salen-2", "Salen · den anden ende"),
 ("koekken", "Industrikøkkenet"),
 ("koekken-2", "Det lille køkken"),
 ("spisestue", "Spisestuen"),
 ("sovesal", "Sovesal"),
 ("vaerelse", "Værelse"),
 ("vaerelse-dobbelt", "Værelse · dobbeltseng"),
 ("hyggekrog", "Overdækket terrasse"),
 ("udeplads", "Udeplads med bålsted"),
 ("cafe", "Udendørs bar"),
 ("faellesspisning", "Fællesspisning ude"),
 ("udefra", "Stien op til huset"),
 ("oppefra", "Matriklen fra luften"),
 ("solnedgang", "Engen mod vest"),
 ("bordet-i-marken", "Bordet i marken"),
], path="internt/stedet.html") + '''
</section>

<section class="stage blok blok-top">
<div class="g g-2 nb nbb">
<div class="loeft"><p class="meta-500 meta-s">Registreringen 19.–21. september</p><p class="small mt1">To mennesker, to telefoner og en lasermåler. Hver bygning, hvert rum, hvert udeområde og hvert teknisk anlæg får et ID, et foto og en tilstand. Hvis tiden bliver knap: asbest, fugt og afløb først. Det er dem, der koster mest at opdage sent.</p></div>
</div>
</section>
''' + foot(intern=True, path="internt/stedet.html")

# ───────────────────────────── INTERNT / ØKONOMI ─────────────────────────────
pages["internt/oekonomi.html"] = head("Økonomi · Internt", "Faste udgifter, hvad en gæst koster, tre scenarier for 2027.", "internt/oekonomi.html", intern=True, current="oekonomi") + '''
<section class="stage blok">
<p class="sec">Internt · økonomi</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Økonomi 2027</h1>
<p class="lead maxw mt2">Tallene herunder er en model, ikke et regnskab. Der er ikke tjent en krone på den her plan endnu. Når der er, står de rigtige tal her i stedet.</p>
</section>

<section class="stage">
<div class="g g-2">
<div>
<p class="sec">Stedets faste udgifter</p>
<p class="small soft">Kun ejendommen. Ingen privatøkonomi, ingen løn, ingen konsulentindtægter. Det er, hvad huset koster at eje, uanset om der kommer nogen.</p>
<table class="tabel mt3">
<thead><tr><th scope="col">Post</th><th scope="col" class="n">Pr. måned</th></tr></thead>
<tbody>
<tr><td>Renter, Merkur Andelskasse<span class="m">400.000 kr. til 13,5 %</span></td><td class="n">4.500</td></tr>
<tr><td>Afdrag<span class="m">over 10 år</span></td><td class="n">3.333</td></tr>
<tr><td>Forsikring, ejendomsskat, renovation, internet<span class="m" style="color:var(--accent)">skøn - ikke målt</span></td><td class="n">5.000</td></tr>
<tr><td>Grundenergi uden gæster<span class="m" style="color:var(--accent)">skøn - ikke målt</span></td><td class="n">3.500</td></tr>
<tr><td>Revisor og selskabsadministration</td><td class="n">2.000</td></tr>
<tr><td>Løbende vedligehold<span class="m">1920-bygninger, 536 m²</span></td><td class="n">2.000</td></tr>
<tr><td>Transport af materialer<span class="m">færge</span></td><td class="n">1.000</td></tr>
<tr class="sum"><td>I alt</td><td class="n">21.333</td></tr>
</tbody>
</table>
<p class="note mt2">To af posterne er gæt, og det står der. Rettes her, når policen og regningerne er hentet - også hvis de bliver højere.</p>
</div>
<div>
<p class="sec">Hvad en gæst koster os om dagen</p>
<ul class="liste">
<li><span>El</span><span class="r">13 kr.</span></li>
<li><span>Vand og spildevand</span><span class="r">11 kr.</span></li>
<li><span>Varme, sommer til vinter</span><span class="r">3–22 kr.</span></li>
<li><span>Rengøring og forbrug</span><span class="r">20 kr.</span></li>
<li><span>Mad, når vi laver den</span><span class="r">100 kr.</span></li>
</ul>
<p class="note mt2">El efter Bolius' forbrugstal og gennemsnitsprisen for 2025. Vand efter DANVA's Vand i Tal 2025: 97 liter pr. person i døgnet, 82,23 kr. pr. m³ inkl. afgifter. Varmen er beregnet, ikke målt, og erstattes efter første fyringssæson.</p>
<p class="sec mt4">Timer og indskud</p>
<p class="small soft">Når stedet er i drift, står det her: hvem der har lagt hvilke timer, og hvem der har skudt hvilke penge ind - med dato, og med hvad der blev aftalt dengang. <a class="lnk" href="/internt/timer">Tabellen →</a></p>
</div>
</div>
</section>

<section class="stage sektion">
<p class="sec">Tre måder 2027 kan gå</p>
<div class="tabel-wrap">
<table class="tabel">
<thead><tr><th scope="col"></th><th scope="col" class="n">Alt lykkes</th><th scope="col" class="n">Realistisk</th><th scope="col" class="n">Det meste slår fejl</th></tr></thead>
<tbody>
<tr><td>Omsætning</td><td class="n">777.910</td><td class="n">546.179</td><td class="n">154.037</td></tr>
<tr><td>Resultat efter faste udgifter</td><td class="n">521.914</td><td class="n">278.183</td><td class="n" style="color:var(--accent)">−143.959</td></tr>
<tr><td>Kassen 31. december</td><td class="n">776.914</td><td class="n">533.183</td><td class="n">111.041</td></tr>
<tr><td>Måneder med underskud</td><td class="n">3</td><td class="n">7</td><td class="n">9</td></tr>
</tbody>
</table>
</div>
<div class="g g-2 nb mt3">
<div><p class="small">Forskellen mellem den midterste og den sidste søjle er stort set én uge: festivalen i juli. Aflyses den, forsvinder en femtedel af året.</p></div>
<div><p class="small soft">I det værste scenarie brænder stedet 144.000 af en startkapital på 255.000 og overlever. Det er ikke en katastrofe - det er et år uden fremdrift, og det er værd at kunne se forskellen.</p></div>
</div>
<p class="note mt2">Kilde: AGERSOE-DRIFT-2027-v4.xlsx, simulering A/B/C, 15-09-2026.</p>
</section>
''' + foot(intern=True, path="internt/oekonomi.html")

# ───────────────────────────── INTERNT / ANLÆG ─────────────────────────────
pages["internt/anlaeg.html"] = head("Anlæg · Internt", "Registrering, fund og hvad det koster at rette.", "internt/anlaeg.html", intern=True, current="anlaeg") + '''
<section class="stage blok">
<p class="sec">Internt · anlæg</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Registrering og projekter</h1>
<p class="lead maxw mt2">Bygning for bygning, rum for rum. Feltarket fyldes ud 19.–21. september og lægges ind her bagefter.</p>
</section>

<section class="stage">
<div class="g g-4">
<div><p class="stor">7</p><p class="meta-s mt1">bygninger · 1 ikke i BBR</p></div>
<div><p class="stor">46</p><p class="meta-s mt1">rum oprettet i feltarket</p></div>
<div><p class="stor">0</p><p class="meta-s mt1">rum registreret</p></div>
<div class="loeft"><p class="stor" style="color:var(--accent)">6</p><p class="meta-s mt1">fund åbne før weekenden</p></div>
</div>
</section>

<section class="stage sektion">
<p class="sec">De seks fund, der ligger før weekenden</p>
<div class="tabel-wrap">
<table class="tabel">
<thead><tr><th scope="col">ID</th><th scope="col">Sted</th><th scope="col">Hvad</th><th scope="col">Haster</th><th scope="col" class="n">Beløb</th></tr></thead>
<tbody>
<tr><td class="num">F001</td><td>B02/B03/B05</td><td>Afklar om fibercementtagene indeholder asbest - fotografér prægningen</td><td><span class="tag tag-accent">nu</span></td><td class="n soft">datamangel</td></tr>
<tr><td class="num">F002</td><td>B04</td><td>Find ud af hvad bygning 4 er, og om den er registreret</td><td><span class="tag tag-accent">nu</span></td><td class="n soft">datamangel</td></tr>
<tr><td class="num">F003</td><td>Alle</td><td>Kontrollér BBR-arealer mod opmåling</td><td><span class="tag">1–2 år</span></td><td class="n soft">datamangel</td></tr>
<tr><td class="num">F004</td><td>Ejendom</td><td>Bring anvendelseskoden i overensstemmelse med faktisk drift</td><td><span class="tag tag-accent">nu</span></td><td class="n soft">datamangel</td></tr>
<tr><td class="num">F005</td><td>U08</td><td>Markér det beskyttede dige fysisk, før der graves</td><td><span class="tag tag-accent">nu</span></td><td class="n soft">datamangel</td></tr>
<tr><td class="num">F006</td><td>Ejendom</td><td>Bekræft Natura 2000 og strandbeskyttelseslinje visuelt</td><td><span class="tag tag-accent">nu</span></td><td class="n soft">datamangel</td></tr>
</tbody>
</table>
</div>
<p class="small mt2 maxw"><strong>"Datamangel" er ikke nul kroner.</strong> Så længe der står fund uden beløb, er anlægsbudgettet ufuldstændigt - og et ufuldstændigt budget er ikke et billigt budget. Summen i feltarket tæller kun de poster, der faktisk er prissat, og viser hvor mange der mangler.</p>
</section>

<section class="stage sektion">
<p class="sec">Sådan prioriteres et projekt</p>
<div class="g g-3">
<div class="trin"><p class="nr">01</p><p class="t">Type</p><p class="b">Standser vi en skade, opretholder vi drift, muliggør vi en aktivitet, eller forbedrer vi en oplevelse? Ingen samlet score - den ville skjule de kritiske afhængigheder.</p></div>
<div class="trin"><p class="nr">02</p><p class="t">Fire perspektiver</p><p class="b">JEG, DET, VI og DET HELE. Ved en lille reparation arves formålet fra det projekt, den hører til.</p><div class="quad lille mt2"><div>JEG</div><div>DET</div><div>VI</div><div>DET HELE</div></div></div>
<div class="trin"><p class="nr">03</p><p class="t">Beslutningsform</p><p class="b">Faglig, fælles eller blandet - og hvem der har mandatet, på hvilket grundlag, med hvilken beløbsramme.</p><div class="tags mt2"><span class="tag tag-accent">Faglig</span><span class="tag">Fælles</span></div></div>
<div class="trin"><p class="nr">04</p><p class="t">Pris</p><p class="b">Materialer, udførelse, fragt og færge, affald, driftsstop og fremtidig vedligehold. Plus 10 % rådgivning og 20 % uforudsete. På en ø er 20 % ikke forsigtigt, det er realistisk.</p></div>
<div class="trin"><p class="nr">05</p><p class="t">Timer</p><p class="b">Hvor mange frivillige og betalte timer, og hvem har faktisk tid. Kan det laves på en mandeweekend?</p></div>
<div class="trin"><p class="nr">06</p><p class="t">Efter</p><p class="b">Gav det den ønskede oplevelse, fungerede samarbejdet, hvad lærte vi, og hvad overdrages til vedligehold?</p></div>
</div>
</section>
''' + foot(intern=True, path="internt/anlaeg.html")


# ───────────────────────────── INTERNT / REGISTRERING ─────────────────────────────
# Feltvaerktoejet gik tabt i september 2026, fordi det kun laa i internt/ (gitignored)
# og aldrig i repoet. Kilden bor nu i internt-kilder/ og skrives ind her, saa et
# deploy fra et rent checkout altid har den med.
def _kilde(navn):
    with open(os.path.join(ROOT, "internt-kilder", navn), encoding="utf-8") as f:
        return f.read()

pages["internt/registrering.html"] = head("Registrering · Internt", "Feltregistrering af rum, udearealer og tekniske anlaeg. Virker uden net.", "internt/registrering.html", intern=True, current="registrering") + _kilde("registrering-body.html.in") + foot(intern=True, path="internt/registrering.html")
pages["internt/registrering-sw.js"] = _kilde("registrering-sw.js")

# ───────────── HVORFOR-ABSOLUTTE-STIER ─────────────
#
# Hver href og src paa en offentlig side skal starte med /, http, mailto,
# data eller #. Aldrig "sporene" eller "assets/vh.css".
#
# Baggrund: relative stier er rigtige, saa laenge man staar praecis dér,
# hvor de blev skrevet. Faar man siden serveret paa en adresse med en
# skraastreg til forskel, opløses "assets/vh.css" et andet sted, og siden
# kommer uden styling. Cloudflare sender i dag /fundamentet/ tilbage til
# /fundamentet, saa det sker ikke i produktion — men det er en indstilling
# ét sted, ikke en egenskab ved siderne, og CI's crawler laeser dem som
# mapper og meldte 20 brudte links i to doegn.
#
# ophold-sider.js har altid skrevet absolutte stier. Nu goer build.py det
# samme, saa de to flader ikke er uenige om noget saa enkelt.
#
# Proeven nedenfor er hegnet. Fjern den, og driften kommer igen i stilhed.

RELATIV = re.compile(r'(?:href|src|data-src|poster)="(?!/|https?:|mailto:|data:|#)([^"]*)"')

def _find_relative(html):
    return [m.group(1) for m in RELATIV.finditer(html) if m.group(1) != ""]

_fejl = []
for path, html in pages.items():
    if path.startswith("internt/"):
        continue          # interne sider serveres kun bag Access, men foelger samme regel
    for sti in _find_relative(html):
        _fejl.append(f"{path}: {sti}")

for path, html in pages.items():
    if not path.startswith("internt/"):
        continue
    for sti in _find_relative(html):
        _fejl.append(f"{path}: {sti}")

if _fejl:
    print("\nRELATIV STI PAA EN SIDE — se HVORFOR-ABSOLUTTE-STIER i build.py:")
    for f in _fejl:
        print("  ", f)
    raise SystemExit(1)

for path, html in pages.items():
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    html = re.sub(r"[ \t]+\n", "\n", html)
    with open(full, "w", encoding="utf-8") as f:
        f.write(html)
    print("skrev", path, len(html))

# Generér Workerens navigation fra samme kilde. Redigér ALDRIG
# vh-worker/src/nav-internt.js i haanden — den overskrives her.
_navjs = os.path.join(ROOT, "vh-worker", "src", "nav-internt.js")
if os.path.isdir(os.path.dirname(_navjs)):
    with open(_navjs, "w", encoding="utf-8") as f:
        f.write("// GENERERET af build.py fra nav-internt.json. Ret ikke her.\n")
        f.write("export const PUNKTER = " + _json.dumps(NAV_INTERNT, ensure_ascii=False, indent=1) + ";\n")
    print("genererede vh-worker/src/nav-internt.js")
