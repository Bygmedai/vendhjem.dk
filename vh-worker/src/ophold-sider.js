// Ophold-flader. Intern liste/sag bruger flade.js. Offentlig /sporene
// bruger samme klasser som build.py — ikke intern-flade.

import { side, esc, tabel, felt, knap, statusPil, tomTilstand } from "./flade.js";
import { TEKST } from "./tekst.js";

const kr = (n) => (n == null ? null : n.toLocaleString("da-DK") + " kr.");

export function datoTekst(iso) {
  if (!iso) return TEKST.streg;
  return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric", month: "long", year: "numeric",
  });
}

export function periodeTekst(start, slut) {
  if (!start || !slut) return TEKST.streg;
  if (start === slut) return datoTekst(start);
  return `${datoTekst(start)} – ${datoTekst(slut)}`;
}

const OPHOLD_TRIN = [
  { id: "planlagt", label: "Planlagt" },
  { id: "åben", label: "Åben" },
  { id: "fuld", label: "Fuld" },
  { id: "lukket", label: "Lukket" },
  { id: "afholdt", label: "Afholdt" },
];

const STATUS_FELTER = OPHOLD_TRIN.map((t) => ({ value: t.id, label: t.label }));

const PLADS_STATUS = [
  { value: "forespurgt", label: "Forespurgt" },
  { value: "bekræftet", label: "Bekræftet" },
  { value: "betalt", label: "Betalt" },
  { value: "afbudt", label: "Afbudt" },
];

const SPOR_LINKS = {
  mandegrupper: { href: "/maend", label: "Sådan ligger en weekend →" },
};

export function opholdOversigt({ bruger, liste, typer, advarsel }) {
  const rk = liste.map((o) => `<tr>
<td><a href="/internt/ophold/${esc(o.id)}">${esc(o.type_navn)}</a>
  <span class="meta" style="display:block;margin-top:4px">${esc(o.hele_stedet ? "hele stedet" : "kan deles")}</span></td>
<td>${esc(periodeTekst(o.start_dato, o.slut_dato))}</td>
<td>${statusPil(OPHOLD_TRIN, o.status)}</td>
<td class="mono">${o.optaget}/${o.kapacitet}</td>
<td class="mono">${esc(kr(o.pris ?? o.pris_fra) || TEKST.streg)}</td>
</tr>`);

  const typeValg = typer.map((t) => ({ value: t.id, label: t.navn }));

  return side({
    titel: "Ophold", aktiv: "ophold", bruger,
    indhold: `
${advarsel ? `<section class="stage" style="padding-top:18px"><div class="ramme" style="border-color:var(--accent)">
<p class="meta-s" style="color:var(--accent)">Bemærk</p><p class="small mt1">${esc(advarsel)}</p></div></section>` : ""}

<section class="stage blok">
<p class="sec">Ophold</p>
<h1>Kalenderen over det, der sker på stedet</h1>
<p class="lead maxw mt2">Et ophold er et dato-interval af et spor. Datoerne er inklusive: to eksklusive ophold må ikke dele en dag; dagen efter er fri. Hele stedet udlejet blokerer alt andet i perioden — databasen nægter, fladen advarer ikke bare.</p>
</section>

<section class="stage">
${tabel({
  hoved: ["Type", "Datoer", "Status", "Pladser", "Pris"],
  raekker: rk,
  tom: TEKST.tomOphold,
})}
</section>

<section class="stage blok sektion">
<p class="sec">${esc(TEKST.opretOphold)}</p>
<form method="post" action="/internt/ophold/opret" style="max-width:640px">
<div class="g g-2 nb" style="background:transparent;border:0;gap:28px">
<div style="padding:0">
  ${felt({ label: "Spor", name: "type_id", value: typeValg[0]?.value || "", options: typeValg })}
  ${felt({ label: "Fra", name: "start_dato", type: "date", required: true, klasse: "mt2" })}
  ${felt({ label: "Til", name: "slut_dato", type: "date", required: true, klasse: "mt2" })}
</div>
<div style="padding:0">
  ${felt({ label: "Kapacitet", name: "kapacitet", type: "number", value: "15", required: true })}
  ${felt({ label: "Status", name: "status", value: "planlagt", options: STATUS_FELTER, klasse: "mt2" })}
  ${felt({ label: "Pris (hele kroner, tom = typens)", name: "pris", type: "number", placeholder: "ikke sat", klasse: "mt2" })}
  <p class="mt3">${knap({ label: TEKST.opretOphold, accent: true })}</p>
</div>
</div>
</form>
</section>`,
  });
}

