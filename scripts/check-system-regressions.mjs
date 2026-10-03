import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = [...fs.readFileSync(path.join(root, "index.html"), "utf8").matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
const plain = (value) => JSON.parse(JSON.stringify(value));
let tests = 0;
function test(name, fn) { fn(); tests += 1; console.log(`OK ${name}`); }

function fixture(storageOptions = {}) {
  let time = Date.UTC(2026, 9, 3, 3);
  const values = new Map();
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } }
  const noop = () => {};
  const document = { addEventListener: noop, createElement: () => ({ remove: noop }), body: { appendChild: noop } };
  const context = vm.createContext({ console, TextEncoder, Date: FakeDate, document, performance: { now: () => time },
    localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => { if (storageOptions.quota) throw new Error("quota"); values.set(key, value); }, removeItem: (key) => values.delete(key) },
    setTimeout: noop, clearTimeout: noop, addEventListener: noop });
  context.window = context;
  context.globalThis = context;
  for (const file of scripts) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  context.NindaApp = undefined;
  return { context, values, advance: (ms) => { time += ms; } };
}

test("KPM uses all elapsed time, not the last hit", () => {
  const f = fixture(); const metrics = f.context.MetricsEngine.createSession({ mode: "jissen" });
  f.advance(1000);
  for (let i = 0; i < 10; i += 1) metrics.consume({ ts: f.context.Date.now(), key: "a", expectedKeys: ["a"], correct: true });
  f.advance(59000);
  assert.equal(metrics.summary().kpm, 10);
  assert.equal(metrics.summary(undefined, 60).kpm, 10);
});

test("pauses exclude elapsed time and rhythm intervals; grades have no speed fields", () => {
  const f = fixture(); const m = f.context.MetricsEngine.createSession({ mode: "jissen" });
  f.advance(1000); m.consume({ ts: f.context.Date.now(), key: "a", correct: true });
  m.setPaused(true); f.advance(59000); m.consume({ ts: f.context.Date.now(), key: "a", correct: true });
  m.setPaused(false); f.advance(1000);
  assert.equal(m.summary().correct, 1); assert.equal(m.summary().kpm, 30);
  const grade = f.context.MetricsEngine.createSession({ mode: "training" }).summary();
  assert.equal("kpm" in grade, false); assert.equal("bestKpm" in grade, false);
});

test("selection and replay cannot regress unlocked stages or dan", () => {
  const { context: c } = fixture(); const s = c.SaveManager;
  s.create("しのび", "kyu5"); s.update((data) => { data.currentStage = "nyumon1"; });
  assert.equal(s.stageUnlocked("kyu5"), true); assert.equal(s.stageUnlocked("kyu4"), false);
  s.grantStageClear("kyu10", { acc: 1 }); assert.equal(s.ensure().unlockedStage, "kyu5");
  s.update((data) => { data.dan = "jonin"; }); s.grantStageClear("kyu1", { acc: 1 });
  assert.equal(s.ensure().dan, "jonin");
});

test("old saves migrate practice gates and invalid settings use real defaults", () => {
  const { context: c, values } = fixture();
  const save = plain(c.SaveManager.create("しのび", "kyu1"));
  delete save.unlockedStage; delete save.practicedDans;
  save.dan = "chunin"; save.practicedStages = ["jissen", "kyu1"];
  save.settings = { se: "invalid", voice: null, teacherMode: "true" };
  values.set(c.SaveManager.STORAGE_KEY, JSON.stringify(save));
  const restored = c.SaveManager.load();
  assert.deepEqual(plain(restored.practicedDans), ["chunin"]);
  assert.equal(restored.settings.se, true); assert.equal(restored.settings.voice, true);
  assert.equal(restored.settings.teacherMode, false); assert.equal(restored.settings.kanjiDisplay, true);
  save.dan = "none"; save.currentStage = "nyumon1"; save.practicedStages = ["kyu7"];
  values.set(c.SaveManager.STORAGE_KEY, JSON.stringify(save));
  assert.equal(c.SaveManager.load().unlockedStage, "kyu7");
});

test("quota fallback is authoritative when reads still work", () => {
  const { context: c } = fixture({ quota: true });
  c.SaveManager.create("しのび", "kyu10"); c.SaveManager.markPracticed("kyu10");
  assert.equal(c.SaveManager.load().name, "しのび");
  assert.equal(c.SaveManager.load().practicedStages.includes("kyu10"), true);
  assert.equal(c.SaveManager.storageStatus().persistent, false);
});

