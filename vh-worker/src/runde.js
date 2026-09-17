// BYG-568 E2 · Fond og runde. Vi ejer sagerne, ikke katalogerne.
// Frist: kildens ordlyd bevares. Ugedagsfejl rettes aldrig i stilhed.
// Krav uden kilde er antagelse. Adgangskrav kan diskvalificere; vurdering kan ikke.

import { id, nu, log, organisation } from "./db.js";
import { side, esc, tabel, felt, knap, tomTilstand, fejlTilstand } from "./flade.js";
import { TEKST } from "./tekst.js";
import { fristTekst } from "./views.js";

export const FONDE = "/internt/fonde";
export const KRAV_SLAGS = Object.freeze(["adgangskrav", "vurderingskriterium"]);
const KRAV_SAET = new Set(KRAV_SLAGS);
const ADGANG_SAET = new Set(["uafklaret", "opfyldt", "ikke_opfyldt"]);

export const gyldigtKravSlags = (s) => KRAV_SAET.has(s);

/** Tom kilde, eller kilden selv siger ANTAGELSE/UVERIFICERET. */
export function erAntagelse(krav) {
  const k = String(krav?.kilde ?? "").trim();
  if (!k) return true;
  return /ANTAGELSE|UVERIFICERET/i.test(k);
}

export function ugedagIKoebenhavn(utcIso) {
  if (!utcIso) return null;
  const w = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen", weekday: "long",
  }).format(new Date(utcIso));
  return w.toLowerCase();
}

/**
 * Hvis kilden nævner en ugedag der ikke matcher datoen, returnér en note.
 * Ændrer aldrig datoen og aldrig ordlyden.
 */
export function fristUgedagsKonflikt(ordlyd, utcIso) {
  if (!ordlyd || !utcIso) return null;
  const m = String(ordlyd).toLowerCase().match(/\b(søndag|mandag|tirsdag|onsdag|torsdag|fredag|lørdag)\b/);
  if (!m) return null;
  const faktisk = ugedagIKoebenhavn(utcIso);
  if (!faktisk || m[1] === faktisk) return null;
  const dato = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(utcIso));
  return `Kilden skriver «${m[1]}», men ${dato} er en ${faktisk}. Datoen bruges som den står; ugedagen er uafklaret og skal bekræftes. Fristen udskydes ikke på grund af uoverensstemmelsen.`;
}

/**
 * Fortolk datetime-local (YYYY-MM-DDTHH:MM) som Europe/Copenhagen → UTC ISO.
 * Gætter ikke et klokkeslæt, hvis feltet er tomt.
 */
