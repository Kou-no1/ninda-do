const PwaManager = (() => {
  const web = ["https:", "http:"].includes(globalThis.location?.protocol);
  const supported = web && window.isSecureContext && "serviceWorker" in navigator;
  const standalone = supported ? matchMedia("(display-mode: standalone)") : null;
  let registration, deferredPrompt, installed = false, prompting = false;
  let status = "preparing";

  function paint() {
    const panel = document.getElementById("pwaSettings");
    if (!panel || !supported) return;
    panel.hidden = false;
    const text = UI_TEXT.pwa;
    const message = panel.querySelector("[role=status]");
    const isApp = installed || standalone.matches || navigator.standalone === true;
    const next = text[status] + (isApp ? " " + text.installed : "");
    if (message.textContent !== next) message.textContent = next;
    panel.querySelector("[data-install]").hidden = isApp || !deferredPrompt;
    panel.querySelector("[data-install]").disabled = prompting;
    panel.querySelector("[data-retry]").hidden = status !== "failed";
    panel.querySelector("[data-manual]").hidden = isApp || !!deferredPrompt;
  }
  function track(reg) {
    registration = reg;
    function sync() {
      if (registration !== reg) return;
      status = reg.waiting && reg.active ? "update" : reg.active?.state === "activated" ? "ready"
        : !reg.installing && !reg.active && !reg.waiting ? "failed" : "preparing";
      paint();
    }
    function watch(worker) {
      if (worker) worker.addEventListener("statechange", sync);
    }
    watch(reg.installing); watch(reg.waiting); watch(reg.active);
    reg.addEventListener("updatefound", () => { watch(reg.installing); sync(); });
    sync();
  }
  async function register() {
    status = "preparing"; paint();
    try {
      const reg = await navigator.serviceWorker.register("./sw.js", {scope: "./", updateViaCache: "none"});
      if (reg !== registration) track(reg);
      else await reg.update();
    } catch { status = registration?.active ? "ready" : "failed"; paint(); }
  }
  async function install() {
    if (!deferredPrompt || prompting) return;
    const prompt = deferredPrompt;
    prompting = true; paint();
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { /* The browser can withdraw an installation offer. Keep its menu available. */ }
    finally { if (deferredPrompt === prompt) deferredPrompt = null; prompting = false; paint(); }
  }
  function bind() {
    if (!supported) return;
    const panel = document.getElementById("pwaSettings");
    panel.querySelector("[data-install]").onclick = install;
    panel.querySelector("[data-retry]").onclick = register;
    paint();
  }
  if (web) {
    const link = document.createElement("link");
    link.rel = "manifest"; link.href = "./manifest.webmanifest"; document.head.append(link);
  }
  if (supported) {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault(); deferredPrompt = event; paint();
    });
    window.addEventListener("appinstalled", () => { installed = true; deferredPrompt = null; paint(); });
    standalone.addEventListener?.("change", paint);
    window.addEventListener("load", register, {once: true});
  }
  return {bind};
})();
