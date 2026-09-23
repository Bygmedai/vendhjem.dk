// Betalingsvejen. Stripe Checkout, hosted.
//
// HVORFOR MAILEN BAERER VORES ADRESSE OG IKKE STRIPES
//
// En Checkout Session udloeber — 24 timer hos Stripe. Et link i en mail, som
// gaesten aabner tre dage senere, er doedt, og den doede side siger ikke
// «prøv igen», den siger at noget er galt. Derfor baerer bekraeftelsen
// /betaling/<plads>/<sig>, som aldrig udloeber, og der mintes en frisk
// session ved hvert klik.
//
// FAIL-CLOSED
//
// Uden STRIPE_SECRET_KEY oprettes ingen session, og bekraeftelsen baerer intet
// link. Samme form som mail.js uden RESEND_API_KEY: en funktion, der
// returnerer ok for en betaling, den ikke har oprettet, goer fejlen usynlig
// hele vejen op. Noeglen er en hemmelighed hos Cloudflare — aldrig i repoet,
// aldrig i [vars], som wrangler alligevel sletter ved hvert deploy.

import { hmacSign, b64url, ens } from "./krypto.js";
import { medSikkerhed } from "./hegn.js";
import { offentligSkal } from "./ophold-sider.js";

const API = "https://api.stripe.com/v1";

/** Stripes tolerance paa tidsstemplet. Fem minutter er deres eget eksempel. */
const TOLERANCE_S = 300;

export function erBetaling(sti) {
  return sti === "/betaling/webhook" || sti.startsWith("/betaling/");
}

/** Signaturen paa pladsens id. Uden den kan nogen taelle sig gennem UUID'er. */
async function sign(env, pladsId) {
  const n = env.SESSION_NOEGLE || "";
  if (!n) throw new Error("SESSION_NOEGLE mangler");
  return b64url(await hmacSign(n, `betaling:${pladsId}`)).slice(0, 24);
}

export async function betalingsSti(env, pladsId) {
  return `/betaling/${pladsId}/${await sign(env, pladsId)}`;
}

/** Beloebet. EKSPLICIT, ikke `p.*` + `o.pris`: de to hedder det samme, og
 *  SQLite lader den sidste vinde — pladsens egen pris var skygget af
 *  opholdets. Harmloest i en mail, ikke harmloest i en betaling. */
const PLADS_SQL = `
  SELECT p.id AS plads_id, p.status AS plads_status,
         coalesce(p.pris, o.pris, t.pris_fra) AS belob_kr,
         pe.navn AS person_navn, pe.mail AS person_mail,
         o.start_dato, o.slut_dato, t.navn AS type_navn
    FROM pladser p
    JOIN people pe ON pe.id = p.person_id
    JOIN ophold o ON o.id = p.ophold_id
    JOIN opholdstyper t ON t.id = o.type_id
   WHERE p.id = ?1`;

async function hentPlads(db, pladsId) {
  return db.prepare(PLADS_SQL).bind(pladsId).first();
}

