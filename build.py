#!/usr/bin/env python3
"""Vend Hjem · Havkant — bygger de statiske sider.
Ingen build-kæde på serveren: dette script skriver almindelige HTML-filer,
som ligger færdige i repoet. Kør: python3 build.py
"""
import os, re
ROOT = os.path.dirname(os.path.abspath(__file__))

FOOT_DATE = "15. september 2026"
# Indtil vendhjem.dk peger på Cloudflare, ligger de interne sider kun på Workeren.
# Sæt til "" ved cutover, så "Log ind" bliver et relativt link.
INTERN_BASE = ""  # domaenet er live; "Log ind" er nu et relativt link

def head(title, desc, path, intern=False, current=None):
    depth = "../" if path.startswith("internt/") else ""
    robots = '<meta name="robots" content="noindex, nofollow">\n' if intern else ""
    canon = "" if intern else f'<link rel="canonical" href="https://vendhjem.dk/{path.replace("index.html","").replace(".html","")}">\n'
    if intern:
        nav = f'''<nav class="nav" aria-label="Internt">
<a href="{depth}">← Offentlig side</a>
<a href="{depth}internt/"{' aria-current="page"' if current=="internt" else ""}>Oversigt</a>
<a href="{depth}internt/stedet"{' aria-current="page"' if current=="stedet" else ""}>Stedet</a>
<a href="{depth}internt/oekonomi"{' aria-current="page"' if current=="oekonomi" else ""}>Økonomi</a>
<a href="{depth}internt/anlaeg"{' aria-current="page"' if current=="anlaeg" else ""}>Anlæg</a>
<a href="{depth}internt/timer"{' aria-current="page"' if current=="timer" else ""}>Timer og indskud</a>
<a href="{depth}internt/registrering"{' aria-current="page"' if current=="registrering" else ""}>Registrering</a>
</nav>'''
        brand = f'<a class="brand" href="{depth}internt/">Vend <em>Hjem</em> <span class="meta" style="margin-left:10px">Internt</span></a>'
    else:
        nav = f'''<nav class="nav" aria-label="Hovedmenu">
<a href="{depth}fundamentet"{' aria-current="page"' if current=="fundamentet" else ""}>Fundamentet</a>
<a href="{depth}sporene"{' aria-current="page"' if current=="sporene" else ""}>Sporene</a>
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
    depth = "../" if path.startswith("internt/") else ""
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
            f'alt="{FOTO_ALT[slug]}" loading="lazy" decoding="async">\n'
            f'</picture>')

def foto(slug, cap, path="", sizes="(max-width: 760px) 100vw, 700px", cls=""):
    """Foto som figur i spalten: billede, 1px streg, mono-tekst. Ingen ramme, ingen skygge."""
    d = "../" if path.startswith("internt/") else ""
    k = (" " + cls) if cls else ""
    return (f'<figure class="foto{k}">\n' + _pic(slug, d, sizes) +
            f'\n<figcaption class="meta">{cap}</figcaption>\n</figure>')

def foto_i_horisont(slug, cap, path="", cls="h-side"):
    """Foto der udfylder en horisont-figur (designsystemets .horizon > img)."""
    d = "../" if path.startswith("internt/") else ""
    sizes = "(max-width: 860px) 100vw, 420px"
    return (f'<div class="horizon {cls}">\n' + _pic(slug, d, sizes) +
            f'\n<p class="cap">{cap}</p>\n</div>')



def foto_gitter(items, path=""):
    """Dokumentarisk gitter: smaa fotos med mono-label. Kun internt."""
    d = "../" if path.startswith("internt/") else ""
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
pages["index.html"] = head("Vend Hjem · Agersø", "En gammel campingplads på Agersø, som bliver et sted, man bor. Lai Yde ejer stedet; Steven Wensley bygger med.", "index.html", current=None) + '''
<section class="horizon h-hero" style="--h:38%">
<video id="hero" muted loop playsinline preload="none" poster="images/hero-strand-poster.jpg" aria-hidden="true" data-src="images/hero-strand.mp4"></video>
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
<p class="mt3"><a class="lnk" href="bliv-en-del">Skriv → én vej ind</a></p>
</div>
<div class="fakta">
<div><p class="meta-s">Færge fra Stigsnæs</p><p class="v">Et kvarter · omkring 170 fastboende</p></div>
</div>
</div>
</section>