test("corrupted storage is retained until explicit recovery", () => {
  const { context: c, values } = fixture();
  values.set(c.SaveManager.STORAGE_KEY, "{bad-json");
  c.SaveManager.ensure(); c.SaveManager.setSetting("se", false);
  assert.equal(values.get(c.SaveManager.STORAGE_KEY), "{bad-json");
  assert.ok(c.SaveManager.storageStatus().warning);
  c.SaveManager.create("しのび", "kyu10");
  assert.equal(JSON.parse(values.get(c.SaveManager.STORAGE_KEY)).name, "しのび");
});

test("all events reach the sync adapter exactly once", () => {
  const { context: c } = fixture(); const calls = []; let flushes = 0;
  c.SaveManager.create("しのび", "kyu10");
  c.SaveManager.setSyncAdapter({ onEvent: (entry) => calls.push(entry.type), flush: () => { flushes += 1; } });
  c.SaveManager.grantStageClear("kyu10", { acc: 1 }); c.SaveManager.grantDan("chunin", { acc: 1 });
  c.SaveManager.grantNickname("seijaku"); c.SaveManager.logEvent("session_end", { correct: 1 }); c.SaveManager.flush();
  assert.deepEqual(calls, ["scroll_get", "kyu_pass", "dan_pass", "nickname_get", "session_end"]);
  assert.equal(flushes, 1);
});

test("teacher play cannot mutate progress or emit events", () => {
  const { context: c } = fixture(); const s = c.SaveManager;
  s.create("しのび", "kyu5"); s.grantStageClear("kyu10", { acc: 1 }); s.setSetting("teacherMode", true);
  const before = plain(s.ensure()); let events = 0; s.setSyncAdapter({ onEvent: () => { events += 1; } });
  const summary = { correct: 100, miss: 1, mode: "jissen", kpm: 120, rhythm: "不動", maxCombo: 100, keyStats: {} };
  s.grantStageClear("kyu1", { acc: 1 }); s.grantDan("kage", {}); s.addSessionSummary("kyu5", summary, 10);
  s.markPracticed("kyu5"); s.logEvent("kyu_fail", {}); s.grantNickname("senbon"); s.updateBanzukeBest("michi-genin", { score: 100, tier: "月光" });
  c.AchievementManager.checkSession(summary, { exam: true, passed: true, dan: true, firstTry: true });
  s.update((data) => { data.totals.correct += 100; data.settings.voice = false; }, { allowTeacherWrite: true });
  const allowed = plain(before); allowed.settings.voice = false;
  assert.deepEqual(plain(s.ensure()), allowed); assert.equal(events, 0);
  s.setSetting("se", false); assert.equal(s.ensure().settings.se, false);
  s.setSetting("teacherMode", false); assert.equal(s.ensure().settings.teacherMode, false);
});

test("streak follows JST today/yesterday/gap and starts at actual practice", () => {
  const f = fixture(); const s = f.context.SaveManager; s.create("しのび", "kyu10");
  assert.equal(s.ensure().streak.days, 0);
  s.markPracticed("kyu10"); s.markPracticed("kyu10"); assert.equal(s.ensure().streak.days, 1);
  f.advance(86400000); s.markPracticed("kyu10"); assert.equal(s.ensure().streak.days, 2);
  f.advance(172800000); s.markPracticed("kyu10"); assert.equal(s.ensure().streak.days, 1);
});

test("all nickname condition types have live evaluators", () => {
  const { context: c } = fixture(); const s = c.SaveManager;
  for (const item of c.NICKNAME_DATA) assert.ok(c.AchievementManager.supportedTypes.includes(item.cond.type));
  s.create("しのび", "kyu1"); s.grantStageClear("kyu1", { acc: 1 });
  c.AchievementManager.checkSession({ mode: "exam", miss: 0, accuracy: 1, correct: 100, maxCombo: 100 }, { exam: true, passed: true, guideLevel: 0, phase: "kata", dan: true, firstTry: true });
  for (const id of ["kaiden", "seijaku", "kaigan", "kanzen", "ippatsu", "hyakuren"]) assert.ok(s.ensure().nicknames.includes(id), id);
  c.AchievementManager.checkSession({ mode: "jissen", kpm: 100000, elapsedSeconds: 0.01 });
  assert.equal(s.ensure().nicknames.includes("onsoku"), false);
});

