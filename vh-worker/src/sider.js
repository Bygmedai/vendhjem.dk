import { side, esc, tabel, felt, knap, tomTilstand } from "./flade.js";
import { TEKST } from "./tekst.js";
import { trinlinje, fristTekst } from "./views.js";
import { erAntagelse, kanMarkeresKlar, uopfyldteAdgangskrav } from "./runde.js";

const kr = (n) => (n == null ? TEKST.streg : n.toLocaleString("da-DK") + " kr.");
const dt = (iso) => (iso ? new Date(iso).toLocaleString("da-DK",
  { timeZone: "Europe/Copenhagen", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : TEKST.streg);

export function oversigt({ bruger, sager, org, runder = [] }) {
  const rk = sager.map((s) => {
    const mangler = s.krav - s.opfyldt;
    return `<tr>
<td><a href="/internt/fonde/sag/${esc(s.id)}">${esc(s.titel)}</a>
    <span class="meta" style="display:block;margin-top:4px">${esc(s.fond)} · ${esc(s.runde)}</span></td>
<td>${fristTekst(s)}</td>
<td>${trinlinje(s.status)}</td>
<td>${mangler > 0
      ? `<span class="mangler mono">${TEKST.manglerN(mangler, s.krav)}</span>`
      : `<span class="meta">alle ${s.krav} bilag uploadet</span>`}</td>
<td class="mono">${kr(s.beloeb_ansoegt)}</td>
<td>${esc(s.ansvarlig_navn || TEKST.streg)}<span class="meta" style="display:block;margin-top:4px">${esc(s.naeste_handling || "")}</span></td>
</tr>`;
  });

  const rundeRk = runder.map((c) => `<tr>
<td><a href="/internt/fonde/runde/${esc(c.id)}">${esc(c.fond)}</a>
  <span class="meta" style="display:block;margin-top:4px">${esc(c.navn)}</span></td>
<td>${fristTekst(c)}</td>
<td>${c.frist_ordlyd ? `«${esc(c.frist_ordlyd)}»` : TEKST.streg}</td>
<td class="mono">${esc(c.kravtal ?? 0)}</td>
</tr>`);

  return side({
    titel: "Fonde", aktiv: "fonde", bruger,
    indhold: `
<section class="stage blok">
<p class="sec">Fonde</p>
<h1>Ansøgninger og frister</h1>
<p class="lead maxw mt2">Én sag pr. ansøgning. Fristen er fondens, ikke vores — den interne afleveringsfrist står inde i sagen.</p>
<p class="mt3"><a href="/internt/fonde/ny">Læg en runde ind</a></p>
</section>

<section class="stage">
${tabel({ hoved: ["Sag", "Fondens frist", "Status", "Bilag", "Ansøgt", "Ansvarlig"], raekker: rk })}
</section>

<section class="stage blok sektion">
<p class="sec">Runder</p>
${tabel({ hoved: ["Fond", "Frist", "Kildens ordlyd", "Krav"], raekker: rundeRk, tom: "Ingen runder endnu." })}
</section>

<section class="stage blok sektion">
<div class="g g-2 nb nbb">
<div>
<p class="sec">Ansøger</p>
<p class="v">${esc(org?.navn || "Ikke oprettet")}</p>
<p class="small mt1">${org?.cvr
      ? `CVR ${esc(org.cvr)}`
      : `<span class="mangler">Intet CVR — status: ${esc(org?.cvr_status || TEKST.ukendt)}</span>`}</p>
<p class="small soft mt1">${esc(org?.tegningsregel || "Tegningsregel ikke registreret.")}</p>
<p class="small mt2">Fonde.dk: ${esc(org?.fondedk_status || "uafklaret")}. Ikke verificeret — afventer CVR. Vi scraper ikke Fonde.dk. <a href="/internt/fonde/ny">Skriv svaret</a></p>
</div>
<div class="loeft">
<p class="meta-500 meta-s">Det, værktøjet ikke gør</p>
<p class="small mt1">Det indsender ikke for jer. Et menneske logger ind med MitID på fondens portal og lægger kvitteringen her bagefter. En eksport er ikke en indsendelse.</p>
</div>
</div>
</section>`,
  });
}

export function sagside({ bruger, s, hash, personer = [], advarsel }) {
  const senesteGodk = s.godkendelser[0];
  const godkGaelder = senesteGodk && senesteGodk.pakke_hash === hash && senesteGodk.beslutning === "godkendt";
  const manglerListe = s.krav.filter((k) => k.paakraevet && k.dokumenter.length === 0);
  const klarOk = kanMarkeresKlar(s.krav);
  const bloker = uopfyldteAdgangskrav(s.krav);

  const kravRk = s.krav.map((k) => `<tr>
<td>${esc(k.label)}${k.paakraevet ? "" : ` <span class="meta">frivilligt</span>`}
    <span class="meta" style="display:block;margin-top:4px">${k.slags === "vurderingskriterium" ? TEKST.vurdering : TEKST.adgangskrav}</span>
    ${erAntagelse(k)
      ? `<span class="mangler" style="display:block;margin-top:4px">${TEKST.antagelse}${k.kilde ? ` · ${esc(k.kilde)}` : ""}</span>`
      : k.kilde ? `<span class="meta" style="display:block;margin-top:4px">Kilde: ${esc(k.kilde)}</span>` : ""}
    ${k.note ? `<p class="small soft mt1">${esc(k.note)}</p>` : ""}
    ${k.slags !== "vurderingskriterium" && s.status !== "indsendt" ? `
    <form method="post" action="/internt/fonde/sag/${esc(s.id)}/adgang" class="mt1">
      <input type="hidden" name="krav" value="${esc(k.id)}">
      ${felt({ name: "adgang", value: k.adgang || "uafklaret", options: [
        { value: "uafklaret", label: "Adgang uafklaret" },
        { value: "opfyldt", label: "Adgang opfyldt" },
        { value: "ikke_opfyldt", label: "Adgang ikke opfyldt" },
      ] })}
      ${knap({ label: "Sæt", stil: "margin-top:4px" })}
    </form>` : k.slags !== "vurderingskriterium" ? `<p class="meta mt1">Adgang: ${esc(k.adgang || "uafklaret")}</p>` : ""}</td>
<td>${k.dokumenter.length
    ? k.dokumenter.map((d2) => `<a href="/internt/fonde/fil/${esc(d2.id)}">${esc(d2.filnavn)}</a>
        <span class="meta" style="display:block">${(d2.bytes / 1024).toFixed(0)} kB · ${dt(d2.uploadet)} · ${esc(d2.uploadet_af)}</span>`).join("<br>")
    : `<span class="mangler mono">${TEKST.mangler}</span>`}</td>
<td>${k.kontrolleret
    ? `<span class="meta">kontrolleret ${dt(k.kontrolleret)}<br>${esc(k.kontrolleret_af || "")}</span>`
    : k.dokumenter.length
      ? `<form method="post" action="/internt/fonde/sag/${esc(s.id)}/kontroller" style="margin:0">
           <input type="hidden" name="krav" value="${esc(k.id)}">
           ${knap({ label: "Markér kontrolleret" })}</form>`
      : `<span class="meta">${TEKST.streg}</span>`}</td>
<td><form method="post" action="/internt/fonde/sag/${esc(s.id)}/upload" enctype="multipart/form-data" style="margin:0">
  <input type="hidden" name="krav" value="${esc(k.id)}">
  <input type="file" name="fil" required style="font-size:12px;max-width:180px">
  ${knap({ label: "Upload", stil: "margin-top:8px" })}</form></td>
</tr>`);

  const folk = [
    { value: "", label: TEKST.streg },
    ...personer.map((p) => ({ value: p.id, label: p.navn })),
  ];

  return side({
    titel: s.titel, aktiv: "fonde", bruger,
    indhold: `
${advarsel ? `<section class="stage" style="padding-top:18px"><div class="ramme" style="border-color:var(--accent)">
<p class="meta-s" style="color:var(--accent)">Bemærk</p><p class="small mt1">${esc(advarsel)}</p></div></section>` : ""}

<section class="stage blok">
<p class="sec"><a href="/internt/fonde/">Fonde</a> / ${esc(s.fond)}</p>
<h1>${esc(s.titel)}</h1>
<div class="mt3">${trinlinje(s.status)}</div>
</section>

<section class="stage">
<div class="g g-3 nb">
<div><p class="meta-s">Fondens frist</p><p class="v mt1">${fristTekst(s)}</p>
  ${s.frist_ordlyd ? `<p class="small soft mt1">Ordlyd: «${esc(s.frist_ordlyd)}»</p>` : ""}
  ${s.frist_kilde_url ? `<p class="meta mt1"><a href="${esc(s.frist_kilde_url)}">Kilde</a> · set ${dt(s.frist_verificeret)}</p>` : ""}
  ${s.frist_note ? `<p class="small mangler mt1">${esc(s.frist_note)}</p>` : ""}</div>
<div><p class="meta-s">Intern afleveringsfrist</p><p class="v mt1">${s.intern_frist ? dt(s.intern_frist) : `<span class="mangler">ikke sat</span>`}</p>
  <p class="small soft mt1">Vores egen, tidligere end fondens. Den er der, så en fejl i sidste øjeblik ikke koster ansøgningen.</p></div>
<div class="loeft"><p class="meta-s">Bilag</p>
  <p class="v mt1">${manglerListe.length ? `<span class="mangler">${manglerListe.length} ${TEKST.mangler}</span>` : "Alle påkrævede er uploadet"}</p>
  ${manglerListe.length ? `<p class="small soft mt1">${manglerListe.map((k) => esc(k.label)).join(" · ")}</p>` : ""}</div>
</div>
</section>

<section class="stage blok sektion">
<p class="sec">Sagens felter</p>
<form method="post" action="/internt/fonde/sag/${esc(s.id)}/gem">
<div class="g g-2 nb" style="background:transparent;border:0;gap:28px">
<div style="padding:0">
  ${felt({ label: "Ansøgt beløb (hele kroner)", name: "beloeb", type: "number", value: s.beloeb_ansoegt ?? "", placeholder: "ikke fastlagt" })}
  ${felt({ label: "Ansvarlig", name: "ansvarlig", value: s.ansvarlig || "", options: folk, klasse: "mt2" })}
  ${felt({ label: "Intern afleveringsfrist", name: "intern_frist", type: "datetime-local", value: s.intern_frist ? s.intern_frist.slice(0, 16) : "", klasse: "mt2" })}
</div>
<div style="padding:0">
  ${felt({ label: "Næste handling", name: "naeste", type: "textarea", value: s.naeste_handling || "" })}
  <p class="mt2">${knap({ label: TEKST.gem })}</p>
</div>
</div>
</form>
</section>

<section class="stage blok sektion">
<p class="sec">Bilagscheckliste</p>
<p class="small soft maxw">Uploadet er ikke det samme som kontrolleret. Et menneske skal se filen og sige god for den, før den tæller.</p>
${tabel({ hoved: ["Krav", "Fil", "Kontrol", "Tilføj"], raekker: kravRk, klasse: "mt3" })}
</section>

<section class="stage blok sektion">
<p class="sec">Klar og arkiv</p>
${!klarOk
  ? `<p class="small mangler maxw">${TEKST.klarBlokeret} ${esc(bloker.map((k) => k.label).join(" · "))}</p>`
  : s.status === "kladde"
    ? `<form method="post" action="/internt/fonde/sag/${esc(s.id)}/klar">${knap({ label: TEKST.markerKlar, accent: true })}</form>
       <p class="meta mt2">Klar betyder at adgangskravene ikke er bekræftet uopfyldt. Vurderingskriterier diskvalificerer ikke.</p>`
    : `<p class="small soft">Status: ${esc(s.status)}</p>`}
${s.status !== "indsendt" && s.status !== "arkiveret" ? `
<form method="post" action="/internt/fonde/sag/${esc(s.id)}/arkiver" class="mt3">
${knap({ label: TEKST.arkiver })}
</form>
<p class="meta mt2">Arkiv er tilladt, også når et adgangskrav er uopfyldt.</p>` : ""}
</section>

<section class="stage blok sektion">
<p class="sec">Godkendelse</p>
${senesteGodk ? `<div class="ramme ramme-loeft">
<p class="meta-s">Seneste beslutning</p>
<p class="small mt1"><strong>${esc(senesteGodk.beslutning)}</strong> af ${esc(senesteGodk.aktoer)}, ${dt(senesteGodk.besluttet)}</p>
${senesteGodk.kommentar ? `<p class="small mt1">«${esc(senesteGodk.kommentar)}»</p>` : ""}
<p class="meta mt2">Pakke ${esc(senesteGodk.pakke_hash.slice(0, 12))}…</p>
${!godkGaelder && senesteGodk.beslutning === "godkendt"
    ? `<p class="small mangler mt2">Pakken er ændret siden godkendelsen. Den gælder ikke for det, der ligger nu (${esc(hash.slice(0, 12))}…). Der skal godkendes igen.</p>` : ""}
</div>` : tomTilstand(TEKST.ingenBeslutning, "small soft")}

${s.status !== "indsendt" ? `
<form method="post" action="/internt/fonde/sag/${esc(s.id)}/godkend" class="mt3" style="max-width:640px">
${felt({ label: "Kommentar", name: "kommentar", type: "textarea", placeholder: "Hvad ligger der i beslutningen" })}
<p class="mt2">
${knap({ label: "Godkend pakken", accent: true, name: "beslutning", value: "godkendt" })}
${knap({ label: "Afvis", name: "beslutning", value: "afvist", stil: "margin-left:10px" })}
</p>
<p class="meta mt2">Beslutningen bindes til pakke ${esc(hash.slice(0, 12))}… Ændres bilag eller beløb bagefter, skal der godkendes igen.</p>
</form>` : ""}
</section>

<section class="stage blok sektion">
<p class="sec">Indsendelse</p>
${s.indsendelser.length ? s.indsendelser.map((i) => `<div class="ramme">
<p class="small"><strong>${i.historisk ? "Historisk indsendelse" : "Indsendt"}</strong> ${dt(i.indsendt)} af ${esc(i.indsendt_af)}</p>
${i.ekstern_ref ? `<p class="meta mt1">Reference: ${esc(i.ekstern_ref)}</p>` : `<p class="meta mangler mt1">Ingen kvitteringsreference registreret</p>`}
${i.note ? `<p class="small mt1">${esc(i.note)}</p>` : ""}
</div>`).join("") : `
${godkGaelder ? `
<p class="small soft maxw">Pakken er godkendt. Et menneske indsender på fondens portal med MitID og registrerer kvitteringen her bagefter.</p>
<form method="post" action="/internt/fonde/sag/${esc(s.id)}/indsendt" enctype="multipart/form-data" class="mt3" style="max-width:640px">
${felt({ label: "Ekstern reference fra portalen", name: "ref", placeholder: "fx journalnummer" })}
<p class="felt-label meta-s mt2">Kvittering (fil)</p>
<input type="file" name="kvittering" style="font-size:13px">
<p class="mt3">${knap({ label: "Registrér som indsendt", accent: true })}</p>
<p class="meta mt2">Uden faktisk indsendelsestid og kvittering står sagen som afventende dokumentation. En PDF-download er ikke en indsendelse.</p>
</form>` : tomTilstand(TEKST.kanIkkeIndsende, "small soft")}`}
${s.status !== "indsendt" ? `
<form method="post" action="/internt/fonde/sag/${esc(s.id)}/historisk" class="mt3" style="max-width:640px">
${felt({ label: "Historisk reference", name: "ref", placeholder: "fx journalnummer fra dengang" })}
${felt({ label: "Note", name: "note", type: "textarea", placeholder: "Hvor og hvornår det blev sendt" })}
<p class="mt2">${knap({ label: TEKST.historiskIndsend })}</p>
<p class="meta mt2">Til sager der allerede er sendt uden for værktøjet. Blokeres ikke af uopfyldte adgangskrav.</p>
</form>` : ""}
</section>

<section class="stage blok sektion">
<p class="sec">Aktivitet</p>
<div class="mt2">${s.log.map((l) => `<div class="logl">
<span>${esc(l.aktoer)} · ${esc(l.handling)}${l.detalje ? " · " + esc(l.detalje) : ""}</span>
<span>${dt(l.tidspunkt)}</span></div>`).join("") || tomTilstand(TEKST.tomAktivitet, "small soft")}</div>
</section>`,
  });
}