export function opholdSide({ bruger, o, personer, advarsel }) {
  const folk = [
    { value: "", label: TEKST.streg },
    ...personer.map((p) => ({ value: p.id, label: p.navn })),
  ];
  const pladsRk = o.pladser.map((p) => `<tr>
<td>${esc(p.person_navn)}<span class="meta" style="display:block;margin-top:4px">${esc(p.person_mail || "")}</span></td>
<td>${esc(PLADS_STATUS.find((s) => s.value === p.status)?.label || p.status)}</td>
<td class="mono">${esc(kr(p.pris) || TEKST.streg)}</td>
<td><form method="post" action="/internt/ophold/${esc(o.id)}/plads/${esc(p.id)}/status" style="margin:0">
  ${p.status === "afbudt" ? `<span class="meta">${TEKST.streg}</span>` : knap({ label: "Afbud", name: "status", value: "afbudt" })}
</form></td>
</tr>`);

  return side({
    titel: o.type_navn, aktiv: "ophold", bruger,
    indhold: `
${advarsel ? `<section class="stage" style="padding-top:18px"><div class="ramme" style="border-color:var(--accent)">
<p class="meta-s" style="color:var(--accent)">Bemærk</p><p class="small mt1">${esc(advarsel)}</p></div></section>` : ""}

<section class="stage blok">
<p class="sec"><a href="/internt/ophold/">Ophold</a> / ${esc(o.type_navn)}</p>
<h1>${esc(periodeTekst(o.start_dato, o.slut_dato))}</h1>
<div class="mt3">${statusPil(OPHOLD_TRIN, o.status)}</div>
<p class="small soft mt2">${o.optaget} af ${o.kapacitet} pladser · ${o.hele_stedet ? "hele stedet" : "kan ligge samtidig med andet"}</p>
</section>

<section class="stage blok sektion">
<p class="sec">Opholdets felter</p>
<form method="post" action="/internt/ophold/${esc(o.id)}/gem">
<div class="g g-2 nb" style="background:transparent;border:0;gap:28px">
<div style="padding:0">
  ${felt({ label: "Fra", name: "start_dato", type: "date", value: o.start_dato, required: true })}
  ${felt({ label: "Til", name: "slut_dato", type: "date", value: o.slut_dato, required: true, klasse: "mt2" })}
  ${felt({ label: "Kapacitet", name: "kapacitet", type: "number", value: o.kapacitet, required: true, klasse: "mt2" })}
</div>
<div style="padding:0">
  ${felt({ label: "Status", name: "status", value: o.status, options: STATUS_FELTER })}
  ${felt({ label: "Pris (hele kroner)", name: "pris", type: "number", value: o.pris ?? "", placeholder: "typens fra-beløb", klasse: "mt2" })}
  ${felt({ label: "Note", name: "note", type: "textarea", value: o.note || "", klasse: "mt2" })}
  <p class="mt2">${knap({ label: TEKST.gem })}</p>
</div>
</div>
</form>
</section>

<section class="stage blok sektion">
<p class="sec">Pladser</p>
${tabel({ hoved: ["Person", "Status", "Pris", ""], raekker: pladsRk, tom: TEKST.tomPladser, klasse: "mt2" })}
<form method="post" action="/internt/ophold/${esc(o.id)}/plads" class="mt3" style="max-width:640px">
${felt({ label: "Person", name: "person_id", value: "", options: folk })}
${felt({ label: "Status", name: "status", value: "bekræftet", options: PLADS_STATUS, klasse: "mt2" })}
${felt({ label: "Pris (hele kroner)", name: "pris", type: "number", value: o.pris ?? o.pris_fra ?? "", klasse: "mt2" })}
<p class="mt3">${knap({ label: "Tilføj plads", accent: true })}</p>
</form>
</section>`,
  });
}

