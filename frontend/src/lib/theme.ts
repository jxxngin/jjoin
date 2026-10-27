// 테마 설정. 사용자가 고른 값은 기기의 localStorage에 저장하고,
// 실제 적용은 <html data-theme="light|dark">로 한다. (globals.css의 dark 변형)

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

// 페이지가 그려지기 전에 실행돼 깜빡임 없이 테마를 적용한다.
// "시스템 설정"이면 휴대폰 설정이 바뀔 때도 따라간다.
export const THEME_SCRIPT = `(function () {
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    var pref = "system";
    try { pref = localStorage.getItem("${THEME_STORAGE_KEY}") || "system"; } catch (e) {}
    var dark = pref === "dark" || (pref === "system" && media.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
  apply();
  media.addEventListener("change", apply);
  window.__applyTheme = apply;
})();`;