<section class="stage mt4">
''' + foto("oppefra", "Stedet fra luften · 6 hektar · Storebælt mod vest", sizes="(max-width: 1180px) 100vw, 1100px", cls="foto-bred") + '''
</section>

<section class="stage">
<div class="g g-3 nb">
<div><p class="sec">Sporene</p><p class="small soft">Mandeweekender, retreats, byg-med-uger, festivaler, burns, raves og stille uger. <a class="lnk" href="sporene">Se →</a></p></div>
<div><p class="sec">Fundamentet</p><p class="small soft">Sådan træffer vi beslutninger, fordeler ansvar og taler sammen, når vi er uenige. <a class="lnk" href="fundamentet">Læs →</a></p></div>
<div><p class="sec">Bliv en del</p><p class="small soft">Forløbet fra den første samtale til en aftale, og hvad der gælder, hvis du vil stoppe. <a class="lnk" href="bliv-en-del">Se forløbet →</a></p></div>
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
<div class="g nb" style="grid-template-columns:1fr">
<div class="maxw">
<p class="sec">Største drøm og største frygt</p>
<p class="small">Før du skriver under på en aftale, taler vi om din største drøm for at være med og det, du frygter mest. Samtalen hjælper os med at få dine ønsker og forbehold med i det, vi aftaler.</p>
</div>
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
<p class="small">Kvadranter, niveauer, linjer, tilstande og typer. Lais grundlag. Det er ikke skrevet ud her endnu.</p>
<p class="meta mt2">Landkortet og manifestet · dateret version · kommer</p>
</div>
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
<p class="lead">Steven står for mandegrupperne og rites of passage. Lai står for den integrale praksis og skuespilmetoden. Resten laver vi sammen med dem, der er her.</p>
</div>
<div style="padding:0">''' + foto("bordet-i-marken", "Bordet i marken · sommer", sizes="(max-width: 600px) 100vw, 380px") + '''</div>
</div>
</section>

<section class="stage">
<div class="g g-2">
<div class="loeft">
<p class="sec">Mandegrupper og rites of passage</p>
<p class="small">Weekender for femten mænd. Vi laver mad sammen, arbejder nogle timer på stedet og mødes om aftenen i en talerunde, hvor hver mand taler uden at blive afbrudt. Steven har været i mandegruppemiljøet i ti år.</p>
<p class="meta mt2">Weekender · 2027 · datoer kommer</p>
<p class="mt2"><a class="lnk" href="maend">Sådan ligger en weekend →</a></p>
</div>
<div>
<p class="sec">Retreats - vi er værter</p>
<p class="small">Du kan holde dit eget forløb her. Hele stedet fra onsdag til mandag, plads til femogtyve overnattende, med eller uden mad fra køkkenet. Du står selv for indholdet.</p>
<p class="meta mt2">Onsdag til mandag · op til 25 senge</p>
</div>
<div>
<p class="sec">Festival, burns og raves</p>
<p class="small">Vi laver vores egen, og vi lægger plads til dem, andre arrangerer. Sal, køkken og seks hektar gør stedet brugbart til både festival, burn og rave. Steven var partner i og medskaber af Tribal Vibe.</p>
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
''' + foot()

# ───────────────────────────── MÆND (1e) ─────────────────────────────
pages["maend.html"] = head("Mandegrupper · Vend Hjem", "Femten mænd, en weekend på en ø, tre-fire timers arbejde og noget alvorligt om aftenen.", "maend.html", current="sporene") + '''
<section class="stage topmeta">
<p class="meta">Sporene / Mandegrupper · udkast, Steven skriver den endelige tekst</p>
</section>

