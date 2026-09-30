(() => {
  const themes = new Set(["legacy", "forest", "blackout"]);
  const fallback = "legacy";
  const storageKey = "avkroken.theme";
  const cookieName = "avkroken_theme";
  const themeColors = { legacy: "#04070e", forest: "#080b09", blackout: "#000000" };

  function savedTheme() {
    const entry = document.cookie.split("; ").find(value => value.startsWith(cookieName + "="));
    let value = entry ? entry.split("=")[1] : "";
    if (themes.has(value)) return value;
    try {
      value = localStorage.getItem(storageKey) || "";
    } catch {}
    return themes.has(value) ? value : "";
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {}
    const denied = location.hostname === "denied.se" || location.hostname.endsWith(".denied.se");
    const domain = denied ? "; Domain=.denied.se" : "";
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = cookieName + "=" + theme
      + "; Max-Age=31536000; Path=/; SameSite=Lax" + domain + secure;
  }

  function applyTheme(value, save = false) {
    const theme = themes.has(value) ? value : fallback;
    document.documentElement.dataset.theme = theme;
    const select = document.querySelector("#theme-select");
    if (select) select.value = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColors[theme]);
    if (save) persistTheme(theme);
  }

  const saved = savedTheme();
  applyTheme(saved || document.documentElement.dataset.theme || fallback, Boolean(saved));
  addEventListener("DOMContentLoaded", () => {
    const select = document.querySelector("#theme-select");
    if (!select) return;
    select.value = document.documentElement.dataset.theme || fallback;
    select.addEventListener("change", () => applyTheme(select.value, true));
  });
})();
