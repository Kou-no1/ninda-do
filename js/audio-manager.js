const AudioManager = globalThis.AudioManager = (function () {
  "use strict";

  let ctx = null;
  let ready = false;

  function init() {
    if (ready) return;
    ready = true;
    const resume = () => {
      if (!ctx && (window.AudioContext || window.webkitAudioContext)) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx && ctx.state === "suspended") ctx.resume();
    };
    document.addEventListener("keydown", resume, { once: true });
    document.addEventListener("pointerdown", resume, { once: true });
  }

  function enabled(kind) {
    const save = SaveManager.load();
    if (!save) return true;
    return kind === "voice" ? save.settings.voice : save.settings.se;
  }

  function tone(freq, duration, type, gainValue, delay) {
    if (!enabled("se")) return;
    if (!ctx) return;
    const start = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(gainValue || 0.035, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function correct() { tone(740, 0.06, "triangle", 0.025); }
  function miss() { tone(150, 0.12, "square", 0.018); }
  function pass() { [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.12, "triangle", 0.03, i * 0.08)); }
  function rankUp() {
    tone(100, 0.12, "sine", 0.045, 0);
    tone(120, 0.12, "sine", 0.045, 0.18);
    [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.16, "triangle", 0.03, 0.32 + i * 0.09));
  }

  function speak(text) {
    if (!enabled("voice") || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = "ja-JP";
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return { init, correct, miss, pass, rankUp, speak };
})();
