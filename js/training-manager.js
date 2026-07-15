const TrainingManager = globalThis.TrainingManager = (function () {
  "use strict";

  const PROMPT_LAYOUT_CONFIG = {
    sizes: [
      { maxLength: 12, value: "clamp(48px, 6vw, 72px)" },
      { maxLength: 24, value: "36px" },
      { maxLength: 44, value: "30px" },
      { maxLength: Infinity, value: "26px" }
    ],
    spacedMaxLength: 12,
    romajiWindow: { typed: 8, rest: 20 }
  };

  let active = null;
  let keyListenerReady = false;
  let modalKeyListenerReady = false;
  let modalState = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function stageById(stageId) {
    return CURRICULUM_DATA.stages.find((stage) => stage.id === stageId);
  }

  function refByName(name) {
    return globalThis[name];
  }

  function sample(pool, count) {
    const source = (pool || []).slice();
    const result = [];
    while (result.length < count && source.length) {
      const index = Math.floor(Math.random() * source.length);
      result.push(source.splice(index, 1)[0]);
    }
    while (result.length < count && pool && pool.length) {
      result.push(pool[result.length % pool.length]);
    }
    return result;
  }

  function buildTrainingItems(stage, menuIndex) {
    const ref = refByName(stage.wordsRef);
    const selectedMenu = Number.isInteger(menuIndex) ? stage.training[menuIndex] : null;
    if (stage.type === "nyumon") {
      const keys = NYUMON_WORDS.sections[stage.id] || [];
      const count = (selectedMenu || stage.training[0]).count;
      return sample(keys, count).map((key) => ({ text: key, kind: "letter" }));
    }
    const items = [];
    const menus = selectedMenu ? [selectedMenu] : stage.training;
    for (const menu of menus) {
      const source = menu.kind === "in" ? ref.in : menu.kind === "sentence" ? ref.sentences : ref.words;
      sample(source, menu.count).forEach((text) => items.push({ text, kind: menu.kind }));
    }
    return items;
  }

  function formatPrompt(text, kind) {
    if (kind === "letter") return text.toUpperCase();
    if (/^[a-z.,-]+$/.test(text)) return text;
    try {
      return InputEngine.segment(text).map((unit) => unit.kana).join(" ");
    } catch (error) {
      return text;
    }
  }

  function promptSize(text) {
    const length = Array.from(String(text || "")).length;
    const step = PROMPT_LAYOUT_CONFIG.sizes.find((item) => length <= item.maxLength);
    return step ? step.value : PROMPT_LAYOUT_CONFIG.sizes[PROMPT_LAYOUT_CONFIG.sizes.length - 1].value;
  }

  function promptProgressHtml(text, kind, progress) {
    const source = String(text || "");
    let units;
    try {
      units = InputEngine.segment(source).map((unit) => unit.kana);
    } catch (error) {
      units = Array.from(source);
    }
    const currentIndex = progress && Number.isFinite(progress.unitIndex) ? progress.unitIndex : 0;
    const addSpaces = source.length <= PROMPT_LAYOUT_CONFIG.spacedMaxLength && !/^[a-z.,-]+$/.test(source);
    const html = units.map((unit, index) => {
      const label = kind === "letter" ? unit.toUpperCase() : unit;
      const state = index < currentIndex ? " done" : index === currentIndex ? " current" : "";
      const separator = addSpaces && index < units.length - 1 ? '<span class="prompt-separator" aria-hidden="true"> </span>' : "";
      return `<span class="prompt-unit${state}">${escapeHtml(label)}</span>${separator}`;
    }).join("");
    return `<span class="prompt-progress">${html}</span>`;
  }

  function romajiWindow(display) {
    const typed = String(display && display.typed || "");
    const rest = String(display && display.rest || "");
    const typedLimit = PROMPT_LAYOUT_CONFIG.romajiWindow.typed;
    const restLimit = PROMPT_LAYOUT_CONFIG.romajiWindow.rest;
    return {
      typed: typed.slice(-typedLimit),
      rest: rest.slice(0, restLimit),
      clippedTyped: typed.length > typedLimit,
      clippedRest: rest.length > restLimit,
      full: typed + rest
    };
  }

  function ensureKeyListener() {
    if (keyListenerReady) return;
    keyListenerReady = true;
    document.addEventListener("keydown", (event) => {
      if (!active || active.paused) return;
      if (event.key === "Escape") return;
      const result = active.session.handleKey(event.key);
      if (result !== "ignore") event.preventDefault();
      if (result === "done") {
        updateUi();
        window.setTimeout(nextItem, 120);
      }
    });
  }

  function start(stageId, menuIndex) {
    const stage = stageById(stageId);
    if (!stage) return;
    const menu = Number.isInteger(menuIndex) ? stage.training[menuIndex] : null;
    const items = buildTrainingItems(stage, menuIndex);
    if (globalThis.NindaApp) NindaApp.showScreen("S2");
    startRunner({
      screen: "S2",
      stageId: stage.id,
      title: `${stage.label}「${stage.title}」${menu ? ` ${menu.label}` : ""}`,
      items,
      guideLevel: stage.type === "nyumon" ? 3 : stage.guideLevelTraining,
      mode: "training",
      onComplete(summary, state) {
        SaveManager.addSessionSummary(stage.id, summary, state.items.length);
        SaveManager.markPracticed(stage.id);
        if (globalThis.AchievementManager) AchievementManager.checkSession(summary);
      }
    });
  }

  function startRunner(config) {
    ensureKeyListener();
    cleanupTimer();
    cleanupComboTimer();
    active = {
      config,
      items: config.items || [],
      index: 0,
      session: null,
      metrics: MetricsEngine.createSession({ mode: config.mode }),
      guideLevel: config.guideLevel,
      mode: config.mode || "training",
      rescue: false,
      paused: false,
      missUnit: -1,
      missCount: 0,
      lastEvent: null,
      startedAt: Date.now(),
      remaining: config.seconds || 0,
      timer: null,
      complete: false,
      comboDisplay: 0,
      comboFading: false,
      comboFadeTimer: null,
      lastComboMilestone: 0
    };
    document.querySelectorAll(".play-screen").forEach((screen) => screen.classList.remove("shingan-mode"));
    const playScreen = document.getElementById(config.screen);
    if (playScreen) playScreen.classList.toggle("shingan-mode", config.guideLevel === 0);
    clearComboFx();
    mountTitle(config);
    clearResult();
    if (config.seconds) {
      active.timer = window.setInterval(() => {
        if (!active || active.paused) return;
        active.remaining -= 1;
        if (active.remaining <= 0) completeRunner();
        else updateUi();
      }, 1000);
    }
    beginItem();
  }

  function mountTitle(config) {
    const titleId = config.screen === "S3" ? "examTitle" : "trainingTitle";
    const title = byId(titleId);
    if (title) title.textContent = config.title || "修行";
  }

  function activeIds() {
    const exam = active && active.config.screen === "S3";
    return {
      stats: exam ? "examStats" : "trainingStats",
      prompt: exam ? "examPromptKana" : "promptKana",
      furigana: exam ? "" : "promptFurigana",
      romaji: exam ? "examRomajiGuide" : "romajiGuide",
      guide: exam ? "examGuideMount" : "guideMount",
      progress: exam ? "examProgressMount" : "progressMount",
      phase: exam ? "examPhase" : ""
    };
  }

  function clearResult() {
    closeModal(false);
  }

  function beginItem() {
    if (!active || active.complete) return;
    if (active.index >= active.items.length) {
      completeRunner();
      return;
    }
    const item = active.items[active.index];
    active.session = InputEngine.start(item.text, { guideLevel: active.guideLevel, mode: active.mode });
    active.session.onEvent((event) => {
      active.lastEvent = event;
      active.metrics.consume(event);
      handleComboEvent(event);
      if (event.correct) {
        active.missCount = 0;
        if (globalThis.AudioManager) AudioManager.correct();
      } else {
        if (globalThis.AudioManager) AudioManager.miss();
        if (active.missUnit === event.unitIndex) active.missCount += 1;
        else {
          active.missUnit = event.unitIndex;
          active.missCount = 1;
        }
        if (active.missCount >= 2) showRescue();
      }
      updateUi();
    });
    active.missUnit = -1;
    active.missCount = 0;
    active.rescue = false;
    if (item.kind === "letter" && globalThis.AudioManager) {
      AudioManager.speak(NYUMON_WORDS.furigana[item.text] || item.text);
    }
    updateUi();
  }

  function showRescue() {
    active.rescue = true;
    const ids = activeIds();
    const prompt = byId(ids.prompt);
    if (prompt) {
      prompt.classList.remove("rescue-flash");
      void prompt.offsetWidth;
      prompt.classList.add("rescue-flash");
    }
    window.clearTimeout(active.rescueTimer);
    active.rescueTimer = window.setTimeout(() => {
      if (!active) return;
      active.rescue = false;
      updateUi();
    }, 3000);
  }

  function nextItem() {
    if (!active || active.complete) return;
    active.index += 1;
    beginItem();
  }

  function updateUi() {
    if (!active) return;
    const ids = activeIds();
    const item = active.items[active.index] || { text: "", kind: "word" };
    const summary = active.metrics.summary();
    const prompt = byId(ids.prompt);
    const furigana = byId(ids.furigana);
    const romaji = byId(ids.romaji);
    const guide = byId(ids.guide);
    const progress = byId(ids.progress);
    const stats = byId(ids.stats);
    const phase = byId(ids.phase);

    if (phase && active.config.phase) phase.textContent = active.config.phase;
    if (prompt) {
      prompt.style.setProperty("--prompt-size", promptSize(item.text));
      prompt.dataset.promptLength = String(Array.from(String(item.text || "")).length);
      prompt.innerHTML = promptProgressHtml(item.text, item.kind, active.session.progress());
    }
    if (furigana) {
      const itemNote = [item.display, item.source].filter(Boolean).join(" ／ ");
      furigana.textContent = item.kind === "letter" ? (NYUMON_WORDS.furigana[item.text] || "") : itemNote;
    }
    if (romaji) {
      if (active.guideLevel >= 1 || active.rescue) {
        const display = active.session.displayRomaji();
        const windowed = romajiWindow(display);
        romaji.setAttribute("aria-label", windowed.full);
        romaji.innerHTML = `${windowed.clippedTyped ? '<span class="romaji-ellipsis" aria-hidden="true">…</span>' : ""}<span class="typed">${escapeHtml(windowed.typed)}</span><span class="rest">${escapeHtml(windowed.rest)}</span>${windowed.clippedRest ? '<span class="romaji-ellipsis" aria-hidden="true">…</span>' : ""}`;
      } else {
        romaji.innerHTML = "";
        romaji.removeAttribute("aria-label");
      }
    }
    GuideRenderer.render(guide, {
      guideLevel: active.guideLevel,
      expectedKeys: active.session.nextExpectedKeys(),
      rescue: active.rescue
    });
    if (progress) {
      const dots = active.items.map((_, index) => index < active.index ? "●" : index === active.index ? "◐" : "○").join("");
      progress.textContent = `${dots}（${Math.min(active.index + 1, active.items.length)} / ${active.items.length}）`;
    }
    if (stats) {
      const acc = Math.round(summary.accuracy * 100);
      const parts = [`<span>気配:[${summary.currentRhythm}]</span>`, `<span>正確率:${acc}%</span>`];
      if (active.mode === "jissen") {
        parts.push(`<span>KPM:${Math.round(summary.kpm)}</span>`);
        if (active.remaining) parts.push(`<span>残り:${active.remaining}秒</span>`);
      }
      if (comboEnabled() && active.comboDisplay >= 5) {
        parts.push(`<span class="combo-count ${active.comboFading ? "fading" : ""}">れんげき ${active.comboDisplay}</span>`);
      }
      stats.innerHTML = parts.join(" ");
    }
  }

  function completeRunner() {
    if (!active || active.complete) return;
    active.complete = true;
    cleanupTimer();
    cleanupComboTimer();
    clearComboFx();
    const state = active;
    const summary = state.metrics.summary();
    if (state.config.onComplete) state.config.onComplete(summary, state);
    if (state.config.resultActions !== false) {
      const resultBody = state.config.renderResult
        ? state.config.renderResult(summary, state)
        : `<h2>修行の記録</h2>
          <p>正確率 ${Math.round(summary.accuracy * 100)}% ／ 正打 ${summary.correct} ／ ミス ${summary.miss} ／ 気配 ${summary.rhythm}</p>
          ${state.mode === "jissen" ? `<p>KPM ${Math.round(summary.kpm)}</p>` : ""}`;
      showResultModal(resultBody, summary, state);
    }
    if (globalThis.NindaApp) NindaApp.renderHome();
  }

  function showResultModal(resultBody, summary, state) {
    const parsed = parseResultBody(resultBody);
    const isJissen = state.mode === "jissen";
    const teacherNote = SaveManager.isTeacherMode && SaveManager.isTeacherMode()
      ? `<p class="teacher-result-note">先生モードのため、記録はのこりません</p>`
      : "";
    const resultData = state.resultData || {};
    const speedHtml = isJissen
      ? `<div class="result-speed">
          ${Number.isFinite(resultData.score) ? `<div><span>スコア</span><strong>${resultData.score}</strong></div>` : ""}
          <div><span>KPM</span><strong>${Math.round(summary.kpm)}</strong></div>
          ${resultData.tier ? `<div class="tier-box ${tierClass(resultData.tier)}"><span>Tier</span><strong><span class="tier-badge">${SVG_ICONS.tierBadge()}</span>${escapeHtml(resultData.tier)}</strong></div>` : ""}
        </div>`
      : "";
    const body = `<div class="result-modal">
        ${resultData.bestUpdated ? `<div class="result-best-ribbon">じこベスト！</div>` : ""}
        ${resultData.tier === "月光" ? `<div class="moon-bloom" aria-hidden="true"></div>` : ""}
        <div class="result-main-stat">
          <span>正確率</span>
          <strong>${Math.round(summary.accuracy * 100)}%</strong>
        </div>
        <div class="result-summary-grid">
          <div><span>気配</span><strong>${escapeHtml(summary.rhythm)}</strong></div>
          <div><span>最大連撃</span><strong>${summary.maxCombo || 0}</strong></div>
          <div><span>正打</span><strong>${summary.correct}</strong></div>
          <div><span>ミス</span><strong>${summary.miss}</strong></div>
        </div>
        ${speedHtml}
        ${weakKeysHtml(summary)}
        ${parsed.rest ? `<div class="result-message">${parsed.rest}</div>` : ""}
        ${teacherNote}
      </div>`;
    const actions = [
      {
        id: "again",
        label: "もういちど",
        primary: true,
        run() {
          const config = state.config;
          startRunner(config);
        }
      }
    ];
    const contextAction = resultContextAction(state);
    if (contextAction) actions.push(contextAction);
    actions.push({
      id: "home",
      label: "さとへもどる",
      run() {
        stop(true);
      }
    });
    openModal({
      title: parsed.title || (isJissen ? "実戦の記録" : "修行の記録"),
      bodyHtml: body,
      actions,
      defaultActionId: "again",
      escapeActionId: "home"
    });
    const mount = byId("resultModalMount");
    if (state.config.onResultMounted && mount) state.config.onResultMounted(mount, summary, state);
  }

  function parseResultBody(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const title = template.content.querySelector("h2");
    const titleText = title ? title.textContent.trim() : "";
    if (title) title.remove();
    return {
      title: titleText,
      rest: template.innerHTML.trim()
    };
  }

  function resultContextAction(state) {
    if (state.config.resultContextAction) return state.config.resultContextAction;
    if (state.config.screen === "S2" && state.mode === "training" && state.config.stageId !== "jissen") {
      return {
        id: "exam",
        label: "ためしにいどむ",
        run() {
          const stageId = state.config.stageId;
          closeModal(false);
          if (globalThis.ExamManager) ExamManager.start(stageId);
        }
      };
    }
    return null;
  }

  function weakKeysHtml(summary) {
    const weak = Object.entries(summary.keyStats || {})
      .filter(([, stat]) => stat.attempts > 0 && stat.misses > 0)
      .map(([key, stat]) => ({
        key,
        misses: stat.misses,
        attempts: stat.attempts,
        missRate: stat.misses / Math.max(1, stat.attempts)
      }))
      .sort((a, b) => b.missRate - a.missRate || b.misses - a.misses || b.attempts - a.attempts)
      .slice(0, 3);
    if (!weak.length) return "";
    return `<div class="result-weak">
      <h3>にがてだったキー</h3>
      <div class="result-weak-list">${weak.map((item) => `<span><kbd>${escapeHtml(item.key)}</kbd> ${Math.round(item.missRate * 100)}%</span>`).join("")}</div>
    </div>`;
  }

  function openModal(options) {
    const overlay = byId("resultOverlay");
    const mount = byId("resultModalMount");
    if (!overlay || !mount) return;
    const actions = options.actions || [];
    const actionButtons = actions.map((action) => {
      const classes = ["modal-action"];
      if (action.primary) classes.push("primary");
      return `<button type="button" class="${classes.join(" ")}" data-modal-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`;
    }).join("");
    mount.innerHTML = `<section class="${escapeHtml(options.className || "result-modal-shell")}">
      <h2 id="resultModalTitle">${escapeHtml(options.title || "記録")}</h2>
      ${options.bodyHtml || ""}
      <div class="button-row result-actions">${actionButtons}</div>
    </section>`;
    const actionMap = {};
    actions.forEach((action) => {
      actionMap[action.id] = action.run;
      const button = mount.querySelector(`[data-modal-action="${cssEscape(action.id)}"]`);
      if (button) button.addEventListener("click", action.run);
    });
    if (typeof options.onOpen === "function") options.onOpen(mount);
    modalState = {
      overlay,
      mount,
      actionMap,
      defaultActionId: Object.prototype.hasOwnProperty.call(options, "defaultActionId") ? options.defaultActionId : (actions[0] && actions[0].id),
      escapeActionId: options.escapeActionId || "",
      previousFocus: document.activeElement
    };
    ensureModalKeyListener();
    overlay.hidden = false;
    const focus = mount.querySelector(`[data-modal-action="${cssEscape(modalState.defaultActionId)}"]`) || mount.querySelector("button");
    if (focus) focus.focus();
  }

  function ensureModalKeyListener() {
    if (modalKeyListenerReady) return;
    modalKeyListenerReady = true;
    document.addEventListener("keydown", (event) => {
      if (!modalState || modalState.overlay.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        runModalAction(modalState.escapeActionId);
        return;
      }
      if (event.key === "Enter" && !isEditableTarget(event.target)) {
        if (!modalState.defaultActionId) return;
        event.preventDefault();
        runModalAction(modalState.defaultActionId);
        return;
      }
      if (event.key === "Tab") trapModalFocus(event);
    });
  }

  function runModalAction(actionId) {
    if (!modalState || !actionId) return;
    const action = modalState.actionMap[actionId];
    if (action) action();
  }

  function trapModalFocus(event) {
    const focusable = Array.from(modalState.overlay.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])"))
      .filter((element) => !element.disabled && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeModal(restoreFocus) {
    if (!modalState) {
      const overlay = byId("resultOverlay");
      const mount = byId("resultModalMount");
      if (overlay) overlay.hidden = true;
      if (mount) mount.innerHTML = "";
      return;
    }
    const previousFocus = modalState.previousFocus;
    modalState.overlay.hidden = true;
    modalState.mount.innerHTML = "";
    modalState = null;
    if (restoreFocus && previousFocus && previousFocus.focus) previousFocus.focus();
  }

  function isEditableTarget(target) {
    return !!(target && target.closest && target.closest("input, textarea, [contenteditable]"));
  }

  function cssEscape(value) {
    if (globalThis.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/"/g, "\\\"");
  }

  function tierClass(tier) {
    return {
      "銅": "tier-copper",
      "銀": "tier-silver",
      "金": "tier-gold",
      "白金": "tier-platinum",
      "月光": "tier-gekko"
    }[tier] || "tier-none";
  }

  function cleanupTimer() {
    if (active && active.timer) window.clearInterval(active.timer);
  }

  function cleanupComboTimer() {
    if (active && active.comboFadeTimer) window.clearTimeout(active.comboFadeTimer);
  }

  function comboEnabled() {
    return !!(active && active.config.screen === "S2" && (active.mode === "training" || active.mode === "jissen"));
  }

  function handleComboEvent(event) {
    if (!comboEnabled()) return;
    const summary = active.metrics.summary();
    if (event.correct) {
      cleanupComboTimer();
      active.comboFading = false;
      active.comboDisplay = summary.combo;
      if (summary.combo > 0 && summary.combo % 10 === 0 && active.lastComboMilestone !== summary.combo) {
        active.lastComboMilestone = summary.combo;
        triggerShuriken(summary.combo);
      }
      return;
    }
    if (active.comboDisplay >= 5) {
      active.comboFading = true;
      cleanupComboTimer();
      const run = active;
      active.comboFadeTimer = window.setTimeout(() => {
        if (active !== run) return;
        active.comboDisplay = 0;
        active.comboFading = false;
        updateUi();
      }, 520);
    } else {
      active.comboDisplay = 0;
      active.comboFading = false;
    }
  }

  function triggerShuriken(combo) {
    const mount = byId("comboFx");
    if (!mount) return;
    if (!mount.querySelector(".combo-target")) {
      mount.innerHTML = `<div class="combo-target" aria-hidden="true">
        <span class="target-ring"></span>
        <span class="shuriken-stack"></span>
      </div>`;
    }
    const target = mount.querySelector(".combo-target");
    const stack = mount.querySelector(".shuriken-stack");
    if (!target || !stack) return;
    if (stack.children.length < 5) {
      const hit = document.createElement("span");
      hit.className = "shuriken-hit";
      hit.dataset.combo = String(combo);
      hit.innerHTML = SVG_ICONS.shuriken();
      stack.appendChild(hit);
    } else {
      target.classList.remove("combo-target-flash");
      void target.offsetWidth;
      target.classList.add("combo-target-flash");
    }
    if (globalThis.AudioManager && AudioManager.shuriken) AudioManager.shuriken();
  }

  function clearComboFx() {
    const mount = byId("comboFx");
    if (mount) mount.innerHTML = "";
  }

  function stop(goHome) {
    cleanupTimer();
    cleanupComboTimer();
    clearComboFx();
    closeModal(false);
    document.querySelectorAll(".play-screen").forEach((screen) => screen.classList.remove("shingan-mode"));
    active = null;
    if (goHome && globalThis.NindaApp) NindaApp.showScreen("S1");
  }

  function setPaused(paused) {
    if (active) active.paused = paused;
  }

  function isActive() {
    return !!active;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  return {
    start,
    startRunner,
    stop,
    setPaused,
    isActive,
    sample,
    stageById,
    refByName,
    formatPrompt,
    promptSize,
    promptProgressHtml,
    romajiWindow,
    openModal,
    closeModal
  };
})();
