const GuideRenderer = globalThis.GuideRenderer = (function () {
  "use strict";

  const ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "-"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
    ["z", "x", "c", "v", "b", "n", "m", ",", "."]
  ];

  function render(target, options) {
    if (!target) return;
    const guideLevel = options && Number.isFinite(options.guideLevel) ? options.guideLevel : 0;
    const expectedKeys = options && options.expectedKeys ? options.expectedKeys : [];
    const rescue = options && options.rescue;
    if (guideLevel < 2 && !rescue) {
      target.innerHTML = "";
      return;
    }
    const keyboard = renderKeyboard(expectedKeys);
    const hand = (guideLevel >= 3 || rescue) ? renderHands(expectedKeys) : "";
    target.innerHTML = keyboard + hand;
  }

  function renderKeyboard(expectedKeys) {
    const expected = new Set(expectedKeys);
    return `<div class="keyboard" aria-label="画面キーボード">${ROWS.map((row) => {
      return `<div class="key-row">${row.map((key) => {
        const info = FINGER_DATA.keys[key];
        const color = info ? FINGER_DATA.fingerColors[info.finger] : "#B9B4A8";
        const next = expected.has(key) ? " next" : "";
        const label = key === ";" ? ";" : key;
        return `<div class="key${next}" style="border-color:${next ? color : "var(--line)"}">${label}</div>`;
      }).join("")}</div>`;
    }).join("")}</div>`;
  }

  function renderHands(expectedKeys) {
    const fingers = new Set(expectedKeys.map((key) => FINGER_DATA.keys[key] && FINGER_DATA.keys[key].finger).filter(Boolean));
    const fingerShapes = [
      ["L5", 85, 68, 30, 112], ["L4", 120, 46, 30, 134], ["L3", 155, 34, 30, 146], ["L2", 190, 54, 34, 126],
      ["R2", 358, 54, 34, 126], ["R3", 397, 34, 30, 146], ["R4", 432, 46, 30, 134], ["R5", 467, 68, 30, 112]
    ];
    return `<div class="hand-guide" aria-label="指ガイド"><svg viewBox="0 0 580 220" role="img">
      <rect x="68" y="130" width="170" height="58" rx="28" fill="#FFF9EA" stroke="#2A2622" stroke-width="4"/>
      <rect x="342" y="130" width="170" height="58" rx="28" fill="#FFF9EA" stroke="#2A2622" stroke-width="4"/>
      ${fingerShapes.map(([id, x, y, w, h]) => {
        const active = fingers.has(id);
        const fill = active ? FINGER_DATA.fingerColors[id] : "#F7F0E2";
        const label = active ? FINGER_DATA.fingerLabels[id] : "";
        return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="15" fill="${fill}" stroke="#2A2622" stroke-width="${active ? 5 : 3}"/><title>${label}</title></g>`;
      }).join("")}
      <text x="154" y="210" text-anchor="middle" font-size="18" fill="#2A2622">ひだり手</text>
      <text x="426" y="210" text-anchor="middle" font-size="18" fill="#2A2622">みぎ手</text>
    </svg></div>`;
  }

  return { render };
})();
