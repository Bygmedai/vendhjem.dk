// Vagter — et tidspunkt med pladser (BYG-583)
//
// HVORFOR KORTET TEGNES HER OG IKKE TO STEDER
//
// Vagten vises to steder: på /mit, hvor man skriver sig på, og på
// /internt/vagter, hvor man opretter dem og ser hvem der står på. Tegnes den
// to steder, driver de fra hinanden, og en dag siger den ene «to pladser
// tilbage», mens den anden siger «fuld». Det er samme fejlklasse som reglerne,
// der stod to steder i Natten.
//
// DÆKNINGEN STÅR SOM TAL, IKKE SOM FARVE
//
// «tre af fem pladser · mangler to» kan læses i sollys på en telefon med en
// ridset skærm, af en der lige har sat en trillebør fra sig. En rød prik kan
// den ikke. Farven ligger ovenpå som hjælp, aldrig som den eneste besked.
//
// INGEN RANGLISTE
//
// Hvem der står på hvad er synligt. Hvem der står på mest er ikke en side, og
// bliver det ikke. Fundamentet siger, at intet niveau afgør, hvad nogen er
// værd, og en liste sorteret efter antal vagter er præcis den påstand.

import { esc, knap } from "./flade.js";
import { TEKST } from "./tekst.js";

const MDR = ["januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december"];
const DAGE = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

export function vagtDato(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso || "");
  return `${DAGE[d.getUTCDay()]} ${d.getUTCDate()}. ${MDR[d.getUTCMonth()]}`;
}

/** «16-19», «fra 16», eller ingenting. Et tomt klokkeslæt er ikke «00:00». */
export function vagtTid(fra, til) {
  const f = (fra || "").slice(0, 5);
  const t = (til || "").slice(0, 5);
  if (f && t) return `${f}–${t}`;
  if (f) return `fra ${f}`;
  if (t) return `til ${t}`;
  return "";
}

/**
 * Dækningen i ord.
 *
 * Tre tilstande, tre sætninger. «mangler én» og ikke «mangler 1», fordi det
 * er sådan et menneske siger det, og fordi et ettal alene ligner en fejl.
 */
export function daekning({ paa_antal, pladser, mangler }) {
  const tal = TEKST.vagtDaekning(paa_antal, pladser);
  if (mangler <= 0) return { tekst: `${tal} · ${TEKST.vagtDaekket}`, mangler: false };
  return { tekst: tal, mangel: TEKST.vagtMangler(mangler), mangler: true };
}

/**
 * Ét kort. `handling` er den knap, fladen vil have på — /mit giver en
 * på/af-knap, /internt giver ingen.
 */
export function vagtKort(v, { handling = "", ekstra = "" } = {}) {
  const d = daekning(v);
  const tid = vagtTid(v.fra, v.til);
  return `<div class="ramme mt3">
<p class="meta-s">${esc(vagtDato(v.dato))}${tid ? ` · ${esc(tid)}` : ""}</p>
<p class="small mt1"><strong>${esc(v.hvad)}</strong>${
    v.jeg_staar_paa ? ` <span class="tag">${esc(TEKST.vagtDuErPaa)}</span>` : ""
  }</p>
${v.hvor ? `<p class="meta mt1">${esc(v.hvor)}</p>` : ""}
<p class="meta mt1">${esc(d.tekst)}${
    d.mangler ? ` <span class="tag tag-accent">${esc(d.mangel)}</span>` : ""
  }</p>
${v.note ? `<p class="xs soft mt1">${esc(v.note)}</p>` : ""}
${ekstra}
${handling ? `<div class="mt2">${handling}</div>` : ""}
</div>`;
}

/**
 * Knappen på /mit. Én vej ind, én vej ud, og ingen knap på en fuld vagt, man
 * ikke står på — en knap, der svarer nej, er værre end ingen knap.
 */
export function vagtKnap(v) {
  if (v.jeg_staar_paa) {
    return `<form method="post" action="/mit/vagter/${esc(v.id)}/af">${
      knap({ label: TEKST.vagtAf })}</form>`;
  }
  if (v.mangler <= 0) {
    return `<p class="xs soft">${esc(TEKST.vagtFuld)}</p>`;
  }
  return `<form method="post" action="/mit/vagter/${esc(v.id)}/paa">${
    knap({ label: TEKST.vagtPaa, accent: true })}</form>`;
}

/**
 * De nærmeste vagter på «Nu».
 *
 * Kun tre. «Nu» er en skærm, man kigger på i et halvt minut, ikke en kalender.
 * Resten ligger et klik væk, og den, der vil planlægge sin uge, klikker.
 */
export function vagterNu(vagter) {
  if (!vagter.length) {
    return `<div class="mt4">
<p class="meta-s">${esc(TEKST.vagter)}</p>
<p class="small mt1">${esc(TEKST.vagterTomNu)}</p>
</div>`;
  }
  const tre = vagter.slice(0, 3);
  return `<div class="mt4">
<p class="meta-s">${esc(TEKST.vagter)}</p>
${tre.map((v) => vagtKort(v, { handling: vagtKnap(v) })).join("")}
${vagter.length > tre.length
    ? `<p class="meta mt3"><a href="/mit/vagter">${esc(TEKST.vagtAlle)}</a></p>` : ""}
</div>`;
}

/** Hele listen på /mit/vagter. */
export function vagterSide(vagter, besked) {
  const b = besked
    ? `<p class="small mt3"${besked.ok ? "" : ' style="color:var(--accent)"'}>${esc(besked.t)}</p>`
    : "";
  return `<section class="stage sektion">
<p class="sec">${esc(TEKST.vagter)}</p>
<h1 class="stor maxw">${esc(TEKST.vagterNuH)}</h1>
<p class="lead maxw mt3">${esc(TEKST.vagterLead)}</p>
${b}
${vagter.length
    ? vagter.map((v) => vagtKort(v, { handling: vagtKnap(v) })).join("")
    : `<p class="small mt4">${esc(TEKST.vagterTomNu)}</p>`}
<p class="xs soft mt4">${esc(TEKST.vagtIngenRangliste)}</p>
<p class="meta mt3"><a href="/mit">${esc(TEKST.vagtTilbage)}</a></p>
</section>`;
}
