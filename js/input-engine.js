(function () {
  "use strict";

  const ACCEPTED_RE = /^[a-z.,-]$/;
  const VOWEL_OR_N = new Set(["a", "i", "u", "e", "o", "n"]);
  const N_BLOCKERS = new Set(["a", "i", "u", "e", "o", "n", "y"]);

  function normalizeKey(key) {
    if (typeof key !== "string" || key.length !== 1) return null;
    const lower = key.toLowerCase();
    return ACCEPTED_RE.test(lower) ? lower : null;
  }

  function segment(kanaText) {
    const text = String(kanaText || "");
    const units = [];
    for (let i = 0; i < text.length;) {
      const two = text.slice(i, i + 2);
      if (ROMAJI_TABLE[two]) {
        units.push({ kana: two });
        i += 2;
        continue;
      }
      const one = text[i];
      if (ROMAJI_TABLE[one]) {
        units.push({ kana: one });
        i += 1;
        continue;
      }
      const key = normalizeKey(one);
      if (key) {
        units.push({ kana: key, raw: true });
        i += 1;
        continue;
      }
      throw new Error("InputEngine.segment: unsupported character " + one);
    }
    return units;
  }

  function baseCandidates(unit) {
    if (!unit) return [];
    if (unit.raw) return [unit.kana];
    return (ROMAJI_TABLE[unit.kana] || []).slice();
  }

  function unique(list) {
    return Array.from(new Set(list));
  }

  function canUseSingleN(next) {
    if (!next) return false;
    const candidates = baseCandidates(next);
    return candidates.length > 0 && candidates.every((candidate) => {
      const first = candidate[0];
      return first && !N_BLOCKERS.has(first);
    });
  }

  function doubledConsonants(next) {
    if (!next) return [];
    return unique(baseCandidates(next).map((candidate) => candidate[0]).filter((first) => {
      return first && /^[a-z]$/.test(first) && !VOWEL_OR_N.has(first);
    }));
  }

  function candidatesFor(units, index) {
    const unit = units[index];
    if (!unit) return [];
    if (unit.raw) return [unit.kana];
    if (unit.kana === "っ") {
      return unique(doubledConsonants(units[index + 1]).concat(ROMAJI_TABLE["っ"]));
    }
    if (unit.kana === "ん") {
      const list = ROMAJI_TABLE["ん"].slice();
      if (canUseSingleN(units[index + 1])) list.push("n");
      return list;
    }
    return baseCandidates(unit);
  }

  function preferredRomaji(kanaText) {
    const units = segment(kanaText);
    return units.map((unit, index) => candidatesFor(units, index)[0] || "").join("");
  }

  function isTypeable(kanaText, keySet) {
    const keys = keySet instanceof Set ? keySet : new Set(keySet || []);
    let units;
    try {
      units = segment(kanaText);
    } catch (error) {
      return false;
    }
    return units.every((unit, index) => {
      return candidatesFor(units, index).some((candidate) => {
        return candidate.split("").every((key) => keys.has(key));
      });
    });
  }

  function start(kanaText, context) {
    const units = segment(kanaText);
    const handlers = [];
    const state = {
      text: String(kanaText || ""),
      units,
      context: Object.assign({ guideLevel: 0, mode: "training" }, context || {}),
      unitIndex: 0,
      typedInUnit: "",
      typedDone: "",
      candidates: candidatesFor(units, 0),
      done: units.length === 0
    };

    function nextExpectedKeys() {
      if (state.done) return [];
      return unique(state.candidates.map((candidate) => candidate[state.typedInUnit.length]).filter(Boolean));
    }

    function emit(correct, key, expectedKeys) {
      const event = {
        ts: Date.now(),
        key,
        correct,
        expectedKeys: expectedKeys.slice(),
        kana: state.units[state.unitIndex] ? state.units[state.unitIndex].kana : "",
        unitIndex: state.unitIndex,
        guideLevel: state.context.guideLevel,
        mode: state.context.mode
      };
      handlers.forEach((handler) => handler(event));
    }

    function isPendingSingleN() {
      const unit = state.units[state.unitIndex];
      return unit && unit.kana === "ん" && state.typedInUnit === "n" && state.candidates.includes("n") && state.candidates.includes("nn");
    }

    function keyCanStartNextUnit(key) {
      return candidatesFor(state.units, state.unitIndex + 1).some((candidate) => candidate.startsWith(key));
    }

    function completeUnitIfReady(force) {
      if (!force && isPendingSingleN()) return false;
      if (!state.candidates.some((candidate) => candidate === state.typedInUnit)) return false;
      state.typedDone += state.typedInUnit;
      state.unitIndex += 1;
      state.typedInUnit = "";
      state.candidates = candidatesFor(state.units, state.unitIndex);
      state.done = state.unitIndex >= state.units.length;
      return true;
    }

    return {
      onEvent(fn) {
        if (typeof fn === "function") handlers.push(fn);
      },
      setContext(nextContext) {
        Object.assign(state.context, nextContext || {});
      },
      handleKey(rawKey) {
        if (state.done) return "done";
        const key = normalizeKey(rawKey);
        if (!key) return "ignore";
        const expectedKeys = nextExpectedKeys();
        const typed = state.typedInUnit + key;
        const matches = state.candidates.filter((candidate) => candidate.startsWith(typed));
        if (!matches.length && isPendingSingleN() && keyCanStartNextUnit(key)) {
          completeUnitIfReady(true);
          return this.handleKey(key);
        }
        if (!matches.length) {
          emit(false, key, expectedKeys);
          return "miss";
        }
        state.typedInUnit = typed;
        state.candidates = matches;
        emit(true, key, expectedKeys);
        completeUnitIfReady();
        return state.done ? "done" : "correct";
      },
      displayRomaji() {
        if (state.done) return { typed: state.typedDone, rest: "" };
        const current = state.candidates[0] || "";
        const restCurrent = current.slice(state.typedInUnit.length);
        const restFuture = state.units.slice(state.unitIndex + 1).map((unit, offset) => {
          return candidatesFor(state.units, state.unitIndex + 1 + offset)[0] || "";
        }).join("");
        return { typed: state.typedDone + state.typedInUnit, rest: restCurrent + restFuture };
      },
      nextExpectedKeys,
      progress() {
        return { unitIndex: state.unitIndex, total: state.units.length };
      },
      isDone() {
        return state.done;
      }
    };
  }

  const InputEngine = globalThis.InputEngine = {
    start,
    segment,
    isTypeable,
    preferredRomaji,
    _candidatesFor: candidatesFor
  };
})();
