import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "ninda-regressions-"));
const browserPath = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].find((file) => fs.existsSync(file));
if (!browserPath || typeof WebSocket === "undefined") throw new Error("Browser tests require Chrome/Edge and Node 22+. Set CHROME_PATH if needed.");
const profile = path.join(output, "profile");
const browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
let count = 0;
const errors = [];
const network = [];

try {
  const portFile = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i += 1) await delay(100);
  const port = Number(fs.readFileSync(portFile, "utf8").split("\n")[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = pending.get(message.id); pending.delete(message.id);
      clearTimeout(call.timeout);
      if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result);
    } else {
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
      if (message.method === "Network.requestWillBeSent") network.push(message.params.request.url);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, method === "Page.printToPDF" ? 60000 : 30000);
    pending.set(id, { resolve, reject, timeout }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  async function ready(name = "SaveManager") {
    for (let i = 0; i < 100; i += 1) {
      if (await evaluate(`typeof ${name} !== 'undefined' && document.readyState === 'complete'`)) return;
      await delay(50);
    }
    throw new Error("Page readiness timeout");
  }
  async function test(name, fn) { await fn(); count += 1; console.log(`OK ${name}`); }
  async function screenshot(name) {
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, name), Buffer.from(shot.data, "base64"));
  }
  async function keys(text) { await evaluate(`for (const key of ${JSON.stringify(text)}) __key(key);`); }
  async function fresh(stage = "kyu9") {
    await evaluate(`TrainingManager.stop(false); NindaApp.closeMenuModal(false); SaveManager.setSetting('teacherMode',false); SaveManager.create('てすと',${JSON.stringify(stage)}); SaveManager.setSetting('se',false); SaveManager.setSetting('voice',false);`);
  }
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__clock=0; window.__timers=new Map(); let id=0; Object.defineProperty(performance,'now',{value:()=>__clock}); window.setInterval=(fn,ms)=>{__timers.set(++id,{fn,ms,last:__clock});return id;};window.clearInterval=id=>__timers.delete(id);window.__advance=ms=>{__clock+=ms;for(const[id,t]of[...__timers])if(__timers.has(id)&&__clock-t.last>=t.ms){t.last=__clock;t.fn();}};window.__key=key=>document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));` });
  await send("Page.navigate", { url: pathToFileURL(path.join(root, "index.html")).href }); await ready();
  await evaluate("window.__danPool=DAN_WORDS.words.slice();");

  await test("file startup and IME name-entry isolation", async () => {
    assert.equal(await evaluate("document.getElementById('imeOverlay').hidden"), true);
    await evaluate("document.getElementById('ninjaName').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));");
    assert.equal(await evaluate("document.getElementById('imeOverlay').hidden"), true);
    assert.equal(errors.length, 0);
  });

  await test("theme switch updates inherited body text, not only explicit variable users", async () => {
    await fresh();
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await evaluate("SaveManager.setSetting('display','light');NindaApp.applyTheme();");
    const colors = await evaluate("({color:getComputedStyle(document.body).color,variable:getComputedStyle(document.body).getPropertyValue('--tsuki')})");
    assert.equal(colors.color, "rgb(42, 38, 34)", JSON.stringify(colors));
    await evaluate("SaveManager.setSetting('display','night');NindaApp.applyTheme();");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  });

  await test("only one next-item transition, guide follows, miss does not advance", async () => {
    await fresh();
    await evaluate(`NindaApp.showScreen('S2');TrainingManager.startRunner({screen:'S2',stageId:'kyu9',title:'連打テスト',items:['a','s','d','f'].map(text=>({text,kind:'in'})),guideLevel:3,mode:'training'});__key('a');__key('x');__key('y');`);
    await delay(180);
    assert.equal(await evaluate("document.getElementById('promptKana').textContent"), "s");
    assert.equal(await evaluate("document.querySelector('#guideMount .key.next').textContent.toLowerCase()"), "s");
    await keys("xx");
    assert.equal(await evaluate("document.getElementById('promptKana').textContent"), "s");
    assert.ok(await evaluate("!!document.querySelector('#guideMount .hand-guide svg')"));
    await keys("s"); await delay(180);
    assert.equal(await evaluate("document.getElementById('promptKana').textContent"), "d");
    assert.equal(await evaluate("document.querySelector('#guideMount .key.next').textContent.toLowerCase()"), "d");
    await screenshot("guide-1366.png");
  });

  await test("IME pauses and its dismissal key is swallowed", async () => {
    await evaluate("document.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));");
    assert.equal(await evaluate("document.getElementById('imeOverlay').hidden"), false);
    const before = await evaluate("SaveManager.ensure().totals.correct");
    await keys("d");
    assert.equal(await evaluate("document.getElementById('imeOverlay').hidden"), true);
    assert.equal(await evaluate("document.getElementById('promptKana').textContent"), "d");
    assert.equal(await evaluate("SaveManager.ensure().totals.correct"), before);
  });

  await test("checkpoint and unload persistence have no duplicate totals", async () => {
    await fresh();
    await evaluate(`NindaApp.showScreen('S2'); TrainingManager.startRunner({screen:'S2',stageId:'kyu9',items:[{text:'asdfghjkl',kind:'in'}],guideLevel:3,mode:'training'});__key('a');__key('s');__key('d');__advance(30000);`);
    assert.equal(await evaluate("SaveManager.ensure().totals.correct"), 3);
    await keys("f");
    await send("Page.reload"); await delay(150); await ready();
    assert.equal(await evaluate("SaveManager.ensure().totals.correct"), 4);
    assert.equal(await evaluate("SaveManager.ensure().totals.words"), 0);
  });

  await test("timed pools refill, deadline ends play, modal blocks background input", async () => {
    await fresh();
    await evaluate(`NindaApp.showScreen('S2');window.__timedPool=[{text:'as',kind:'in'}];TrainingManager.startRunner({screen:'S2',stageId:'jissen',items:__timedPool,guideLevel:1,mode:'jissen',seconds:60,onComplete:(summary,state)=>window.__result={summary,words:state.completedItems}});`);
    await keys("as"); await delay(180);
    assert.equal(await evaluate("TrainingManager.isActive()"), true);
    assert.equal(await evaluate("document.getElementById('promptKana').textContent"), "as");
    assert.equal(await evaluate("__timedPool.length"), 1);
    await keys("a"); await evaluate("__advance(60000)");
    assert.equal(await evaluate("__result.summary.kpm"), 3);
    assert.equal(await evaluate("__result.words"), 1);
    const before = await evaluate("SaveManager.ensure().totals.correct"); await keys("s");
    assert.equal(await evaluate("SaveManager.ensure().totals.correct"), before);
    assert.equal(await evaluate("__result.summary.correct"), 3);
    assert.equal(await evaluate("document.getElementById('resultOverlay').hidden"), false);
    await screenshot("result-1366.png");
  });

  await test("grade result has no speed DOM, Tab cycles and Esc returns home", async () => {
    await fresh();
    await evaluate(`NindaApp.showScreen('S2');TrainingManager.startRunner({screen:'S2',stageId:'kyu9',items:[{text:'a',kind:'in'}],guideLevel:3,mode:'training'});__key('a');`);
    await delay(180);
    assert.equal(await evaluate("!!document.querySelector('#resultModalMount .result-speed')"), false);
    assert.equal(await evaluate("/KPM/.test(document.getElementById('examStats').textContent+document.getElementById('trainingStats').textContent)"), false);
    await evaluate("document.querySelector('[data-modal-action=home]').focus();");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate("document.activeElement.dataset.modalAction"), "again");
    await evaluate("__key('Escape')"); assert.equal(await evaluate("NindaApp.currentScreen()"), "S1");
  });

  await test("grade menu locks exams, supports keyboard navigation and has no speed metadata", async () => {
    await fresh(); await evaluate("NindaApp.showScreen('S1');NindaApp.openStageMenu('kyu9');");
    await delay(40);
    assert.equal(await evaluate("document.activeElement.dataset.menuCard"), "training-0");
    assert.equal(await evaluate("document.querySelector('[data-menu-card=exam]').getAttribute('aria-disabled')"), "true");
    assert.equal(await evaluate("/KPM|打\\/分|びょう|秒/.test(document.getElementById('menuModalMount').textContent)"), false);
    await evaluate("__key('ArrowDown')"); assert.equal(await evaluate("document.activeElement.dataset.menuCard"), "review");
    await evaluate("document.querySelector('[data-menu-card=exam]').focus();__key('Enter');");
    assert.equal(await evaluate("NindaApp.currentScreen()"), "S1");
    await evaluate("__key('Escape');SaveManager.markPracticed('kyu9');NindaApp.openStageMenu('kyu9');");
    assert.equal(await evaluate("document.querySelector('[data-menu-card=exam]').getAttribute('aria-disabled')"), "false");
    await evaluate("document.getElementById('menuOverlay').click();");
    assert.equal(await evaluate("document.getElementById('menuOverlay').hidden"), true);
  });

  await test("grade raw trials require exactly forty correct hits", async () => {
    await fresh(); await evaluate("SaveManager.markPracticed('kyu9');ExamManager.start('kyu9');");
    let hits = 0;
    for (let i = 0; i < 40 && await evaluate("TrainingManager.isActive()"); i += 1) {
      const text = await evaluate("document.getElementById('examPromptKana').textContent");
      hits += text.length; await keys(text); await delay(140);
    }
    assert.equal(hits, 40); assert.equal(await evaluate("SaveManager.ensure().totals.correct"), 40);
    assert.equal(await evaluate("SaveManager.ensure().clearedStages.includes('kyu9')"), true);
  });

  await test("dan retry restarts kata, logs actual stats, aborted transition cannot restart", async () => {
    await fresh("kyu1");
    await evaluate(`window.__danPool=DAN_WORDS.words.slice();SaveManager.update(s=>{s.dan='genin';});SaveManager.markPracticed('genin'); DAN_WORDS.words=['あ']; DAN_SENTENCES.sentences=['あ。'];const exam=RANK_DATA.dans.find(x=>x.id==='chunin').exam;exam.kata.items=1;exam.jissen.seconds=60;exam.jissen.kpm=0;exam.shingan.items=1;ExamManager.startDanExam('chunin');__key('a');`);
    await delay(1100);
    assert.ok(await evaluate("document.getElementById('examPhase').textContent.includes('実戦')"));
    await keys("a."); await delay(180); await evaluate("__advance(60000)"); await delay(950);
    await keys("zzzzzza."); await delay(180);
    assert.equal(await evaluate("SaveManager.ensure().dan"), "genin");
    assert.equal(await evaluate("SaveManager.ensure().totals.correct"), 5);
    await evaluate("document.querySelector('[data-modal-action=again]').click();");
    assert.ok(await evaluate("document.getElementById('examPhase').textContent.includes('型')"));
    await keys("a"); await delay(200); await evaluate("TrainingManager.stop(true)"); await delay(1000);
    assert.equal(await evaluate("NindaApp.currentScreen()"), "S1"); assert.equal(await evaluate("TrainingManager.isActive()"), false);
  });

  await test("teacher grade exam passes without altering any progress", async () => {
    await fresh("kyu5");
    await evaluate(`SaveManager.markPracticed('kyu5');SaveManager.setSetting('teacherMode',true);window.__before=JSON.stringify(SaveManager.ensure());KYU5_WORDS.words=['あ'];ExamManager.start('kyu5');`);
    for (let i = 0; i < 12; i += 1) { await keys("a"); await delay(140); }
    assert.equal(await evaluate("document.getElementById('resultModalTitle').textContent"), "合格！");
    assert.equal(await evaluate("JSON.stringify(SaveManager.ensure())===__before"), true);
    assert.equal(await evaluate("!!document.querySelector('#resultModalMount .result-speed')"), false);
  });

  await test("dan pupils can review grade one without entering a dan trial", async () => {
    await fresh("kyu1");
    await evaluate("SaveManager.update(s=>{s.dan='jonin';});SaveManager.markPracticed('kyu1');ExamManager.start('kyu1');");
    assert.ok(await evaluate("document.getElementById('examPhase').textContent.includes('昇級')"));
    assert.equal(await evaluate("/KPM|のこり/.test(document.getElementById('examStats').textContent)"), false);
    assert.equal(await evaluate("document.getElementById('examGuideMount').innerHTML"), "");
    await evaluate("TrainingManager.stop(true)");
  });

  await test("literature menu unlocks by dan and preserves ruby/source in timed play", async () => {
    await fresh("kyu1");
    await evaluate("SaveManager.update(s=>{s.dan='chunin';});NindaApp.openJissenMenu();");
    assert.equal(await evaluate("document.querySelector('[data-menu-card=koten-jissen]').getAttribute('aria-disabled')"), "true");
    await evaluate("NindaApp.closeMenuModal(false);SaveManager.update(s=>{s.dan='jonin';});NindaApp.openJissenMenu();");
    assert.notEqual(await evaluate("document.querySelector('[data-menu-card=koten-jissen]').getAttribute('aria-disabled')"), "true");
    await evaluate("NindaApp.closeMenuModal(false);ExamManager.startJissen('koten-jissen');");
    assert.ok(await evaluate("document.querySelectorAll('#promptKana ruby').length>0"));
    assert.ok(await evaluate("document.getElementById('promptFurigana').textContent.length>0"));
    assert.ok(await evaluate("document.getElementById('trainingStats').textContent.includes('120')"));
    await evaluate("__advance(120000)");
    assert.equal(await evaluate("document.getElementById('resultOverlay').hidden"), false);
    assert.equal(await evaluate("document.querySelectorAll('#resultModalMount .result-tier').length"), 0);
    await evaluate("TrainingManager.stop(true)");
  });

  await test("selection keeps frontier open; light/night layout and text contrasts", async () => {
    await fresh("kyu5"); await evaluate("NindaApp.showScreen('S1');document.querySelector('[data-stage-id=nyumon1]').click();NindaApp.closeMenuModal(false);");
    assert.equal(await evaluate("document.querySelector('[data-stage-id=kyu5]').disabled"), false);
    await evaluate("SaveManager.setSetting('teacherMode',true);NindaApp.showScreen('S1');SaveManager.setSetting('display','light');NindaApp.applyTheme();");
    const contrast = await evaluate(`(()=>{const rgb=s=>s.match(/[0-9.]+/g).slice(0,3).map(Number),lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);return ['.map-node','.next-panel'].map(selector=>{const el=document.querySelector(selector),css=getComputedStyle(el);return{selector,ratio:ratio(rgb(css.color),rgb(css.backgroundColor)),foreground:css.color,background:css.backgroundColor};});})()`);
    for (const item of contrast) assert.ok(item.ratio >= 4.5, JSON.stringify(item));
    fs.writeFileSync(path.join(output, "contrast.json"), JSON.stringify(contrast, null, 2));
    await screenshot("home-light-1366.png");
    await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
    assert.ok(await evaluate("document.querySelector('.next-panel').getBoundingClientRect().top < 300"));
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
    await screenshot("home-light-1024.png");
    await evaluate("SaveManager.setSetting('display','night');NindaApp.applyTheme();"); await screenshot("home-night-1024.png");
  });

  await test("semantic text palettes meet contrast requirements in both themes", async () => {
    const contrasts = await evaluate(`(()=>{
      const rgb=s=>s.match(/[0-9.]+/g).slice(0,3).map(Number);
      const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
      const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
      const pairs=[['body','tsuki','yoru'],['muted','muted','yoru'],['surface','tsuki','surface'],['surface-muted','muted','surface'],['paper','sumi','paper'],['paper-muted','paper-muted','paper'],['washi-muted','paper-muted','washi'],['paper-link','paper-link','paper'],['action','action-text','action-bg'],['rank-kin','rank-kin-text','rank-kin-bg'],['rank-kin-meta','rank-kin-muted','rank-kin-bg'],['rank-hakkin','rank-hakkin-text','rank-hakkin-bg'],['rank-hakkin-meta','rank-hakkin-muted','rank-hakkin-bg'],['rank-gekko','rank-gekko-text','rank-gekko-bg'],['rank-gekko-meta','rank-gekko-muted','rank-gekko-bg']];
      const probe=document.createElement('span');probe.hidden=true;document.body.appendChild(probe);const result=[];
      for(const theme of ['night','light']){document.body.dataset.theme=theme;for(const [name,foreground,background] of pairs){probe.style.color='var(--'+foreground+')';probe.style.background='var(--'+background+')';const css=getComputedStyle(probe),colors=css.backgroundImage==='none'?[css.backgroundColor]:(css.backgroundImage.match(/rgba?\\([^)]+\\)/g)||[]);result.push({theme,name,foreground:css.color,background:css.backgroundImage==='none'?css.backgroundColor:css.backgroundImage,ratio:Math.min(...colors.map(color=>ratio(rgb(css.color),rgb(color))))});}}
      probe.remove();NindaApp.applyTheme();return result;
    })()`);
    for (const item of contrasts) assert.ok(item.ratio >= (item.name === "paper" ? 7 : 4.5), JSON.stringify(item));
    fs.writeFileSync(path.join(output, "palette-contrast.json"), JSON.stringify(contrasts, null, 2));
  });

  await test("backup preview is non-destructive and explicit restore succeeds", async () => {
    await fresh("kyu5"); await evaluate("NindaApp.showScreen('S6');window.__backup=SaveManager.exportBackup();window.__original=JSON.stringify(SaveManager.ensure());CollectionRenderer.previewBackup(__backup);");
    assert.equal(await evaluate("JSON.stringify(SaveManager.ensure())===__original"), true);
    assert.equal(await evaluate("document.activeElement.dataset.modalAction"), "cancel");
    await evaluate("document.querySelector('[data-modal-action=restore]').click();");
    assert.equal(await evaluate("JSON.stringify(SaveManager.ensure())===__original"), true);
    assert.equal(await evaluate("document.getElementById('resultOverlay').hidden"), true);
    assert.equal(await evaluate("document.getElementById('versionLabel').textContent.endsWith('v1.10.0')"), true);
    await screenshot("settings-1024.png");
  });

  await test("complete three-part exam grants dan and result achievements once", async () => {
    await fresh("kyu1");
    await evaluate(`SaveManager.update(s=>{s.dan='genin';});SaveManager.markPracticed('genin');ExamManager.startDanExam('chunin');__key('a');`);
    await delay(1100); await keys("a."); await delay(180); await evaluate("__advance(60000)"); await delay(950);
    await keys("a."); await delay(180);
    assert.equal(await evaluate("SaveManager.ensure().dan"), "chunin");
    assert.equal(await evaluate("SaveManager.ensure().totals.correct"), 5);
    assert.equal(await evaluate("SaveManager.ensure().totals.words"), 3);
    for (const id of ["ippatsu", "kanzen", "seijaku", "kaigan"]) assert.equal(await evaluate(`SaveManager.ensure().nicknames.includes(${JSON.stringify(id)})`), true, id);
  });

  await test("banzuke score, Tier, collection, license and teacher no-write", async () => {
    await fresh("kyu1");
    await evaluate(`SaveManager.update(s=>{s.dan='genin';});MICHI_GENIN.items=[{kana:'あ'.repeat(140)}];ExamManager.startBanzukeCourse('michi-genin');`);
    await keys("a".repeat(100)); await evaluate("__advance(60000)");
    assert.equal(await evaluate("SaveManager.ensure().best.banzuke['michi-genin'].score"), 100);
    assert.equal(await evaluate("SaveManager.ensure().best.banzuke['michi-genin'].tier"), "月光");
    assert.equal(await evaluate("SaveManager.ensure().nicknames.includes('gekko')&&SaveManager.ensure().nicknames.includes('hyakuren')"), true);
    await evaluate("TrainingManager.stop(true);NindaApp.showScreen('S4');document.querySelector('[data-collection-tab=banzuke]').click();");
    assert.ok(await evaluate("document.getElementById('collectionMount').textContent.includes('月光にとうたつ')"));
    await evaluate("NindaApp.showScreen('S5');");
    assert.ok(await evaluate("document.getElementById('licenseMount').textContent.includes('月光')&&document.getElementById('printLicense').textContent.includes('月光')"));
    await evaluate("SaveManager.setSetting('teacherMode',true);window.__unchanged=JSON.stringify(SaveManager.ensure());ExamManager.startBanzukeCourse('michi-genin');");
    await keys("a".repeat(120)); await evaluate("__advance(60000)");
    assert.equal(await evaluate("JSON.stringify(SaveManager.ensure())===__unchanged"), true);
  });

  await test("combo restarts after miss, reduced-motion flight is disabled, grade rescue ends on correct hit", async () => {
    await fresh();
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await evaluate(`NindaApp.showScreen('S2');TrainingManager.startRunner({screen:'S2',stageId:'kyu9',items:[{text:'a'.repeat(40),kind:'in'}],guideLevel:0,mode:'training'});`);
    await keys("a".repeat(10)); await keys("x"); await keys("a".repeat(10));
    assert.equal(await evaluate("document.querySelectorAll('#comboFx .shuriken-hit').length"), 2);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.shuriken-hit')).animationName"), "none");
    await keys("xx"); assert.equal(await evaluate("!!document.querySelector('#guideMount .hand-guide')"), true);
    await keys("a"); assert.equal(await evaluate("document.getElementById('guideMount').innerHTML"), "");
    assert.equal(await evaluate("document.getElementById('romajiGuide').innerHTML"), "");
    await keys("xx"); await delay(3100); assert.equal(await evaluate("document.getElementById('guideMount').innerHTML"), "");
  });

  await test("long classical prompts keep current unit visible with ruby and source", async () => {
    await fresh("kyu1");
    await evaluate(`SaveManager.setSetting('teacherMode',true);const item=MICHI_KAGE.items.filter(x=>x.ruby).sort((a,b)=>b.kana.length-a.kana.length)[0];window.__long=item;NindaApp.showScreen('S2');TrainingManager.startRunner({screen:'S2',stageId:'jissen',items:[{text:item.kana,kind:'sentence',display:item.display,ruby:item.ruby,source:item.source}],guideLevel:1,mode:'jissen',seconds:120});`);
    await keys(await evaluate("InputEngine.preferredRomaji(__long.kana).slice(0,50)"));
    assert.ok(await evaluate("document.querySelectorAll('#promptKana ruby').length>0"));
    assert.equal(await evaluate("document.getElementById('promptFurigana').textContent"), await evaluate("__long.source"));
    assert.equal(await evaluate(`(()=>{const box=document.getElementById('promptKana').getBoundingClientRect(),current=document.querySelector('#promptKana .current').getBoundingClientRect();return current.top>=box.top&&current.bottom<=box.bottom&&current.bottom<innerHeight;})()`), true);
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
    await screenshot("long-ruby-1024.png");
  });

  await test("notebook tabs, review planning, mini drills and mastery keep grades free of speed", async () => {
    await fresh("kyu4");
    await evaluate(`SaveManager.markPracticed('kyu5');SaveManager.update(s=>{s.keyStats.a={attempts:20,misses:1,sumLatency:1,recent:[]};s.confusions={'f>j':3};});LearningManager.open('today');`);
    assert.ok(await evaluate("document.querySelector('[data-plan=review]')!==null"));
    await evaluate("document.querySelector('[data-learning-tab=keys]').click();");
    assert.ok(await evaluate("document.querySelector('#masteryMount [data-key=a]').textContent.includes('95%')"));
    assert.equal(await evaluate("/KPM|スコア|びょう/.test(document.getElementById('learningMount').textContent)"), false);
    await screenshot("mastery-1024.png");
    await evaluate("document.querySelector('[data-learning-tab=mini]').click();");
    assert.equal(await evaluate("document.querySelector('[data-drill=musubi]').disabled"), false);
    assert.equal(await evaluate("document.querySelector('[data-drill=bunshin]').disabled"), true);
    await evaluate("document.querySelector('[data-drill=pair]').click();");
    assert.equal(await evaluate("document.getElementById('S2').hidden"), false);
    assert.equal(await evaluate("/KPM|スコア/.test(document.getElementById('trainingStats').textContent)"), false);
    const prompt = await evaluate("document.querySelector('#promptKana .prompt-progress').textContent.replace(/\\s/g,'')");
    await keys(prompt); await delay(180);
    await evaluate("TrainingManager.checkpoint(true);TrainingManager.checkpoint(true);");
    assert.equal(await evaluate("SaveManager.ensure().unitStats[" + JSON.stringify(prompt[0]) + "].attempts"), prompt.split(prompt[0]).length - 1);
  });

  await test("lesson file preview rejects unreleased kana, import is explicit and completion cannot clear stages", async () => {
    await fresh("kyu5"); await evaluate("LearningManager.open('lessons');");
    const data = { format: "ninda-do-lesson", v: 1, title: "はなの巻", stageId: "kyu5", kind: "word", items: ["はな", "ねこ"], rights: "original-or-permitted" };
    const upload = async (lesson) => {
      await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(lesson))}],'lesson.json',{type:'application/json'}));const input=document.getElementById('lessonFile');input.files=transfer.files;input.dispatchEvent(new Event('change'));})()`);
      await delay(150);
    };
    await upload({ ...data, items: ["ゆき"] });
    assert.ok(await evaluate("document.getElementById('lessonMessage').textContent.includes('ならっていない')"));
    assert.equal(await evaluate("SaveManager.ensure().learning.lessonPack"), null);
    await upload(data);
    assert.equal(await evaluate("SaveManager.ensure().learning.lessonPack"), null);
    assert.equal(await evaluate("document.activeElement.id"), "lessonCancel");
    await evaluate("document.getElementById('lessonAccept').click();document.getElementById('lessonStart').click();");
    await keys("hana"); await delay(180); await keys("neko"); await delay(180);
    assert.equal(await evaluate("SaveManager.ensure().learning.completedLessons.length"), 1);
    assert.deepEqual(await evaluate("SaveManager.ensure().clearedStages"), []);
    assert.deepEqual(await evaluate("SaveManager.ensure().practicedStages"), []);
    assert.equal(await evaluate("!!document.querySelector('.result-speed')"), false);
  });

  await test("courier moves visibly, waits without skipping, counts deliveries and saves weighted score", async () => {
    await fresh("kyu1");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await evaluate("DAN_WORDS.words=__danPool.slice();SaveManager.update(s=>{s.dan='genin';});NindaApp.openJissenMenu();");
    await evaluate("document.querySelector('[data-menu-card=courier]').click();");
    assert.equal(await evaluate("document.querySelector('[data-menu-card=yama-bin]').getAttribute('aria-disabled')"), "true");
    await evaluate("document.querySelector('[data-menu-card=sato-bin]').click();");
    const before = await evaluate("document.getElementById('courierRunner').getAttribute('transform')");
    await evaluate("__advance(1000)");
    assert.notEqual(await evaluate("document.getElementById('courierRunner').getAttribute('transform')"), before);
    const prompt = await evaluate("document.querySelector('#promptKana .prompt-progress').textContent.replace(/\\s/g,'')");
    const correctKeys = await evaluate(`InputEngine.preferredRomaji(${JSON.stringify(prompt)})`);
    const wrong = correctKeys[0] === "z" ? "q" : "z";
    await keys(wrong + wrong); await evaluate("__advance(20000)");
    assert.equal(await evaluate("document.querySelector('#promptKana .prompt-progress').textContent.replace(/\\s/g,'')"), prompt);
    assert.ok(await evaluate("document.getElementById('courierStatus').textContent.includes('まっています')"));
    await keys(correctKeys); await delay(180);
    assert.ok(await evaluate("document.getElementById('courierDelivered').textContent.endsWith('1')"));
    await screenshot("courier-night-1024.png");
    await evaluate("__advance(60000)");
    assert.equal(await evaluate("SaveManager.ensure().best.courier['sato-bin'].score"), Math.round(10 * correctKeys.length / (correctKeys.length + 2)));
    assert.equal(await evaluate("SaveManager.ensure().learning.counters.delivered"), 1);
    assert.equal(await evaluate("document.getElementById('resultOverlay').hidden"), false);
  });

  await test("courier teacher demos and both motion settings never change child progress", async () => {
    await fresh("kyu1");
    await evaluate("DAN_WORDS.words=__danPool.slice();SaveManager.setSetting('teacherMode',true);SaveManager.setSetting('reduceMotion',true);NindaApp.applyTheme();window.__teacherBefore=JSON.stringify(SaveManager.ensure());NinjaGameManager.start('tsuki-bin');");
    const position = await evaluate("document.getElementById('courierRunner').getAttribute('transform')");
    await evaluate("__advance(1000)");
    assert.equal(await evaluate("document.getElementById('courierRunner').getAttribute('transform')"), position);
    await keys(await evaluate("InputEngine.preferredRomaji(document.querySelector('#promptKana .prompt-progress').textContent.replace(/\\s/g,''))")); await delay(180);
    await evaluate("__advance(90000)");
    assert.equal(await evaluate("JSON.stringify(SaveManager.ensure())===__teacherBefore"), true);
    await evaluate("TrainingManager.stop(false);SaveManager.setSetting('reduceMotion',false);NindaApp.applyTheme();");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await evaluate("NinjaGameManager.start('sato-bin');");
    const systemPosition = await evaluate("document.getElementById('courierRunner').getAttribute('transform')");
    await evaluate("__advance(1000)");
    assert.equal(await evaluate("document.getElementById('courierRunner').getAttribute('transform')"), systemPosition);
    await evaluate("TrainingManager.stop(false);TrainingManager.start('kyu5',1);");
    assert.equal(await evaluate("document.getElementById('courierMount').innerHTML"), "");
    assert.equal(await evaluate("/KPM|荷物点/.test(document.getElementById('trainingStats').textContent)"), false);
  });

  await test("reading notebook uses unchanged ruby/source; large text and themes fit both target widths", async () => {
    await fresh("kyu1");
    await evaluate(`SaveManager.setSetting('teacherMode',true);SaveManager.setSetting('textSize','large');SaveManager.setSetting('lineSpacing','wide');SaveManager.setSetting('fingerSymbols',true);LearningManager.open('reading');`);
    assert.equal(await evaluate("document.querySelectorAll('.reading-entry').length"), 36);
    assert.ok(await evaluate("document.querySelector('.reading-entry ruby')!==null"));
    for (const width of [1366, 1024]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 768, deviceScaleFactor: 1, mobile: false });
      for (const theme of ["night", "light"]) {
        await evaluate(`SaveManager.setSetting('display',${JSON.stringify(theme)});NindaApp.applyTheme();NinjaGameManager.start('sato-bin');`);
        const colors = await evaluate("({body:getComputedStyle(document.body).color,variable:getComputedStyle(document.body).getPropertyValue('--tsuki'),header:getComputedStyle(document.getElementById('trainingTitle')).color,hud:getComputedStyle(document.getElementById('courierScore')).color,theme:document.body.dataset.theme,style:document.body.getAttribute('style')})");
        assert.equal(colors.header, theme === "light" ? "rgb(42, 38, 34)" : "rgb(236, 231, 216)", JSON.stringify(colors));
        assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
        assert.ok(await evaluate("document.getElementById('courierMount').getBoundingClientRect().height>150"));
        assert.equal(await evaluate("document.querySelector('#promptKana .current').getBoundingClientRect().bottom<innerHeight"), true);
        await screenshot(`courier-${theme}-large-${width}.png`);
        await evaluate("TrainingManager.stop(false);LearningManager.open('keys');");
        assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
        assert.ok(await evaluate("document.querySelector('#masteryMount .finger-symbol')!==null"));
      }
    }
    await evaluate("LearningManager.open('missions');"); await screenshot("missions-light-1024.png");
  });

  await test("teacher lesson export is ephemeral; readability settings persist on reload", async () => {
    await fresh("kyu5");
    await evaluate(`SaveManager.setSetting('teacherMode',true);LearningManager.open('lessons');window.__lessonBefore=JSON.stringify(SaveManager.ensure());document.getElementById('lessonTitle').value='はなの巻';document.getElementById('lessonStage').value='kyu5';document.getElementById('lessonStage').dispatchEvent(new Event('change'));document.getElementById('lessonKind').value='word';document.getElementById('lessonItems').value='はな\\nねこ';document.getElementById('lessonRights').checked=true;window.__createUrl=URL.createObjectURL;URL.createObjectURL=blob=>{window.__exportedLesson=blob;return __createUrl(blob);};window.__anchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};document.getElementById('lessonForm').requestSubmit();URL.createObjectURL=__createUrl;HTMLAnchorElement.prototype.click=__anchorClick;`);
    const lesson = JSON.parse(await evaluate("__exportedLesson.text()"));
    assert.deepEqual(lesson.items, ["はな", "ねこ"]); assert.equal(lesson.stageId, "kyu5");
    assert.equal(await evaluate("JSON.stringify(SaveManager.ensure())===__lessonBefore"), true);
    await evaluate("NindaApp.showScreen('S6');document.querySelector('[data-readability=textSize]').click();document.querySelector('[data-readability=lineSpacing]').click();document.querySelector('[data-readability=fingerSymbols]').click();document.querySelector('[data-readability=reduceMotion]').click();");
    await send("Page.reload"); await delay(150); await ready();
    assert.equal(await evaluate("document.body.dataset.textSize"), "large");
    assert.equal(await evaluate("document.body.dataset.lineSpacing"), "wide");
    assert.equal(await evaluate("SaveManager.ensure().settings.fingerSymbols"), true);
    assert.equal(await evaluate("document.body.dataset.reduceMotion"), "true");
  });

  await test("observation rubric remains ephemeral and prints one page", async () => {
    await fresh("kyu5");
    await evaluate(`NindaApp.showScreen('S6');window.__beforeObservation=JSON.stringify(SaveManager.ensure());document.querySelector('.observation-tools').open=true;document.querySelector('[data-observation=home]').click();window.__nativePrint=window.print;window.print=()=>window.__rubric=document.getElementById('printLicense').innerHTML;document.getElementById('printObservationButton').click();window.print=__nativePrint;`);
    assert.equal(await evaluate("JSON.stringify(SaveManager.ensure())===__beforeObservation"), true);
    assert.ok(await evaluate("__rubric.includes('☑')&&__rubric.includes('先生のメモ')"));
    await evaluate("document.getElementById('printLicense').innerHTML=__rubric;");
    const rubric = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    const bytes = Buffer.from(rubric.data, "base64");fs.writeFileSync(path.join(output,"observation.pdf"),bytes);
    assert.equal((bytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length, 1);
    await evaluate("NindaApp.showScreen('S5');");
  });

  await test("license and poster stay one A4 page", async () => {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await evaluate("NindaApp.showScreen('S5');");
    const license = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    const licenseBytes = Buffer.from(license.data, "base64"); fs.writeFileSync(path.join(output, "license.pdf"), licenseBytes);
    assert.equal((licenseBytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length, 1);
    await send("Page.navigate", { url: pathToFileURL(path.join(root, "poster.html")).href }); await delay(100); await ready("GuideRenderer");
    const poster = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    const posterBytes = Buffer.from(poster.data, "base64"); fs.writeFileSync(path.join(output, "poster.pdf"), posterBytes);
    assert.equal((posterBytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length, 1);
  });

  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(network.filter((url) => /^https?:/.test(url)).length, 0);
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ tests: count, errors, network }, null, 2));
  console.log(`OK browser regressions: ${count} tests; artifacts: ${output}`);
  await send("Browser.close");
} finally { if (ws) ws.close(); browser.kill(); }
