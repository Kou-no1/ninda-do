const AchievementManager = globalThis.AchievementManager = (function () {
  "use strict";

  function grant(id) {
    const save = SaveManager.load();
    if (!save || save.nicknames.includes(id)) return false;
    SaveManager.grantNickname(id);
    toast(NICKNAME_DATA.find((item) => item.id === id)?.name || id);
    if (globalThis.NindaApp) NindaApp.renderHome();
    return true;
  }

  function checkSession(summary) {
    const save = SaveManager.load();
    if (!save) return;
    NICKNAME_DATA.forEach((item) => {
      if (save.nicknames.includes(item.id)) return;
      const cond = item.cond;
      if (cond.type === "total_correct" && save.totals.correct >= cond.value) grant(item.id);
      if (cond.type === "streak" && save.streak.days >= cond.value) grant(item.id);
      if (cond.type === "rhythm_hold" && summary.correct >= 30 && summary.fudoRate >= 0.8) grant(item.id);
      if (cond.type === "kpm_reach" && summary.bestKpm >= cond.value) grant(item.id);
      if (cond.type === "weak_key_master" && weakMaster(save)) grant(item.id);
      if (cond.type === "all_scrolls" && JUTSU_DATA.every((jutsu) => save.scrolls.includes(jutsu.id))) grant(item.id);
    });
  }

  function weakMaster(save) {
    return MetricsEngine.weakKeys(save.keyStats, 5).some((item) => {
      const stat = save.keyStats[item.key];
      return stat && stat.recent && stat.recent.length >= 20 && MetricsEngine.recentAccuracy(stat) >= 0.9;
    });
  }

  function toast(label) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = `二つ名をえた: ${label}`;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2600);
  }

  return {
    grant,
    checkSession
  };
})();
