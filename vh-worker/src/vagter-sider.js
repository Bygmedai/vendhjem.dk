// /internt/vagter — opret en vagt, og se hvem der står på.
//
// Fladen her er bevidst tynd: fire felter og en knap. Den tunge del af vagter
// ligger på /mit, hvor fællesskabet er. Det her er stedet, hvor nogen siger
// «på lørdag skal der stå to i køkkenet», og så er det sagt.
//
// HVORFOR DEN SPØRGER PERSONREGISTERET
//
// En vagt skal vide, hvem der oprettede den, og «hvem» er en person i
// registeret — ikke en mailadresse fra Access. Står den, der er logget ind,
// ikke i registeret, siger siden det rent ud i stedet for at fejle med en
// fremmednøgle. Det er den samme slags hul, som gjorde magic link tavs i
// forrige uge: ét menneske, to poster, og ingen der kunne se det.

import { opretVagt, kommendeVagter, hvemStaarPaa, hentPerson } from "./db.js";
import { side, esc, felt, knap, fejlTilstand } from "./flade.js";
import { vagtKort, vagtDato } from "./vagter.js";
import { TEKST } from "./tekst.js";

export const ROD_VAGTER = "/internt/vagter";

const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const redirect = (til) => new Response(null, { status: 303, headers: { Location: til } });

export function erVagter(sti) { return sti === ROD_VAGTER || sti.startsWith(ROD_VAGTER + "/"); }

function idag(env) {
  return String(env?.MIT_IDAG || new Date().toISOString().slice(0, 10)).slice(0, 10);
}

function vagterIntern({ bruger, vagter, paaHver, besked, kanOprette, mail }) {
  const kort = vagter.map((v) => {
    const folk = paaHver[v.id] || [];
    // Navne, ikke tal. Det er den interne side, og den, der skal ringe til
    // nogen, skal kunne se hvem.
    const hvem = folk.length
      ? `<p class="xs soft mt1">${folk.map((p) => esc(p.navn)).join(" · ")}</p>`
      : "";
    return vagtKort(v, { ekstra: hvem });
  }).join("");

  const formular = kanOprette
    ? `<form method="post" action="${ROD_VAGTER}" class="maxw mt4" style="max-width:480px">
${felt({ label: TEKST.vagtHvad, name: "hvad", placeholder: "Køkken, aftensmad" })}
<p class="xs soft mt1">${esc(TEKST.vagtHvadNote)}</p>
<div class="g g-2 nb mt3">
<div>${felt({ label: TEKST.vagtDato, name: "dato", type: "date", required: true })}</div>
<div>${felt({ label: TEKST.vagtPladser, name: "pladser", type: "number", placeholder: "2" })}</div>
</div>
<p class="xs soft mt1">${esc(TEKST.vagtPladserNote)}</p>
<div class="g g-2 nb mt3">
<div>${felt({ label: TEKST.vagtFra, name: "fra", type: "time" })}</div>
<div>${felt({ label: TEKST.vagtTil, name: "til", type: "time" })}</div>
</div>
${felt({ label: TEKST.vagtHvor, name: "hvor", placeholder: "Hovedhuset", klasse: "mt3" })}
${felt({ label: TEKST.vagtNote, name: "note", klasse: "mt3" })}
<p class="mt3">${knap({ label: TEKST.vagtOpret, accent: true })}</p>
</form>`
    : `<div class="ramme mt4">
<p class="small">Du er logget ind som <strong>${esc(mail || TEKST.ukendt)}</strong>, men den adresse står ikke i personregisteret.</p>
<p class="meta mt2">En vagt skal vide, hvem der oprettede den, og det skal være et menneske, vi kender. Læg adressen ind under Stedet, så virker knappen her.</p>
</div>`;

  return side({
    titel: TEKST.vagter, aktiv: "vagter", bruger,
    indhold: `
<section class="stage blok">
<p class="sec">Stedet</p>
<h1>${esc(TEKST.vagter)}</h1>
<p class="lead maxw mt2">${esc(TEKST.vagterLead)}</p>
${besked ? `<p class="small mt3"${besked.ok ? "" : ' style="color:var(--accent)"'}>${esc(besked.t)}</p>` : ""}
${formular}
<div class="mt4">
<p class="meta-s">Kommende</p>
${vagter.length ? kort : `<p class="small mt2">${esc(TEKST.vagterTom)}</p>`}
</div>
<p class="xs soft mt4">${esc(TEKST.vagtIngenRangliste)}</p>
</section>`,
  });
}

