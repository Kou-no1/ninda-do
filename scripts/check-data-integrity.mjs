import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "data/finger-data.js",
  "data/romaji-data.js",
  "data/jutsu-data.js",
  "data/nickname-data.js",
  "data/curriculum-data.js",
  "data/rank-data.js",
  "data/learning-data.js",
  "data/game-data.js",
  "data/words/nyumon-words.js",
  "data/words/kyu10-words.js",
  "data/words/kyu9-words.js",
  "data/words/kyu8-words.js",
  "data/words/kyu7-words.js",
  "data/words/kyu6-words.js",
  "data/words/kyu5-words.js",
  "data/words/kyu4-words.js",
  "data/words/kyu3-words.js",
  "data/words/kyu2-words.js",
  "data/words/kyu1-words.js",
  "data/words/dan-words.js",
  "data/words/dan-sentences.js",
  "data/words/michi-genin.js",
  "data/words/michi-chunin.js",
  "data/words/michi-jonin.js",
  "data/words/michi-tokujonin.js",
  "data/words/michi-kage.js",
  "data/literature-data.js",
  "js/input-engine.js",
  "js/achievement-manager.js"
];

const context = vm.createContext({ console, globalThis: {} });
context.globalThis = context;
for (const file of FILES) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

const errors = [];
const ok = (condition, message) => { if (!condition) errors.push(message); };
const {
  FINGER_DATA, ROMAJI_TABLE, JUTSU_DATA, NICKNAME_DATA, CURRICULUM_DATA,
  RANK_DATA, InputEngine, DAN_WORDS, DAN_SENTENCES,
  MICHI_GENIN, MICHI_CHUNIN, MICHI_JONIN, MICHI_TOKUJONIN, MICHI_KAGE
} = context;

const STAGES = CURRICULUM_DATA.stages;
const stageIds = new Set(STAGES.map((stage) => stage.id));
const jutsuIds = new Set(JUTSU_DATA.map((item) => item.id));
const nicknameIds = new Set(NICKNAME_DATA.map((item) => item.id));
const wordRefNames = new Set(STAGES.map((stage) => stage.wordsRef));
const kanaRe = /^[ぁ-んー、。]+$/;

function wordRef(name) {
  return context[name];
}

function uniqueItems(list) {
  return new Set(list).size === list.length;
}

function allStageTexts(ref) {
  return []
    .concat(ref.in || [])
    .concat(ref.words || [])
    .concat(ref.sentences || []);
}

function stageKeyAndKana(stageId) {
  const keys = new Set();
  const kana = new Set();
  for (const stage of STAGES) {
    if (stage.type === "kyu") {
      stage.newKeys.forEach((key) => keys.add(key));
      stage.newKana.forEach((unit) => kana.add(unit));
    }
    if (stage.id === stageId) break;
  }
  return { keys, kana };
}

function nyumonKeys(stageId) {
  const keys = new Set();
  for (const stage of STAGES) {
    if (stage.type === "nyumon") stage.newKeys.forEach((key) => keys.add(key));
    if (stage.id === stageId) break;
  }
  return keys;
}

function checkKanaUnits(stage, text, allowedKana) {
  let units;
  try {
    units = InputEngine.segment(text);
  } catch (error) {
    errors.push(`NG [${stage.id}] "${text}": ${error.message}`);
    return;
  }
  for (const unit of units) {
    if (unit.raw) continue;
    ok(allowedKana.has(unit.kana), `NG [${stage.id}] "${text}": かな ${unit.kana} は未解放`);
  }
}

function checkWordQuality(label, list, options = {}) {
  ok(uniqueItems(list), `NG [${label}] 語彙に重複があります`);
  for (const item of list) {
    ok(item.length > 0, `NG [${label}] 空文字があります`);
    ok(kanaRe.test(item), `NG [${label}] "${item}": ひらがな・ー・、・。以外を含みます`);
    if (options.wordLength) {
      ok(item.length >= options.wordLength[0] && item.length <= options.wordLength[1],
        `NG [${label}] "${item}": 語長が範囲外です`);
    }
    if (options.sentenceLength) {
      ok(item.length >= options.sentenceLength[0] && item.length <= options.sentenceLength[1],
        `NG [${label}] "${item}": 文長が範囲外です`);
    }
  }
}

function entryKana(entry) {
  return typeof entry === "string" ? entry : entry && entry.kana;
}

