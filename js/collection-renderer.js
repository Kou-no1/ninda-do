const CollectionRenderer = globalThis.CollectionRenderer = (function () {
  "use strict";

  let activeTab = "scrolls";

  function initTabs() {
    document.querySelectorAll("[data-collection-tab]").forEach((button) => {
      button.addEventListener("click", () => render(button.dataset.collectionTab));
    });
  }

  function render(tab) {
    activeTab = tab || activeTab;
    document.querySelectorAll("[data-collection-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.collectionTab === activeTab);
    });
    const mount = document.getElementById("collectionMount");
    const save = SaveManager.ensure();
    if (!mount) return;
    mount.className = `collection-grid ${activeTab === "nicknames" ? "nickname-grid" : "scroll-grid"}`;
    if (activeTab === "nicknames") {
      mount.innerHTML = NICKNAME_DATA.map((item) => {
        const owned = save.nicknames.includes(item.id);
        const equipped = save.equippedNickname === item.id;
        return `<article class="nickname-card ${owned ? "owned" : "locked"} ${equipped ? "equipped" : ""}">
          ${owned
            ? `<button type="button" class="tanzaku" data-equip="${item.id}" ${equipped ? "disabled" : ""}>
                <span class="tanzaku-hole" aria-hidden="true"></span>
                ${equipped ? `<span class="tanzaku-lantern">${SVG_ICONS.lantern()}</span>` : ""}
                <span class="tanzaku-name">${escapeHtml(item.name)}</span>
              </button>`
            : `<div class="tanzaku locked-silhouette">
                <span class="tanzaku-hole" aria-hidden="true"></span>
                <span class="mystery-mark">?</span>
              </div>`}
          <p class="tanzaku-caption">${escapeHtml(item.desc)}</p>
        </article>`;
      }).join("");
      mount.querySelectorAll("[data-equip]").forEach((button) => {
        button.addEventListener("click", () => {
          SaveManager.setEquippedNickname(button.dataset.equip);
          render("nicknames");
          renderLicense();
        });
      });
      return;
    }
    mount.innerHTML = JUTSU_DATA.map((item) => {
      const owned = save.scrolls.includes(item.id);
      return `<article class="scroll-card ${owned ? "owned" : "locked"} ${scrollCordClass(item)}" data-jutsu-id="${escapeHtml(item.id)}" tabindex="0">
        <span class="scroll-cord" aria-hidden="true"></span>
        ${owned
          ? `<div class="open-scroll">
              <div class="scroll-roll left" aria-hidden="true"></div>
              <div class="scroll-body">
                <div class="crest-medallion">${SVG_ICONS.crest(item.crest || item.id)}</div>
                <h2>${escapeHtml(item.name)}</h2>
                <p>${escapeHtml(item.desc)}</p>
              </div>
              <div class="scroll-roll right" aria-hidden="true"></div>
            </div>`
          : `<div class="closed-scroll">
              ${SVG_ICONS.closedScroll()}
              <p class="unlock-source">${escapeHtml(unlockSource(item.id))}</p>
            </div>`}
      </article>`;
    }).join("");
  }

  function scrollCordClass(item) {
    return item.kind === "maki" || item.id === "shippu" ? "gold-cord" : "ai-cord";
  }

  function unlockSource(jutsuId) {
    if (jutsuId === "shippu") return "免許皆伝で修得できる";
    const stage = CURRICULUM_DATA.stages.find((item) => (item.jutsu || []).includes(jutsuId));
    if (!stage) return "修行で修得できる";
    return `${stage.label}「${stage.title}」で修得できる`;
  }

  function renderLicense() {
    const mount = document.getElementById("licenseMount");
    if (!mount) return;
    const save = SaveManager.ensure();
    const nickname = NICKNAME_DATA.find((item) => item.id === save.equippedNickname);
    const dan = RANK_DATA.dans.find((item) => item.id === save.dan);
    const stage = CURRICULUM_DATA.stages.find((item) => item.id === save.currentStage);
    const rank = dan ? dan.label : stage ? stage.label : "入門";
    mount.innerHTML = `<div class="license-head">${SVG_ICONS.ninja()}<div><p class="eyebrow">忍者免状</p><h2>${escapeHtml(save.name)}</h2></div></div>
      <dl class="license-list">
        <dt>二つ名</dt><dd>${nickname ? nickname.name : "なし"}</dd>
        <dt>段位</dt><dd>${rank}</dd>
        <dt>累計正打</dt><dd>${save.totals.correct}</dd>
        <dt>累計ミス</dt><dd>${save.totals.miss}</dd>
        <dt>最高気配</dt><dd>${save.best.rhythm || "—"}</dd>
        <dt>最高KPM</dt><dd>${save.best.kpm || 0}</dd>
      </dl>
      <div class="passcode-box">
        <button id="makePasscode">合言葉コードを出す</button>
        <output id="passcodeOutput"></output>
        <p class="hint">うちこみの記録はもどらないよ。</p>
      </div>`;
    document.getElementById("makePasscode").addEventListener("click", () => {
      document.getElementById("passcodeOutput").textContent = SaveManager.exportCode();
    });
  }

  function renderSettings() {
    const mount = document.getElementById("settingsMount");
    if (!mount) return;
    const save = SaveManager.ensure();
    const code = SaveManager.exportCode(save);
    mount.innerHTML = `<label class="setting-row"><input type="checkbox" id="seSetting" ${save.settings.se ? "checked" : ""}> 効果音をならす</label>
      <label class="setting-row"><input type="checkbox" id="voiceSetting" ${save.settings.voice ? "checked" : ""}> 入門で読み上げる</label>
      <div class="restore-box">
        <label for="restoreCode">合言葉コードで復元</label>
        <textarea id="restoreCode" rows="3" placeholder="かきのはす-..."></textarea>
        <button id="restoreButton">復元する</button>
        <p id="restoreMessage" class="hint"></p>
      </div>
      <div class="danger-zone">
        <h2>さとをさる</h2>
        <p class="hint">消す前の合言葉: <code>${code}</code></p>
        <button id="deleteStep1">データ削除へ</button>
        <button id="deleteStep2" hidden>ほんとうに削除する</button>
      </div>`;
    document.getElementById("seSetting").addEventListener("change", (event) => SaveManager.setSetting("se", event.target.checked));
    document.getElementById("voiceSetting").addEventListener("change", (event) => SaveManager.setSetting("voice", event.target.checked));
    document.getElementById("restoreButton").addEventListener("click", () => {
      const message = document.getElementById("restoreMessage");
      try {
        SaveManager.restoreCode(document.getElementById("restoreCode").value);
        message.textContent = "復元したよ。";
        if (globalThis.NindaApp) NindaApp.renderHome();
      } catch (error) {
        message.textContent = error.message || "あいことばが ちがうみたい";
      }
    });
    document.getElementById("deleteStep1").addEventListener("click", () => {
      document.getElementById("deleteStep2").hidden = false;
    });
    document.getElementById("deleteStep2").addEventListener("click", () => {
      SaveManager.reset();
      if (globalThis.NindaApp) NindaApp.showScreen("S0");
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  document.addEventListener("DOMContentLoaded", initTabs);

  return {
    render,
    renderLicense,
    renderSettings
  };
})();
