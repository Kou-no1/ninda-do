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
        const color = keyColor(key) || "var(--line)";
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
      <rect x="68" y="130" width="170" height="58" rx="28" fill="transparent" stroke="var(--tsuki)" stroke-width="4"/>
      <rect x="342" y="130" width="170" height="58" rx="28" fill="transparent" stroke="var(--tsuki)" stroke-width="4"/>
      ${fingerShapes.map(([id, x, y, w, h]) => {
        const active = fingers.has(id);
        const fill = active ? FINGER_DATA.fingerColors[id] : "transparent";
        const label = active ? FINGER_DATA.fingerLabels[id] : "";
        return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="15" fill="${fill}" stroke="var(--tsuki)" stroke-width="${active ? 5 : 3}"/><title>${label}</title></g>`;
      }).join("")}
      <text x="154" y="210" text-anchor="middle" font-size="18" fill="var(--tsuki)">ひだり手</text>
      <text x="426" y="210" text-anchor="middle" font-size="18" fill="var(--tsuki)">みぎ手</text>
    </svg></div>`;
  }

  function renderPoster(target) {
    if (!target) return;
    target.innerHTML = `${posterKeyboard()}${posterHands()}${posterLegend()}<p class="poster-note">うったら、かまえ（ホームポジション）に もどる</p>`;
  }

  function posterKeyboard() {
    return `<section class="poster-keyboard" aria-label="ゆびの色キーボード">
      ${ROWS.map((row) => `<div class="poster-key-row">${row.map((key) => {
        const color = keyColor(key);
        return `<div class="poster-key" style="--finger-color:${color}" data-key="${key}">
          <span>${key === ";" ? ";" : key.toUpperCase()}</span>
          ${key === "f" || key === "j" ? `<span class="home-bump" aria-label="ホームポジションの突起"></span>` : ""}
        </div>`;
      }).join("")}</div>`).join("")}
    </section>`;
  }

  function posterHands() {
    const fingerShapes = [
      ["L5", 86, 62], ["L4", 124, 42], ["L3", 162, 32], ["L2", 202, 50], ["T", 248, 150],
      ["T", 332, 150], ["R2", 378, 50], ["R3", 418, 32], ["R4", 456, 42], ["R5", 494, 62]
    ];
    return `<section class="poster-hands" aria-label="ゆびの色">
      <svg viewBox="0 0 580 220" role="img" aria-label="両手の指色">
        <path d="M64 168c10-48 30-84 62-101 25-13 83-12 115 10 21 15 34 39 40 73" fill="none" stroke="#2A2622" stroke-width="6" stroke-linecap="round"/>
        <path d="M516 168c-10-48-30-84-62-101-25-13-83-12-115 10-21 15-34 39-40 73" fill="none" stroke="#2A2622" stroke-width="6" stroke-linecap="round"/>
        ${fingerShapes.map(([id, x, y]) => `<g>
          <circle cx="${x}" cy="${y}" r="16" fill="${FINGER_DATA.fingerColors[id]}" stroke="#2A2622" stroke-width="4"/>
          <title>${FINGER_DATA.fingerLabels[id]}</title>
        </g>`).join("")}
        <text x="158" y="205" text-anchor="middle" font-size="20" font-weight="800" fill="#2A2622">ひだり手</text>
        <text x="422" y="205" text-anchor="middle" font-size="20" font-weight="800" fill="#2A2622">みぎ手</text>
      </svg>
    </section>`;
  }

  function posterLegend() {
    return `<section class="poster-legend" aria-label="色の凡例">
      ${Object.keys(FINGER_DATA.fingerLabels).map((id) => `<div class="legend-item">
        <span class="legend-swatch" style="--finger-color:${FINGER_DATA.fingerColors[id]}"></span>
        <span>${FINGER_DATA.fingerLabels[id]}</span>
      </div>`).join("")}
    </section>`;
  }

  function keyColor(key) {
    const info = FINGER_DATA.keys[key];
    return info ? FINGER_DATA.fingerColors[info.finger] : "";
  }

  return { render, renderPoster };
})();
