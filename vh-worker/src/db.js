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
    SELECT a.*, c.navn AS runde, c.frist_utc, c.frist_tz, c.frist_ordlyd,
           c.frist_kilde_url, c.frist_note, f.navn AS fond, o.navn AS org,
           (SELECT COUNT(*) FROM requirements r WHERE r.application_id = a.id AND r.paakraevet = 1) AS krav,
           (SELECT COUNT(DISTINCT r.id) FROM requirements r
              JOIN documents d ON d.requirement_id = r.id
             WHERE r.application_id = a.id AND r.paakraevet = 1) AS opfyldt
      FROM applications a
      JOIN calls c ON c.id = a.call_id
      JOIN funds f ON f.id = c.fund_id
      JOIN organizations o ON o.id = a.org_id
     ORDER BY COALESCE(c.frist_utc, '9999') ASC`).all();
  return results;
}

export async function sag(db, appId) {
  const a = await db.prepare(`
    SELECT a.*, c.navn AS runde, c.frist_utc, c.frist_tz, c.frist_ordlyd,
           c.frist_kilde_url, c.frist_verificeret, c.frist_note,
           f.navn AS fond, f.url AS fond_url, o.navn AS org, o.cvr, o.cvr_status
      FROM applications a
      JOIN calls c ON c.id = a.call_id
      JOIN funds f ON f.id = c.fund_id
      JOIN organizations o ON o.id = a.org_id
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
