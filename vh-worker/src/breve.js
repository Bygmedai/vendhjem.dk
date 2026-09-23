// Brevet på /bliv-en-del (BYG-558 B1).
// Offentlig: POST /bliv-en-del/skriv — uden Access, uden login. Brevet gemmes
// i D1, går pr. mail til den der svarer (BREV_TIL), og afsenderen får en
// kvittering. Intern: /internt/breve — listen bag Access.
//
// Før lå der en mailto: i formularen. På telefon og i browsere uden mail-
// program skete der ingenting, når man trykkede Send. Målt 18.09.2026.

import { findEllerOpretPerson, opretBrev, saetBrevMailFejl, saetBrevStatus, breveListe,
         loginForsoegUdenAdgang } from "./db.js";
import { offentligSkal } from "./ophold-sider.js";
import { side, esc, tabel, knap, tomTilstand, fejlTilstand } from "./flade.js";
import { TEKST, brevTilOs, brevKvittering } from "./tekst.js";
import { sendMail, sendTilMenneske, modtagere } from "./mail.js";
import { dageSiden } from "./tid.js";

export const STI_SKRIV = "/bliv-en-del/skriv";
export const ROD_BREVE = "/internt/breve";
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_TEGN = 20;
const MAX_TEGN = 20000;
const MIN_MS = 3000;

const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const redirect = (til, besked) =>
  new Response(null, { status: 303, headers: { Location: besked ? `${til}?m=${encodeURIComponent(besked)}` : til } });

export function erSkriv(sti) { return sti === STI_SKRIV; }
export function erBreve(sti) { return sti === ROD_BREVE || sti.startsWith(ROD_BREVE + "/"); }

function takSide({ navn }) {
  return offentligSkal({
    titel: TEKST.brevTakH1,
    canonical: "/bliv-en-del",
    description: TEKST.brevTakLead,
    aktiv: "bliv-en-del",
    indhold: `
<section class="stage blok">
<p class="sec">Bliv en del</p>
<h1 class="stor maxw">${esc(TEKST.brevTakH1)}</h1>
<p class="lead maxw mt3">${esc(TEKST.brevTakLead)}</p>
<p class="small soft maxw mt3">${esc(navn)}</p>
<p class="mt3"><a class="lnk" href="/bliv-en-del">Tilbage →</a></p>
</section>`,
  });
}

function fejlSide(besked, status = 400) {
  return html(offentligSkal({
    titel: "Brevet blev ikke sendt",
    canonical: "/bliv-en-del",
    description: besked,
    aktiv: "bliv-en-del",
    indhold: `
<section class="stage blok">
<p class="sec">Bliv en del</p>
<h1 class="stor maxw">Brevet blev ikke sendt.</h1>
<p class="lead maxw mt3">${esc(besked)}</p>
<p class="mt3"><a class="lnk" href="/bliv-en-del#brev">Tilbage til brevet →</a></p>
</section>`,
  }), status);
}

/** Offentlig: modtag brevet. GET sendes tilbage til siden med formularen. */
export async function besvarSkriv(request, env) {
  if (request.method !== "POST") return redirect("/bliv-en-del#brev");
  const db = env.FONDE_DB;

  const fd = await request.formData();
  // Honningkrukke: feltet er skjult for mennesker. Udfyldt = robot. Svar som
  // om alt gik godt, så robotten ikke lærer noget.
  if (String(fd.get("website") || "").trim()) return html(takSide({ navn: "" }));
  // Tid fra siden blev åbnet. Mangler den (JS slået fra) går brevet igennem;
  // er den der og under 3 sekunder, er det ikke et menneske der har skrevet.
  const t = Number(fd.get("t") || 0);
  if (t && Date.now() - t < MIN_MS) return fejlSide(TEKST.brevForHurtigt);

  const navn = String(fd.get("navn") || "").trim().slice(0, 200);
  const mail = String(fd.get("mail") || "").trim().slice(0, 200);
  const tekst = String(fd.get("brevet") || "").replace(/\r\n/g, "\n").trim();
  if (!navn || !MAIL_RE.test(mail) || !tekst) return fejlSide(TEKST.brevManglerFelter);
  if (tekst.length < MIN_TEGN) return fejlSide(TEKST.brevForKort);
  if (tekst.length > MAX_TEGN) return fejlSide(TEKST.brevForLangt);

  const person = await findEllerOpretPerson(db, { navn, mail });
  const brev = await opretBrev(db, { person_id: person.id, navn, mail, tekst });

  const fejl = [];
  const tilOs = brevTilOs({ navn, mail, tekst, oprettet: brev.oprettet });
  for (const to of modtagere(env)) {
    try { await sendMail(env, { to, ...tilOs, reply_to: mail }); }
    catch (e) { fejl.push(`${to}: ${String(e.message || e)}`); }
  }
  try { await sendTilMenneske(env, { to: mail, ...brevKvittering({ navn }) }); }
  catch (e) { fejl.push(`kvittering: ${String(e.message || e)}`); }
  await saetBrevMailFejl(db, brev.id, fejl.length ? fejl.join(" · ") : null);

  return html(takSide({ navn }));
}