export function lokalTilUtc(local, tz = "Europe/Copenhagen") {
  if (!local || !String(local).trim()) return null;
  const naive = String(local).trim();
  const isoLokal = naive.length === 16 ? `${naive}:00` : naive;
  const utcGuess = new Date(`${isoLokal}Z`);
  if (Number.isNaN(utcGuess.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(utcGuess);
  const g = (t) => parts.find((p) => p.type === t).value;
  const asIfTz = Date.parse(`${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}Z`);
  return new Date(utcGuess.getTime() - (asIfTz - utcGuess.getTime())).toISOString();
}

/** Bekræftet uopfyldt adgangskrav — det der blokerer «klar». */
export function uopfyldteAdgangskrav(krav) {
  return (krav || []).filter((k) =>
    k.slags === "adgangskrav" && k.adgang === "ikke_opfyldt");
}

export function kanMarkeresKlar(krav) {
  return uopfyldteAdgangskrav(krav).length === 0;
}

function slaaNoteSammen(manuel, auto) {
  const a = String(manuel || "").trim();
  const b = String(auto || "").trim();
  if (!b) return a || null;
  if (!a) return b;
  if (a.includes(b) || a.toLowerCase().includes("ugedag") || a.toLowerCase().includes("fredag") || a.toLowerCase().includes("torsdag")) {
    return a;
  }
  return `${a} ${b}`;
}

export async function listerRunder(db) {
  const { results } = await db.prepare(`
    SELECT c.*, f.navn AS fond, f.program, f.url AS fond_url,
           (SELECT COUNT(*) FROM call_requirements r WHERE r.call_id = c.id) AS kravtal
      FROM calls c JOIN funds f ON f.id = c.fund_id
     ORDER BY COALESCE(c.frist_utc, '9999') ASC`).all();
  return results;
}

export async function hentRunde(db, callId) {
  const c = await db.prepare(`
    SELECT c.*, f.navn AS fond, f.program, f.url AS fond_url, f.noter AS fond_noter, f.id AS fund_id
      FROM calls c JOIN funds f ON f.id = c.fund_id WHERE c.id = ?1`
  ).bind(callId).first();
  if (!c) return null;
  const { results } = await db.prepare(
    `SELECT * FROM call_requirements WHERE call_id = ?1 ORDER BY sortering, label`
  ).bind(callId).all();
  return { ...c, krav: results };
}

export async function opretRunde(db, {
  fond_navn, fond_program = null, fond_url = null, fond_noter = null,
  runde_navn, frist_utc = null, frist_ordlyd, frist_kilde_url = null, frist_note = null,
  krav = [], aktoer = "system",
}) {
  const navn = String(fond_navn || "").trim();
  const runde = String(runde_navn || "").trim();
  const ordlyd = String(frist_ordlyd || "").trim();
  if (!navn) throw new Error("Fondens navn mangler.");
  if (!runde) throw new Error("Rundens navn mangler.");
  if (!ordlyd) throw new Error("Fristens ordlyd mangler. Kopiér den som kilden skriver den.");

  const auto = fristUgedagsKonflikt(ordlyd, frist_utc);
  const note = slaaNoteSammen(frist_note, auto);
  const t = nu();
  const fundId = id();
  const callId = id();

  await db.batch([
    db.prepare(`INSERT INTO funds (id, navn, program, url, noter, oprettet) VALUES (?1,?2,?3,?4,?5,?6)`)
      .bind(fundId, navn, fond_program || null, fond_url || null, fond_noter || null, t),
    db.prepare(`INSERT INTO calls (id, fund_id, navn, frist_utc, frist_tz, frist_ordlyd,
                    frist_kilde_url, frist_verificeret, frist_note, oprettet)
                 VALUES (?1,?2,?3,?4,'Europe/Copenhagen',?5,?6,?7,?8,?7)`)
      .bind(callId, fundId, runde, frist_utc, ordlyd, frist_kilde_url || null, t, note),
  ]);

  let n = 0;
  for (const k of krav) {
    const label = String(k.label || "").trim();
    if (!label) continue;
    const slags = gyldigtKravSlags(k.slags) ? k.slags : "adgangskrav";
    const kilde = String(k.kilde || "").trim() || null;
    n += 1;
    await db.prepare(`
      INSERT INTO call_requirements (id, call_id, label, slags, paakraevet, note, kilde, sortering, oprettet)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`
    ).bind(id(), callId, label, slags, k.paakraevet ? 1 : 0, String(k.note || "").trim() || null, kilde, n, t).run();
  }

  await log(db, { aktoer, handling: "lagde runde ind", detalje: `${navn} · ${runde}` });
  return { fundId, callId, frist_note: note };
}

export async function opretSagFraRunde(db, callId, { titel, orgId, ansvarlig = null, aktoer }) {
  const runde = await hentRunde(db, callId);
  if (!runde) throw new Error("Runden findes ikke.");
  const tittel = String(titel || "").trim() || runde.navn;
  const org = orgId || (await organisation(db))?.id;
  if (!org) throw new Error("Ingen organisation.");
  const appId = id();
  const t = nu();
  await db.prepare(`
    INSERT INTO applications (id, org_id, call_id, titel, status, valuta, ansvarlig, oprettet, opdateret)
    VALUES (?1,?2,?3,?4,'kladde','DKK',?5,?6,?6)`
  ).bind(appId, org, callId, tittel, ansvarlig, t).run();

  for (const k of runde.krav) {
    await db.prepare(`
      INSERT INTO requirements (id, application_id, label, paakraevet, note, kilde, sortering, slags, adgang)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'uafklaret')`
    ).bind(id(), appId, k.label, k.paakraevet, k.note, k.kilde, k.sortering, k.slags).run();
  }
  await log(db, { app_id: appId, aktoer, handling: "oprettede sagen", detalje: tittel });
  return appId;
}

export async function saetAdgang(db, kravId, adgang, aktoer) {
  if (!ADGANG_SAET.has(adgang)) throw new Error("Ukendt adgangsstatus.");
  const k = await db.prepare(`SELECT * FROM requirements WHERE id = ?1`).bind(kravId).first();
  if (!k) throw new Error("Kravet findes ikke.");
  await db.prepare(`UPDATE requirements SET adgang = ?2 WHERE id = ?1`).bind(kravId, adgang).run();
  await log(db, { app_id: k.application_id, aktoer, handling: "satte adgangskrav", detalje: `${k.label}: ${adgang}` });
  return k.application_id;
}

export async function saetKlar(db, appId, aktoer) {
  const { results } = await db.prepare(
    `SELECT * FROM requirements WHERE application_id = ?1`
  ).bind(appId).all();
  if (!kanMarkeresKlar(results)) {
    const navne = uopfyldteAdgangskrav(results).map((k) => k.label).join(", ");
    return { ok: false, grund: `Bekræftet uopfyldt adgangskrav: ${navne}. Sagen kan ikke markeres klar.` };
  }
  await db.prepare(`UPDATE applications SET status = 'til_godkendelse', opdateret = ?2 WHERE id = ?1`)
    .bind(appId, nu()).run();
  await log(db, { app_id: appId, aktoer, handling: "markerede sagen klar" });
  return { ok: true };
}

export async function arkiverSag(db, appId, aktoer) {
  await db.prepare(`UPDATE applications SET status = 'arkiveret', opdateret = ?2 WHERE id = ?1`)
    .bind(appId, nu()).run();
  await log(db, { app_id: appId, aktoer, handling: "arkiverede sagen" });
}

export async function historiskIndsendelse(db, appId, { aktoer, ref = null, note = null }) {
  const app = await db.prepare(`SELECT * FROM applications WHERE id = ?1`).bind(appId).first();
  if (!app) throw new Error("Sagen findes ikke.");
  const t = nu();
  await db.batch([
    db.prepare(`INSERT INTO submissions (id, application_id, indsendt, indsendt_af, ekstern_ref, pakke_hash, note, historisk)
                VALUES (?1,?2,?3,?4,?5,'historisk',?6,1)`)
      .bind(id(), appId, t, aktoer, ref, note),
    db.prepare(`UPDATE applications SET status = 'indsendt', opdateret = ?2 WHERE id = ?1`).bind(appId, t),
    db.prepare(`INSERT INTO activity_log (application_id, aktoer, handling, detalje, tidspunkt)
                VALUES (?1,?2,'registrerede historisk indsendelse',?3,?4)`)
      .bind(appId, aktoer, ref || note || "uden reference", t),
  ]);
}

const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

const redirect = (til, besked) =>
  new Response(null, { status: 303, headers: { Location: besked ? `${til}?m=${encodeURIComponent(besked)}` : til } });

function dt(iso) {
  return iso ? new Date(iso).toLocaleString("da-DK", {
    timeZone: "Europe/Copenhagen", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : TEKST.streg;
}

function advarsel(url) {
  const m = url.searchParams.get("m");
  if (!m) return "";
  return `<section class="stage" style="padding-top:18px"><div class="ramme" style="border-color:var(--accent)">
<p class="meta-s" style="color:var(--accent)">Bemærk</p><p class="small mt1">${esc(m)}</p></div></section>`;
}

function kravFraForm(fd) {
  const ud = [];
  for (let i = 0; i < 8; i++) {
    const label = String(fd.get(`krav_label_${i}`) || "").trim();
    if (!label) continue;
    ud.push({
      label,
      slags: String(fd.get(`krav_slags_${i}`) || "adgangskrav"),
      kilde: String(fd.get(`krav_kilde_${i}`) || "").trim(),
      note: String(fd.get(`krav_note_${i}`) || "").trim(),
      paakraevet: fd.get(`krav_paakraevet_${i}`) !== "0",
    });
  }
  return ud;
}

export function nyRundeSide({ bruger, org, advarselHtml = "" }) {
  const kravRk = [];
  for (let i = 0; i < 8; i++) {
    kravRk.push(`<tr>
<td>${felt({ name: `krav_label_${i}`, placeholder: "fx Vedtægter" })}</td>
<td>${felt({ name: `krav_slags_${i}`, value: "adgangskrav", options: [
  { value: "adgangskrav", label: "Adgangskrav" },
  { value: "vurderingskriterium", label: "Vurderingskriterium" },
] })}</td>
<td>${felt({ name: `krav_kilde_${i}`, placeholder: "tom = antagelse" })}</td>
<td>${felt({ name: `krav_note_${i}` })}</td>
</tr>`);
  }

  return side({
    titel: "Ny runde", aktiv: "fonde", bruger,
    indhold: `
${advarselHtml}
<section class="stage blok">
<p class="sec"><a href="${FONDE}/">Fonde</a> / Ny runde</p>
<h1>Læg en fond og en runde ind</h1>
<p class="lead maxw mt2">Fra en ekstern søgning. URL, frist med kildens ordlyd, program og krav. Under fem minutter, hvis kilden er åben.</p>
</section>

<section class="stage blok">
<form method="post" action="${FONDE}/ny" enctype="multipart/form-data">
<p class="sec">Fond</p>
${felt({ label: "Navn", name: "fond_navn", required: true, placeholder: "fx Den Nationale Landdistriktspulje" })}
${felt({ label: "Program", name: "fond_program", placeholder: "fx Småøer" })}
${felt({ label: "URL", name: "fond_url", type: "url" })}
${felt({ label: "Note", name: "fond_noter", type: "textarea" })}

<p class="sec mt4">Runde og frist</p>
${felt({ label: "Rundens navn", name: "runde_navn", required: true, placeholder: "fx 2. runde 2026" })}
${felt({ label: "Frist (dato og klokkeslæt, København)", name: "frist", type: "datetime-local" })}
${felt({ label: "Kildens ordlyd for fristen", name: "frist_ordlyd", required: true, placeholder: "fx torsdag 9. oktober 2026 kl. 15.00" })}
${felt({ label: "Kilde-URL for fristen", name: "frist_kilde_url", type: "url" })}
${felt({ label: "Note til fristen (uoverensstemmelser I allerede kender)", name: "frist_note", type: "textarea" })}
<p class="small soft">Skriv ugedagen som kilden gør. Hvis den ikke passer med datoen, står det som en note. Datoen ændres ikke.</p>

<p class="sec mt4">Vejledning</p>
<p class="felt-label meta-s">Fil</p>
<input type="file" name="vejledning" style="font-size:13px">

<p class="sec mt4">Krav</p>
<p class="small soft maxw">Adgangskrav kan diskvalificere. Vurderingskriterier kan ikke. Uden kilde markeres kravet som antagelse.</p>
${tabel({ hoved: ["Krav", "Slags", "Kilde", "Note"], raekker: kravRk, klasse: "mt2" })}

<p class="sec mt4">Sag</p>
${felt({ label: "Opret også en sag med titlen", name: "sag_titel", placeholder: "tom = kun runden" })}

<p class="mt3">${knap({ label: "Læg ind", accent: true })}</p>
</form>
</section>

<section class="stage blok sektion">
<p class="sec">Fonde.dk via Slagelse Kommune</p>
<p class="small maxw">${esc(org?.fondedk_note || "Status uafklaret. Afventer CVR. Vi scraper ikke Fonde.dk.")}</p>
<p class="meta mt2">Status nu: ${esc(org?.fondedk_status || "uafklaret")}${org?.fondedk_tjekket ? ` · tjekket ${dt(org.fondedk_tjekket)}` : ""}</p>
<form method="post" action="${FONDE}/fondedk" class="mt3" style="max-width:640px">
${felt({ label: "Status", name: "fondedk_status", value: org?.fondedk_status || "afventer_cvr", options: [
  { value: "uafklaret", label: "Uafklaret" },
  { value: "afventer_cvr", label: "Afventer CVR" },
  { value: "har_adgang", label: "Har adgang" },
  { value: "ingen_adgang", label: "Ingen adgang" },
] })}
${felt({ label: "Svar fra kommunen (menneskets note)", name: "fondedk_note", type: "textarea", value: org?.fondedk_note || "" })}
<p class="mt2">${knap({ label: TEKST.gem })}</p>
</form>
</section>`,
  });
}

export function rundeSide({ bruger, runde, advarselHtml = "" }) {
  const kravRk = runde.krav.map((k) => `<tr>
<td>${esc(k.label)}${k.paakraevet ? "" : ` <span class="meta">frivilligt</span>`}
  ${k.note ? `<p class="small soft mt1">${esc(k.note)}</p>` : ""}</td>
<td>${esc(k.slags === "vurderingskriterium" ? "Vurdering" : "Adgangskrav")}</td>
<td>${erAntagelse(k)
    ? `<span class="mangler">antagelse</span>${k.kilde ? `<span class="meta" style="display:block;margin-top:4px">${esc(k.kilde)}</span>` : ""}`
    : esc(k.kilde)}</td>
</tr>`);

  return side({
    titel: runde.navn, aktiv: "fonde", bruger,
    indhold: `
${advarselHtml}
<section class="stage blok">
<p class="sec"><a href="${FONDE}/">Fonde</a> / ${esc(runde.fond)}</p>
<h1>${esc(runde.navn)}</h1>
<p class="small mt2">${esc(runde.program || "")}${runde.fond_url ? ` · <a href="${esc(runde.fond_url)}">kilde</a>` : ""}</p>
</section>

<section class="stage">
<div class="g g-2 nb">
<div><p class="meta-s">Fondens frist</p><p class="v mt1">${fristTekst(runde)}</p>
  ${runde.frist_ordlyd ? `<p class="small soft mt1">Ordlyd: «${esc(runde.frist_ordlyd)}»</p>` : ""}
  ${runde.frist_kilde_url ? `<p class="meta mt1"><a href="${esc(runde.frist_kilde_url)}">Kilde</a></p>` : ""}
  ${runde.frist_note ? `<p class="small mangler mt1">${esc(runde.frist_note)}</p>` : ""}</div>
<div class="loeft"><p class="meta-s">Vejledning</p>
  <p class="v mt1">${runde.vejledning_filnavn ? esc(runde.vejledning_filnavn) : `<span class="mangler">ikke lagt ind</span>`}</p></div>
</div>
</section>

<section class="stage blok sektion">
<p class="sec">Krav på runden</p>
${tabel({ hoved: ["Krav", "Slags", "Kilde"], raekker: kravRk, tom: "Ingen krav endnu." })}
<form method="post" action="${FONDE}/runde/${esc(runde.id)}/krav" class="mt3" style="max-width:640px">
<p class="meta-s">Tilføj krav</p>
${felt({ label: "Krav", name: "label", required: true })}
${felt({ label: "Slags", name: "slags", value: "adgangskrav", options: [
  { value: "adgangskrav", label: "Adgangskrav" },
  { value: "vurderingskriterium", label: "Vurderingskriterium" },
] })}
${felt({ label: "Kilde (tom = antagelse)", name: "kilde" })}
${felt({ label: "Note", name: "note" })}
<p class="mt2">${knap({ label: "Tilføj" })}</p>
</form>
</section>

<section class="stage blok sektion">
<p class="sec">Opret sag</p>
<form method="post" action="${FONDE}/runde/${esc(runde.id)}/sag" style="max-width:640px">
${felt({ label: "Titel", name: "titel", value: runde.navn })}
<p class="mt2">${knap({ label: "Opret sag", accent: true })}</p>
<p class="meta mt2">Kravene kopieres ind på sagen. Slags og kilder følger med.</p>
</form>
</section>`,
  });
}

export async function haandterRunde(request, { db, r2, bruger, url, sti }) {
  const advarselHtml = advarsel(url);

  if (request.method === "GET" && sti === `${FONDE}/ny`) {
    const org = await organisation(db);
    return html(nyRundeSide({ bruger, org, advarselHtml }));
  }

  const mRunde = sti.match(new RegExp(`^${FONDE}/runde/([A-Za-z0-9_-]{4,64})$`));
  if (request.method === "GET" && mRunde) {
    const runde = await hentRunde(db, mRunde[1]);
    if (!runde) return html("Runden findes ikke.", 404);
    return html(rundeSide({ bruger, runde, advarselHtml }));
  }

  if (request.method === "POST" && sti === `${FONDE}/ny`) {
    if (!bruger.menneske) {
      return html(side({
        titel: TEKST.ingenAdgang, aktiv: "fonde", bruger,
        indhold: fejlTilstand({ titel: TEKST.ingenAdgang, lead: TEKST.ingenAdgangH1, broed: TEKST.ingenAdgangLead }),
      }), 403);
    }
    const fd = await request.formData();
    const frist_utc = lokalTilUtc(fd.get("frist"));
    let callId;
    try {
      const r = await opretRunde(db, {
        fond_navn: fd.get("fond_navn"),
        fond_program: fd.get("fond_program"),
        fond_url: fd.get("fond_url"),
        fond_noter: fd.get("fond_noter"),
        runde_navn: fd.get("runde_navn"),
        frist_utc,
        frist_ordlyd: fd.get("frist_ordlyd"),
        frist_kilde_url: fd.get("frist_kilde_url"),
        frist_note: fd.get("frist_note"),
        krav: kravFraForm(fd),
        aktoer: bruger.navn,
      });
      callId = r.callId;
    } catch (e) {
      return redirect(`${FONDE}/ny`, e.message);
    }

    const vej = fd.get("vejledning");
    if (vej && typeof vej !== "string" && vej.size > 0) {
      if (vej.size > 25 * 1024 * 1024) return redirect(`${FONDE}/runde/${callId}`, "Filen er større end 25 MB.");
      const key = `runde/${callId}/${vej.name}`;
      await r2.put(key, await vej.arrayBuffer(), { httpMetadata: { contentType: vej.type || "application/octet-stream" } });
      await db.prepare(`UPDATE calls SET vejledning_r2_key = ?2, vejledning_filnavn = ?3 WHERE id = ?1`)
        .bind(callId, key, vej.name).run();
    }

    const sagTitel = String(fd.get("sag_titel") || "").trim();
    if (sagTitel) {
      const appId = await opretSagFraRunde(db, callId, { titel: sagTitel, aktoer: bruger.navn });
      return redirect(`${FONDE}/sag/${appId}`);
    }
    return redirect(`${FONDE}/runde/${callId}`);
  }

  const mKrav = sti.match(new RegExp(`^${FONDE}/runde/([A-Za-z0-9_-]{4,64})/krav$`));
  if (request.method === "POST" && mKrav) {
    const callId = mKrav[1];
    const tilbage = `${FONDE}/runde/${callId}`;
    const fd = await request.formData();
    const label = String(fd.get("label") || "").trim();
    if (!label) return redirect(tilbage, "Kravets navn mangler.");
    const slags = gyldigtKravSlags(fd.get("slags")) ? fd.get("slags") : "adgangskrav";
    const max = await db.prepare(`SELECT MAX(sortering) n FROM call_requirements WHERE call_id = ?1`).bind(callId).first();
    await db.prepare(`
      INSERT INTO call_requirements (id, call_id, label, slags, paakraevet, note, kilde, sortering, oprettet)
      VALUES (?1,?2,?3,?4,1,?5,?6,?7,?8)`
    ).bind(id(), callId, label, slags,
      String(fd.get("note") || "").trim() || null,
      String(fd.get("kilde") || "").trim() || null,
      (max?.n || 0) + 1, nu()).run();
    return redirect(tilbage);
  }

  const mSag = sti.match(new RegExp(`^${FONDE}/runde/([A-Za-z0-9_-]{4,64})/sag$`));
  if (request.method === "POST" && mSag) {
    const fd = await request.formData();
    const appId = await opretSagFraRunde(db, mSag[1], {
      titel: fd.get("titel"), aktoer: bruger.navn,
    });
    return redirect(`${FONDE}/sag/${appId}`);
  }

  if (request.method === "POST" && sti === `${FONDE}/fondedk`) {
    if (!bruger.menneske) {
      return html(side({
        titel: TEKST.ingenAdgang, aktiv: "fonde", bruger,
        indhold: fejlTilstand({ titel: TEKST.ingenAdgang, lead: TEKST.ingenAdgangH1, broed: TEKST.ingenAdgangLead }),
      }), 403);
    }
    const fd = await request.formData();
    const status = String(fd.get("fondedk_status") || "uafklaret");
    await db.prepare(`
      UPDATE organizations SET fondedk_status = ?1, fondedk_note = ?2, fondedk_tjekket = ?3
       WHERE id = (SELECT id FROM organizations LIMIT 1)`
    ).bind(status, String(fd.get("fondedk_note") || "").trim() || null, nu()).run();
    return redirect(`${FONDE}/ny`, "Fonde.dk-noten er gemt.");
  }

  return null;
}
