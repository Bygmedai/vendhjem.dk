// Standardtekster. Én formulering, dansk som et menneske taler.
// Ny flade: importer herfra. Skriv ikke en ottende variant.

export const TEKST = {
  tomListe: "Ingen sager endnu.",
  tomAktivitet: "Ingen hændelser.",
  mangler: "mangler",
  manglerN: (a, b) => `${a} af ${b} mangler`,
  gem: "Gem",
  gemt: "Gemt.",
  ukendt: "ukendt",
  streg: "—",
  ingenAdgang: "Ingen adgang",
  ingenAdgangH1: "Den her side kræver, at du er logget ind som menneske.",
  ingenAdgangLead: "Servicetokens kan læse, men ikke godkende eller indsende. Det er med vilje: en maskine må ikke stå som den, der traf beslutningen.",
  fejl: "Fejl",
  fejlH1: "Handlingen blev ikke gennemført.",
  fejlLead: "Intet er markeret som godkendt eller indsendt på et forkert grundlag.",
  ingenBeslutning: "Ingen beslutning endnu.",
  kanIkkeIndsende: "Kan først registreres, når en gældende godkendelse ligger på den aktuelle pakke.",
  internFod: (navn) => `Intern side · bag login · ${navn}`,
  internNote: "Tal og status her er arbejdsgrundlag, ikke et regnskab. Kilde og dato står ved hver post.",

  logUd: "Log ud",
  tilForsiden: "← Offentlig side",
  mitFod: (navn) => `Fællesskabet · ${navn}`,
  mitFodGaest: "Fællesskabet · et link i mailen, så er du inde",
  mitNote: "Linket virker i et kvarter, og kun i den browser du bad om det fra.",
  mitNoteInde: "Appen virker uden net. Det, du skriver uden forbindelse, bliver sendt, når der er net igen.",
  mitSvar: "Hvis adressen hører til nogen her, ligger der en mail nu.",
  mitLoginH1: "Et link, så er du inde.",
  mitLoginLead: "Skriv den mail, vi kender dig på. Vi sender et link. Ingen adgangskode.",
  mitKnap: "Send mig et link",
  mitMailLabel: "Din mail",
  mitIndeLead: "Der kommer mere, når det er bygget. Indtil da er det nok at være inde.",
  mitLinkBrugt: "Det link er allerede brugt. Bed om et nyt.",
  mitLinkGammelt: "Det link er for gammelt. Bed om et nyt.",
  mitLinkAndenBrowser: "Det link hører til en anden browser. Åbn det dér, hvor du bad om det.",
  mitLinkAndenBrowserHjaelp: "Bed om et nyt link herfra, og åbn mailen på samme måde igen — så er browseren den samme hele vejen. Åbner du mailen i Gmail-appen, sker det af sig selv.",
  loginForsoeg: "Nogen kom ikke ind",
  loginForsoegLead: "Hvem har bedt om et link uden at få et. Siden svarer det samme til alle udefra; her står, hvad der faktisk skete.",
  loginTom: "Alle, der har bedt om et link, har fået et.",
  loginUdenRolle: "Kendt person uden gyldig rolle",
  loginUkendt: "Ukendt adresse",
  loginMailFejl: "Mailen kunne ikke sendes",
  mitLinkUgyldigt: "Det link virker ikke. Bed om et nyt.",
  mitPasskeyTilbud: "Skal den her enhed huske dig? Så er du inde næste gang uden at tjekke mail.",
  mitPasskeyJa: "Ja, husk den",
  mitPasskeyNej: "Nej tak — spørg ikke igen",
  mitPasskeyIgang: "Browseren spørger nu, om den må huske dig. Det tager et øjeblik.",
  mitPasskeyFejl: "Det lykkedes ikke at huske enheden. Du er stadig inde — prøv igen næste gang, eller lad være. Magic link virker uanset.",
  mitSessionMangler: "Login er ikke sat op endnu (SESSION_NOEGLE mangler). Sig det til den, der driver siden.",

  // /mit — de tre faner (BYG-569 H1)
  fanerNu: "Nu",
  fanerSkriv: "Skriv",
  fanerOverblik: "Overblik",
  timerH1: "Hvad lavede du?",
  timerLead: "Skriv det, når dagen er slut. Det tager under et minut, og det behøver ikke være pænt.",
  timerHvad: "Hvad lavede du",
  timerHvadNote: "En sætning er nok. «Ryddede op i laden» tæller.",
  timerAntal: "Timer",
  timerDato: "Dato",
  timerGem: "Gem",
  timerGemt: "Gemt. Det står nu i stedets regnskab.",
  timerMangler: "Skriv hvad du lavede, og hvor mange timer det tog.",
  timerForMange: "Mere end 16 timer på én dag er nok to dage. Del den op.",
  timerFremtid: "Den dato ligger i fremtiden. Skriv den, når dagen er gået.",
  timerFejl: "Kunne ikke gemme lige nu. Det, du skrev, står der stadig.",
  timerKoe: "Gemt på telefonen. Den sendes, når der er net igen.",
  timerTom: "Ingen timer skrevet endnu.",

  // «Noget jeg så» — fund fra stedet
  slagsTimer: "Timer",
  slagsFund: "Noget jeg så",
  skrivH1: "Hvad har du på hjerte?",
  skrivLead: "To slags: timer, du har lagt, og ting, du er faldet over. Begge dele tager under et minut.",
  fundHvad: "Hvad så du",
  fundHvadNote: "Skriv det, som du ville sige det. «Taget drypper over sovesalen» er nok.",
  fundHvor: "Hvor",
  fundHvorNote: "Laden, nordvæggen. Så vi kan finde derhen.",
  fundHaster: "Det kan ikke vente",
  fundGemt: "Gemt. Nu står det et sted, hvor det ikke bliver glemt.",
  fundMangler: "Skriv hvad du så.",
  fundTom: "Ingen fund endnu.",
  fundMine: "Det, du har set",
  fund: "Fund",
  fundLead: "Det, folk falder over undervejs. Det, der haster, ligger øverst; det klarede nederst.",
  fundNyt: "Nyt",
  fundSet: "Set",
  fundKlaret: "Klaret",
  fundMarkerSet: "Markér set",
  fundMarkerKlaret: "Markér klaret",
  fundAabnIgen: "Åbn igen",
  fundHasterMaerke: "Haster",
  ingenAftale: "Du har ingen aftale endnu. Timerne bliver gemt som frivillige, indtil der er en.",
  aftaleH: "Din aftale",
  aftaleSlut: (d) => `Løber til ${d}`,
  aftaleUdenSlut: "Ingen slutdato — du er her som gæst",
  aftaleTimer: (n) => `${n} timer om året, som vi aftalte det`,
  aftaleUdenTimer: "Ingen aftalte timer",
  mitIntetOphold: "Du står ikke på et ophold lige nu.",
  mitFaellesH: "Stedet i år",
  mitFaellesTom: "Ingen har skrevet timer ind i år endnu. Den første linje er din.",
  mitIngenRangliste: "Der står ikke, hvem der har lagt hvad. Det gør der heller ikke senere.",
  aftalt: "Det, vi har aftalt",
  aftaltLink: "Det, vi har aftalt om nætterne →",

  antagelse: "antagelse",
  adgangskrav: "Adgangskrav",
  vurdering: "Vurdering",
  markerKlar: "Markér klar",
  arkiver: "Arkivér",
  historiskIndsend: "Registrér historisk indsendelse",
  klarBlokeret: "Bekræftet uopfyldt adgangskrav. Sagen kan ikke markeres klar.",

  tomOphold: "Ingen ophold i kalenderen endnu.",
  tomKalender: "Ingen datoer i kalenderen endnu. Når et ophold åbnes, står det her.",
  ingenDatoerSpor: "Ingen datoer åbne på det her spor endnu.",
  opretOphold: "Opret ophold",
  tomPladser: "Ingen på listen endnu.",

  forespørg: "Forespørg",
  sendForespørg: "Send forespørgsel",
  forespørgNavn: "Dit navn",
  forespørgMail: "Din mail",
  forespørgBesked: "Hvis der er noget, vi skal vide",
  takH1: "Tak. Vi vender tilbage.",
  takLead: "Vi har din forespørgsel. Inden tre dage skriver vi tilbage, om pladsen er din.",
  opholdFuldt: "Opholdet er fuldt. Vi tager ikke flere forespørgsler på den her dato.",
  opholdIkkeAabent: "Det ophold kan ikke forespørges på.",
  bekraeft: "Bekræft",
  afvis: "Afvis",
  forespørgsler: "Forespørgsler",
  mailFejl: "Mailen nåede ikke frem",
  kendtSom: (navn, mail) => `Vi kender dig som ${navn} (${mail}).`,

  // Brevet på /bliv-en-del (BYG-558 B1)
  breve: "Breve",
  brevTakH1: "Tak for dit brev.",
  brevTakLead: "Vi har det. Lai svarer inden 7 dage, på den mail du skrev.",
  brevManglerFelter: "Skriv navn, en rigtig mail og selve brevet.",
  brevForKort: "Brevet er for kort til at være et brev. Skriv lidt mere.",
  brevForLangt: "Brevet er for langt. Der er plads til 20.000 tegn.",
  brevForHurtigt: "Det gik for hurtigt. Prøv igen.",
  brevNyt: "Nyt",
  brevBesvaret: "Besvaret",
  brevVenter: (d) => `Nyt · har ventet ${d} dage`,
  markerBesvaret: "Markér besvaret",
  markerNyt: "Markér nyt",
  tomBreve: "Ingen breve endnu.",
};

