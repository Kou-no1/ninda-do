const NinjaGameManager = globalThis.NinjaGameManager = (function () {
  "use strict";
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let teacherOutfit = null;
  const ROMAJI_SIGNATURE = hash(JSON.stringify(ROMAJI_TABLE));

  function hash(value) {
    let result = 2166136261;
    for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
    return result.toString(36).toUpperCase();
  }

  function signature(course) {
    return hash(JSON.stringify({ v: GAME_DATA.replay.version, course, words: pool(course), guide: GAME_DATA.guideLevel,
      scoring: GAME_DATA.scoring, travel: GAME_DATA.travel, journey: GAME_DATA.journey,
      romaji: ROMAJI_SIGNATURE, transition: TrainingManager.itemTransitionMs }));
  }

  function validSeed(seed) { return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff; }
  function randomSeed() {
    if (globalThis.crypto && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
    return Math.floor(Math.random() * 0x100000000);
  }

  // A seeded stream is reused for each shuffled block; no word repeats before its pool is exhausted.
  function sequence(course, seed) {
    if (!validSeed(seed)) throw new Error(UI_TEXT.shared.invalid);
    let state = seed >>> 0;
    const random = () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 0x100000000;
    };
    return () => {
      const items = pool(course);
      for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };
  }

  function exportChallenge(courseId, seed) {
    const index = GAME_DATA.courses.findIndex((course) => course.id === courseId);
    if (index < 0 || !validSeed(seed)) throw new Error(UI_TEXT.shared.invalid);
    const payload = `ND${GAME_DATA.replay.version}-${index}-${seed.toString(36).toUpperCase()}-${signature(GAME_DATA.courses[index])}`;
    return `${payload}-${hash(payload)}`;
  }

  function parseChallenge(code) {
    const compact = String(code || "").replace(/\s/g, "").toUpperCase();
    const match = /^ND(\d+)-(\d+)-([0-9A-Z]+)-([0-9A-Z]+)-([0-9A-Z]+)$/.exec(compact);
    if (!match || compact.length > 80) throw new Error(UI_TEXT.shared.invalid);
    const payload = compact.slice(0, compact.lastIndexOf("-"));
    const course = GAME_DATA.courses[Number(match[2])];
    const seed = parseInt(match[3], 36);
    if (hash(payload) !== match[5] || !course || !validSeed(seed)) throw new Error(UI_TEXT.shared.invalid);
    if (Number(match[1]) !== GAME_DATA.replay.version || match[4] !== signature(course)) throw new Error(UI_TEXT.shared.outdated);
    return { courseId: course.id, seed, code: exportChallenge(course.id, seed) };
  }

  function emptyProgress() {
    const defaults = GAME_DATA.outfits.filter((item) => item.condition.type === "default");
    return { owned: defaults.map((item) => item.id), equipped: Object.fromEntries(defaults.map((item) => [item.slot, item.id])), replays: {} };
  }

  function normalizeProgress(raw) {
    const result = emptyProgress();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
    result.owned = [...new Set(result.owned.concat((Array.isArray(raw.owned) ? raw.owned : []).filter((id) => GAME_DATA.outfits.some((item) => item.id === id))))];
    Object.keys(result.equipped).forEach((slot) => {
      const id = raw.equipped && raw.equipped[slot];
      if (result.owned.includes(id) && GAME_DATA.outfits.some((item) => item.id === id && item.slot === slot)) result.equipped[slot] = id;
    });
    GAME_DATA.courses.forEach((course) => {
      const replay = raw.replays && raw.replays[course.id];
      if (validReplay(replay, course)) result.replays[course.id] = { v: replay.v, seed: replay.seed, signature: replay.signature,
        times: replay.times.slice(), score: replay.score };
    });
    return result;
  }

  function validReplay(replay, course) {
    return !!replay && replay.v === GAME_DATA.replay.version && replay.signature === signature(course) && validSeed(replay.seed)
      && Number.isInteger(replay.score) && replay.score >= 0 && Array.isArray(replay.times) && replay.times.length <= GAME_DATA.replay.maxDeliveries
      && replay.times.every((time, index, times) => Number.isInteger(time) && time >= 0 && time <= course.seconds * 1000 && (!index || time > times[index - 1]));
  }

  function rewardEligible(item, save, event) {
    const condition = item.condition;
    return condition.type === "default"
      || condition.type === "correct" && save.totals.correct >= condition.n
      || condition.type === "review" && save.learning.counters.review >= condition.n
      || condition.type === "delivered" && save.learning.counters.delivered >= condition.n
      || condition.type === "combo" && event.maxCombo >= condition.n
      || condition.type === "accuracy" && event.correct >= condition.n && event.acc >= condition.accuracy;
  }

  function applyRewards(save, event) {
    if (!event.completed || event.correct + event.miss === 0) return;
    GAME_DATA.outfits.forEach((item) => { if (rewardEligible(item, save, event) && !save.game.owned.includes(item.id)) save.game.owned.push(item.id); });
  }

  function routeFor(deliveries, shortcut) {
    const ordinary = GAME_DATA.routes.filter((route) => !route.special);
    if (shortcut && deliveries > 0 && deliveries % ordinary.length === 0) return GAME_DATA.routes.find((route) => route.special) || ordinary[0];
    return ordinary[Math.floor(deliveries / GAME_DATA.journey.deliveriesPerScene) % ordinary.length];
  }

  function opensShortcut(clean, summary) {
    return summary.combo >= GAME_DATA.journey.combo || clean >= GAME_DATA.journey.cleanDeliveries && summary.accuracy >= GAME_DATA.journey.accuracy;
  }

  function ghostProgress(replay, elapsed, words) {
    const time = elapsed * 1000;
    const delivered = replay.times.filter((stamp) => stamp <= time).length;
    const start = delivered ? replay.times[delivered - 1] / 1000 + TrainingManager.itemTransitionMs / 1000 : 0;
    const text = words[delivered] && words[delivered].text;
    return { delivered, fraction: text ? Math.min(1, Math.max(0, (elapsed - start) / travelSeconds(text))) : 1 };
  }

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
          run() { openRunMenu(course.id); } };
      }), back: { label: UI_TEXT.courier.back, run: NindaApp.openJissenMenu } });
  }

  function openRunMenu(id) {
    const course = GAME_DATA.courses.find((item) => item.id === id);
    const save = SaveManager.ensure();
    if (!course || !unlocked(course, save)) return;
    const replay = save.game.replays[id];
    NindaApp.openMenuModal({ title: `${GAME_DATA.label} ／ ${course.label}`, teacherBadge: SaveManager.isTeacherMode(),
      cards: [
        { id: "new", name: UI_TEXT.courier.newRun, desc: UI_TEXT.courier.newDesc, meta: `${course.seconds}${UI_TEXT.courier.seconds}`, run() { start(id); } },
        { id: "ghost", name: UI_TEXT.courier.ghostRun, desc: UI_TEXT.courier.ghostDesc, locked: !replay,
          meta: replay ? `${UI_TEXT.courier.delivered} ${replay.times.length} ／ ${UI_TEXT.courier.points} ${replay.score}` : UI_TEXT.courier.noGhost,
          run() { start(id, { seed: replay.seed }); } },
        { id: "shared", name: UI_TEXT.shared.title, desc: UI_TEXT.courier.sharedDesc, meta: UI_TEXT.shared.note, run() { NindaApp.closeMenuModal(false); LearningManager.open("shared"); } }
      ], back: { label: UI_TEXT.courier.back, run: openCourses }, footerHtml: `<p class="menu-footer-note">${esc(UI_TEXT.courier.ghostNote)}</p>` });
  }

  function start(id, options) {
    const course = GAME_DATA.courses.find((item) => item.id === id);
    if (!course || !unlocked(course, SaveManager.ensure())) return;
    const words = pool(course);
    if (!words.length) return;
    const seed = options && options.seed !== undefined ? options.seed : randomSeed();
    if (!validSeed(seed)) return;
    const nextBatch = sequence(course, seed);
    const previous = SaveManager.ensure().game.replays[id];
    const ghost = previous && previous.seed === seed && validReplay(previous, course) ? previous : null;
    const ghostWords = [];
    if (ghost) { const nextGhost = sequence(course, seed); while (ghostWords.length <= ghost.times.length) ghostWords.push(...nextGhost()); }
    ExamManager.cancel(); NindaApp.closeMenuModal(false); NindaApp.showScreen("S2");
    TrainingManager.startRunner({ screen: "S2", stageId: "jissen", recordId: `courier:${id}`, title: `${GAME_DATA.label} ／ ${course.label}`,
      mode: "jissen", purpose: "courier", presentation: "courier", guideLevel: GAME_DATA.guideLevel, seconds: course.seconds,
      items: nextBatch(), refillItems: nextBatch, pool: words,
      onStart(state) {
        state.courier = { points: 0, fast: 0, itemStart: 0, window: 0, lastDelivery: -100, seed, ghost,
          times: [], clean: 0, shortcut: false, itemMiss: 0, destinations: new Set(), route: routeFor(0, false), ghostWords };
        mountScene(SaveManager.ensure());
      },
      onItemStart(item, state) {
        state.courier.itemStart = state.metrics.elapsedSeconds();
        state.courier.window = travelSeconds(item.text);
        state.courier.itemMiss = state.metrics.summary().miss;
        state.courier.route = routeFor(state.completedItems, state.courier.shortcut);
      },
      onItemComplete(item, state) {
        const remaining = Math.max(0, 1 - (state.metrics.elapsedSeconds() - state.courier.itemStart) / state.courier.window);
        state.courier.points += GAME_DATA.scoring.delivery + Math.round(GAME_DATA.scoring.fastBonus * remaining);
        if (remaining > 0) state.courier.fast += 1;
        state.courier.lastDelivery = state.metrics.elapsedSeconds();
        state.courier.times.push(Math.round(state.courier.lastDelivery * 1000));
        const summary = state.metrics.summary();
        state.courier.clean = summary.miss === state.courier.itemMiss ? state.courier.clean + 1 : 0;
        if (opensShortcut(state.courier.clean, summary)) state.courier.shortcut = true;
        state.courier.destinations.add(state.courier.route.id);
        if (AudioManager.shuriken) AudioManager.shuriken();
      },
      onUpdate: updateScene,
      onComplete(summary, state) {
        const total = score(state.courier.points, summary.accuracy);
        const best = SaveManager.updateCourierBest(id, total, state.completedItems);
        SaveManager.saveCourierReplay(id, { v: GAME_DATA.replay.version, seed, signature: signature(course),
          times: state.courier.times.slice(0, GAME_DATA.replay.maxDeliveries), score: total });
        state.resultData = { score: total, bestUpdated: best.updated,
          challengeCode: exportChallenge(id, seed),
          detail: `${UI_TEXT.courier.delivered} ${state.completedItems} ／ ${UI_TEXT.courier.fast} ${state.courier.fast} ／ ${UI_TEXT.courier.points} ${state.courier.points} × ${Math.round(summary.accuracy * 100)}% ／ ${UI_TEXT.courier.routeCount} ${state.courier.destinations.size}${state.courier.shortcut ? ` ／ ${UI_TEXT.courier.shortcut}` : ""}` };
        AchievementManager.checkSession(summary);
      },
      retry() { start(id, { seed }); },
      resultContextAction: { id: "course", label: UI_TEXT.courier.choose, run() { TrainingManager.stop(false); NindaApp.showScreen("S1"); openCourses(); } } });
  }

  function avatar(equipped) {
    const outfit = equipped || emptyProgress().equipped;
    const attributes = Object.entries(emptyProgress().equipped).map(([slot, fallback]) => `data-${slot}="${esc(outfit[slot] || fallback)}"`).join(" ");
    return `<g class="courier-avatar" ${attributes}>
      <path class="avatar-scarf" d="M32 33 57 25 48 39 33 41Z"/>
      <path class="avatar-limbs" d="M25 44 12 54m26-10 12 7M29 59l-9 12m17-12 11 12"/>
      <rect class="avatar-body" x="22" y="35" width="23" height="26" rx="6"/>
      <circle class="avatar-head" cx="33" cy="22" r="18"/>
      <path class="avatar-eye-band" d="M18 19h30v10H18Z"/>
      <path class="avatar-eyes" d="M23 23h4m10 0h4"/>
      <path class="avatar-moon" d="M32 7a5 5 0 1 0 5 5 5 5 0 0 1-5-5Z"/>
      <path class="avatar-leaf" d="M29 12q1-10 10-8-2 9-10 8m0 0 7-6"/>
      <path class="avatar-belt" d="M22 51h23v6H22Z"/>
      <path class="avatar-wave" d="M23 54q4-4 8 0t8 0"/>
      <rect class="avatar-bag" x="2" y="28" width="17" height="29" rx="3"/>
      <path class="avatar-bag-tie" d="M0 31h21M0 54h21"/>
      <path class="avatar-bag-wave" d="M6 40q3-5 6 0t5 0"/>
      <circle class="avatar-bag-moon" cx="10" cy="42" r="5"/>
    </g>`;
  }

  function mountScene(save) {
    const mount = document.getElementById("courierMount");
    mount.hidden = false;
    const outfit = SaveManager.isTeacherMode(save) && teacherOutfit ? teacherOutfit : save.game.equipped;
    mount.innerHTML = `<div class="courier-hud"><strong id="courierScore"></strong><span id="courierDelivered"></span><span id="courierStatus" role="status"></span></div>
      <div class="courier-route-bar"><strong id="courierRoute"></strong><span id="courierDestination"></span><span id="courierGhostCount"></span><span id="courierShortcut" role="status"></span></div>
      <svg class="courier-scene" viewBox="0 0 1080 210" role="img" aria-label="${UI_TEXT.courier.scene}">
        <circle class="courier-moon" cx="824" cy="45" r="24"/>
        <g class="courier-mountains"><path d="M0 150 140 48 280 150 430 72 620 151 750 94 890 150 1010 65 1080 138V210H0Z"/></g>
        <g class="courier-roofs route-decoration" data-scene="roof"><path d="M5 136 90 107 175 136M38 136v46h104v-46M225 137 300 109 375 137M251 137v45h98v-45M605 140 670 116 735 140M625 140v42h90v-42"/></g>
        <g class="courier-bamboo route-decoration" data-scene="bamboo">${[110, 200, 300, 390, 490, 620, 730, 820].map((x, i) => `<path d="M${x} 181V${45 + i % 3 * 15}m-9 34h18m-18 30h18m-18 30h18M${x} 90q-24-21-34-13m34 38q23-25 38-15"/>`).join("")}</g>
        <g class="courier-garden route-decoration" data-scene="garden"><path d="M100 169q27-65 54 0m55 0q27-65 54 0M480 171q27-70 54 0M590 160l80-35 80 35m-135 0v22h110v-22M345 177V98m-18 18h36m-30-18h24v28h-24Z"/><circle cx="345" cy="111" r="7"/></g>
        <path class="courier-road" d="M0 184H1080"/>
        <g class="route-decoration" data-scene="bridge"><path class="courier-river" d="M0 195q180-28 360 0t360 0t360 0"/><path class="courier-bridge" d="M120 183q350-110 690 0M145 176v-25M250 148v-30M370 133v-28M490 131v-30M610 141v-29M745 168v-28"/></g>
        <path class="courier-fork" d="M510 184q100-65 230-85"/>
        <g class="courier-gate"><path d="M875 105h135M885 119h115M900 106v79M985 106v79"/><path d="M885 104q55-19 115 0"/></g>
        <g id="courierGhost" class="courier-ghost" transform="translate(26 95)" hidden>${avatar(outfit)}</g>
        <g id="courierRunner" transform="translate(26 113)">${avatar(outfit)}</g>
        <g id="courierPile" transform="translate(1016 156)"></g>
        <g id="courierDeliveryGlow" class="courier-delivery-glow"><path d="M930 80v-10m-22 19-8-8m52 8 8-8"/></g>
      </svg><div class="courier-travel"><span id="courierTravel"></span></div><div id="courierJourney" class="courier-journey"></div>`;
  }

  function updateScene(summary, state) {
    const mount = document.getElementById("courierMount");
    if (!mount || mount.hidden || !state.courier) return;
    const elapsed = state.metrics.elapsedSeconds();
    const fraction = Math.min(1, Math.max(0, (elapsed - state.courier.itemStart) / state.courier.window));
    const reduce = SaveManager.ensure().settings.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const route = state.courier.route;
    mount.dataset.route = route.id;
    mount.dataset.shortcut = String(state.courier.shortcut);
    mount.classList.toggle("complete", state.complete);
    document.getElementById("courierRoute").textContent = route.label;
    document.getElementById("courierDestination").textContent = `${UI_TEXT.courier.destination} ${route.destination}`;
    const shortcut = document.getElementById("courierShortcut");
    if (state.courier.shortcut && shortcut.textContent !== UI_TEXT.courier.shortcut) shortcut.textContent = UI_TEXT.courier.shortcut;
    document.getElementById("courierRunner").setAttribute("transform", `translate(${reduce ? 520 : Math.round(26 + fraction * 850)} 113)`);
    document.getElementById("courierTravel").style.width = `${Math.round((1 - fraction) * 100)}%`;
    document.getElementById("courierScore").textContent = `${UI_TEXT.courier.points} ${score(state.courier.points, summary.accuracy)}`;
    document.getElementById("courierDelivered").textContent = `${UI_TEXT.courier.delivered} ${state.completedItems}`;
    const status = state.complete ? UI_TEXT.courier.arrived : fraction >= 1 ? UI_TEXT.courier.waiting : UI_TEXT.courier.onWay;
    const statusElement = document.getElementById("courierStatus");
    if (statusElement.textContent !== status) statusElement.textContent = status;
    if (state.courier.ghost) {
      const progress = ghostProgress(state.courier.ghost, elapsed, state.courier.ghostWords);
      const ghost = document.getElementById("courierGhost");
      ghost.removeAttribute("hidden");
      ghost.setAttribute("transform", `translate(${reduce ? 440 : Math.round(26 + progress.fraction * 850)} 95)`);
      document.getElementById("courierGhostCount").textContent = `${UI_TEXT.courier.ghost} ${progress.delivered}`;
    }
    document.getElementById("courierDeliveryGlow").style.opacity = elapsed - state.courier.lastDelivery < 0.45 ? "1" : "0";
    const pile = document.getElementById("courierPile");
    if (pile.dataset.count !== String(state.completedItems)) {
      pile.dataset.count = String(state.completedItems);
      pile.innerHTML = Array.from({ length: Math.min(state.completedItems, 12) }, (_, i) => `<rect x="${i % 3 * 16}" y="${-Math.floor(i / 3) * 13}" width="13" height="10" rx="2"/>`).join("");
    }
    const journey = document.getElementById("courierJourney");
    if (journey.dataset.count !== String(state.courier.destinations.size)) {
      journey.dataset.count = String(state.courier.destinations.size);
      journey.innerHTML = GAME_DATA.routes.map((item) => `<span class="${state.courier.destinations.has(item.id) ? "visited" : ""}">${esc(item.destination)}</span>`).join("");
    }
  }

  function renderWardrobe(mount, save) {
    const teacher = SaveManager.isTeacherMode(save);
    if (!teacher) teacherOutfit = null;
    const outfit = teacher && teacherOutfit ? teacherOutfit : save.game.equipped;
    mount.innerHTML = `<h2>${UI_TEXT.wardrobe.title}</h2><div class="wardrobe-preview"><svg viewBox="0 0 70 80" role="img" aria-label="${UI_TEXT.wardrobe.avatar}">${avatar(outfit)}</svg></div>
      ${Object.entries(UI_TEXT.wardrobe.slots).map(([slot, label]) => `<fieldset class="wardrobe-slot"><legend>${esc(label)}</legend><div class="wardrobe-items">${GAME_DATA.outfits.filter((item) => item.slot === slot).map((item) => {
        const owned = save.game.owned.includes(item.id);
        const selected = outfit[slot] === item.id;
        return `<button type="button" class="wardrobe-item ${selected ? "equipped" : ""}" data-outfit="${item.id}" aria-pressed="${selected}" ${owned || teacher ? "" : "disabled"}><span class="wardrobe-icon" aria-hidden="true"><svg viewBox="0 0 70 80">${avatar(Object.assign({}, outfit, { [slot]: item.id }))}</svg></span><span class="wardrobe-item-text"><strong>${esc(item.name)}</strong><span>${esc(item.desc)}</span><small>${teacher && !owned ? UI_TEXT.wardrobe.preview : selected ? UI_TEXT.wardrobe.equipped : owned ? UI_TEXT.wardrobe.equip : UI_TEXT.wardrobe.locked}</small></span></button>`;
      }).join("")}</div></fieldset>`).join("")}<p class="learning-note">${UI_TEXT.wardrobe.note}</p>`;
    mount.querySelectorAll("[data-outfit]").forEach((button) => button.addEventListener("click", () => {
      const item = GAME_DATA.outfits.find((entry) => entry.id === button.dataset.outfit);
      if (teacher) teacherOutfit = Object.assign({}, outfit, { [item.slot]: item.id });
      else SaveManager.equipOutfit(item.id);
      renderWardrobe(mount, SaveManager.ensure());
      mount.querySelector(`[data-outfit="${item.id}"]`).focus();
    }));
  }

  function renderShared(mount, save) {
    const courses = GAME_DATA.courses.filter((course) => unlocked(course, save));
    mount.innerHTML = `<h2>${UI_TEXT.shared.title}</h2><p class="learning-note">${UI_TEXT.shared.note}</p>`;
    if (!courses.length) { mount.innerHTML += `<p>${UI_TEXT.shared.locked}</p>`; return; }
    mount.innerHTML += `<form id="sharedCreateForm" class="shared-form"><label>${UI_TEXT.shared.course}<select id="sharedCourse">${courses.map((course) => `<option value="${course.id}">${esc(course.label)}</option>`).join("")}</select></label>
      <label>${UI_TEXT.shared.seed}<input type="number" id="sharedSeed" min="0" max="4294967295" step="1" value="${randomSeed()}" required></label><button type="submit">${UI_TEXT.shared.create}</button></form>
      <div id="sharedGenerated" hidden><label>${UI_TEXT.shared.code}<textarea id="sharedOutput" readonly rows="2"></textarea></label><button type="button" id="sharedSelect">${UI_TEXT.shared.select}</button></div>
      <form id="sharedImportForm" class="shared-form"><label>${UI_TEXT.shared.code}<input type="text" id="sharedInput" maxlength="80" autocomplete="off" spellcheck="false" required></label><button type="submit">${UI_TEXT.shared.import}</button></form>
      <p id="sharedMessage" role="status"></p><div id="sharedPreview"></div>`;
    const message = document.getElementById("sharedMessage");
    ["sharedCreateForm", "sharedImportForm"].forEach((id) => document.getElementById(id).addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing && event.target.matches("input")) {
        event.preventDefault(); document.getElementById(id).requestSubmit();
      }
    }));
    document.getElementById("sharedCreateForm").addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const code = exportChallenge(document.getElementById("sharedCourse").value, Number(document.getElementById("sharedSeed").value));
        document.getElementById("sharedOutput").value = code;
        document.getElementById("sharedGenerated").hidden = false;
        document.getElementById("sharedInput").value = code;
        document.getElementById("sharedPreview").innerHTML = "";
        message.textContent = UI_TEXT.shared.generated;
      } catch (error) { message.textContent = error.message; }
    });
    document.getElementById("sharedSelect").addEventListener("click", () => { const output = document.getElementById("sharedOutput"); output.focus(); output.select(); });
    document.getElementById("sharedInput").addEventListener("input", () => { document.getElementById("sharedPreview").innerHTML = ""; });
    document.getElementById("sharedImportForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const preview = document.getElementById("sharedPreview");
      try {
        const challenge = parseChallenge(document.getElementById("sharedInput").value);
        const course = GAME_DATA.courses.find((item) => item.id === challenge.courseId);
        const allowed = unlocked(course, SaveManager.ensure());
        const rank = RANK_DATA.dans.find((item) => item.id === course.dan);
        preview.innerHTML = `<h3>${esc(course.label)}</h3><p>${course.seconds}${UI_TEXT.courier.seconds} ／ ${esc(course.desc)}</p><button type="button" id="sharedStart" ${allowed ? "" : "disabled"}>${UI_TEXT.shared.start}</button>${allowed ? "" : `<p>${esc(rank.label)}${UI_TEXT.courier.locked}</p>`}`;
        document.getElementById("sharedStart").addEventListener("click", () => start(course.id, { seed: challenge.seed }));
        if (allowed) document.getElementById("sharedStart").focus();
        message.textContent = "";
      } catch (error) { preview.innerHTML = ""; message.textContent = error.message; }
    });
  }

  return { openCourses, openRunMenu, start, unlocked, pool, travelSeconds, score, sequence, signature, exportChallenge, parseChallenge,
    emptyProgress, normalizeProgress, validReplay, applyRewards, rewardEligible, routeFor, opensShortcut, ghostProgress, renderWardrobe, renderShared, avatar };
})();
