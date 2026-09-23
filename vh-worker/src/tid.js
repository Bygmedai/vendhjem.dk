// Tid. Ét sted, fordi to flader, der tæller dage hver for sig, en dag tæller
// forskelligt — og den ene af dem bærer et løfte til et menneske udefra.
//
// Stod indtil 23.09.2026 kun i breve.js. /internt/ophold havde ingen tælling
// overhovedet: kvitteringen lovede svar inden tre dage, og ingen flade viste,
// hvornår de tre dage var gået.

/** Hele dage siden et ISO-tidsstempel. Ugyldig dato giver 0 — en liste, der
 *  kaster på en skæv række, viser ingen af de andre. */
export function dageSiden(iso, nu = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((nu - t) / 86400000);
}