let rubyEntryCount = 0;
const genreCounts = { kotowaza: 0, meibun: 0, koten: 0 };

function checkMichiQuality(course, ref) {
  ok(ref && ref.course === course.id, `NG [${course.id}] course定義が不正です`);
  const items = ref && Array.isArray(ref.items) ? ref.items : [];
  ok(items.length >= 30, `NG [${course.id}] items は30本以上必要です`);
  const kanaList = items.map(entryKana);
  ok(uniqueItems(kanaList), `NG [${course.id}] 語彙に重複があります`);
  for (const entry of items) {
    const kana = entryKana(entry);
    ok(typeof kana === "string" && kana.length > 0, `NG [${course.id}] kana が不足しています`);
    ok(kanaRe.test(kana || ""), `NG [${course.id}] "${kana}": ひらがな・ー・、・。以外を含みます`);
    if (typeof entry === "object") {
      ok(typeof entry.kana === "string" && entry.kana.length > 0, `NG [${course.id}] オブジェクト形式の kana が不足しています`);
      if ("display" in entry) ok(typeof entry.display === "string" && entry.display.length > 0, `NG [${course.id}] display が空です`);
      if ("source" in entry) ok(typeof entry.source === "string" && entry.source.length > 0, `NG [${course.id}] source が空です`);
      if ("genre" in entry) {
        ok(Object.hasOwn(genreCounts, entry.genre), `NG [${course.id}] "${kana}": genre ${entry.genre} は未定義です`);
        if (Object.hasOwn(genreCounts, entry.genre)) genreCounts[entry.genre] += 1;
      }
      if ("ruby" in entry) {
        rubyEntryCount += 1;
        ok(typeof entry.display === "string" && entry.display.length > 0, `NG [${course.id}] "${kana}": ruby に対応する display がありません`);
        ok(Array.isArray(entry.ruby) && entry.ruby.length > 0, `NG [${course.id}] "${kana}": ruby が配列ではないか空です`);
        const parts = Array.isArray(entry.ruby) ? entry.ruby : [];
        let joined = "";
        parts.forEach((part, index) => {
          const validShape = Array.isArray(part) && (part.length === 1 || part.length === 2);
          ok(validShape, `NG [${course.id}] "${kana}": ruby[${index}] は1要素または2要素の配列ではありません`);
          if (!validShape) return;
          ok(typeof part[0] === "string" && part[0].length > 0, `NG [${course.id}] "${kana}": ruby[${index}] の文字列が空です`);
          if (typeof part[0] === "string") joined += part[0];
          if (part.length === 2) ok(typeof part[1] === "string" && part[1].length > 0, `NG [${course.id}] "${kana}": ruby[${index}] のよみが空です`);
        });
        ok(joined === entry.display, `NG [${course.id}] "${kana}": ruby連結「${joined}」が display「${entry.display}」と一致しません`);
      }
    }
  }
}

for (const stage of STAGES) {
  ok([0, 1, 2, 3].includes(stage.guideLevelTraining) && [0, 1, 2, 3].includes(stage.guideLevelExam), `NG [${stage.id}] guideLevel は0〜3です`);
  ok(wordRef(stage.wordsRef), `NG [${stage.id}] wordsRef ${stage.wordsRef} が存在しません`);
  for (const jutsu of stage.jutsu) ok(jutsuIds.has(jutsu), `NG [${stage.id}] jutsu ${jutsu} が存在しません`);
  for (const key of stage.newKeys) ok(FINGER_DATA.keys[key], `NG [${stage.id}] newKey ${key} が FINGER_DATA にありません`);

  const ref = wordRef(stage.wordsRef);
  if (!ref) continue;
  const texts = allStageTexts(ref);
  if (stage.type === "nyumon") {
    const keys = nyumonKeys(stage.id);
    for (const key of ref.sections[stage.id] || []) {
      ok(keys.has(key), `NG [${stage.id}] 入門キー ${key} は未解放`);
      ok(FINGER_DATA.keys[key], `NG [${stage.id}] 入門キー ${key} が FINGER_DATA にありません`);
    }
    continue;
  }

  const { keys, kana } = stageKeyAndKana(stage.id);
  for (const drill of ref.in || []) {
    for (const key of drill) ok(keys.has(key), `NG [${stage.id}] 印 "${drill}": キー ${key} は未解放`);
  }
  for (const text of (ref.words || []).concat(ref.sentences || [])) {
    checkKanaUnits(stage, text, kana);
    ok(InputEngine.isTypeable(text, keys), `NG [${stage.id}] "${text}": 累積キーで打てる経路がありません`);
  }
  for (const text of texts) {
    const units = InputEngine.segment(text);
    for (let index = 0; index < units.length; index += 1) {
      const candidates = InputEngine._candidatesFor(units, index);
      for (const candidate of candidates) {
        for (const key of candidate) ok(FINGER_DATA.keys[key], `NG [${stage.id}] "${text}": キー ${key} が FINGER_DATA にありません`);
      }
    }
  }
}

