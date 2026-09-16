// HTML i Havkant-registret. Samme stylesheet som resten af sitet
// (/assets/vh.css) — ingen nye farver, ingen runde hjørner, ingen skygger.
// Serverrenderet. Ingen framework, intet byggetrin.

import { PUNKTER } from "./nav-internt.js";

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Navigationen kommer fra nav-internt.json via build.py's generator.
// Den var haandskrevet her og drev fra de statiske sider: Fonde manglede der,
// Registrering manglede her, og man kunne ikke komme fra OEkonomi til Fonde.
const nav = (aktiv) => `<nav class="nav" aria-label="Internt">
${PUNKTER.map((p) =>
  `<a href="/${p.sti}"${p.id === aktiv ? ' aria-current="page"' : ""}>${esc(p.label)}</a>`
).join("\n")}
</nav>`;

export function side({ titel, aktiv, bruger, indhold }) {
  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titel)} · Internt</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#e9e7e0">
<link rel="preload" href="/assets/fonts/lora-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/jetbrains-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/vh.css">
<style>
.frist { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.frist.naer { color: var(--accent); font-weight: 500; }
.pil { display:flex; gap:0; flex-wrap:wrap; margin:0; padding:0; list-style:none; }
.pil > li { font-family: var(--mono); font-size:9px; letter-spacing:.14em; text-transform:uppercase;
            border:1px solid var(--streg-mork); border-right:0; padding:7px 11px; color:var(--blaek-svag); }
.pil > li:last-child { border-right:1px solid var(--streg-mork); }
.pil > li.naaet { color:var(--blaek); }
.pil > li.her { background:var(--blaek); color:var(--papir); border-color:var(--blaek); font-weight:500; }
.mangler { color: var(--accent); }
table.t { width:100%; border-collapse:collapse; }
table.t th { font-family:var(--mono); font-size:9px; letter-spacing:.18em; text-transform:uppercase;
             color:var(--blaek-svag); text-align:left; font-weight:400; padding:0 12px 8px 0; }
table.t td { padding:11px 12px 11px 0; border-top:1px solid var(--streg-svag); font-size:15px; vertical-align:top; }
.knap { font-family:var(--mono); font-size:10px; letter-spacing:.16em; text-transform:uppercase;
        background:transparent; border:1px solid var(--streg-mork); color:var(--blaek);
        padding:9px 14px; cursor:pointer; border-radius:0; }
.knap:hover { border-color:var(--blaek); }
.knap-accent { border-color:var(--accent); color:var(--accent); }
.vaelg { font-family:var(--serif); font-size:15px; background:transparent; border:0;
         border-bottom:1px solid var(--streg-mork); padding:7px 0; color:var(--blaek); border-radius:0; width:100%; }
textarea.felt { min-height:80px; font-family:var(--serif); }
.logl { font-family:var(--mono); font-size:11px; color:var(--blaek-mat); padding:6px 0;
        border-bottom:1px solid var(--streg-svag); display:flex; gap:14px; justify-content:space-between; }
</style>
</head>
<body>
<header class="site-head intern">
<div class="stage row">
<a class="brand" href="/internt/">Vend <em>Hjem</em> <span class="meta" style="margin-left:10px">Internt</span></a>
${nav(aktiv)}
</div>
</header>
<main>
${indhold}
</main>
<footer class="site-foot">
<div class="stage row">
<p>Intern side · bag login · ${esc(bruger?.navn || "ukendt")}</p>
<p>Tal og status her er arbejdsgrundlag, ikke et regnskab. Kilde og dato står ved hver post.</p>
</div>
</footer>
</body>
</html>`;
}

const TRIN = ["kladde", "til_godkendelse", "godkendt", "indsendt"];
const TRIN_NAVN = {
  kladde: "Kladde",
  til_godkendelse: "Til godkendelse",
  godkendt: "Godkendt",
  indsendt: "Indsendt",
};

export function trinlinje(status) {
  const i = TRIN.indexOf(status);
  return `<ul class="pil">${TRIN.map((t, n) =>
    `<li class="${n === i ? "her" : n < i ? "naaet" : ""}">${TRIN_NAVN[t]}</li>`
  ).join("")}</ul>`;
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
