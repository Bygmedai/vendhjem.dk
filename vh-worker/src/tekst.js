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
};
