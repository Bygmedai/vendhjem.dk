// BYG-567 E1 · Korpus. Skarp adskillelse stemme | fakta | historik.
// Et ikke-godkendt dokument kan ikke bruges som grundlag. Stemme er aldrig fakta.
// Historik er det, der er lovet før, ikke det der er sandt nu.

import { id, nu, log } from "./db.js";
import { side, esc, tabel, felt, knap, tomTilstand, fejlTilstand } from "./flade.js";
import { TEKST } from "./tekst.js";

export const KORPUS_SLAGS = Object.freeze(["stemme", "fakta", "historik"]);
export const STEMMEPROFIL_ID = "korpus-stemmeprofil";
export const ROD_KORPUS = "/internt/korpus";

const SLAGS_SAET = new Set(KORPUS_SLAGS);

export class KorpusAfvisning extends Error {
  constructor(kode, besked) {
    super(besked);
    this.kode = kode;
    this.navn = "KorpusAfvisning";
  }
}

export const erGodkendt = (d) => d?.godkendelsesstatus === "godkendt";

export function gyldigtSlags(s) {
  return SLAGS_SAET.has(s);
}

/**
 * Må dokumentet bruges til den angivne anvendelse?
 * Håndhæver: kun godkendte; stemme aldrig som fakta; historik aldrig som
 * aktuelt faktum; slags skal matche anvendelsen.
 */
export function kanBrugesSom(dok, anvendelse) {
  if (!dok) return { ok: false, kode: "findes_ikke", grund: "Dokumentet findes ikke." };
  if (!erGodkendt(dok)) {
    return {
      ok: false,
      kode: "ikke_godkendt",
      grund: "Et ikke-godkendt dokument kan ikke bruges som grundlag.",
    };
  }
  if (!gyldigtSlags(anvendelse)) {
    return { ok: false, kode: "ukendt_anvendelse", grund: "Ukendt anvendelse." };
  }
  if (anvendelse === "fakta" && dok.slags !== "fakta") {
    if (dok.slags === "stemme") {
      return {
        ok: false,
        kode: "stemme_er_ikke_fakta",
        grund: "Stemme må ikke bruges som fakta. En god formulering er ikke et aktuelt faktum.",
      };
    }
    return {
      ok: false,
      kode: "historik_er_ikke_fakta",
      grund: "Historik er det, der er lovet før, ikke det der er sandt nu.",
    };
  }
  if (dok.slags !== anvendelse) {
    return {
      ok: false,
      kode: "forkert_slags",
      grund: `Dokumentet er mærket ${dok.slags}, ikke ${anvendelse}.`,
    };
  }
  return { ok: true };
}

/** Kaster KorpusAfvisning hvis dokumentet ikke må bruges. */
export async function somGrundlag(db, dokumentId, anvendelse) {
  const dok = await hentDokument(db, dokumentId);
  const tjek = kanBrugesSom(dok, anvendelse);
  if (!tjek.ok) throw new KorpusAfvisning(tjek.kode, tjek.grund);
  return dok;
}

export async function hentDokument(db, dokumentId) {
  return db.prepare(`SELECT * FROM korpus_dokumenter WHERE id = ?1`).bind(dokumentId).first();
}

export async function hentStemmeprofil(db) {
  const d = await db.prepare(
    `SELECT * FROM korpus_dokumenter WHERE id = ?1 OR rolle = 'stemmeprofil' LIMIT 1`
  ).bind(STEMMEPROFIL_ID).first();
  return d ?? null;
}

export async function listDokumenter(db) {
  const { results } = await db.prepare(
    `SELECT * FROM korpus_dokumenter ORDER BY CASE WHEN rolle = 'stemmeprofil' THEN 0 ELSE 1 END, opdateret DESC`
  ).all();
  return results;
}

export async function godkendtAfSlags(db, slags) {
  if (!gyldigtSlags(slags)) return [];
  const { results } = await db.prepare(
    `SELECT * FROM korpus_dokumenter
      WHERE slags = ?1 AND godkendelsesstatus = 'godkendt'
      ORDER BY dato DESC, opdateret DESC`
  ).bind(slags).all();
  return results;
}

