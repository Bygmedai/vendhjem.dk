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
    depth = "../" if path.startswith("internt/") else ""
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
</div>
</footer>
</body>
</html>
'''

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
<h1>En gammel campingplads på en ø - som bliver et sted, man <em>bor</em>.</h1>
</div></div>
</section>

<section class="stage">
<div class="g g-32 nb">
<div>
<p class="lead" style="color:var(--blaek)">Syv bygninger fra 1920. 25 senge, en sal til 50, 60.000 kvadratmeter - og det meste af det trænger. Vi lægger det frem, som det er, før der står noget pænt.</p>
<p class="lead">Det er ikke et "sommerhus". Det er et sted, man bor - med alt det, der følger med, når man ikke kan tage hjem fra det.</p>
<p class="mt3"><a class="lnk" href="bliv-en-del">Skriv → én vej ind</a></p>
</div>
<div class="fakta">
<div><p class="meta-s">Færge fra Stigsnæs</p><p class="v">Et kvarter · omkring 170 fastboende</p></div>
<div><p class="meta-s">Hvem står bag</p><p class="v">Lai Yde ejer stedet. Steven Wensley bygger med.</p></div>
<div><p class="meta-s">Lige nu</p><p class="v">Bygningerne registreres rum for rum 19.–21. september.</p></div>
</div>
</div>
</section>

<section class="stage">
<div class="g g-3 nb">
<div><p class="sec">Sporene</p><p class="small soft">Mandegrupper, rites of passage, byg-med-uger, stille uger. <a class="lnk" href="sporene">Se →</a></p></div>
<div><p class="sec">Fundamentet</p><p class="small soft">Fire perspektiver på alt, der er stort nok. To måder at beslutte på. Manifestet, dateret, når det er klar. <a class="lnk" href="fundamentet">Læs →</a></p></div>
<div><p class="sec">Døren ud</p><p class="small soft">Der er en dør ind, og en dør ud - og den sidste skal du kende først. <a class="lnk" href="bliv-en-del">Forløbet →</a></p></div>
</div>
</section>
''' + foot()