test("complete backup round trips and rejects malformed files before writing", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu5");
  s.grantStageClear("kyu10", { acc: 1 }); s.addSessionSummary("kyu5", { correct: 5, miss: 1, mode: "training", maxCombo: 5, rhythm: "静", keyStats: { a: { attempts: 6, misses: 1, sumLatency: 500, recent: [true, false] } } }, 1);
  s.updateBanzukeBest("michi-genin", { score: 100, tier: "月光" });
  const before = plain(s.ensure()); const backup = s.exportBackup(); s.reset(); s.restoreBackup(backup);
  assert.deepEqual(plain(s.ensure()), before);
  const invalid = JSON.parse(backup); invalid.save.totals.correct = -1;
  assert.throws(() => s.restoreBackup(JSON.stringify(invalid))); assert.deepEqual(plain(s.ensure()), before);
});

test("short recovery codes preserve represented fields and detect corruption", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu2");
  s.update((data) => { data.dan = "chunin"; data.scrolls = ["kamae"]; data.nicknames = ["godo", "hyakuren"]; data.totals.correct = 12300; data.totals.keys = 12300; data.streak.days = 7; });
  const code = s.exportCode(); const before = plain(s.ensure()); s.reset(); const after = s.restoreCode(code, before.name);
  for (const field of ["currentStage", "dan"]) assert.deepEqual(plain(after[field]), before[field]);
  for (const field of ["scrolls", "nicknames"]) assert.deepEqual(plain(after[field]).sort(), before[field].slice().sort());
  assert.equal(after.totals.correct, before.totals.correct); assert.equal(after.streak.days, 7);
  assert.throws(() => s.restoreCode(`み${code.slice(1)}`));
});

test("grade weak review never introduces keys from the independent alphabet track", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu5");
  s.update((data) => { data.keyStats = { m: { attempts: 30, misses: 20, sumLatency: 1, recent: [] }, y: { attempts: 30, misses: 29, sumLatency: 1, recent: [] } }; });
  const stage = c.CURRICULUM_DATA.stages.find((item) => item.id === "kyu5");
  const keys = new Set(c.CURRICULUM_DATA.stages.filter((item) => item.type === "kyu").slice(0, 6).flatMap((item) => item.newKeys));
  const items = c.TrainingManager.buildReviewItems(stage);
  assert.equal(items.length, 10); for (const item of items) assert.equal(c.InputEngine.isTypeable(item.text, keys), true);
  assert.ok(items.some((item) => c.InputEngine.preferredRomaji(item.text).includes("m")));
});

test("adaptive review exhausts a unique pool before repeating", () => {
  const { context: c } = fixture();
  for (let i = 0; i < 30; i += 1) {
    const items = c.TrainingManager.adaptiveItems(["あ", "か", "さ", "た"], ["k"], 4, "word");
    assert.equal(items[0].text, "か");
    assert.equal(new Set(items.map((item) => item.text)).size, 4);
  }
});

test("integrity rejects invalid vocabulary with a stage-specific cause", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ninda-invalid-data-"));
  fs.cpSync(path.join(root, "data"), path.join(directory, "data"), { recursive: true });
  fs.mkdirSync(path.join(directory, "js"));
  fs.mkdirSync(path.join(directory, "scripts"));
  for (const name of ["input-engine.js", "achievement-manager.js"]) fs.copyFileSync(path.join(root, "js", name), path.join(directory, "js", name));
  fs.copyFileSync(path.join(root, "scripts/check-data-integrity.mjs"), path.join(directory, "scripts/check-data-integrity.mjs"));
  fs.appendFileSync(path.join(directory, "data/words/kyu5-words.js"), '\nKYU5_WORDS.words.push("ゆき");\n');
  const result = spawnSync(process.execPath, ["scripts/check-data-integrity.mjs"], { cwd: directory, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /\[kyu5\]/);
});

test("spaced reviews follow JST dates, advance once per day and never punish absence", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu4");
  const event = { id: "kyu4", stageId: "kyu4", mode: "training", purpose: "practice", completed: true, correct: 20, miss: 0, acc: 1, rhythm: "静", readings: [] };
  const save = s.ensure(); save.practicedStages.push("kyu4"); c.LearningManager.applySession(save, event, "2026-10-03");
  assert.equal(save.learning.reviews.kyu4.due, "2026-10-04");
  c.LearningManager.applySession(save, { ...event, purpose: "review" }, "2026-10-04");
  assert.equal(save.learning.reviews.kyu4.due, "2026-10-07");
  c.LearningManager.applySession(save, { ...event, purpose: "review" }, "2026-10-04");
  assert.equal(save.learning.reviews.kyu4.step, 1);
  c.LearningManager.applySession(save, { ...event, purpose: "mini" }, "2026-10-05");
  assert.equal(save.learning.reviews.kyu4.due, "2026-10-07");
  const missions = plain(save.learning.missions); const plan = c.LearningManager.plan(save, "2026-11-01");
  assert.equal(plan[0].purpose, "review"); assert.deepEqual(plain(save.learning.missions), missions);
});

