const CourierLantern = globalThis.CourierLantern = (() => {
  const rendered = new WeakMap();

  function progress(cleanTotal) {
    const total = Number.isFinite(cleanTotal) ? Math.max(0, Math.floor(cleanTotal)) : 0;
    const { maxLights, cleanPerLight } = GAME_DATA.lantern;
    const lights = Math.min(maxLights, Math.floor(total / cleanPerLight));
    return { lights, charge: lights === maxLights ? 0 : total % cleanPerLight };
  }

  function markup() {
    const icon = `<svg class="lantern-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 32" width="24" height="32" fill="none" stroke="currentColor" stroke-linejoin="round">
      <path d="M9 7V5a3 3 0 0 1 6 0v2M7 7h10v2H7zM7 24h10v2H7zM12 26v4"/>
      <path class="lantern-paper" d="M8 9h8q8 7 0 15H8q-8-8 0-15Z"/>
      <path class="lantern-flame" d="M12 20q-5-1-1-6l1-2q0 2 2 4 2 3-2 4Z" stroke-width="1.2"/>
    </svg>`;
    return `<div class="lantern-hud"><span class="lantern-icons" aria-hidden="true">${icon.repeat(GAME_DATA.lantern.maxLights)}</span>
      <span class="lantern-progress" role="status" aria-atomic="true"></span>
      <strong class="lantern-target"></strong></div>`;
  }

  function update(mount, cleanTotal, deliveries, target) {
    const hud = mount.querySelector(".lantern-hud");
    if (!hud) return;
    const { lights, charge } = progress(cleanTotal);
    const previous = rendered.get(hud);
    const ui = UI_TEXT.lantern;
    if (!previous || previous.lights !== lights) {
      hud.querySelectorAll(".lantern-icon").forEach((icon, index) => {
        const lit = index < lights;
        icon.classList.toggle("is-lit", lit);
        icon.querySelector(".lantern-flame").setAttribute("fill", lit ? "currentColor" : "none");
      });
    }
    if (!previous || previous.lights !== lights || previous.charge !== charge) {
      const rules = GAME_DATA.lantern;
      hud.querySelector(".lantern-progress").textContent = (lights === rules.maxLights ? ui.hudFull : ui.hudNext)
        .replace("{lights}", lights).replace("{remaining}", rules.cleanPerLight - charge)
        .replace("{bonus}", rules.bonusSeconds).replace("{total}", lights * rules.bonusSeconds);
    }
    if (!previous || previous.deliveries !== deliveries || previous.target !== target) {
      const template = deliveries >= target ? ui.hudReached : ui.hudTarget;
      hud.querySelector(".lantern-target").textContent = template.replace("{deliveries}", deliveries).replace("{target}", target);
    } else if (previous.lights === lights && previous.charge === charge) {
      return;
    }
    rendered.set(hud, { lights, charge, deliveries, target });
  }

  return { progress, markup, update };
})();
