// Vendhjem-workeren: Fonds-CRM på /internt/fonde og /internt/korpus,
// ophold på /internt/ophold (alle bag Access), fællesskabets login på /mit
// (uden Access) og den offentlige kalender på /sporene. Data i D1, filer i R2.
//
// Alt andet serveres som statiske filer af [assets].

import { identitet } from "./access.js";
import { sager, sag, organisation, personer, pakkeHash, log, id, nu } from "./db.js";
import { oversigt, sagside } from "./sider.js";
import { side, fejlTilstand } from "./flade.js";
import { TEKST } from "./tekst.js";
import { mitFetch } from "./mit.js";
import { koerSikkerhedskopi } from "./sikkerhedskopi.js";
import { haandterKorpus, ROD_KORPUS } from "./korpus.js";
import {
  haandterRunde, listerRunder, saetAdgang, saetKlar, arkiverSag, historiskIndsendelse, FONDE,
} from "./runde.js";
import { erSporene, erOphold, besvarSporene, besvarOphold } from "./ophold.js";
import { erSkriv, erBreve, besvarSkriv, besvarBreve } from "./breve.js";

const ROD = FONDE;

function workerSti(pathname) {
  return pathname === FONDE || pathname.startsWith(FONDE + "/")
      || pathname === ROD_KORPUS || pathname.startsWith(ROD_KORPUS + "/");
}

const redirect = (til, besked) =>
  new Response(null, { status: 303, headers: { Location: besked ? `${til}?m=${encodeURIComponent(besked)}` : til } });

const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

function afvist(bruger) {
  return html(side({
    titel: TEKST.ingenAdgang, aktiv: "fonde", bruger,
    indhold: fejlTilstand({
      titel: TEKST.ingenAdgang,
      lead: TEKST.ingenAdgangH1,
      broed: TEKST.ingenAdgangLead,
    }),
  }), 403);
}

