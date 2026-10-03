const LearningManager = globalThis.LearningManager = (function () {
  "use strict";
  let currentTab = "today";
  let lessonPreview = null;
  let miniStageId = "";
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stage = (id) => CURRICULUM_DATA.stages.find((item) => item.id === id);
  const number = (value) => Number.isInteger(value) && value >= 0 ? value : 0;

  function emptyState() {
    return { reviews: {}, counters: { practice: 0, review: 0, calm: 0, delivered: 0 }, missions: [], readings: [], books: {}, lessonPack: null, completedLessons: [] };
  }

  function readingEntries() {
    const existing = RANK_DATA.banzuke.courses.flatMap((course) => globalThis[course.wordsRef].items).filter((item) => item && typeof item === "object" && item.genre && item.source);
    return [...new Map(existing.concat(LiteratureManager.entries()).map((item) => [item.kana, item])).values()];
  }

  function normalizeState(raw) {
    const result = emptyState();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
    result.reviews = Object.fromEntries(Object.entries(raw.reviews || {}).filter(([id, record]) => stage(id) && record && /^\d{4}-\d{2}-\d{2}$/.test(record.due || ""))
      .map(([id, record]) => [id, { step: Math.min(number(record.step), LEARNING_DATA.review.intervals.length - 1), due: record.due, last: String(record.last || "") }]));
    Object.keys(result.counters).forEach((key) => { result.counters[key] = number(raw.counters && raw.counters[key]); });
    result.missions = [...new Set((Array.isArray(raw.missions) ? raw.missions : []).filter((id) => LEARNING_DATA.missions.some((item) => item.id === id)))];
    const validReadings = new Set(readingEntries().map((item) => item.kana));
    result.readings = [...new Set((Array.isArray(raw.readings) ? raw.readings : []).filter((id) => validReadings.has(id)))];
    const bookIds = new Set(LiteratureManager.works().map((work) => work.id));
    result.books = Object.fromEntries(Object.entries(raw.books || {}).filter(([id, record]) => bookIds.has(id) && record && /^\d{4}-\d{2}-\d{2}$/.test(record.date || "")
      && Number.isFinite(record.accuracy) && record.accuracy >= 0 && record.accuracy <= 1).map(([id, record]) => [id, { date: record.date, accuracy: record.accuracy }]));
    result.completedLessons = [...new Set((Array.isArray(raw.completedLessons) ? raw.completedLessons : []).filter((id) => /^lesson-[a-f0-9]+$/.test(id)))].slice(-100);
    if (raw.lessonPack) { try { result.lessonPack = parseLesson(raw.lessonPack); } catch (error) { result.lessonPack = null; } }
    return result;
  }

  function applySession(save, event, day) {
    if (!event.completed || event.correct + event.miss === 0) return;
    const state = save.learning;
    const learned = stage(event.stageId);
    if (event.mode === "training" && learned && event.acc >= LEARNING_DATA.review.accuracy) {
      const before = state.reviews[learned.id];
      const step = before ? Math.min(before.step + (event.purpose === "review" && before.last !== day ? 1 : 0), LEARNING_DATA.review.intervals.length - 1) : 0;
      const due = new Date(`${day}T00:00:00Z`);
      due.setUTCDate(due.getUTCDate() + LEARNING_DATA.review.intervals[step]);
      if (event.purpose !== "mini") state.reviews[learned.id] = { step, due: due.toISOString().slice(0, 10), last: day };
      state.counters.practice += 1;
      if (event.purpose === "review") state.counters.review += 1;
      if (["静", "不動"].includes(event.rhythm)) state.counters.calm += 1;
    }
    (event.readings || []).forEach((kana) => { if (!state.readings.includes(kana)) state.readings.push(kana); });
    if (event.literatureId && LiteratureManager.works().some((work) => work.id === event.literatureId)) {
      state.books[event.literatureId] = { date: day, accuracy: event.acc };
    }
    if (event.lessonId && !state.completedLessons.includes(event.lessonId)) state.completedLessons.push(event.lessonId);
    state.counters.delivered += event.delivered || 0;
    LEARNING_DATA.missions.forEach((mission) => {
      if (mission.after && !state.missions.includes(mission.after)) return;
      if (mission.unlockDan && SaveManager.DAN_ORDER.indexOf(save.dan) < SaveManager.DAN_ORDER.indexOf(mission.unlockDan)) return;
      const progress = mission.goal === "reading" ? state.readings.length : state.counters[mission.goal];
      if (progress >= mission.n && !state.missions.includes(mission.id)) state.missions.push(mission.id);
    });
  }

  function stageSets(id) {
    const target = stage(id);
    if (!target) throw new Error(UI_TEXT.learning.invalidStage);
    const track = CURRICULUM_DATA.stages.filter((item) => item.type === target.type);
    const introduced = track.slice(0, track.indexOf(target) + 1);
    return { keys: new Set(introduced.flatMap((item) => item.newKeys)), kana: new Set(introduced.flatMap((item) => item.newKana || [])) };
  }

  function parseLesson(input) {
    const config = LEARNING_DATA.lesson;
    if (typeof input === "string" && new TextEncoder().encode(input).length > config.maxBytes) throw new Error(UI_TEXT.learning.fileLarge);
    const raw = typeof input === "string" ? JSON.parse(input) : input;
    if (!raw || raw.format !== config.format || raw.v !== config.version) throw new Error(UI_TEXT.learning.invalidLesson);
    const target = stage(raw.stageId);
    if (!target) throw new Error(UI_TEXT.learning.invalidStage);
    if (typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 40 || /[<>\u0000-\u001f]/.test(raw.title)) throw new Error(UI_TEXT.learning.invalidTitle);
    const kinds = target.type === "nyumon" ? ["letter"] : target.training.map((entry) => entry.kind);
    if (!kinds.includes(raw.kind) || !Array.isArray(raw.items) || !raw.items.length || raw.items.length > config.maxItems) throw new Error(UI_TEXT.learning.invalidLesson);
    const sets = stageSets(target.id);
    raw.items.forEach((text, index) => {
      if (typeof text !== "string" || !text || text.length > config.maxLength) throw new Error(`${index + 1}: ${UI_TEXT.learning.invalidItem}`);
      if (raw.kind === "letter" || raw.kind === "in") {
        if (!/^[a-z.,-]+$/.test(text) || raw.kind === "letter" && text.length !== 1 || !Array.from(text).every((key) => sets.keys.has(key))) throw new Error(`${index + 1}: ${UI_TEXT.learning.lockedKeys}`);
      } else {
        if (!/^[ぁ-んー、。]+$/.test(text) || !InputEngine.segment(text).every((unit) => sets.kana.has(unit.kana))) throw new Error(`${index + 1}: ${UI_TEXT.learning.lockedKana}`);
      }
      if (!InputEngine.isTypeable(text, sets.keys)) throw new Error(`${index + 1}: ${UI_TEXT.learning.lockedKeys}`);
    });
    if (new Set(raw.items).size !== raw.items.length || raw.rights !== "original-or-permitted") throw new Error(UI_TEXT.learning.rightsRequired);
    const result = { format: config.format, v: config.version, title: raw.title.trim(), stageId: target.id, kind: raw.kind, items: raw.items.slice(), rights: raw.rights };
    let hash = 2166136261;
    for (const char of JSON.stringify(result)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    result.id = `lesson-${hash.toString(16)}`;
    return result;
  }

  function plan(save, day) {
    const reviews = CURRICULUM_DATA.stages.filter((item) => SaveManager.stageUnlocked(item.id, save) && (save.practicedStages.includes(item.id) || save.clearedStages.includes(item.id)));
    const due = reviews.filter((item) => !save.learning.reviews[item.id] || save.learning.reviews[item.id].due <= day)
      .sort((a, b) => (save.learning.reviews[a.id]?.due || "") .localeCompare(save.learning.reviews[b.id]?.due || ""))[0];
    const current = stage(save.unlockedStage);
    return [due && { id: "review", stage: due, purpose: "review" }, { id: "practice", stage: current, purpose: "practice" }, { id: "mini", stage: current, purpose: "mini" }].filter(Boolean);
  }

  function wordPool(id) {
    const target = stage(id);
    const sets = stageSets(id);
    const track = CURRICULUM_DATA.stages.filter((item) => item.type === "kyu");
    const texts = target.type === "nyumon" ? [] : track.slice(0, track.indexOf(target) + 1).flatMap((item) => {
      const ref = globalThis[item.wordsRef];
      return (ref.words || []).map((text) => ({ text, kind: "word" })).concat((ref.sentences || []).map((text) => ({ text, kind: "sentence" })));
    });
    return [...new Map(texts.map((item) => [item.text, item])).values()].filter((item) => InputEngine.isTypeable(item.text, sets.keys));
  }

  function drillItems(id, drillId, save, focusPair) {
    const drill = LEARNING_DATA.drills.find((item) => item.id === drillId);
    if (!drill) return [];
    const keys = stageSets(id).keys;
    if (drill.id === "pair") {
      if (focusPair && (!/^[a-z.,-]>[a-z.,-]$/.test(focusPair) || !keys.has(focusPair[0]) || !keys.has(focusPair[2]))) return [];
      const pair = focusPair ? [focusPair, drill.minMisses]
        : Object.entries(save.confusions).filter(([name, count]) => count >= drill.minMisses && keys.has(name[0]) && keys.has(name[2])).sort((a, b) => b[1] - a[1])[0];
      if (!pair) return [];
      const [a, b] = [pair[0][0], pair[0][2]];
      if (stage(id).type === "nyumon") return TrainingManager.sample([a, b], drill.count).map((text) => ({ text, kind: "letter" }));
      return TrainingManager.sample([a + b + a, b + a + b, a + a + b, b + b + a], drill.count).map((text) => ({ text, kind: "in" }));
    }
    const pool = wordPool(id).filter((item) => drill.kana.some((kana) => item.text.includes(kana)));
    return TrainingManager.sample(pool, drill.count);
  }

  function runPractice(id, purpose, drillId, focus) {
    const target = stage(id);
    if (!target || !SaveManager.stageUnlocked(id)) return;
    let items;
    if (purpose === "mini") items = drillItems(id, drillId, SaveManager.ensure(), focus && focus.pair);
    else if (target.type === "nyumon") {
      const letters = focus && focus.key && stageSets(id).keys.has(focus.key) ? [focus.key] : NYUMON_WORDS.sections[id];
      items = TrainingManager.sample(letters, LEARNING_DATA.review.count).map((text) => ({ text, kind: "letter" }));
    }
    else items = TrainingManager.buildReviewItems(target, focus && focus.key ? [focus.key] : null).slice(0, LEARNING_DATA.review.count);
    if (!items.length) return;
    const label = purpose === "mini" ? LEARNING_DATA.drills.find((item) => item.id === drillId).label : purpose === "practice" ? UI_TEXT.learning.planNames.practice : UI_TEXT.learning.review;
    NindaApp.closeMenuModal(false);
    NindaApp.showScreen("S2");
    TrainingManager.startRunner({ screen: "S2", stageId: id, recordId: `${id}:${purpose}:${drillId || ""}`, title: `${target.label} ${label}`, items,
      guideLevel: target.guideLevelTraining, mode: "training", purpose, retry() { runPractice(id, purpose, drillId, focus); },
      onComplete(summary) { AchievementManager.checkSession(summary); },
      resultContextAction: { id: "notebook", label: UI_TEXT.learning.back, run() { TrainingManager.stop(false); open("today"); } } });
  }

  function open(tab) {
    currentTab = tab || "today";
    miniStageId = "";
    NindaApp.showScreen("S7");
  }

  function render(tab) {
    if (tab) currentTab = tab;
    const save = SaveManager.ensure();
    const mount = document.getElementById("learningMount");
    const tabs = document.getElementById("learningTabs");
    if (!mount || !tabs) return;
    tabs.innerHTML = Object.entries(UI_TEXT.learning.tabs).map(([id, label]) => `<button type="button" id="learning-tab-${id}" role="tab" aria-controls="learningMount" aria-selected="${id === currentTab}" tabindex="${id === currentTab ? 0 : -1}" data-learning-tab="${id}" class="tab-button ${id === currentTab ? "active" : ""}">${label}</button>`).join("");
    mount.setAttribute("aria-labelledby", `learning-tab-${currentTab}`);
    tabs.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => { render(button.dataset.learningTab); tabs.querySelector(`[data-learning-tab="${currentTab}"]`).focus(); });
      button.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(tabs.querySelectorAll("button"));
        const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (buttons.indexOf(button) + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        render(buttons[index].dataset.learningTab); tabs.querySelector(`[data-learning-tab="${currentTab}"]`).focus();
      });
    });
    const views = { today: renderToday, mini: renderMini, missions: renderMissions, keys: renderKeys, reading: renderReading, lessons: renderLessons,
      literature: LiteratureManager.render, wardrobe: NinjaGameManager.renderWardrobe, shared: NinjaGameManager.renderShared };
    (views[currentTab] || renderToday)(mount, save);
  }

  function renderToday(mount, save) {
    const choices = plan(save, SaveManager.day());
    mount.innerHTML = `<h2>${UI_TEXT.learning.today}</h2><div class="learning-list">${choices.map((item) => `<button type="button" class="learning-item" data-plan="${item.id}"><span class="learning-icon">${SVG_ICONS.scroll("stage")}</span><span><strong>${UI_TEXT.learning.planNames[item.id]}</strong><span>${esc(item.stage.label)} ${esc(item.stage.title)}</span><small>${item.id === "mini" ? UI_TEXT.learning.chooseDrill : `${LEARNING_DATA.review.count}${UI_TEXT.learning.questions}`}</small></span></button>`).join("")}</div>
      <p class="learning-note">${UI_TEXT.learning.noPenalty}</p>`;
    mount.querySelectorAll("[data-plan]").forEach((button) => button.addEventListener("click", () => {
      const choice = choices.find((item) => item.id === button.dataset.plan);
      if (choice.id === "mini") { miniStageId = choice.stage.id; render("mini"); } else runPractice(choice.stage.id, choice.purpose);
    }));
  }

  function renderMini(mount, save) {
    const id = miniStageId || NindaApp.selectedStageId();
    const choices = LEARNING_DATA.drills.map((drill) => ({ drill, items: drillItems(id, drill.id, save) }));
    mount.innerHTML = `<h2>${esc(stage(id).label)} ${UI_TEXT.learning.small}</h2><div class="learning-list">${choices.map(({ drill, items }) => {
      const units = Object.entries(save.unitStats).filter(([kana]) => drill.kana && drill.kana.some((part) => kana.includes(part)));
      const attempts = units.reduce((sum, [, stat]) => sum + stat.attempts, 0);
      const misses = units.reduce((sum, [, stat]) => sum + stat.misses, 0);
      return `<button type="button" class="learning-item" data-drill="${drill.id}" ${items.length ? "" : "disabled"}><span><strong>${esc(drill.label)}</strong><span>${esc(drill.desc)}</span><small>${items.length ? `${drill.count}${UI_TEXT.learning.questions}` : drill.id === "pair" ? UI_TEXT.learning.noPair : UI_TEXT.learning.notLearned}${attempts ? ` ／ ${UI_TEXT.learning.accuracy} ${Math.round((1 - misses / attempts) * 100)}%` : ""}</small></span></button>`;
    }).join("")}</div>`;
    mount.querySelectorAll("[data-drill]").forEach((button) => button.addEventListener("click", () => runPractice(id, "mini", button.dataset.drill)));
  }

  function renderMissions(mount, save) {
    mount.innerHTML = `<h2>${UI_TEXT.learning.missions}</h2><div class="mission-road">${LEARNING_DATA.missions.map((mission) => {
      const earned = save.learning.missions.includes(mission.id);
      const available = !mission.after || save.learning.missions.includes(mission.after) || SaveManager.isTeacherMode();
      const count = mission.goal === "reading" ? save.learning.readings.length : save.learning.counters[mission.goal];
      const goal = UI_TEXT.learning.goalNames[mission.goal].replace("{accuracy}", String(Math.round(LEARNING_DATA.review.accuracy * 100)));
      return `<article class="mission-entry ${earned ? "earned" : ""}"><span class="mission-light" aria-hidden="true">${SVG_ICONS.lantern()}</span><div><h3>${esc(mission.title)}</h3><p>${available ? esc(mission.story) : UI_TEXT.learning.nextStory}</p><small>${earned ? esc(mission.reward) : `${goal} ${Math.min(count, mission.n)} / ${mission.n}`}</small></div></article>`;
    }).join("")}</div><p class="learning-note">${UI_TEXT.learning.noPenalty}</p>`;
  }

  function renderKeys(mount, save) {
    const legend = UI_TEXT.learning.keyLegend.replace("{secure}", Math.round(LEARNING_DATA.mastery.secure * 100)).replace("{developing}", Math.round(LEARNING_DATA.mastery.developing * 100));
    mount.innerHTML = `<h2>${UI_TEXT.learning.keys}</h2><div id="masteryMount" class="mastery-keyboard"></div><p>${legend}</p><p class="learning-note">${UI_TEXT.learning.fingersHonest}</p>`;
    GuideRenderer.renderMastery(document.getElementById("masteryMount"), save.keyStats, save.settings.fingerSymbols);
  }

  function renderReading(mount, save) {
    const teacher = SaveManager.isTeacherMode();
    const entries = readingEntries().filter((item) => teacher || save.learning.readings.includes(item.kana));
    const completed = LiteratureManager.works().filter((work) => save.learning.books[work.id]);
    mount.innerHTML = `<h2>${UI_TEXT.learning.reading} <small>${entries.length} / ${readingEntries().length}</small></h2>
      <section class="reading-books"><h3>${UI_TEXT.literature.bookRecords}</h3>${completed.length ? completed.map((work) => `<p><strong>${esc(work.title)}</strong> ／ ${esc(work.extent)} ／ ${esc(save.learning.books[work.id].date)} ／ ${Math.round(save.learning.books[work.id].accuracy * 100)}%</p>`).join("") : `<p>${UI_TEXT.literature.noBooks}</p>`}</section>
      ${entries.length ? entries.map((item) =>
      `<details class="reading-entry"><summary>${TrainingManager.displayHtml(item.display, item.ruby, item.displayLines)}</summary><p class="reading-kana">${esc(item.kana)}</p><p class="reading-source">${esc(item.source)}</p><p>${esc(LEARNING_DATA.readingNotes[item.source] || LiteratureManager.note(item.kana))}</p>${teacher && !save.learning.readings.includes(item.kana) ? `<small>${UI_TEXT.learning.preview}</small>` : ""}</details>`).join("") : `<p>${UI_TEXT.learning.readingEmpty}</p>`}`;
  }

  function renderLessons(mount, save) {
    const pack = save.learning.lessonPack;
    const teacher = SaveManager.isTeacherMode();
    mount.innerHTML = `<h2>${UI_TEXT.learning.lessons}</h2><div class="button-row"><button type="button" id="lessonImport">${UI_TEXT.learning.import}</button></div><input type="file" id="lessonFile" accept=".json,application/json" hidden>
      <p id="lessonMessage" role="status"></p><div id="lessonPreview"></div>
      ${pack ? `<article class="lesson-pack"><h3>${esc(pack.title)}</h3><p>${esc(stage(pack.stageId).label)} ／ ${pack.items.length}${UI_TEXT.learning.questions}</p><button type="button" id="lessonStart" ${SaveManager.stageUnlocked(pack.stageId) ? "" : "disabled"}>${UI_TEXT.learning.start}</button><small>${SaveManager.stageUnlocked(pack.stageId) ? save.learning.completedLessons.includes(pack.id) ? UI_TEXT.learning.completed : "" : UI_TEXT.learning.stageLocked}</small></article>` : `<p>${UI_TEXT.learning.lessonEmpty}</p>`}
      ${teacher ? `<form id="lessonForm" class="lesson-editor"><h3>${UI_TEXT.learning.create}</h3><label>${UI_TEXT.learning.lessonTitle}<input id="lessonTitle" maxlength="40" required></label><label>${UI_TEXT.learning.stage}<select id="lessonStage">${CURRICULUM_DATA.stages.map((item) => `<option value="${item.id}">${esc(item.label)}</option>`).join("")}</select></label><label>${UI_TEXT.learning.kind}<select id="lessonKind"></select></label><label>${UI_TEXT.learning.items}<textarea id="lessonItems" rows="6" required></textarea></label><label class="setting-row"><input type="checkbox" id="lessonRights" required>${UI_TEXT.learning.rights}</label><button type="submit">${UI_TEXT.learning.export}</button><p id="lessonEditorMessage" role="status"></p></form>` : ""}`;
    if (pack) document.getElementById("lessonStart").addEventListener("click", () => startLesson(pack));
    const input = document.getElementById("lessonFile");
    document.getElementById("lessonImport").addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      const message = document.getElementById("lessonMessage");
      if (file.size > LEARNING_DATA.lesson.maxBytes) { message.textContent = UI_TEXT.learning.fileLarge; return; }
      const reader = new FileReader();
      reader.onerror = () => { message.textContent = UI_TEXT.learning.invalidLesson; };
      reader.onload = () => {
        try {
          lessonPreview = parseLesson(String(reader.result));
          const preview = document.getElementById("lessonPreview");
          preview.innerHTML = `<h3>${esc(lessonPreview.title)}</h3><p>${esc(stage(lessonPreview.stageId).label)} ／ ${lessonPreview.items.length}${UI_TEXT.learning.questions}</p><p>${esc(lessonPreview.items.slice(0, 3).join(" ／ "))}</p><div class="button-row"><button type="button" id="lessonAccept">${teacher ? UI_TEXT.learning.demo : UI_TEXT.learning.accept}</button><button type="button" id="lessonCancel">${UI_TEXT.learning.cancel}</button></div>`;
          document.getElementById("lessonAccept").addEventListener("click", () => {
            if (teacher) startLesson(lessonPreview);
            else { SaveManager.update((data) => { data.learning.lessonPack = lessonPreview; }); lessonPreview = null; render("lessons"); }
          });
          document.getElementById("lessonCancel").addEventListener("click", () => { lessonPreview = null; preview.innerHTML = ""; });
          document.getElementById("lessonCancel").focus();
          message.textContent = "";
        } catch (error) { lessonPreview = null; document.getElementById("lessonPreview").innerHTML = ""; message.textContent = error.message; }
      };
      reader.readAsText(file);
      input.value = "";
    });
    if (teacher) {
      const stageInput = document.getElementById("lessonStage");
      const kindInput = document.getElementById("lessonKind");
      const changeKinds = () => {
        const target = stage(stageInput.value);
        const kinds = target.type === "nyumon" ? ["letter"] : target.training.map((entry) => entry.kind);
        kindInput.innerHTML = kinds.map((kind) => `<option value="${kind}">${UI_TEXT.learning.kindNames[kind]}</option>`).join("");
      };
      stageInput.addEventListener("change", changeKinds); changeKinds();
      document.getElementById("lessonForm").addEventListener("submit", (event) => {
        event.preventDefault();
        try {
          const lesson = parseLesson({ format: LEARNING_DATA.lesson.format, v: 1, title: document.getElementById("lessonTitle").value, stageId: stageInput.value, kind: kindInput.value,
            items: document.getElementById("lessonItems").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean), rights: document.getElementById("lessonRights").checked ? "original-or-permitted" : "" });
          download(lesson);
          document.getElementById("lessonEditorMessage").textContent = UI_TEXT.learning.exported;
        } catch (error) { document.getElementById("lessonEditorMessage").textContent = error.message; }
      });
    }
  }

  function download(lesson) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(lesson, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${lesson.id}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function startLesson(pack) {
    const valid = parseLesson(pack);
    if (!SaveManager.stageUnlocked(valid.stageId)) return;
    NindaApp.closeMenuModal(false); NindaApp.showScreen("S2");
    TrainingManager.startRunner({ screen: "S2", stageId: "lesson", contentStageId: valid.stageId, recordId: valid.id, lessonId: valid.id, title: valid.title,
      items: valid.items.map((text) => ({ text, kind: valid.kind })), guideLevel: stage(valid.stageId).guideLevelTraining, mode: "training", purpose: "lesson",
      retry() { startLesson(valid); }, onComplete(summary) { AchievementManager.checkSession(summary); },
      resultContextAction: { id: "lessons", label: UI_TEXT.learning.back, run() { TrainingManager.stop(false); open("lessons"); } } });
  }

  function advice(summary, stageId, save) {
    const data = save || SaveManager.ensure();
    const id = stage(stageId) ? stageId : data.unlockedStage;
    const options = LEARNING_DATA.coaching.map((rule) => ({ rule, misses: Object.entries(summary.unitStats || {})
      .filter(([unit]) => rule.parts.some((part) => unit.includes(part))).reduce((sum, [, stat]) => sum + stat.misses, 0) }))
      .filter((item) => item.misses > 0).sort((a, b) => b.misses - a.misses);
    for (const { rule } of options) {
      if (drillItems(id, rule.drill, data).length) return { text: rule.text, stageId: id, drill: rule.drill };
    }
    const keys = stageSets(id).keys;
    const pair = Object.entries(summary.confusions || {}).filter(([name, count]) => count >= LEARNING_DATA.drills.find((item) => item.id === "pair").minMisses
      && keys.has(name[0]) && keys.has(name[2])).sort((a, b) => b[1] - a[1])[0];
    if (pair && drillItems(id, "pair", data, pair[0]).length) return { text: UI_TEXT.coach.pair.replace("{a}", pair[0][0]).replace("{b}", pair[0][2]), stageId: id, drill: "pair", pair: pair[0] };
    const weak = Object.entries(summary.keyStats || {}).filter(([key, stat]) => keys.has(key) && stat.misses > 0)
      .sort((a, b) => b[1].misses - a[1].misses || b[1].misses / b[1].attempts - a[1].misses / a[1].attempts)[0];
    return weak ? { text: UI_TEXT.coach.key.replace("{key}", weak[0]), stageId: id, review: true, key: weak[0] } : { text: UI_TEXT.coach.calm };
  }

  return { emptyState, normalizeState, applySession, stageSets, parseLesson, plan, drillItems, readingEntries, open, render, runPractice, startLesson, advice };
})();
