// Ophold: intern kalender bag Access, offentlig /sporene uden.
// C2: forespørgsel på /sporene/forespørg — uden betaling, uden ny auth.
import { opholdstyper, opholdListe, opholdSag, opretOphold, gemOphold,
         opretPlads, saetPladsStatus, saetPladsMailFejl, findAktivPlads,
         findEllerOpretPerson, aabneForespoergsler, personer,
         offentligeOphold, lukkedeUger } from "./db.js";
import { opholdOversigt, opholdSide, sporeneSide, sporeneForesporgSide,
         sporeneTakSide, sporeneFuldtSide, periodeTekst } from "./ophold-sider.js";
import { side, fejlTilstand } from "./flade.js";
import { TEKST, kvitteringBrev, bekraeftelsesBrev, afslagsBrev } from "./tekst.js";
import { sendMail } from "./mail.js";
import { sessionPerson } from "./session.js";

const ROD = "/internt/ophold";
const STATUS = new Set(["planlagt", "åben", "fuld", "lukket", "afholdt"]);
const PLADS = new Set(["forespurgt", "bekræftet", "betalt", "afbudt"]);
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const redirect = (til, besked) =>
  new Response(null, { status: 303, headers: { Location: besked ? `${til}?m=${encodeURIComponent(besked)}` : til } });

const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

function afvist(bruger) {
  return html(side({
    titel: TEKST.ingenAdgang, aktiv: "ophold", bruger,
    indhold: fejlTilstand({
      titel: TEKST.ingenAdgang,
      lead: TEKST.ingenAdgangH1,
      broed: TEKST.ingenAdgangLead,
    }),
  }), 403);
}

