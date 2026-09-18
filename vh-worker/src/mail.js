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

export async function sendMagicMail(env, { to, url }) {
  const subject = "Dit link ind til Vendhjem";
  const text =
    `Her er dit link. Det virker i et kvarter, og kun i den browser du bad om det fra.\n\n` +
    `${url}\n\n` +
    `Hvis du ikke har bedt om det, kan du lade være med at klikke.`;
  return sendMail(env, { to, subject, text, url });
}
