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
  const context = vm.createContext({ console, Date: FakeDate, document, performance: { now: () => time },
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

console.log(`OK system regressions: ${tests} tests`);
