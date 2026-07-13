const UI_TEXT = globalThis.UI_TEXT = {
  appName: "忍打道 —NINDA DO—",
  fail: "まだ機（き）は熟していない。もういちど修行だ！"
};

(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    const logo = document.getElementById("logoMount");
    if (logo) logo.innerHTML = SVG_ICONS.logo();
  });
})();