checkWordQuality("kyu7.words", context.KYU7_WORDS.words, { wordLength: [2, 6] });
ok(context.KYU7_WORDS.words.length >= 20, "NG [kyu7] words は20語以上必要です");
for (const id of ["kyu6", "kyu5", "kyu4", "kyu3", "kyu2"]) {
  const ref = wordRef(id.toUpperCase() + "_WORDS");
  checkWordQuality(`${id}.words`, ref.words, { wordLength: [2, 8] });
  ok(ref.words.length >= 30, `NG [${id}] words は30語以上必要です`);
}
checkWordQuality("kyu1.sentences", context.KYU1_WORDS.sentences, { sentenceLength: [8, 30] });
ok(context.KYU1_WORDS.sentences.length >= 15, "NG [kyu1] sentences は15文以上必要です");
checkWordQuality("DAN_WORDS", DAN_WORDS.words, { wordLength: [2, 8] });
ok(DAN_WORDS.words.length >= 100, "NG [DAN_WORDS] 100語以上必要です");
checkWordQuality("DAN_SENTENCES", DAN_SENTENCES.sentences, { sentenceLength: [12, 30] });
ok(DAN_SENTENCES.sentences.length >= 30, "NG [DAN_SENTENCES] 30文以上必要です");

const allKeys = new Set(Object.keys(FINGER_DATA.keys).filter((key) => !FINGER_DATA.keys[key].displayOnly));
for (const text of DAN_WORDS.words.concat(DAN_SENTENCES.sentences)) {
  ok(InputEngine.isTypeable(text, allKeys), `NG [dan] "${text}": 全キーでも打てる経路がありません`);
}

const michiRefs = {
  MICHI_GENIN,
  MICHI_CHUNIN,
  MICHI_JONIN,
  MICHI_TOKUJONIN,
  MICHI_KAGE
};
for (const course of RANK_DATA.banzuke.courses) {
  const ref = michiRefs[course.wordsRef];
  checkMichiQuality(course, ref);
  for (const entry of (ref && ref.items || [])) {
    const kana = entryKana(entry);
    ok(InputEngine.isTypeable(kana, allKeys), `NG [${course.id}] "${kana}": 全キーでも打てる経路がありません`);
  }
}
ok(rubyEntryCount === 36, `NG [ruby] ルビ定義は36本必要です（現在 ${rubyEntryCount} 本）`);
ok(genreCounts.kotowaza === 9, `NG [genre:kotowaza] 9本必要です（現在 ${genreCounts.kotowaza} 本）`);
ok(genreCounts.meibun === 15, `NG [genre:meibun] 15本必要です（現在 ${genreCounts.meibun} 本）`);
ok(genreCounts.koten === 12, `NG [genre:koten] 12本必要です（現在 ${genreCounts.koten} 本）`);

const validNicknameCondTypes = new Set(context.AchievementManager.supportedTypes);
for (const item of NICKNAME_DATA) {
  ok(item.id && item.name && item.cond && item.cond.type, `NG [nickname] ${item.id}: 定義が不足しています`);
  ok(validNicknameCondTypes.has(item.cond.type), `NG [nickname:${item.id}] cond.type ${item.cond.type} の評価器がありません`);
  if (item.cond.id) ok(stageIds.has(item.cond.id), `NG [nickname:${item.id}] cond.id ${item.cond.id} が存在しません`);
}
ok(nicknameIds.size === NICKNAME_DATA.length, "NG [nickname] id が重複しています");
ok(CURRICULUM_DATA.review && CURRICULUM_DATA.review.label && CURRICULUM_DATA.review.desc, "NG [review] 復習メニューの定義がありません");
for (const kind of ["in", "word", "sentence"]) ok(Number.isInteger(CURRICULUM_DATA.review.counts[kind]) && CURRICULUM_DATA.review.counts[kind] > 0, `NG [review:${kind}] count が不正です`);
ok(Array.isArray(FINGER_DATA.observations) && FINGER_DATA.observations.length > 0 && FINGER_DATA.observations.every((item) => item.id && item.label), "NG [observations] 観察項目が不足しています");