function prisLinje(t) {
  const beloeb = kr(t.pris_fra);
  if (beloeb) {
    const rest = t.pris_note ? ` · ${t.pris_note}` : "";
    return `${beloeb}${rest}`;
  }
  return t.pris_note || "Prisen er ikke sat endnu.";
}

export function sporeneSide({ typer, aabne, lukkede }) {
  const kort = typer.filter((t) => t.spor !== "lukket").map((t) => {
    const dates = aabne.filter((o) => o.type_id === t.id);
    const loeft = t.spor === "mandegrupper" ? ' class="loeft"' : "";
    const datoHtml = dates.length
      ? dates.map((o) => {
        const p = kr(o.vis_pris);
        const fuld = o.status === "fuld" ? " · fuld" : "";
        return `<p class="meta mt1">${esc(periodeTekst(o.start_dato, o.slut_dato))}${p ? ` · ${p}` : ""}${fuld}</p>`;
      }).join("")
      : `<p class="meta mt2">${esc(TEKST.ingenDatoerSpor)}</p>`;
    const link = SPOR_LINKS[t.spor];
    return `<div${loeft}>
<p class="sec">${esc(t.navn)}</p>
<p class="small">${esc(t.beskrivelse || "")}</p>
<p class="meta mt2">${esc(prisLinje(t))}</p>
${datoHtml}
${link ? `<p class="mt2"><a class="lnk" href="${esc(link.href)}">${esc(link.label)}</a></p>` : ""}
</div>`;
  }).join("");

  const harDatoer = aabne.length > 0;
  const kalenderLead = harDatoer
    ? ""
    : `<p class="lead maxw mt2">${esc(TEKST.tomKalender)}</p>`;

  const lukketHtml = lukkede.length
    ? lukkede.map((o) => `<p class="meta mt1">${esc(periodeTekst(o.start_dato, o.slut_dato))}</p>`).join("")
    : `<p class="small soft">De står i kalenderen som ro, når ugerne er sat: ingen gæster, intet salg. Et sted, der kan fylde 52 uger, brænder sine ejere af i år ét. Det har vi set før.</p>`;

  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sporene · Vend Hjem</title>
<meta name="description" content="Det, der sker på stedet: mandegrupper og rites of passage, retreats, festival, byg-med-uger, stille uger, campingvogne.">
<link rel="canonical" href="https://vendhjem.dk/sporene">
<meta name="theme-color" content="#e9e7e0">
<link rel="preload" href="/assets/fonts/lora-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/jetbrains-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/vh.css">
</head>
<body>
<header class="site-head">
<div class="stage row">
<a class="brand" href="/">Vend <em>Hjem</em></a>
<nav class="nav" aria-label="Hovedmenu">
<a href="/fundamentet">Fundamentet</a>
<a href="/sporene" aria-current="page">Sporene</a>
<a href="/bliv-en-del">Bliv en del</a>
<a href="https://vendhjem.dk/internt/">Log ind →</a>
</nav>
</div>
</header>
<main>

<section class="stage blok">
<p class="sec">Sporene</p>
<h1>Det, der sker på stedet.</h1>
<p class="lead maxw mt2">To mennesker med hver sit felt og et sted, der kan bære begge. Stevens ti år i mandearbejde og rites of passage. Lais integrale praksis og skuespilmetode.</p>
${kalenderLead}
</section>

<section class="stage">
<div class="g g-2">
${kort}
</div>
</section>

<section class="stage blok">
<div class="maxw">
<p class="sec">Syv uger om året er lukkede</p>
${lukketHtml}
</div>
</section>
</main>
<footer class="site-foot">
<div class="stage row">
<p>Vend Hjem · Agersø · Slagelse Kommune</p>
<p>Udkast · 15. september 2026 · Lederudvikling og foredrag ligger på <a href="https://www.humandirection.dk/">humandirection.dk</a></p>
</div>
</footer>
</body>
</html>`;
}
