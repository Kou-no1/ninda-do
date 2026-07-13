const ExamManager = globalThis.ExamManager = (function () {
  "use strict";

  let danRun = null;

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
      const pool = ref.in || [];
      while (total < stage.exam.items && pool.length) {
        const text = pool[items.length % pool.length];
        items.push({ text, kind: "in" });
        total += text.length;
      }
      return items;
    }
    const source = stage.exam.kind === "sentence" ? ref.sentences : ref.words;
    return TrainingManager.sample(source, stage.exam.items).map((text) => ({ text, kind: stage.exam.kind }));
  }

  function start(stageId) {
    const save = SaveManager.ensure();
    if (save.dan && save.dan !== "none" && stageId === "kyu1") {
      startDanExam();
      return;
    }
    const stage = stageById(stageId);
    if (!stage) return;
    if (!save.practicedStages.includes(stage.id)) {
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
      onComplete(summary, state) {
        SaveManager.addSessionSummary(stage.id, summary, state.items.length);
        const passed = summary.accuracy >= stage.exam.accuracy;
        state.outcome = { passed, requiredAccuracy: stage.exam.accuracy };
        if (passed) {
          SaveManager.grantStageClear(stage.id, { acc: summary.accuracy });
          if (summary.miss === 0 && globalThis.AchievementManager) AchievementManager.grant("seijaku");
          if (stage.guideLevelExam === 0 && globalThis.AchievementManager) AchievementManager.grant("kaigan");
          if (globalThis.AchievementManager) AchievementManager.checkSession(summary);
          if (globalThis.AudioManager) {
            if (stage.id === "kyu1") AudioManager.rankUp();
            else AudioManager.pass();
          }
        } else {
          SaveManager.logEvent("kyu_fail", { id: stage.id, acc: summary.accuracy });
        }
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

  function startDanExam() {
    const save = SaveManager.ensure();
    const targetId = nextDanId(save.dan);
    const target = RANK_DATA.dans.find((dan) => dan.id === targetId);
    if (!target || !target.exam) {
      alert("いまの段位は、これ以上の試しがないよ。");
      return;
    }
    danRun = { target, phaseIndex: 0, summaries: [], failed: null };
    NindaApp.showScreen("S3");
    startDanPhase();
  }

  function startDanPhase() {
    const phases = ["kata", "jissen", "shingan"];
    const phase = phases[danRun.phaseIndex];
    const exam = danRun.target.exam[phase];
    const config = phaseConfig(phase, exam, danRun.target);
    TrainingManager.startRunner(config);
  }

  function phaseConfig(phase, exam, target) {
    const labels = { kata: "一、型の試し", jissen: "二、実戦の試し", shingan: "三、心眼の試し" };
    const isJissen = phase === "jissen";
    const items = isJissen
      ? TrainingManager.sample(DAN_SENTENCES.sentences, Math.max(12, Math.ceil(exam.seconds / 6))).map((text) => ({ text, kind: "sentence" }))
      : TrainingManager.sample(phase === "kata" ? DAN_WORDS.words : shortSentences(), exam.items).map((text) => ({ text, kind: phase === "kata" ? "word" : "sentence" }));
    return {
      screen: "S3",
      title: `${target.label}への三の試し`,
      phase: labels[phase],
      items,
      guideLevel: exam.guideLevel,
      mode: isJissen ? "jissen" : "exam",
      seconds: isJissen ? exam.seconds : 0,
      resultActions: phase === "shingan",
      onComplete(summary, state) {
        const passed = summary.accuracy >= exam.accuracy && (!isJissen || summary.kpm >= exam.kpm);
        danRun.summaries.push({ phase, summary, passed });
        if (!passed) danRun.failed = { phase, summary, exam };
        state.outcome = { passed, phase, exam, final: false };
        state.config.resultActions = !(passed && phase !== "shingan");
        if (passed && phase !== "shingan") {
          window.setTimeout(() => {
            danRun.phaseIndex += 1;
            startDanPhase();
          }, 900);
          return;
        }
        if (passed && phase === "shingan") {
          state.outcome.final = true;
          SaveManager.grantDan(target.id, { acc: summary.accuracy, kpm: Math.round(bestKpm(danRun.summaries)) });
          if (globalThis.AudioManager) AudioManager.rankUp();
        } else {
          SaveManager.logEvent("dan_fail", { id: target.id, phase, acc: summary.accuracy, kpm: Math.round(summary.kpm || 0) });
        }
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

  function startJissen(menuId) {
    const save = SaveManager.ensure();
    if (!save.dan || save.dan === "none") {
      alert("疾風の術は、下忍から使えるよ。");
      return;
    }
    const menu = RANK_DATA.jissenMenu.find((item) => item.id === menuId) || RANK_DATA.jissenMenu[0];
    const items = buildJissenItems(menu, save);
    NindaApp.showScreen("S2");
    TrainingManager.startRunner({
      screen: "S2",
      stageId: "jissen",
      title: menu.label,
      items,
      guideLevel: 1,
      mode: "jissen",
      seconds: menu.seconds || 0,
      onComplete(summary, state) {
        SaveManager.addSessionSummary("jissen", summary, state.items.length);
        SaveManager.update((saveData) => {
          if (menu.kind === "timeAttack") saveData.best.shippuScore = Math.max(saveData.best.shippuScore || 0, summary.correct);
        });
        if (globalThis.AchievementManager) AchievementManager.checkSession(summary);
      },
      renderResult(summary) {
        return `<h2>実戦の記録</h2><p>正確率 ${Math.round(summary.accuracy * 100)}% ／ KPM ${Math.round(summary.kpm)} ／ 気配 ${summary.rhythm}</p>`;
      }
    });
  }

  function buildJissenItems(menu, save) {
    if (menu.kind === "sentence") {
      return TrainingManager.sample(DAN_SENTENCES.sentences, 18).map((text) => ({ text, kind: "sentence" }));
    }
    if (menu.kind === "weak") {
      const weak = MetricsEngine.weakKeys(save.keyStats, 5).map((item) => item.key);
      const preferred = DAN_WORDS.words.filter((word) => {
        const romaji = InputEngine.preferredRomaji(word);
        return weak.some((key) => romaji.includes(key));
      });
      return TrainingManager.sample(preferred.length ? preferred : DAN_WORDS.words, menu.items || 10).map((text) => ({ text, kind: "word" }));
    }
    return TrainingManager.sample(DAN_WORDS.words, menu.kind === "timeAttack" ? 30 : 24).map((text) => ({ text, kind: "word" }));
  }

  return {
    start,
    startDanExam,
    startJissen,
    buildJissenItems
  };
})();