function heltal(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function isoDato(v) {
  const s = String(v || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function dbFejl(e) {
  const s = String(e?.message || e);
  const kendt = s.match(/hele stedet er optaget i den periode|opholdet er fuldt/);
  if (kendt) return kendt[0];
  return s.replace(/^D1_ERROR:\s*/i, "").replace(/:\s*SQLITE[A-Z_ ().0-9]*$/i, "").trim() || s;
}

function kanForespørges(o) {
  return Boolean(o) && o.status === "åben";
}

export function erSporene(sti, pathname) {
  const p = afkodSti(pathname || sti);
  return p === "/sporene" || p.startsWith("/sporene/") || pathname === "/sporene.html";
}

function afkodSti(p) {
  try { return decodeURIComponent(p || ""); }
  catch { return p || ""; }
}

export function erOphold(sti) {
  return sti === ROD || sti.startsWith(ROD + "/");
}

async function sendKvittering(env, { person, o }) {
  const brev = kvitteringBrev({
    navn: person.navn,
    type_navn: o.type_navn,
    periode: periodeTekst(o.start_dato, o.slut_dato),
  });
  await sendMail(env, { to: person.mail, ...brev });
}

async function sendBekraeftelse(env, pladsId) {
  const row = await env.FONDE_DB.prepare(`
    SELECT p.*, pe.navn AS person_navn, pe.mail AS person_mail,
           o.start_dato, o.slut_dato, o.pris, t.navn AS type_navn,
           t.inkluderet, t.pris_note, t.spor, t.pris_fra
      FROM pladser p
      JOIN people pe ON pe.id = p.person_id
      JOIN ophold o ON o.id = p.ophold_id
      JOIN opholdstyper t ON t.id = o.type_id
     WHERE p.id = ?1`).bind(pladsId).first();
  if (!row?.person_mail) throw new Error("ingen mail på personen");
  const brev = bekraeftelsesBrev({
    navn: row.person_navn,
    type_navn: row.type_navn,
    periode: periodeTekst(row.start_dato, row.slut_dato),
    inkluderet: row.inkluderet,
    pris_note: row.pris_note,
    spor: row.spor,
    vis_pris: row.pris ?? row.pris_fra,
  });
  await sendMail(env, { to: row.person_mail, ...brev });
}

/**
 * Nejet, sendt.
 *
 * «afbudt» dækker to helt forskellige ting, og de må ikke få samme brev:
 *
 *   forespurgt -> afbudt     VI siger nej. Der skal sendes et afslag.
 *   bekræftet  -> afbudt     DE melder afbud. Der skal intet sendes — et
 *                            «vi kan ikke give dig en plads» til en, der selv
 *                            sagde fra, er koldt og forvirrende.
 *
 * Derfor kigger kaldstedet på den FORRIGE status, ikke kun på den nye.
 */
async function sendAfslag(env, pladsId) {
  const row = await env.FONDE_DB.prepare(`
    SELECT p.*, pe.navn AS person_navn, pe.mail AS person_mail,
           o.start_dato, o.slut_dato, t.navn AS type_navn
      FROM pladser p
      JOIN people pe ON pe.id = p.person_id
      JOIN ophold o ON o.id = p.ophold_id
      JOIN opholdstyper t ON t.id = o.type_id
     WHERE p.id = ?1`).bind(pladsId).first();
  if (!row?.person_mail) throw new Error("ingen mail på personen");
  const brev = afslagsBrev({
    navn: row.person_navn,
    type_navn: row.type_navn,
    periode: periodeTekst(row.start_dato, row.slut_dato),
  });
  await sendMail(env, { to: row.person_mail, ...brev });
}

async function besvarForesporg(request, env, opholdId) {
  const db = env.FONDE_DB;
  const o = await opholdSag(db, opholdId);
  if (!o) return html("Opholdet findes ikke.", 404);
  const session = await sessionPerson(env, request);

  if (!kanForespørges(o)) {
    return html(sporeneFuldtSide({ o }), 409);
  }

  if (request.method === "GET") {
    return html(sporeneForesporgSide({ o, person: session }));
  }

  if (request.method !== "POST") return new Response("Findes ikke.", { status: 404 });

  const fd = await request.formData();
  let person = session;
  if (!person) {
    const navn = String(fd.get("navn") || "").trim();
    const mail = String(fd.get("mail") || "").trim();
    if (!navn || !MAIL_RE.test(mail)) {
      return html(sporeneForesporgSide({
        o, person: null, advarsel: "Skriv navn og en rigtig mail.",
      }), 400);
    }
    person = await findEllerOpretPerson(db, { navn, mail });
  }

  const besked = String(fd.get("besked") || "").trim() || null;
  let plads = await findAktivPlads(db, o.id, person.id);
  if (!plads) {
    try {
      plads = await opretPlads(db, {
        ophold_id: o.id, person_id: person.id, status: "forespurgt", besked,
      });
    } catch (e) {
      const igen = await findAktivPlads(db, o.id, person.id);
      if (igen) plads = igen;
      else if (/opholdet er fuldt/i.test(String(e?.message || e))) {
        return html(sporeneFuldtSide({ o }), 409);
      } else throw e;
    }
  }

  try {
    await sendKvittering(env, { person, o });
    await saetPladsMailFejl(db, plads.id, null);
  } catch (e) {
    await saetPladsMailFejl(db, plads.id, String(e.message || e));
  }

  return html(sporeneTakSide({ o, person }));
}

export async function besvarSporene(request, env) {
  const url = new URL(request.url);
  const sti = afkodSti(url.pathname).replace(/\/+$/, "") || "/sporene";
  const mForm = sti.match(/^\/sporene\/forespørg\/([A-Za-z0-9_-]{4,64})$/);
  if (mForm) {
    try {
      return await besvarForesporg(request, env, mForm[1]);
    } catch (e) {
      return html(side({
        titel: TEKST.fejl, aktiv: "ophold", bruger: null,
        indhold: fejlTilstand({ detalje: String(e.message || e) }),
      }), 500);
    }
  }

  try {
    const db = env.FONDE_DB;
    const [typer, aabne, lukkede] = await Promise.all([
      opholdstyper(db), offentligeOphold(db), lukkedeUger(db),
    ]);
    return html(sporeneSide({ typer, aabne, lukkede }));
  } catch {
    // 0007 ikke applied, eller D1 nede: vis den statiske ærlige tomme side
    // i stedet for at 500'e det, sitet sælger.
    return env.ASSETS.fetch(request);
  }
}

export async function besvarOphold(request, env, bruger, url) {
  const db = env.FONDE_DB;
  const sti = url.pathname.replace(/\/+$/, "") || ROD;

  try {
    if (request.method === "GET" && sti === ROD) {
      const [liste, typer, forespurgte] = await Promise.all([
        opholdListe(db), opholdstyper(db), aabneForespoergsler(db),
      ]);
      return html(opholdOversigt({
        bruger, liste, typer, forespurgte, advarsel: url.searchParams.get("m"),
      }));
    }

    if (request.method === "POST" && sti === `${ROD}/opret`) {
      if (!bruger.menneske) return afvist(bruger);
      const fd = await request.formData();
      const type_id = String(fd.get("type_id") || "");
      const type = await db.prepare(`SELECT * FROM opholdstyper WHERE id = ?1`).bind(type_id).first();
      if (!type) return redirect(ROD, "Ukendt spor.");
      const kap = heltal(fd.get("kapacitet"));
      if (kap == null || kap < 0) return redirect(ROD, "Kapacitet skal være et heltal.");
      const status = STATUS.has(String(fd.get("status"))) ? String(fd.get("status")) : "planlagt";
      const start_dato = isoDato(fd.get("start_dato"));
      const slut_dato = isoDato(fd.get("slut_dato"));
      if (!start_dato || !slut_dato) return redirect(ROD, "Datoer mangler.");
      if (start_dato > slut_dato) return redirect(ROD, "Til-datoen skal være samme dag eller senere end fra-datoen.");
      try {
        const o = await opretOphold(db, {
          type_id, start_dato, slut_dato, kapacitet: kap, status,
          pris: heltal(fd.get("pris")),
        });
        return redirect(`${ROD}/${o.id}`);
      } catch (e) {
        return redirect(ROD, dbFejl(e));
      }
    }

    const mPladsStatus = sti.match(new RegExp(`^${ROD}/([A-Za-z0-9_-]{4,64})/plads/([A-Za-z0-9_-]{4,64})/status$`));
    if (request.method === "POST" && mPladsStatus) {
      if (!bruger.menneske) return afvist(bruger);
      const [, oid, pid] = mPladsStatus;
      const fd = await request.formData();
      const status = String(fd.get("status") || "");
      if (!PLADS.has(status)) return redirect(`${ROD}/${oid}`, "Ukendt status.");
      try {
        const foer = await db.prepare(`SELECT status FROM pladser WHERE id = ?1`).bind(pid).first();
        await saetPladsStatus(db, pid, status);
        if (status === "bekræftet" && foer?.status !== "bekræftet") {
          try {
            await sendBekraeftelse(env, pid);
            await saetPladsMailFejl(db, pid, null);
          } catch (e) {
            await saetPladsMailFejl(db, pid, String(e.message || e));
          }
        }
        // Kun NÅR VI siger nej til en, der spurgte. Et afbud fra en, der selv
        // sagde fra, får ingenting — se sendAfslag om hvorfor.
        if (status === "afbudt" && foer?.status === "forespurgt") {
          try {
            await sendAfslag(env, pid);
            await saetPladsMailFejl(db, pid, null);
          } catch (e) {
            await saetPladsMailFejl(db, pid, String(e.message || e));
          }
        }
      } catch (e) {
        return redirect(`${ROD}/${oid}`, dbFejl(e));
      }
      return redirect(`${ROD}/${oid}`);
    }

    const mPlads = sti.match(new RegExp(`^${ROD}/([A-Za-z0-9_-]{4,64})/plads$`));
    if (request.method === "POST" && mPlads) {
      if (!bruger.menneske) return afvist(bruger);
      const oid = mPlads[1];
      const tilbage = `${ROD}/${oid}`;
      const fd = await request.formData();
      const person_id = String(fd.get("person_id") || "");
      if (!person_id) return redirect(tilbage, "Vælg en person.");
      const p = await db.prepare(`SELECT id FROM people WHERE id = ?1`).bind(person_id).first();
      if (!p) return redirect(tilbage, "Ukendt person.");
      const status = PLADS.has(String(fd.get("status"))) ? String(fd.get("status")) : "forespurgt";
      try {
        await opretPlads(db, { ophold_id: oid, person_id, status, pris: heltal(fd.get("pris")) });
      } catch (e) {
        return redirect(tilbage, dbFejl(e));
      }
      return redirect(tilbage);
    }

    const mGem = sti.match(new RegExp(`^${ROD}/([A-Za-z0-9_-]{4,64})/gem$`));
    if (request.method === "POST" && mGem) {
      if (!bruger.menneske) return afvist(bruger);
      const oid = mGem[1];
      const tilbage = `${ROD}/${oid}`;
      const fd = await request.formData();
      const kap = heltal(fd.get("kapacitet"));
      if (kap == null || kap < 0) return redirect(tilbage, "Kapacitet skal være et heltal.");
      const status = STATUS.has(String(fd.get("status"))) ? String(fd.get("status")) : "planlagt";
      const start_dato = isoDato(fd.get("start_dato"));
      const slut_dato = isoDato(fd.get("slut_dato"));
      if (!start_dato || !slut_dato) return redirect(tilbage, "Datoer mangler.");
      if (start_dato > slut_dato) return redirect(tilbage, "Til-datoen skal være samme dag eller senere end fra-datoen.");
      try {
        await gemOphold(db, oid, {
          start_dato, slut_dato,
          kapacitet: kap, status,
          pris: heltal(fd.get("pris")),
          note: fd.get("note") || null,
        });
      } catch (e) {
        return redirect(tilbage, dbFejl(e));
      }
      return redirect(tilbage);
    }

    const mSag = sti.match(new RegExp(`^${ROD}/([A-Za-z0-9_-]{4,64})$`));
    if (request.method === "GET" && mSag) {
      const o = await opholdSag(db, mSag[1]);
      if (!o) return html("Opholdet findes ikke.", 404);
      const folk = await personer(db);
      return html(opholdSide({ bruger, o, personer: folk, advarsel: url.searchParams.get("m") }));
    }

    return new Response("Findes ikke.", { status: 404 });
  } catch (e) {
    return html(side({
      titel: TEKST.fejl, aktiv: "ophold", bruger,
      indhold: fejlTilstand({ detalje: String(e.message || e) }),
    }), 500);
  }
}
