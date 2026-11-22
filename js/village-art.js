// A single woodblock panorama, printed at three scales. No animation or asset requests.
const VillageArt = (() => {
  const ridge = "M0 355 127 305 181 319 305 232 369 264 425 221 518 270 621 189 668 207 737 141 773 151 835 77 858 96 875 102 944 184 985 208 1009 202 1102 261 1175 198 1223 219 1301 141 1352 175 1440 112V572H0Z";
  const pine = '<path d="M-2 3 0-18-3-24 1-24 0-40 3-56 4-28 10-34 6-23 4-19 4 3Z"/><path d="m2-59-5 12-6 6 9-3-5 7-9 4 12-2-6 7-11 6 14-3-5 6-15 6 18-2-5 4 13-3 20 3-10-5 6 1-12-8 12 2-14-10 9 2-10-9 6 1-7-10 3 1Z"/>';
  const grove = (points) => points.map(([x,y,s]) => `<use href="#wood-pine" transform="translate(${x} ${y}) scale(${s})"/>`).join("");
  const windows = (x,y,n) => Array.from({length:n}, (_,i) => `<path d="M${x+i*7} ${y}v5"/>`).join("");
  const art = `<svg class="wood-defs" aria-hidden="true" focusable="false" width="0" height="0"><defs>
    <linearGradient id="wood-sky" x2=".18" y2="1"><stop stop-color="var(--wood-sky)"/><stop offset=".6" stop-color="var(--wood-horizon)"/><stop offset="1" stop-color="var(--wood-mist)"/></linearGradient>
    <pattern id="wood-grain" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 7 7-2M3 11l8-8" fill="none" stroke="var(--wood-light)" stroke-width=".7" opacity=".37"/></pattern>
    <clipPath id="wood-ridge-clip"><path d="${ridge}"/></clipPath>
    <symbol id="wood-mark" viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="2.6"><path d="m32 3 28 29-28 29L4 32Z"/><path d="m11 37 19-25-3 15 7-4 12 15-15-8-9 10 7-15-13 15Z" fill="currentColor" stroke="none"/><path d="m22 46 11-4 10 1"/></g></symbol>
    <g id="wood-pine">${pine}</g>
    <g id="wood-roof"><path d="M-54 2q23-1 40-15l12-11 3-8 4 9 13 12Q37 2 54 0q-7 7-32 9h-41Q-42 8-54 2Z"/><path d="M-49 4q26 1 50-17Q23 4 48 4" fill="none" stroke="var(--wood-mist)" stroke-width="1.5"/></g>
    <g id="wood-temple" fill="var(--wood-ink)">
      <path d="M-26 0v-28h8v-45h7v-38h22v38h8v45h8V0Z"/><path d="M0-121v-35m-4 13h8m-8 5h8" stroke="var(--wood-ink)" stroke-width="3"/>
      <use href="#wood-roof" transform="translate(0 -100) scale(.57)"/><use href="#wood-roof" transform="translate(0 -75) scale(.75)"/><use href="#wood-roof" transform="translate(0 -44)"/>
      <path d="M-47-17-32-30H34l16 14-10 4h-80Z"/><g stroke="var(--wood-amber)" stroke-width="3">${windows(-11,-62,4)}${windows(-15,-33,5)}</g>
    </g>
    <g id="wood-runner" fill="var(--wood-ink)">
      <!-- A crouched lookout; the long ties and bent limbs keep the silhouette legible. -->
      <path d="M-10-78q6-10 17-6l8 8 2 12-4 7-18 3-10-10Z"/>
      <path d="M-8-62q-16 5-23 21l-9 12 5 13 27-7 13-16 11-19-9-6Z"/>
      <path d="m6-47 9 17 15 8 10-2 1 4-12 7-22-9-12-14ZM-29-32l-10 10-16 5-7 8 13 1 21-8 13-11Z"/>
      <path d="m-32-25 24-2 19 13-6 10-14 13-4 4 7 3-8 2-12-1 2-9 12-17-16-2-17 15-23 8-3 7-12 3 2-9 23-15Z"/>
      <path d="M-12-69q-13-11-26-5-24 13-51 3 21 18 45 8 17-9 32-3ZM-13-65q-18 2-25 11-7 9-21 7 10 8 25-1l22-14Z" fill="var(--wood-scarf)"/>
      <path d="m-7-72 21-2-1 5-17 3Z" fill="var(--wood-light)"/><path d="m7-72 4 1-3 2Z"/>
      <path d="m-32-26 23 1 3 3-27-1Zm3-13 11-13m-9 19 11-9" fill="none" stroke="var(--wood-ridge)" stroke-width="2"/>
      <g fill="none" stroke="var(--wood-ridge)" stroke-linecap="round" stroke-width="1.4">
        <path d="m-10-76 11-4 9 1m-12 18 12-2m-26 15 8 4m18 12 7-3m-57 34 7 3m-11 0 6 3m31-6 9 3m-12 1 7 3"/>
      </g>
    </g>
    <g id="wood-print">
      <path fill="url(#wood-sky)" d="M0 0h1440v570H0z"/>
      <g fill="var(--wood-light)" opacity=".5"><circle cx="551" cy="56" r="1.2"/><circle cx="741" cy="47" r="1.4"/><circle cx="912" cy="32" r="1"/><circle cx="1165" cy="58" r="1.5"/><circle cx="1261" cy="32" r="1.1"/></g>
      <g transform="translate(1058 125)"><circle r="73" fill="var(--wood-moon)"/><circle r="81" fill="none" stroke="var(--wood-moon)" opacity=".38"/><path d="M-51-31q26-15 59-8m-68 17q12-7 26-8m49 73q14-4 24-13" fill="none" stroke="var(--wood-sky)" opacity=".14" stroke-width="2"/></g>
      <g fill="none" stroke="var(--wood-light)" opacity=".4" stroke-linecap="round"><path d="M76 146q69 1 119-4t111-2m10 0h37m377-83q28 2 85-3m352 82q53-6 105-3m8 0h32M924 146q15-3 44-2m10 0h18"/></g>
      <path fill="var(--wood-far)" d="m0 230 83-38 82 27 96-59 50 24 67-52 77 54 42-19 87 45 78-66 27 5 59-54 102 79 52-21 61 44 91-68 62 32 74-22 111 40 79-50 60 37v227H0Z"/>
      <g fill="none" stroke="var(--wood-light)" stroke-width="1.3" opacity=".43"><path d="m318 185 54-46-28 36m373-61-31 35-22 11m377-8-24 18m35-21-17 16m237 18 45-34-20 24"/></g>
      <path d="${ridge}" fill="var(--wood-ridge)"/>
      <g clip-path="url(#wood-ridge-clip)">
        <path fill="var(--wood-snow)" d="m830 75-66 90-28 4-40 46 47-27 22 1 32-36-9 26 25-18-11 24 30-33 9-34 17 20-4-24 24 26 24 9-54-67Z"/>
        <path fill="var(--wood-far)" d="m833 83-40 64 25-17-7 22 19-24 9-28 12 22-4-25ZM725 163l-52 72 41-34 21-4 32-40Z"/>
        <path fill="url(#wood-grain)" d="m836 83 108 112-76-34 24 30-29-13-16-33-13 12 11-37ZM685 212l-101 66 74-77ZM1300 140l54 40-43-13 14 29-44-26Z"/>
        <g fill="none" stroke="var(--wood-mist)" opacity=".55"><path d="m768 164-85 74-69 34m149-94-54 54m111-71-30 34-40 28m123-74 34 34 41 22m-19-8 35 25m-553 29-34 40-62 34"/></g>
      </g>
      <path d="M0 313q151-62 301-25t326 2q129-32 245-28t245 11q157-7 323-50v87q-184 38-374 9t-322 9q-162 36-328 7T0 375Z" fill="var(--wood-mist)" opacity=".78"/>
      <path d="M0 355q128-11 224-39t199 6q79 28 179-2 80-33 149-18t166-11q136-46 244-28t279-33v168H0Z" fill="var(--wood-mid)"/>
      <path d="M0 394q165-41 280-28t223 0q118-31 200-19t167-1 172-13q85 2 158-12-82 23-156 22t-181 22q-73 17-152 10t-194 12q-125 27-241 18T0 424Z" fill="var(--wood-mist)"/>
      <g fill="var(--wood-mid)">${grove([[710,321,.49],[720,320,.36],[754,324,.58],[779,326,.37],[1102,269,.46],[1122,269,.63],[1155,271,.49],[1170,272,.43]])}</g>
      <path d="M0 389q98-21 177-20t152-34q84-28 141-4t159 12l47 7q-56 24-132 24t-155 24q-105 36-222 30L0 455Z" fill="var(--wood-forest)"/>
      <g transform="translate(542 347) scale(.58)"><use href="#wood-temple"/></g>
      <g transform="translate(598 347)" fill="var(--wood-forest)"><path d="m-18-3 12-9H8L19-2 1-4h-12v5h-5Zm35 0 11-8h16l10 8-6 1v5H24v-6Z"/><path d="M26-1h4m3 0h3" stroke="var(--wood-amber)" stroke-width="2"/></g>
      <g fill="var(--wood-forest)">${grove([[415,329,.77],[435,332,.45],[577,344,.61],[589,344,.45],[615,346,.41],[498,339,.42]])}</g>
      <g fill="none" stroke="var(--wood-light)" opacity=".47"><path d="M617 382q64-17 129-17m28-1 49-2m-177 40q44-9 98-10m96-47 110-10"/></g>
      <path d="M0 478q88-22 173-26t184-21q142-29 235-13t194-9q102-35 216-33l438-36v230H0Z" fill="var(--wood-forest)"/>
      <path fill="var(--wood-ink)" d="M0 301q58 20 99 79l33 11 49 39 40 8 77 55 92 29 67 48H0ZM828 570l66-78 92-49 57-21 36-29 42-7 39-40 54-3 35-33 35 9 28-24 128-22v297Z"/>
      <g fill="var(--wood-ink)">${grove([[22,367,1.8],[59,392,1.14],[109,421,.73],[1270,327,1.02],[1323,302,1.65],[1380,302,2.25],[1423,310,1.35],[969,485,.8]])}</g>
      <use href="#wood-runner" transform="translate(1165 340) scale(1.28)"/>
      <g stroke="var(--wood-ridge)" fill="none" opacity=".7"><path d="m1092 410 45-14 33-36 37-4m-129 76 57-22 22-25m76-33 24-16 29 5m-145 102 31-19m-991-3 33 10 23 18m-57-36 14 3"/></g>
      <g fill="none" stroke="var(--wood-ridge)" stroke-linecap="round" opacity=".43"><path d="m1002 481 55-29 28-6m32-12 46-22 25-31m-30 47 37-36 24-4m-133 95 32-22m93-79 21-26 42-9m-25 16 17-4m49-28 29-11 34-1m-68 19 25-9m-175 110 24-15 15-3m-201 77 36-26 42-17m-53 28 48-20m-14 12 30-15"/></g>
    </g>
  </defs></svg>`;
  function mount() {
    const host = document.getElementById("woodBlocks");
    if (host) host.innerHTML = art;
  }
  function markNavigation() {
    const paths = { S7: "M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3ZM12 6v14",
      S8: "M12 20v-8m0 3Q3 16 3 6q9 0 9 9Zm0-3q0-8 9-9 0 9-9 10",
      S4: "M7 4h12a2 2 0 0 1 2 2v3h-4V6a2 2 0 0 1 2-2M6 4a2 2 0 0 0-2 2v12h10v1a2 2 0 0 0 4 0V9M4 18H2v2h14",
      S5: "M3 4h18v14h-6m-6 0H3ZM7 8h10M7 11h4m3 5-1 5 3-1 2 2 1-5m-1-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
      S6: "M3 6h7m4 0h7M3 12h11m4 0h3M3 18h3m4 0h11M10 3v6m4 0v6M6 15v6" };
    document.querySelectorAll(".top-actions [data-screen]").forEach(button => {
      const path = paths[button.dataset.screen];
      if (!path) return;
      const icon = `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      button.insertAdjacentHTML("afterbegin", icon);
      const title = document.querySelector(`#${button.dataset.screen} .topbar h1`);
      if (title) title.insertAdjacentHTML("beforebegin", `<span class="room-emblem" aria-hidden="true">${icon}</span>`);
    });
  }
  return { mount, markNavigation };
})();
