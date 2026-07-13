const SVG_ICONS = globalThis.SVG_ICONS = {
  logo() {
    return `<svg viewBox="0 0 760 260" role="img" aria-label="忍打道 —NINDA DO—">
      <rect x="18" y="18" width="724" height="224" rx="8" fill="#FFF9EA" stroke="#2A2622" stroke-width="6"/>
      <path d="M86 194 C170 126 252 148 338 90 C432 28 530 68 664 46" fill="none" stroke="#1E4A73" stroke-width="10" stroke-linecap="round"/>
      <text x="380" y="118" text-anchor="middle" font-size="72" font-weight="900" fill="#2A2622">忍打道</text>
      <text x="380" y="174" text-anchor="middle" font-size="34" font-weight="800" fill="#1E4A73">—NINDA DO—</text>
      <circle cx="116" cy="74" r="26" fill="#B8913D"/>
      <path d="M102 75 h28 M116 61 v28" stroke="#2A2622" stroke-width="5" stroke-linecap="round"/>
    </svg>`;
  },
  scroll(id, locked) {
    const fill = locked ? "#B9B4A8" : "#B8913D";
    return `<svg viewBox="0 0 80 64" aria-hidden="true"><rect x="16" y="12" width="48" height="40" rx="6" fill="#FFF9EA" stroke="#2A2622" stroke-width="4"/><circle cx="16" cy="32" r="10" fill="${fill}" stroke="#2A2622" stroke-width="4"/><circle cx="64" cy="32" r="10" fill="${fill}" stroke="#2A2622" stroke-width="4"/><path d="M28 28h24M28 38h18" stroke="#2A2622" stroke-width="4" stroke-linecap="round"/></svg>`;
  },
  ninja() {
    return `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="36" r="24" fill="#1E4A73" stroke="#2A2622" stroke-width="4"/><rect x="22" y="30" width="36" height="13" rx="6" fill="#FFF9EA"/><circle cx="32" cy="36" r="3" fill="#2A2622"/><circle cx="48" cy="36" r="3" fill="#2A2622"/><path d="M26 62h28" stroke="#2A2622" stroke-width="5" stroke-linecap="round"/></svg>`;
  },
  torii() {
    return `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M14 18h52M20 28h40M28 28v36M52 28v36M24 64h32" stroke="#C0392F" stroke-width="8" stroke-linecap="round"/></svg>`;
  }
};
