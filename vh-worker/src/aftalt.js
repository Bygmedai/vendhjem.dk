// «Det, vi har aftalt» — reglerne, der skal kunne findes klokken tre om natten.
//
// HVORFOR DEN FLYTTEDE
//
// Natten blev skrevet 18.09.2026 til fællesskabet: hvem der er ædru, hvad
// samtykke betyder, hvad man gør når noget går galt. Og så blev den lagt bag
// Cloudflare Access på /internt/natten, hvor kun Steven, Lai og Haruki kan
// læse den. De mennesker, reglerne er til for, kunne ikke se dem.
//
// Nu bor teksten ét sted — her — og vises på /mit/aftalt, hvor alle med en
// rolle kan læse den. Én kilde, ikke to der driver fra hinanden.
//
// Det, der ER offentligt, står der stadig: fundamentet og døren ud har hver
// sin side, og vi gentager dem ikke her. En regel, der står to steder, bliver
// to regler.

import { esc } from "./flade.js";

export const AFTALT_OPDATERET = "18. september 2026";

/** Nattens fem afsnit. Rettes her og kun her. */
export const NATTEN = [
  {
    id: "vaagen",
    sec: "Én, der er vågen",
    tekst: "Når vi er flere end 20 om natten, er der én af os, der hverken drikker eller tager noget, og som kan findes hele natten. Navnet står ved døren, og alle får det at vide, når de kommer. Det er en rolle, man tager på skift, og den er en gave til de andre, ikke en straf.",
    meta: "Over 20 gæster · navn ved døren",
    loeft: true,
  },
  {
    id: "samtykke",
    sec: "Samtykke",
    tekst: "Et nej er et nej, også klokken tre, også når det er sagt lavt. Den, der er vågen, kan bede hvem som helst om at gå hjem, uden at der skal diskuteres. Og der er et rum med en dør, man kan lukke, hvis man har brug for at være alene eller for at være to i fred.",
    meta: "Et rum med en dør · hele natten",
  },
  {
    id: "aftalen",
    sec: "Aftalen for aftenen",
    tekst: "Hvad der gælder for alkohol og andet, aftaler vi fra arrangement til arrangement, mellem dem, der holder det, og den, der er vågen. Aftalen skrives ned, før gæsterne kommer, og den, der er vågen, kender den. Vi skriver den ikke på den offentlige side.",
    meta: "Pr. arrangement · skrevet ned før",
  },
  {
    id: "naboerne",
    sec: "Naboerne",
    tekst: "Stedet ligger for sig selv, og det, der sker inde i salen, generer ingen. Står der højtalere udenfor, får naboerne besked i god tid, med dato og et telefonnummer til en, der tager den, når den ringer.",
    meta: "Kun ved højtalere ude · dato og nummer",
  },
];

/** Det, man skal kunne slå op, mens det står på. */
export const GAAR_GALT = [
  "Ring 112 ved fare for liv. Lægevagten i Region Sjælland: 1818. Adressen er Egholmvej 23, Agersø, 4230 Skælskør.",
  "Færgen har sidste afgang om aftenen, og planen for dagen hænger ved døren. Ved akut behov er det 112, der sørger for, at hjælpen når øen.",
  "Forbindskassen har én fast plads, som den, der er vågen, kender. Hvor, står her, når den er hængt op.",
  "Den, der er vågen, skriver ned, hvad der skete, samme nat, mens det er klart. Ikke for at placere skyld, men for at vi kan gøre det bedre næste gang.",
];

export const UDESTAAR = "Hvor forbindskassen faktisk hænger, og hvilket telefonnummer naboerne skal have, sætter Lai ind, når stedet er registreret. Indtil da står det her som det, vi har besluttet, og ikke som det, der er hængt op.";

/** Indholdet. Bruges af /mit/aftalt. */
export function aftaltIndhold() {
  const kort = NATTEN.map((n) => `<div${n.loeft ? ' class="loeft"' : ""}>
<p class="sec">${esc(n.sec)}</p>
<p class="small">${esc(n.tekst)}</p>
<p class="meta mt2">${esc(n.meta)}</p>
</div>`).join("\n");

  return `<section class="stage sektion">
<p class="sec">Det, vi har aftalt</p>
<h1 class="stor maxw">Natten.</h1>
<p class="lead maxw mt3">Festivaler, burns og raves er en del af stedet, og vi vil gerne have, at de kan være vilde uden at nogen kommer til skade. Derfor står det her, skrevet ned før den første, så det kan findes igen, når det er tre om natten og nogen har brug for det.</p>
<p class="meta mt3">Aftalt ${esc(AFTALT_OPDATERET)} · tages op efter hver fest med gæster udefra</p>
</section>

<section class="stage">
<div class="g g-2">
${kort}
</div>
</section>

<section class="stage sektion">
<div class="g g-2 nb">
<div>
<p class="sec">Når noget går galt</p>
<ul class="tjek">
${GAAR_GALT.map((l) => `<li><span>${esc(l)}</span></li>`).join("\n")}
</ul>
</div>
<div>
<p class="sec">Det, der stadig mangler</p>
<p class="small soft">${esc(UDESTAAR)}</p>
<p class="meta mt2">Udestår · Lai</p>
</div>
</div>
</section>

<section class="stage blok blok-top">
<div class="maxw">
<p class="sec">Det andet, der gælder</p>
<p class="small">Det står offentligt, og vi gentager det ikke her — en regel, der står to steder, bliver til to regler.</p>
<ul class="liste mt3">
<li><a href="/fundamentet">Sådan beslutter vi</a><span class="r">fagligt mandat, fælles proces, do-ocracy</span></li>
<li><a href="/bliv-en-del">Døren ud</a><span class="r">opsigelse, indskud, timer, uenighed</span></li>
<li><a href="/permakultur">Jorden</a><span class="r">hvad vi passer, og hvornår</span></li>
</ul>
</div>
</section>`;
}
