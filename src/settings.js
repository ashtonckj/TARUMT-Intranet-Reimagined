// SPDX-License-Identifier: GPL-3.0-or-later
// Shared by the content script and the popup, so both agree on names and defaults.

const TIB_KEY = "tib-settings";

const TIB_DEFAULTS = Object.freeze({
  enabled: true,
  theme: "system", // "system" | "light" | "dark"
  accent: "blue", // "blue" | "teal" | "violet" | "rose" | "green"
  textSize: "standard", // "standard" | "large"
  loginBackground: true, // keep the school's seasonal photo behind the login card
});

function tibNormalise(saved) {
  return { ...TIB_DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
}
