const TrainingManager = globalThis.TrainingManager = (function () {
  "use strict";

  let active = null;
  let keyListenerReady = false;

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

  function buildTrainingItems(stage) {
    const ref = refByName(stage.wordsRef);
    if (stage.type === "nyumon") {
      const keys = NYUMON_WORDS.sections[stage.id] || [];
      const count = stage.training[0].count;
      return sample(keys, count).map((key) => ({ text: key, kind: "letter" }));
    }
    const items = [];
    for (const menu of stage.training) {
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

  function start(stageId) {
    const stage = stageById(stageId);
    if (!stage) return;
    const items = buildTrainingItems(stage);
    if (globalThis.NindaApp) NindaApp.showScreen("S2");
    startRunner({
      screen: "S2",
      stageId: stage.id,
      title: `${stage.label}「${stage.title}」`,
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
      result: exam ? "examResultMount" : "resultMount",
      phase: exam ? "examPhase" : ""
    };
  }

  function clearResult() {
    const ids = activeIds();
    const result = byId(ids.result);
    if (result) {
      result.hidden = true;
      result.innerHTML = "";
    }
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
    if (prompt) prompt.textContent = formatPrompt(item.text, item.kind);
    if (furigana) furigana.textContent = item.kind === "letter" ? (NYUMON_WORDS.furigana[item.text] || "") : "";
    if (romaji) {
      if (active.guideLevel >= 1 || active.rescue) {
        const display = active.session.displayRomaji();
        romaji.innerHTML = `<span class="typed">${escapeHtml(display.typed)}</span><span class="rest">${escapeHtml(display.rest)}</span>`;
      } else {
        romaji.innerHTML = "";
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
    const ids = activeIds();
    const result = byId(ids.result);
    if (state.config.onComplete) state.config.onComplete(summary, state);
    if (result) {
      const resultBody = state.config.renderResult
        ? state.config.renderResult(summary, state)
        : `<h2>修行の記録</h2>
          <p>正確率 ${Math.round(summary.accuracy * 100)}% ／ 正打 ${summary.correct} ／ ミス ${summary.miss} ／ 気配 ${summary.rhythm}</p>
          ${state.mode === "jissen" ? `<p>KPM ${Math.round(summary.kpm)}</p>` : ""}`;
      const actions = state.config.resultActions === false
        ? ""
        : `<div class="button-row"><button data-result-action="again">もういちど</button><button data-result-action="home">さとにもどる</button></div>`;
      const teacherNote = SaveManager.isTeacherMode && SaveManager.isTeacherMode()
        ? `<p class="teacher-result-note">先生モードのため、記録はのこりません</p>`
        : "";
      result.hidden = false;
      result.innerHTML = resultBody + teacherNote + actions;
      const again = result.querySelector('[data-result-action="again"]');
      const home = result.querySelector('[data-result-action="home"]');
      if (again) again.addEventListener("click", () => {
          const config = state.config;
          startRunner(config);
        });
      if (home) home.addEventListener("click", () => {
          stop(true);
        });
      if (state.config.onResultMounted) state.config.onResultMounted(result, summary, state);
    }
    if (globalThis.NindaApp) NindaApp.renderHome();
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
    formatPrompt
  };
})();