const validDanIds = new Set(RANK_DATA.dans.map((dan) => dan.id));
const michiAllItems = Object.values(michiRefs).flatMap((ref) => ref && Array.isArray(ref.items) ? ref.items : []);
for (const menu of RANK_DATA.jissenMenu) {
  ok(typeof menu.desc === "string" && menu.desc.trim().length > 0, `NG [jissenMenu:${menu.id}] desc がありません`);
  ok(validDanIds.has(menu.unlockDan), `NG [jissenMenu:${menu.id}] unlockDan ${menu.unlockDan} が段位に存在しません`);
  if (menu.source === "MICHI_ALL") {
    ok(typeof menu.genre === "string" && menu.genre.length > 0, `NG [jissenMenu:${menu.id}] MICHI_ALL には genre が必要です`);
    const pool = michiAllItems.filter((entry) => entry && typeof entry === "object" && entry.genre === menu.genre);
    ok(pool.length >= 5, `NG [jissenMenu:${menu.id}] genre ${menu.genre} の語彙は5本以上必要です（現在 ${pool.length} 本）`);
  } else if (menu.source) {
    ok(context[menu.source], `NG [jissenMenu:${menu.id}] source ${menu.source} が存在しません`);
  }
}
for (const course of RANK_DATA.banzuke.courses) {
  ok(typeof course.desc === "string" && course.desc.trim().length > 0, `NG [banzuke:${course.id}] desc がありません`);
  ok(context[course.wordsRef], `NG [banzuke:${course.id}] wordsRef ${course.wordsRef} が存在しません`);
  ok(RANK_DATA.banzuke.tiers[course.id], `NG [banzuke:${course.id}] tierしきい値がありません`);
}
const tierOrder = RANK_DATA.banzuke.tierOrder.slice(1);
for (const course of RANK_DATA.banzuke.courses) {
  let previous = -Infinity;
  for (const tier of tierOrder) {
    const value = RANK_DATA.banzuke.tiers[course.id][tier];
    ok(Number.isFinite(value), `NG [banzuke:${course.id}] ${tier} のしきい値が数値ではありません`);
    ok(value > previous, `NG [banzuke:${course.id}] Tierしきい値が単調増加ではありません`);
    previous = value;
  }
}
for (const tier of tierOrder) {
  let previous = -Infinity;
  for (const course of RANK_DATA.banzuke.courses) {
    const value = RANK_DATA.banzuke.tiers[course.id][tier];
    ok(value >= previous, `NG [banzuke:${tier}] コース順で単調非減少ではありません`);
    previous = value;
  }
}
let previousKpm = 0;
let previousAccuracy = 0;
const danOrder = RANK_DATA.dans.map((dan) => dan.id);
const secretDanIds = RANK_DATA.dans.filter((dan) => dan.secret === true).map((dan) => dan.id);
for (const dan of RANK_DATA.dans) {
  ok(typeof dan.mapAccent === "string" && dan.mapAccent.trim().length > 0, `NG [dan:${dan.id}] mapAccent がありません`);
  ok(typeof dan.flavor === "string" && dan.flavor.trim().length > 0, `NG [dan:${dan.id}] flavor がありません`);
  if (dan.secret === true) {
    ok(danOrder.indexOf(dan.id) > 0, `NG [dan:${dan.id}] 先頭段位をsecretにはできません`);
  }
  if (["jonin", "tokujonin", "kage"].includes(dan.id)) {
    ok(Number.isFinite(dan.exam && dan.exam.jissen && dan.exam.jissen.kpm), `NG [dan:${dan.id}] exam.jissen.kpm がありません`);
    ok(Number.isFinite(dan.exam && dan.exam.jissen && dan.exam.jissen.accuracy), `NG [dan:${dan.id}] exam.jissen.accuracy がありません`);
  }
  if (!dan.exam) continue;
  ok(typeof dan.exam.desc === "string" && dan.exam.desc.trim().length > 0, `NG [dan:${dan.id}] exam.desc がありません`);
  ok(dan.exam.jissen.kpm >= previousKpm, `NG [dan:${dan.id}] kpm が単調非減少ではありません`);
  ok(dan.exam.jissen.accuracy >= previousAccuracy, `NG [dan:${dan.id}] accuracy が単調非減少ではありません`);
  previousKpm = dan.exam.jissen.kpm;
  previousAccuracy = dan.exam.jissen.accuracy;
}
ok(secretDanIds.length === 2 && secretDanIds.includes("tokujonin") && secretDanIds.includes("kage"),
  `NG [dan:secret] secret:true は tokujonin / kage のみに指定してください`);