<section class="stage">
<div class="g g-54">
<div>
<p class="sec">Det, der fylder weekenderne</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Femten mænd, en sal, og ingen der skal <em>ordnes</em>.</h1>
<p class="mt3">Steven har været i det danske mandegruppemiljø i ti år. Han begyndte hos Tomas Friis og var partner i og medskaber af Tribal Vibe.</p>
<p class="soft">Om dagen arbejder vi på stedet. Om aftenen dykker vi dybt og bygger bro mellem dem vi var og dem vi gerne vil være, omringet af andre mænd der lytter og spejler os.</p>
</div>
<div class="media">''' + foto_i_horisont("salen", "Salen · hvor aftenrunden holdes") + '''</div>
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

<section class="stage">
<div class="g g-3 nb">
<div><p class="meta-s">Praktisk</p><p class="small mt1">15 pladser · 850 kr. · seng og al mad indgår · sauna · færgen og sovepose selv</p></div>
<div><p class="meta-s">Næste</p><p class="small mt1">Datoer for 2027 kommer, når stedet er registreret og kalenderen ligger fast.</p></div>
<div><p class="meta-s">Hvis du vil med</p><p class="mt1"><a class="lnk" href="bliv-en-del">Skriv → vi ringer</a></p></div>
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
<div class="trin"><p class="nr">01</p><p class="t">Du skriver</p><p class="b">Et brev. Ikke en formular med felter til "interesseområde".</p><p class="m">Svar inden 7 dage</p></div>
<div class="trin"><p class="nr">02</p><p class="t">To samtaler</p><p class="b">Én om hvad du vil. Én om hvad du har svært ved. Den anden er den vigtige.</p><p class="m">3–6 uger</p></div>
<div class="trin loeft"><p class="nr a">03</p><p class="t">Prøveaftale</p><p class="b">Du bor og arbejder her. Slutdatoen står i aftalen fra begyndelsen.</p><p class="m">6 måneder · skriftlig</p></div>
<div class="trin"><p class="nr">04</p><p class="t">Medlem</p><p class="b">Begge siger ja igen. Timer, indskud og mandat skrives ned, som de er aftalt.</p><p class="m">Tages op hvert år</p></div>
</div>
</section>

<section class="stage">
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
<form class="ramme ramme-loeft" id="brev" style="padding:18px 20px">
<p class="small soft">Skriv hvad du hedder, hvor du er i dit liv, og hvad du er bange for at det her bliver.</p>
<label class="felt-label" for="navn">Navn</label>
<input class="felt" id="navn" name="navn" type="text" autocomplete="name" required>
<label class="felt-label" for="mail">Mail</label>
<input class="felt" id="mail" name="mail" type="email" autocomplete="email" required>
<label class="felt-label" for="brevet">Brevet</label>
<textarea class="felt" id="brevet" name="brevet" required></textarea>
<button class="lnk" type="submit">Send →</button>
<p class="note mt2">Brevet åbner i dit eget mailprogram. Vi svarer inden 7 dage.</p>
</form>
</div>
</div>
</section>
<script>
(function(){
  var f=document.getElementById('brev'); if(!f) return;
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var n=f.navn.value.trim(), m=f.mail.value.trim(), b=f.brevet.value.trim();
    var body='Fra: '+n+' <'+m+'>\\n\\n'+b;
    location.href='mailto:laiydeh@gmail.com?subject='+encodeURIComponent('Brev til Vend Hjem fra '+n)+'&body='+encodeURIComponent(body);
  });
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
<p class="meta mt3">Senest opdateret 15. september 2026</p>

<p class="lead mt4">Vi behandler kun det, du selv sender os. Vi indsamler intet i det skjulte, profilerer ikke og videresælger ikke.</p>

