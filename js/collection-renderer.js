const CollectionRenderer = globalThis.CollectionRenderer = (function () {
  "use strict";

  let activeTab = "scrolls";
  let versionTapCount = 0;
  let versionTapTimer = null;
  let teacherFailCount = 0;
  const observations = new Set();

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
    const teacher = SaveManager.isTeacherMode && SaveManager.isTeacherMode();
    if (!mount) return;
    mount.className = `collection-grid ${activeTab === "nicknames" ? "nickname-grid" : activeTab === "banzuke" ? "banzuke-grid" : "scroll-grid"}`;
    if (activeTab === "banzuke") {
      renderBanzuke(mount, save, teacher);
      return;
    }
    if (activeTab === "nicknames") {
      mount.innerHTML = NICKNAME_DATA.map((item) => {
        const owned = save.nicknames.includes(item.id);
        const preview = teacher && !owned;
        const equipped = save.equippedNickname === item.id;
        return `<article class="nickname-card ${owned ? "owned" : "locked"} ${preview ? "preview" : ""} ${equipped ? "equipped" : ""}">
          ${preview ? `<span class="preview-label">プレビュー</span>` : ""}
          ${owned
            ? `<button type="button" class="tanzaku" data-equip="${item.id}" ${equipped ? "disabled" : ""}>
                <span class="tanzaku-hole" aria-hidden="true"></span>
                ${equipped ? `<span class="tanzaku-lantern">${SVG_ICONS.lantern()}</span>` : ""}
                <span class="tanzaku-name">${escapeHtml(item.name)}</span>
              </button>`
            : preview
            ? `<div class="tanzaku">
                <span class="tanzaku-hole" aria-hidden="true"></span>
                <span class="tanzaku-name">${escapeHtml(item.name)}</span>
              </div>`
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
      const preview = teacher && !owned;
      return `<article class="scroll-card ${owned ? "owned" : "locked"} ${preview ? "preview" : ""} ${scrollCordClass(item)}" data-jutsu-id="${escapeHtml(item.id)}" tabindex="0">
        <span class="scroll-cord" aria-hidden="true"></span>
        ${preview ? `<span class="preview-label">プレビュー</span>` : ""}
        ${owned || preview
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

  function renderBanzuke(mount, save, teacher) {
    const records = save.best && save.best.banzuke || {};
    const currentDanIndex = SaveManager.DAN_ORDER.indexOf(save.dan || "none");
    mount.innerHTML = RANK_DATA.banzuke.courses.map((course) => {
      const requiredIndex = SaveManager.DAN_ORDER.indexOf(course.dan);
      const unlocked = teacher || currentDanIndex >= requiredIndex;
      const record = records[course.id] || null;
      const tier = record && record.tier || "無位";
      const tierClassName = tierClass(tier);
      if (!unlocked) {
        return `<article class="banzuke-record-card locked">
          <div class="banzuke-record-main">
            <h2>${escapeHtml(course.label)}</h2>
            <p>${escapeHtml(course.desc)}</p>
            <p class="banzuke-lock-reason">${SVG_ICONS.lock()} ${escapeHtml(requiredDanLabel(course.dan))}に昇段するとひらく</p>
          </div>
          <div class="banzuke-tier tier-none"><span class="tier-badge">${SVG_ICONS.tierBadge()}</span><strong>未解放</strong></div>
        </article>`;
      }
      const recordLine = record
        ? `じこベスト <strong>${numberText(record.score)}</strong> ／ ${escapeHtml(formatRecordDate(record.date))}`
        : UI_TEXT.noBanzukeRecord;
      return `<article class="banzuke-record-card ${record ? "recorded" : "untried"}">
        <div class="banzuke-record-main">
          <h2>${escapeHtml(course.label)}</h2>
          <p>${escapeHtml(course.desc)}</p>
          <p class="banzuke-best-line">${recordLine}</p>
          <p class="banzuke-next-tier">${escapeHtml(nextTierText(course.id, record))}</p>
        </div>
        <div class="banzuke-tier ${tierClassName}">
          <span class="tier-badge">${SVG_ICONS.tierBadge()}</span>
          <strong>${record ? escapeHtml(tier) : UI_TEXT.noBanzukeRecord}</strong>
        </div>
      </article>`;
    }).join("");
  }

  function nextTierText(courseId, record) {
    const tierOrder = RANK_DATA.banzuke.tierOrder.slice(1);
    if (record && record.tier === tierOrder[tierOrder.length - 1]) return "月光にとうたつ";
    const currentIndex = record ? tierOrder.indexOf(record.tier) : -1;
    const nextTier = tierOrder[Math.max(0, currentIndex + 1)];
    const target = RANK_DATA.banzuke.tiers[courseId][nextTier];
    const gap = Math.max(0, target - Number(record && record.score || 0));
    return `あと ${gap}てんで ${nextTier}`;
  }

  function requiredDanLabel(danId) {
    const dan = RANK_DATA.dans.find((item) => item.id === danId);
    return dan ? dan.label : danId;
  }

  function formatRecordDate(value) {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(value || ""));
    return match ? `${Number(match[1])}/${Number(match[2])}/${Number(match[3])}` : String(value || "");
  }

  function tierClass(tier) {
    return { "銅": "tier-copper", "銀": "tier-silver", "金": "tier-gold", "白金": "tier-platinum", "月光": "tier-gekko" }[tier] || "tier-none";
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
    const rank = rankLabel(save);
    const canShowSpeed = save.dan && save.dan !== "none";
    const banzuke = bestBanzukeLabel(save);
    mount.innerHTML = `<div class="license-head">${SVG_ICONS.ninja()}<div><p class="eyebrow">忍者免状</p><h2>${escapeHtml(save.name)}</h2></div></div>
      <dl class="license-list">
        <dt>二つ名</dt><dd>${nickname ? nickname.name : "なし"}</dd>
        <dt>段位</dt><dd>${rank}</dd>
        <dt>累計正打</dt><dd>${save.totals.correct}</dd>
        <dt>累計ミス</dt><dd>${save.totals.miss}</dd>
        <dt>最高気配</dt><dd>${save.best.rhythm || "—"}</dd>
        <dt>最大連撃</dt><dd>${save.best.combo || 0}</dd>
        <dt>疾風番付 最高位</dt><dd>${escapeHtml(banzuke)}</dd>
        ${canShowSpeed ? `<dt>最高KPM</dt><dd>${save.best.kpm || 0}</dd>` : ""}
      </dl>
      <div class="button-row license-actions">
        <button type="button" id="printLicenseButton">めんじょうを いんさつする</button>
      </div>
      <div class="passcode-box">
        <button id="makePasscode">合言葉コードを出す</button>
        <output id="passcodeOutput"></output>
        <p class="hint">うちこみの記録はもどらないよ。</p>
      </div>
      ${growthRecordsHtml(save)}`;
    renderPrintLicense(save);
    document.getElementById("printLicenseButton").addEventListener("click", () => {
      document.getElementById("printLicense").removeAttribute("data-print-mode");
      renderPrintLicense(SaveManager.ensure());
      window.print();
    });
    document.getElementById("makePasscode").addEventListener("click", () => {
      document.getElementById("passcodeOutput").textContent = SaveManager.exportCode();
    });
  }

  function growthRecordsHtml(save) {
    const entries = save.eventLog.filter((entry) => entry.type === "session_end" && entry.completed).slice(-8).reverse();
    const text = UI_TEXT.growth;
    return `<section class="growth-records"><h2>${escapeHtml(text.title)}</h2>${entries.length
      ? `<div class="table-scroll"><table><thead><tr>${[text.date, text.stage, text.accuracy, text.rhythm, text.combo].map((label) => `<th scope="col">${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>
        ${entries.map((entry) => {
          const stage = CURRICULUM_DATA.stages.find((item) => item.id === entry.id);
          const course = RANK_DATA.banzuke.courses.find((item) => item.id === entry.id);
          const label = stage ? stage.label : course ? course.label : entry.id && entry.id.includes(":") ? "三の試し" : "実戦";
          return `<tr><td>${escapeHtml(new Date(entry.ts).toLocaleDateString("ja-JP"))}</td><td>${escapeHtml(label)}</td><td>${Math.round((entry.acc || 0) * 100)}%</td><td>${escapeHtml(entry.rhythm || "—")}</td><td>${numberText(entry.maxCombo)}</td></tr>`;
        }).join("")}</tbody></table></div>` : `<p>${escapeHtml(text.empty)}</p>`}</section>`;
  }

  function rankLabel(save) {
    const dan = RANK_DATA.dans.find((item) => item.id === save.dan);
    const stage = CURRICULUM_DATA.stages.find((item) => item.id === save.currentStage);
    return dan ? dan.label : stage ? stage.label : "入門";
  }

  function renderPrintLicense(save) {
    const mount = document.getElementById("printLicense");
    if (!mount) return;
    const nickname = NICKNAME_DATA.find((item) => item.id === save.equippedNickname);
    const rank = rankLabel(save);
    const scrolls = save.scrolls.map((id) => JUTSU_DATA.find((item) => item.id === id)).filter(Boolean);
    const recentScrolls = scrolls.slice(-3).reverse();
    const date = new Date().toLocaleDateString("ja-JP");
    const banzuke = bestBanzukeLabel(save);
    const crestHtml = recentScrolls.length
      ? recentScrolls.map((item) => `<span class="print-crest" title="${escapeHtml(item.name)}">${SVG_ICONS.crest(item.crest || item.id)}</span>`).join("")
      : `<span class="print-crest empty">${SVG_ICONS.crest("kamae")}</span>`;
    mount.innerHTML = `<article class="print-license-card">
      <div class="print-license-frame">
        <div class="print-logo-crest">${SVG_ICONS.crest("kamae")}</div>
        <h1><ruby>免状<rt>めんじょう</rt></ruby></h1>
        <p class="print-license-name">${escapeHtml(save.name)} <span>殿</span></p>
        <p class="print-license-text">右の者、<ruby>忍打道<rt>にんだどう</rt></ruby>の<ruby>修行<rt>しゅぎょう</rt></ruby>に励み、${escapeHtml(rank)}に至ったことを証する。</p>
        <p class="print-rank">${escapeHtml(rank)}</p>
        <p class="print-nickname">${nickname ? escapeHtml(nickname.name) : "二つ名なし"}</p>
        <p class="print-banzuke"><ruby>疾風番付<rt>しっぷうばんづけ</rt></ruby> 最高位: ${escapeHtml(banzuke)}</p>
        <div class="print-scrolls">
          <p><ruby>修得<rt>しゅうとく</rt></ruby>した<ruby>術<rt>じゅつ</rt></ruby>: ${scrolls.length} / ${JUTSU_DATA.length}</p>
          <div class="print-crest-row">${crestHtml}</div>
        </div>
        <dl class="print-records">
          <dt><ruby>最高気配<rt>さいこうけはい</rt></ruby></dt><dd>${escapeHtml(save.best.rhythm || "—")}</dd>
          <dt><ruby>累計正打<rt>るいけいせいだ</rt></ruby></dt><dd>${numberText(save.totals.correct)}</dd>
          <dt><ruby>最大連撃<rt>さいだいれんげき</rt></ruby></dt><dd>${numberText(save.best.combo || 0)}</dd>
        </dl>
        <div class="print-footer">
          <p>発行日 ${escapeHtml(date)}</p>
          <p><ruby>発行元<rt>はっこうもと</rt></ruby> キーの里 忍打道場</p>
        </div>
      </div>
    </article>`;
  }

  function numberText(value) {
    return Number(value || 0).toLocaleString("ja-JP");
  }

  function bestBanzukeLabel(save) {
    const records = save.best && save.best.banzuke || {};
    const courses = RANK_DATA.banzuke && RANK_DATA.banzuke.courses || [];
    const order = RANK_DATA.banzuke && RANK_DATA.banzuke.tierOrder || ["無位", "銅", "銀", "金", "白金", "月光"];
    const best = courses.map((course) => {
      const record = records[course.id];
      return record ? { course, record, tierIndex: order.indexOf(record.tier || "無位") } : null;
    }).filter(Boolean).sort((a, b) => b.tierIndex - a.tierIndex || (b.record.score || 0) - (a.record.score || 0))[0];
    return best ? `${best.record.tier}（${best.course.label}・${best.record.score}）` : "なし";
  }

  function renderSettings() {
    const mount = document.getElementById("settingsMount");
    if (!mount) return;
    const save = SaveManager.ensure();
    const code = SaveManager.exportCode(save);
    const teacher = SaveManager.isTeacherMode && SaveManager.isTeacherMode();
    mount.innerHTML = `<label class="setting-row"><input type="checkbox" id="seSetting" ${save.settings.se ? "checked" : ""}> 効果音をならす</label>
      <label class="setting-row"><input type="checkbox" id="voiceSetting" ${save.settings.voice ? "checked" : ""}> 入門で読み上げる</label>
      <label class="setting-row"><input type="checkbox" id="displaySetting" ${save.settings.display === "light" ? "checked" : ""}> あかるいひょうじ（プロジェクタ・けいじ用）</label>
      <label class="setting-row"><input type="checkbox" id="kanjiDisplaySetting" ${save.settings.kanjiDisplay !== false ? "checked" : ""}> ${UI_TEXT.kanjiDisplaySetting}</label>
      ${teacher ? `<label class="setting-row teacher-mode-row"><input type="checkbox" id="teacherModeSetting" checked> 先生モード</label>` : ""}
      <div class="teacher-menu">
        <a href="poster.html" target="_blank" rel="noopener">せんせいメニュー: ゆびのいろポスターをひらく</a>
      </div>
      <details class="observation-tools"><summary>${UI_TEXT.observation.title}</summary>
        <p>${UI_TEXT.observation.note}</p>
        ${FINGER_DATA.observations.map((item) => `<label class="setting-row"><input type="checkbox" data-observation="${item.id}" ${observations.has(item.id) ? "checked" : ""}>${escapeHtml(item.label)}</label>`).join("")}
        <button type="button" id="printObservationButton">${UI_TEXT.observation.print}</button>
      </details>
      <div class="backup-tools">
        <h2>${UI_TEXT.backup.title}</h2>
        <div class="button-row"><button type="button" id="exportBackupButton">${UI_TEXT.backup.export}</button><button type="button" id="importBackupButton">${UI_TEXT.backup.import}</button></div>
        <input type="file" id="backupFileInput" accept=".json,application/json" hidden>
        <p id="backupMessage" role="status" class="hint">${escapeHtml(SaveManager.storageStatus().warning)}</p>
      </div>
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
      </div>
      <p id="versionLabel" class="version-label" tabindex="0">忍打道 —NINDA DO— v${APP_VERSION}</p>
      <div id="teacherUnlockMount" class="teacher-unlock" hidden></div>`;
    document.getElementById("seSetting").addEventListener("change", (event) => SaveManager.setSetting("se", event.target.checked));
    document.getElementById("voiceSetting").addEventListener("change", (event) => {
      SaveManager.setSetting("voice", event.target.checked);
      if (!event.target.checked && AudioManager.cancelSpeech) AudioManager.cancelSpeech();
    });
    document.getElementById("displaySetting").addEventListener("change", (event) => {
      SaveManager.setSetting("display", event.target.checked ? "light" : "night");
      if (globalThis.NindaApp) NindaApp.applyTheme();
    });
    document.getElementById("kanjiDisplaySetting").addEventListener("change", (event) => {
      SaveManager.setSetting("kanjiDisplay", event.target.checked);
    });
    if (teacher) {
      document.getElementById("teacherModeSetting").addEventListener("change", (event) => {
        if (event.target.checked) return;
        setTeacherMode(false);
      });
    }
    wireTeacherUnlock();
    wireBackup();
    mount.querySelectorAll("[data-observation]").forEach((input) => input.addEventListener("change", () => {
      if (input.checked) observations.add(input.dataset.observation);
      else observations.delete(input.dataset.observation);
    }));
    document.getElementById("printObservationButton").addEventListener("click", printObservation);
    document.getElementById("restoreButton").addEventListener("click", () => {
      const message = document.getElementById("restoreMessage");
      try {
        if (!confirm(UI_TEXT.backup.warning)) return;
        SaveManager.restoreCode(document.getElementById("restoreCode").value);
        NindaApp.applyTheme();
        NindaApp.renderHome();
        renderSettings();
        document.getElementById("restoreMessage").textContent = "復元したよ。";
      } catch (error) {
        message.textContent = error.message || "あいことばが ちがうみたい";
      }
    });
    document.getElementById("deleteStep1").addEventListener("click", () => {
      document.getElementById("deleteStep2").hidden = false;
    });
    document.getElementById("deleteStep2").addEventListener("click", () => {
      if (SaveManager.isTeacherMode()) {
        showToast("先生モードをOFFにしてから、消してね。");
        return;
      }
      SaveManager.reset();
      if (globalThis.NindaApp) NindaApp.showScreen("S0");
    });
  }

  function wireBackup() {
    const fileInput = document.getElementById("backupFileInput");
    document.getElementById("exportBackupButton").addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([SaveManager.exportBackup()], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `ninda-do-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    document.getElementById("importBackupButton").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { document.getElementById("backupMessage").textContent = UI_TEXT.backup.error; return; }
      const reader = new FileReader();
      reader.onload = () => previewBackup(String(reader.result));
      reader.onerror = () => { document.getElementById("backupMessage").textContent = UI_TEXT.backup.error; };
      reader.readAsText(file);
      fileInput.value = "";
    });
  }

  function previewBackup(text) {
    const message = document.getElementById("backupMessage");
    try {
      if (SaveManager.isTeacherMode()) throw new Error("先生モードをOFFにしてから、もどしてね");
      const incoming = SaveManager.parseBackup(text);
      const current = SaveManager.ensure();
      const rows = [
        ["にんじゃネーム", current.name, incoming.name], ["段位", rankLabel(current), rankLabel(incoming)],
        ["正打", current.totals.correct, incoming.totals.correct], ["巻物", current.scrolls.length, incoming.scrolls.length],
        ["二つ名", current.nicknames.length, incoming.nicknames.length], ["最大連撃", current.best.combo, incoming.best.combo],
        ["疾風番付", bestBanzukeLabel(current), bestBanzukeLabel(incoming)], ["キーの記録", Object.keys(current.keyStats).length, Object.keys(incoming.keyStats).length]
      ];
      TrainingManager.openModal({
        title: UI_TEXT.backup.compare,
        bodyHtml: `<p>${UI_TEXT.backup.warning}</p><table class="backup-diff"><thead><tr><th>記録</th><th>今</th><th>ファイル</th></tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
        defaultActionId: "cancel", escapeActionId: "cancel",
        actions: [
          { id: "restore", label: UI_TEXT.backup.confirm, run() {
            try {
              SaveManager.restoreBackup(text);
              TrainingManager.closeModal(false);
              NindaApp.applyTheme(); NindaApp.renderHome(); renderSettings();
              document.getElementById("backupMessage").textContent = UI_TEXT.backup.saved;
              document.getElementById("importBackupButton").focus();
            } catch (error) { message.textContent = error.message; }
          } },
          { id: "cancel", label: UI_TEXT.backup.cancel, run() { TrainingManager.closeModal(true); } }
        ]
      });
    } catch (error) { message.textContent = error.message || UI_TEXT.backup.error; }
  }

  function printObservation() {
    const mount = document.getElementById("printLicense");
    mount.dataset.printMode = "observation";
    mount.innerHTML = `<article class="print-observation"><h1>${UI_TEXT.observation.title}</h1>
      <p>${escapeHtml(SaveManager.ensure().name)} ／ ${escapeHtml(new Date().toLocaleDateString("ja-JP"))}</p>
      <p>${UI_TEXT.observation.note}</p><ul>${FINGER_DATA.observations.map((item) => `<li>${observations.has(item.id) ? "☑" : "□"} ${escapeHtml(item.label)}</li>`).join("")}</ul>
      <h2>先生のメモ</h2><div class="observation-memo"></div><p>キーの里 忍打道場</p></article>`;
    window.print();
    mount.removeAttribute("data-print-mode");
    renderPrintLicense(SaveManager.ensure());
  }

  function wireTeacherUnlock() {
    const label = document.getElementById("versionLabel");
    if (!label) return;
    label.addEventListener("click", handleVersionTap);
    label.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleVersionTap();
    });
  }

  function handleVersionTap() {
    window.clearTimeout(versionTapTimer);
    versionTapCount += 1;
    versionTapTimer = window.setTimeout(resetVersionTaps, 2000);
    if (versionTapCount >= 7 && versionTapCount <= 9) {
      showToast(`あと ${10 - versionTapCount}かい…`);
    }
    if (versionTapCount >= 10) {
      resetVersionTaps();
      showTeacherUnlock(SaveManager.isTeacherMode && SaveManager.isTeacherMode());
    }
  }

  function resetVersionTaps() {
    versionTapCount = 0;
    window.clearTimeout(versionTapTimer);
    versionTapTimer = null;
  }

  function showTeacherUnlock(active) {
    const mount = document.getElementById("teacherUnlockMount");
    if (!mount) return;
    mount.hidden = false;
    if (active) {
      mount.innerHTML = `<div class="teacher-unlock-row">
        <button type="button" id="teacherOffButton">先生モードをOFF</button>
        <button type="button" id="teacherUnlockClose">とじる</button>
      </div>`;
      document.getElementById("teacherOffButton").addEventListener("click", () => setTeacherMode(false));
      document.getElementById("teacherUnlockClose").addEventListener("click", closeTeacherUnlock);
      document.getElementById("teacherOffButton").focus();
      return;
    }
    mount.innerHTML = `<div class="teacher-unlock-row">
        <input type="password" id="teacherPasscodeInput" inputmode="numeric" maxlength="8" aria-label="先生モードのパスコード">
        <button type="button" id="teacherUnlockButton">かいじょう</button>
        <button type="button" id="teacherUnlockClose">とじる</button>
      </div>
      <p id="teacherUnlockMessage" class="hint" aria-live="polite"></p>`;
    const input = document.getElementById("teacherPasscodeInput");
    const unlock = document.getElementById("teacherUnlockButton");
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        unlockTeacherMode();
      }
    });
    unlock.addEventListener("click", unlockTeacherMode);
    document.getElementById("teacherUnlockClose").addEventListener("click", closeTeacherUnlock);
    input.focus();
  }

  function unlockTeacherMode() {
    const input = document.getElementById("teacherPasscodeInput");
    const message = document.getElementById("teacherUnlockMessage");
    const mount = document.getElementById("teacherUnlockMount");
    if (!input || !message || !mount) return;
    if (input.value === TEACHER_PASSCODE) {
      teacherFailCount = 0;
      setTeacherMode(true);
      return;
    }
    teacherFailCount += 1;
    message.textContent = "ちがうよ";
    mount.classList.remove("shake");
    void mount.offsetWidth;
    mount.classList.add("shake");
    input.select();
    if (teacherFailCount >= 5) {
      teacherFailCount = 0;
      closeTeacherUnlock();
      resetVersionTaps();
    }
  }

  function closeTeacherUnlock() {
    const mount = document.getElementById("teacherUnlockMount");
    if (!mount) return;
    mount.hidden = true;
    mount.innerHTML = "";
  }

  function setTeacherMode(enabled) {
    SaveManager.setSetting("teacherMode", enabled);
    teacherFailCount = 0;
    showToast(enabled ? "先生モードをONにしました" : "先生モードをOFFにしました");
    if (globalThis.NindaApp) {
      NindaApp.applyTheme();
      NindaApp.renderHome();
    }
    renderSettings();
  }

  function showToast(label) {
    if (globalThis.AchievementManager && AchievementManager.toast) AchievementManager.toast(label);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  document.addEventListener("DOMContentLoaded", initTabs);

  return {
    render,
    renderLicense,
    renderSettings,
    previewBackup
  };
})();
