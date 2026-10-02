// SPDX-License-Identifier: GPL-3.0-or-later
// Reads and writes the settings in chrome.storage.sync. Open intranet tabs listen for the
// change (see src/theme.js), so there is nothing to send them directly.

const ACCENT_NAMES = { blue: "Blue", teal: "Teal", violet: "Violet", rose: "Rose", green: "Green" };
const darkQuery = matchMedia("(prefers-color-scheme: dark)");

const $ = (selector) => document.querySelector(selector);
const enabledInput = $("#enabled");
const largeTextInput = $("#largeText");
const loginBackgroundInput = $("#loginBackground");

let settings = { ...TIB_DEFAULTS };

function render() {
  enabledInput.checked = settings.enabled;
  document.querySelector(`input[name="theme"][value="${settings.theme}"]`).checked = true;
  document.querySelector(`input[name="accent"][value="${settings.accent}"]`).checked = true;
  largeTextInput.checked = settings.textSize === "large";
  loginBackgroundInput.checked = settings.loginBackground;

  $("#accent-name").textContent = ACCENT_NAMES[settings.accent];
  $("#status").textContent = settings.enabled ? "On for the TAR UMT intranet" : "Off: showing the original site";
  $("#options").setAttribute("aria-disabled", String(!settings.enabled));
  for (const input of $("#options").querySelectorAll("input")) input.disabled = !settings.enabled;

  // The popup previews the chosen theme and accent itself.
  const dark = settings.theme === "dark" || (settings.theme === "system" && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.accent = settings.accent;
}

function save(patch) {
  settings = tibNormalise({ ...settings, ...patch });
  render();
  chrome.storage.sync.set({ [TIB_KEY]: settings });
}

enabledInput.addEventListener("change", () => save({ enabled: enabledInput.checked }));
largeTextInput.addEventListener("change", () => save({ textSize: largeTextInput.checked ? "large" : "standard" }));
loginBackgroundInput.addEventListener("change", () => save({ loginBackground: loginBackgroundInput.checked }));
for (const input of document.querySelectorAll('input[name="theme"]')) {
  input.addEventListener("change", () => save({ theme: input.value }));
}
for (const input of document.querySelectorAll('input[name="accent"]')) {
  input.addEventListener("change", () => save({ accent: input.value }));
}
$("#reset").addEventListener("click", () => save({ ...TIB_DEFAULTS }));
darkQuery.addEventListener("change", render);

render();
chrome.storage.sync.get(TIB_KEY).then((result) => {
  settings = tibNormalise(result[TIB_KEY]);
  render();
});