export function brevTilOs({ navn, mail, tekst, oprettet }) {
  return {
    subject: `Brev til Vend Hjem fra ${navn}`,
    text:
      `Fra: ${navn} <${mail}>\n` +
      `Modtaget: ${oprettet}\n\n` +
      `${tekst}\n\n` +
      `—\nSvar direkte på denne mail. Brevet ligger også på vendhjem.dk/internt/breve.`,
  };
}

export function brevKvittering({ navn }) {
  return {
    subject: "Vi har dit brev",
    text:
      `Hej ${navn}\n\n` +
      `Vi har dit brev. Lai svarer inden 7 dage, på den mail du skrev fra.\n\n` +
      `Lai Yde\nVend Hjem, Agersø`,
  };
}

export function kvitteringBrev({ navn, type_navn, periode }) {
  return {
    subject: `Vi har din forespørgsel på ${type_navn}`,
    text:
      `Hej ${navn}\n\n` +
      `Vi har din forespørgsel på ${type_navn}, ${periode}.\n\n` +
      `Inden tre dage skriver vi tilbage, om pladsen er din.\n\n` +
      `Vendhjem\nAgersø`,
  };
}

export function bekraeftelsesBrev({ navn, type_navn, periode, inkluderet, pris_note, spor, vis_pris }) {
  const med = inkluderet
    ? `Det der er inkluderet: ${inkluderet}.`
    : (pris_note || "Hvad der er med, skriver vi her, når det er sat.");
  const pris = vis_pris != null
    ? `${Number(vis_pris).toLocaleString("da-DK")} kr.${pris_note ? ` — ${pris_note}` : ""}`
    : (pris_note || "");
  const haveMed = spor === "stille"
    ? "Der er ingen mad i opholdet. Tag det med, du skal spise, og det sengetøj du sover i."
    : "Tag sovepose eller eget sengetøj med. Der er ingen, der brokker sig over det.";

  return {
    subject: `Du er med — ${type_navn}`,
    text:
      `Hej ${navn}\n\n` +
      `Du er med. ${type_navn}, ${periode}.\n\n` +
      `Færgen går fra Stigsnæs. Et kvarter over vandet. Den betaler du selv — den er ikke med i opholdet.\n\n` +
      `${haveMed}\n\n` +
      `${med}${pris ? `\n${pris}` : ""}\n\n` +
      `Vi ses på Agersø.\n\n` +
      `Vendhjem`,
  };
}
