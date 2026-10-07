// Lists elements that look wrong in dark mode: light backgrounds, and text whose contrast
// against what's actually behind it is under 3.5:1. Open a preview with ?theme=dark, then
// load it from the DevTools console and run it:
//
//   (await import("http://localhost:8765/dev/audit.js")).audit()
//
// It reads computed styles, so it catches colours from any stylesheet or inline style.
// Gradients are judged by their first colour stop.

const parse = (c) => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r, g, b, a };
};

const luminance = ({ r, g, b }) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const over = (top, bottom) => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

// The colour actually painted behind an element: its own background blended over its ancestors'.
function backdrop(el) {
  const layers = [];
  for (let e = el; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    const gradient = cs.backgroundImage.match(/gradient\([^)]*?(rgba?\([^)]+\))/);
    if (gradient) {
      layers.push({ ...parse(gradient[1]), a: 1 });
      break;
    }
    const c = parse(cs.backgroundColor);
    if (c && c.a > 0) {
      layers.push(c);
      if (c.a >= 1) break;
    }
  }
  return layers.reduceRight((acc, layer) => over(layer, acc), { r: 255, g: 255, b: 255, a: 1 });
}

function describe(el) {
  const name = (e) => e.tagName.toLowerCase() + [...e.classList].slice(0, 3).map((c) => "." + c).join("");
  return (el.parentElement ? name(el.parentElement) + " > " : "") + name(el);
}

export function audit({ lightThreshold = 0.35, minContrast = 3.5 } = {}) {
  const found = new Map();
  const note = (line) => found.set(line, (found.get(line) || 0) + 1);

  for (const el of document.body.querySelectorAll("*")) {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height || el.tagName === "IMG") continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;

    const bg = backdrop(el);
    const bgLum = luminance(bg);
    const own = parse(cs.backgroundColor);
    if (own && own.a > 0.5 && bgLum > lightThreshold) note(`LIGHT BG   ${describe(el)}  ${cs.backgroundColor}`);

    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const fgLum = luminance(over(parse(cs.color), bg));
    const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
    if (ratio < minContrast) note(`CONTRAST ${ratio.toFixed(1)}  ${describe(el)}  ${cs.color} on rgb(${[bg.r, bg.g, bg.b].map(Math.round)})`);
  }
  return [...found].map(([line, n]) => (n > 1 ? `${n}x ` : "") + line).join("\n") || "Nothing found.";
}

globalThis.audit = audit;