<div class="stak mt4">
<div><p class="sec">Dataansvarlig</p><p class="small">Vend Hjem drives af Lai Yde, Egholmvej 23, Agersø. Spørgsmål til behandlingen af dine oplysninger: <a href="mailto:laiydeh@gmail.com">laiydeh@gmail.com</a>.</p></div>

<div><p class="sec">Hvad vi får</p><p class="small">Brevet på <a href="bliv-en-del">Bliv en del</a> beder om navn, mailadresse og din tekst. Formularen sender intet selv - den åbner en mail i dit eget program, som du selv afsender. Vi modtager altså kun det, du vælger at sende, og vi ser det først, når mailen ligger hos os.</p></div>

<div><p class="sec">Hvorfor</p><p class="small">For at kunne svare dig og for at forberede eller indgå en aftale om ophold, medlemskab eller leje. Retsgrundlag: databeskyttelsesforordningens artikel 6, stk. 1, litra b, og litra a, hvor du har givet samtykke.</p></div>

<div><p class="sec">Hvor længe</p><p class="small">Henvendelser, der ikke fører til noget, slettes senest efter to år. Fører de til en aftale, gemmer vi det, aftalen kræver, så længe den løber, og derefter så længe bogførings- og forældelsesregler kræver det.</p></div>

<div><p class="sec">Hvem ser det</p><p class="small">Kun de mennesker i Vend Hjem, der skal svare dig. Mailen ligger hos vores mailudbyder. Vi overfører ikke oplysninger til tredjelande på eget initiativ.</p></div>

<div><p class="sec">Dine rettigheder</p><p class="small">Du kan bede om indsigt, rettelse eller sletning, om begrænsning, og du kan gøre indsigelse. Skriv til <a href="mailto:laiydeh@gmail.com">laiydeh@gmail.com</a>. Er du utilfreds med vores svar, kan du klage til Datatilsynet, <a href="https://www.datatilsynet.dk/">datatilsynet.dk</a>.</p></div>
</div>

<p class="meta mt4"><a href="cookies">Cookies og tredjepart →</a></p>
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

<p class="meta mt4"><a href="privatlivspolitik">Privatlivspolitik →</a></p>
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
<div><p class="sec">Stedet</p><p class="small soft">Bygningerne som BBR kender dem, plan- og naturforhold, og registreringen 19.–21. september.</p><p class="mt2"><a class="lnk" href="stedet">Åbn →</a></p></div>
<div><p class="sec">Økonomi</p><p class="small soft">Faste udgifter, hvad en gæst koster, og tre scenarier for 2027.</p><p class="mt2"><a class="lnk" href="oekonomi">Åbn →</a></p></div>
<div><p class="sec">Anlæg</p><p class="small soft">Bygning for bygning, rum for rum. Registrering, fund og hvad det koster at rette.</p><p class="mt2"><a class="lnk" href="anlaeg">Åbn →</a></p></div>
<div class="loeft"><p class="sec">Timer og indskud</p><p class="small soft">Hvem har lagt hvad, hvornår, og hvad blev der aftalt. Den vigtigste tabel på hele stedet.</p><p class="mt2"><a class="lnk" href="timer">Åbn →</a></p></div>
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
<p class="small soft">Når stedet er i drift, står det her: hvem der har lagt hvilke timer, og hvem der har skudt hvilke penge ind - med dato, og med hvad der blev aftalt dengang. <a class="lnk" href="timer">Tabellen →</a></p>
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


