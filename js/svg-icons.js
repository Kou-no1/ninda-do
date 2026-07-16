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
  shadowNode() {
    return `<svg viewBox="0 0 80 80" aria-hidden="true" class="shadow-node-svg">
      <path d="M18 62c3-16 11-25 22-25s19 9 22 25" fill="currentColor" opacity=".5"/>
      <path d="M25 35c0-13 6-21 15-21s15 8 15 21c-5-4-10-6-15-6s-10 2-15 6Z" fill="currentColor"/>
      <path d="M30 30h20" fill="none" stroke="var(--yoru-deep)" stroke-width="5" stroke-linecap="round"/>
    </svg>`;
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
  crest(id) {
    const crests = {
      moji: `<path d="M30 70 62 38" class="crest-line"/><path d="M62 38 72 28C76 36 68 44 62 38Z" fill="currentColor" stroke="none"/><path d="M26 74c10-2 18-1 27 4" class="crest-line thin"/>`,
      kamae: `<path d="M30 58 50 40 70 58" class="crest-line"/><circle cx="42" cy="68" r="4" class="crest-dot"/><circle cx="58" cy="68" r="4" class="crest-dot"/>`,
      modori: `<path d="M70 39a28 28 0 1 1-34 34" class="crest-line"/><path d="M36 73 35 61M36 73 48 72" class="crest-line thin"/>`,
      chudan: `<path d="M24 36h52M24 50h52M24 64h52" class="crest-line"/><path d="M24 50h52" stroke="currentColor" stroke-width="9" stroke-linecap="round" fill="none"/>`,
      boin: `<circle cx="50" cy="50" r="9" class="crest-dot"/><circle cx="50" cy="26" r="6" class="crest-dot"/><circle cx="50" cy="74" r="6" class="crest-dot"/><circle cx="26" cy="50" r="6" class="crest-dot"/><circle cx="74" cy="50" r="6" class="crest-dot"/>`,
      kasata: `<g transform="rotate(0 50 50)"><circle cx="50" cy="28" r="8" class="crest-dot"/><path d="M50 36c16 8 20 21 10 32" class="crest-line"/></g><g transform="rotate(120 50 50)"><circle cx="50" cy="28" r="8" class="crest-dot"/><path d="M50 36c16 8 20 21 10 32" class="crest-line"/></g><g transform="rotate(240 50 50)"><circle cx="50" cy="28" r="8" class="crest-dot"/><path d="M50 36c16 8 20 21 10 32" class="crest-line"/></g>`,
      nahama: `<circle cx="50" cy="32" r="8" class="crest-dot"/><circle cx="37" cy="59" r="8" class="crest-dot"/><circle cx="63" cy="59" r="8" class="crest-dot"/>`,
      gojuon: `<text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="42" font-weight="700" fill="currentColor">音</text>`,
      musubi: `<ellipse cx="39" cy="50" rx="16" ry="10" transform="rotate(-30 39 50)" class="crest-line"/><ellipse cx="61" cy="50" rx="16" ry="10" transform="rotate(30 61 50)" class="crest-line"/><circle cx="50" cy="50" r="4" class="crest-dot"/>`,
      nigori: `<circle cx="40" cy="58" r="7" class="crest-dot"/><circle cx="58" cy="40" r="7" class="crest-dot"/>`,
      henge: `<path d="M36 68C25 52 31 35 48 28c7 18 0 32-12 40Z" class="crest-line"/><path d="M61 34c12 8 14 20 5 31-11-8-13-20-5-31Z" class="crest-line"/><path d="M44 58 60 45" class="crest-line thin"/>`,
      bunshin: `<path d="M50 25 75 50 50 75 25 50Z" class="crest-line" stroke-dasharray="7 7" opacity=".72"/><path d="M57 18 82 43 57 68 32 43Z" class="crest-line"/>`,
      shingan: `<path d="M28 50q22 24 44 0" class="crest-line"/><path d="M39 57l-5 8M50 61v9M61 57l5 8" class="crest-line thin"/>`,
      menkyo: `<g transform="rotate(-40 50 50)"><path d="M24 50h52" class="crest-line"/><circle cx="24" cy="50" r="7" class="crest-line"/><circle cx="76" cy="50" r="7" class="crest-line"/></g><g transform="rotate(40 50 50)"><path d="M24 50h52" class="crest-line"/><circle cx="24" cy="50" r="7" class="crest-line"/><circle cx="76" cy="50" r="7" class="crest-line"/></g>`,
      shippu: `<path d="M24 38c18-10 34-9 52 0" class="crest-line"/><path d="M20 51c20-12 36-12 56-1" class="crest-line"/><path d="M28 64c15-8 28-8 42-1" class="crest-line"/>`
    };
    return `<svg viewBox="0 0 100 100" aria-hidden="true" class="crest-svg">
      <circle cx="50" cy="50" r="44" class="crest-ring"/>
      ${crests[id] || crests.moji}
    </svg>`;
  },
  closedScroll() {
    return `<svg viewBox="0 0 112 72" aria-hidden="true" class="closed-scroll-svg">
      <path d="M27 18h58a12 12 0 0 1 12 12v12a12 12 0 0 1-12 12H27a12 12 0 0 1-12-12V30a12 12 0 0 1 12-12Z" fill="none" stroke="currentColor" stroke-width="5"/>
      <path d="M56 20v32M42 28c7 9 21 9 28 0M42 44c7-9 21-9 28 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      <text x="56" y="42" text-anchor="middle" font-size="24" font-weight="900" fill="currentColor">?</text>
    </svg>`;
  },
  shuriken() {
    return `<svg viewBox="0 0 64 64" aria-hidden="true" class="shuriken-svg">
      <path d="M32 5 40 24 59 32 40 40 32 59 24 40 5 32 24 24Z" fill="currentColor"/>
      <circle cx="32" cy="32" r="7" fill="var(--yoru-deep)" stroke="currentColor" stroke-width="3"/>
      <path d="M32 13v12M51 32H39M32 51V39M13 32h12" stroke="var(--yoru-deep)" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  },
  tierBadge() {
    return `<svg viewBox="0 0 80 80" aria-hidden="true" class="tier-badge-svg">
      <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" stroke-width="5"/>
      <path d="M40 12 48 31 68 40 48 49 40 68 32 49 12 40 32 31Z" fill="currentColor"/>
      <circle cx="40" cy="40" r="8" fill="var(--paper)" stroke="currentColor" stroke-width="3"/>
    </svg>`;
  },
  lock() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" class="lock-svg">
      <path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="5" y="10" width="14" height="10" rx="2"/>
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
  rankWatermark(kind) {
    const mark = kind === "moon"
      ? `<circle cx="50" cy="50" r="34" fill="currentColor"/><circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="3"/>`
      : `<circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50 12 60 40 88 50 60 60 50 88 40 60 12 50 40 40Z" fill="currentColor"/><circle cx="50" cy="50" r="9" fill="none" stroke="currentColor" stroke-width="4"/>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true" class="rank-watermark-svg">${mark}</svg>`;
  },
  torii(stroke) {
    return `<svg viewBox="0 0 80 80" aria-hidden="true">
      <path d="M14 18h52M20 28h40M28 28v36M52 28v36M24 64h32" stroke="${stroke || "var(--line)"}" stroke-width="8" stroke-linecap="round"/>
    </svg>`;
  }
};