test("mini drills respect cumulative grade keys and independent alphabet track", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu4");
  let save = s.ensure(); assert.ok(c.LearningManager.drillItems("kyu4", "musubi", save).length);
  assert.equal(c.LearningManager.drillItems("kyu4", "bunshin", save).length, 0);
  save.confusions = { "f>j": 10, "a>z": 15 };
  const items = c.LearningManager.drillItems("kyu9", "pair", save);
  assert.ok(items.length); for (const item of items) assert.equal(c.InputEngine.isTypeable(item.text, c.LearningManager.stageSets("kyu9").keys), true);
  assert.equal(c.LearningManager.drillItems("nyumon1", "musubi", save).length, 0);
});

test("lesson files validate content, rights, duplicates, size and unlocked kana/keys", () => {
  const { context: c } = fixture(); const parse = c.LearningManager.parseLesson;
  const data = { format: "ninda-do-lesson", v: 1, title: "ことば", stageId: "kyu5", kind: "word", items: ["ねこ", "はな"], rights: "original-or-permitted" };
  const valid = parse(data); assert.match(valid.id, /^lesson-/); assert.equal(parse(JSON.stringify(valid)).id, valid.id);
  for (const change of [{ items: ["ゆき"] }, { items: ["ねこ", "ねこ"] }, { items: ["<script>"] }, { title: "<img>" }, { rights: "" }, { items: ["がっこう"] }]) assert.throws(() => parse({ ...data, ...change }));
  assert.throws(() => parse(" ".repeat(102401)));
  assert.throws(() => parse({ ...data, stageId: "kyu10", kind: "in", items: ["fa"] }));
  assert.equal(parse({ ...data, stageId: "nyumon4", kind: "letter", items: ["z"] }).items[0], "z");
});

test("unit and confusion statistics share the single event pipeline", () => {
  const { context: c } = fixture(); const m = c.MetricsEngine.createSession({ mode: "training" });
  m.consume({ ts: 1, kana: "ん", key: "a", expectedKeys: ["n"], correct: false });
  m.consume({ ts: 2, kana: "ん", key: "n", expectedKeys: ["n"], correct: true });
  assert.deepEqual(plain(m.summary().unitStats["ん"]), { attempts: 2, misses: 1 });
  assert.equal(m.summary().confusions["n>a"], 1); assert.equal("kpm" in m.summary(), false);
});

test("new learning, game and lesson records remain read-only in teacher mode", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu5");
  s.setSetting("teacherMode", true); const before = plain(s.ensure());
  s.addSessionSummary("kyu5", { mode: "training", correct: 20, miss: 0, keyStats: {}, unitStats: { a: { attempts: 20, misses: 0 } }, confusions: {} }, 1,
    { event: { completed: true, correct: 20, miss: 0, acc: 1, stageId: "kyu5", mode: "training", delivered: 5, readings: [c.LearningManager.readingEntries()[0].kana] } });
  s.updateCourierBest("sato-bin", 100, 5); s.update((data) => { data.learning.lessonPack = {}; });
  assert.deepEqual(plain(s.ensure()), before);
  s.setSetting("textSize", "large"); assert.equal(s.ensure().settings.textSize, "large");
  assert.deepEqual(plain(s.ensure().learning), before.learning);
});

test("courier unlocks, accuracy-weighted scoring and best updates are deterministic", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu1");
  assert.equal(c.NinjaGameManager.unlocked(c.GAME_DATA.courses[0], s.ensure()), false);
  s.update((data) => { data.dan = "genin"; });
  assert.equal(c.NinjaGameManager.unlocked(c.GAME_DATA.courses[0], s.ensure()), true);
  assert.equal(c.NinjaGameManager.unlocked(c.GAME_DATA.courses[1], s.ensure()), false);
  assert.equal(c.NinjaGameManager.score(101, 0.9), 91);
  assert.equal(s.updateCourierBest("sato-bin", 100, 8).updated, true);
  assert.equal(s.updateCourierBest("sato-bin", 90, 10).updated, false);
  assert.equal(s.ensure().best.courier["sato-bin"].words, 8);
  for (const course of c.GAME_DATA.courses) assert.ok(c.NinjaGameManager.pool(course).length >= 5);
  const before = plain(s.ensure()); const backup = s.exportBackup(); s.reset(); s.restoreBackup(backup);
  assert.deepEqual(plain(s.ensure()), before);
});

