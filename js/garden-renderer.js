const GardenRenderer = globalThis.GardenRenderer = (function () {
  "use strict";

  // Each drawing grows upward from the same soil line at (0, 0).
  function vineLeaf(x, y, angle, size) {
    return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${size})">
      <path d="M0 0Q-16 4-18-9L-11-9Q-13-15-9-21L-2-17 3-29Q14-22 12-12L18-14Q17-3 0 0Z" fill="#538650" stroke="#345c45"/>
      <path d="M0-1 3-23M0-3-10-12M1-5 11-10" fill="none" stroke="#c1ce84"/></g>`;
  }

  function trumpet(x, y, angle, size) {
    return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${size})">
      <path d="M-5 1Q-7 7-3 16L3 12 7 2" fill="#a89ae8" stroke="#594b9b"/>
      <path d="M0-12Q8-17 13-9Q21-6 16 2Q18 11 8 12Q2 18-5 12Q-15 15-17 5Q-22-2-14-7Q-12-17 0-12Z" fill="#616bcd" stroke="#484999" stroke-width="1.8"/>
      <path d="m0 0-11-7 9 4 2-9 2 9 10-5-8 8 9 5L2 3l-5 9 1-10-11 3Z" fill="#d2cef5"/>
      <circle r="2.5" fill="#ffe395"/></g>`;
  }

  function asagao(stage) {
    if (stage === 0) return `<path d="M-9-2Q-16-8-10-16Q-6-21 6-19Q15-11 9-5Q2 1-9-2Z" fill="#5c483c" stroke="#45372f" stroke-width="2"/>
      <path d="M-8-14Q-5-10-5-6M1-16 4-14" fill="none" stroke="#c0a17b" stroke-width="2"/>`;
    if (stage === 1) return `<path d="M0 0Q6-13 0-24" fill="none" stroke="#59784a" stroke-width="4"/>
      <path d="M1-19Q-16-15-24-34Q-5-39 1-19Z" fill="#659655" stroke="#456d45" stroke-width="2"/>
      <path d="M1-19Q4-42 24-39Q24-21 1-19Z" fill="#88aa59" stroke="#456d45" stroke-width="2"/>
      <path d="m-18-31 15 10m22-14L5-23" stroke="#d7dd9a"/>`;
    const frame = `<g fill="none" stroke-linecap="round"><path d="m-30 0 9-98M30 0l-9-98" stroke="#946e4f" stroke-width="4"/>
      <path d="M-26-39H26M-23-72H23" stroke="#b39167" stroke-width="3"/>
      <path d="m-28-42 5 6m44-39 5 6" stroke="#665a46" stroke-width="2"/>
      <path d="M-9 0C-24-19 20-24 8-39S-29-52-15-66S17-64 13-82" stroke="#466e48" stroke-width="4"/>
      <path d="M-14-62q-17-13-19-2t9 3M7-39q15-18 22-13t-1 7" stroke="#668754" stroke-width="2"/></g>`;
    return frame + vineLeaf(-6, -24, -64, .78) + vineLeaf(6, -39, 66, .88) +
      vineLeaf(-12, -58, -65, .8) + vineLeaf(12, -78, 32, .64) +
      (stage === 3 ? trumpet(-24, -74, -18, .95) + trumpet(23, -90, 22, .8) + trumpet(22, -51, 16, .68) : "");
  }

  function bambooShoot() {
    return `<path d="M-13-1Q-12-18-1-34Q10-22 14-1Q2 4-13-1Z" fill="#b78553" stroke="#72553e" stroke-width="2"/>
      <path d="M-11-4 6-16l5 3M-8-14l12-7M-4-24l7-4" fill="none" stroke="#f0d49a" stroke-width="2"/>
      <path d="m-2-33 2-7 3 10" fill="#679151"/>`;
  }

  function culm(x, height, lean) {
    let nodes = "";
    for (let y = 16; y < height; y += 19) {
      nodes += `<path d="M-4.5 -${y}h9" stroke="#385e44" stroke-width="3"/>`;
    }
    return `<g transform="translate(${x} 0) rotate(${lean})">
      <path d="M-4 0l1-${height}h6L4 0Z" fill="#6e9b59" stroke="#416c4b" stroke-width="1.5"/>
      <path d="M-1-2v-${height - 5}" stroke="#bed18b" stroke-width="2"/>${nodes}</g>`;
  }

  function bambooLeaves(x, y, angle) {
    return `<g transform="translate(${x} ${y}) rotate(${angle})" fill="#497e5d">
      <path d="M-2 2 26-8" fill="none" stroke="#51794e" stroke-width="2"/>
      <path d="M4 0Q9-15 21-19Q16-6 4 0ZM9-2Q18-1 26 8Q16 7 9-2ZM16-5Q26-18 39-17Q31-8 16-5ZM22-6Q36-9 44-3Q32 0 22-6Z"/></g>`;
  }

  function take(stage) {
    if (stage === 0) return bambooShoot();
    if (stage === 1) return culm(-3, 58, 4) + `<path d="M-11 0l3-22 8 6 5-14 3 30Z" fill="#aa8758"/>
      <path d="m-9-4 15-11" stroke="#e7cd94" stroke-width="2"/>`;
    const stalks = culm(-12, 81, -8) + culm(1, 101, 4) + culm(14, 65, 12);
    const branches = `<path d="m-18-48-16-11-4-9m43 15 19-12 10-2M7-76l-16-11-4-10m35 51 11-9" fill="none" stroke="#49734e" stroke-width="3"/>`;
    return stalks + branches + (stage === 3 ?
      bambooLeaves(-35, -60, -154) + bambooLeaves(-11, -92, -151) + bambooLeaves(7, -88, -31) +
      bambooLeaves(23, -66, -12) + bambooLeaves(32, -54, 19) + bambooLeaves(-16, -44, 143) : "");
  }

  function plumFlower(x, y, size) {
    return `<g transform="translate(${x} ${y}) scale(${size})" fill="#efacb2" stroke="#bc697e" stroke-width=".8">
      ${[0, 72, 144, 216, 288].map((a) => `<ellipse cy="-5" rx="4.5" ry="5.3" transform="rotate(${a})"/>`).join("")}
      <circle r="3" fill="#ffe39c" stroke="none"/><circle r="1.2" fill="#b17a43" stroke="none"/></g>`;
  }

  function ume(stage) {
    if (stage === 0) return `<path d="M0 0q-5-18 2-35m-3 21-9-8" fill="none" stroke="#745343" stroke-width="4"/>
      <path d="M1-27Q-2-44 9-46Q13-34 1-27ZM-8-21q-16 1-17-10 13-3 17 10Z" fill="#768f58" stroke="#566f48"/>`;
    const wood = `<path d="M-12 0Q0-13-5-31Q-10-47 5-59Q15-70 15-87Q20-72 10-57Q-1-45 2-31Q8-12 3 0Z" fill="#785741" stroke="#563e36" stroke-width="2"/>
      <g fill="none" stroke="#694b3c" stroke-linecap="round">
      <path d="M-2-35Q-22-42-28-58L-41-69M2-51q21 3 31-16l14-9M14-73l-17-12-6-13" stroke-width="4"/>
      <path d="m-21-47-17-2-10-8m19 0 1-16m57 12 14 1m-8-9 2-15m-42 0-12-2m29 2 10-11" stroke-width="2.5"/></g>`;
    if (stage === 1) return `<g transform="scale(.77)">${wood}</g>`;
    const tips = [[-42,-69],[-29,-73],[-46,-57],[-20,-47],[-9,-98],[0,-85],[15,-86],[25,-95],[35,-83],[47,-76],[43,-60],[21,-56]];
    return wood + tips.map(([x, y], i) => stage === 2 ?
      `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="4.5" fill="#c97084" stroke="#935567"/>` :
      plumFlower(x, y, .67 + (i % 3) * .16)).join("");
  }

  const drawings = { asagao, take, ume };

  function scene(plants, selected) {
    // The distant ridge, wall and stepping stones stay still as the beds change.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 190" width="100%" aria-hidden="true" focusable="false" stroke-linejoin="round">
      <rect width="600" height="190" fill="var(--garden-sky)"/><circle cx="511" cy="36" r="17" fill="var(--garden-moon)"/>
      <path d="M0 65Q39 42 76 51T142 46Q190 12 224 36T288 61Q339 32 372 45T447 60Q479 36 510 45T600 41V106H0Z" fill="var(--garden-ridge-far)"/>
      <path d="M0 83Q49 56 97 71T191 69Q235 49 284 66T370 72Q425 48 466 69T551 64Q575 54 600 62V107H0Z" fill="var(--garden-ridge-near)"/>
      <path d="M0 85h600v32H0Z" fill="var(--garden-wall)"/><path d="M0 85h600" stroke="#65716a" stroke-width="5"/>
      <path d="M29 88v29m98-29v29m98-29v29m98-29v29m98-29v29m98-29v29" stroke="#bfad8d" stroke-width="3"/>
      <path d="M0 114q108-7 213 1t219-1 168 0v76H0Z" fill="var(--garden-lawn)"/>
      <path d="M392 113q-52 10-9 22t-12 25l-27 30h37q51-33 32-44t-26-20q-1-7 20-13Z" fill="#ddd4b4"/>
      <g fill="#9d9f87"><ellipse cx="392" cy="122" rx="8" ry="2"/><ellipse cx="396" cy="137" rx="11" ry="3"/><ellipse cx="400" cy="153" rx="14" ry="4"/><ellipse cx="379" cy="172" rx="17" ry="5"/></g>
      ${plants.map(({ plant, stage }, i) => `<g transform="translate(${(i + .5) * 600 / plants.length} 150)">
        <ellipse cy="3" rx="62" ry="13" fill="#92a573"/><ellipse rx="59" ry="11" fill="#b89974"/>
        <path d="M-46 2q10 3 17 2m53-8 8 1m7 6 7-1" fill="none" stroke="#927856" stroke-width="2" stroke-linecap="round"/>
        ${drawings[plant.id](stage)}
        ${plant.id === selected ? '<g transform="translate(-42 -1) rotate(-8)"><path d="M0 0v-13" stroke="#654f42" stroke-width="3"/><path d="M-8-23H9v13H-8Z" fill="#fff2cf" stroke="#795d47"/><path d="m-4-17 3 3 6-6" fill="none" stroke="#346a50" stroke-width="2.4"/></g>' : ""}
      </g>`).join("")}</svg>`;
  }

  function render(mount, save, onSelect) {
    if (!mount) return;
    const ui = UI_TEXT.garden;
    const garden = save.garden || {};
    const plants = GARDEN_DATA.plants.map((plant) => {
      const value = garden.growth?.[plant.id];
      const stage = Number.isInteger(value) ? Math.max(0, Math.min(plant.stages.length - 1, value)) : 0;
      return { plant, stage };
    });
    const active = plants.find(({ plant }) => plant.id === garden.selected);
    const doc = mount.ownerDocument;
    function element(tag, name, text) {
      const node = doc.createElement(tag);
      node.className = `garden-${name}`;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    const figure = element("figure", "scene");
    figure.innerHTML = scene(plants, garden.selected);
    const caption = element("figcaption", "caption");
    if (save.settings?.teacherMode) caption.append(element("strong", "preview", ui.preview), " ");
    if (active) {
      caption.append(element("strong", "current", `${active.plant.label}：${active.plant.stages[active.stage]}`),
        " ", element("span", "description", active.plant.desc));
      if (active.stage === active.plant.stages.length - 1) caption.append(" ", element("span", "complete", ui.complete));
    } else {
      caption.append(ui.empty);
    }
    figure.append(caption);

    const choices = element("div", "plants");
    choices.setAttribute("role", "group");
    choices.setAttribute("aria-label", ui.choose);
    for (const { plant, stage } of plants) {
      const selected = plant.id === garden.selected;
      const button = element("button", "plant");
      button.type = "button";
      button.dataset.gardenPlant = plant.id;
      button.setAttribute("aria-pressed", String(selected));
      button.append(element("strong", "name", plant.label), " ", element("span", "stage", plant.stages[stage]));
      if (selected) button.append(" ", element("span", "selected", ui.selected));
      button.addEventListener("click", () => onSelect(plant.id));
      choices.append(button);
    }
    mount.replaceChildren(figure, element("p", "hint", ui.hint), element("h2", "choose", ui.choose), choices);
  }

  return { render };
})();
