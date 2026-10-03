const NinjaGameManager = globalThis.NinjaGameManager = (function () {
  "use strict";
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function unlocked(course, save) {
    return SaveManager.isTeacherMode(save) || SaveManager.DAN_ORDER.indexOf(save.dan) >= SaveManager.DAN_ORDER.indexOf(course.dan);
  }

  function pool(course) {
    return DAN_WORDS.words.filter((word) => word.length >= course.minLength && word.length <= course.maxLength).map((text) => ({ text, kind: "word" }));
  }

  function travelSeconds(text) {
    return GAME_DATA.travel.baseSeconds + InputEngine.preferredRomaji(text).length * GAME_DATA.travel.secondsPerKey;
  }

  function score(points, accuracy) { return Math.round(points * accuracy); }

  function openCourses() {
    const save = SaveManager.ensure();
    if (save.dan === "none" && !SaveManager.isTeacherMode()) return;
    NindaApp.openMenuModal({ title: GAME_DATA.label, teacherBadge: SaveManager.isTeacherMode(),
      cards: GAME_DATA.courses.map((course) => {
        const best = save.best.courier[course.id];
        const rank = RANK_DATA.dans.find((dan) => dan.id === course.dan);
        return { id: course.id, name: course.label, desc: course.desc, locked: !unlocked(course, save),
          meta: unlocked(course, save) ? `${course.seconds}${UI_TEXT.courier.seconds} ／ ${best ? `${UI_TEXT.courier.best} ${best.score}` : UI_TEXT.noBanzukeRecord}` : `${rank.label}${UI_TEXT.courier.locked}`,
          run() { start(course.id); } };
      }), back: { label: UI_TEXT.courier.back, run: NindaApp.openJissenMenu } });
  }

  function start(id) {
    const course = GAME_DATA.courses.find((item) => item.id === id);
    if (!course || !unlocked(course, SaveManager.ensure())) return;
    const words = pool(course);
    if (!words.length) return;
    ExamManager.cancel(); NindaApp.closeMenuModal(false); NindaApp.showScreen("S2");
    TrainingManager.startRunner({ screen: "S2", stageId: "jissen", recordId: `courier:${id}`, title: `${GAME_DATA.label} ／ ${course.label}`,
      mode: "jissen", purpose: "courier", presentation: "courier", guideLevel: GAME_DATA.guideLevel, seconds: course.seconds,
      items: TrainingManager.sample(words, words.length), pool: words,
      onStart(state) {
        state.courier = { points: 0, fast: 0, itemStart: 0, window: 0, lastDelivery: -100 };
        mountScene();
      },
      onItemStart(item, state) {
        state.courier.itemStart = state.metrics.elapsedSeconds();
        state.courier.window = travelSeconds(item.text);
      },
      onItemComplete(item, state) {
        const remaining = Math.max(0, 1 - (state.metrics.elapsedSeconds() - state.courier.itemStart) / state.courier.window);
        state.courier.points += GAME_DATA.scoring.delivery + Math.round(GAME_DATA.scoring.fastBonus * remaining);
        if (remaining > 0) state.courier.fast += 1;
        state.courier.lastDelivery = state.metrics.elapsedSeconds();
        if (AudioManager.shuriken) AudioManager.shuriken();
      },
      onUpdate: updateScene,
      onComplete(summary, state) {
        const total = score(state.courier.points, summary.accuracy);
        const best = SaveManager.updateCourierBest(id, total, state.completedItems);
        state.resultData = { score: total, bestUpdated: best.updated,
          detail: `${UI_TEXT.courier.delivered} ${state.completedItems} ／ ${UI_TEXT.courier.fast} ${state.courier.fast} ／ ${UI_TEXT.courier.points} ${state.courier.points} × ${Math.round(summary.accuracy * 100)}%` };
        AchievementManager.checkSession(summary);
      },
      retry() { start(id); },
      resultContextAction: { id: "course", label: UI_TEXT.courier.choose, run() { TrainingManager.stop(false); NindaApp.showScreen("S1"); openCourses(); } } });
  }

  function mountScene() {
    const mount = document.getElementById("courierMount");
    mount.hidden = false;
    mount.innerHTML = `<div class="courier-hud"><strong id="courierScore"></strong><span id="courierDelivered"></span><span id="courierStatus" role="status"></span></div>
      <svg class="courier-scene" viewBox="0 0 1080 210" role="img" aria-label="${UI_TEXT.courier.scene}">
        <circle class="courier-moon" cx="824" cy="45" r="24"/>
        <g class="courier-mountains"><path d="M0 150 140 48 280 150 430 72 620 151 750 94 890 150 1010 65 1080 138V210H0Z"/></g>
        <g class="courier-roofs"><path d="M5 136 90 107 175 136M38 136v46h104v-46M225 137 300 109 375 137M251 137v45h98v-45M605 140 670 116 735 140M625 140v42h90v-42"/></g>
        <path class="courier-road" d="M0 184H1080"/>
        <path class="courier-bridge" d="M405 183q70-47 140 0M415 179v-19M442 167v-20M469 160v-20M496 165v-20M525 177v-19"/>
        <g class="courier-gate"><path d="M875 105h135M885 119h115M900 106v79M985 106v79"/><path d="M885 104q55-19 115 0"/></g>
        <g id="courierRunner" transform="translate(26 113)"><path class="courier-scarf" d="M32 43 67 36 58 50 36 50Z"/><rect class="courier-body" x="23" y="38" width="20" height="24" rx="6"/><path class="courier-limbs" d="M25 47 13 57m26-10 11 8M29 61l-9 10m17-10 11 10"/><svg width="56" height="56">${SVG_ICONS.ninja()}</svg><rect x="-9" y="28" width="19" height="32" rx="3" class="courier-parcel"/><path d="M-13 28H15M-13 59H15" class="courier-tie"/></g>
        <g id="courierPile" transform="translate(1016 156)"></g>
        <g id="courierDeliveryGlow" class="courier-delivery-glow"><path d="M930 80v-10m-22 19-8-8m52 8 8-8"/></g>
      </svg><div class="courier-travel"><span id="courierTravel"></span></div>`;
  }

  function updateScene(summary, state) {
    const mount = document.getElementById("courierMount");
    if (!mount || mount.hidden || !state.courier) return;
    const elapsed = state.metrics.elapsedSeconds();
    const fraction = Math.min(1, Math.max(0, (elapsed - state.courier.itemStart) / state.courier.window));
    const reduce = SaveManager.ensure().settings.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("courierRunner").setAttribute("transform", `translate(${reduce ? 520 : Math.round(26 + fraction * 850)} 113)`);
    document.getElementById("courierTravel").style.width = `${Math.round((1 - fraction) * 100)}%`;
    document.getElementById("courierScore").textContent = `${UI_TEXT.courier.points} ${score(state.courier.points, summary.accuracy)}`;
    document.getElementById("courierDelivered").textContent = `${UI_TEXT.courier.delivered} ${state.completedItems}`;
    const status = fraction >= 1 ? UI_TEXT.courier.waiting : UI_TEXT.courier.onWay;
    const statusElement = document.getElementById("courierStatus");
    if (statusElement.textContent !== status) statusElement.textContent = status;
    document.getElementById("courierDeliveryGlow").style.opacity = elapsed - state.courier.lastDelivery < 0.45 ? "1" : "0";
    const pile = document.getElementById("courierPile");
    if (pile.dataset.count !== String(state.completedItems)) {
      pile.dataset.count = String(state.completedItems);
      pile.innerHTML = Array.from({ length: Math.min(state.completedItems, 12) }, (_, i) => `<rect x="${i % 3 * 16}" y="${-Math.floor(i / 3) * 13}" width="13" height="10" rx="2"/>`).join("");
    }
  }

  return { openCourses, start, unlocked, pool, travelSeconds, score };
})();
