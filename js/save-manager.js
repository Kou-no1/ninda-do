const SaveManager = globalThis.SaveManager = (function () {
  "use strict";

  const STORAGE_KEY = "nindaDoSaveV1";
  const DAN_ORDER = ["none", "genin", "chunin", "jonin", "tokujonin", "kage"];
  const CODE_ALPHABET = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみ";
  let syncAdapter = null;

  function now() {
    return Date.now();
  }

  function todayJst(offset) {
    const date = new Date(now() + (offset || 0) + 9 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }

  function yesterdayJst() {
    return todayJst(-24 * 60 * 60 * 1000);
  }

  function defaultSave(name, startStage) {
    return {
      v: 1,
      name: sanitizeName(name || "しのびまる"),
      createdAt: now(),
      currentStage: startStage || "nyumon1",
      practicedStages: [],
      clearedStages: [],
      dan: "none",
      scrolls: [],
      nicknames: [],
      equippedNickname: "",
      totals: { keys: 0, correct: 0, miss: 0, words: 0 },
      keyStats: {},
      best: { shippuScore: 0, kpm: 0, rhythm: "—" },
      streak: { last: "", days: 0 },
      settings: { se: true, voice: true },
      eventLog: []
    };
  }

  function sanitizeName(name) {
    const safe = String(name || "しのびまる").replace(/[^\u3040-\u30ffA-Za-z0-9ー_-]/g, "").slice(0, 10);
    return safe || "しのびまる";
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (error) {
      console.warn("SaveManager.load failed", error);
      return null;
    }
  }

  function normalize(save) {
    const base = defaultSave(save && save.name, save && save.currentStage);
    const merged = Object.assign(base, save || {});
    merged.totals = Object.assign(base.totals, save && save.totals || {});
    merged.best = Object.assign(base.best, save && save.best || {});
    merged.settings = Object.assign(base.settings, save && save.settings || {});
    merged.streak = Object.assign(base.streak, save && save.streak || {});
    merged.eventLog = Array.isArray(merged.eventLog) ? merged.eventLog.slice(-200) : [];
    merged.practicedStages = Array.isArray(merged.practicedStages) ? merged.practicedStages : [];
    merged.clearedStages = Array.isArray(merged.clearedStages) ? merged.clearedStages : [];
    merged.scrolls = Array.isArray(merged.scrolls) ? merged.scrolls : [];
    merged.nicknames = Array.isArray(merged.nicknames) ? merged.nicknames : [];
    merged.keyStats = merged.keyStats || {};
    return merged;
  }

  function save(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(next)));
    return next;
  }

  function ensure(name, startStage) {
    const existing = load();
    if (existing) return existing;
    const created = defaultSave(name, startStage);
    updateStreak(created);
    return save(created);
  }

  function create(name, startStage) {
    const created = defaultSave(name, startStage);
    updateStreak(created);
    return save(created);
  }

  function update(mutator) {
    const current = ensure();
    mutator(current);
    return save(current);
  }

  function addUnique(list, id) {
    if (id && !list.includes(id)) list.push(id);
  }

  function logEvent(type, data) {
    return update((saveData) => {
      const entry = Object.assign({ ts: now(), type }, data || {});
      saveData.eventLog.push(entry);
      saveData.eventLog = saveData.eventLog.slice(-200);
      if (syncAdapter && typeof syncAdapter.onEvent === "function") syncAdapter.onEvent(entry);
    });
  }

  function updateStreak(saveData) {
    const today = todayJst();
    if (saveData.streak.last === today) return saveData.streak.days;
    saveData.streak.days = saveData.streak.last === yesterdayJst() ? saveData.streak.days + 1 : 1;
    saveData.streak.last = today;
    return saveData.streak.days;
  }

  function markPracticed(stageId) {
    return update((saveData) => {
      addUnique(saveData.practicedStages, stageId);
      updateStreak(saveData);
    });
  }

  function mergeKeyStats(saveData, stats) {
    for (const [key, value] of Object.entries(stats || {})) {
      if (!saveData.keyStats[key]) saveData.keyStats[key] = { attempts: 0, misses: 0, sumLatency: 0, recent: [] };
      saveData.keyStats[key].attempts += value.attempts || 0;
      saveData.keyStats[key].misses += value.misses || 0;
      saveData.keyStats[key].sumLatency += value.sumLatency || 0;
      saveData.keyStats[key].recent = (saveData.keyStats[key].recent || []).concat(value.recent || []).slice(-20);
    }
  }

  function addSessionSummary(stageId, summary, itemCount) {
    return update((saveData) => {
      saveData.totals.keys += summary.correct + summary.miss;
      saveData.totals.correct += summary.correct;
      saveData.totals.miss += summary.miss;
      saveData.totals.words += itemCount || 0;
      if (summary.kpm) saveData.best.kpm = Math.max(saveData.best.kpm || 0, Math.round(summary.kpm));
      if (summary.rhythm && summary.rhythm !== "—") saveData.best.rhythm = betterRhythm(saveData.best.rhythm, summary.rhythm);
      mergeKeyStats(saveData, summary.keyStats);
      addUnique(saveData.practicedStages, stageId);
      updateStreak(saveData);
    });
  }

  function betterRhythm(current, next) {
    const order = ["—", "乱", "並", "静", "不動"];
    return order.indexOf(next) > order.indexOf(current || "—") ? next : current || next;
  }

  function nextStageId(stageId) {
    const index = CURRICULUM_DATA.stages.findIndex((stage) => stage.id === stageId);
    const next = CURRICULUM_DATA.stages[index + 1];
    return next ? next.id : stageId;
  }

  function grantStageClear(stageId, result) {
    return update((saveData) => {
      const stage = CURRICULUM_DATA.stages.find((item) => item.id === stageId);
      addUnique(saveData.clearedStages, stageId);
      if (stage) stage.jutsu.forEach((id) => addUnique(saveData.scrolls, id));
      if (stageId === "nyumon4") addUnique(saveData.nicknames, "hajimari");
      if (stageId === "kyu1") {
        saveData.dan = "genin";
        addUnique(saveData.scrolls, "shippu");
        addUnique(saveData.nicknames, "kaiden");
      }
      if (!saveData.equippedNickname && saveData.nicknames.length) saveData.equippedNickname = saveData.nicknames[0];
      saveData.currentStage = stageId === "kyu1" ? "kyu1" : nextStageId(stageId);
      saveData.eventLog.push(Object.assign({ ts: now(), type: stage && stage.type === "kyu" ? "kyu_pass" : "kyu_pass", id: stageId }, result || {}));
      saveData.eventLog = saveData.eventLog.slice(-200);
    });
  }

  function grantDan(danId, result) {
    return update((saveData) => {
      const before = SaveManager.DAN_ORDER.indexOf(saveData.dan || "none");
      const after = SaveManager.DAN_ORDER.indexOf(danId);
      if (after > before) saveData.dan = danId;
      saveData.eventLog.push(Object.assign({ ts: now(), type: "dan_pass", id: danId }, result || {}));
      saveData.eventLog = saveData.eventLog.slice(-200);
    });
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function setSetting(key, value) {
    return update((saveData) => {
      saveData.settings[key] = !!value;
    });
  }

  function setEquippedNickname(id) {
    return update((saveData) => {
      if (saveData.nicknames.includes(id)) saveData.equippedNickname = id;
    });
  }

  function grantNickname(id) {
    return update((saveData) => {
      addUnique(saveData.nicknames, id);
      if (!saveData.equippedNickname) saveData.equippedNickname = id;
      saveData.eventLog.push({ ts: now(), type: "nickname_get", id });
      saveData.eventLog = saveData.eventLog.slice(-200);
    });
  }

  function exportCode(saveData) {
    const data = normalize(saveData || ensure());
    const stageIndex = Math.max(0, CURRICULUM_DATA.stages.findIndex((stage) => stage.id === data.currentStage));
    const danIndex = Math.max(0, DAN_ORDER.indexOf(data.dan || "none"));
    const scrollMask = maskFromIds(JUTSU_DATA.map((item) => item.id), data.scrolls);
    const nicknameMask = maskFromIds(NICKNAME_DATA.map((item) => item.id), data.nicknames);
    const correctHundreds = Math.min(0xffffff, Math.floor((data.totals.correct || 0) / 100));
    const bytes = [
      1, stageIndex & 0xff, danIndex & 0xff,
      scrollMask & 0xff, (scrollMask >> 8) & 0xff,
      nicknameMask & 0xff, (nicknameMask >> 8) & 0xff,
      correctHundreds & 0xff, (correctHundreds >> 8) & 0xff, (correctHundreds >> 16) & 0xff,
      Math.min(255, data.streak.days || 0)
    ];
    bytes.push(crc8(bytes));
    return groupCode(encode5(bytes));
  }

  function restoreCode(code, name) {
    const compact = String(code || "").replace(/[\s-]/g, "");
    const bytes = decode5(compact);
    if (bytes.length < 12) throw new Error("あいことばが ちがうみたい");
    const payload = bytes.slice(0, 11);
    if (crc8(payload) !== bytes[11]) throw new Error("あいことばが ちがうみたい");
    const scrollMask = payload[3] | (payload[4] << 8);
    const nicknameMask = payload[5] | (payload[6] << 8);
    const correctHundreds = payload[7] | (payload[8] << 8) | (payload[9] << 16);
    const restored = defaultSave(name || (load() && load().name) || "しのびまる", CURRICULUM_DATA.stages[payload[1]] ? CURRICULUM_DATA.stages[payload[1]].id : "nyumon1");
    restored.v = payload[0] || 1;
    restored.dan = DAN_ORDER[payload[2]] || "none";
    restored.scrolls = idsFromMask(JUTSU_DATA.map((item) => item.id), scrollMask);
    restored.nicknames = idsFromMask(NICKNAME_DATA.map((item) => item.id), nicknameMask);
    restored.equippedNickname = restored.nicknames[0] || "";
    restored.totals.correct = correctHundreds * 100;
    restored.totals.keys = restored.totals.correct;
    restored.streak = { last: todayJst(), days: payload[10] };
    return save(restored);
  }

  function maskFromIds(order, ids) {
    return order.reduce((mask, id, index) => ids.includes(id) ? mask | (1 << index) : mask, 0);
  }

  function idsFromMask(order, mask) {
    return order.filter((_, index) => (mask & (1 << index)) !== 0);
  }

  function crc8(bytes) {
    let crc = 0;
    for (const byte of bytes) {
      crc ^= byte;
      for (let i = 0; i < 8; i += 1) crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
    return crc;
  }

  function encode5(bytes) {
    let bits = "";
    bytes.forEach((byte) => { bits += byte.toString(2).padStart(8, "0"); });
    while (bits.length % 5) bits += "0";
    let output = "";
    for (let i = 0; i < bits.length; i += 5) output += CODE_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
    return output;
  }

  function decode5(text) {
    let bits = "";
    for (const char of text) {
      const index = CODE_ALPHABET.indexOf(char);
      if (index < 0) throw new Error("あいことばが ちがうみたい");
      bits += index.toString(2).padStart(5, "0");
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return bytes.slice(0, 12);
  }

  function groupCode(code) {
    return code.match(/.{1,5}/g).join("-");
  }

  function setSyncAdapter(adapter) {
    syncAdapter = adapter || null;
  }

  return {
    STORAGE_KEY,
    DAN_ORDER,
    load,
    save,
    ensure,
    create,
    update,
    logEvent,
    markPracticed,
    addSessionSummary,
    grantStageClear,
    grantDan,
    mergeKeyStats,
    updateStreak,
    betterRhythm,
    nextStageId,
    sanitizeName,
    setSetting,
    setEquippedNickname,
    grantNickname,
    exportCode,
    restoreCode,
    reset,
    setSyncAdapter
  };
})();
