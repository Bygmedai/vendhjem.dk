// Fælles serverkomponenter til interne flader. Ingen React, intet byggetrin.
// side · nav · tabel · felt · knap · status-pil · tom · fejl
// Udseende kommer fra assets/vh.css. Ny klasse eller ny farve = prøven fejler.

import { PUNKTER } from "./nav-internt.js";
import { TEKST } from "./tekst.js";

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function nav(aktiv) {
  return `<nav class="nav" aria-label="Internt">
${PUNKTER.map((p) =>
    `<a href="/${p.sti}"${p.id === aktiv ? ' aria-current="page"' : ""}>${esc(p.label)}</a>`
  ).join("\n")}
</nav>`;
}

export function side({ titel, aktiv, bruger, indhold }) {
  const hvem = bruger?.navn || TEKST.ukendt;
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
</head>
<body class="intern-flade">
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
<p>${esc(TEKST.internFod(hvem))}</p>
<p>${esc(TEKST.internNote)}</p>
</div>
</footer>
</body>
</html>`;
}

export function tabel({ hoved, raekker, tom = TEKST.tomListe, colspan, klasse = "" }) {
  const span = colspan ?? (hoved?.length || 1);
  const krop = raekker.length
    ? raekker.join("")
    : `<tr><td colspan="${span}">${tomTilstand(tom)}</td></tr>`;
  return `<table class="t${klasse ? " " + klasse : ""}">
<thead><tr>${hoved.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${krop}</tbody>
</table>`;
}

export function felt({ label, name, type = "text", value = "", placeholder, options, required, klasse = "" }) {
  const lab = label
    ? `<p class="felt-label meta-s${klasse ? " " + klasse : ""}">${esc(label)}</p>`
    : "";
  if (options) {
    const valg = options.map((o) =>
      `<option value="${esc(o.value)}"${o.value === value ? " selected" : ""}>${esc(o.label)}</option>`
    ).join("");
    return `${lab}<select class="felt" name="${esc(name)}">${valg}</select>`;
  }
  if (type === "textarea") {
    return `${lab}<textarea class="felt" name="${esc(name)}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ""}>${esc(value)}</textarea>`;
  }
  return `${lab}<input class="felt" type="${esc(type)}" name="${esc(name)}" value="${esc(value)}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ""}${required ? " required" : ""}>`;
}

export function knap({ label, accent = false, type = "submit", name, value, stil }) {
  const cls = accent ? "knap knap-accent" : "knap";
  const nv = name ? ` name="${esc(name)}"` : "";
  const vv = value != null ? ` value="${esc(value)}"` : "";
  const st = stil ? ` style="${esc(stil)}"` : "";
  return `<button class="${cls}" type="${esc(type)}"${nv}${vv}${st}>${esc(label)}</button>`;
}

export function statusPil(trin, aktivId) {
  const i = trin.findIndex((t) => t.id === aktivId);
  return `<ul class="pil">${trin.map((t, n) =>
    `<li class="${n === i ? "her" : n < i ? "naaet" : ""}">${esc(t.label)}</li>`
  ).join("")}</ul>`;
}

export function tomTilstand(tekst = TEKST.tomListe, klasse = "soft") {
  return `<p class="${klasse}">${esc(tekst)}</p>`;
}

export function fejlTilstand({ titel = TEKST.fejl, lead = TEKST.fejlH1, broed = TEKST.fejlLead, detalje } = {}) {
  return `<section class="stage sektion"><p class="sec">${esc(titel)}</p>
<h1 class="stor maxw">${esc(lead)}</h1>
<p class="lead maxw mt3">${esc(broed)}</p>
${detalje ? `<pre class="small mt3" style="white-space:pre-wrap">${esc(detalje)}</pre>` : ""}</section>`;
}
