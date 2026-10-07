// SPDX-License-Identifier: GPL-3.0-or-later
// Runs at document_start on every intranet page. It only sets data attributes on <html>;
// every style in src/styles is scoped to them, so turning the extension off restores the
// original site without a reload.

(() => {
  const root = document.documentElement;
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  let current = tibNormalise(readCache());

  // chrome.storage is async, so the last-used settings are also cached in the page's own
  // localStorage. Reading that synchronously here is what stops a light flash on dark mode.
  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(TIB_KEY));
    } catch {
      return null;
    }
  }

  function writeCache() {
    try {
      localStorage.setItem(TIB_KEY, JSON.stringify(current));
    } catch {
      // Storage blocked (e.g. third-party iframe); the async path still applies the theme.
    }
  }

  function apply(settings) {
    current = tibNormalise(settings);
    if (!current.enabled) {
      for (const name of ["data-tib", "data-tib-theme", "data-tib-accent", "data-tib-text", "data-tib-login-bg"]) {
        root.removeAttribute(name);
      }
      return;
    }
    const dark = current.theme === "dark" || (current.theme === "system" && darkQuery.matches);
    root.setAttribute("data-tib", "");
    root.setAttribute("data-tib-theme", dark ? "dark" : "light");
    root.setAttribute("data-tib-accent", current.accent);
    root.setAttribute("data-tib-text", current.textSize);
    root.setAttribute("data-tib-login-bg", current.loginBackground ? "photo" : "plain");
  }

  apply(current);

  chrome.storage.sync.get(TIB_KEY).then((result) => {
    apply(result[TIB_KEY]);
    writeCache();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[TIB_KEY]) return;
    apply(changes[TIB_KEY].newValue);
    writeCache();
  });

  darkQuery.addEventListener("change", () => apply(current));

  // Small accessibility fixes the site's markup is missing. They add attributes only and
  // never touch values, events or form submission.
  function enhance() {
    // Inputs labelled only by a placeholder are announced as unlabelled by screen readers.
    for (const input of document.querySelectorAll("input[placeholder]:not([aria-label])")) {
      const hasLabel = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (!hasLabel && !input.closest("label")?.textContent.trim()) {
        input.setAttribute("aria-label", input.placeholder);
      }
    }
    // The show-password eye on the login page is an icon-only link.
    document.querySelector(".toggle-eye:not([aria-label])")?.setAttribute("aria-label", "Show password");
  }

  // Dark mode: notices and bulletins carry their own colours (inline styles, bgcolor, <font
  // color>, per-page <style>), so light boxes end up under the skin's light text and dark
  // text ends up on its dark surfaces. There are too many colours to list in CSS, so measure
  // what each element actually paints and tag it; components.css does the recolouring.
  //   data-tib-bg="plain"  white/grey box       -> dark surface
  //   data-tib-bg="tint"   light coloured box   -> dark wash of the same colour (--tib-page-bg)
  //   data-tib-ink         dark text colour set by the page -> normal text colour
  const SKIP_CHECK = ".btn, .label, .badge, .progress, .infobox-icon, .timeline-indicator, [class*='colorpicker'], img, svg, video, canvas, input, select, textarea, option";
  const rgb = (value) => value.match(/[\d.]+/g)?.map(Number);
  const brightness = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  function markPageColours() {
    if (root.getAttribute("data-tib-theme") !== "dark" || !document.body) return;
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest(SKIP_CHECK)) continue;
      const style = getComputedStyle(el);

      const bg = rgb(style.backgroundColor);
      if (!el.hasAttribute("data-tib-bg") && bg && (bg[3] ?? 1) >= 0.5 && brightness(bg) >= 150) {
        const [r, g, b] = bg;
        if (Math.max(r, g, b) - Math.min(r, g, b) < 24) {
          el.setAttribute("data-tib-bg", "plain");
        } else {
          el.setAttribute("data-tib-bg", "tint");
          el.style.setProperty("--tib-page-bg", `rgb(${r} ${g} ${b})`);
        }
      }

      if (!el.hasAttribute("data-tib-ink") && el.matches("[style*='color' i], font[color]")) {
        const ink = rgb(style.color);
        if (ink && brightness(ink) < 90) el.setAttribute("data-tib-ink", "");
      }
    }
  }

  // Coalesces bursts of DOM changes (pages that load content by script) into one pass.
  let pending = false;
  function scheduleCheck() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      markPageColours();
    });
  }

  function onReady() {
    enhance();
    scheduleCheck();
    new MutationObserver(scheduleCheck).observe(document.body, { childList: true, subtree: true });
    // Stylesheets can finish after DOMContentLoaded and paint new backgrounds.
    addEventListener("load", scheduleCheck, { once: true });
  }

  // On a live switch to dark, wait out the skin's colour transitions so nothing is measured
  // halfway between light and dark.
  new MutationObserver(() => setTimeout(markPageColours, 400)).observe(root, { attributeFilter: ["data-tib-theme"] });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady, { once: true });
  } else {
    onReady();
  }
})();
