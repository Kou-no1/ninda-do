const AchievementManager = globalThis.AchievementManager = (function () {
  "use strict";

  function grant(id) {
    if (SaveManager.isTeacherMode && SaveManager.isTeacherMode()) return false;
    const save = SaveManager.load();
    if (!save || save.nicknames.includes(id)) return false;
    SaveManager.grantNickname(id);
    toast(`二つ名をえた: ${NICKNAME_DATA.find((item) => item.id === id)?.name || id}`);
    if (globalThis.NindaApp) NindaApp.renderHome();
    return true;
  }

  const evaluators = {
    stage_clear: (cond, save) => save.clearedStages.includes(cond.id),
    exam_nomiss: (cond, save, summary, context) => context.exam && context.passed && (context.totalMiss ?? summary.miss) === 0,
    first_pass_guide0: (cond, save, summary, context) => context.exam && context.passed && context.guideLevel === 0,
    dan_first_try: (cond, save, summary, context) => context.dan && context.passed && context.firstTry,
    exam_perfect: (cond, save, summary, context) => context.phase === "kata" && context.passed && summary.accuracy === 1,
    total_correct: (cond, save) => save.totals.correct >= cond.value,
    streak: (cond, save) => save.streak.days >= cond.value,
    rhythm_hold: (cond, save, summary, context) => !context.exam && !context.phase && ["training", "jissen"].includes(summary.mode) && summary.correct >= 30 && summary.fudoRate >= 0.8,
    kpm_reach: (cond, save, summary) => summary.mode === "jissen" && summary.elapsedSeconds >= 10 && summary.kpm >= cond.value,
    combo_reach: (cond, save, summary) => summary.maxCombo >= cond.n,
    tier_reach: (cond, save) => tierReach(save, cond.tier),
    tier_all: (cond, save) => tierAll(save, cond.tier),
    weak_key_master: (cond, save) => weakMaster(save),
    all_scrolls: (cond, save) => JUTSU_DATA.every((jutsu) => save.scrolls.includes(jutsu.id))
  };

  function checkSession(summary, context) {
    if (SaveManager.isTeacherMode && SaveManager.isTeacherMode()) return;
    const save = SaveManager.load();
    if (!save) return;
    NICKNAME_DATA.forEach((item) => {
      if (save.nicknames.includes(item.id)) return;
      const cond = item.cond;
      const evaluate = evaluators[cond.type];
      if (evaluate && evaluate(cond, save, summary || {}, context || {})) grant(item.id);
    });
  }

  function tierValue(tier) {
    const order = RANK_DATA.banzuke && RANK_DATA.banzuke.tierOrder || ["無位", "銅", "銀", "金", "白金", "月光"];
    return Math.max(0, order.indexOf(tier || "無位"));
  }

  function tierReach(save, tier) {
    return Object.values(save.best && save.best.banzuke || {}).some((record) => tierValue(record.tier) >= tierValue(tier));
  }

  function tierAll(save, tier) {
    const records = save.best && save.best.banzuke || {};
    const courses = RANK_DATA.banzuke && RANK_DATA.banzuke.courses || [];
    return courses.length > 0 && courses.every((course) => tierValue(records[course.id] && records[course.id].tier) >= tierValue(tier));
  }

  function weakMaster(save) {
    return (save.weakTargets || []).some((key) => {
      const stat = save.keyStats[key];
      return stat && stat.recent && stat.recent.length >= 20 && MetricsEngine.recentAccuracy(stat) >= 0.9;
    });
  }

  function toastScroll(jutsuId) {
    const item = JUTSU_DATA.find((jutsu) => jutsu.id === jutsuId);
    if (!item) return;
    toast(`巻物をえた: ${item.name}`, item.id);
  }

  function toast(label, crestId) {
    const el = document.createElement("div");
    el.className = `toast${crestId ? " toast-with-crest" : ""}`;
    el.innerHTML = `${crestId ? `<span class="toast-crest">${SVG_ICONS.crest(crestId)}</span>` : ""}<span>${escapeHtml(label)}</span>`;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2600);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  return {
    grant,
    checkSession,
    toastScroll,
    toast,
    supportedTypes: Object.keys(evaluators)
  };
})();
