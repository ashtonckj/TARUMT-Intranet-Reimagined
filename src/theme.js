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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance, { once: true });
  } else {
    enhance();
  }
})();
