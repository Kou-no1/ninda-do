const MetricsEngine = globalThis.MetricsEngine = {
  createSession() {
    return { consume() {}, summary() { return { correct: 0, miss: 0, accuracy: 1, rhythm: "—", fudoRate: 0, kpm: 0 }; } };
  }
};
