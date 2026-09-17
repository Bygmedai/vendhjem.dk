// Tjek at en flade holder kontrakten i assets/vh.css.
// Ukendt klasse og farve uden for paletten = fejl.

const HEX = /#(?:[0-9a-fA-F]{3,8})\b/g;
const RGB = /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/gi;

const normHex = (h) => {
  let s = h.toLowerCase();
  if (s.length === 4) s = "#" + [...s.slice(1)].map((c) => c + c).join("");
  return s;
};
const normRgb = (s) => s.toLowerCase().replace(/\s+/g, "");

export function klasserICss(css) {
  const uden = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return new Set([...uden.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((m) => m[1]));
}

export function klasserIHtml(html) {
  const s = new Set();
  for (const m of html.matchAll(/\bclass="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) s.add(c);
  }
  return s;
}

export function paletFraCss(css) {
  const uden = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return {
    hex: new Set([...(uden.match(HEX) || [])].map(normHex)),
    rgb: new Set([...(uden.match(RGB) || [])].map(normRgb)),
  };
}

export function farverI(tekst) {
  return {
    hex: [...(tekst.match(HEX) || [])].map(normHex),
    rgb: [...(tekst.match(RGB) || [])].map(normRgb),
  };
}

export function ukendteKlasser(html, css) {
  const kendt = klasserICss(css);
  return [...klasserIHtml(html)].filter((c) => !kendt.has(c)).sort();
}

export function farverUdenforPalet(flade, css) {
  const palet = paletFraCss(css);
  const f = farverI(flade);
  const hex = f.hex.filter((h) => !palet.hex.has(h));
  const rgb = f.rgb.filter((r) => !palet.rgb.has(r));
  return { hex, rgb, ok: hex.length === 0 && rgb.length === 0 };
}
