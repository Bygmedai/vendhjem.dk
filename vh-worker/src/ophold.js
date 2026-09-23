// Ophold: intern kalender bag Access, offentlig /sporene uden.
// C2: forespørgsel på /sporene/foresporg — uden betaling, uden ny auth.
import { opholdstyper, opholdListe, opholdSag, opretOphold, gemOphold,
         opretPlads, saetPladsStatus, saetPladsMailFejl, findAktivPlads,
         findEllerOpretPerson, aabneForespoergsler, personer,
         offentligeOphold, lukkedeUger,
         tjekForesporgRate, logForesporgForsoeg } from "./db.js";
import { opholdOversigt, opholdSide, sporeneSide, sporeneForesporgSide,
         sporeneTakSide, sporeneFuldtSide, sporeneFindesIkke,
         periodeTekst, FORESPORG_STI } from "./ophold-sider.js";
import { side, fejlTilstand } from "./flade.js";
import { TEKST, kvitteringBrev, foresporgTilOs, bekraeftelsesBrev, afslagsBrev } from "./tekst.js";
import { modtagere } from "./breve.js";
import { sendMail } from "./mail.js";
import { sessionPerson } from "./session.js";
import { lavCsrf, tjekCsrf, csrfCookie, CSRF_NAVN, klientIp } from "./hegn.js";
import { laesCookie } from "./krypto.js";

const ROD = "/internt/ophold";
const STATUS = new Set(["planlagt", "åben", "fuld", "lukket", "afholdt"]);
const PLADS = new Set(["forespurgt", "bekræftet", "betalt", "afbudt"]);
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const redirect = (til, besked) =>
  new Response(null, { status: 303, headers: { Location: besked ? `${til}?m=${encodeURIComponent(besked)}` : til } });

function html(s, status = 200, cookies = []) {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(s, { status, headers });
}

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

/**
 * Beskeden til huset. Se `foresporgTilOs` om hvorfor den ikke fandtes foer.
 *
 * Fejl pr. modtager samles og kastes samlet: én adresse, der brokker sig,
 * maa ikke skjule at de andre kom frem — og omvendt maa et delvist held
 * ikke se ud som fuld succes.
 */
