// Alt DB-arbejde ét sted. Kun parameteriserede forespørgsler.

export const nu = () => new Date().toISOString();
export const id = () => crypto.randomUUID();

export async function log(db, { app_id, aktoer, handling, detalje }) {
  await db.prepare(
    `INSERT INTO activity_log (application_id, aktoer, handling, detalje, tidspunkt)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(app_id ?? null, aktoer, handling, detalje ?? null, nu()).run();
}

export async function sager(db) {
  const { results } = await db.prepare(`
    SELECT a.*, p.navn AS ansvarlig_navn,
           c.navn AS runde, c.frist_utc, c.frist_tz, c.frist_ordlyd,
           c.frist_kilde_url, c.frist_note, f.navn AS fond, o.navn AS org,
           (SELECT COUNT(*) FROM requirements r WHERE r.application_id = a.id AND r.paakraevet = 1) AS krav,
           (SELECT COUNT(DISTINCT r.id) FROM requirements r
              JOIN documents d ON d.requirement_id = r.id
             WHERE r.application_id = a.id AND r.paakraevet = 1) AS opfyldt
      FROM applications a
      JOIN calls c ON c.id = a.call_id
      JOIN funds f ON f.id = c.fund_id
      JOIN organizations o ON o.id = a.org_id
      LEFT JOIN people p ON p.id = a.ansvarlig
     ORDER BY COALESCE(c.frist_utc, '9999') ASC`).all();
  return results;
}

export async function sag(db, appId) {
  const a = await db.prepare(`
    SELECT a.*, p.navn AS ansvarlig_navn,
           c.navn AS runde, c.frist_utc, c.frist_tz, c.frist_ordlyd,
           c.frist_kilde_url, c.frist_verificeret, c.frist_note,
           f.navn AS fond, f.url AS fond_url, o.navn AS org, o.cvr, o.cvr_status
      FROM applications a
      JOIN calls c ON c.id = a.call_id
      JOIN funds f ON f.id = c.fund_id
      JOIN organizations o ON o.id = a.org_id
      LEFT JOIN people p ON p.id = a.ansvarlig
     WHERE a.id = ?1`).bind(appId).first();
  if (!a) return null;

  const [krav, dok, godk, indsendt, logg] = await Promise.all([
    db.prepare(`SELECT * FROM requirements WHERE application_id = ?1 ORDER BY sortering, label`).bind(appId).all(),
    db.prepare(`SELECT * FROM documents WHERE application_id = ?1 ORDER BY uploadet DESC`).bind(appId).all(),
    db.prepare(`SELECT * FROM approvals WHERE application_id = ?1 ORDER BY besluttet DESC`).bind(appId).all(),
    db.prepare(`SELECT * FROM submissions WHERE application_id = ?1 ORDER BY indsendt DESC`).bind(appId).all(),
    db.prepare(`SELECT * FROM activity_log WHERE application_id = ?1 ORDER BY id DESC LIMIT 40`).bind(appId).all(),
  ]);

  const docsPrKrav = {};
  for (const d of dok.results) {
    if (d.requirement_id) (docsPrKrav[d.requirement_id] ||= []).push(d);
  }
  return {
    ...a,
    krav: krav.results.map((k) => ({ ...k, dokumenter: docsPrKrav[k.id] || [] })),
    dokumenter: dok.results,
    godkendelser: godk.results,
    indsendelser: indsendt.results,
    log: logg.results,
  };
}

/**
 * Fingeraftryk af den godkendte pakke: status-bærende felter plus præcis hvilke
 * dokumentversioner der lå der. Ændres noget af det, passer en gammel
 * godkendelse ikke længere på den nye pakke — og det skal kunne ses.
 */
export async function pakkeHash(db, appId) {
  const a = await db.prepare(
    `SELECT titel, beloeb_ansoegt, valuta, ansvarlig FROM applications WHERE id = ?1`
  ).bind(appId).first();
  const { results } = await db.prepare(
    `SELECT id, sha256, version FROM documents
      WHERE application_id = ?1 AND slags = 'bilag' ORDER BY id`
  ).bind(appId).all();
  const grundlag = JSON.stringify({ a, d: results });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(grundlag));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function organisation(db) {
  return db.prepare(`SELECT * FROM organizations LIMIT 1`).first();
}

export async function personer(db) {
  const { results } = await db.prepare(
    `SELECT * FROM people WHERE status = 'aktiv' ORDER BY navn`
  ).all();
  return results;
}

/** Opslag på nuværende kontaktmail. Ukendt mail → null, aldrig fejl. */
export async function hentPerson(db, mail) {
  if (mail == null || String(mail).trim() === "") return null;
  const p = await db.prepare(
    `SELECT * FROM people WHERE lower(mail) = lower(?1)`
  ).bind(String(mail).trim()).first();
  return p ?? null;
}

export async function roller(db, person_id) {
  const { results } = await db.prepare(
    `SELECT * FROM roles WHERE person_id = ?1 ORDER BY gyldig_fra, oprettet`
  ).bind(person_id).all();
  return results;
}

/** Gyldig rolle nu (eller på et givet tidspunkt). Udløbne tæller ikke. */
export async function harRolle(db, person_id, rolle, tid = nu()) {
  const r = await db.prepare(
    `SELECT 1 AS ok FROM roles
      WHERE person_id = ?1 AND rolle = ?2
        AND gyldig_fra <= ?3
        AND (gyldig_til IS NULL OR gyldig_til > ?3)
      LIMIT 1`
  ).bind(person_id, rolle, tid).first();
  return Boolean(r);
}

export async function opretPerson(db, { navn, mail = null, telefon = null, status = "aktiv" }) {
  const pid = id();
  await db.prepare(
    `INSERT INTO people (id, navn, mail, telefon, status, oprettet)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(pid, navn, mail, telefon, status, nu()).run();
  return db.prepare(`SELECT * FROM people WHERE id = ?1`).bind(pid).first();
}

/** Genkend på mail, ellers opret. Samme mail bliver aldrig to personer. */
export async function findEllerOpretPerson(db, { navn, mail }) {
  const kendt = await hentPerson(db, mail);
  if (kendt) return kendt;
  try {
    return await opretPerson(db, { navn, mail });
  } catch (e) {
    const igen = await hentPerson(db, mail);
    if (igen) return igen;
    throw e;
  }
}

export async function tildelRolle(db, { person_id, rolle, gyldig_fra, gyldig_til = null }) {
  const rid = id();
  await db.prepare(
    `INSERT INTO roles (id, person_id, rolle, gyldig_fra, gyldig_til, oprettet)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(rid, person_id, rolle, gyldig_fra || nu(), gyldig_til, nu()).run();
  return db.prepare(`SELECT * FROM roles WHERE id = ?1`).bind(rid).first();
}

/** Sætter gyldig_til. Personposten røres ikke. */
export async function udloebRolle(db, role_id, gyldig_til = nu()) {
  await db.prepare(`UPDATE roles SET gyldig_til = ?2 WHERE id = ?1`)
    .bind(role_id, gyldig_til).run();
  return db.prepare(`SELECT * FROM roles WHERE id = ?1`).bind(role_id).first();
}

/** Person med mindst én gyldig (ikke-udløbet) rolle. Ellers null. */
export async function personMedGyldigRolle(db, mail) {
  const p = await hentPerson(db, mail);
  if (!p || p.status !== "aktiv") return null;
  const r = await db.prepare(
    `SELECT 1 AS ok FROM roles
      WHERE person_id = ?1
        AND gyldig_fra <= ?2
        AND (gyldig_til IS NULL OR gyldig_til > ?2)
      LIMIT 1`
  ).bind(p.id, nu()).first();
  return r ? p : null;
}

export async function sætSidstSet(db, person_id) {
  await db.prepare(`UPDATE people SET sidst_set = ?2 WHERE id = ?1`).bind(person_id, nu()).run();
}

export async function sætPasskeyTilbud(db, person_id, v) {
  await db.prepare(`UPDATE people SET passkey_tilbud = ?2 WHERE id = ?1`).bind(person_id, v).run();
}

/** Skift kontaktmail. Samme person_id. Gammel mail slår ikke længere op. */
export async function skiftMail(db, person_id, mail) {
  await db.prepare(`UPDATE people SET mail = ?2 WHERE id = ?1`)
    .bind(person_id, mail).run();
  return db.prepare(`SELECT * FROM people WHERE id = ?1`).bind(person_id).first();
}

const OPTAGENDE = `'forespurgt','bekræftet','betalt'`;

export async function opholdstyper(db) {
  const { results } = await db.prepare(
    `SELECT * FROM opholdstyper ORDER BY sortering, navn`
  ).all();
  return results;
}

export async function opholdListe(db) {
  const { results } = await db.prepare(`
    SELECT o.*, t.navn AS type_navn, t.spor, t.hele_stedet, t.prismodel,
           t.pris_fra, t.pris_note,
           (SELECT COUNT(*) FROM pladser p
             WHERE p.ophold_id = o.id AND p.status IN (${OPTAGENDE})) AS optaget
      FROM ophold o
      JOIN opholdstyper t ON t.id = o.type_id
     ORDER BY o.start_dato, t.sortering`).all();
  return results;
}

export async function offentligeOphold(db) {
  const { results } = await db.prepare(`
    SELECT o.*, t.navn AS type_navn, t.spor, t.hele_stedet, t.prismodel,
           t.pris_fra, t.pris_note, t.inkluderet, t.beskrivelse,
           COALESCE(o.pris, t.pris_fra) AS vis_pris
      FROM ophold o
      JOIN opholdstyper t ON t.id = o.type_id
     WHERE o.status IN ('åben','fuld')
     ORDER BY o.start_dato`).all();
  return results;
}

export async function lukkedeUger(db) {
  const { results } = await db.prepare(`
    SELECT o.*, t.navn AS type_navn
      FROM ophold o
      JOIN opholdstyper t ON t.id = o.type_id
     WHERE t.spor = 'lukket' AND o.status = 'lukket'
     ORDER BY o.start_dato`).all();
  return results;
}

export async function opholdSag(db, opholdId) {
  const o = await db.prepare(`
    SELECT o.*, t.navn AS type_navn, t.spor, t.hele_stedet, t.prismodel,
           t.pris_fra, t.pris_note, t.inkluderet, t.beskrivelse,
           (SELECT COUNT(*) FROM pladser p
             WHERE p.ophold_id = o.id AND p.status IN (${OPTAGENDE})) AS optaget
      FROM ophold o
      JOIN opholdstyper t ON t.id = o.type_id
     WHERE o.id = ?1`).bind(opholdId).first();
  if (!o) return null;
  const { results } = await db.prepare(`
    SELECT p.*, pe.navn AS person_navn, pe.mail AS person_mail
      FROM pladser p
      JOIN people pe ON pe.id = p.person_id
     WHERE p.ophold_id = ?1
     ORDER BY p.oprettet`).bind(opholdId).all();
  return { ...o, pladser: results };
}

export async function opretOphold(db, {
  type_id, start_dato, slut_dato, kapacitet, status = "planlagt", pris = null, note = null,
}) {
  const oid = id();
  await db.prepare(`
    INSERT INTO ophold (id, type_id, start_dato, slut_dato, kapacitet, status, pris, note, oprettet)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  ).bind(oid, type_id, start_dato, slut_dato, kapacitet, status, pris, note, nu()).run();
  return db.prepare(`SELECT * FROM ophold WHERE id = ?1`).bind(oid).first();
}

export async function gemOphold(db, opholdId, {
  start_dato, slut_dato, kapacitet, status, pris = null, note = null,
}) {
  await db.prepare(`
    UPDATE ophold SET start_dato = ?2, slut_dato = ?3, kapacitet = ?4,
           status = ?5, pris = ?6, note = ?7
     WHERE id = ?1`
  ).bind(opholdId, start_dato, slut_dato, kapacitet, status, pris, note).run();
  return db.prepare(`SELECT * FROM ophold WHERE id = ?1`).bind(opholdId).first();
}

export async function opretPlads(db, { ophold_id, person_id, status = "forespurgt", pris = null, besked = null }) {
  const pid = id();
  await db.prepare(`
    INSERT INTO pladser (id, ophold_id, person_id, status, pris, oprettet, besked)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(pid, ophold_id, person_id, status, pris, nu(), besked).run();
  return db.prepare(`SELECT * FROM pladser WHERE id = ?1`).bind(pid).first();
}

export async function findAktivPlads(db, ophold_id, person_id) {
  return db.prepare(
    `SELECT * FROM pladser WHERE ophold_id = ?1 AND person_id = ?2 AND status != 'afbudt'`
  ).bind(ophold_id, person_id).first();
}

export async function saetPladsMailFejl(db, pladsId, fejl) {
  await db.prepare(`UPDATE pladser SET mail_fejl = ?2 WHERE id = ?1`)
    .bind(pladsId, fejl).run();
  return db.prepare(`SELECT * FROM pladser WHERE id = ?1`).bind(pladsId).first();
}

export async function aabneForespoergsler(db) {
  const { results } = await db.prepare(`
    SELECT p.*, pe.navn AS person_navn, pe.mail AS person_mail,
           o.start_dato, o.slut_dato, t.navn AS type_navn
      FROM pladser p
      JOIN people pe ON pe.id = p.person_id
      JOIN ophold o ON o.id = p.ophold_id
      JOIN opholdstyper t ON t.id = o.type_id
     WHERE p.status = 'forespurgt'
        OR (p.mail_fejl IS NOT NULL AND p.mail_fejl != '')
     ORDER BY p.oprettet`).all();
  return results;
}

export async function saetPladsStatus(db, pladsId, status) {
  await db.prepare(`UPDATE pladser SET status = ?2 WHERE id = ?1`)
    .bind(pladsId, status).run();
  return db.prepare(`SELECT * FROM pladser WHERE id = ?1`).bind(pladsId).first();
}

// ── Breve (BYG-558 B1) ───────────────────────────────────────────────────────
export async function opretBrev(db, { person_id, navn, mail, tekst }) {
  const bid = id();
  await db.prepare(
    `INSERT INTO breve (id, person_id, navn, mail, tekst, status, oprettet)
     VALUES (?1, ?2, ?3, ?4, ?5, 'nyt', ?6)`
  ).bind(bid, person_id, navn, mail, tekst, nu()).run();
  return db.prepare(`SELECT * FROM breve WHERE id = ?1`).bind(bid).first();
}

export async function saetBrevMailFejl(db, brevId, fejl) {
  await db.prepare(`UPDATE breve SET mail_fejl = ?2 WHERE id = ?1`)
    .bind(brevId, fejl).run();
}

export async function saetBrevStatus(db, brevId, status) {
  await db.prepare(
    `UPDATE breve SET status = ?2, besvaret = CASE WHEN ?2 = 'besvaret' THEN ?3 ELSE NULL END WHERE id = ?1`
  ).bind(brevId, status, nu()).run();
  return db.prepare(`SELECT * FROM breve WHERE id = ?1`).bind(brevId).first();
}

export async function breveListe(db) {
  const { results } = await db.prepare(
    `SELECT * FROM breve ORDER BY CASE status WHEN 'nyt' THEN 0 ELSE 1 END, oprettet DESC`
  ).all();
  return results;
}