test("missions, reading and lesson completion persist only completed sessions and survive backup", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu1");
  const reading = c.LearningManager.readingEntries()[0].kana;
  const summary = { mode: "training", correct: 10, miss: 0, rhythm: "静", keyStats: {}, unitStats: {}, confusions: {} };
  const event = { id: "kyu1", stageId: "kyu1", mode: "training", purpose: "review", completed: true, correct: 10, miss: 0, acc: 1, rhythm: "静", readings: [reading], lessonId: "lesson-1234" };
  for (let i = 0; i < 3; i += 1) s.addSessionSummary("kyu1", summary, 1, { event });
  assert.ok(s.ensure().learning.missions.includes("gate")); assert.ok(s.ensure().learning.missions.includes("bridge"));
  assert.ok(s.ensure().learning.missions.includes("garden"));
  assert.equal(s.ensure().learning.readings.length, 1); assert.deepEqual(plain(s.ensure().learning.completedLessons), ["lesson-1234"]);
  const before = plain(s.ensure().learning);
  s.addSessionSummary("kyu1", summary, 1, { partial: true, event: { ...event, completed: false } });
  assert.deepEqual(plain(s.ensure().learning), before);
  const backup = s.exportBackup(); s.reset(); s.restoreBackup(backup);
  assert.deepEqual(plain(s.ensure().learning), before);
});

test("seeded courier blocks reproduce full order, exhausting pools before repeats", () => {
  const { context: c } = fixture(); const game = c.NinjaGameManager;
  for (const course of c.GAME_DATA.courses) {
    const a = game.sequence(course, 123456); const b = game.sequence(course, 123456);
    for (let i = 0; i < 4; i += 1) {
      const batch = plain(a()); assert.deepEqual(batch, plain(b()));
      assert.equal(new Set(batch.map((item) => item.text)).size, game.pool(course).length);
    }
    assert.notDeepEqual(plain(game.sequence(course, 123456)()), plain(game.sequence(course, 987654)()));
  }
  assert.throws(() => game.sequence(c.GAME_DATA.courses[0], -1));
  assert.throws(() => game.sequence(c.GAME_DATA.courses[0], 4294967296));
});

test("shared codes detect corruption and content revisions without carrying progress", () => {
  const { context: c } = fixture(); const game = c.NinjaGameManager;
  c.SaveManager.create("しのび", "kyu1"); const before = plain(c.SaveManager.ensure());
  for (const course of c.GAME_DATA.courses) for (const seed of [0, 1, 4294967295]) {
    const code = game.exportChallenge(course.id, seed);
    assert.deepEqual(plain(game.parseChallenge(` ${code.toLowerCase()} `)), { courseId: course.id, seed, code });
    assert.throws(() => game.parseChallenge(code + "A"));
    assert.throws(() => game.parseChallenge(code.replace("ND1", "ND2")));
  }
  const old = game.exportChallenge("sato-bin", 1); c.GAME_DATA.travel.baseSeconds += 1;
  assert.throws(() => game.parseChallenge(old), /版/);
  assert.deepEqual(plain(c.SaveManager.ensure()), before);
});

test("replays are bounded and pause-adjusted; teacher writes and invalid records are rejected", () => {
  const { context: c } = fixture(); const s = c.SaveManager; const g = c.NinjaGameManager;
  s.create("しのび", "kyu1"); const course = c.GAME_DATA.courses[0];
  const record = { v: 1, seed: 7, signature: g.signature(course), times: [1000, 5000], score: 30 };
  assert.equal(s.saveCourierReplay(course.id, record), true);
  assert.equal(s.saveCourierReplay(course.id, { ...record, times: [5000, 1000] }), false);
  assert.equal(s.saveCourierReplay(course.id, { ...record, times: [60001] }), false);
  assert.equal(s.saveCourierReplay(course.id, { ...record, times: Array(501).fill(1000) }), false);
  assert.equal(g.ghostProgress(record, 0.5, [{ text: "あい" }]).delivered, 0);
  assert.equal(g.ghostProgress(record, 2, [{ text: "あい" }, { text: "うえ" }]).delivered, 1);
  assert.equal(g.ghostProgress(record, 6, []).delivered, 2);
  const backup = s.exportBackup(); s.reset(); s.restoreBackup(backup);
  assert.deepEqual(plain(s.ensure().game.replays[course.id]), record);
  s.setSetting("teacherMode", true); const before = plain(s.ensure());
  assert.equal(s.saveCourierReplay(course.id, { ...record, seed: 8 }), false);
  s.equipOutfit("head-moon"); assert.deepEqual(plain(s.ensure()), before);
});