const mustCases = [
  { text: "しか", good: ["sika", "shika"], bad: [] },
  { text: "ちず", good: ["tizu", "chizu"], bad: [] },
  { text: "がっこう", good: ["gakkou", "gaxtukou", "galtukou"], bad: ["gakou"] },
  { text: "きって", good: ["kitte", "kixtute"], bad: [] },
  { text: "ちゃわん", good: ["tyawann", "chawann"], bad: ["tyawan"] },
  { text: "さんぽ", good: ["sanpo", "sannpo"], bad: [] },
  { text: "きんいろ", good: ["kinniro"], bad: ["kiniro"] },
  { text: "ほんや", good: ["honnya"], bad: ["honya"] },
  { text: "にんじゃ", good: ["ninzya", "ninja", "ninnjya"], bad: [] },
  { text: "らーめん", good: ["ra-menn"], bad: ["ra-men"] },
  { text: "いっしょ", good: ["issyo", "issho", "ixtusyo"], bad: [] },
  { text: "は、しる。", good: ["ha,siru."], bad: [] }
];

function runInput(text, keys) {
  const session = InputEngine.start(text);
  let missed = false;
  for (const key of keys) {
    const result = session.handleKey(key);
    if (result === "miss") {
      missed = true;
      break;
    }
  }
  return { missed, done: session.isDone() };
}

function checkGuideFollow(text, keys, label) {
  const session = InputEngine.start(text);
  let keyIndex = -1;
  session.onEvent((event) => {
    if (!event.correct || keyIndex >= keys.length - 1) return;
    const next = session.nextExpectedKeys();
    const nextKey = keys[keyIndex + 1];
    const nth = `${keyIndex + 1}打目`;
    ok(next.length > 0, `NG [guide] "${label}" ${nth}: イベント時点の nextExpectedKeys が空`);
    ok(next.includes(nextKey), `NG [guide] "${label}" ${nth}: イベント時点の nextExpectedKeys ${JSON.stringify(next)} に次キー ${nextKey} がありません`);
  });
  for (let index = 0; index < keys.length; index += 1) {
    keyIndex = index;
    const result = session.handleKey(keys[index]);
    if (result === "miss") {
      ok(false, `NG [guide] "${label}" ${index + 1}打目: 正解入力で miss になりました`);
      break;
    }
  }
  ok(session.isDone(), `NG [guide] "${label}": ガイド追従検証で完走しません`);
}

for (const item of mustCases) {
  for (const input of item.good) {
    const result = runInput(item.text, input);
    ok(!result.missed && result.done, `NG [MUST] ${item.text} <= ${input} が完走しません`);
    checkGuideFollow(item.text, input, `${item.text} <= ${input}`);
  }
  for (const input of item.bad) {
    const result = runInput(item.text, input);
    ok(result.missed || !result.done, `NG [MUST] ${item.text} <= ${input} が不正に完走しました`);
  }
}
checkGuideFollow("asdf", "asdf", "asdf");

