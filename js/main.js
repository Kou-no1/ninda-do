const APP_VERSION = "1.4.0";
const TEACHER_PASSCODE = "2361";

const UI_TEXT = globalThis.UI_TEXT = {
  appName: "忍打道 —NINDA DO—",
  catch: "型（かた）をきわめた者だけが、疾風（はやて）をゆるされる。——それが、忍打道。",
  fail: "まだ機（き）は熟していない。もういちど修行だ！",
  noPractice: "まずは一回、しゅぎょうしてからいどもう。",
  keyboardOnly: "このアプリはキーボードをつないであそんでね"
};

const NindaApp = globalThis.NindaApp = (function () {
  "use strict";

  const screens = ["S0", "S1", "S2", "S3", "S4", "S5", "S6"];
  let currentScreen = "S0";
  let teacherStageId = "";
  let teacherDanTargetId = "";

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
        if (ExamManager.startJissen) ExamManager.startJissen("word-jissen");
        return;
      }
      TrainingManager.start(currentStage().id);
    });
    byId("examButton").addEventListener("click", () => {
      if (SaveManager.isTeacherMode() && teacherDanTargetId) {
        ExamManager.startDanExam(teacherDanTargetId === "genin" ? "chunin" : teacherDanTargetId);
        return;
      }
      ExamManager.start(currentStage().id);
    });
    byId("jissenButton").addEventListener("click", () => {
      if (ExamManager.startJissen) ExamManager.startJissen("word-jissen");
    });
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
    byId("trainingButton").textContent = teacherDan ? "実戦をみる" : "しゅぎょうする";
    byId("examButton").textContent = teacherDan ? "三の試しにいどむ" : "ためしにいどむ";
    byId("examButton").disabled = !teacher && !save.practicedStages.includes(stage.id);
    byId("examButton").title = byId("examButton").disabled ? UI_TEXT.noPractice : "";
    byId("jissenButton").hidden = !teacher && save.dan === "none";
    renderJissenMenu(save);
    renderMap(save, teacherDan ? "" : stage.id);
  }

  function renderJissenMenu(save) {
    const mount = byId("jissenMenuMount");
    const teacher = SaveManager.isTeacherMode();
    if (!mount) return;
    if (!teacher && (!save.dan || save.dan === "none")) {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }
    mount.hidden = false;
    mount.innerHTML = RANK_DATA.jissenMenu.map((menu) => `<button data-jissen-menu="${menu.id}">${menu.label}</button>`).join("");
    mount.querySelectorAll("[data-jissen-menu]").forEach((button) => {
      button.addEventListener("click", () => ExamManager.startJissen(button.dataset.jissenMenu));
    });
  }

  function renderMap(save, currentStageId) {
    const map = byId("mapMount");
    if (!map) return;
    const teacher = SaveManager.isTeacherMode();
    const currentIndex = CURRICULUM_DATA.stages.findIndex((item) => item.id === currentStageId);
    const stageHtml = CURRICULUM_DATA.stages.map((stage, index) => {
      const cleared = save.clearedStages.includes(stage.id);
      const current = stage.id === currentStageId;
      const alwaysOpen = stage.type === "nyumon";
      const normallyAvailable = alwaysOpen || cleared || current || index <= currentIndex;
      const available = teacher || normallyAvailable;
      return `<button class="map-node ${cleared ? "cleared" : ""} ${current ? "current" : ""} ${teacher && !normallyAvailable ? "teacher-open" : ""}" data-stage-id="${stage.id}" ${available ? "" : "disabled"}>
        <span class="node-icon">${current ? SVG_ICONS.lantern() : stage.type === "nyumon" ? SVG_ICONS.torii() : SVG_ICONS.scroll(stage.jutsu[0] || "stage", !cleared)}</span>
        <span><b>${stage.label}</b><small>${stage.title}</small></span>
      </button>`;
    }).join("");
    const danHtml = RANK_DATA.dans.map((dan) => {
      const active = teacher ? teacherDanTargetId === dan.id : save.dan === dan.id;
      const reached = SaveManager.DAN_ORDER.indexOf(save.dan) >= SaveManager.DAN_ORDER.indexOf(dan.id);
      const className = `map-node dan ${reached ? "cleared" : ""} ${active ? "current" : ""} ${teacher && !reached ? "teacher-open" : ""}`;
      const content = `<span class="node-icon">${active ? SVG_ICONS.lantern() : SVG_ICONS.torii()}</span><span><b>${dan.label}</b><small>実戦</small></span>`;
      return teacher
        ? `<button type="button" class="${className}" data-dan-id="${dan.id}">${content}</button>`
        : `<div class="${className}">${content}</div>`;
    }).join("");
    map.innerHTML = `<div class="map-path">${stageHtml}${danHtml}</div>`;
    map.querySelectorAll("[data-stage-id]").forEach((button) => {
      button.addEventListener("click", () => {
        if (SaveManager.isTeacherMode()) {
          teacherStageId = button.dataset.stageId;
          teacherDanTargetId = "";
        } else {
          SaveManager.update((saveData) => { saveData.currentStage = button.dataset.stageId; });
        }
        renderHome();
      });
    });
    map.querySelectorAll("[data-dan-id]").forEach((button) => {
      button.addEventListener("click", () => {
        teacherStageId = "";
        teacherDanTargetId = button.dataset.danId;
        renderHome();
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
    applyTheme,
    currentScreen() { return currentScreen; }
  };
})();
