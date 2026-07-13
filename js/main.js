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
      const save = SaveManager.ensure();
      TrainingManager.start(save.currentStage);
    });
    byId("examButton").addEventListener("click", () => {
      const save = SaveManager.ensure();
      ExamManager.start(save.currentStage);
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
    document.addEventListener("compositionstart", () => {
      overlay.hidden = false;
      TrainingManager.setPaused(true);
    });
    document.addEventListener("compositionend", () => {
      overlay.hidden = true;
      TrainingManager.setPaused(false);
    });
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
    return CURRICULUM_DATA.stages.find((stage) => stage.id === save.currentStage) || CURRICULUM_DATA.stages[0];
  }

  function renderHome() {
    const save = SaveManager.ensure();
    const stage = currentStage();
    const rankLabel = currentRankLabel(save);
    byId("currentRank").textContent = `${save.name} ／ ${rankLabel}`;
    byId("nextGoal").textContent = stage.id === "kyu1" && save.dan !== "none"
      ? "実戦の修行で、疾風の術をみがこう。"
      : `次は ${stage.label}「${stage.title}」`;
    byId("examButton").disabled = !save.practicedStages.includes(stage.id);
    byId("examButton").title = byId("examButton").disabled ? UI_TEXT.noPractice : "";
    byId("jissenButton").hidden = save.dan === "none";
    renderJissenMenu(save);
    renderMap(save, stage.id);
  }

  function renderJissenMenu(save) {
    const mount = byId("jissenMenuMount");
    if (!mount) return;
    if (!save.dan || save.dan === "none") {
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
    const stageHtml = CURRICULUM_DATA.stages.map((stage, index) => {
      const cleared = save.clearedStages.includes(stage.id);
      const current = stage.id === currentStageId;
      const alwaysOpen = stage.type === "nyumon";
      const available = alwaysOpen || cleared || current || index <= CURRICULUM_DATA.stages.findIndex((item) => item.id === currentStageId);
      return `<button class="map-node ${cleared ? "cleared" : ""} ${current ? "current" : ""}" data-stage-id="${stage.id}" ${available ? "" : "disabled"}>
        <span class="node-icon">${current ? SVG_ICONS.ninja() : stage.type === "nyumon" ? SVG_ICONS.torii() : SVG_ICONS.scroll(stage.jutsu[0] || "stage", !cleared)}</span>
        <span><b>${stage.label}</b><small>${stage.title}</small></span>
      </button>`;
    }).join("");
    const danHtml = RANK_DATA.dans.map((dan) => {
      const active = save.dan === dan.id;
      const reached = SaveManager.DAN_ORDER.indexOf(save.dan) >= SaveManager.DAN_ORDER.indexOf(dan.id);
      return `<div class="map-node dan ${reached ? "cleared" : ""} ${active ? "current" : ""}">
        <span class="node-icon">${SVG_ICONS.torii()}</span><span><b>${dan.label}</b><small>実戦</small></span>
      </div>`;
    }).join("");
    map.innerHTML = `<div class="map-path">${stageHtml}${danHtml}</div>`;
    map.querySelectorAll("[data-stage-id]").forEach((button) => {
      button.addEventListener("click", () => {
        SaveManager.update((saveData) => { saveData.currentStage = button.dataset.stageId; });
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

  document.addEventListener("DOMContentLoaded", init);

  return {
    startNew,
    handleStart,
    showScreen,
    renderHome,
    currentStage,
    currentScreen() { return currentScreen; }
  };
})();