const learning = context.LEARNING_DATA;
ok(Array.isArray(learning.review.intervals) && learning.review.intervals.every((day, i, days) => Number.isInteger(day) && day > 0 && (!i || day > days[i - 1])), "NG [learning:review] 復習間隔が不正です");
ok(learning.review.accuracy > 0 && learning.review.accuracy <= 1 && learning.review.count > 0, "NG [learning:review] 合格基準が不正です");
const missionIds = new Set();
for (const mission of learning.missions) {
  ok(!missionIds.has(mission.id) && (!mission.after || missionIds.has(mission.after)), `NG [mission:${mission.id}] 順序・参照が不正です`);
  ok(["practice", "review", "calm", "reading", "delivered"].includes(mission.goal) && Number.isInteger(mission.n) && mission.n > 0, `NG [mission:${mission.id}] 条件が不正です`);
  ok(!mission.unlockDan || validDanIds.has(mission.unlockDan), `NG [mission:${mission.id}] 段位参照が不正です`);
  ["title", "story", "reward"].forEach((field) => ok(typeof mission[field] === "string" && mission[field].trim(), `NG [mission:${mission.id}] ${field} が空です`));
  missionIds.add(mission.id);
}
for (const drill of learning.drills) ok(drill.id && drill.label && drill.desc && drill.count > 0, `NG [drill:${drill.id}] 設定が不正です`);
for (const rule of learning.coaching) {
  ok(rule.id && typeof rule.text === "string" && rule.text.trim() && Array.isArray(rule.parts) && rule.parts.length > 0
    && rule.parts.every((part) => typeof part === "string" && part) && learning.drills.some((drill) => drill.id === rule.drill), `NG [coaching:${rule.id}] 文言・小修行参照が不正です`);
}
for (const course of RANK_DATA.banzuke.courses) {
  for (const entry of context[course.wordsRef].items.filter((item) => item && item.genre)) {
    ok(typeof learning.readingNotes[entry.source] === "string" && learning.readingNotes[entry.source].trim(), `NG [reading:${entry.source}] 解説がありません`);
  }
}
const game = context.GAME_DATA;
ok(Number.isInteger(game.guideLevel) && game.guideLevel >= 0 && game.guideLevel <= 3, "NG [courier] ガイドが不正です");
ok(game.scoring.delivery > 0 && game.scoring.fastBonus >= 0 && game.travel.baseSeconds > 0 && game.travel.secondsPerKey > 0, "NG [courier] 点数・移動時間が不正です");
ok(new Set(game.courses.map((course) => course.id)).size === game.courses.length, "NG [courier] 便のIDが重複しています");
ok(Number.isInteger(game.replay.version) && game.replay.version > 0 && Number.isInteger(game.replay.maxDeliveries) && game.replay.maxDeliveries > 0, "NG [courier:replay] 上限・版が不正です");
ok(["deliveriesPerScene", "cleanDeliveries", "combo"].every((key) => Number.isInteger(game.journey[key]) && game.journey[key] > 0)
  && game.journey.accuracy > 0 && game.journey.accuracy <= 1, "NG [courier:journey] 解放条件が不正です");
ok(new Set(game.routes.map((route) => route.id)).size === game.routes.length && game.routes.filter((route) => !route.special).length >= 3
  && game.routes.filter((route) => route.special).length === 1, "NG [courier:routes] 道の参照が不正です");
game.routes.forEach((route) => ok(route.id && route.label && route.destination, `NG [courier:route:${route.id}] 文言がありません`));
ok(new Set(game.outfits.map((item) => item.id)).size === game.outfits.length, "NG [outfits] IDが重複しています");
for (const slot of ["head", "belt", "bag"]) ok(game.outfits.filter((item) => item.slot === slot && item.condition.type === "default").length === 1, `NG [outfits:${slot}] 初期装備は1つ必要です`);
for (const item of game.outfits) {
  ok(item.name && item.desc && ["head", "belt", "bag"].includes(item.slot) && ["default", "correct", "accuracy", "review", "combo", "delivered"].includes(item.condition.type), `NG [outfit:${item.id}] 条件が不正です`);
  if (item.condition.type !== "default") ok(Number.isInteger(item.condition.n) && item.condition.n > 0, `NG [outfit:${item.id}] 数値が不正です`);
  if (item.condition.type === "accuracy") ok(item.condition.accuracy > 0 && item.condition.accuracy <= 1, `NG [outfit:${item.id}] 正確率が不正です`);
}
for (const course of game.courses) {
  ok(validDanIds.has(course.dan) && course.seconds > 0 && course.minLength > 0 && course.maxLength >= course.minLength, `NG [courier:${course.id}] 条件が不正です`);
  ok(DAN_WORDS.words.filter((word) => word.length >= course.minLength && word.length <= course.maxLength).length >= 5, `NG [courier:${course.id}] 語彙不足です`);
}