async function stripe(env, vej, felter) {
  const krop = new URLSearchParams(felter);
  const r = await fetch(`${API}${vej}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: krop,
  });
  const svar = await r.json();
  if (!r.ok) throw new Error(`Stripe svarede ${r.status}: ${JSON.stringify(svar.error || svar).slice(0, 300)}`);
  return svar;
}

/**
 * Mint en frisk Checkout Session for en plads.
 *
 * Returnerer null naar der ikke er en noegle, eller naar pladsen ikke er
 * bekraeftet. Vi tager ikke penge for en plads, der ikke er sagt ja til —
 * flowet er forespurgt -> bekraeftet -> betalt, og rækkefoelgen er loeftet.
 */
export async function nySession(env, db, pladsId, oprindelse) {
  if (!env.STRIPE_SECRET_KEY) return null;
  const p = await hentPlads(db, pladsId);
  if (!p) return null;
  if (p.plads_status !== "bekræftet") return null;
  if (!p.belob_kr || p.belob_kr <= 0) return null;

  const alleredeBetalt = await db.prepare(
    `SELECT 1 FROM betalinger WHERE plads_id = ?1 AND status = 'betalt'`
  ).bind(pladsId).first();
  if (alleredeBetalt) return { betalt: true };

  const oere = Math.round(Number(p.belob_kr) * 100);
  const s = await stripe(env, "/checkout/sessions", {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "dkk",
    "line_items[0][price_data][unit_amount]": String(oere),
    "line_items[0][price_data][product_data][name]": `${p.type_navn}, ${p.start_dato} – ${p.slut_dato}`,
    customer_email: p.person_mail,
    // Pladsen, ikke personen. Webhooken skal kunne finde tilbage til ÉN raekke.
    "metadata[plads_id]": pladsId,
    "payment_intent_data[metadata][plads_id]": pladsId,
    success_url: `${oprindelse}/betaling/kvittering`,
    cancel_url: `${oprindelse}${await betalingsSti(env, pladsId)}?afbrudt=1`,
  });

  await db.prepare(`
    INSERT INTO betalinger (id, plads_id, belob_oere, valuta, session_id, status, oprettet)
    VALUES (?1, ?2, ?3, 'dkk', ?4, 'aabnet', ?5)`)
    .bind(crypto.randomUUID(), pladsId, oere, s.id, new Date().toISOString()).run();

  return { url: s.url, oere };
}

/**
 * Signaturen paa webhooken. Skrevet efter Stripes egen beskrivelse, ikke efter
 * hukommelsen: header'en er `t=<unix>,v1=<hex>[,v0=…]`, den signerede streng er
 * `${t}.${raa krop}`, algoritmen er HMAC-SHA256 med endpoint-hemmeligheden, og
 * v0 SKAL ignoreres (nedgraderingsangreb). Sammenligningen er konstant tid.
 *
 * Der kan vaere FLERE v1 paa én gang: ruller man hemmeligheden, sender Stripe
 * én signatur pr. aktiv hemmelighed i op til 24 timer. Derfor `some`.
 */
export async function verificer(raaKrop, header, hemmelighed) {
  if (!header || !hemmelighed) return false;
  const dele = String(header).split(",").map((d) => d.split("="));
  const t = dele.find((d) => d[0].trim() === "t")?.[1];
  const v1 = dele.filter((d) => d[0].trim() === "v1").map((d) => d[1]);
  if (!t || !v1.length) return false;

  const alder = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(alder) || alder > TOLERANCE_S) return false;

  const sig = await hmacSign(hemmelighed, `${t}.${raaKrop}`);
  const ventet = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1.some((k) => ens(ventet, String(k).trim()));
}

/**
 * Webhooken. Ingen Access, ingen CSRF — den kommer fra Stripe, ikke fra en
 * browser. Signaturen ER hegnet.
 *
 * Idempotens ligger i databasen (`event_id` UNIQUE), ikke i en if-saetning:
 * Stripe sender det samme event om igen ved enhver tvivl, og to samtidige
 * leveringer ville begge komme forbi et JavaScript-tjek.
 */
export async function besvarWebhook(request, env) {
  if (request.method !== "POST") return new Response("nej", { status: 405 });
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("ikke sat op", { status: 503 });

  // RAA krop. Parses den foerst, er signaturen tabt.
  const raa = await request.text();
  const ok = await verificer(raa, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response("signatur", { status: 400 });

  let ev;
  try { ev = JSON.parse(raa); } catch { return new Response("krop", { status: 400 }); }
  if (ev?.type !== "checkout.session.completed") return new Response("ok", { status: 200 });

  const s = ev.data?.object || {};
  const pladsId = s.metadata?.plads_id;
  if (!pladsId) return new Response("ok", { status: 200 });
  // Betalt, ikke bare gennemfoert. En session kan vaere completed og ubetalt.
  if (s.payment_status !== "paid") return new Response("ok", { status: 200 });

  const db = env.FONDE_DB;
  const naa = new Date().toISOString();
  try {
    await db.batch([
      db.prepare(`UPDATE betalinger SET status = 'betalt', betalt_at = ?2, event_id = ?3
                   WHERE session_id = ?1 AND status = 'aabnet'`)
        .bind(s.id, naa, ev.id),
      db.prepare(`UPDATE pladser SET status = 'betalt'
                   WHERE id = ?1 AND status = 'bekræftet'`)
        .bind(pladsId),
    ]);
  } catch (e) {
    // UNIQUE paa event_id eller paa betaling_hoejst_en_betalt. Begge betyder
    // «den her er allerede talt». 200, saa Stripe holder op med at sende.
    const m = String(e.message || e);
    if (!/UNIQUE|constraint/i.test(m)) throw e;
  }
  return new Response("ok", { status: 200 });
}

/**
 * Gaestens side. Ingen login — den, der har mailen, har adressen.
 *
 * Siden er bevidst tynd: den siger hvad der skal betales, og sender videre.
 * Den viser IKKE kortfelter; de ligger hos Stripe, og det er hele pointen med
 * hosted checkout. Vi roerer aldrig et kortnummer.
 */
export async function besvarBetaling(request, env, url) {
  const sti = url.pathname.replace(/\/+$/, "");

  if (sti === "/betaling/webhook") return besvarWebhook(request, env);

  const svar = (indhold, kode = 200) => medSikkerhed(new Response(
    offentligSkal({ titel: "Betaling", canonical: "/sporene",
      description: "Betaling for et ophold på Agersø.", indhold }),
    { status: kode, headers: { "content-type": "text/html; charset=utf-8" } }));

  const blok = (overskrift, brod, knap) => `
<section class="stage stage-n sektion">
<p class="sec">Betaling</p>
<h1 class="stor">${overskrift}</h1>
<p class="lead mt4 maxw">${brod}</p>
${knap || ""}
<p class="meta mt4"><a href="/praktisk">Det praktiske →</a> · <a href="/sporene">Sporene →</a></p>
</section>`;

  if (sti === "/betaling/kvittering") {
    return svar(blok("Tak. Betalingen er gået igennem.",
      "Du hører fra os, hvis der er mere. Ellers ses vi på Agersø — færgen går fra Stigsnæs."));
  }

  const m = sti.match(/^\/betaling\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{8,64})$/);
  if (!m) return svar(blok("Den adresse findes ikke.",
    "Tjek linket i mailen, eller svar på den — så finder vi ud af det."), 404);

  const [, pladsId, underskrift] = m;
  if (!ens(underskrift, await sign(env, pladsId))) {
    return svar(blok("Det link passer ikke.",
      "Svar på bekræftelsen, så sender vi et nyt."), 404);
  }

  const r = await nySession(env, env.FONDE_DB, pladsId, url.origin);

  if (r?.betalt) {
    return svar(blok("Den er betalt.",
      "Der er ikke noget at gøre. Står der noget andet i din bank, så svar på bekræftelsen."));
  }
  if (!r) {
    // Fail-closed, og siden siger hvad der er sandt: ingen noegle, ingen pris,
    // eller en plads der ikke er bekraeftet. Vi opfinder ikke et beloeb.
    return svar(blok("Der er ikke noget at betale her endnu.",
      "Enten er pladsen ikke bekræftet, eller også er beløbet ikke sat. Svar på den mail, du fik, så svarer vi."));
  }
  return medSikkerhed(Response.redirect(r.url, 303));
}
