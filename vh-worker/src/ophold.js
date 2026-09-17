// Ophold: intern kalender bag Access, offentlig /sporene uden.
import { opholdstyper, opholdListe, opholdSag, opretOphold, gemOphold,
         opretPlads, saetPladsStatus, personer, offentligeOphold, lukkedeUger } from "./db.js";
import { opholdOversigt, opholdSide, sporeneSide } from "./ophold-sider.js";
import { side, fejlTilstand } from "./flade.js";
import { TEKST } from "./tekst.js";

const ROD = "/internt/ophold";
const STATUS = new Set(["planlagt", "åben", "fuld", "lukket", "afholdt"]);
const PLADS = new Set(["forespurgt", "bekræftet", "betalt", "afbudt"]);

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

export function erSporene(sti, pathname) {
  return sti === "/sporene" || pathname === "/sporene.html";
}

export function erOphold(sti) {
  return sti === ROD || sti.startsWith(ROD + "/");
}

export async function besvarSporene(env) {
  const db = env.FONDE_DB;
  const [typer, aabne, lukkede] = await Promise.all([
    opholdstyper(db), offentligeOphold(db), lukkedeUger(db),
  ]);
  return html(sporeneSide({ typer, aabne, lukkede }));
}

export async function besvarOphold(request, env, bruger, url) {
  const db = env.FONDE_DB;
  const sti = url.pathname.replace(/\/+$/, "") || ROD;

  try {
    if (request.method === "GET" && sti === ROD) {
      const [liste, typer] = await Promise.all([opholdListe(db), opholdstyper(db)]);
      return html(opholdOversigt({
        bruger, liste, typer, advarsel: url.searchParams.get("m"),
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
      const start_dato = String(fd.get("start_dato") || "");
      const slut_dato = String(fd.get("slut_dato") || "");
      if (!start_dato || !slut_dato) return redirect(ROD, "Datoer mangler.");
      try {
        const o = await opretOphold(db, {
          type_id, start_dato, slut_dato, kapacitet: kap, status,
          pris: heltal(fd.get("pris")),
        });
        return redirect(`${ROD}/${o.id}`);
      } catch (e) {
        return redirect(ROD, String(e.message || e));
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
        await saetPladsStatus(db, pid, status);
      } catch (e) {
        return redirect(`${ROD}/${oid}`, String(e.message || e));
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
        return redirect(tilbage, String(e.message || e));
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
      try {
        await gemOphold(db, oid, {
          start_dato: String(fd.get("start_dato") || ""),
          slut_dato: String(fd.get("slut_dato") || ""),
          kapacitet: kap, status,
          pris: heltal(fd.get("pris")),
          note: fd.get("note") || null,
        });
      } catch (e) {
        return redirect(tilbage, String(e.message || e));
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
