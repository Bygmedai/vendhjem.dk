// /internt/sikkerhedskopi — knappen og svaret paa «findes der en kopi?»
//
// HVORFOR DEN FINDES
//
// Sikkerhedskopien blev bygget i #45 og var rigtigt bygget. Men den kunne kun
// udloeses af cron, og cron stod til den 1. i maaneden. Maalt 18.09.2026:
// nul kopier fandtes, foerste koersel var 1. oktober, og ingen havde nogensinde
// laest en tilbage.
//
// Tre ting manglede, og det er dem, siden her giver:
//   1. en maade at tage en kopi NU — foer en risikabel aendring, eller fordi
//      man lige er blevet utryg;
//   2. et svar paa hvor gammel den nyeste er, uden at skulle logge paa
//      Cloudflare;
//   3. et sted, hvor gendannelsen staar skrevet ned, saa den ikke skal
//      opfindes den dag, den skal bruges.
//
// Siden viser TAL og DATOER. Aldrig indhold: ingen navne, ingen breve, ingen
// beloeb. Den, der kan se den her, kan i forvejen se det hele — men en side,
// der lister databasens indhold, er en ekstra kopi af det, ét sted mere.

import { koerSikkerhedskopi, sidsteKopi } from "./sikkerhedskopi.js";
import { side, esc, knap, tabel } from "./flade.js";
import { TEKST } from "./tekst.js";

export const ROD_KOPI = "/internt/sikkerhedskopi";

const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const redirect = (til) => new Response(null, { status: 303, headers: { Location: til } });

export function erKopi(sti) { return sti === ROD_KOPI || sti.startsWith(ROD_KOPI + "/"); }

function dato(iso) {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso || "";
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });
}

/** Hvor bekymret skal man vaere? Tallet er doegn siden nyeste kopi. */
function tilstand(k) {
  if (!k.ok) return { ord: TEKST.kopiUkendt, tone: "tag-accent" };
  if (!k.findes) return { ord: TEKST.kopiIngen, tone: "tag-accent" };
  if (k.alder_doegn === null) return { ord: TEKST.kopiUkendt, tone: "tag-accent" };
  if (k.alder_doegn <= 1) return { ord: TEKST.kopiFrisk, tone: "tag" };
  if (k.alder_doegn <= 7) return { ord: TEKST.kopiGammel, tone: "tag" };
  return { ord: TEKST.kopiForGammel, tone: "tag-accent" };
}

function kopiSide({ bruger, k, netopKoert }) {
  const t = tilstand(k);
  const raekker = [
    `<tr><td>${esc(TEKST.kopiNyeste)}</td><td>${k.findes ? esc(dato(k.nyeste)) : esc(TEKST.streg)} <span class="${t.tone}">${esc(t.ord)}</span></td></tr>`,
    `<tr><td>${esc(TEKST.kopiAlder)}</td><td>${k.findes && k.alder_doegn !== null ? esc(String(k.alder_doegn)) : esc(TEKST.streg)}</td></tr>`,
    `<tr><td>${esc(TEKST.kopiAntal)}</td><td>${esc(String(k.antal ?? 0))}</td></tr>`,
  ];
  return side({
    titel: TEKST.kopi, aktiv: "kopi", bruger,
    indhold: `
<section class="stage blok">
<p class="sec">Stedet</p>
<h1>${esc(TEKST.kopi)}</h1>
<p class="lead maxw mt2">${esc(TEKST.kopiLead)}</p>
${netopKoert ? `<p class="mt3"><span class="tag">${esc(TEKST.kopiNetopKoert)}</span> ${esc(netopKoert)}</p>` : ""}
<div class="mt4">${tabel({ hoved: [TEKST.kopiHvad, TEKST.kopiStatus], raekker, tom: TEKST.streg })}</div>
<form method="post" action="${ROD_KOPI}/nu" class="mt4">${knap({ label: TEKST.kopiTagNu })}</form>
<p class="meta mt4 maxw">${esc(TEKST.kopiGendan)}</p>
</section>`,
  });
}

export async function besvarKopi(request, env, bruger, url) {
  const sti = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "POST" && sti === ROD_KOPI + "/nu") {
    const r = await koerSikkerhedskopi(env);
    // Resultatet i adressen, ikke i en session: siden skal kunne genindlaeses
    // og videresendes uden at paastaa noget, der ikke skete.
    const q = r.ok ? `?skrevet=${encodeURIComponent(`${r.tabeller} tabeller, ${r.raekker} raekker`)}` : `?fejl=1`;
    return redirect(ROD_KOPI + q);
  }

  if (request.method === "GET" && sti === ROD_KOPI) {
    const k = await sidsteKopi(env);
    return html(kopiSide({ bruger, k, netopKoert: url.searchParams.get("skrevet") }));
  }

  return redirect(ROD_KOPI);
}
