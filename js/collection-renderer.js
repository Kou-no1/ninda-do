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
    if (activeTab === "nicknames") {
      mount.innerHTML = NICKNAME_DATA.map((item) => {
        const owned = save.nicknames.includes(item.id);
        const equipped = save.equippedNickname === item.id;
        return `<article class="collection-card ${owned ? "" : "locked"}">
          <h2>${item.name}</h2><p>${item.desc}</p>
          ${owned ? `<button data-equip="${item.id}" ${equipped ? "disabled" : ""}>${equipped ? "装着中" : "装着する"}</button>` : "<p>まだ手に入れていない</p>"}
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
      return `<article class="collection-card ${owned ? "" : "locked"}">
        <div>${SVG_ICONS.scroll(item.id, !owned)}</div>
        <h2>${item.name}</h2><p>${owned ? item.desc : "まだ手に入れていない"}</p>
      </article>`;
    }).join("");
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