# ───────────────────────────── FUNDAMENTET (1d) ─────────────────────────────
pages["fundamentet.html"] = head("Fundamentet · Vend Hjem", "Det, stedet hviler på: fire perspektiver, to måder at beslutte på, fem energier, manifestet og Hjulet.", "fundamentet.html", current="fundamentet") + '''
<section class="stage topmeta">
<p class="meta">Fundamentet · manifestet lægges op med version og dato</p>
</section>

<section class="stage blok">
<p class="sec">Fire perspektiver på alt, der er stort nok</p>
<h1 style="font-size:clamp(26px,3.4vw,34px)">Hvert rum og hvert projekt beskrives fire gange.</h1>
<p class="lead maxw mt2">Ikke fordi det er pænt at have en model. Men fordi et projekt, der kun er beskrevet fra det ene hjørne, bliver bygget fra det ene hjørne - og så står de tre andre og betaler for det bagefter.</p>
</section>

<section class="stage">
<div class="quad">
<div><p class="q-akse">INDRE · INDIVIDUELT</p><p class="q-navn">JEG</p><p class="q-tekst">Hvad gør det ved mig at være her? Hvad betyder det? Bliver jeg et bedre menneske af at stå i det?</p></div>
<div><p class="q-akse">YDRE · INDIVIDUELT</p><p class="q-navn">DET</p><p class="q-tekst">Hvad skal der konkret gøres? Hvad kræver det af hænder, timer, værktøj - og kan jeg det?</p></div>
<div><p class="q-akse">INDRE · FÆLLES</p><p class="q-navn">VI</p><p class="q-tekst">Hvordan taler vi sammen om det? Går vi til kilden - eller til hinanden om hinanden?</p></div>
<div><p class="q-akse">YDRE · FÆLLES</p><p class="q-navn">DET HELE</p><p class="q-tekst">Hvad koster det, hvad slider det på øen, og holder det om tre år uden at nogen brænder ud?</p></div>
</div>
<p class="note mt2">Ved en lille reparation arves formålet fra det projekt, den hører til. Registreringen skal forblive lille - ellers bliver den ikke udfyldt.</p>
</section>

<section class="stage sektion">
<div class="g g-2">
<div>
<p class="sec">To måder at beslutte på</p>
<div class="stak">
<div class="ramme"><p class="meta-s" style="color:var(--accent);font-weight:500">FAGLIG</p><p class="small mt1">Den, der kan det, bestemmer hvordan - inden for formål, budget og aftalte grænser. Taget lægges ikke efter stemmetal. Alle andre kan være med som lærende.</p></div>
<div class="ramme"><p class="meta-s" style="color:var(--accent);font-weight:500">FÆLLES</p><p class="small mt1">De berørte er med. Hvad salen bruges til om lørdagen, afgør den, der kan snedkerere, ikke. Der noteres bidrag, aftale og en dato, hvor det tages op igen.</p></div>
</div>
<p class="xs soft mt2">Hver beslutning på sitet bærer mærket. Blandede deles op: først fælles formål og ramme, så fagligt løsningsforslag. Og alle kan altid sige fra ved fare, fejl og overskredne aftaler - fagligt mandat er ikke tavshedspligt.</p>
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
<p class="xs soft mt2">Aldrig en score for mennesker. Timer, kroner og kilowatt-timer registreres hver for sig og lægges aldrig sammen til et tal for, om nogen giver nok.</p>
</div>
</div>
</section>

<section class="stage">
<div class="g g-2 nb">
<div>
<p class="sec">Største drøm og største frygt</p>
<p class="small">Den ene trækker, den anden skubber. Det er den følelsesmæssige akse i alt, der laves her - og vi spørger til begge, inden du skriver under. Ikke for at sortere. For at vide, hvad vi hver især kommer med.</p>
</div>
<div>
<p class="sec">Hjulet - Stevens model</p>
<div class="ramme-stiplet"><p class="meta-s" style="color:var(--accent);font-weight:500">IKKE SKREVET ENDNU</p><p class="small mt1">Den skrives ud af samtalerne på stedet, ikke før dem. Når den er skrevet, står den her med dato. Indtil da står der det her. <a class="lnk" href="hjulet">Hvad den skal svare på →</a></p></div>
</div>
</div>
</section>

<section class="stage sektion">
<div class="g g-2">
<div>
<p class="sec">Refleksionssprog, ikke adgangskrav</p>
<p class="small">Spiral Dynamics, Enneagram, arketyperne, udviklingslinjerne - det er sprog til at forstå sig selv og hinanden. Ingen farve, type eller niveau afgør, om nogen kan være her, hvad de må bestemme, eller hvad de er værd.</p>
<p class="small soft">Det står her, fordi det skal være svært at lave om på.</p>
</div>
<div>
<p class="sec">Det integrale landkort</p>
<p class="small">Kvadranter, niveauer, linjer, tilstande og typer. Lais grundlag, skrevet ud i seks dele på det nuværende site. De flyttes herind, som de er, i næste runde.</p>
<p class="meta mt2">Manifestet · dateret version · kommer</p>
</div>
</div>
</section>
''' + foot()

# ───────────────────────────── HJULET ─────────────────────────────
pages["hjulet.html"] = head("Hjulet · Vend Hjem", "Stevens model. Ikke skrevet endnu - og det står her, så ingen er i tvivl.", "hjulet.html", current="fundamentet") + '''
<section class="stage blok">
<p class="sec">Fundamentet · under udarbejdelse</p>
<h1>Hjulet</h1>
<p class="lead maxw mt2">Stevens model. Den er ikke skrevet færdig, og den bliver det ikke ved et skrivebord.</p>
</section>
<section class="stage">
<div class="g g-2">
<div>
<p class="sec">Hvorfor der ikke står mere her endnu</p>
<p class="small">Fundamentet er skævt lige nu. Lais integrale grundlag er skrevet gennem mange år og kan læses i dag. Hjulet er ikke - og et halvfærdigt fundament, der ser færdigt ud, er værre end et tomt felt.</p>
<p class="small">Den kommer, når vi har styr på stedet, og den kommer ud af samtaler med de mennesker, der er her. Ikke ud af en model, der bliver præsenteret for dem bagefter.</p>
</div>
<div>
<p class="sec">Det, den skal svare på</p>
<ul class="liste">
<li><span>Hvad et menneske skal kunne</span><span class="r">hvilke sider af et liv der skal være plads til</span></li>
<li><span>Hvordan man bliver hel</span><span class="r">rejsen ind og ud af et fællesskab</span></li>
<li><span>Hvad der holder</span><span class="r">hvad man kan skifte ud uden at miste stedet</span></li>
</ul>
<p class="note mt2">Spørgsmålene kan blive andre, når de møder virkeligheden på øen. Det er meningen.</p>
</div>
</div>
</section>
''' + foot()