# ───────────────────────────── INTERNT / FELTREGISTRERING ─────────────────────────────
pages["internt/registrering.html"] = head("Registrering · Internt", "Feltregistrering 19.–21. september. Virker offline.", "internt/registrering.html", intern=True, current="registrering") + '''
<section class="stage blok">
<p class="sec">Internt · feltregistrering</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Rum for rum.</h1>
<p class="lead maxw mt2">Kun det, der skal fanges, mens du står i rummet. Resten — ønsket brug, de fire perspektiver, de fem energier — udfyldes ved bordet bagefter, når I kan se på fotoet sammen.</p>
<div class="tags mt3">
<span class="tag" id="net">online</span>
<span class="tag" id="gemstatus">Intet gemt endnu</span>
</div>
</section>

<section class="stage">
<div class="g g-2 nb">
<div>
<label class="felt-label" for="hvem">Hvem registrerer (initialer)</label>
<input class="felt" id="hvem" type="text" autocomplete="off" placeholder="SW">
<p class="note">Står på hver linje, så to telefoner kan flettes bagefter.</p>
</div>
<div>
<label class="felt-label" for="filter">Vis</label>
<select class="felt" id="filter">
<option value="alle">Alle steder</option>
<option value="mangler">Kun dem der mangler</option>
<option value="faerdige">Kun færdige</option>
</select>
<p class="mt2"><button class="lnk" type="button" id="visoversigt">Oversigt og eksport →</button></p>
</div>
</div>
</section>

<section class="stage blok" id="liste"></section>

<section class="stage sektion" id="oversigt" hidden>
<p class="sec">Hvor langt er vi</p>
<div class="g g-3">
<div><p class="stor"><span id="o_gjort">0</span> <span class="soft" style="font-size:.5em">af <span id="o_ialt">0</span></span></p><p class="meta-s mt1">steder færdige</p><div class="frem mt2" id="o_frem"></div></div>
<div><p class="stor" id="o_fund">0</p><p class="meta-s mt1">fund registreret</p></div>
<div class="loeft"><p class="stor" id="o_haster" style="color:var(--accent)">0</p><p class="meta-s mt1">haster · skal afklares nu</p></div>
</div>
<div class="g g-2 nb mt3">
<div>
<p class="sec">Tilstand fordelt</p>
<ul class="liste" id="o_k"></ul>
<p class="note mt2">Fugt 2 eller 3: <span id="o_fugt"></span></p>
</div>
<div>
<p class="sec">Eksport</p>
<p class="small soft">Filerne lægges ind i feltarket bagefter. Eksportér ved hver pause — telefonen er ikke et arkiv.</p>
<p class="mt2"><button class="lnk" type="button" id="eks_rum">Rum som CSV</button></p>
<p class="mt2"><button class="lnk" type="button" id="eks_fund">Fund som CSV</button></p>
<p class="mt2"><button class="lnk" type="button" id="eks_json">Alt som JSON (til fletning)</button></p>
<p class="mt3"><label class="felt-label" for="import">Flet den anden telefons JSON ind</label>
<input class="felt" id="import" type="file" accept="application/json,.json"></p>
<p class="note" id="importsvar"></p>
<p class="note mt2" id="o_datamangel"></p>
</div>
</div>
</section>

<section class="stage sektion" id="form" hidden>
<div class="g nbb" style="grid-template-columns:1fr">
<div>
<p class="sec"><span id="formtitel"></span></p>
<p class="note" id="formhint"></p>

<div class="g g-4 nb mt3" style="gap:1px">
<div style="padding:12px"><label class="felt-label" for="f_l">Længde m</label><input class="felt" id="f_l" type="text" inputmode="decimal"></div>
<div style="padding:12px"><label class="felt-label" for="f_b">Bredde m</label><input class="felt" id="f_b" type="text" inputmode="decimal"></div>
<div style="padding:12px"><label class="felt-label" for="f_h">Loftshøjde m</label><input class="felt" id="f_h" type="text" inputmode="decimal"></div>
<div style="padding:12px"><label class="felt-label" for="f_dor">Dørbredde cm</label><input class="felt" id="f_dor" type="text" inputmode="numeric"></div>
</div>

<p class="felt-label mt3">Rumnavn, som I kalder det</p>
<input class="felt" id="f_navn" type="text" autocomplete="off">

<p class="felt-label mt3">Tilstand</p>
<div class="tags">
<button type="button" class="tag" data-valg="k" data-v="K0">K0 ingen skade</button>
<button type="button" class="tag" data-valg="k" data-v="K1">K1 let</button>
<button type="button" class="tag" data-valg="k" data-v="K2">K2 moderat</button>
<button type="button" class="tag" data-valg="k" data-v="K3">K3 alvorlig</button>
<button type="button" class="tag" data-valg="k" data-v="UN">UN skal undersøges</button>
</div>

<p class="felt-label mt3">Fugt</p>
<div class="tags">
<button type="button" class="tag" data-valg="fugt" data-v="0">0 ingen</button>
<button type="button" class="tag" data-valg="fugt" data-v="1">1 lugt</button>
<button type="button" class="tag" data-valg="fugt" data-v="2">2 pletter</button>
<button type="button" class="tag" data-valg="fugt" data-v="3">3 synlig skimmel</button>
</div>

<p class="felt-label mt3">Der er</p>
<div class="tags">
<button type="button" class="tag" id="tek0">Varmekilde</button>
<button type="button" class="tag" id="tek1">Stik</button>
<button type="button" class="tag" id="tek2">Loftudtag</button>
<button type="button" class="tag" id="tek3">Vand</button>
<button type="button" class="tag" id="tek4">Afløb</button>
<button type="button" class="tag" id="tek5">Ventilation</button>
<button type="button" class="tag" id="tek6">Vindue kan åbnes</button>
</div>

<p class="felt-label mt3">Fotonumre</p>
<input class="felt" id="f_foto" type="text" autocomplete="off" placeholder="IMG_2231-2234">
<p class="note">Foto først, note bagefter. Et foto med en dårlig note kan reddes.</p>

<p class="felt-label mt3">Hvad så du</p>
<textarea class="felt" id="f_note" placeholder="Beskriv det sete uden at gætte årsagen."></textarea>

<div class="tags mt3">
<button class="lnk" type="button" id="gem">Gem rummet</button>
<button class="lnk" type="button" id="luk">Luk</button>
</div>
<p class="note mt2" id="gemsvar"></p>
</div>
</div>

<div class="g nbb mt4" style="grid-template-columns:1fr">
<div class="loeft">
<p class="sec">Fund her — <span id="fundsted" class="mono"></span></p>
<p class="felt-label">Hvad blev observeret</p>
<input class="felt" id="fund_hvad" type="text" autocomplete="off">
<p class="felt-label mt2">Haster</p>
<div class="tags">
<button type="button" class="tag tag-accent" data-valg="haster" data-v="nu">nu</button>
<button type="button" class="tag" data-valg="haster" data-v="1-2 år">1–2 år</button>
<button type="button" class="tag" data-valg="haster" data-v="senere">senere</button>
</div>
<p class="felt-label mt2">Hvem udfører</p>
<div class="tags">
<button type="button" class="tag" data-valg="udf" data-v="selv">selv</button>
<button type="button" class="tag" data-valg="udf" data-v="fagmand">fagmand</button>
</div>
<p class="felt-label mt2">Foto</p>
<input class="felt" id="fund_foto" type="text" autocomplete="off">
<p class="mt2"><button class="lnk" type="button" id="fundgem">Gem fund</button></p>
<p class="note mt2" id="fundsvar"></p>
</div>
</div>
</section>

<section class="stage sektion">
<p class="sec">Fund i alt</p>
<div id="fundliste"></div>
</section>

<script src="registrering.js"></script>
''' + foot(intern=True, path="internt/registrering.html")

for path, html in pages.items():
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    html = re.sub(r"[ \t]+\n", "\n", html)
    with open(full, "w", encoding="utf-8") as f:
        f.write(html)
    print("skrev", path, len(html))

# app-filer (feltregistrering) kopieres med, så de altid følger bygget
import shutil
for f in ("registrering.js", "sw.js"):
    src = os.path.join(ROOT, "app", f)
    if os.path.exists(src):
        shutil.copy2(src, os.path.join(ROOT, "internt", f))
        print("kopierede", f)
