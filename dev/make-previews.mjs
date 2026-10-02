// Builds dev/preview/*.html from the saved pages in dev/pages/, with the extension's
// styles and scripts injected the way Chrome would inject them. Lets you check a page
// without reloading the extension or logging in.
//
//   node dev/make-previews.mjs
//   python dev/serve.py               (from the project folder)
//   open http://localhost:8765/dev/preview/web-login.html?theme=dark&accent=teal
//
// Query options: theme=system|light|dark, accent=blue|teal|violet|rose|green,
// text=standard|large, bg=photo|plain, off=1 (shows the untouched site).

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || 8765;
const origin = `http://localhost:${port}`;
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const { css, js } = manifest.content_scripts[0];

const shim = `
<script>
  // Stands in for chrome.storage so src/theme.js runs unchanged outside the extension.
  (() => {
    const q = new URLSearchParams(location.search);
    const saved = {
      enabled: q.get("off") !== "1",
      theme: q.get("theme") || "system",
      accent: q.get("accent") || "blue",
      textSize: q.get("text") || "standard",
      loginBackground: q.get("bg") !== "plain",
    };
    try { localStorage.removeItem("tib-settings"); } catch {}
    window.chrome = {
      storage: {
        sync: { get: async (key) => ({ [key]: saved }) },
        onChanged: { addListener() {} },
      },
    };
  })();
</script>`;

const inject = (pageOrigin) =>
  [
    `<base href="${pageOrigin}">`,
    ...css.map((file) => `<link rel="stylesheet" href="${origin}/${file}">`),
    shim,
    ...js.map((file) => `<script src="${origin}/${file}"></script>`),
  ].join("\n");

mkdirSync(join(root, "dev/preview"), { recursive: true });

for (const name of readdirSync(join(root, "dev/pages")).filter((f) => f.endsWith(".html"))) {
  let html = readFileSync(join(root, "dev/pages", name), "utf8");
  // Pages saved from the live site keep their own relative links working through <base>.
  const site = html.match(/https:\/\/(web|reg)\.tarc\.edu\.my\/portal\//)?.[0] ?? "https://web.tarc.edu.my/portal/";
  // Chrome injects extension CSS before the page's own, so ours goes first in <head>.
  html = html.replace(/<head[^>]*>/i, (head) => `${head}\n${inject(site)}\n`);
  // The site's icon font refuses cross-origin loads, so previews use the same version from a CDN.
  html = html.replace(
    /href="[^"]*font-awesome(\.min)?\.css"/g,
    'href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"'
  );
  writeFileSync(join(root, "dev/preview", name), html);
  console.log(`dev/preview/${name}`);
}

// The popup too, with storage kept in memory so its controls can be clicked through.
const popup = readFileSync(join(root, "popup/popup.html"), "utf8")
  .replace(/(href|src)="\.\.\//g, `$1="${origin}/`)
  .replace(/(href|src)="popup\./g, `$1="${origin}/popup/popup.`)
  .replace(
    "</head>",
    `${shim.replace("sync: { get:", "sync: { set: async () => {}, get:")}\n</head>`
  );
writeFileSync(join(root, "dev/preview/popup.html"), popup);
console.log("dev/preview/popup.html");