# ───────────────────────────── SPORENE (oversigt) ─────────────────────────────
pages["sporene.html"] = head("Sporene · Vend Hjem", "Det, der sker på stedet: mandegrupper og rites of passage, retreats, festival, byg-med-uger, stille uger, campingvogne.", "sporene.html", current="sporene") + '''
<section class="stage blok">
<p class="sec">Sporene</p>
<h1>Det, der sker på stedet.</h1>
<p class="lead maxw mt2">To mennesker med hver sit felt og et sted, der kan bære begge. Stevens ti år i mandearbejde og rites of passage. Lais integrale praksis og skuespilmetode.</p>
<p class="lead maxw mt2">Ingen datoer i kalenderen endnu. Når et ophold åbnes, står det her.</p>
</section>

<section class="stage">
<div class="g g-2">
<div class="loeft">
<p class="sec">Mandegrupper og rites of passage</p>
<p class="small">Stevens spor. Weekender for femten mænd: seng, mad, tre-fire timers arbejde på stedet og noget alvorligt om aftenen. Arbejdet er ikke betaling - det er grunden til, at prisen er en tredjedel af markedets.</p>
<p class="meta mt2">850 kr. · seng og al mad indgår · sauna · færgen betaler du selv</p>
<p class="meta mt1">Ingen datoer åbne på det her spor endnu.</p>
<p class="mt2"><a class="lnk" href="maend">Sådan ligger en weekend →</a></p>
</div>
<div>
<p class="sec">Retreats - vi er værter</p>
<p class="small">Andres forløb, midt i ugen. Hele stedet fra onsdag til mandag, med eller uden mad fra vores køkken. De første facilitatorer tager en chance på et sted uden anmeldelser - og det ved vi godt.</p>
<p class="meta mt2">Prisen aftales med facilitatorerne, når den første dato ligger fast.</p>
<p class="meta mt1">Ingen datoer åbne på det her spor endnu.</p>
</div>
<div>
<p class="sec">Festival</p>
<p class="small">Én vi selv laver, og én vi lægger plads til. Steven var partner i og medskaber af Tribal Vibe, så det er ikke et forsøg - det er dét, han kommer fra.</p>
<p class="meta mt2">Prisen sættes, når den første festivaldato ligger fast.</p>
<p class="meta mt1">Ingen datoer åbne på det her spor endnu.</p>
</div>
<div>
<p class="sec">Byg-med-uger</p>
<p class="small">En uge, hvor man arbejder på stedet, spiser med og bor her. Længere end en weekend og roligere. Ligger ikke samtidig med andet.</p>
<p class="meta mt2">Prisen sættes, når den første uge ligger fast.</p>
<p class="meta mt1">Ingen datoer åbne på det her spor endnu.</p>
</div>
<div>
<p class="sec">Stille uger og vinter</p>
<p class="small">Eget værelse, intet program, ingen mad. For dem der skal skrive, tænke eller bare væk. Om vinteren kan et værelse lejes på måneden.</p>
<p class="meta mt2">Prisen sættes, når de første uger ligger fast.</p>
<p class="meta mt1">Ingen datoer åbne på det her spor endnu.</p>
</div>
<div>
<p class="sec">Campingvogne</p>
<p class="small">Plads til dem, der vil bo her i perioder. To priser: én for dem der kommer for at være, og en lavere for dem der kommer for at arbejde med.</p>
<p class="meta mt2">To priser: én for at være, en lavere for at arbejde med. Beløbene sættes, når pladserne åbner.</p>
<p class="meta mt1">Ingen datoer åbne på det her spor endnu.</p>
</div>
</div>
</section>

<section class="stage blok">
<div class="maxw">
<p class="sec">Syv uger om året er lukkede</p>
<p class="small soft">De står i kalenderen som ro, når ugerne er sat: ingen gæster, intet salg. Et sted, der kan fylde 52 uger, brænder sine ejere af i år ét. Det har vi set før.</p>
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
<p class="mt3">Steven har stået i det her i ti år - Tomas Friis-linjen, medskaber af Tribal Vibe. Det er ikke terapi, og det er ikke et kursus. Du får ikke et diplom, og der er ingen der spørger, hvad du laver til daglig.</p>
<p class="soft">Der bliver talt. Der bliver også siddet stille i lang tid, og det er den del, de fleste husker.</p>
</div>
<div class="media">''' + HORIZON("h-side", "58%", "Foto · salen, lørdag morgen · kommer", "F-014") + '''</div>
</div>
</section>

<section class="stage blok blok-rule">
<p class="sec">Sådan ligger en weekend</p>
<div class="tl">
<div><div class="pkt"></div><p class="t">Fredag eftermiddag</p><p class="b">Færgen fra Stigsnæs, et kvarter. Kaffe, rundtur - og telefonen i en kasse ved døren, hvis du vil. De fleste lægger den.</p></div>
<div><div class="pkt"></div><p class="t">Fredag aften</p><p class="b">Mad fra storkøkkenet. Bål. En runde: hvorfor er du kommet, og hvad er du bange for at sige. Ingen kommenterer.</p></div>
<div><div class="pkt a"></div><p class="t">Lørdag</p><p class="b">Arbejde om formiddagen - rigtigt arbejde, valgt fordi femten utrænede hænder faktisk kan flytte det. Sauna og havet om eftermiddagen. Workshop om aftenen. Det er der, weekenden enten betyder noget eller ikke gør.</p></div>
<div><div class="pkt"></div><p class="t">Søndag</p><p class="b">Morgenmad, oprydning, en sidste runde: hvad tager du med. Så færgen igen. Ingen gruppe på nettet bagefter.</p></div>
</div>
</section>

<section class="stage">
<div class="g g-3 nb">
<div><p class="meta-s">Praktisk</p><p class="small mt1">15 pladser · 850 kr. · seng og al mad indgår · sauna · færgen betaler du selv</p></div>
<div><p class="meta-s">Næste</p><p class="small mt1">Datoer for 2027 kommer, når stedet er registreret og kalenderen ligger fast.</p></div>
<div><p class="meta-s">Hvis du vil med</p><p class="mt1"><a class="lnk" href="bliv-en-del">Skriv → vi ringer</a></p></div>
</div>
</section>

<section class="stage sektion">
<div class="g g-2">
<div>
<p class="sec">Hvorfor prisen ser sådan ud</p>
<p class="small">En manderetreat i Danmark koster typisk 4.500–5.200 kroner for en weekend med mad og program. Forskellen her er arbejdet. Det er ikke en skjult udgift for dig - det er grunden til, at prisen ser ud, som den gør.</p>
<p class="small soft">Sovepose eller eget sengetøj tager du selv med. Det er der ingen, der brokker sig over, og det holder prisen nede.</p>
</div>
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
<p class="lead mt2">Det har vi ikke været gode til før. Derfor står slutdatoen i aftalen fra dag ét, og derfor siger alle ja til mediation, inden der er noget at mediere om. Det er ikke til forhandling - og vi lytter altid.</p>
</div>
</section>

<section class="stage">
<div class="g g-4">
<div class="trin"><p class="nr">01</p><p class="t">Du skriver</p><p class="b">Et brev. Ikke en formular med felter til "interesseområde".</p><p class="m">Svar inden 7 dage</p></div>
<div class="trin"><p class="nr">02</p><p class="t">To samtaler</p><p class="b">Én om hvad du vil. Én om hvad du har svært ved. Den anden er den vigtige.</p><p class="m">3–6 uger</p></div>
<div class="trin loeft"><p class="nr a">03</p><p class="t">Prøveaftale</p><p class="b">Du bor og arbejder her. Der er en slutdato, og den er ikke en trussel.</p><p class="m">6 måneder · skriftlig</p></div>
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
<p class="xs soft mt3">Vi lover ikke en bolig, en ejerandel eller en permanent plads. Et prøveforløb er et forsøg - for dig og for os - og det er sagt højt, fordi det modsatte har kostet dyrt før.</p>
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
    location.href='mailto:kontakt@vendhjem.dk?subject='+encodeURIComponent('Brev til Vend Hjem fra '+n)+'&body='+encodeURIComponent(body);
  });
})();
</script>
''' + foot()

# ───────────────────────────── INTERNT / OVERSIGT ─────────────────────────────
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
<p class="small">Fællesskabets økonomi skal være gennemsigtig for dem, der er med. Den skal ikke være gennemsigtig for alle andre. Forskellen er ikke hemmelighedskræmmeri - det er, at et regnskab uden sammenhæng bliver læst forkert af folk, der ikke kender sagen.</p>
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
    <p class="mt1"><a class="lnk" href="#">Se aftalen →</a></p>
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
<p class="small soft">For den, der har lagt timerne, vokser de over tid. For alle andre daler de. Det er ikke ond vilje - det er sådan hukommelse virker. Derfor er der en tabel. Den koster lidt tid i starten og redder et fællesskab senere.</p>
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
