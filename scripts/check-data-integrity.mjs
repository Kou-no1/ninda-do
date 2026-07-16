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
  "js/input-engine.js"
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

const validNicknameCondTypes = new Set([
  "stage_clear", "exam_nomiss", "rhythm_hold", "first_pass_guide0",
  "total_correct", "streak", "dan_first_try", "weak_key_master",
  "kpm_reach", "all_scrolls", "exam_perfect", "combo_reach",
  "tier_reach", "tier_all"
]);
for (const item of NICKNAME_DATA) {
  ok(item.id && item.name && item.cond && item.cond.type, `NG [nickname] ${item.id}: 定義が不足しています`);
  ok(validNicknameCondTypes.has(item.cond.type), `NG [nickname:${item.id}] cond.type ${item.cond.type} の評価器がありません`);
  if (item.cond.id) ok(stageIds.has(item.cond.id), `NG [nickname:${item.id}] cond.id ${item.cond.id} が存在しません`);
}
ok(nicknameIds.size === NICKNAME_DATA.length, "NG [nickname] id が重複しています");

for (const menu of RANK_DATA.jissenMenu) {
  ok(typeof menu.desc === "string" && menu.desc.trim().length > 0, `NG [jissenMenu:${menu.id}] desc がありません`);
  if (menu.source) ok(context[menu.source], `NG [jissenMenu:${menu.id}] source ${menu.source} が存在しません`);
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
for (const dan of RANK_DATA.dans) {
  if (!dan.exam) continue;
  ok(typeof dan.exam.desc === "string" && dan.exam.desc.trim().length > 0, `NG [dan:${dan.id}] exam.desc がありません`);
  ok(dan.exam.jissen.kpm >= previousKpm, `NG [dan:${dan.id}] kpm が単調非減少ではありません`);
  ok(dan.exam.jissen.accuracy >= previousAccuracy, `NG [dan:${dan.id}] accuracy が単調非減少ではありません`);
  previousKpm = dan.exam.jissen.kpm;
  previousAccuracy = dan.exam.jissen.accuracy;
}

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

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK data integrity: ${STAGES.length} stages, ${DAN_WORDS.words.length} dan words, ${DAN_SENTENCES.sentences.length} dan sentences`);