test("accuracy unlocks a lasting shortcut independently of typing speed", () => {
  const { context: c } = fixture(); const g = c.NinjaGameManager;
  assert.equal(g.opensShortcut(2, { combo: 19, accuracy: 1 }), false);
  assert.equal(g.opensShortcut(3, { combo: 5, accuracy: 0.98 }), true);
  assert.equal(g.opensShortcut(3, { combo: 5, accuracy: 0.97 }), false);
  assert.equal(g.opensShortcut(0, { combo: 20, accuracy: 0.5 }), true);
  assert.equal(g.routeFor(0, false).id, "roof"); assert.equal(g.routeFor(2, false).id, "bamboo");
  assert.equal(g.routeFor(4, false).id, "bridge"); assert.equal(g.routeFor(3, true).id, "garden");
});

test("cosmetic rewards persist without penalties, performance effects or teacher progress writes", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu1");
  assert.deepEqual(plain(s.ensure().game.owned), ["head-ai", "belt-ai", "bag-plain"]);
  s.equipOutfit("head-moon"); assert.equal(s.ensure().game.equipped.head, "head-ai");
  const summary = { mode: "training", correct: 40, miss: 0, maxCombo: 40, keyStats: {}, unitStats: {}, confusions: {} };
  const event = { completed: true, mode: "training", stageId: "kyu1", purpose: "review", correct: 40, miss: 0, acc: 1, maxCombo: 40, delivered: 4 };
  for (let i = 0; i < 3; i += 1) s.addSessionSummary("kyu1", summary, 1, { event });
  for (const id of ["head-moon", "head-leaf", "belt-plum", "belt-wave", "bag-wave"]) assert.ok(s.ensure().game.owned.includes(id));
  s.equipOutfit("head-moon"); assert.equal(s.ensure().game.equipped.head, "head-moon");
  const owned = plain(s.ensure().game.owned);
  s.addSessionSummary("kyu1", { ...summary, correct: 0, miss: 10 }, 0, { event: { ...event, correct: 0, miss: 10, acc: 0, delivered: 0 } });
  assert.deepEqual(plain(s.ensure().game.owned), owned);
  const before = plain(s.ensure()); s.setSetting("teacherMode", true);
  s.addSessionSummary("kyu1", summary, 1, { event }); s.setSetting("teacherMode", false);
  assert.deepEqual(plain(s.ensure()), before);
});

test("coaching selects this session's kana or key issue and only introduced drills", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu2");
  const base = { keyStats: {}, confusions: {}, unitStats: {} };
  assert.equal(c.LearningManager.advice({ ...base, unitStats: { "ん": { attempts: 4, misses: 2 } } }, "kyu4").drill, "musubi");
  assert.equal(c.LearningManager.advice({ ...base, unitStats: { "っ": { attempts: 4, misses: 2 } } }, "kyu2").drill, "bunshin");
  assert.equal(c.LearningManager.advice({ ...base, unitStats: { "しゃ": { attempts: 4, misses: 2 } } }, "kyu2").drill, "henge");
  s.update((data) => { data.confusions["f>j"] = 2; });
  assert.equal(c.LearningManager.advice({ ...base, confusions: { "f>j": 2 } }, "kyu10").drill, "pair");
  s.update((data) => { data.confusions["a>s"] = 100; });
  const coach = c.LearningManager.advice({ ...base, confusions: { "f>j": 2 } }, "kyu9");
  assert.equal(coach.pair, "f>j");
  assert.ok(c.LearningManager.drillItems("kyu9", "pair", s.ensure(), coach.pair).every((item) => /^[fj]+$/.test(item.text)));
  assert.equal(c.LearningManager.drillItems("kyu10", "pair", s.ensure(), "f>a").length, 0);
  assert.equal(c.LearningManager.advice({ ...base, keyStats: { f: { attempts: 4, misses: 1 } } }, "kyu10").review, true);
  assert.equal(c.LearningManager.advice({ ...base, unitStats: { "ん": { attempts: 4, misses: 2 } } }, "kyu7").drill, undefined);
  let captured;
  vm.runInContext("NindaApp.closeMenuModal=()=>{};NindaApp.showScreen=()=>{};", c);
  c.TrainingManager.startRunner = (config) => { captured = config; };
  c.LearningManager.runPractice("nyumon2", "review", undefined, { key: "f" });
  assert.ok(captured.items.every((item) => item.text === "f" && item.kind === "letter"));
});

