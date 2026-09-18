// Fælles serverkomponenter. Ingen React, intet byggetrin.
// side · mitSide · nav · tabel · felt · knap · status-pil · tom · fejl
// Udseende kommer fra assets/vh.css. Ny klasse eller ny farve = prøven fejler.
// /internt bruger side(). /mit (uden for Access) bruger mitSide().

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

// /mit er en app, ikke en side: manifest, ikon og service worker gør, at den
// kan lægges på hjemmeskærmen og åbne uden net. Skallen caches; det, der
// skrives uden net, ligger i telefonens egen kø, indtil serveren siger ja.
const MIT_FANER = [
  { id: "nu", sti: "/mit", label: TEKST.fanerNu },
  { id: "skriv", sti: "/mit/skriv", label: TEKST.fanerSkriv },
  { id: "overblik", sti: "/mit/overblik", label: TEKST.fanerOverblik },
];

export function mitSide({ titel, bruger, indhold, fane }) {
  const logud = bruger
    ? `<nav class="nav" aria-label="Mit">
${MIT_FANER.map((f) =>
      `<a href="${f.sti}"${f.id === fane ? ' aria-current="page"' : ""}>${esc(f.label)}</a>`
    ).join("\n")}
<form method="post" action="/mit/logud" style="margin:0">
<button class="lnk" type="submit">${esc(TEKST.logUd)}</button>
</form>
</nav>`
    : `<nav class="nav" aria-label="Mit">
<a href="/">${esc(TEKST.tilForsiden)}</a>
</nav>`;
  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titel)} · Vendhjem</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#e9e7e0">
<link rel="manifest" href="/assets/mit.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Vendhjem">
<link rel="apple-touch-icon" href="/assets/app-180.png">
<link rel="preload" href="/assets/fonts/lora-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/jetbrains-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/vh.css">
</head>
<body class="intern-flade">
<header class="site-head">
<div class="stage row">
<a class="brand" href="${bruger ? "/mit" : "/"}">Vend <em>Hjem</em></a>
${logud}
</div>
</header>
<main>
${indhold}
</main>
<script>
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/mit-sw.js", { scope: "/mit" }).catch(function(){});
</script>
<footer class="site-foot">
<div class="stage row">
<p>${esc(bruger ? TEKST.mitFod(bruger.navn) : TEKST.mitFodGaest)}</p>
<p>${esc(bruger ? TEKST.mitNoteInde : TEKST.mitNote)}</p>
</div>
</footer>
${bruger ? "" : passkeyLoginScript()}
</body>
</html>`;
}

function passkeyLoginScript() {
  return `<script>
(function(){
  if (!window.PublicKeyCredential) return;
  function b64(s){ s=s.replace(/-/g,"+").replace(/_/g,"/"); s+= "=".repeat((4-s.length%4)%4); var bin=atob(s), u=new Uint8Array(bin.length); for (var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u.buffer; }
  function b64u(buf){ var u=new Uint8Array(buf), s=""; for (var i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/g,""); }
  fetch("/mit/passkey/begin",{method:"POST",credentials:"same-origin"}).then(function(r){return r.json()}).then(function(opt){
    if (!opt || !opt.challenge) return;
    opt.challenge = b64(opt.challenge);
    if (opt.allowCredentials) opt.allowCredentials.forEach(function(c){ c.id = b64(c.id); });
    var get = { publicKey: opt };
    if (PublicKeyCredential.isConditionalMediationAvailable)
      PublicKeyCredential.isConditionalMediationAvailable().then(function(ok){ if (ok) get.mediation = "conditional"; return navigator.credentials.get(get); }).then(faerdig).catch(function(){});
    else navigator.credentials.get(get).then(faerdig).catch(function(){});
  }).catch(function(){});
  function faerdig(cred){
    if (!cred) return;
    fetch("/mit/passkey/faerdig",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({
      id: cred.id, rawId: b64u(cred.rawId), type: cred.type,
      response: { clientDataJSON: b64u(cred.response.clientDataJSON), authenticatorData: b64u(cred.response.authenticatorData), signature: b64u(cred.response.signature), userHandle: cred.response.userHandle ? b64u(cred.response.userHandle) : null }
    })}).then(function(r){ if (r.ok) location.href = "/mit"; }).catch(function(){});
  }
})();
</script>`;
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
