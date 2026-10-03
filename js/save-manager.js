const SaveManager = globalThis.SaveManager = (function () {
  "use strict";

  const STORAGE_KEY = "nindaDoSaveV1";
  const DAN_ORDER = ["none", "genin", "chunin", "jonin", "tokujonin", "kage"];
  const CODE_ALPHABET = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみ";
  const memoryStorage = {};
  let syncAdapter = null;
  let memoryOnly = false;
  let storageWarning = "";
  let loadFailed = false;

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
      unlockedStage: startStage || "nyumon1",
      practicedStages: [],
      practicedDans: [],
      clearedStages: [],
      dan: "none",
      scrolls: [],
      nicknames: [],
      equippedNickname: "",
      totals: { keys: 0, correct: 0, miss: 0, words: 0 },
      keyStats: {},
      examAttempts: {},
      weakTargets: [],
      best: { shippuScore: 0, kpm: 0, rhythm: "—", combo: 0, banzuke: {} },
      streak: { last: "", days: 0 },
      settings: { se: true, voice: true, display: "night", teacherMode: false, kanjiDisplay: true },
      eventLog: []
    };
  }

  function sanitizeName(name) {
    const safe = String(name || "しのびまる").replace(/[^\u3040-\u30ffA-Za-z0-9ー_-]/g, "").slice(0, 10);
    return safe || "しのびまる";
  }

  function load() {
    try {
      const raw = storageGet(STORAGE_KEY);
      if (!raw) return null;
      const data = normalize(JSON.parse(raw));
      loadFailed = false;
      return data;
    } catch (error) {
      storageWarning = "記録をよめません。バックアップからもどすか、あいことばをつかってね。";
      loadFailed = true;
      console.warn("SaveManager.load failed", error);
      return null;
    }
  }

  function normalize(save) {
    if (!save || typeof save !== "object" || Array.isArray(save) || save.v !== 1) throw new Error("セーブの形式がちがいます");
    const base = defaultSave(save && save.name, save && save.currentStage);
    const defaultTotals = Object.assign({}, base.totals);
    const defaultBest = Object.assign({}, base.best);
    const defaultSettings = Object.assign({}, base.settings);
    const defaultStreak = Object.assign({}, base.streak);
    const merged = Object.assign(base, save || {});
    merged.totals = Object.assign({}, defaultTotals, save && save.totals || {});
    merged.best = Object.assign({}, defaultBest, save && save.best || {});
    merged.best.banzuke = Object.assign({}, defaultBest.banzuke, save && save.best && save.best.banzuke || {});
    merged.settings = Object.assign({}, defaultSettings, save && save.settings || {});
    merged.streak = Object.assign({}, defaultStreak, save && save.streak || {});
    merged.eventLog = Array.isArray(merged.eventLog) ? merged.eventLog.slice(-200) : [];
    merged.practicedStages = Array.isArray(merged.practicedStages) ? merged.practicedStages : [];
    merged.practicedDans = Array.isArray(merged.practicedDans) ? merged.practicedDans.filter((id) => DAN_ORDER.includes(id) && id !== "none") : [];
    merged.clearedStages = Array.isArray(merged.clearedStages) ? merged.clearedStages : [];
    merged.scrolls = Array.isArray(merged.scrolls) ? merged.scrolls : [];
    merged.nicknames = Array.isArray(merged.nicknames) ? merged.nicknames : [];
    merged.keyStats = merged.keyStats || {};
    const stageIds = CURRICULUM_DATA.stages.map((stage) => stage.id);
    const number = (value) => Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    merged.name = sanitizeName(merged.name);
    merged.createdAt = number(merged.createdAt) || now();
    merged.currentStage = stageIds.includes(merged.currentStage) ? merged.currentStage : "nyumon1";
    ["practicedStages", "clearedStages"].forEach((key) => { merged[key] = [...new Set(merged[key].filter((id) => stageIds.includes(id)))]; });
    merged.scrolls = [...new Set(merged.scrolls.filter((id) => JUTSU_DATA.some((item) => item.id === id)))];
    merged.nicknames = [...new Set(merged.nicknames.filter((id) => NICKNAME_DATA.some((item) => item.id === id)))];
    merged.equippedNickname = merged.nicknames.includes(merged.equippedNickname) ? merged.equippedNickname : "";
    merged.dan = DAN_ORDER.includes(merged.dan) ? merged.dan : "none";
    if (!Array.isArray(save.practicedDans) && merged.dan !== "none" && Array.isArray(save.practicedStages)
      && save.practicedStages.some((id) => ["jissen", "banzuke"].includes(id))) addUnique(merged.practicedDans, merged.dan);
    const frontier = [merged.currentStage, merged.unlockedStage, ...merged.practicedStages, ...merged.clearedStages.map(nextStageId)]
      .filter((id) => stageIds.includes(id)).sort((a, b) => stageIds.indexOf(b) - stageIds.indexOf(a))[0];
    merged.unlockedStage = frontier || merged.currentStage;
    Object.keys(defaultTotals).forEach((key) => { merged.totals[key] = number(merged.totals[key]); });
    ["shippuScore", "kpm", "combo"].forEach((key) => { merged.best[key] = number(merged.best[key]); });
    merged.best.rhythm = ["—", "乱", "並", "静", "不動"].includes(merged.best.rhythm) ? merged.best.rhythm : "—";
    merged.best.banzuke = Object.fromEntries(Object.entries(merged.best.banzuke).filter(([id, record]) =>
      RANK_DATA.banzuke.courses.some((course) => course.id === id) && record && Number.isFinite(record.score) && record.score >= 0
      && RANK_DATA.banzuke.tierOrder.includes(record.tier) && /^\d{4}-\d{2}-\d{2}$/.test(record.date || "")));
    merged.settings.display = merged.settings.display === "light" ? "light" : "night";
    ["se", "voice", "teacherMode", "kanjiDisplay"].forEach((key) => { merged.settings[key] = typeof merged.settings[key] === "boolean" ? merged.settings[key] : defaultSettings[key]; });
    merged.streak = { last: /^\d{4}-\d{2}-\d{2}$/.test(merged.streak.last || "") ? merged.streak.last : "", days: number(merged.streak.days) };
    merged.keyStats = Object.fromEntries(Object.entries(merged.keyStats).filter(([key, stat]) => FINGER_DATA.keys[key] && stat && typeof stat === "object")
      .map(([key, stat]) => [key, { attempts: number(stat.attempts), misses: Math.min(number(stat.misses), number(stat.attempts)), sumLatency: number(stat.sumLatency), recent: Array.isArray(stat.recent) ? stat.recent.filter((hit) => typeof hit === "boolean").slice(-20) : [] }]));
    merged.examAttempts = Object.fromEntries(Object.entries(save.examAttempts || {}).filter(([id]) => DAN_ORDER.includes(id)).map(([id, count]) => [id, number(count)]));
    merged.weakTargets = Array.isArray(save.weakTargets) ? [...new Set(save.weakTargets.filter((key) => FINGER_DATA.keys[key]))] : [];
    merged.eventLog = merged.eventLog.filter((entry) => entry && Number.isFinite(entry.ts) && typeof entry.type === "string");
    return merged;
  }

  function save(next, options) {
    const current = load();
    if (isTeacherMode(current) && !(options && options.allowTeacherWrite)) return current;
    if (isTeacherMode(current)) next = Object.assign({}, current, { settings: next.settings });
    if (options && options.restore) memoryOnly = false;
    storageSet(STORAGE_KEY, JSON.stringify(normalize(next)));
    return next;
  }

  function ensure(name, startStage) {
    const existing = load();
    if (existing) return existing;
    if (loadFailed) memoryOnly = true;
    const created = defaultSave(name, startStage);
    return save(created);
  }

  function create(name, startStage) {
    const created = defaultSave(name, startStage);
    return save(created, { restore: true });
  }

  function isTeacherMode(saveData) {
    const data = saveData || load();
    return !!(data && data.settings && data.settings.teacherMode);
  }

  function update(mutator, options) {
    const current = ensure();
    if (isTeacherMode(current) && !(options && options.allowTeacherWrite)) return current;
    mutator(current);
    return save(current, options);
  }

  function addUnique(list, id) {
    if (id && !list.includes(id)) list.push(id);
  }

  function logEvent(type, data) {
    return update((saveData) => {
      appendEvent(saveData, type, data);
    });
  }

  function appendEvent(saveData, type, data) {
    const entry = Object.assign({}, data || {}, { ts: now(), type });
    saveData.eventLog.push(entry);
    saveData.eventLog = saveData.eventLog.slice(-200);
    if (syncAdapter && typeof syncAdapter.onEvent === "function") {
      try { Promise.resolve(syncAdapter.onEvent(JSON.parse(JSON.stringify(entry)))).catch((error) => console.warn("syncAdapter.onEvent failed", error)); }
      catch (error) { console.warn("syncAdapter.onEvent failed", error); }
    }
  }

  function flush() {
    if (!syncAdapter || typeof syncAdapter.flush !== "function") return;
    try { Promise.resolve(syncAdapter.flush()).catch((error) => console.warn("syncAdapter.flush failed", error)); }
    catch (error) { console.warn("syncAdapter.flush failed", error); }
  }

  function updateStreak(saveData) {
    if (isTeacherMode(saveData)) return saveData.streak.days;
    const today = todayJst();
    if (saveData.streak.last === today) return saveData.streak.days;
    saveData.streak.days = saveData.streak.last === yesterdayJst() ? saveData.streak.days + 1 : 1;
    saveData.streak.last = today;
    return saveData.streak.days;
  }

  function markPracticed(stageId) {
    return update((saveData) => {
      if (DAN_ORDER.includes(stageId) && stageId !== "none") addUnique(saveData.practicedDans, stageId);
      else if (CURRICULUM_DATA.stages.some((stage) => stage.id === stageId)) addUnique(saveData.practicedStages, stageId);
      updateStreak(saveData);
    });
  }

  function mergeKeyStats(saveData, stats) {
    if (isTeacherMode(saveData)) return;
    for (const [key, value] of Object.entries(stats || {})) {
      if (!saveData.keyStats[key]) saveData.keyStats[key] = { attempts: 0, misses: 0, sumLatency: 0, recent: [] };
      saveData.keyStats[key].attempts += value.attempts || 0;
      saveData.keyStats[key].misses += value.misses || 0;
      saveData.keyStats[key].sumLatency += value.sumLatency || 0;
      saveData.keyStats[key].recent = (saveData.keyStats[key].recent || []).concat(value.recent || []).slice(-20);
    }
  }

  function addSessionSummary(stageId, summary, itemCount, options) {
    return update((saveData) => {
      saveData.totals.keys += summary.correct + summary.miss;
      saveData.totals.correct += summary.correct;
      saveData.totals.miss += summary.miss;
      saveData.totals.words += itemCount || 0;
      if (!(options && options.partial) && summary.mode === "jissen" && summary.kpm) saveData.best.kpm = Math.max(saveData.best.kpm || 0, Math.round(summary.kpm));
      if (summary.rhythm && summary.rhythm !== "—") saveData.best.rhythm = betterRhythm(saveData.best.rhythm, summary.rhythm);
      if (summary.maxCombo) saveData.best.combo = Math.max(saveData.best.combo || 0, summary.maxCombo);
      mergeKeyStats(saveData, summary.keyStats);
      if (!(options && options.partial) && CURRICULUM_DATA.stages.some((stage) => stage.id === stageId)) addUnique(saveData.practicedStages, stageId);
      const practicedHits = options && options.event ? options.event.correct + options.event.miss : summary.correct + summary.miss;
      if (!(options && options.partial) && practicedHits > 0 && ["jissen", "banzuke"].includes(stageId) && saveData.dan !== "none") addUnique(saveData.practicedDans, saveData.dan);
      if (summary.correct + summary.miss > 0) updateStreak(saveData);
      MetricsEngine.weakKeys(saveData.keyStats, 5).filter((item) => item.missRate > 0.1).forEach((item) => addUnique(saveData.weakTargets, item.key));
      if (options && options.event) appendEvent(saveData, "session_end", options.event);
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
      function award(id) {
        if (saveData.scrolls.includes(id)) return;
        addUnique(saveData.scrolls, id);
        appendEvent(saveData, "scroll_get", { id });
      }
      if (stage) stage.jutsu.forEach(award);
      if (stageId === "kyu1") {
        if (saveData.dan === "none") saveData.dan = "genin";
        award("shippu");
      }
      if (!saveData.equippedNickname && saveData.nicknames.length) saveData.equippedNickname = saveData.nicknames[0];
      const next = stageId === "kyu1" ? "kyu1" : nextStageId(stageId);
      const order = CURRICULUM_DATA.stages.map((item) => item.id);
      if (order.indexOf(next) > order.indexOf(saveData.unlockedStage)) saveData.unlockedStage = next;
      saveData.currentStage = saveData.unlockedStage;
      appendEvent(saveData, "kyu_pass", Object.assign({ id: stageId }, result || {}));
    });
  }

  function grantDan(danId, result) {
    return update((saveData) => {
      const before = SaveManager.DAN_ORDER.indexOf(saveData.dan || "none");
      const after = SaveManager.DAN_ORDER.indexOf(danId);
      if (after > before) saveData.dan = danId;
      appendEvent(saveData, "dan_pass", Object.assign({ id: danId }, result || {}));
    });
  }

  function updateBanzukeBest(courseId, result) {
    const current = ensure();
    const previous = current.best && current.best.banzuke ? current.best.banzuke[courseId] : null;
    const next = {
      score: Math.max(0, Math.round(result && result.score || 0)),
      tier: result && result.tier || "無位",
      date: result && result.date || todayJst()
    };
    if (isTeacherMode(current)) return { updated: false, best: previous || null };
    const shouldUpdate = !previous || next.score > (previous.score || 0);
    if (!shouldUpdate) return { updated: false, best: previous };
    const saved = update((saveData) => {
      if (!saveData.best.banzuke) saveData.best.banzuke = {};
      saveData.best.banzuke[courseId] = next;
    });
    return { updated: true, best: saved.best.banzuke[courseId] };
  }

  function reset() {
    if (isTeacherMode()) return false;
    storageRemove(STORAGE_KEY);
    return true;
  }

  function storageGet(key) {
    if (memoryOnly) return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
    try {
      if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    } catch (error) {
      memoryOnly = true;
      storageWarning = "この端末では記録を保存できません。ページをとじる前に、バックアップをとってね。";
    }
    return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
  }

  function storageSet(key, value) {
    memoryStorage[key] = String(value);
    if (memoryOnly) return;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
        storageWarning = "";
        return;
      }
    } catch (error) {
      memoryOnly = true;
      storageWarning = "この端末では記録を保存できません。ページをとじる前に、バックアップをとってね。";
    }
    memoryStorage[key] = String(value);
  }

  function storageRemove(key) {
    delete memoryStorage[key];
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
        return;
      }
    } catch (error) {
      // Fall through to memory storage when browser privacy policy blocks localStorage.
    }
    delete memoryStorage[key];
  }

  function setSetting(key, value) {
    return update((saveData) => {
      if (key === "display") saveData.settings.display = value === "light" ? "light" : "night";
      else if (key === "teacherMode") saveData.settings.teacherMode = !!value;
      else saveData.settings[key] = !!value;
    }, { allowTeacherWrite: true });
  }

  function setEquippedNickname(id) {
    return update((saveData) => {
      if (saveData.nicknames.includes(id)) saveData.equippedNickname = id;
    });
  }

  function grantNickname(id) {
    return update((saveData) => {
      if (saveData.nicknames.includes(id)) return;
      addUnique(saveData.nicknames, id);
      if (!saveData.equippedNickname) saveData.equippedNickname = id;
      appendEvent(saveData, "nickname_get", { id });
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
      nicknameMask & 0xff, (nicknameMask >> 8) & 0xff, (nicknameMask >> 16) & 0xff,
      correctHundreds & 0xff, (correctHundreds >> 8) & 0xff, (correctHundreds >> 16) & 0xff,
      Math.min(255, data.streak.days || 0)
    ];
    bytes.push(crc8(bytes));
    return groupCode(encode5(bytes));
  }

  function restoreCode(code, name) {
    if (isTeacherMode()) throw new Error("先生モードをOFFにしてから、もどしてね");
    const compact = String(code || "").replace(/[\s-]/g, "");
    const bytes = decode5(compact);
    const parsed = parseCodePayload(bytes);
    const payload = parsed.payload;
    const scrollMask = payload[3] | (payload[4] << 8);
    const nicknameMask = payload[5] | (payload[6] << 8) | ((parsed.hasNicknameHigh ? payload[7] : 0) << 16);
    const correctOffset = parsed.hasNicknameHigh ? 8 : 7;
    const correctHundreds = payload[correctOffset] | (payload[correctOffset + 1] << 8) | (payload[correctOffset + 2] << 16);
    const streakDays = payload[correctOffset + 3];
    const restored = defaultSave(name || (load() && load().name) || "しのびまる", CURRICULUM_DATA.stages[payload[1]] ? CURRICULUM_DATA.stages[payload[1]].id : "nyumon1");
    restored.v = payload[0] || 1;
    restored.dan = DAN_ORDER[payload[2]] || "none";
    restored.scrolls = idsFromMask(JUTSU_DATA.map((item) => item.id), scrollMask);
    restored.nicknames = idsFromMask(NICKNAME_DATA.map((item) => item.id), nicknameMask);
    restored.equippedNickname = restored.nicknames[0] || "";
    restored.totals.correct = correctHundreds * 100;
    restored.totals.keys = restored.totals.correct;
    restored.streak = { last: todayJst(), days: streakDays };
    return save(restored, { restore: true });
  }

  function parseCodePayload(bytes) {
    if (bytes.length >= 13) {
      const payload = bytes.slice(0, 12);
      if (crc8(payload) === bytes[12]) return { payload, hasNicknameHigh: true };
    }
    if (bytes.length >= 12) {
      const payload = bytes.slice(0, 11);
      if (crc8(payload) === bytes[11]) return { payload, hasNicknameHigh: false };
    }
    throw new Error("あいことばが ちがうみたい");
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
    return bytes;
  }

  function groupCode(code) {
    return code.match(/.{1,5}/g).join("-");
  }

  function setSyncAdapter(adapter) {
    syncAdapter = adapter || null;
  }

  function exportBackup() {
    return JSON.stringify({ format: "ninda-do-backup", version: 1, exportedAt: now(), save: ensure() }, null, 2);
  }

  function parseBackup(text) {
    if (typeof text !== "string" || text.length > 2 * 1024 * 1024) throw new Error("バックアップの大きさがちがいます");
    const backup = JSON.parse(text);
    if (backup.format !== "ninda-do-backup" || backup.version !== 1 || !backup.save) throw new Error("忍打道のバックアップをえらんでね");
    const data = backup.save;
    if (data.v !== 1 || typeof data.name !== "string" || !CURRICULUM_DATA.stages.some((stage) => stage.id === data.currentStage)
      || !DAN_ORDER.includes(data.dan) || !data.totals || ["keys", "correct", "miss", "words"].some((key) => !Number.isSafeInteger(data.totals[key]) || data.totals[key] < 0)
      || data.totals.keys !== data.totals.correct + data.totals.miss
      || ["clearedStages", "scrolls", "nicknames", "eventLog"].some((key) => !Array.isArray(data[key]))) throw new Error("バックアップの記録がこわれています");
    const references = { clearedStages: CURRICULUM_DATA.stages.map((item) => item.id), scrolls: JUTSU_DATA.map((item) => item.id), nicknames: NICKNAME_DATA.map((item) => item.id) };
    if (Object.entries(references).some(([field, ids]) => data[field].some((id) => !ids.includes(id)) || new Set(data[field]).size !== data[field].length)
      || data.name !== sanitizeName(data.name) || !data.keyStats || typeof data.keyStats !== "object" || Array.isArray(data.keyStats)
      || Object.entries(data.keyStats).some(([key, stat]) => !FINGER_DATA.keys[key] || !stat || ["attempts", "misses", "sumLatency"].some((field) => !Number.isFinite(stat[field]) || stat[field] < 0) || stat.misses > stat.attempts)
      || data.eventLog.some((entry) => !entry || !Number.isFinite(entry.ts) || typeof entry.type !== "string")) throw new Error("バックアップの記録がこわれています");
    const normalized = normalize(data);
    normalized.settings.teacherMode = false;
    return normalized;
  }

  function restoreBackup(text) {
    if (isTeacherMode()) throw new Error("先生モードをOFFにしてから、もどしてね");
    const restored = parseBackup(text);
    return save(restored, { restore: true });
  }

  function stageUnlocked(stageId, saveData) {
    const data = saveData || ensure();
    const stages = CURRICULUM_DATA.stages;
    const stage = stages.find((item) => item.id === stageId);
    return !!stage && (isTeacherMode(data) || stage.type === "nyumon" || data.clearedStages.includes(stageId)
      || stages.findIndex((item) => item.id === stageId) <= stages.findIndex((item) => item.id === data.unlockedStage));
  }

  return {
    STORAGE_KEY,
    DAN_ORDER,
    load,
    save,
    ensure,
    create,
    update,
    isTeacherMode,
    logEvent,
    markPracticed,
    addSessionSummary,
    grantStageClear,
    grantDan,
    updateBanzukeBest,
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
    setSyncAdapter,
    flush, exportBackup, parseBackup, restoreBackup, stageUnlocked,
    storageStatus: () => ({ persistent: !memoryOnly, warning: storageWarning })
  };
})();