function dato(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "";
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });
}

const VENTER_DAGE = 7;

function statusTekst(b) {
  if (b.status !== "nyt") return TEKST.brevBesvaret;
  const d = dageSiden(b.oprettet);
  return d >= VENTER_DAGE ? TEKST.brevVenter(d) : TEKST.brevNyt;
}

const FORSOEG_TEKST = {
  uden_rolle: TEKST.loginUdenRolle,
  ukendt_mail: TEKST.loginUkendt,
  mail_fejlede: TEKST.loginMailFejl,
};

/** Dem, der bankede på uden at komme ind. Se migration 0013 om hvorfor. */
function forsoegAfsnit(forsoeg) {
  const raekker = forsoeg.map((f) => `<tr>
<td>${esc(dato(f.oprettet))}</td>
<td>${esc(f.mail)}</td>
<td>${esc(FORSOEG_TEKST[f.resultat] || f.resultat)}</td>
</tr>`);
  return `<section class="stage blok blok-top">
<p class="sec">${esc(TEKST.loginForsoeg)}</p>
<p class="small maxw mt2">${esc(TEKST.loginForsoegLead)}</p>
<div class="mt3">
${tabel({ hoved: ["Hvornår", "Adresse", "Hvorfor ikke"], raekker, tom: TEKST.loginTom })}
</div>
</section>`;
}

function breveSide({ bruger, breve, forsoeg = [], advarsel }) {
  const raekker = breve.map((b) => {
    const nyt = b.status === "nyt";
    return `<tr>
<td>${esc(dato(b.oprettet))}</td>
<td>${esc(b.navn)}<br><a class="lnk" href="mailto:${esc(b.mail)}?subject=${encodeURIComponent("Sv: dit brev til Vendhjem")}">${esc(b.mail)}</a></td>
<td><details><summary>${esc(b.tekst.slice(0, 90))}${b.tekst.length > 90 ? "…" : ""}</summary><p class="small mt2" style="white-space:pre-wrap">${esc(b.tekst)}</p></details>${b.mail_fejl ? `<p class="small mt2">${esc(TEKST.mailFejl)}: ${esc(b.mail_fejl)}</p>` : ""}</td>
<td>${nyt && dageSiden(b.oprettet) >= VENTER_DAGE ? `<strong>${esc(statusTekst(b))}</strong>` : esc(statusTekst(b))}</td>
<td><form method="post" action="${ROD_BREVE}/${esc(b.id)}/status">${knap({ label: nyt ? TEKST.markerBesvaret : TEKST.markerNyt, name: "status", value: nyt ? "besvaret" : "nyt" })}</form></td>
</tr>`;
  });
  return side({
    titel: TEKST.breve, aktiv: "breve", bruger,
    indhold: `
<section class="stage blok">
<p class="sec">Bliv en del</p>
<h1>${esc(TEKST.breve)}</h1>
<p class="lead maxw mt2">Det folk skriver på /bliv-en-del. Nye øverst. Svar fra din egen mail — knappen her holder kun styr på, hvad der er svaret på.</p>
${advarsel ? `<p class="small mt2">${esc(advarsel)}</p>` : ""}
<div class="mt4">
${tabel({ hoved: ["Modtaget", "Fra", "Brevet", "Status", ""], raekker, tom: TEKST.tomBreve })}
</div>
</section>
${forsoegAfsnit(forsoeg)}`,
  });
}

/** Intern: listen og status-skift. Kaldes efter identitet(). */
export async function besvarBreve(request, env, bruger, url) {
  const db = env.FONDE_DB;
  const sti = url.pathname.replace(/\/+$/, "") || ROD_BREVE;
  try {
    if (request.method === "GET" && sti === ROD_BREVE) {
      const [breve, forsoeg] = await Promise.all([breveListe(db), loginForsoegUdenAdgang(db)]);
      return html(breveSide({ bruger, breve, forsoeg, advarsel: url.searchParams.get("m") }));
    }
    const m = sti.match(new RegExp(`^${ROD_BREVE}/([A-Za-z0-9_-]{4,64})/status$`));
    if (request.method === "POST" && m) {
      const fd = await request.formData();
      const status = String(fd.get("status")) === "besvaret" ? "besvaret" : "nyt";
      const b = await saetBrevStatus(db, m[1], status);
      if (!b) return redirect(ROD_BREVE, "Brevet findes ikke.");
      return redirect(ROD_BREVE);
    }
    return new Response("Findes ikke.", { status: 404 });
  } catch (e) {
    return html(side({
      titel: TEKST.fejl, aktiv: "breve", bruger,
      indhold: fejlTilstand({ detalje: String(e.message || e) }),
    }), 500);
  }
}