export async function opretDokument(db, {
  titel, slags, oprindelse = null, dato = null, projekt = null,
  tilladt_brug = null, indhold = null, r2_key = null, filnavn = null,
  mime = null, bytes = null, sha256 = null, oprettet_af, rolle = null,
}) {
  if (!gyldigtSlags(slags)) throw new KorpusAfvisning("ukendt_slags", "Slags skal være stemme, fakta eller historik.");
  if (!titel || !String(titel).trim()) throw new KorpusAfvisning("mangler_titel", "Titel mangler.");
  const did = id();
  const t = nu();
  await db.prepare(`
    INSERT INTO korpus_dokumenter (
      id, titel, slags, oprindelse, version, dato, projekt, tilladt_brug,
      godkendelsesstatus, r2_key, filnavn, mime, bytes, sha256, indhold, rolle,
      oprettet, opdateret, oprettet_af)
    VALUES (?1,?2,?3,?4,1,?5,?6,?7,'kladde',?8,?9,?10,?11,?12,?13,?14,?15,?15,?16)`
  ).bind(did, String(titel).trim(), slags, oprindelse || null, dato || null,
    projekt || null, tilladt_brug || null, r2_key, filnavn, mime, bytes, sha256,
    indhold || null, rolle, t, oprettet_af).run();
  await log(db, { aktoer: oprettet_af, handling: "lagde korpus-dokument op", detalje: `${slags} · ${titel}` });
  return hentDokument(db, did);
}

export async function godkendDokument(db, dokumentId, aktoer) {
  const dok = await hentDokument(db, dokumentId);
  if (!dok) throw new KorpusAfvisning("findes_ikke", "Dokumentet findes ikke.");
  await db.prepare(`
    UPDATE korpus_dokumenter
       SET godkendelsesstatus = 'godkendt', godkendt_af = ?2, godkendt = ?3, opdateret = ?3
     WHERE id = ?1`
  ).bind(dokumentId, aktoer, nu()).run();
  await log(db, { aktoer, handling: "godkendte korpus-dokument", detalje: dok.titel });
  return hentDokument(db, dokumentId);
}

/**
 * Ny version af kildedokumentet. Godkendelsen falder, fordi indholdet er
 * et andet. Afhængige arbejdsgrundlag markeres til genvurdering — undtagen
 * dem der hører til en allerede indsendt ansøgning, som ikke omskrives.
 */
export async function nyVersion(db, dokumentId, felter, aktoer) {
  const dok = await hentDokument(db, dokumentId);
  if (!dok) throw new KorpusAfvisning("findes_ikke", "Dokumentet findes ikke.");
  if (felter.slags && !gyldigtSlags(felter.slags)) {
    throw new KorpusAfvisning("ukendt_slags", "Slags skal være stemme, fakta eller historik.");
  }
  const t = nu();
  const ver = dok.version + 1;
  await db.prepare(`
    UPDATE korpus_dokumenter SET
      titel = ?2, slags = ?3, oprindelse = ?4, dato = ?5, projekt = ?6,
      tilladt_brug = ?7, indhold = ?8, r2_key = ?9, filnavn = ?10, mime = ?11,
      bytes = ?12, sha256 = ?13, version = ?14, godkendelsesstatus = 'kladde',
      godkendt_af = NULL, godkendt = NULL, opdateret = ?15
     WHERE id = ?1`
  ).bind(
    dokumentId,
    felter.titel ?? dok.titel,
    felter.slags ?? dok.slags,
    felter.oprindelse === undefined ? dok.oprindelse : felter.oprindelse,
    felter.dato === undefined ? dok.dato : felter.dato,
    felter.projekt === undefined ? dok.projekt : felter.projekt,
    felter.tilladt_brug === undefined ? dok.tilladt_brug : felter.tilladt_brug,
    felter.indhold === undefined ? dok.indhold : felter.indhold,
    felter.r2_key === undefined ? dok.r2_key : felter.r2_key,
    felter.filnavn === undefined ? dok.filnavn : felter.filnavn,
    felter.mime === undefined ? dok.mime : felter.mime,
    felter.bytes === undefined ? dok.bytes : felter.bytes,
    felter.sha256 === undefined ? dok.sha256 : felter.sha256,
    ver, t,
  ).run();
  const markeret = await markerAfhaengige(db, dokumentId);
  await log(db, {
    aktoer,
    handling: "ændrede kildedokument",
    detalje: `${dok.titel} · v${ver} · ${markeret.genvurdering} til genvurdering, ${markeret.sprunget_indsendt} indsendte urørt`,
  });
  return { dokument: await hentDokument(db, dokumentId), ...markeret };
}