const literature = context.LITERATURE_DATA;
ok(validDanIds.has(literature.unlockDan) && Number.isInteger(literature.guideLevel) && literature.guideLevel >= 0 && literature.guideLevel <= 3, "NG [literature] 解放・ガイド設定が不正です");
ok(literature.courses.length === 4 && uniqueItems(literature.courses.map((course) => course.id)), "NG [literature] 4コースのIDが不正です");
ok(uniqueItems(literature.works.map((work) => work.id)), "NG [literature] 作品IDが重複しています");
for (const course of literature.courses) {
  ok(course.label && course.reading && course.desc && course.seconds > 0, `NG [literature:${course.id}] コース設定が不正です`);
  ok(literature.works.some((work) => work.course === course.id && work.audit === "approved"), `NG [literature:${course.id}] 監査済み作品がありません`);
}
for (const work of literature.works) {
  const id = `literature:${work.id}`;
  ok(literature.courses.some((course) => course.id === work.course), `NG [${id}] コース参照が不正です`);
  ["id", "title", "titleReading", "author", "authorReading", "extent", "note"].forEach((key) => ok(typeof work[key] === "string" && work[key].trim(), `NG [${id}] ${key} が空です`));
  ok(typeof literature.extentReadings[work.extent] === "string" && literature.extentReadings[work.extent].trim(), `NG [${id}] 収録範囲のよみがありません`);
  ok(["approved", "pending"].includes(work.audit) && !(work.audit === "approved" && work.useReview), `NG [${id}] 未確認の利用条件で公開できません`);
  ok(work.death === "古典" || work.death === "伝承" || Number.isInteger(work.death) && work.death <= 1950, `NG [${id}] 作者の没年・区分が不正です`);
  ok(Array.isArray(work.passages) && work.passages.length > 0, `NG [${id}] 収録文がありません`);
  for (const [index, entry] of work.passages.entries()) {
    const matches = entry.ref ? context[entry.ref]?.items.filter((item) => item.kana.startsWith(entry.starts)) : [entry];
    ok(matches?.length === 1, `NG [${id}:${index + 1}] 元の名文を一意に参照できません`);
    const item = matches?.[0];
    if (!item) continue;
    ok(typeof item.kana === "string" && kanaRe.test(item.kana) && item.kana.length <= 120, `NG [${id}:${index + 1}] かな・文長が不正です`);
    ok(typeof item.display === "string" && item.display && typeof item.source === "string" && item.source, `NG [${id}:${index + 1}] 原文・出典が空です`);
    ok(InputEngine.isTypeable(item.kana, new Set(Object.keys(FINGER_DATA.keys).filter((key) => !FINGER_DATA.keys[key].displayOnly))), `NG [${id}:${index + 1}] 入力経路がありません`);
    ok(Array.isArray(item.ruby) && item.ruby.every((part) => Array.isArray(part) && (part.length === 1 || part.length === 2)
      && part.every((value) => typeof value === "string" && value)) && item.ruby.map((part) => part[0]).join("") === item.display, `NG [${id}:${index + 1}] ルビが原文と一致しません`);
    for (const [field, text] of [["kanaLines", item.kana], ["displayLines", item.display]]) {
      if (!item[field]) continue;
      ok(Array.isArray(item[field]) && item[field].length <= 3 && item[field].every((line) => typeof line === "string" && line) && item[field].join("") === text,
        `NG [${id}:${index + 1}] ${field} が本文と一致しません`);
      if (!Array.isArray(item[field])) continue;
      let offset = 0;
      const boundaries = item[field].slice(0, -1).map((line) => (offset += line.length));
      offset = 0;
      if (field === "kanaLines") {
        const ends = InputEngine.segment(text).map((unit) => (offset += unit.kana.length));
        ok(boundaries.every((boundary) => ends.includes(boundary)), `NG [${id}:${index + 1}] 改行が入力ユニットを分断しています`);
      } else if (Array.isArray(item.ruby)) {
        for (const part of item.ruby) {
          if (!Array.isArray(part) || typeof part[0] !== "string") continue;
          const start = offset; offset += part[0].length;
          ok(part.length !== 2 || boundaries.every((boundary) => boundary <= start || boundary >= offset), `NG [${id}:${index + 1}] 改行がルビを分断しています`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK data integrity: ${STAGES.length} stages, ${DAN_WORDS.words.length} dan words, ${DAN_SENTENCES.sentences.length} dan sentences`);
