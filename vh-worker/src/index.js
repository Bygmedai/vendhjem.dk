// Vendhjem Fonds-CRM
// Bor på vendhjem.dk/internt/fonde, bag den Cloudflare Access der allerede
// står foran /internt. Data i D1, bilag i R2.
//
// Alt uden for /internt/fonde serveres som statiske filer af [assets] og rører
// aldrig denne kode.

import { identitet } from "./access.js";
import { sager, sag, organisation, pakkeHash, log, id, nu } from "./db.js";
import { oversigt, sagside } from "./sider.js";
import { side } from "./views.js";

const ROD = "/internt/fonde";

const redirect = (til, besked) =>
  new Response(null, { status: 303, headers: { Location: besked ? `${til}?m=${encodeURIComponent(besked)}` : til } });

const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

function afvist(bruger) {
  return html(side({
    titel: "Ingen adgang", aktiv: "fonde", bruger,
    indhold: `<section class="stage sektion"><p class="sec">Ingen adgang</p>
<h1 class="stor maxw">Den her side kræver, at du er logget ind som menneske.</h1>
<p class="lead maxw mt3">Servicetokens kan læse, men ikke godkende eller indsende. Det er med vilje: en maskine må ikke stå som den, der traf beslutningen.</p></section>`,
  }), 403);
}

export default {
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

    if (!url.pathname.startsWith(ROD)) return env.ASSETS.fetch(request);

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

    const db = env.FONDE_DB;
    const r2 = env.FONDE_FILER;
    const sti = url.pathname.replace(/\/+$/, "") || ROD;

    try {
      if (request.method === "GET" && (sti === ROD)) {
        const [liste, org] = await Promise.all([sager(db), organisation(db)]);
        return html(oversigt({ bruger, sager: liste, org }));
      }

      const mSag = sti.match(new RegExp(`^${ROD}/sag/([A-Za-z0-9_-]{4,64})$`));
      if (request.method === "GET" && mSag) {
        const s = await sag(db, mSag[1]);
        if (!s) return html("Sagen findes ikke.", 404);
        const hash = await pakkeHash(db, s.id);
        return html(sagside({ bruger, s, hash, advarsel: url.searchParams.get("m") }));
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
      const mAkt = sti.match(new RegExp(`^${ROD}/sag/([A-Za-z0-9_-]{4,64})/(gem|upload|kontroller|godkend|indsendt)$`));
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

        if (handling === "gem") {
          const b = fd.get("beloeb");
          await db.prepare(`
            UPDATE applications SET beloeb_ansoegt = ?2, ansvarlig = ?3,
                   naeste_handling = ?4, intern_frist = ?5, opdateret = ?6 WHERE id = ?1`)
            .bind(appId, b === "" || b == null ? null : Number(b),
                  fd.get("ansvarlig") || null, fd.get("naeste") || null,
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
        titel: "Fejl", aktiv: "fonde", bruger,
        indhold: `<section class="stage sektion"><p class="sec">Fejl</p>
<h1 class="stor maxw">Handlingen blev ikke gennemført.</h1>
<p class="lead maxw mt3">Intet er markeret som godkendt eller indsendt på et forkert grundlag.</p>
<pre class="small mt3" style="white-space:pre-wrap">${String(e.message || e).replace(/[<&]/g, "")}</pre></section>`,
      }), 500);
    }
  },
};
