const APP_VERSION = "1.7.1";
const TEACHER_PASSCODE = "2361";

const UI_TEXT = globalThis.UI_TEXT = {
  appName: "忍打道 —NINDA DO—",
  catch: "型（かた）をきわめた者だけが、疾風（はやて）をゆるされる。——それが、忍打道。",
  fail: "まだ機（き）は熟していない。もういちど修行だ！",
  noPractice: "まずは一回、しゅぎょうしてからいどもう。",
  keyboardOnly: "このアプリはキーボードをつないであそんでね",
  trainingDesc: {
    in: "あたらしいキーを、ゆびにおぼえさせる。",
    word: "ならったかなで、ことばをうつ。",
    sentence: "みじかい文で、心眼にそなえる。",
    letter: "もじのばしょを、ひとつずつおぼえる。"
  },
  examDesc: "ごうかくすれば、つぎへすすめる。",
  guideLevel: {
    0: "ガイドなし",
    1: "ローマ字だけ",
    2: "ローマ字とキーボード",
    3: "ぜんぶのガイド"
  },
  lockedPractice: "まず修行を1かいやろう",
  noBanzukeRecord: "まだ記録なし",
  danMeta: {
    exam: "三の試し",
    kpmUnit: "打/分"
  },
  secretDan: {
    hiddenName: "？？？",
    hiddenDesc: "まだ、その名を知らぬ",
    revealToast: "あらたな影が、道の先に見えた"
  },
  kanjiDisplaySetting: "かんじで ひょうじ（ふりがなつき）"
};

