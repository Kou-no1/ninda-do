const GuideRenderer = globalThis.GuideRenderer = (function () {
  "use strict";

  const ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "-"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
    ["z", "x", "c", "v", "b", "n", "m", ",", "."]
  ];
  const lastGuide = new WeakMap();

  function render(target, options) {
    if (!target) return;
    const guideLevel = options && Number.isFinite(options.guideLevel) ? options.guideLevel : 0;
    const expectedKeys = options && options.expectedKeys ? options.expectedKeys : [];
    const rescue = options && options.rescue;
    if (guideLevel < 2 && !rescue) {
      if (target.firstChild) target.replaceChildren();
      lastGuide.delete(target);
      return;
    }
    const signature = [guideLevel, Boolean(rescue), Boolean(options?.fingerSymbols), ...expectedKeys].join(":");
    const previous = lastGuide.get(target);
    if (previous?.signature === signature && previous.keyboard === target.firstElementChild) return;
    const keyboard = renderKeyboard(expectedKeys, options);
    const hand = (guideLevel >= 3 || rescue) ? renderHands(expectedKeys, options && options.fingerSymbols) : "";
    target.innerHTML = keyboard + hand;
    lastGuide.set(target, {signature, keyboard: target.firstElementChild});
  }

  function renderKeyboard(expectedKeys, options) {
    const expected = new Set(expectedKeys);
    return `<div class="keyboard" aria-label="画面キーボード">${ROWS.map((row) => {
      return `<div class="key-row">${row.map((key) => {
        const color = keyColor(key) || "var(--line)";
        const next = expected.has(key) ? " next" : "";
        const label = key === ";" ? ";" : key;
        const info = FINGER_DATA.keys[key];
        const symbol = options && options.fingerSymbols ? `<small class="finger-symbol">${FINGER_DATA.fingerSymbols[info.finger]}</small>` : "";
        const stat = options && options.stats && options.stats[key];
        const enough = stat && stat.attempts >= LEARNING_DATA.mastery.minAttempts;
        const accuracy = enough ? 1 - stat.misses / stat.attempts : 0;
        const mastery = options && options.mastery ? `<small class="key-mastery">${enough ? `${accuracy >= LEARNING_DATA.mastery.secure ? "○" : accuracy >= LEARNING_DATA.mastery.developing ? "△" : "・"} ${Math.round(accuracy * 100)}%` : "—"}</small>` : "";
        return `<div class="key${next}" data-key="${key}" style="--finger-ink:${color};border-color:${color}" title="${FINGER_DATA.fingerLabels[info.finger]}"><span class="key-letter">${label}</span>${symbol}${mastery}</div>`;
      }).join("")}</div>`;
    }).join("")}</div>`;
  }

  function renderHands(expectedKeys, symbols) {
    const fingers = new Set(expectedKeys.map((key) => FINGER_DATA.keys[key] && FINGER_DATA.keys[key].finger).filter(Boolean));
    const shapes = [
      [5, 96, 72, "M98 125 85 74q-3-17 9-19 10-2 14 14l13 47"],
      [4, 124, 46, "M121 116 113 49q-2-18 11-19 12 0 14 17l9 64"],
      [3, 157, 35, "M147 111 145 36q0-18 13-18 12 0 13 18l2 74"],
      [2, 188, 50, "M173 110 176 52q1-18 14-17 13 1 11 19l-3 73"]
    ];
    const hands = ["L", "R"].map(side => {
      const right = side === "R";
      const activeLabel = shapes.find(([n]) => fingers.has(side + n));
      const label = activeLabel ? FINGER_DATA.fingerLabels[side + activeLabel[0]] : right ? "みぎ手" : "ひだり手";
      return `<g transform="${right ? "translate(580 0) scale(-1 1)" : "translate(0)"}" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
        <path d="M98 125q6 34 23 52l4 12h55l5-15q16-11 27-28l23-30q6-12-4-15-8-3-15 6l-18 20-4-27-91 3Z" fill="var(--surface)" stroke="var(--muted)"/>
        ${shapes.map(([n,x,y,d]) => `<path data-finger="${side+n}" d="${d}" fill="${fingers.has(side+n) ? FINGER_DATA.fingerColors[side+n] : "var(--surface)"}" stroke="${fingers.has(side+n) ? "var(--tsuki)" : "var(--muted)"}"/>`).join("")}
        <path d="m119 140 22 7m34-5q-2 14-11 21m-40 16h54" fill="none" stroke="var(--muted)" opacity=".55"/>
      </g>${symbols ? shapes.map(([n,x,y]) => `<text x="${right ? 580-x : x}" y="${y+10}" text-anchor="middle" fill="${fingers.has(side+n) ? "var(--sumi)" : "var(--tsuki)"}" font-size="16">${FINGER_DATA.fingerSymbols[side+n]}</text>`).join("") : ""}
      <text x="${right ? 428 : 152}" y="215" text-anchor="middle" fill="var(--tsuki)" font-size="17">${label}</text>`;
    });
    const label = [...fingers].map(id => FINGER_DATA.fingerLabels[id]).join("、");
    return `<div class="hand-guide"><svg viewBox="64 8 452 214" role="img" aria-label="指ガイド ${label}">${hands.join("")}</svg></div>`;
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

  function renderMastery(target, stats, fingerSymbols) {
    target.innerHTML = renderKeyboard([], { stats, mastery: true, fingerSymbols });
  }

  return { render, renderPoster, renderMastery };
})();