export async function opretArbejdsgrundlag(db, { titel, application_id = null }) {
  const gid = id();
  const t = nu();
  await db.prepare(`
    INSERT INTO arbejdsgrundlag (id, titel, application_id, status, oprettet, opdateret)
    VALUES (?1,?2,?3,'kladde',?4,?4)`
  ).bind(gid, titel, application_id, t).run();
  return db.prepare(`SELECT * FROM arbejdsgrundlag WHERE id = ?1`).bind(gid).first();
}

export async function knytKilde(db, grundlag_id, dokument_id) {
  const dok = await hentDokument(db, dokument_id);
  if (!dok) throw new KorpusAfvisning("findes_ikke", "Dokumentet findes ikke.");
  const tjek = kanBrugesSom(dok, dok.slags);
  if (!tjek.ok) throw new KorpusAfvisning(tjek.kode, tjek.grund);
  await db.prepare(`
    INSERT INTO arbejdsgrundlag_kilder (grundlag_id, dokument_id, dokument_version, oprettet)
    VALUES (?1,?2,?3,?4)`
  ).bind(grundlag_id, dokument_id, dok.version, nu()).run();
}

export async function markerAfhaengige(db, dokumentId) {
  const { results } = await db.prepare(`
    SELECT g.* FROM arbejdsgrundlag g
      JOIN arbejdsgrundlag_kilder k ON k.grundlag_id = g.id
     WHERE k.dokument_id = ?1`
  ).bind(dokumentId).all();

  let genvurdering = 0, sprunget_indsendt = 0;
  for (const g of results) {
    if (g.application_id) {
      const app = await db.prepare(
        `SELECT status FROM applications WHERE id = ?1`
      ).bind(g.application_id).first();
      if (app?.status === "indsendt") {
        sprunget_indsendt += 1;
        continue;
      }
    }
    await db.prepare(
      `UPDATE arbejdsgrundlag SET status = 'til_genvurdering', opdateret = ?2 WHERE id = ?1`
    ).bind(g.id, nu()).run();
    genvurdering += 1;
  }
  return { genvurdering, sprunget_indsendt, i_alt: results.length };
}

export async function afhaengige(db, dokumentId) {
  const { results } = await db.prepare(`
    SELECT g.* FROM arbejdsgrundlag g
      JOIN arbejdsgrundlag_kilder k ON k.grundlag_id = g.id
     WHERE k.dokument_id = ?1`
  ).bind(dokumentId).all();
  return results;
}

const slagsLabel = (s) => ({ stemme: "Stemme", fakta: "Fakta", historik: "Historik" }[s] || s);
const statusLabel = (s) => ({ kladde: "Kladde", godkendt: "Godkendt", trukket: "Trukket" }[s] || s);

const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

const redirect = (til, besked) =>
  new Response(null, { status: 303, headers: { Location: besked ? `${til}?m=${encodeURIComponent(besked)}` : til } });

function dt(iso) {
  return iso ? new Date(iso).toLocaleString("da-DK", {
    timeZone: "Europe/Copenhagen", day: "2-digit", month: "2-digit", year: "numeric",
  }) : TEKST.streg;
}

function advarsel(url) {
  const m = url.searchParams.get("m");
  if (!m) return "";
  return `<section class="stage" style="padding-top:18px"><div class="ramme" style="border-color:var(--accent)">
<p class="meta-s" style="color:var(--accent)">Bemærk</p><p class="small mt1">${esc(m)}</p></div></section>`;
}

