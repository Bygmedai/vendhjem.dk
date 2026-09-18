// /internt/fund — det, folk falder over undervejs.
//
// Modstykket til /internt/registrering: dén er den systematiske gennemgang,
// rum for rum. Her ligger alt det, man snublede over, mens man lavede noget
// andet — skrevet fra telefonen på /mit, i samme sekund man så det.
//
// Rækkefølgen er listens hele pointe: det, der haster, øverst, og det klarede
// nederst. En liste sorteret efter dato er en liste, ingen handler på.

import { fundListe, saetFundStatus } from "./db.js";
import { side, esc, tabel, knap, fejlTilstand } from "./flade.js";
import { TEKST } from "./tekst.js";

export const ROD_FUND = "/internt/fund";

const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const redirect = (til) => new Response(null, { status: 303, headers: { Location: til } });

export function erFund(sti) { return sti === ROD_FUND || sti.startsWith(ROD_FUND + "/"); }

function dato(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "";
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });
}

const STATUS_TEKST = { nyt: TEKST.fundNyt, set: TEKST.fundSet, klaret: TEKST.fundKlaret };

function fundSide({ bruger, fund }) {
  const raekker = fund.map((f) => {
    const klaret = f.status === "klaret";
    // Ét tryk frem ad gangen: nyt → set → klaret. Og én vej tilbage.
    const naeste = f.status === "nyt" ? "set" : "klaret";
    const naesteLabel = f.status === "nyt" ? TEKST.fundMarkerSet : TEKST.fundMarkerKlaret;
    return `<tr>
<td>${esc(dato(f.dato))}<span class="m">${esc(f.hvem)}</span></td>
<td>${esc(f.hvad)}${f.haster && !klaret ? ` <span class="tag tag-accent">${esc(TEKST.fundHasterMaerke)}</span>` : ""}</td>
<td>${esc(f.hvor || TEKST.streg)}</td>
<td>${esc(STATUS_TEKST[f.status] || f.status)}</td>
<td><form method="post" action="${ROD_FUND}/${esc(f.id)}/status">${
      klaret
        ? knap({ label: TEKST.fundAabnIgen, name: "status", value: "nyt" })
        : knap({ label: naesteLabel, name: "status", value: naeste })
    }</form></td>
</tr>`;
  });
  return side({
    titel: TEKST.fund, aktiv: "fund", bruger,
    indhold: `
<section class="stage blok">
<p class="sec">Stedet</p>
<h1>${esc(TEKST.fund)}</h1>
<p class="lead maxw mt2">${esc(TEKST.fundLead)}</p>
<div class="mt4">
${tabel({ hoved: ["Hvornår", "Hvad", "Hvor", "Status", ""], raekker, tom: TEKST.fundTom })}
</div>
</section>`,
  });
}

export async function besvarFund(request, env, bruger, url) {
  const db = env.FONDE_DB;
  const sti = url.pathname.replace(/\/+$/, "") || ROD_FUND;
  try {
    if (request.method === "GET" && sti === ROD_FUND) {
      return html(fundSide({ bruger, fund: await fundListe(db) }));
    }
    const m = sti.match(new RegExp(`^${ROD_FUND}/([A-Za-z0-9_-]{4,64})/status$`));
    if (request.method === "POST" && m) {
      const fd = await request.formData();
      const oensket = String(fd.get("status"));
      const status = ["nyt", "set", "klaret"].includes(oensket) ? oensket : "nyt";
      await saetFundStatus(db, m[1], status);
      return redirect(ROD_FUND);
    }
    return new Response("Findes ikke.", { status: 404 });
  } catch (e) {
    return html(side({
      titel: TEKST.fejl, aktiv: "fund", bruger,
      indhold: fejlTilstand({ detalje: String(e.message || e) }),
    }), 500);
  }
}