const NindaApp = globalThis.NindaApp = (function () {
  "use strict";

  const screens = ["S0", "S1", "S2", "S3", "S4", "S5", "S6"];
  let currentScreen = "S0";
  let teacherStageId = "";
  let teacherDanTargetId = "";
  let menuState = null;
  let menuKeyListenerReady = false;
  const revealedSecretDans = new Set();

  function byId(id) {
    return document.getElementById(id);
  }

  function init() {
    const logo = byId("logoMount");
    if (logo) logo.innerHTML = SVG_ICONS.logo();
    wireNavigation();
    wireEntry();
    wireImeGuard();
    wireEscape();
    AudioManager.init();
    applyTheme();
    if (SaveManager.load()) {
      byId("continueButton").hidden = false;
    }
    showScreen(SaveManager.load() ? "S1" : "S0");
  }

  function wireNavigation() {
    document.querySelectorAll("[data-screen]").forEach((button) => {
      button.addEventListener("click", () => showScreen(button.dataset.screen));
    });
    document.querySelectorAll(".backHome").forEach((button) => {
      button.addEventListener("click", () => {
        if (!TrainingManager.isActive() || confirm("修行をやめて、さとにもどる？")) {
          TrainingManager.stop(true);
        }
      });
    });
    byId("trainingButton").addEventListener("click", () => {
      if (SaveManager.isTeacherMode() && teacherDanTargetId) {
        openJissenMenu();
        return;
      }
      openStageMenu(currentStage().id);
    });
    byId("examButton").addEventListener("click", () => {
      if (SaveManager.isTeacherMode() && teacherDanTargetId) {
        openJissenMenu();
        return;
      }
      openStageMenu(currentStage().id);
    });
    byId("jissenButton").addEventListener("click", openJissenMenu);
  }

  function wireEntry() {
    const form = byId("nameForm");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      startNew("nyumon1");
    });
    byId("startKyu10").addEventListener("click", () => startNew("kyu10"));
    byId("continueButton").addEventListener("click", () => showScreen("S1"));
  }

  function startNew(stageId) {
    const name = byId("ninjaName").value || "しのびまる";
    SaveManager.create(name, stageId);
    applyTheme();
    byId("continueButton").hidden = false;
    showScreen("S1");
  }

  function handleStart(event, stageId) {
    if (event) event.preventDefault();
    startNew(stageId || "nyumon1");
    return false;
  }

  function wireImeGuard() {
    const overlay = byId("imeOverlay");
    const closeButton = byId("imeOverlayClose");
    let imeOverlayOpen = false;
    function isEditableTarget(target) {
      return !!(target && target.closest && target.closest("input, textarea, [contenteditable]"));
    }
    function isPlayActive() {
      return (currentScreen === "S2" || currentScreen === "S3") && TrainingManager.isActive();
    }
    function showImeOverlay(event) {
      if (!isPlayActive() || isEditableTarget(event && event.target)) return;
      overlay.hidden = false;
      imeOverlayOpen = true;
      TrainingManager.setPaused(true);
      if (closeButton) closeButton.focus();
    }
    function hideImeOverlay() {
      overlay.hidden = true;
      imeOverlayOpen = false;
      TrainingManager.setPaused(false);
    }
    document.addEventListener("compositionstart", showImeOverlay);
    document.addEventListener("compositionend", hideImeOverlay);
    document.addEventListener("keydown", (event) => {
      if (isEditableTarget(event.target)) return;
      if ((event.isComposing || event.keyCode === 229) && isPlayActive()) {
        showImeOverlay(event);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!imeOverlayOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        hideImeOverlay();
        return;
      }
      if (event.isComposing === false && event.key && event.key.length === 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        hideImeOverlay();
      }
    });
    if (closeButton) closeButton.addEventListener("click", hideImeOverlay);
  }

  function wireEscape() {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const resultOverlay = byId("resultOverlay");
      if (resultOverlay && !resultOverlay.hidden) return;
      const menuOverlay = byId("menuOverlay");
      if (menuOverlay && !menuOverlay.hidden) return;
      if ((currentScreen === "S2" || currentScreen === "S3") && TrainingManager.isActive()) {
        event.preventDefault();
        if (confirm("修行をやめて、さとにもどる？")) TrainingManager.stop(true);
      }
    });
  }

  function showScreen(id) {
    applyTheme();
    currentScreen = id;
    screens.forEach((screenId) => {
      const el = byId(screenId);
      if (el) el.hidden = screenId !== id;
    });
    if (id === "S1") renderHome();
    if (id === "S4" && CollectionRenderer.render) CollectionRenderer.render("scrolls");
    if (id === "S5" && CollectionRenderer.renderLicense) CollectionRenderer.renderLicense();
    if (id === "S6" && CollectionRenderer.renderSettings) CollectionRenderer.renderSettings();
    const firstButton = byId(id) && byId(id).querySelector("button, input");
    if (firstButton) window.setTimeout(() => firstButton.focus(), 0);
  }

  function currentStage() {
    const save = SaveManager.ensure();
    if (SaveManager.isTeacherMode() && teacherStageId) {
      return CURRICULUM_DATA.stages.find((stage) => stage.id === teacherStageId) || CURRICULUM_DATA.stages[0];
    }
    return CURRICULUM_DATA.stages.find((stage) => stage.id === save.currentStage) || CURRICULUM_DATA.stages[0];
  }

  function renderHome() {
    const save = SaveManager.ensure();
    const teacher = SaveManager.isTeacherMode();
    const stage = currentStage();
    const teacherDan = teacherDanTargetId ? RANK_DATA.dans.find((item) => item.id === teacherDanTargetId) : null;
    const rankLabel = currentRankLabel(save);
    byId("currentRank").textContent = `${save.name} ／ ${rankLabel}`;
    byId("nextGoal").textContent = teacherDan
      ? `先生モード: ${teacherDan.label}の実戦と三の試し`
      : stage.id === "kyu1" && save.dan !== "none"
      ? "実戦の修行で、疾風の術をみがこう。"
      : `次は ${stage.label}「${stage.title}」`;
    byId("trainingButton").textContent = teacherDan ? "実戦の間へ" : "修行をえらぶ";
    byId("examButton").textContent = teacherDan ? "三の試しをえらぶ" : "試しもえらぶ";
    byId("examButton").disabled = false;
    byId("examButton").title = "";
    byId("jissenButton").hidden = !teacher && save.dan === "none";
    byId("jissenButton").textContent = "実戦の間へ";
    renderMap(save, teacherDan ? "" : stage.id);
  }

  function openStageMenu(stageId) {
    const save = SaveManager.ensure();
    const teacher = SaveManager.isTeacherMode();
    const stage = CURRICULUM_DATA.stages.find((item) => item.id === stageId) || currentStage();
    const cards = (stage.training || []).map((entry, index) => ({
      id: `training-${index}`,
      name: entry.label,
      desc: entry.desc || UI_TEXT.trainingDesc[stage.type === "nyumon" ? "letter" : entry.kind] || "",
      meta: trainingMeta(stage, entry),
      run() {
        closeMenuModal(false);
        TrainingManager.start(stage.id, index);
      }
    }));
    const examLocked = !teacher && !save.practicedStages.includes(stage.id);
    cards.push({
      id: "exam",
      name: "試しにいどむ",
      desc: UI_TEXT.examDesc,
      meta: examLocked ? UI_TEXT.lockedPractice : stageExamMeta(stage),
      locked: examLocked,
      run() {
        closeMenuModal(false);
        ExamManager.start(stage.id);
      }
    });
    openMenuModal({
      title: `${stage.label} ${stage.title}`,
      cards,
      teacherBadge: teacher
    });
  }

  function openJissenMenu() {
    const save = SaveManager.ensure();
    const teacher = SaveManager.isTeacherMode();
    if (!teacher && (!save.dan || save.dan === "none")) return;
    const cards = RANK_DATA.jissenMenu.map((menu) => ({
      id: menu.id,
      name: menu.label,
      desc: menu.desc,
      meta: jissenMeta(menu),
      run() {
        if (menu.kind === "banzuke") {
          openBanzukeCourseMenu();
          return;
        }
        closeMenuModal(false);
        ExamManager.startJissen(menu.id);
      }
    }));
    const targetDan = nextDanTarget(save);
    if (targetDan && targetDan.exam) {
      cards.push({
        id: "dan-exam",
        name: "三の試し",
        desc: targetDan.exam.desc,
        meta: danExamMeta(targetDan.exam),
        run() {
          closeMenuModal(false);
          ExamManager.startDanExam(targetDan.id);
        }
      });
    }
    openMenuModal({ title: "実戦の間", cards, teacherBadge: teacher });
  }

  function openBanzukeCourseMenu() {
    const save = SaveManager.ensure();
    const teacher = SaveManager.isTeacherMode();
    const bestByCourse = save.best && save.best.banzuke ? save.best.banzuke : {};
    const cards = RANK_DATA.banzuke.courses.map((course) => {
      const unlocked = teacher || danIndex(save.dan) >= danIndex(course.dan);
      const best = bestByCourse[course.id];
      return {
        id: course.id,
        name: course.label,
        desc: course.desc,
        meta: unlocked
          ? best ? `じこベスト ${best.score} ／ ${best.tier}` : UI_TEXT.noBanzukeRecord
          : `${danLabel(course.dan)}に昇段するとひらく`,
        locked: !unlocked,
        badgeHtml: best ? tierBadgeHtml(best.tier) : "",
        run() {
          closeMenuModal(false);
          ExamManager.startBanzukeCourse(course.id);
        }
      };
    });
    openMenuModal({
      title: "疾風番付 ── 道をえらぶ",
      cards,
      teacherBadge: teacher,
      back: { label: "もどる", run: openJissenMenu }
    });
  }

  function openMenuModal(options) {
    const overlay = byId("menuOverlay");
    const mount = byId("menuModalMount");
    if (!overlay || !mount) return;
    const previousFocus = menuState ? menuState.previousFocus : document.activeElement;
    const actionMap = {};
    const cardsHtml = options.cards.map((card) => {
      actionMap[card.id] = card.locked ? null : card.run;
      return `<button type="button" class="menu-card ${card.locked ? "locked" : ""}" data-menu-card="${escapeHtml(card.id)}" aria-disabled="${card.locked ? "true" : "false"}">
        <span class="menu-card-main">
          <strong class="menu-card-title">${card.locked ? `${lockIcon()}<span class="visually-hidden">ロック中</span>` : ""}${escapeHtml(card.name)}</strong>
          <span class="menu-card-desc">${escapeHtml(card.desc || "")}</span>
          <span class="menu-card-meta">${escapeHtml(card.meta || "")}</span>
        </span>
        ${card.badgeHtml ? `<span class="menu-card-badge">${card.badgeHtml}</span>` : ""}
      </button>`;
    }).join("");
    mount.innerHTML = `<div class="menu-modal-head">
        <h2 id="menuModalTitle">${escapeHtml(options.title)}</h2>
        <div class="menu-modal-tools">
          ${options.teacherBadge ? '<span class="teacher-badge">先生モード</span>' : ""}
          ${options.back ? `<button type="button" class="menu-back" data-menu-back>${escapeHtml(options.back.label)}</button>` : ""}
        </div>
      </div>
      <div class="menu-card-list">${cardsHtml}</div>`;
    menuState = { overlay, mount, previousFocus, actionMap, back: options.back || null };
    overlay.hidden = false;
    overlay.onclick = (event) => {
      if (event.target === overlay) closeMenuModal(true);
    };
    mount.querySelectorAll("[data-menu-card]").forEach((button) => {
      button.addEventListener("click", () => runMenuAction(button.dataset.menuCard));
    });
    const backButton = mount.querySelector("[data-menu-back]");
    if (backButton) backButton.addEventListener("click", () => options.back.run());
    wireMenuKeyboard();
    const firstCard = mount.querySelector("[data-menu-card]");
    if (firstCard) window.setTimeout(() => firstCard.focus(), 0);
  }

  function closeMenuModal(restoreFocus) {
    if (!menuState) return;
    const previousFocus = menuState.previousFocus;
    menuState.overlay.hidden = true;
    menuState.mount.innerHTML = "";
    menuState = null;
    if (restoreFocus !== false && previousFocus && previousFocus.focus) previousFocus.focus();
  }

  function runMenuAction(id) {
    if (!menuState) return;
    const action = menuState.actionMap[id];
    if (action) action();
  }

  function wireMenuKeyboard() {
    if (menuKeyListenerReady) return;
    menuKeyListenerReady = true;
    document.addEventListener("keydown", (event) => {
      if (!menuState || menuState.overlay.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeMenuModal(true);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveMenuFocus(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Enter" && document.activeElement && document.activeElement.matches("[data-menu-card]")) {
        event.preventDefault();
        runMenuAction(document.activeElement.dataset.menuCard);
        return;
      }
      if (event.key === "Tab") trapMenuFocus(event);
    }, true);
  }

  function moveMenuFocus(direction) {
    if (!menuState) return;
    const cards = Array.from(menuState.mount.querySelectorAll("[data-menu-card]"));
    if (!cards.length) return;
    const currentIndex = cards.indexOf(document.activeElement);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + cards.length) % cards.length;
    cards[nextIndex].focus();
  }

  function trapMenuFocus(event) {
    if (!menuState) return;
    const focusable = Array.from(menuState.mount.querySelectorAll("button:not([disabled])"));
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

  function trainingMeta(stage, entry) {
    const unit = entry.kind === "sentence" ? "文" : entry.kind === "word" ? "語" : "こ";
    const level = stage.type === "nyumon" ? 3 : stage.guideLevelTraining;
    return `${entry.count}${unit} ／ ${guideLabel(level)}`;
  }

  function stageExamMeta(stage) {
    return `せいかくりつ ${Math.round(stage.exam.accuracy * 100)}％いじょう ／ ${guideLabel(stage.guideLevelExam)}`;
  }

  function guideLabel(level) {
    return UI_TEXT.guideLevel[level] || UI_TEXT.guideLevel[0];
  }

  function jissenMeta(menu) {
    if (menu.kind === "banzuke") return `${RANK_DATA.banzuke.seconds}びょう ／ ${RANK_DATA.banzuke.courses.length}つの道`;
    if (menu.seconds) return `${menu.seconds}びょう`;
    if (menu.items) return `${menu.items}語`;
    return "";
  }

  function danExamMeta(exam) {
    return `正確率${Math.round(exam.kata.accuracy * 100)}％ ／ ${exam.jissen.kpm}打/分`;
  }

  function nextDanTarget(save) {
    if (SaveManager.isTeacherMode() && teacherDanTargetId) {
      const targetId = teacherDanTargetId === "genin" ? "chunin" : teacherDanTargetId;
      return RANK_DATA.dans.find((item) => item.id === targetId && item.exam);
    }
    const currentIndex = Math.max(1, SaveManager.DAN_ORDER.indexOf(save.dan || "genin"));
    const nextId = SaveManager.DAN_ORDER[currentIndex + 1];
    return RANK_DATA.dans.find((item) => item.id === nextId && item.exam);
  }

  function danIndex(id) {
    return Math.max(0, SaveManager.DAN_ORDER.indexOf(id || "none"));
  }

  function danLabel(id) {
    const dan = RANK_DATA.dans.find((item) => item.id === id);
    return dan ? dan.label : id;
  }

  function tierBadgeHtml(tier) {
    return `<span class="menu-tier ${tierClass(tier)}" title="${escapeHtml(tier)}"><span class="tier-badge">${SVG_ICONS.tierBadge()}</span><span>${escapeHtml(tier)}</span></span>`;
  }

  function tierClass(tier) {
    return { 銅: "tier-copper", 銀: "tier-silver", 金: "tier-gold", 白金: "tier-platinum", 月光: "tier-gekko" }[tier] || "tier-none";
  }

  function lockIcon() {
    return `<svg class="menu-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="5" y="10" width="14" height="10" rx="2"/></svg>`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function renderMap(save, currentStageId) {
    const map = byId("mapMount");
    if (!map) return;
    const teacher = SaveManager.isTeacherMode();
    const currentIndex = CURRICULUM_DATA.stages.findIndex((item) => item.id === currentStageId);
    const stageNodes = CURRICULUM_DATA.stages.map((stage, index) => {
      const cleared = save.clearedStages.includes(stage.id);
      const current = stage.id === currentStageId;
      const alwaysOpen = stage.type === "nyumon";
      const normallyAvailable = alwaysOpen || cleared || current || index <= currentIndex;
      const available = teacher || normallyAvailable;
      return { type: stage.type, html: `<button class="map-node ${cleared ? "cleared" : ""} ${current ? "current" : ""} ${teacher && !normallyAvailable ? "teacher-open" : ""}" data-stage-id="${stage.id}" ${available ? "" : "disabled"}>
        <span class="node-icon">${current ? SVG_ICONS.lantern() : stage.type === "nyumon" ? SVG_ICONS.torii() : SVG_ICONS.scroll(stage.jutsu[0] || "stage", !cleared)}</span>
        <span><b>${stage.label}</b><small>${stage.title}</small></span>
      </button>` };
    });
    const newlyRevealed = [];
    const danNodes = RANK_DATA.dans.map((dan, danPosition) => {
      const active = teacher ? teacherDanTargetId === dan.id : save.dan === dan.id;
      const reached = SaveManager.DAN_ORDER.indexOf(save.dan) >= SaveManager.DAN_ORDER.indexOf(dan.id);
      const previousDan = SaveManager.DAN_ORDER[SaveManager.DAN_ORDER.indexOf(dan.id) - 1];
      const secretRevealed = !dan.secret || teacher || danIndex(save.dan) >= danIndex(previousDan);
      const sizeClass = danPosition < 2 ? "dan-lower" : "dan-upper";
      if (!secretRevealed) {
        const hidden = `<div class="map-node dan dan-upper secret-dan" data-secret-dan="${dan.id}">
          <span class="node-icon">${SVG_ICONS.shadowNode()}</span>
          <span class="dan-copy"><b>${UI_TEXT.secretDan.hiddenName}</b><small>${UI_TEXT.secretDan.hiddenDesc}</small></span>
        </div>`;
        return { id: dan.id, html: hidden };
      }
      const firstReveal = dan.secret && !teacher && !revealedSecretDans.has(dan.id);
      if (firstReveal) {
        revealedSecretDans.add(dan.id);
        newlyRevealed.push(dan.id);
      }
      const className = `map-node dan ${sizeClass} ${reached ? "cleared" : ""} ${active ? "current" : ""} ${teacher && !reached ? "teacher-open" : ""} ${firstReveal ? "secret-reveal" : ""}`;
      const upper = danPosition >= 2;
      const icon = active ? SVG_ICONS.lantern() : SVG_ICONS.torii(upper ? "currentColor" : undefined);
      const iconClass = upper && !active ? " rank-icon" : "";
      const jissen = dan.exam && dan.exam.jissen;
      const meta = upper && jissen
        ? `<small class="dan-rank-meta">${UI_TEXT.danMeta.exam} ／ ${jissen.kpm}${UI_TEXT.danMeta.kpmUnit}・${Math.round(jissen.accuracy * 100)}%</small>`
        : "";
      const watermark = upper
        ? `<span class="rank-watermark">${SVG_ICONS.rankWatermark(dan.id === "kage" ? "moon" : "shuriken")}</span>`
        : "";
      const content = `<span class="node-icon${iconClass}">${icon}</span><span class="dan-copy"><b>${dan.label}</b><small>${dan.flavor}</small></span>${meta}${watermark}`;
      return { id: dan.id, html: teacher || reached
        ? `<button type="button" class="${className}" data-accent="${dan.mapAccent}" data-dan-id="${dan.id}">${content}</button>`
        : `<div class="${className}" data-accent="${dan.mapAccent}">${content}</div>` };
    });
    const nyumonHtml = stageNodes.filter((node) => node.type === "nyumon").map((node) => node.html).join("");
    const kyuHtml = stageNodes.filter((node) => node.type === "kyu").map((node) => node.html).join("");
    const lowerDanHtml = danNodes.slice(0, 2).map((node) => node.html).join("");
    const upperDanHtml = danNodes.slice(2).map((node) => node.html).join("");
    map.innerHTML = `<section class="map-section">
        <h3 class="map-section-title">入門の巻</h3>
        <div class="map-path cols-4">${nyumonHtml}</div>
      </section>
      <section class="map-section">
        <h3 class="map-section-title">型の修行</h3>
        <div class="map-path cols-4">${kyuHtml}</div>
      </section>
      <section class="map-section">
        <h3 class="map-section-title">実戦の修行</h3>
        <div class="map-path cols-2">${lowerDanHtml}</div>
        <div class="map-path cols-1">${upperDanHtml}</div>
      </section>`;
    if (newlyRevealed.length && globalThis.AchievementManager && AchievementManager.toast) {
      window.setTimeout(() => AchievementManager.toast(UI_TEXT.secretDan.revealToast), 0);
    }
    map.querySelectorAll("[data-stage-id]").forEach((button) => {
      button.addEventListener("click", () => {
        if (SaveManager.isTeacherMode()) {
          teacherStageId = button.dataset.stageId;
          teacherDanTargetId = "";
        } else {
          SaveManager.update((saveData) => { saveData.currentStage = button.dataset.stageId; });
        }
        renderHome();
        const returnButton = map.querySelector(`[data-stage-id="${button.dataset.stageId}"]`);
        if (returnButton) returnButton.focus();
        openStageMenu(button.dataset.stageId);
      });
    });
    map.querySelectorAll("[data-dan-id]").forEach((button) => {
      button.addEventListener("click", () => {
        if (SaveManager.isTeacherMode()) {
          teacherStageId = "";
          teacherDanTargetId = button.dataset.danId;
          renderHome();
          const returnButton = map.querySelector(`[data-dan-id="${button.dataset.danId}"]`);
          if (returnButton) returnButton.focus();
        }
        openJissenMenu();
      });
    });
  }

  function currentRankLabel(save) {
    if (save.dan && save.dan !== "none") {
      const dan = RANK_DATA.dans.find((item) => item.id === save.dan);
      return dan ? dan.label : "下忍";
    }
    const stage = currentStage();
    return stage.label;
  }

  function applyTheme() {
    const save = SaveManager.load();
    document.body.dataset.theme = save && save.settings && save.settings.display === "light" ? "light" : "night";
    const teacher = !!(save && save.settings && save.settings.teacherMode);
    document.body.dataset.teacherMode = teacher ? "true" : "false";
    if (!teacher) {
      teacherStageId = "";
      teacherDanTargetId = "";
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    startNew,
    handleStart,
    showScreen,
    renderHome,
    currentStage,
    selectedStageId() { return currentStage().id; },
    openStageMenu,
    openJissenMenu,
    openBanzukeCourseMenu,
    closeMenuModal,
    applyTheme,
    currentScreen() { return currentScreen; }
  };
})();
