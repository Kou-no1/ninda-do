import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

// Used by the existing Chrome harness; no server or tooling is shipped to the classroom.
export async function checkPwa({root, send, evaluate, delay}) {
  const prefix = "/class/ninda-do/";
  const mime = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css",
    ".webmanifest":"application/manifest+json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png"};
  let release, breakInstall = false, refused = 0, serverOffline = false, offlineRequests = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    res.setHeader("Cache-Control", "no-store");
    if (serverOffline) { offlineRequests++; res.writeHead(503).end(); return; }
    if (url.pathname === "/outside") { res.writeHead(200, {"Content-Type":"text/html"}).end("<title>outside</title>"); return; }
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const file = url.pathname.slice(prefix.length) || "index.html";
    if (!/^(?:(?:data\/words\/|js\/|data\/|icons\/)?[a-z0-9-]+\.(?:html|css|js|png|svg|webmanifest))$/.test(file)) {
      res.writeHead(404).end(); return;
    }
    if (breakInstall && file === "poster.html") { refused++; res.writeHead(503).end(); return; }
    try {
      let bytes = await fs.readFile(path.join(root, file));
      if (release && file === "sw.js") bytes = bytes.toString().replace(/const RELEASE = "[^"]+";/, `const RELEASE = "${release}";`);
      res.writeHead(200, {"Content-Type":mime[path.extname(file)]}).end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = "http://127.0.0.1:" + server.address().port, base = origin + prefix;
  async function until(expression) {
    const end = Date.now() + 30000;
    do { if (await evaluate(expression)) return; await delay(100); } while (Date.now() < end);
    throw new Error("PWA timeout: " + expression);
  }
  async function visit(url) {
    await send("Page.navigate", {url});
    await until(`location.href === ${JSON.stringify(url)} && document.readyState === "complete"`);
  }
  try {
    await visit(base);
    await until("!!navigator.serviceWorker.controller");
    const report = await send("Page.getAppManifest");
    assert.deepEqual(report.errors, []);
    assert.equal(report.url, base + "manifest.webmanifest");
    const manifest = JSON.parse(report.data);
    assert.equal(manifest.name, "忍打道 —NINDA DO—"); assert.equal(manifest.display, "standalone");
    for (const key of ["scope","id","start_url"]) assert.equal(new URL(manifest[key], report.url).href, base);
    assert.deepEqual((await send("Page.getInstallabilityErrors")).installabilityErrors, []);
    for (const size of [180,192,512]) {
      assert.deepEqual(await evaluate(`(async()=>{const img=new Image();img.src='icons/ninda-${size}.png';await img.decode();return [img.naturalWidth,img.naturalHeight];})()`), [size,size]);
    }
    const scopeKey = "ninda-do:shell:" + encodeURIComponent(prefix) + ":";
    const version = await evaluate("APP_VERSION");
    const cachePaths = await evaluate(`(async()=> (await (await caches.open(${JSON.stringify(scopeKey + version)})).keys()).map(r=>r.url))()`);
    const expected = await evaluate("Array.from(document.querySelectorAll('script[src],link[rel=stylesheet],link[rel=manifest],link[rel=icon],link[rel=apple-touch-icon]'),el=>el.src||el.href)");
    for (const url of [...expected,base+"index.html",base+"poster.html",...manifest.icons.map(i=>base+i.src)]) assert.ok(cachePaths.includes(url), url);
    assert.ok(cachePaths.every(url => url.startsWith(base)));
    await evaluate("caches.open('other-class-app')");
    await evaluate("document.getElementById('ninjaName').value='びん';document.getElementById('startKyu10').click();NindaApp.showScreen('S6');");
    await until("document.querySelector('#pwaSettings [role=status]').textContent.includes(UI_TEXT.pwa.ready)");
    await evaluate(`(() => {const offer=new Event("beforeinstallprompt",{cancelable:true});window.promptCalls=0;
      offer.prompt=async()=>{window.promptCalls++};offer.userChoice=Promise.resolve({outcome:"dismissed"});
      window.dispatchEvent(offer);document.querySelector("#pwaSettings [data-install]").click();})()`);
    await until("window.promptCalls === 1 && document.querySelector('#pwaSettings [data-install]').hidden");
    const save = await evaluate("localStorage.getItem('nindaDoSaveV1')");
    assert.ok(save);
    // A bad release cannot replace a working classroom installation.
    release = "failed-fixture"; breakInstall = true;
    await evaluate("(async()=>{const r=await navigator.serviceWorker.ready;await r.update();})()");
    await until("(async()=>{const r=await navigator.serviceWorker.ready;return !r.installing && !r.waiting;})()");
    assert.ok(refused > 0);
    assert.ok((await evaluate("caches.keys()")).includes(scopeKey + version));
    await evaluate("NindaApp.showScreen('S2');TrainingManager.startRunner({screen:'S2',stageId:'kyu10',title:'印',items:[{text:'fj',kind:'in'}],guideLevel:3,mode:'training'});__key('f');");
    breakInstall = false; release = "next-fixture";
    await evaluate("(async()=>{window.previousWorker=navigator.serviceWorker.controller;await (await navigator.serviceWorker.ready).update();})()");
    await until("(async()=>!!(await navigator.serviceWorker.ready).waiting)()");
    await until("document.querySelector('#pwaSettings [role=status]').textContent.includes(UI_TEXT.pwa.update)");
    assert.ok(await evaluate("navigator.serviceWorker.controller === previousWorker"));
    assert.equal(await evaluate("localStorage.getItem('nindaDoSaveV1')"), save);
    assert.equal(await evaluate("document.querySelector('#guideMount .key.next').dataset.key"), "j");
    await evaluate("__key('j')");
    await until("!document.getElementById('resultOverlay').hidden");
    const beforeOffline = await evaluate("SaveManager.ensure().totals.correct");
    await visit(origin + "/outside");
    await until(`(async()=>{const keys=await caches.keys();return !keys.includes(${JSON.stringify(scopeKey+version)}) && keys.includes(${JSON.stringify(scopeKey+release)});})()`);
    assert.ok((await evaluate("caches.keys()")).includes("other-class-app"));
    serverOffline = true;
    await send("Network.emulateNetworkConditions", {offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
    await visit(base+"?from=home");
    assert.equal(await evaluate("SaveManager.ensure().name"), "びん");
    await evaluate("NindaApp.showScreen('S2');TrainingManager.startRunner({screen:'S2',stageId:'kyu10',title:'印',items:[{text:'fj',kind:'in'}],guideLevel:3,mode:'training'});__key('f');__key('j');");
    await until("!document.getElementById('resultOverlay').hidden");
    const total = await evaluate("SaveManager.ensure().totals.correct");
    assert.equal(total, beforeOffline + 2);
    await visit(base+"poster.html?print");
    assert.ok(await evaluate("document.querySelectorAll('.poster-key').length >= 26"));
    await visit(base+"index.html");
    assert.equal(await evaluate("SaveManager.ensure().totals.correct"), total);
    assert.equal(offlineRequests, 0);
  } finally {
    await send("Network.emulateNetworkConditions", {offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
