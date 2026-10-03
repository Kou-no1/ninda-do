const LiteratureManager = globalThis.LiteratureManager = (function () {
  "use strict";
  let courseId = "classic";
  let authorFilter = "";
  const esc = (text) => String(text == null ? "" : text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ruby = (text, reading) => `<ruby>${esc(text)}<rt>${esc(reading)}</rt></ruby>`;

  function works() { return LITERATURE_DATA.works.filter((work) => work.audit === "approved" && !work.useReview); }
  function passages(work) {
    return work.passages.map((entry) => {
      if (!entry.ref) return entry;
      const source = globalThis[entry.ref];
      const matches = source && source.items.filter((item) => item.kana.startsWith(entry.starts));
      return matches && matches.length === 1 ? matches[0] : null;
    }).filter(Boolean);
  }
  function entries() { return [...new Map(works().flatMap(passages).map((item) => [item.kana, item])).values()]; }
  function note(kana) { return works().find((work) => passages(work).some((entry) => entry.kana === kana))?.note || ""; }
  function unlocked(save) {
    const data = save || SaveManager.ensure();
    return SaveManager.isTeacherMode(data) || SaveManager.DAN_ORDER.indexOf(data.dan) >= SaveManager.DAN_ORDER.indexOf(LITERATURE_DATA.unlockDan);
  }
  function open(id) {
    if (id) courseId = id;
    authorFilter = "";
    NindaApp.closeMenuModal(false);
    LearningManager.open("literature");
  }
  function render(mount, save) {
    const text = UI_TEXT.literature;
    if (!unlocked(save)) {
      mount.innerHTML = `<h2>${text.title}</h2><p>${esc(text.locked)}</p>`;
      return;
    }
    const course = LITERATURE_DATA.courses.find((item) => item.id === courseId) || LITERATURE_DATA.courses[0];
    courseId = course.id;
    const pool = works().filter((work) => work.course === courseId);
    const authors = [...new Set(pool.map((work) => work.author))];
    if (!authors.includes(authorFilter)) authorFilter = "";
    const selected = pool.filter((work) => !authorFilter || work.author === authorFilter);
    mount.innerHTML = `<div class="library-heading"><h2>${text.title}</h2><small>${works().length}${text.works}</small></div>
      <div class="library-courses" role="group" aria-label="${text.courses}">${LITERATURE_DATA.courses.map((item) => `<button type="button" data-literature-course="${item.id}" aria-pressed="${item.id === courseId}">${ruby(item.label, item.reading)}</button>`).join("")}</div>
      <div class="library-toolbar"><p>${esc(course.desc)}</p><label>${text.author}<select id="literatureAuthor"><option value="">${text.allAuthors}</option>${authors.map((author) => `<option ${author === authorFilter ? "selected" : ""} value="${esc(author)}">${esc(author)}</option>`).join("")}</select></label><button type="button" id="literatureTimed">${text.timed} ${course.seconds}${text.seconds}</button></div>
      <div class="library-grid">${selected.map((work) => {
        const record = save.learning.books[work.id];
        const items = passages(work);
        return `<button type="button" class="library-work" data-literature-work="${work.id}"><span class="library-work-icon" aria-hidden="true">${SVG_ICONS.scroll("stage")}</span><span><strong>${ruby(work.title, work.titleReading)}</strong><span>${ruby(work.author, work.authorReading)}</span><small>${ruby(work.extent, LITERATURE_DATA.extentReadings[work.extent])} ／ ${items.length}${text.parts}</small><small>${record ? `${text.finished} ／ ${esc(record.date)} ／ ${Math.round(record.accuracy * 100)}%` : text.notFinished}</small></span></button>`;
      }).join("")}</div>`;
    mount.querySelectorAll("[data-literature-course]").forEach((button) => button.addEventListener("click", () => {
      courseId = button.dataset.literatureCourse; authorFilter = ""; render(mount, save); mount.querySelector(`[data-literature-course="${courseId}"]`).focus();
    }));
    const author = mount.querySelector("#literatureAuthor");
    author.addEventListener("change", () => { authorFilter = author.value; render(mount, save); mount.querySelector("#literatureAuthor").focus(); });
    mount.querySelectorAll("[data-literature-work]").forEach((button) => button.addEventListener("click", () => chooseWork(button.dataset.literatureWork)));
    mount.querySelector("#literatureTimed").addEventListener("click", () => startTimed(courseId));
  }
  function chooseWork(id) {
    const work = works().find((item) => item.id === id);
    if (!work || !unlocked()) return;
    NindaApp.openMenuModal({ title: work.title, teacherBadge: SaveManager.isTeacherMode(), back: { label: UI_TEXT.literature.back, run() { NindaApp.closeMenuModal(true); } }, cards: [
      { id: "literature-read", name: UI_TEXT.literature.read, desc: UI_TEXT.literature.readDesc, meta: `${work.extent} ／ ${passages(work).length}${UI_TEXT.literature.parts} ／ ${UI_TEXT.guideLevel[LITERATURE_DATA.guideLevel]}`, run() { startWork(id); } },
      { id: "literature-timed", name: UI_TEXT.literature.timed, desc: UI_TEXT.literature.timedDesc, meta: `${LITERATURE_DATA.courses.find((item) => item.id === work.course).seconds}${UI_TEXT.literature.seconds}`, run() { startTimed(work.course, id); } }
    ] });
  }
  function runnerItem(entry, work, index, total) {
    return { text: entry.kana, kind: "sentence", display: entry.display || "", ruby: entry.ruby || [], source: entry.source || `${work.author}『${work.title}』`,
      kanaLines: entry.kanaLines, displayLines: entry.displayLines, workTitle: work.title, partIndex: index, partTotal: total };
  }
  function buildItems(id) {
    const work = works().find((item) => item.id === id);
    if (!work) return [];
    const source = passages(work);
    return source.map((entry, index) => runnerItem(entry, work, index, source.length));
  }
  function resultContext() {
    return { id: "library", label: UI_TEXT.literature.back, run() { TrainingManager.stop(false); open(courseId); } };
  }
  function startWork(id) {
    const work = works().find((item) => item.id === id);
    if (!work || !unlocked()) return;
    courseId = work.course;
    ExamManager.cancel(); NindaApp.closeMenuModal(false); NindaApp.showScreen("S2");
    TrainingManager.startRunner({ screen: "S2", stageId: "literature", recordId: `literature:${id}:read`, literatureId: id, presentation: "literature", title: work.title,
      items: buildItems(id), guideLevel: LITERATURE_DATA.guideLevel, mode: "training", purpose: "literature", advice: false,
      retry() { startWork(id); }, resultContextAction: resultContext(), onComplete(summary, run) {
        run.resultData = { detail: `${work.title} ／ ${work.extent} ／ ${UI_TEXT.literature.finished}` };
        AchievementManager.checkSession(summary);
      }, renderResult() { return `<h2>${UI_TEXT.literature.result}</h2><p>${esc(work.note)}</p>`; }
    });
  }
  function startTimed(id, workId) {
    const course = LITERATURE_DATA.courses.find((item) => item.id === id);
    const pool = works().filter((work) => work.course === id && (!workId || work.id === workId));
    if (!course || !pool.length || !unlocked()) return;
    courseId = id;
    // Shuffle works, never the ordered passages inside a work.
    const refill = () => TrainingManager.sample(pool, pool.length).flatMap((work) => buildItems(work.id));
    ExamManager.cancel(); NindaApp.closeMenuModal(false); NindaApp.showScreen("S2");
    TrainingManager.startRunner({ screen: "S2", stageId: "literature", recordId: `literature:${workId || id}:timed`, presentation: "literature", title: `${workId ? pool[0].title : course.label} ／ ${UI_TEXT.literature.timed}`,
      items: refill(), refillItems: refill, guideLevel: LITERATURE_DATA.guideLevel, mode: "jissen", seconds: course.seconds, purpose: "literature", advice: false,
      retry() { startTimed(id, workId); }, resultContextAction: resultContext(), onComplete(summary) { AchievementManager.checkSession(summary); },
      renderResult() { return `<h2>${UI_TEXT.literature.result}</h2>`; }
    });
  }
  return { works, passages, entries, note, unlocked, open, render, chooseWork, buildItems, startWork, startTimed };
})();
