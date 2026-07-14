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

  function checkSession(summary) {
    if (SaveManager.isTeacherMode && SaveManager.isTeacherMode()) return;
    const save = SaveManager.load();
    if (!save) return;
    NICKNAME_DATA.forEach((item) => {
      if (save.nicknames.includes(item.id)) return;
      const cond = item.cond;
      if (cond.type === "total_correct" && save.totals.correct >= cond.value) grant(item.id);
      if (cond.type === "streak" && save.streak.days >= cond.value) grant(item.id);
      if (cond.type === "rhythm_hold" && summary.correct >= 30 && summary.fudoRate >= 0.8) grant(item.id);
      if (cond.type === "kpm_reach" && summary.bestKpm >= cond.value) grant(item.id);
      if (cond.type === "combo_reach" && summary.maxCombo >= cond.n) grant(item.id);
      if (cond.type === "tier_reach" && tierReach(save, cond.tier)) grant(item.id);
      if (cond.type === "tier_all" && tierAll(save, cond.tier)) grant(item.id);
      if (cond.type === "weak_key_master" && weakMaster(save)) grant(item.id);
      if (cond.type === "all_scrolls" && JUTSU_DATA.every((jutsu) => save.scrolls.includes(jutsu.id))) grant(item.id);
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
    return MetricsEngine.weakKeys(save.keyStats, 5).some((item) => {
      const stat = save.keyStats[item.key];
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
    toast
  };
})();