test("legacy saves migrate cosmetics; invalid inventory and replay fields cannot change defaults", () => {
  const { context: c, values } = fixture(); const s = c.SaveManager;
  const old = plain(s.create("しのび", "kyu10")); delete old.game;
  values.set(s.STORAGE_KEY, JSON.stringify(old)); assert.deepEqual(plain(s.load().game), plain(c.NinjaGameManager.emptyProgress()));
  old.game = { owned: ["head-moon", "unknown"], equipped: { head: "head-moon", belt: "head-moon", bag: "unknown" }, replays: { "sato-bin": { seed: 1 } } };
  values.set(s.STORAGE_KEY, JSON.stringify(old)); const next = s.load().game;
  assert.equal(next.equipped.head, "head-moon"); assert.equal(next.equipped.belt, "belt-ai"); assert.equal(next.equipped.bag, "bag-plain");
  assert.deepEqual(plain(next.replays), {}); assert.equal(next.owned.includes("unknown"), false);
});

test("literature resolves audited passages verbatim and gates pending works even for teachers", () => {
  const { context: c } = fixture(); const l = c.LiteratureManager; const s = c.SaveManager;
  assert.equal(c.LITERATURE_DATA.courses.length, 4); assert.equal(l.works().length, 23);
  for (const work of l.works()) {
    const items = l.buildItems(work.id);
    assert.equal(items.length, work.passages.length);
    for (const [index, ref] of work.passages.entries()) {
      const entry = c[ref.ref].items.find((item) => item.kana.startsWith(ref.starts));
      assert.equal(items[index].text, entry.kana); assert.equal(items[index].display, entry.display);
      assert.deepEqual(plain(items[index].ruby), plain(entry.ruby)); assert.equal(items[index].source, entry.source);
      assert.equal(items[index].partIndex, index); assert.equal(items[index].partTotal, items.length);
    }
  }
  assert.equal(c.LearningManager.readingEntries().length, 36);
  s.create("しのび", "kyu1"); s.update((data) => { data.dan = "chunin"; }); assert.equal(l.unlocked(), false);
  s.update((data) => { data.dan = "jonin"; }); assert.equal(l.unlocked(), true);
  s.setSetting("teacherMode", true); assert.equal(l.unlocked(), true);
  for (const work of c.LITERATURE_DATA.works.filter((item) => item.audit === "pending")) assert.equal(l.buildItems(work.id).length, 0);
});

test("only completed literature excerpts are recorded; backup and teacher gates preserve book progress", () => {
  const { context: c } = fixture(); const s = c.SaveManager; s.create("しのび", "kyu1");
  const summary = { mode: "training", correct: 20, miss: 1, accuracy: 20 / 21, rhythm: "静", maxCombo: 10, keyStats: {}, unitStats: {}, confusions: {} };
  const event = { completed: true, correct: 20, miss: 1, acc: 20 / 21, mode: "training", purpose: "literature", literatureId: "neko", stageId: "literature" };
  s.addSessionSummary("literature:neko:read", summary, 1, { event: { ...event, completed: false } });
  assert.deepEqual(plain(s.ensure().learning.books), {});
  s.addSessionSummary("literature:neko:read", summary, 1, { event });
  assert.deepEqual(plain(s.ensure().learning.books.neko), { date: "2026-10-03", accuracy: 20 / 21 });
  s.addSessionSummary("literature:misuzu-kotori:read", summary, 1, { event: { ...event, literatureId: "misuzu-kotori" } });
  assert.equal(s.ensure().learning.books["misuzu-kotori"], undefined);
  const before = plain(s.ensure()); const backup = s.exportBackup(); s.reset(); s.restoreBackup(backup);
  assert.deepEqual(plain(s.ensure()), before);
  s.setSetting("teacherMode", true); const teacher = plain(s.ensure());
  s.addSessionSummary("literature:botchan:read", summary, 1, { event: { ...event, literatureId: "botchan" } });
  assert.deepEqual(plain(s.ensure()), teacher);
});

