const METRICS_CONFIG = globalThis.METRICS_CONFIG = {
  rhythmWindow: 30,
  rhythmMinSamples: 10,
  breakMs: 3000,
  thresholds: [
    { label: "不動", maxCv: 0.35 },
    { label: "静", maxCv: 0.60 },
    { label: "並", maxCv: 0.90 },
    { label: "乱", maxCv: Infinity }
  ]
};

const MetricsEngine = globalThis.MetricsEngine = (function () {
  "use strict";

  function accuracy(correct, miss) {
    const total = correct + miss;
    return total ? correct / total : 1;
  }

  function cv(values) {
    if (!values.length) return Infinity;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (!mean) return Infinity;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  function median(values) {
    if (!values.length) return Infinity;
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function rhythmLabelFromCv(value) {
    if (!Number.isFinite(value)) return "—";
    return METRICS_CONFIG.thresholds.find((item) => value < item.maxCv).label;
  }

  function createSession(options) {
    const mode = options && options.mode ? options.mode : "training";
    const startedAt = Date.now();
    const state = {
      mode,
      correct: 0,
      miss: 0,
      lastEventTs: null,
      lastCorrectTs: null,
      intervals: [],
      cvSamples: [],
      fudoUpdates: 0,
      rhythmUpdates: 0,
      keyStats: {},
      lastTs: startedAt,
      bestKpm: 0
    };

    function ensureKey(key) {
      if (!state.keyStats[key]) state.keyStats[key] = { attempts: 0, misses: 0, sumLatency: 0, recent: [] };
      return state.keyStats[key];
    }

    function currentRhythm() {
      if (state.intervals.length < METRICS_CONFIG.rhythmMinSamples) {
        return { label: "—", cv: Infinity };
      }
      const value = cv(state.intervals.slice(-METRICS_CONFIG.rhythmWindow));
      return { label: rhythmLabelFromCv(value), cv: value };
    }

    function elapsedSeconds(now) {
      return Math.max(0.001, ((now || state.lastTs || Date.now()) - startedAt) / 1000);
    }

    return {
      consume(event) {
        if (!event || typeof event.correct !== "boolean") return;
        state.lastTs = event.ts || Date.now();
        const expected = event.expectedKeys && event.expectedKeys[0] ? event.expectedKeys[0] : event.key;
        const stat = expected ? ensureKey(expected) : null;
        const latency = state.lastEventTs == null ? 0 : Math.min(METRICS_CONFIG.breakMs, Math.max(0, state.lastTs - state.lastEventTs));
        state.lastEventTs = state.lastTs;

        if (stat) stat.attempts += 1;
        if (event.correct) {
          state.correct += 1;
          if (stat) {
            stat.sumLatency += latency;
            stat.recent.push(true);
          }
          if (state.lastCorrectTs != null) {
            const interval = state.lastTs - state.lastCorrectTs;
            if (interval > 0 && interval <= METRICS_CONFIG.breakMs) state.intervals.push(interval);
          }
          state.lastCorrectTs = state.lastTs;
          const rhythm = currentRhythm();
          if (rhythm.label !== "—") {
            state.cvSamples.push(rhythm.cv);
            state.rhythmUpdates += 1;
            if (rhythm.label === "不動") state.fudoUpdates += 1;
          }
          if (mode === "jissen") {
            state.bestKpm = Math.max(state.bestKpm, state.correct * 60 / elapsedSeconds(state.lastTs));
          }
        } else {
          state.miss += 1;
          if (stat) {
            stat.misses += 1;
            stat.recent.push(false);
          }
        }
        if (stat && stat.recent.length > 20) stat.recent.shift();
      },
      summary(now) {
        const rhythmCv = median(state.cvSamples);
        const kpm = mode === "jissen" ? state.correct * 60 / elapsedSeconds(now || state.lastTs || Date.now()) : 0;
        return {
          mode,
          correct: state.correct,
          miss: state.miss,
          accuracy: accuracy(state.correct, state.miss),
          rhythm: rhythmLabelFromCv(rhythmCv),
          currentRhythm: currentRhythm().label,
          rhythmCv,
          fudoRate: state.rhythmUpdates ? state.fudoUpdates / state.rhythmUpdates : 0,
          kpm,
          bestKpm: Math.max(state.bestKpm, kpm),
          keyStats: this.keyStats()
        };
      },
      keyStats() {
        const copy = {};
        for (const [key, value] of Object.entries(state.keyStats)) {
          copy[key] = {
            attempts: value.attempts,
            misses: value.misses,
            sumLatency: value.sumLatency,
            recent: value.recent.slice()
          };
        }
        return copy;
      }
    };
  }

  function weakKeys(keyStats, limit) {
    return Object.entries(keyStats || {})
      .filter(([, stat]) => stat.attempts >= 10)
      .map(([key, stat]) => ({ key, missRate: stat.misses / Math.max(1, stat.attempts), attempts: stat.attempts }))
      .sort((a, b) => b.missRate - a.missRate || b.attempts - a.attempts)
      .slice(0, limit || 5);
  }

  function recentAccuracy(stat) {
    const recent = stat && stat.recent ? stat.recent : [];
    if (!recent.length) return 0;
    return recent.filter(Boolean).length / recent.length;
  }

  return {
    createSession,
    accuracy,
    rhythmLabelFromCv,
    weakKeys,
    recentAccuracy
  };
})();