async function sendTilOs(env, { person, o, besked, oprettet }) {
  const brev = foresporgTilOs({
    navn: person.navn,
    mail: person.mail,
    type_navn: o.type_navn,
    periode: periodeTekst(o.start_dato, o.slut_dato),
    besked,
    oprettet,
  });
  const fejl = [];
  for (const to of modtagere(env)) {
    try { await sendMail(env, { to, ...brev, reply_to: person.mail }); }
    catch (e) { fejl.push(`${to}: ${String(e.message || e)}`); }
  }
  if (fejl.length) throw new Error(fejl.join(" · "));
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

async function formSvar(env, { o, person, advarsel }, status = 200) {
  const token = await lavCsrf(env.SESSION_NOEGLE, { form: "foresporg", id: o.id });
  return html(
    sporeneForesporgSide({ o, person, advarsel, csrf: token }),
    status,
    token ? [csrfCookie(token)] : [],
  );
}

async function besvarForesporg(request, env, opholdId) {
  const db = env.FONDE_DB;
  const o = await opholdSag(db, opholdId);
  if (!o) return html("Opholdet findes ikke.", 404);
  const session = await sessionPerson(env, request);

  if (!kanForespørges(o)) {
    return html(sporeneFuldtSide({ o }), 409);
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return formSvar(env, { o, person: session });
  }

  if (request.method !== "POST") return new Response("Findes ikke.", { status: 404 });

  const fd = await request.formData();
  // Honningkrukke: samme mønster som /bliv-en-del/skriv. Udfyldt = robot.
  // Svar som om alt gik godt, så robotten ikke lærer noget.
  if (String(fd.get("website") || "").trim()) {
    return html(sporeneTakSide({ o, person: { navn: "" } }));
  }

  const csrfOk = await tjekCsrf(
    env.SESSION_NOEGLE,
    fd.get("_csrf"),
    laesCookie(request, CSRF_NAVN),
    { form: "foresporg", id: o.id },
  );
  const ip = klientIp(request);
  if (!csrfOk) {
    await logForesporgForsoeg(db, { ip });
    return formSvar(env, {
      o, person: session, advarsel: TEKST.forespørgUdløbet,
    }, 400);
  }

  const gaestMail = session?.mail || String(fd.get("mail") || "").trim();
  const rate = await tjekForesporgRate(db, { ip, mail: gaestMail || null });
  if (!rate.ok) {
    await logForesporgForsoeg(db, { ip, mail: gaestMail || null });
    return formSvar(env, {
      o, person: session, advarsel: TEKST.forespørgForMange,
    }, 429);
  }
  await logForesporgForsoeg(db, { ip, mail: gaestMail || null });

  let person = session;
  if (!person) {
    const navn = String(fd.get("navn") || "").trim();
    const mail = String(fd.get("mail") || "").trim();
    if (!navn || !MAIL_RE.test(mail)) {
      return formSvar(env, {
        o, person: null, advarsel: "Skriv navn og en rigtig mail.",
      }, 400);
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

  // Huset FOERST. Udebliver kvitteringen, kan mennesket skrive igen; udebliver
  // beskeden til os, kan ingen gaette at nogen har spurgt. De to sendes
  // uafhaengigt, og BEGGE fejl bliver staaende paa pladsen — en samlet
  // try/catch ville lade den ene skjule den anden.
  const mailFejl = [];
  try { await sendTilOs(env, { person, o, besked, oprettet: plads.oprettet }); }
  catch (e) { mailFejl.push(`til os: ${String(e.message || e)}`); }
  try { await sendKvittering(env, { person, o }); }
  catch (e) { mailFejl.push(`kvittering: ${String(e.message || e)}`); }
  await saetPladsMailFejl(db, plads.id, mailFejl.length ? mailFejl.join(" · ") : null);

  return html(sporeneTakSide({ o, person }));
}

function sporeneGren(sti) {
  if (sti === "/sporene") return { slags: "liste" };
  const ascii = sti.match(new RegExp(`^${FORESPORG_STI}/([A-Za-z0-9_-]{4,64})$`));
  if (ascii) return { slags: "form", id: ascii[1] };
  const oe = sti.match(/^\/sporene\/forespørg\/([A-Za-z0-9_-]{4,64})$/);
  if (oe) return { slags: "omdiriger", id: oe[1] };
  if (sti.startsWith("/sporene/")) return { slags: "ukendt" };
  return { slags: "liste" };
}

export async function besvarSporene(request, env) {
  const url = new URL(request.url);
  const raa = url.pathname;
  const sti = afkodSti(raa).replace(/\/+$/, "") || "/sporene";
  const gren = sti === "/sporene.html" ? { slags: "liste" } : sporeneGren(sti);

  if (gren.slags === "omdiriger") {
    const lok = `${FORESPORG_STI}/${gren.id}`;
    // POST på den gamle ø-sti: 308, så en åben fane ikke mister kroppen.
    // GET/HEAD: 301 til ASCII. Det er det, der måltes som 404 på HEAD.
    const status = request.method === "POST" ? 308 : 301;
    return new Response(null, { status, headers: { Location: lok } });
  }

  if (gren.slags === "form") {
    try {
      return await besvarForesporg(request, env, gren.id);
    } catch (e) {
      return html(side({
        titel: TEKST.fejl, aktiv: "ophold", bruger: null,
        indhold: fejlTilstand({ detalje: String(e.message || e) }),
      }), 500);
    }
  }

  if (gren.slags === "ukendt") {
    return html(sporeneFindesIkke(), 404);
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