export default {
  // Månedlig sikkerhedskopi af D1 til R2. Se src/sikkerhedskopi.js om hvorfor.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(koerSikkerhedskopi(env).then((r) => {
      console.log("sikkerhedskopi", JSON.stringify(r));
    }).catch((e) => {
      // En fejlet kopi må aldrig være tavs.
      console.error("sikkerhedskopi FEJLEDE", String(e && e.message || e));
    }));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // www har sin egen vaert og var IKKE daekket af Access, som er bundet til
    // vendhjem.dk/internt og /internt/*. Resultat: hele /internt laa aabent paa
    // www.vendhjem.dk. Maalt aabent 16.09.2026, fundet af Steven.
    //
    // Her sendes alt paa www til apex, foer noget som helst serveres. Saa findes
    // der kun én flade at beskytte. Access-apps paa www er lagt oven i som andet
    // lag, saa det ikke afhaenger af denne ene linje.
    if (url.hostname === "www.vendhjem.dk") {
      url.hostname = "vendhjem.dk";
      return Response.redirect(url.toString(), 301);
    }

    // Sundhedstjek. Ligger UDEN for /internt, fordi Access ellers svarer foer
    // Workeren og tjekket aldrig naar frem. Kraever en hemmelig header; uden
    // den svarer den 404 og roeber ikke engang at den findes.
    //
    // Den returnerer TAL, aldrig indhold: ingen sagstitler, ingen beloeb, ingen
    // navne, ingen filnavne. Formaalet er at opdage at en binding er faldet ud,
    // foer et menneske opdager det.
    if (url.pathname === "/sundhed/fonde") {
      if (!env.SUNDHED_NOEGLE || request.headers.get("X-VH-Sundhed") !== env.SUNDHED_NOEGLE)
        return new Response("Findes ikke.", { status: 404 });
      const svar = { tid: new Date().toISOString() };
      try {
        const r = await env.FONDE_DB.prepare(
          `SELECT (SELECT COUNT(*) FROM applications) a,
                  (SELECT COUNT(*) FROM requirements) k,
                  (SELECT COUNT(*) FROM documents) d,
                  (SELECT COUNT(*) FROM approvals) g,
                  (SELECT COUNT(*) FROM submissions) i,
                  (SELECT COUNT(*) FROM korpus_dokumenter) ko,
                  (SELECT COUNT(*) FROM ophold) o,
                  (SELECT COUNT(*) FROM pladser) p`).first();
        svar.d1 = "ok";
        svar.antal = { sager: r.a, krav: r.k, bilag: r.d, godkendelser: r.g, indsendelser: r.i, korpus: r.ko, ophold: r.o, pladser: r.p };
        const m = await env.FONDE_DB.prepare(
          `SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1`).first();
        svar.sidste_migration = m?.name ?? null;
      } catch (e) { svar.d1 = "FEJL: " + (e.message || e); }
      try {
        await env.FONDE_FILER.get("__sundhed_findes_ikke__");
        svar.r2 = "ok";
      } catch (e) { svar.r2 = "FEJL: " + (e.message || e); }
      const sundt = svar.d1 === "ok" && svar.r2 === "ok";
      return new Response(JSON.stringify(svar, null, 1), {
        status: sundt ? 200 : 503,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    // /mit er fællesskabets login. UDEN for Access — Access' 50-bruger-loft
    // kan ikke bære fællesskabet. /internt røres ikke.
    if (url.pathname === "/mit" || url.pathname.startsWith("/mit/")) {
      return mitFetch(request, env);
    }

    const sti = url.pathname.replace(/\/+$/, "") || "/";

    // Offentlig kalender. Ingen Access — det er det, sitet sælger.
    if (erSporene(sti, url.pathname)) return besvarSporene(request, env);

    // Brevet fra /bliv-en-del. Ingen Access — det er en offentlig formular.
    if (erSkriv(sti)) {
      try { return await besvarSkriv(request, env); }
      catch (e) {
        return html(side({
          titel: TEKST.fejl, aktiv: "breve", bruger: null,
          indhold: fejlTilstand({ detalje: String(e.message || e) }),
        }), 500);
      }
    }

    const internOphold = erOphold(sti);
    const internBreve = erBreve(sti);
    if (!internOphold && !internBreve && !workerSti(url.pathname)) return env.ASSETS.fetch(request);

    let bruger = await identitet(request);

    // Lokal afproevning. Dobbelt laast: flaget saettes KUN paa kommandolinjen
    // (`wrangler dev --var LOKAL_TEST:1`), staar aldrig i wrangler.toml, og
    // vaerten skal desuden vaere localhost. Paa vendhjem.dk er begge dele
    // falske, og grenen kan ikke naas. Det maales efter hvert deploy.
    if (!bruger && env.LOKAL_TEST === "1" && /^(localhost|127\.0\.0\.1)(:|$)/.test(url.host)) {
      bruger = { email: "test@lokal", sub: "lokal", menneske: true, navn: "lokal-test" };
    }

    if (!bruger) {
      // Access burde have stoppet kaldet før det nåede hertil. Når det alligevel
      // sker, er det et hul — så vi siger nej selv i stedet for at stole på laget foran.
      return new Response("Ingen gyldig Access-identitet.", {
        status: 401, headers: { "cache-control": "no-store" },
      });
    }

    if (internOphold) return besvarOphold(request, env, bruger, url);
    if (internBreve) return besvarBreve(request, env, bruger, url);

    const db = env.FONDE_DB;
    const r2 = env.FONDE_FILER;

    try {
      const korpusSvar = await haandterKorpus(request, { db, r2, bruger, url, sti });
      if (korpusSvar) return korpusSvar;

      const rundeSvar = await haandterRunde(request, { db, r2, bruger, url, sti });
      if (rundeSvar) return rundeSvar;

      if (request.method === "GET" && (sti === ROD)) {
        const [liste, org, runder] = await Promise.all([sager(db), organisation(db), listerRunder(db)]);
        return html(oversigt({ bruger, sager: liste, org, runder }));
      }

      const mSag = sti.match(new RegExp(`^${ROD}/sag/([A-Za-z0-9_-]{4,64})$`));
      if (request.method === "GET" && mSag) {
        const s = await sag(db, mSag[1]);
        if (!s) return html("Sagen findes ikke.", 404);
        const [hash, folk] = await Promise.all([pakkeHash(db, s.id), personer(db)]);
        return html(sagside({ bruger, s, hash, personer: folk, advarsel: url.searchParams.get("m") }));
      }

      const mFil = sti.match(new RegExp(`^${ROD}/fil/([A-Za-z0-9_-]{4,64})$`));
      if (request.method === "GET" && mFil) {
        const d = await db.prepare(`SELECT * FROM documents WHERE id = ?1`).bind(mFil[1]).first();
        if (!d) return new Response("Findes ikke.", { status: 404 });
        const obj = await r2.get(d.r2_key);
        if (!obj) return new Response("Filen mangler i arkivet.", { status: 404 });
        return new Response(obj.body, {
          headers: {
            "content-type": d.mime || "application/octet-stream",
            "content-disposition": `inline; filename="${d.filnavn.replace(/"/g, "")}"`,
            "cache-control": "private, no-store",
          },
        });
      }

      // ── Handlinger ────────────────────────────────────────────────────────
      const mAkt = sti.match(new RegExp(`^${ROD}/sag/([A-Za-z0-9_-]{4,64})/(gem|upload|kontroller|godkend|indsendt|klar|arkiver|historisk|adgang)$`));
      if (request.method === "POST" && mAkt) {
        const [, appId, handling] = mAkt;
        const tilbage = `${ROD}/sag/${appId}`;

        // Kun mennesker må træffe beslutninger og sende noget ud af huset.
        if (!bruger.menneske && handling !== "gem") return afvist(bruger);

        const fd = await request.formData();
        const s0 = await db.prepare(`SELECT * FROM applications WHERE id = ?1`).bind(appId).first();
        if (!s0) return new Response("Sagen findes ikke.", { status: 404 });
        if (s0.status === "indsendt" && handling !== "gem")
          return redirect(tilbage, "Sagen er indsendt. Den kan ikke ændres.");

        if (handling === "klar") {
          const r = await saetKlar(db, appId, bruger.navn);
          return redirect(tilbage, r.ok ? null : r.grund);
        }

        if (handling === "arkiver") {
          await arkiverSag(db, appId, bruger.navn);
          return redirect(tilbage);
        }

        if (handling === "historisk") {
          await historiskIndsendelse(db, appId, {
            aktoer: bruger.navn, ref: fd.get("ref") || null, note: fd.get("note") || null,
          });
          return redirect(tilbage);
        }

        if (handling === "adgang") {
          const kravId = fd.get("krav");
          const k = await db.prepare(
            `SELECT id FROM requirements WHERE id = ?1 AND application_id = ?2`
          ).bind(kravId, appId).first();
          if (!k) return redirect(tilbage, "Kravet findes ikke på sagen.");
          await saetAdgang(db, kravId, fd.get("adgang"), bruger.navn);
          return redirect(tilbage);
        }

        if (handling === "gem") {
          const b = fd.get("beloeb");
          let ansvarlig = fd.get("ansvarlig") || null;
          if (ansvarlig === "") ansvarlig = null;
          if (ansvarlig) {
            const p = await db.prepare(`SELECT id FROM people WHERE id = ?1`).bind(ansvarlig).first();
            if (!p) return redirect(tilbage, "Ukendt person.");
          }
          await db.prepare(`
            UPDATE applications SET beloeb_ansoegt = ?2, ansvarlig = ?3,
                   naeste_handling = ?4, intern_frist = ?5, opdateret = ?6 WHERE id = ?1`)
            .bind(appId, b === "" || b == null ? null : Number(b),
                  ansvarlig, fd.get("naeste") || null,
                  fd.get("intern_frist") || null, nu()).run();
          await log(db, { app_id: appId, aktoer: bruger.navn, handling: "rettede sagens felter" });
          return redirect(tilbage);
        }

        if (handling === "upload") {
          const fil = fd.get("fil");
          const kravId = fd.get("krav") || null;
          if (!fil || typeof fil === "string" || fil.size === 0)
            return redirect(tilbage, "Ingen fil valgt.");
          if (fil.size > 25 * 1024 * 1024)
            return redirect(tilbage, "Filen er større end 25 MB.");

          const buf = await fil.arrayBuffer();
          const digest = await crypto.subtle.digest("SHA-256", buf);
          const sha = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
          const docId = id();
          const key = `${appId}/${docId}/${fil.name}`;
          await r2.put(key, buf, { httpMetadata: { contentType: fil.type || "application/octet-stream" } });

          const forrige = kravId
            ? await db.prepare(`SELECT MAX(version) v FROM documents WHERE requirement_id = ?1`).bind(kravId).first()
            : null;

          await db.prepare(`
            INSERT INTO documents (id, application_id, requirement_id, filnavn, r2_key, bytes, mime,
                                   sha256, version, slags, uploadet_af, uploadet)
            VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'bilag',?10,?11)`)
            .bind(docId, appId, kravId, fil.name, key, fil.size, fil.type || null, sha,
                  (forrige?.v || 0) + 1, bruger.navn, nu()).run();
          await log(db, { app_id: appId, aktoer: bruger.navn, handling: "uploadede bilag", detalje: fil.name });
          return redirect(tilbage);
        }

        if (handling === "kontroller") {
          await db.prepare(`UPDATE requirements SET kontrolleret = ?2, kontrolleret_af = ?3 WHERE id = ?1`)
            .bind(fd.get("krav"), nu(), bruger.navn).run();
          await log(db, { app_id: appId, aktoer: bruger.navn, handling: "kontrollerede bilag" });
          return redirect(tilbage);
        }

        if (handling === "godkend") {
          const beslutning = fd.get("beslutning") === "godkendt" ? "godkendt" : "afvist";
          const hash = await pakkeHash(db, appId);
          await db.batch([
            db.prepare(`INSERT INTO approvals (id, application_id, beslutning, aktoer, kommentar, pakke_hash, besluttet)
                        VALUES (?1,?2,?3,?4,?5,?6,?7)`)
              .bind(id(), appId, beslutning, bruger.navn, fd.get("kommentar") || null, hash, nu()),
            db.prepare(`UPDATE applications SET status = ?2, opdateret = ?3 WHERE id = ?1`)
              .bind(appId, beslutning === "godkendt" ? "godkendt" : "kladde", nu()),
            db.prepare(`INSERT INTO activity_log (application_id, aktoer, handling, detalje, tidspunkt)
                        VALUES (?1,?2,?3,?4,?5)`)
              .bind(appId, bruger.navn, `${beslutning} pakken`, hash.slice(0, 12), nu()),
          ]);
          return redirect(tilbage);
        }

        if (handling === "indsendt") {
          const hash = await pakkeHash(db, appId);
          const godk = await db.prepare(
            `SELECT * FROM approvals WHERE application_id = ?1 AND beslutning = 'godkendt'
             ORDER BY besluttet DESC LIMIT 1`).bind(appId).first();
          if (!godk || godk.pakke_hash !== hash)
            return redirect(tilbage, "Pakken er ændret siden godkendelsen. Godkend igen, før den registreres som indsendt.");

          let kvitId = null;
          const kv = fd.get("kvittering");
          if (kv && typeof kv !== "string" && kv.size > 0) {
            kvitId = id();
            const key = `${appId}/${kvitId}/${kv.name}`;
            await r2.put(key, await kv.arrayBuffer(), { httpMetadata: { contentType: kv.type || "application/octet-stream" } });
            await db.prepare(`
              INSERT INTO documents (id, application_id, filnavn, r2_key, bytes, mime, version, slags, uploadet_af, uploadet)
              VALUES (?1,?2,?3,?4,?5,?6,1,'kvittering',?7,?8)`)
              .bind(kvitId, appId, kv.name, key, kv.size, kv.type || null, bruger.navn, nu()).run();
          }

          await db.batch([
            db.prepare(`INSERT INTO submissions (id, application_id, indsendt, indsendt_af, ekstern_ref, kvittering_id, pakke_hash)
                        VALUES (?1,?2,?3,?4,?5,?6,?7)`)
              .bind(id(), appId, nu(), bruger.navn, fd.get("ref") || null, kvitId, hash),
            db.prepare(`UPDATE applications SET status = 'indsendt', opdateret = ?2 WHERE id = ?1`).bind(appId, nu()),
            db.prepare(`INSERT INTO activity_log (application_id, aktoer, handling, detalje, tidspunkt)
                        VALUES (?1,?2,'registrerede indsendelse',?3,?4)`)
              .bind(appId, bruger.navn, fd.get("ref") || "uden reference", nu()),
          ]);
          return redirect(tilbage);
        }
      }

      return new Response("Findes ikke.", { status: 404 });
    } catch (e) {
      // Fejl må aldrig efterlade en falsk «godkendt»-status. Vi siger det højt.
      return html(side({
        titel: TEKST.fejl, aktiv: "fonde", bruger,
        indhold: fejlTilstand({ detalje: String(e.message || e) }),
      }), 500);
    }
  },
};