test("old and malformed saves normalize literature books without accepting pending work records", () => {
  const { context: c } = fixture(); const l = c.LearningManager;
  assert.deepEqual(plain(l.normalizeState({}).books), {});
  const raw = { books: { neko: { date: "2026-10-03", accuracy: 1, extra: "drop" }, unknown: { date: "2026-10-03", accuracy: 1 },
    "misuzu-kotori": { date: "2026-10-03", accuracy: 1 }, botchan: { date: "bad", accuracy: 1 }, melos: { date: "2026-10-03", accuracy: 2 } } };
  assert.deepEqual(plain(l.normalizeState(raw).books), { neko: { date: "2026-10-03", accuracy: 1 } });
});

test("poem line breaks preserve ruby, escaped text and the engine's current unit", () => {
  const { context: c } = fixture(); const t = c.TrainingManager;
  const item = c.LITERATURE_DATA.works.find((work) => work.id === "misuzu-kotori").passages[0];
  const display = t.displayHtml(item.display, item.ruby, item.displayLines);
  assert.equal((display.match(/<br /g) || []).length, 1); assert.ok(display.includes("<rt>りょうて</rt>"));
  const boundary = c.InputEngine.segment(item.kanaLines[0]).length;
  const prompt = t.promptProgressHtml(item.kana, "sentence", { unitIndex: boundary }, item.kanaLines);
  assert.equal((prompt.match(/<br /g) || []).length, 1);
  assert.ok(prompt.includes('<br class="prompt-line-break"><span class="prompt-unit current">お</span>'));
  assert.equal((prompt.match(/prompt-unit current/g) || []).length, 1);
  assert.equal(t.displayHtml("<x>", [null], ["<", "x>"]), '&lt;<br class="prompt-line-break">x&gt;');
});

test("literature timed refills shuffle works but preserve each work's passage order", () => {
  const { context: c } = fixture(); c.SaveManager.create("しのび", "kyu1");
  c.SaveManager.setSetting("teacherMode", true);
  const poem = c.LITERATURE_DATA.works.find((work) => work.id === "misuzu-kotori");
  poem.audit = "approved"; delete poem.useReview;
  let captured;
  vm.runInContext("NindaApp.closeMenuModal=()=>{};NindaApp.showScreen=()=>{};", c);
  c.TrainingManager.sample = (pool) => pool.slice().reverse();
  c.TrainingManager.startRunner = (config) => { captured = config; };
  c.LiteratureManager.startTimed("poetry");
  assert.equal(captured.seconds, 90); assert.equal(captured.mode, "jissen");
  assert.equal(captured.literatureId, undefined);
  for (const items of [captured.items, captured.refillItems()]) {
    const sequence = items.filter((item) => item.workTitle === poem.title);
    assert.deepEqual(plain(sequence.map((item) => item.text)), plain(poem.passages.map((item) => item.kana)));
    assert.deepEqual(plain(sequence.map((item) => item.partIndex)), [0, 1, 2, 3, 4]);
  }
  c.LITERATURE_DATA.courses.find((course) => course.id === "poetry").seconds = 75;
  c.LiteratureManager.startTimed("poetry", poem.id); assert.equal(captured.seconds, 75);
  c.LiteratureManager.startWork(poem.id); assert.equal(captured.seconds, undefined);
  assert.equal(captured.literatureId, poem.id); assert.equal(captured.mode, "training");
});

test("literature integrity rejects unaudited activation, broken references and split ruby", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ninda-literature-integrity-"));
  fs.cpSync(path.join(root, "data"), path.join(directory, "data"), { recursive: true });
  fs.cpSync(path.join(root, "js"), path.join(directory, "js"), { recursive: true });
  fs.mkdirSync(path.join(directory, "scripts"));
  fs.copyFileSync(path.join(root, "scripts/check-data-integrity.mjs"), path.join(directory, "scripts/check-data-integrity.mjs"));
  const file = path.join(directory, "data/literature-data.js"); const original = fs.readFileSync(file, "utf8");
  for (const [mutation, expected] of [
    ['LITERATURE_DATA.works.find(w=>w.id==="misuzu-kotori").audit="approved";', /未確認の利用条件/],
    ['LITERATURE_DATA.works.find(w=>w.id==="neko").passages[0].starts="ないお題";', /元の名文を一意/],
    ['{const p=LITERATURE_DATA.works.find(w=>w.id==="misuzu-kotori").passages[0];p.displayLines=[p.display.slice(0,3),p.display.slice(3)];}', /改行がルビを分断/]
  ]) {
    fs.writeFileSync(file, `${original}\n${mutation}\n`);
    const result = spawnSync(process.execPath, ["scripts/check-data-integrity.mjs"], { cwd: directory, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 1); assert.match(result.stdout + result.stderr, expected);
  }
});

console.log(`OK system regressions: ${tests} tests`);
