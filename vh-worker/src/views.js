// Fonds-specifik visning oven på flade.js. Ingen eget stylesheet.

import { esc, statusPil } from "./flade.js";

export { esc, side, nav, tabel, felt, knap, statusPil, tomTilstand, fejlTilstand } from "./flade.js";

const FONDS_TRIN = [
  { id: "kladde", label: "Kladde" },
  { id: "til_godkendelse", label: "Til godkendelse" },
  { id: "godkendt", label: "Godkendt" },
  { id: "indsendt", label: "Indsendt" },
];

export function trinlinje(status) {
  return statusPil(FONDS_TRIN, status);
}

/** Dage til frist. Returnerer null når fristen ikke kendes — opfinder ikke en. */
export function dageTil(iso) {
  if (!iso) return null;
  return Math.floor((Date.parse(iso) - Date.now()) / 86400000);
}

export function fristTekst(c) {
  if (!c?.frist_utc) return `<span class="meta">Ingen frist oplyst</span>`;
  const d = dageTil(c.frist_utc);
  const dato = new Date(c.frist_utc).toLocaleString("da-DK", {
    timeZone: c.frist_tz || "Europe/Copenhagen",
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const naer = d !== null && d <= 30;
  return `<span class="frist${naer ? " naer" : ""}">${esc(dato)}</span>
<span class="meta" style="display:block;margin-top:4px">${d < 0 ? "overskredet" : `om ${d} dage`}</span>`;
}
