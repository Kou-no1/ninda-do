const SVG_ICONS = globalThis.SVG_ICONS = {
  logo() {
    return `<svg viewBox="0 0 760 260" role="img" aria-label="忍打道 —NINDA DO—">
      <path d="M84 198 C168 124 256 150 340 86 C438 24 548 70 674 42" fill="none" stroke="var(--chochin)" stroke-width="10" stroke-linecap="round"/>
      <text x="380" y="118" text-anchor="middle" font-size="72" font-weight="900" fill="var(--tsuki)">忍打道</text>
      <text x="380" y="174" text-anchor="middle" font-size="34" font-weight="800" fill="var(--chochin)">—NINDA DO—</text>
      <circle cx="116" cy="74" r="26" fill="var(--tsuki)" opacity="0.95"/>
      <path d="M102 75 h28 M116 61 v28" stroke="var(--yoru-deep)" stroke-width="5" stroke-linecap="round"/>
      <path d="M78 210 h604" stroke="rgba(236,231,216,.24)" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 14"/>
    </svg>`;
  },
  moon() {
    return `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="22" fill="var(--tsuki)"/><circle cx="50" cy="31" r="20" fill="var(--yoru)"/></svg>`;
  },
  lantern() {
    return `<svg viewBox="0 0 80 80" aria-hidden="true">
      <path d="M34 10h12M40 10v10" stroke="var(--tsuki)" stroke-width="5" stroke-linecap="round"/>
      <rect x="22" y="20" width="36" height="42" rx="16" fill="var(--chochin)" stroke="var(--tsuki)" stroke-width="4"/>
      <path d="M28 32h24M28 50h24" stroke="var(--yoru-deep)" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
      <path d="M40 62v8" stroke="var(--tsuki)" stroke-width="5" stroke-linecap="round"/>
    </svg>`;
  },
  scroll(id, locked) {
    const fill = locked ? "rgba(236,231,216,.2)" : "var(--kin)";
    const stroke = locked ? "rgba(236,231,216,.42)" : "var(--tsuki)";
    return `<svg viewBox="0 0 80 64" aria-hidden="true">
      <rect x="16" y="12" width="48" height="40" rx="6" fill="${locked ? "transparent" : "var(--paper)"}" stroke="${stroke}" stroke-width="4"/>
      <circle cx="16" cy="32" r="10" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
      <circle cx="64" cy="32" r="10" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
      <path d="M28 28h24M28 38h18" stroke="${locked ? "rgba(236,231,216,.42)" : "var(--sumi)"}" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
  },
  ninja() {
    return `<svg viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="36" r="24" fill="var(--ai)" stroke="var(--tsuki)" stroke-width="4"/>
      <rect x="22" y="30" width="36" height="13" rx="6" fill="var(--tsuki)"/>
      <circle cx="32" cy="36" r="3" fill="var(--yoru-deep)"/>
      <circle cx="48" cy="36" r="3" fill="var(--yoru-deep)"/>
      <path d="M26 62h28" stroke="var(--tsuki)" stroke-width="5" stroke-linecap="round"/>
    </svg>`;
  },
  torii() {
    return `<svg viewBox="0 0 80 80" aria-hidden="true">
      <path d="M14 18h52M20 28h40M28 28v36M52 28v36M24 64h32" stroke="var(--line)" stroke-width="8" stroke-linecap="round"/>
    </svg>`;
  }
};