/** Læser formularen og siger fra på dansk, ikke på SQL. */
export function laesVagt(fd, dagIdag) {
  const hvad = String(fd.get("hvad") || "").trim();
  const dato = String(fd.get("dato") || "").trim().slice(0, 10);
  const pladserRaa = String(fd.get("pladser") || "").trim();
  const pladser = Number(pladserRaa);

  if (!hvad || !/^\d{4}-\d{2}-\d{2}$/.test(dato) || !pladserRaa) {
    return { fejl: TEKST.vagtMangelFelter };
  }
  if (!Number.isInteger(pladser) || pladser < 1 || pladser > 50) {
    return { fejl: TEKST.vagtPladserTal };
  }
  // En vagt bagud er der ingen, der kan møde op til. Skemaet spærrer for
  // tilmelding til en gammel vagt; her spærres der for at lave den.
  if (dato < dagIdag) return { fejl: TEKST.vagtDatoFortid };

  const tid = (n) => {
    const v = String(fd.get(n) || "").trim();
    return /^\d{2}:\d{2}$/.test(v) ? v : null;
  };
  const tekst = (n) => {
    const v = String(fd.get(n) || "").trim();
    return v === "" ? null : v.slice(0, 400);
  };
  return {
    vagt: {
      hvad: hvad.slice(0, 200), dato, pladser,
      fra: tid("fra"), til: tid("til"),
      hvor: tekst("hvor"), note: tekst("note"),
    },
  };
}

export async function besvarVagter(request, env, bruger, url) {
  const db = env.FONDE_DB;
  const sti = url.pathname.replace(/\/+$/, "") || ROD_VAGTER;
  const dagIdag = idag(env);

  try {
    const mig = await hentPerson(db, bruger?.email);

    if (request.method === "POST" && sti === ROD_VAGTER) {
      if (!mig) return redirect(`${ROD_VAGTER}?m=ukendt`);
      const laest = laesVagt(await request.formData(), dagIdag);
      if (laest.fejl) return redirect(`${ROD_VAGTER}?f=${encodeURIComponent(laest.fejl)}`);
      await opretVagt(db, { ...laest.vagt, oprettet_af: mig.id });
      return redirect(`${ROD_VAGTER}?m=ny`);
    }

    if (request.method === "GET" && sti === ROD_VAGTER) {
      // person_id her er den, der kigger — kortet viser «Du er på», også for
      // den, der oprettede vagten. Én sandhed, samme kort begge steder.
      const vagter = await kommendeVagter(db, mig?.id || "", { fra_dato: dagIdag, graense: 60 });
      const paaHver = {};
      for (const v of vagter) paaHver[v.id] = await hvemStaarPaa(db, v.id);

      const f = url.searchParams.get("f");
      const m = url.searchParams.get("m");
      const besked = f ? { ok: false, t: f }
        : m === "ny" ? { ok: true, t: TEKST.vagtOprettet }
        : null;

      return html(vagterIntern({
        bruger, vagter, paaHver, besked,
        kanOprette: Boolean(mig), mail: bruger?.email,
      }));
    }

    return new Response("Findes ikke.", { status: 404 });
  } catch (e) {
    return html(side({
      titel: TEKST.fejl, aktiv: "vagter", bruger,
      indhold: fejlTilstand({ detalje: String(e.message || e) }),
    }), 500);
  }
}