export function korpusOversigt({ bruger, dokumenter, advarselHtml = "" }) {
  const rk = dokumenter.map((d) => `<tr>
<td><a href="${ROD_KORPUS}/dok/${esc(d.id)}">${esc(d.titel)}</a>
  ${d.rolle === "stemmeprofil" ? `<span class="meta" style="display:block;margin-top:4px">Stemmeprofil</span>` : ""}</td>
<td>${esc(slagsLabel(d.slags))}</td>
<td>${d.godkendelsesstatus === "godkendt"
    ? esc(statusLabel(d.godkendelsesstatus))
    : `<span class="mangler">${esc(statusLabel(d.godkendelsesstatus))}</span>`}</td>
<td>${esc(d.projekt || TEKST.streg)}</td>
<td>${dt(d.dato || d.oprettet)}</td>
</tr>`);

  return side({
    titel: "Korpus", aktiv: "korpus", bruger,
    indhold: `
${advarselHtml}
<section class="stage blok">
<p class="sec">Korpus</p>
<h1>Materiale til ansøgninger</h1>
<p class="lead maxw mt2">Stemme, fakta og historik holdes adskilt. Kun godkendte dokumenter må bruges som grundlag.</p>
</section>

<section class="stage">
${tabel({ hoved: ["Dokument", "Slags", "Status", "Projekt", "Dato"], raekker: rk, tom: "Ingen dokumenter endnu." })}
</section>

<section class="stage blok sektion">
<p class="sec">Læg dokument op</p>
<form method="post" action="${ROD_KORPUS}/upload" enctype="multipart/form-data" style="max-width:640px">
${felt({ label: "Titel", name: "titel", required: true })}
${felt({ label: "Slags", name: "slags", value: "fakta", options: [
  { value: "stemme", label: "Stemme — ordvalg og rytme, aldrig fakta" },
  { value: "fakta", label: "Fakta — aktuelle oplysninger" },
  { value: "historik", label: "Historik — hvad der er lovet før" },
] })}
${felt({ label: "Oprindelse", name: "oprindelse", placeholder: "fx Lai, 2024 · livogland.dk" })}
${felt({ label: "Dokumentets dato", name: "dato", type: "date" })}
${felt({ label: "Projekt", name: "projekt" })}
${felt({ label: "Tilladt brug", name: "tilladt_brug", placeholder: "fx ordvalg i ansøgninger" })}
${felt({ label: "Tekst (hvis ingen fil, eller som uddrag)", name: "indhold", type: "textarea" })}
<p class="felt-label meta-s">Fil</p>
<input type="file" name="fil" style="font-size:13px">
<p class="mt3">${knap({ label: "Læg op", accent: true })}</p>
<p class="meta mt2">Dokumentet er kladde, indtil et menneske godkender det til brug.</p>
</form>
</section>`,
  });
}

export function korpusDokside({ bruger, dok, afhaeng, advarselHtml = "" }) {
  const profil = dok.rolle === "stemmeprofil";
  return side({
    titel: dok.titel, aktiv: "korpus", bruger,
    indhold: `
${advarselHtml}
<section class="stage blok">
<p class="sec"><a href="${ROD_KORPUS}/">Korpus</a> / ${esc(slagsLabel(dok.slags))}</p>
<h1>${esc(dok.titel)}</h1>
<p class="small mt2">${esc(statusLabel(dok.godkendelsesstatus))} · version ${esc(dok.version)}
  ${dok.godkendt_af ? ` · godkendt af ${esc(dok.godkendt_af)} ${dt(dok.godkendt)}` : ""}</p>
</section>

<section class="stage">
<div class="g g-3 nb">
<div><p class="meta-s">Slags</p><p class="v mt1">${esc(slagsLabel(dok.slags))}</p>
  <p class="small soft mt1">${dok.slags === "stemme" ? "Ordvalg og rytme. Aldrig et aktuelt faktum."
    : dok.slags === "historik" ? "Hvad der er lovet før. Ikke det der er sandt nu."
    : "Aktuelle oplysninger. Skal have kilde og dato, når de bruges."}</p></div>
<div><p class="meta-s">Oprindelse</p><p class="v mt1">${esc(dok.oprindelse || TEKST.streg)}</p>
  <p class="small soft mt1">Projekt: ${esc(dok.projekt || TEKST.streg)}</p></div>
<div class="loeft"><p class="meta-s">Tilladt brug</p>
  <p class="v mt1">${esc(dok.tilladt_brug || TEKST.streg)}</p>
  ${dok.filnavn ? `<p class="small mt1"><a href="${ROD_KORPUS}/fil/${esc(dok.id)}">${esc(dok.filnavn)}</a></p>` : ""}</div>
</div>
</section>

<section class="stage blok sektion">
<p class="sec">${profil ? "Stemmeprofil" : "Tekst"}</p>
${dok.indhold
    ? `<pre class="small mt2" style="white-space:pre-wrap;font-family:var(--serif)">${esc(dok.indhold)}</pre>`
    : tomTilstand("Ingen tekst gemt. Åbn filen, hvis der er en.", "small soft")}
</section>

<section class="stage blok sektion">
<p class="sec">Ret og godkend</p>
<form method="post" action="${ROD_KORPUS}/dok/${esc(dok.id)}/gem" enctype="multipart/form-data" style="max-width:640px">
${felt({ label: "Titel", name: "titel", value: dok.titel, required: true })}
${felt({ label: "Slags", name: "slags", value: dok.slags, options: [
  { value: "stemme", label: "Stemme" },
  { value: "fakta", label: "Fakta" },
  { value: "historik", label: "Historik" },
] })}
${felt({ label: "Oprindelse", name: "oprindelse", value: dok.oprindelse || "" })}
${felt({ label: "Dokumentets dato", name: "dato", type: "date", value: dok.dato || "" })}
${felt({ label: "Projekt", name: "projekt", value: dok.projekt || "" })}
${felt({ label: "Tilladt brug", name: "tilladt_brug", value: dok.tilladt_brug || "" })}
${felt({ label: "Tekst", name: "indhold", type: "textarea", value: dok.indhold || "" })}
<p class="felt-label meta-s">Ny fil (erstatter den nuværende)</p>
<input type="file" name="fil" style="font-size:13px">
<p class="mt3">${knap({ label: TEKST.gem })}</p>
<p class="meta mt2">En ændring af kilden sætter dokumentet tilbage til kladde og markerer berørte arbejdsgrundlag til genvurdering. Indsendte ansøgninger omskrives ikke.</p>
</form>
${dok.godkendelsesstatus !== "godkendt" ? `
<form method="post" action="${ROD_KORPUS}/dok/${esc(dok.id)}/godkend" class="mt3">
${knap({ label: "Godkend til brug", accent: true })}
</form>` : tomTilstand("Godkendt til brug.", "small soft mt3")}
</section>

<section class="stage blok sektion">
<p class="sec">Arbejdsgrundlag der bygger på dette</p>
${afhaeng.length
    ? tabel({
      hoved: ["Grundlag", "Status"],
      raekker: afhaeng.map((g) => `<tr><td>${esc(g.titel)}</td><td>${esc(g.status)}</td></tr>`),
    })
    : tomTilstand("Ingen endnu.", "small soft")}
</section>`,
  });
}

