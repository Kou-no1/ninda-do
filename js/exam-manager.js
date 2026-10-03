const ExamManager = globalThis.ExamManager = (function () {
  "use strict";

  let danRun = null;
  let phaseTimer = null;

  function cancel() {
    window.clearTimeout(phaseTimer);
    phaseTimer = null;
    danRun = null;
  }

  function stageById(stageId) {
    return CURRICULUM_DATA.stages.find((stage) => stage.id === stageId);
  }

  function refByName(name) {
    return globalThis[name];
  }

  function buildStageExamItems(stage) {
    const ref = refByName(stage.wordsRef);
    if (stage.type === "nyumon") {
      return TrainingManager.sample(NYUMON_WORDS.sections[stage.id] || [], stage.exam.items).map((text) => ({ text, kind: "letter" }));
    }
    if (stage.exam.kind === "in") {
      const items = [];
      let total = 0;
      const pool = TrainingManager.sample(ref.in || [], (ref.in || []).length);
      while (total < stage.exam.items && pool.length) {
        const text = pool[items.length % pool.length].slice(0, stage.exam.items - total);
        items.push({ text, kind: "in" });
        total += text.length;
      }
      return items;
    }
    const source = stage.exam.kind === "sentence" ? ref.sentences : ref.words;
    return TrainingManager.sample(source, stage.exam.items).map((text) => ({ text, kind: stage.exam.kind }));
  }

  function start(stageId) {
    cancel();
    const save = SaveManager.ensure();
    const teacher = SaveManager.isTeacherMode && SaveManager.isTeacherMode();
    const stage = stageById(stageId);
    if (!stage) return;
    if (!SaveManager.stageUnlocked(stageId, save)) return;
    if (!teacher && !save.practicedStages.includes(stage.id)) {
      alert(UI_TEXT.noPractice);
      return;
    }
    const items = buildStageExamItems(stage);
    NindaApp.showScreen("S3");
    TrainingManager.startRunner({
      screen: "S3",
      stageId: stage.id,
      title: `${stage.label}「${stage.title}」の試し`,
      phase: "昇級の試し",
      items,
      guideLevel: stage.type === "nyumon" ? 3 : stage.guideLevelExam,
      mode: "exam",
      retry() { start(stageId); },
      onComplete(summary, state) {
        const passed = summary.correct > 0 && summary.accuracy >= stage.exam.accuracy;
        state.outcome = { passed, requiredAccuracy: stage.exam.accuracy };
        if (passed) {
          const beforeScrolls = SaveManager.ensure().scrolls.slice();
          SaveManager.grantStageClear(stage.id, { acc: summary.accuracy });
          toastNewScrolls(stage, beforeScrolls);
          if (globalThis.AudioManager) {
            if (stage.id === "kyu1") AudioManager.rankUp();
            else AudioManager.pass();
          }
        } else {
          SaveManager.logEvent("kyu_fail", { id: stage.id, acc: summary.accuracy });
        }
        if (globalThis.AchievementManager) AchievementManager.checkSession(summary, { exam: true, passed, stageId, guideLevel: stage.guideLevelExam });
      },
      renderResult(summary, state) {
        const missing = Math.max(0, Math.ceil((state.outcome.requiredAccuracy - summary.accuracy) * 100));
        if (state.outcome.passed) {
          return `<h2>合格！</h2><p>正確率 ${Math.round(summary.accuracy * 100)}% ／ 気配 ${summary.rhythm}</p><p>${state.config.stageId === "kyu1" ? "免許皆伝。下忍へ昇段し、疾風の術がひらいた！" : "新しい巻物を手に入れた。"}</p>`;
        }
        return `<h2>${UI_TEXT.fail}</h2><p>正確率 ${Math.round(summary.accuracy * 100)}% ／ あと ${missing}%</p>`;
      }
    });
  }

  function nextDanId(currentDan) {
    const order = SaveManager.DAN_ORDER;
    const index = Math.max(1, order.indexOf(currentDan || "genin"));
    return order[index + 1] || "";
  }

  function startDanExam(targetOverride) {
    TrainingManager.stop(false);
    cancel();
    const save = SaveManager.ensure();
    const targetId = targetOverride || nextDanId(save.dan);
    const target = RANK_DATA.dans.find((dan) => dan.id === targetId);
    if (!target || !target.exam) {
      alert("いまの段位は、これ以上の試しがないよ。");
      return;
    }
    if (!SaveManager.isTeacherMode(save) && target.id !== nextDanId(save.dan)) return;
    if (!SaveManager.isTeacherMode(save) && !save.practicedDans.includes(save.dan)) { alert(UI_TEXT.noPractice); return; }
    const firstTry = !(save.examAttempts[target.id] || 0);
    SaveManager.update((data) => { data.examAttempts[target.id] = (data.examAttempts[target.id] || 0) + 1; });
    danRun = { target, phaseIndex: 0, summaries: [], failed: null, firstTry };
    NindaApp.showScreen("S3");
    startDanPhase();
  }

  function startDanPhase() {
    if (!danRun) return;
    const phases = ["kata", "jissen", "shingan"];
    const phase = phases[danRun.phaseIndex];
    const exam = danRun.target.exam[phase];
    const config = phaseConfig(phase, exam, danRun.target);
    TrainingManager.startRunner(config);
  }

  function phaseConfig(phase, exam, target) {
    const run = danRun;
    const labels = { kata: "一、型の試し", jissen: "二、実戦の試し", shingan: "三、心眼の試し" };
    const isJissen = phase === "jissen";
    const items = isJissen
      ? TrainingManager.sample(DAN_SENTENCES.sentences, DAN_SENTENCES.sentences.length).map((text) => ({ text, kind: "sentence" }))
      : TrainingManager.sample(phase === "kata" ? DAN_WORDS.words : shortSentences(), exam.items).map((text) => ({ text, kind: phase === "kata" ? "word" : "sentence" }));
    return {
      screen: "S3",
      stageId: "dan",
      recordId: `${target.id}:${phase}`,
      title: `${target.label}への三の試し`,
      phase: labels[phase],
      items,
      guideLevel: exam.guideLevel,
      mode: isJissen ? "jissen" : "exam",
      seconds: isJissen ? exam.seconds : 0,
      resultActions: phase === "shingan",
      retry() { startDanExam(target.id); },
      onCancel: cancel,
      onComplete(summary, state) {
        if (danRun !== run) return;
        const passed = summary.correct > 0 && summary.accuracy >= exam.accuracy && (!isJissen || summary.kpm >= exam.kpm);
        danRun.summaries.push({ phase, summary, passed });
        if (!passed) danRun.failed = { phase, summary, exam };
        state.outcome = { passed, phase, exam, final: false };
        state.config.resultActions = !(passed && phase !== "shingan");
        if (passed && phase !== "shingan") {
          phaseTimer = window.setTimeout(() => {
            if (danRun !== run) return;
            run.phaseIndex += 1;
            startDanPhase();
          }, 900);
          if (globalThis.AchievementManager) AchievementManager.checkSession(summary, { phase, passed });
          return;
        }
        if (passed && phase === "shingan") {
          state.outcome.final = true;
          SaveManager.grantDan(target.id, { acc: summary.accuracy, kpm: Math.round(bestKpm(danRun.summaries)) });
          if (globalThis.AchievementManager) AchievementManager.checkSession(summary, {
            exam: true, passed: true, dan: true, firstTry: run.firstTry, guideLevel: exam.guideLevel,
            totalMiss: run.summaries.reduce((sum, item) => sum + item.summary.miss, 0), phase
          });
          if (globalThis.AudioManager) AudioManager.rankUp();
        } else {
          SaveManager.logEvent("dan_fail", { id: target.id, phase, acc: summary.accuracy, kpm: Math.round(summary.kpm || 0) });
        }
        if (!passed && globalThis.AchievementManager) AchievementManager.checkSession(summary, { phase, passed: false });
      },
      renderResult(summary, state) {
        const outcome = state.outcome;
        if (outcome.passed && !outcome.final) {
          return `<h2>${labels[phase]} 通過</h2><p>次の試しへすすむ。</p>`;
        }
        if (outcome.passed && outcome.final) {
          return `<h2>昇段！ ${target.label}</h2><p>三の試しをすべてこえた。</p><p>正確率 ${Math.round(summary.accuracy * 100)}%${isJissen ? ` ／ KPM ${Math.round(summary.kpm)}` : ""}</p>`;
        }
        return danFailHtml(outcome.phase, summary, outcome.exam);
      }
    };
  }

  function danFailHtml(phase, summary, exam) {
    const accMissing = Math.max(0, Math.ceil((exam.accuracy - summary.accuracy) * 100));
    const kpmMissing = exam.kpm ? Math.max(0, Math.ceil(exam.kpm - summary.kpm)) : 0;
    const parts = [`正確率 ${Math.round(summary.accuracy * 100)}% ／ あと ${accMissing}%`];
    if (exam.kpm) parts.push(`KPM ${Math.round(summary.kpm)} ／ あと ${kpmMissing}`);
    return `<h2>${UI_TEXT.fail}</h2><p>${phaseLabel(phase)}: ${parts.join("、")}</p>`;
  }

  function phaseLabel(phase) {
    return { kata: "型の試し", jissen: "実戦の試し", shingan: "心眼の試し" }[phase] || phase;
  }

  function shortSentences() {
    return DAN_SENTENCES.sentences.filter((sentence) => sentence.length <= 20);
  }

  function bestKpm(summaries) {
    return summaries.reduce((best, item) => Math.max(best, item.summary.kpm || 0), 0);
  }

  function toastNewScrolls(stage, beforeScrolls) {
    if (SaveManager.isTeacherMode && SaveManager.isTeacherMode()) return;
    if (!globalThis.AchievementManager || !AchievementManager.toastScroll) return;
    const awarded = (stage.jutsu || []).slice();
    if (stage.id === "kyu1") awarded.push("shippu");
    awarded.filter((id) => !beforeScrolls.includes(id)).forEach((id, index) => {
      window.setTimeout(() => AchievementManager.toastScroll(id), index * 220);
    });
  }

  function startJissen(menuId) {
    cancel();
    const save = SaveManager.ensure();
    const teacher = SaveManager.isTeacherMode && SaveManager.isTeacherMode();
    const menu = RANK_DATA.jissenMenu.find((item) => item.id === menuId) || RANK_DATA.jissenMenu[0];
    if (!teacher && danIndex(save.dan) < danIndex(menu.unlockDan)) {
      alert(`${danLabel(menu.unlockDan)}に昇段するとひらくよ。`);
      return;
    }
    if (menu.kind === "banzuke") {
      if (globalThis.NindaApp && NindaApp.openBanzukeCourseMenu) NindaApp.openBanzukeCourseMenu();
      else showBanzukeCourses(save);
      return;
    }
    if (menu.kind === "courier") { NinjaGameManager.openCourses(); return; }
    if (menu.kind === "literature") { LiteratureManager.open(); return; }
    const items = buildJissenItems(menu, save);
    NindaApp.showScreen("S2");
    TrainingManager.startRunner({
      screen: "S2",
      stageId: "jissen",
      title: menu.label,
      items,
      guideLevel: 1,
      mode: menu.seconds ? "jissen" : "training",
      seconds: menu.seconds || 0,
      retry() { startJissen(menu.id); },
      onComplete(summary, state) {
        SaveManager.update((saveData) => {
          if (menu.kind === "timeAttack") saveData.best.shippuScore = Math.max(saveData.best.shippuScore || 0, summary.correct);
        });
        if (globalThis.AchievementManager) AchievementManager.checkSession(summary);
      },
      renderResult(summary) {
        return `<h2>実戦の記録</h2>`;
      }
    });
  }

  function buildJissenItems(menu, save) {
    if (menu.kind === "sentence") {
      const source = jissenSource(menu);
      return TrainingManager.sample(source, source.length).map((entry) => jissenItem(entry, "sentence")).filter((item) => item.text);
    }
    if (menu.kind === "weak") {
      const weak = MetricsEngine.weakKeys(save.keyStats, 5).map((item) => item.key);
      return TrainingManager.adaptiveItems(DAN_WORDS.words, weak, menu.items || 10, "word");
    }
    return TrainingManager.sample(DAN_WORDS.words, DAN_WORDS.words.length).map((text) => ({ text, kind: "word" }));
  }

  function jissenSource(menu) {
    if (menu.source !== "MICHI_ALL") {
      const ref = globalThis[menu.source];
      return ref && (ref.sentences || ref.words || ref.items) || [];
    }
    return (RANK_DATA.banzuke && RANK_DATA.banzuke.courses || []).flatMap((course) => {
      const ref = globalThis[course.wordsRef];
      return ref && Array.isArray(ref.items) ? ref.items : [];
    }).filter((entry) => entry && typeof entry === "object" && entry.genre === menu.genre);
  }

  function jissenItem(entry, kind) {
    const item = typeof entry === "string" ? { kana: entry } : entry || {};
    return {
      text: item.kana || "",
      kind,
      display: item.display || "",
      ruby: Array.isArray(item.ruby) ? item.ruby : [],
      source: item.source || ""
    };
  }

  function showBanzukeCourses(save) {
    const teacher = SaveManager.isTeacherMode && SaveManager.isTeacherMode();
    const courses = RANK_DATA.banzuke && RANK_DATA.banzuke.courses || [];
    const bodyHtml = `<div class="banzuke-course-grid">
      ${courses.map((course) => {
        const unlocked = teacher || danIndex(save.dan) >= danIndex(course.dan);
        const best = save.best && save.best.banzuke && save.best.banzuke[course.id];
        return `<button type="button" class="banzuke-course" data-banzuke-course="${course.id}" ${unlocked ? "" : "disabled"}>
          <strong>${escapeHtml(course.label)}</strong>
          <small>${unlocked ? `自己ベスト: ${best ? `${best.score}・${best.tier}` : "なし"}` : `${danLabel(course.dan)}から`}</small>
        </button>`;
      }).join("")}
    </div>`;
    TrainingManager.openModal({
      title: "疾風番付",
      bodyHtml,
      actions: [
        { id: "close", label: "とじる", run() { TrainingManager.closeModal(false); } }
      ],
      defaultActionId: "",
      escapeActionId: "close",
      onOpen(mount) {
        mount.querySelectorAll("[data-banzuke-course]").forEach((button) => {
          button.addEventListener("click", () => startBanzukeCourse(button.dataset.banzukeCourse));
        });
      }
    });
  }

  function startBanzukeCourse(courseId) {
    cancel();
    const course = (RANK_DATA.banzuke && RANK_DATA.banzuke.courses || []).find((item) => item.id === courseId);
    const items = buildBanzukeItems(course);
    if (!course || !items.length) {
      alert("この道の語彙は、まだ準備中だよ。");
      return;
    }
    if (!SaveManager.isTeacherMode() && danIndex(SaveManager.ensure().dan) < danIndex(course.dan)) return;
    TrainingManager.closeModal(false);
    NindaApp.showScreen("S2");
    TrainingManager.startRunner({
      screen: "S2",
      stageId: "banzuke",
      recordId: course.id,
      title: `疾風番付「${course.label}」`,
      items,
      guideLevel: 1,
      mode: "jissen",
      seconds: RANK_DATA.banzuke.seconds,
      retry() { startBanzukeCourse(courseId); },
      resultContextAction: {
        id: "courses",
        label: "コースをえらぶ",
        run() {
          if (globalThis.NindaApp && NindaApp.openBanzukeCourseMenu) {
            TrainingManager.closeModal(false);
            NindaApp.openBanzukeCourseMenu();
          }
          else showBanzukeCourses(SaveManager.ensure());
        }
      },
      onComplete(summary, state) {
        const score = banzukeScore(summary);
        const tier = banzukeTier(course.id, score);
        const best = SaveManager.updateBanzukeBest(course.id, { score, tier });
        state.resultData = { score, tier, course, bestUpdated: best.updated };
        if (globalThis.AchievementManager) AchievementManager.checkSession(summary);
        if (tier !== "無位" && globalThis.AudioManager) AudioManager.pass();
      },
      renderResult(summary, state) {
        const result = state.resultData || { score: banzukeScore(summary), tier: banzukeTier(course.id, banzukeScore(summary)) };
        return `<h2>疾風番付の記録</h2>
          <p>${escapeHtml(course.label)} ／ スコア ${result.score} ／ ${escapeHtml(result.tier)}</p>
          <p>正打 ${summary.correct} × 正確率 ${Math.round(summary.accuracy * 100)}%</p>`;
      }
    });
  }

  function buildBanzukeItems(course) {
    if (!course) return [];
    const ref = globalThis[course.wordsRef];
    const source = ref && Array.isArray(ref.items) ? ref.items : [];
    return TrainingManager.sample(source, source.length).map((entry) => {
      const item = typeof entry === "string" ? { kana: entry } : entry;
      return {
        text: item.kana,
        kind: item.kana && item.kana.length > 12 ? "sentence" : "word",
        display: item.display || "",
        ruby: Array.isArray(item.ruby) ? item.ruby : [],
        source: item.source || ""
      };
    }).filter((item) => item.text);
  }

  function banzukeScore(summary) {
    return Math.round((summary.correct || 0) * (summary.accuracy || 0));
  }

  function banzukeTier(courseId, score) {
    const thresholds = RANK_DATA.banzuke && RANK_DATA.banzuke.tiers && RANK_DATA.banzuke.tiers[courseId];
    if (!thresholds) return "無位";
    return RANK_DATA.banzuke.tierOrder.slice(1).reduce((best, tier) => score >= thresholds[tier] ? tier : best, "無位");
  }

  function danIndex(danId) {
    return Math.max(0, SaveManager.DAN_ORDER.indexOf(danId || "none"));
  }

  function danLabel(danId) {
    const dan = RANK_DATA.dans.find((item) => item.id === danId);
    return dan ? dan.label : "下忍";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  return {
    start,
    startDanExam,
    startJissen,
    startBanzukeCourse,
    buildJissenItems,
    buildBanzukeItems,
    banzukeScore,
    banzukeTier,
    cancel
  };
})();
