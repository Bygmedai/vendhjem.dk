// Mail. Resend når RESEND_API_KEY er sat.
// Uden nøgle: log (dev/prøver). Opfinder ikke at produktionssending virker.
// /mit og opholds-forespørgsel bruger den samme vej — ingen ny auth.

export async function sendMail(env, { to, subject, text, ...rest }) {
  const msg = { to, subject, text, ...rest };

  if (typeof env.mailSink === "function") {
    await env.mailSink(msg);
    return { ok: true, via: "sink" };
  }

  if (env.RESEND_API_KEY) {
    const fra = env.MAIL_FRA || "Vendhjem <besked@vendhjem.dk>";
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: fra, to: [to], subject, text, ...(rest.reply_to ? { reply_to: rest.reply_to } : {}) }),
    });
    if (!r.ok) {
      const detalje = await r.text();
      throw new Error(`Resend svarede ${r.status}: ${detalje.slice(0, 200)}`);
    }
    return { ok: true, via: "resend" };
  }

  // Uden nøgle bliver der ikke sendt noget. Det skal svaret sige. En funktion,
  // der returnerer ok for en mail, den ikke har sendt, gør fejlen usynlig hele
  // vejen op — præcis den slags, der bliver fundet af en, der venter forgæves.
  console.log(`[mail] ingen RESEND_API_KEY — mail IKKE sendt.\n${subject}\n${text}`);
  return { ok: false, via: "ingen-noegle", grund: "RESEND_API_KEY mangler" };
}

/** Hvem paa Agersoe der faar post, naar nogen skriver eller foresporger.
 *  ÉT sted. Kopieres den, siger brevsporet og forespoergselssporet en dag
 *  hver sit om, hvem der skal have besked — samme fejlklasse som reglerne,
 *  der stod to steder i Natten.
 *
 *  Laa i breve.js indtil 23.09.2026. Den flyttede hertil, da kvitteringerne
 *  skulle svare tilbage til den samme adresse: mail.js kender modtagerne,
 *  breve.js og ophold.js kender kun mail.js. Ingen ring mellem modulerne.
 *
 *  BREV_TIL er deklareret i wrangler.toml. Stod den kun i dashboardet, slettede
 *  hvert deploy den: wrangler sletter alle vars foer den saetter dem fra
 *  konfigurationen, medmindre keep_vars er sat. Maalt i Cloudflares egen
 *  dokumentation 23.09.2026. Fallbacken er den gamle mailto-adresse. */
export function modtagere(env) {
  return String(env.BREV_TIL || "laiydeh@gmail.com").split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Mail til et menneske udefra — kvittering, bekraeftelse, afslag.
 *
 * Den SKAL kunne besvares. Indtil 23.09.2026 satte kun mailen *til huset* et
 * reply_to; de fire, der gik den anden vej, satte ingen. Lai kunne svare
 * gaesten med ét klik, gaesten kunne ikke svare Lai: Reply gik til
 * besked@vendhjem.dk. Et menneske med et spoergsmaal — kan jeg komme dagen
 * foer, har I plads til to — havde kun den knap.
 *
 * Derfor gaar det her igennem ét sted og ikke gennem sendMail: en ny mail til
 * et menneske arver svarvejen i stedet for at skulle huske den.
 */
export async function sendTilMenneske(env, { to, ...brev }) {
  return sendMail(env, { to, ...brev, reply_to: modtagere(env)[0] });
}

export async function sendMagicMail(env, { to, url }) {
  const subject = "Dit link ind til Vendhjem";
  const text =
    `Her er dit link. Det virker i et kvarter, og kun i den browser du bad om det fra.\n\n` +
    `${url}\n\n` +
    `Hvis du ikke har bedt om det, kan du lade være med at klikke.`;
  return sendMail(env, { to, subject, text, url });
}