async function laesFil(fd) {
  const fil = fd.get("fil");
  if (!fil || typeof fil === "string" || fil.size === 0) return null;
  if (fil.size > 25 * 1024 * 1024) throw new KorpusAfvisning("for_stor", "Filen er større end 25 MB.");
  const buf = await fil.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const sha = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
  return { buf, name: fil.name, type: fil.type || "application/octet-stream", size: fil.size, sha };
}

/**
 * HTTP for /internt/korpus. Returnerer Response, eller null hvis stien ikke matcher.
 */
export async function haandterKorpus(request, { db, r2, bruger, url, sti }) {
  const advarselHtml = advarsel(url);

  if (request.method === "GET" && sti === ROD_KORPUS) {
    const dokumenter = await listDokumenter(db);
    return html(korpusOversigt({ bruger, dokumenter, advarselHtml }));
  }

  const mFil = sti.match(new RegExp(`^${ROD_KORPUS}/fil/([A-Za-z0-9_-]{4,64})$`));
  if (request.method === "GET" && mFil) {
    const d = await hentDokument(db, mFil[1]);
    if (!d?.r2_key) return new Response("Findes ikke.", { status: 404 });
    const obj = await r2.get(d.r2_key);
    if (!obj) return new Response("Filen mangler i arkivet.", { status: 404 });
    return new Response(obj.body, {
      headers: {
        "content-type": d.mime || "application/octet-stream",
        "content-disposition": `inline; filename="${(d.filnavn || "fil").replace(/"/g, "")}"`,
        "cache-control": "private, no-store",
      },
    });
  }

  const mDok = sti.match(new RegExp(`^${ROD_KORPUS}/dok/([A-Za-z0-9_-]{4,64})$`));
  if (request.method === "GET" && mDok) {
    const dok = await hentDokument(db, mDok[1]);
    if (!dok) return html("Dokumentet findes ikke.", 404);
    const afh = await afhaengige(db, dok.id);
    return html(korpusDokside({ bruger, dok, afhaeng: afh, advarselHtml }));
  }

  if (request.method === "POST" && sti === `${ROD_KORPUS}/upload`) {
    const fd = await request.formData();
    const slags = String(fd.get("slags") || "");
    const titel = String(fd.get("titel") || "").trim();
    const indhold = String(fd.get("indhold") || "").trim() || null;
    let filMeta = null;
    try { filMeta = await laesFil(fd); }
    catch (e) {
      if (e instanceof KorpusAfvisning) return redirect(ROD_KORPUS, e.message);
      throw e;
    }
    if (!titel) return redirect(ROD_KORPUS, "Titel mangler.");
    if (!gyldigtSlags(slags)) return redirect(ROD_KORPUS, "Slags skal være stemme, fakta eller historik.");
    if (!filMeta && !indhold) return redirect(ROD_KORPUS, "Læg en fil op, eller skriv teksten.");

    const did = id();
    let r2_key = null;
    if (filMeta) {
      r2_key = `korpus/${did}/${filMeta.name}`;
      await r2.put(r2_key, filMeta.buf, { httpMetadata: { contentType: filMeta.type } });
    }
    const t = nu();
    await db.prepare(`
      INSERT INTO korpus_dokumenter (
        id, titel, slags, oprindelse, version, dato, projekt, tilladt_brug,
        godkendelsesstatus, r2_key, filnavn, mime, bytes, sha256, indhold,
        oprettet, opdateret, oprettet_af)
      VALUES (?1,?2,?3,?4,1,?5,?6,?7,'kladde',?8,?9,?10,?11,?12,?13,?14,?14,?15)`
    ).bind(did, titel, slags,
      String(fd.get("oprindelse") || "").trim() || null,
      String(fd.get("dato") || "").trim() || null,
      String(fd.get("projekt") || "").trim() || null,
      String(fd.get("tilladt_brug") || "").trim() || null,
      r2_key, filMeta?.name || null, filMeta?.type || null, filMeta?.size || null, filMeta?.sha || null,
      indhold, t, bruger.navn).run();
    await log(db, { aktoer: bruger.navn, handling: "lagde korpus-dokument op", detalje: `${slags} · ${titel}` });
    return redirect(`${ROD_KORPUS}/dok/${did}`);
  }

  const mAkt = sti.match(new RegExp(`^${ROD_KORPUS}/dok/([A-Za-z0-9_-]{4,64})/(godkend|gem)$`));
  if (request.method === "POST" && mAkt) {
    const [, dokId, handling] = mAkt;
    const tilbage = `${ROD_KORPUS}/dok/${dokId}`;
    if (!bruger.menneske) {
      return html(side({
        titel: TEKST.ingenAdgang, aktiv: "korpus", bruger,
        indhold: fejlTilstand({
          titel: TEKST.ingenAdgang, lead: TEKST.ingenAdgangH1, broed: TEKST.ingenAdgangLead,
        }),
      }), 403);
    }
    try {
      if (handling === "godkend") {
        await godkendDokument(db, dokId, bruger.navn);
        return redirect(tilbage);
      }
      if (handling === "gem") {
        const fd = await request.formData();
        const slags = String(fd.get("slags") || "");
        if (!gyldigtSlags(slags)) return redirect(tilbage, "Slags skal være stemme, fakta eller historik.");
        const felter = {
          titel: String(fd.get("titel") || "").trim(),
          slags,
          oprindelse: String(fd.get("oprindelse") || "").trim() || null,
          dato: String(fd.get("dato") || "").trim() || null,
          projekt: String(fd.get("projekt") || "").trim() || null,
          tilladt_brug: String(fd.get("tilladt_brug") || "").trim() || null,
          indhold: String(fd.get("indhold") || "").trim() || null,
        };
        if (!felter.titel) return redirect(tilbage, "Titel mangler.");
        const filMeta = await laesFil(fd);
        if (filMeta) {
          felter.r2_key = `korpus/${dokId}/${filMeta.name}`;
          await r2.put(felter.r2_key, filMeta.buf, { httpMetadata: { contentType: filMeta.type } });
          felter.filnavn = filMeta.name;
          felter.mime = filMeta.type;
          felter.bytes = filMeta.size;
          felter.sha256 = filMeta.sha;
        }
        await nyVersion(db, dokId, felter, bruger.navn);
        return redirect(tilbage, "Gemt som ny version. Godkend igen, før det må bruges.");
      }
    } catch (e) {
      if (e instanceof KorpusAfvisning) return redirect(tilbage, e.message);
      throw e;
    }
  }

  return null;
}
