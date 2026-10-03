const TrainingManager = globalThis.TrainingManager = (function () {
  "use strict";

  const PROMPT_LAYOUT_CONFIG = {
    sizes: [
      { maxLength: 12, value: "clamp(48px, 6vw, 72px)", kanji: "42px" },
      { maxLength: 24, value: "36px", kanji: "28px" },
      { maxLength: 44, value: "30px", kanji: "24px" },
      { maxLength: Infinity, value: "26px", kanji: "22px" }
    ],
    spacedMaxLength: 12,
    romajiWindow: { typed: 8, rest: 20 }
  };

  let active = null;
  let keyListenerReady = false;
  let modalKeyListenerReady = false;
  let modalState = null;
  let persistenceReady = false;
  const ITEM_TRANSITION_MS = 120;

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
    const result = [];
    while (result.length < count && pool && pool.length) {
      const source = pool.slice();
      while (result.length < count && source.length) {
        result.push(source.splice(Math.floor(Math.random() * source.length), 1)[0]);
      }
    }
    return result;
  }

  function buildTrainingItems(stage, menuIndex) {
    if (menuIndex === "review") return buildReviewItems(stage);
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

  function buildReviewItems(stage, focusKeys) {
    const stages = CURRICULUM_DATA.stages.filter((item) => item.type === "kyu");
    const keySet = new Set(stages.slice(0, stages.findIndex((item) => item.id === stage.id) + 1).flatMap((item) => item.newKeys));
    const ref = refByName(stage.wordsRef);
    const kind = stage.training[stage.training.length - 1].kind;
    const pool = (kind === "in" ? ref.in : kind === "sentence" ? ref.sentences : ref.words).filter((text) => InputEngine.isTypeable(text, keySet));
    const weak = focusKeys && focusKeys.length ? focusKeys.filter((key) => keySet.has(key))
      : MetricsEngine.weakKeys(SaveManager.ensure().keyStats, 5).filter((item) => keySet.has(item.key)).map((item) => item.key);
    return adaptiveItems(pool, weak,
      CURRICULUM_DATA.review.counts[kind], kind, keySet);
  }

  function adaptiveItems(pool, weak, count, kind, keySet) {
    const scores = new Map(pool.map((text) => {
      const units = InputEngine.segment(text);
      const paths = units.flatMap((unit, index) => InputEngine._candidatesFor(units, index))
        .filter((path) => !keySet || Array.from(path).every((key) => keySet.has(key)));
      const priority = weak.findIndex((key) => paths.some((path) => path.includes(key)));
      return [text, priority < 0 ? 0 : weak.length - priority];
    }));
    const shuffled = sample(pool, pool.length).sort((a, b) => scores.get(b) - scores.get(a));
    const selected = shuffled.slice(0, count);
    while (selected.length < count && pool.length) selected.push(...sample(pool, Math.min(pool.length, count - selected.length)));
    return selected.map((text) => ({ text, kind }));
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

  function kanjiSize(text) {
    const length = Array.from(String(text || "")).length;
    const step = PROMPT_LAYOUT_CONFIG.sizes.find((item) => length <= item.maxLength);
    return step ? step.kanji : PROMPT_LAYOUT_CONFIG.sizes[PROMPT_LAYOUT_CONFIG.sizes.length - 1].kanji;
  }

  function promptProgressHtml(text, kind, progress, lines) {
    const source = String(text || "");
    let units;
    try {
      units = InputEngine.segment(source).map((unit) => unit.kana);
    } catch (error) {
      units = Array.from(source);
    }
    const currentIndex = progress && Number.isFinite(progress.unitIndex) ? progress.unitIndex : 0;
    const addSpaces = source.length <= PROMPT_LAYOUT_CONFIG.spacedMaxLength && !/^[a-z.,-]+$/.test(source);
    const breaks = new Set();
    if (Array.isArray(lines) && lines.join("") === source) {
      let length = 0;
      lines.slice(0, -1).forEach((line) => { length += line.length; breaks.add(length); });
    }
    let offset = 0;
    const html = units.map((unit, index) => {
      const newline = breaks.has(offset) ? '<br class="prompt-line-break">' : "";
      offset += unit.length;
      const label = kind === "letter" ? unit.toUpperCase() : unit;
      const state = index < currentIndex ? " done" : index === currentIndex ? " current" : "";
      const separator = addSpaces && index < units.length - 1 ? '<span class="prompt-separator" aria-hidden="true"> </span>' : "";
      return `${newline}<span class="prompt-unit${state}">${escapeHtml(label)}</span>${separator}`;
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

  function displayHtml(display, ruby, lines) {
    const label = String(display || "");
    if (Array.isArray(lines) && lines.join("") === label) {
      let offset = 0;
      return lines.map((line) => {
        const start = offset;
        offset += line.length;
        let cursor = 0;
        const valid = Array.isArray(ruby) && ruby.every((part) => Array.isArray(part) && typeof part[0] === "string" && part[0]
          && (part.length === 1 || part.length === 2 && typeof part[1] === "string" && part[1]));
        const parts = valid ? ruby.flatMap((part) => {
          const before = cursor; cursor += part[0].length;
          if (cursor <= start || before >= offset) return [];
          const slice = part[0].slice(Math.max(0, start - before), Math.min(part[0].length, offset - before));
          return [slice === part[0] ? part : [slice]];
        }) : [];
        return displayHtml(line, parts);
      }).join('<br class="prompt-line-break">');
    }
    if (!Array.isArray(ruby) || !ruby.length) return escapeHtml(label);
    const valid = ruby.every((part) => Array.isArray(part) && (part.length === 1 || part.length === 2)
      && typeof part[0] === "string" && part[0].length > 0
      && (part.length === 1 || typeof part[1] === "string" && part[1].length > 0));
    const joined = valid ? ruby.map((part) => part[0]).join("") : "";
    if (!valid || joined !== label) return escapeHtml(label);
    return ruby.map((part) => part.length === 2
      ? `<ruby>${escapeHtml(part[0])}<rt>${escapeHtml(part[1])}</rt></ruby>`
      : escapeHtml(part[0])).join("");
  }

  function ensureKeyListener() {
    if (keyListenerReady) return;
    keyListenerReady = true;
    document.addEventListener("keydown", (event) => {
      if (!active || active.complete || active.paused || active.transitioning || !active.session) return;
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.repeat || event.isComposing || event.keyCode === 229
        || isEditableTarget(event.target) || event.key === "Escape" || modalState
        || !byId("menuOverlay").hidden || byId(active.config.screen).hidden) return;
      const run = active;
      if (run.config.seconds && run.metrics.elapsedSeconds() >= run.config.seconds) { completeRunner(); return; }
      const result = run.session.handleKey(event.key);
      if (result !== "ignore") event.preventDefault();
      if (result === "done") {
        run.transitioning = true;
        run.completedItems += 1;
        run.completedTexts.push(run.items[run.index].text);
        if (run.config.onItemComplete) run.config.onItemComplete(run.items[run.index], run);
        updateUi();
        run.transitionTimer = window.setTimeout(() => {
          if (active !== run || run.complete) return;
          run.transitioning = false;
          nextItem();
        }, ITEM_TRANSITION_MS);
      }
    });
  }

  function start(stageId, menuIndex) {
    const stage = stageById(stageId);
    if (!stage) return;
    if (!SaveManager.stageUnlocked(stageId)) return;
    if (globalThis.ExamManager) ExamManager.cancel();
    const menu = Number.isInteger(menuIndex) ? stage.training[menuIndex] : null;
    const items = buildTrainingItems(stage, menuIndex);
    if (globalThis.NindaApp) NindaApp.showScreen("S2");
    startRunner({
      screen: "S2",
      stageId: stage.id,
      title: `${stage.label}「${stage.title}」${menuIndex === "review" ? ` ${CURRICULUM_DATA.review.label}` : menu ? ` ${menu.label}` : ""}`,
      items,
      guideLevel: stage.type === "nyumon" ? 3 : stage.guideLevelTraining,
      mode: "training",
      purpose: menuIndex === "review" ? "review" : "practice",
      retry() { start(stageId, menuIndex); },
      onComplete(summary, state) {
        if (globalThis.AchievementManager) AchievementManager.checkSession(summary);
      }
    });
  }

  function startRunner(config) {
    ensureKeyListener();
    ensurePersistence();
    if (active && !active.complete) checkpoint(false, true);
    cleanupTimer();
    cleanupComboTimer();
    cleanupItemTimers();
    const clock = config.clock || (() => performance.now());
    active = {
      config,
      items: (config.items || []).slice(),
      index: 0,
      session: null,
      metrics: MetricsEngine.createSession({ mode: config.mode, clock }),
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
      transitioning: false,
      completedItems: 0,
      completedTexts: [],
      persisted: { correct: 0, miss: 0, words: 0, keyStats: {}, unitStats: {}, confusions: {} },
      previousRecord: SaveManager.ensure().eventLog.slice().reverse().find((entry) => entry.type === "session_end" && entry.completed && entry.id === (config.recordId || config.stageId)),
      comboDisplay: 0,
      comboFading: false,
      comboFadeTimer: null,
      lastComboMilestone: 0,
      checkpointTimer: null,
      kanjiDisplay: SaveManager.ensure().settings.kanjiDisplay !== false
    };
    document.querySelectorAll(".play-screen").forEach((screen) => screen.classList.remove("shingan-mode"));
    const playScreen = document.getElementById(config.screen);
    if (playScreen) playScreen.classList.toggle("shingan-mode", config.guideLevel === 0);
    clearComboFx();
    const courier = byId("courierMount");
    if (courier) { courier.innerHTML = ""; courier.hidden = true; }
    if (playScreen) playScreen.classList.toggle("courier-mode", config.presentation === "courier");
    if (playScreen) playScreen.classList.toggle("literature-mode", config.presentation === "literature");
    ["trainingStats", "examStats"].forEach((id) => { const element = byId(id); if (element) element.innerHTML = ""; });
    mountTitle(config);
    clearResult();
    if (config.onStart) config.onStart(active);
    if (config.seconds) {
      const run = active;
      active.timer = window.setInterval(() => {
        if (active !== run || run.paused || run.complete) return;
        run.remaining = Math.max(0, Math.ceil(config.seconds - run.metrics.elapsedSeconds()));
        if (run.remaining <= 0) completeRunner();
        else updateUi();
      }, 100);
    }
    const run = active;
    active.checkpointTimer = window.setInterval(() => { if (active === run && !run.complete) checkpoint(true); }, 30000);
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
      if (active.config.seconds && active.items.length) {
        active.items.push(...(active.config.refillItems ? active.config.refillItems() : sample(active.config.pool || active.config.items, (active.config.pool || active.config.items).length)));
      } else {
        completeRunner();
        return;
      }
    }
    const item = active.items[active.index];
    if (active.config.onItemStart) active.config.onItemStart(item, active);
    active.session = InputEngine.start(item.text, { guideLevel: active.guideLevel, mode: active.mode });
    const run = active;
    active.session.onEvent((event) => {
      if (active !== run || run.complete || run.paused) return;
      active.lastEvent = event;
      active.metrics.consume(event);
      handleComboEvent(event);
      if (event.correct) {
        active.missCount = 0;
        active.rescue = false;
        window.clearTimeout(active.rescueTimer);
        if (globalThis.AudioManager) AudioManager.correct();
      } else {
        flashMiss();
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
    window.clearTimeout(active.rescueTimer);
    const run = active;
    active.rescueTimer = window.setTimeout(() => {
      if (active !== run || run.complete) return;
      active.rescue = false;
      updateUi();
    }, 3000);
  }

  function flashMiss() {
    const ids = activeIds();
    const prompt = byId(ids.prompt);
    if (prompt) {
      prompt.classList.remove("rescue-flash");
      void prompt.offsetWidth;
      prompt.classList.add("rescue-flash");
    }
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
    const summary = active.finalSummary || active.metrics.summary();
    const prompt = byId(ids.prompt);
    const furigana = byId(ids.furigana);
    const romaji = byId(ids.romaji);
    const guide = byId(ids.guide);
    const progress = byId(ids.progress);
    const stats = byId(ids.stats);
    const phase = byId(ids.phase);

    if (phase && active.config.phase) phase.textContent = active.config.phase;
    if (prompt) {
      const showKanji = active.kanjiDisplay && !!item.display;
      prompt.style.setProperty("--prompt-size", promptSize(item.text));
      prompt.style.setProperty("--kanji-size", kanjiSize(item.text));
      prompt.dataset.promptLength = String(Array.from(String(item.text || "")).length);
      prompt.classList.toggle("has-kanji", showKanji);
      prompt.innerHTML = `${showKanji ? `<span class="prompt-kanji">${displayHtml(item.display, item.ruby, item.displayLines)}</span>` : ""}${promptProgressHtml(item.text, item.kind, active.session.progress(), item.kanaLines)}`;
    }
    if (furigana) {
      furigana.textContent = item.kind === "letter" ? (NYUMON_WORDS.furigana[item.text] || "") : (item.source || "");
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
      rescue: active.rescue,
      fingerSymbols: SaveManager.ensure().settings.fingerSymbols
    });
    if (progress) {
      const dots = active.config.seconds ? "" : active.items.map((_, index) => index < active.index ? "●" : index === active.index ? "◐" : "○").join("");
      progress.textContent = active.config.seconds ? `${active.completedItems}問 おわった` : `${dots}（${Math.min(active.index + 1, active.items.length)} / ${active.items.length}）`;
      if (active.config.presentation === "literature") progress.textContent = UI_TEXT.literature.part.replace("{title}", item.workTitle || active.config.title).replace("{index}", String((item.partIndex || 0) + 1)).replace("{total}", String(item.partTotal || active.items.length));
    }
    if (stats) {
      const acc = Math.round(summary.accuracy * 100);
      const parts = [`<span>気配:[${summary.currentRhythm}]</span>`, `<span>正確率:${acc}%</span>`];
      if (active.mode === "jissen") {
        parts.push(`<span>KPM:${Math.round(summary.kpm)}</span>`);
        if (active.config.seconds) parts.push(`<span>残り:${active.remaining}秒</span>`);
      }
      if (comboEnabled() && active.comboDisplay >= 5) {
        parts.push(`<span class="combo-count ${active.comboFading ? "fading" : ""}">れんげき ${active.comboDisplay}</span>`);
      }
      stats.innerHTML = parts.join(" ");
    }
    if (active.config.onUpdate) active.config.onUpdate(summary, active);
  }

  function completeRunner() {
    if (!active || active.complete) return;
    active.complete = true;
    cleanupTimer();
    cleanupComboTimer();
    cleanupItemTimers();
    clearComboFx();
    const state = active;
    const summary = state.metrics.summary(undefined, state.config.seconds || undefined);
    state.finalSummary = summary;
    if (state.config.seconds) state.remaining = 0;
    checkpoint(false, false, summary);
    updateUi();
    if (state.config.onComplete) state.config.onComplete(summary, state);
    if (state.config.resultActions !== false) {
      const resultBody = state.config.renderResult
        ? state.config.renderResult(summary, state)
        : `<h2>${state.mode === "jissen" ? "実戦の記録" : "修行の記録"}</h2>`;
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
    const advice = state.config.screen === "S2" && state.config.advice !== false ? LearningManager.advice(summary, state.config.contentStageId || state.config.stageId) : null;
    const speedHtml = isJissen
      ? `<div class="result-speed">
          ${Number.isFinite(resultData.score) ? `<div><span>スコア</span><strong>${resultData.score}</strong></div>` : ""}
          <div><span>KPM</span><strong>${Math.round(summary.kpm)}</strong></div>
          ${resultData.tier ? `<div class="tier-box ${tierClass(resultData.tier)}"><span>Tier</span><strong><span class="tier-badge">${SVG_ICONS.tierBadge()}</span>${escapeHtml(resultData.tier)}</strong></div>` : ""}
        </div>`
      : "";
    const body = `<div class="result-modal ${resultData.challengeCode ? "result-courier" : ""}">
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
        ${growthHtml(summary, state.previousRecord)}
        ${resultData.detail ? `<p class="result-game-detail">${escapeHtml(resultData.detail)}</p>` : ""}
        ${resultData.challengeCode ? `<label class="result-challenge">${UI_TEXT.shared.result}<input type="text" readonly value="${escapeHtml(resultData.challengeCode)}" aria-label="${UI_TEXT.shared.code}"></label>` : ""}
        ${advice ? `<div class="result-coach"><h3>${UI_TEXT.coach.title}</h3><p>${escapeHtml(advice.text)}</p></div>` : ""}
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
          if (config.retry) config.retry();
          else startRunner(config);
        }
      }
    ];
    const contextAction = resultContextAction(state);
    if (contextAction) actions.push(contextAction);
    if (advice && (advice.drill || advice.review)) actions.push({ id: "coach", label: advice.drill ? UI_TEXT.coach.action : UI_TEXT.coach.review,
      run() { stop(false); LearningManager.runPractice(advice.stageId, advice.drill ? "mini" : "review", advice.drill, { pair: advice.pair, key: advice.key }); } });
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
      if (event.key === "Enter" && (!isEditableTarget(event.target) || event.target.readOnly)) {
        const focused = event.target && event.target.closest && event.target.closest("[data-modal-action]");
        const actionId = focused ? focused.dataset.modalAction : modalState.defaultActionId;
        if (!actionId) return;
        event.preventDefault();
        runModalAction(actionId);
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
    if (active && active.checkpointTimer) window.clearInterval(active.checkpointTimer);
  }

  function cleanupItemTimers() {
    if (!active) return;
    window.clearTimeout(active.transitionTimer);
    window.clearTimeout(active.rescueTimer);
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
    active.lastComboMilestone = 0;
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
    if (active && !active.complete) checkpoint(false, true);
    if (active && active.config.onCancel) active.config.onCancel();
    cleanupTimer();
    cleanupComboTimer();
    cleanupItemTimers();
    clearComboFx();
    const courier = byId("courierMount");
    if (courier) { courier.innerHTML = ""; courier.hidden = true; }
    closeModal(false);
    document.querySelectorAll(".play-screen").forEach((screen) => screen.classList.remove("shingan-mode"));
    active = null;
    if (globalThis.AudioManager && AudioManager.cancelSpeech) AudioManager.cancelSpeech();
    if (goHome && globalThis.NindaApp) NindaApp.showScreen("S1");
  }

  function setPaused(paused) {
    if (!active || active.complete || active.paused === paused) return;
    active.metrics.setPaused(paused);
    active.paused = paused;
  }

  function isActive() {
    return !!active && !active.complete;
  }

  function ensurePersistence() {
    if (persistenceReady) return;
    persistenceReady = true;
    window.addEventListener("beforeunload", () => { checkpoint(true); SaveManager.flush(); });
    window.addEventListener("pagehide", () => { checkpoint(true); SaveManager.flush(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) checkpoint(true); });
  }

  function checkpoint(partial, aborted, finalSummary) {
    if (!active || (active.complete && !finalSummary)) return;
    const run = active;
    const summary = finalSummary || run.metrics.summary();
    const before = run.persisted;
    const keyStats = {};
    Object.entries(summary.keyStats).forEach(([key, stat]) => {
      const previous = before.keyStats[key] || { attempts: 0, misses: 0, sumLatency: 0 };
      const attempts = stat.attempts - previous.attempts;
      keyStats[key] = { attempts, misses: stat.misses - previous.misses, sumLatency: stat.sumLatency - previous.sumLatency,
        recent: attempts ? stat.recent.slice(-Math.min(attempts, 20)) : [] };
    });
    const delta = Object.assign({}, summary, { correct: summary.correct - before.correct, miss: summary.miss - before.miss, keyStats });
    delta.unitStats = Object.fromEntries(Object.entries(summary.unitStats || {}).map(([unit, stat]) => [unit, {
      attempts: stat.attempts - (before.unitStats[unit]?.attempts || 0), misses: stat.misses - (before.unitStats[unit]?.misses || 0)
    }]));
    delta.confusions = Object.fromEntries(Object.entries(summary.confusions || {}).map(([pair, count]) => [pair, count - (before.confusions[pair] || 0)]));
    const event = partial ? null : {
      id: run.config.recordId || run.config.stageId || "dan", mode: run.mode, completed: !aborted,
      correct: summary.correct, miss: summary.miss, acc: summary.accuracy, rhythm: summary.rhythm,
      maxCombo: summary.maxCombo, words: run.completedItems, keyStats: summary.keyStats,
      stageId: run.config.stageId, purpose: run.config.purpose || "practice", lessonId: run.config.lessonId || "",
      literatureId: !aborted && !run.config.seconds && run.completedItems === run.items.length ? run.config.literatureId || "" : "",
      readings: run.completedTexts.filter((text) => LearningManager.readingEntries().some((item) => item.kana === text)),
      delivered: run.config.presentation === "courier" ? run.completedItems : 0,
      ...(run.mode === "jissen" ? { kpm: summary.kpm } : {})
    };
    SaveManager.addSessionSummary(run.config.stageId, delta, run.completedItems - before.words,
      { partial: partial || aborted, event });
    run.persisted = { correct: summary.correct, miss: summary.miss, words: run.completedItems, keyStats: summary.keyStats, unitStats: summary.unitStats, confusions: summary.confusions };
    if (!partial) SaveManager.flush();
  }

  function growthHtml(summary, previous) {
    if (!previous || SaveManager.isTeacherMode()) return "";
    const diff = Math.round((summary.accuracy - previous.acc) * 100);
    const improved = Object.entries(summary.keyStats).filter(([key, stat]) => {
      const before = previous.keyStats && previous.keyStats[key];
      return before && before.attempts >= 3 && stat.attempts >= 3 && stat.misses / stat.attempts < before.misses / before.attempts;
    }).map(([key]) => key).slice(0, 3);
    return `<div class="result-growth"><h3>${UI_TEXT.growth.compare}</h3><p>${UI_TEXT.growth.accuracy} ${diff > 0 ? "+" : ""}${diff}${UI_TEXT.growth.points} ／ ${UI_TEXT.growth.rhythm} ${escapeHtml(previous.rhythm)} → ${escapeHtml(summary.rhythm)}</p>
      ${improved.length ? `<p>${UI_TEXT.growth.improved} ${improved.map((key) => `<kbd>${escapeHtml(key)}</kbd>`).join(" ")}</p>` : ""}</div>`;
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
    hasSession: () => !!active,
    sample,
    stageById,
    refByName,
    formatPrompt,
    promptSize,
    kanjiSize,
    promptProgressHtml,
    romajiWindow,
    displayHtml,
    openModal,
    closeModal,
    buildReviewItems, adaptiveItems, checkpoint, itemTransitionMs: ITEM_TRANSITION_MS
  };
})();
