const RANK_DATA = globalThis.RANK_DATA = {
  dans: [
    { id: "genin", label: "下忍", grantedBy: "kyu1" },
    { id: "chunin", label: "中忍", exam: {
      kata: { items: 15, accuracy: 0.96, guideLevel: 1 },
      jissen: { seconds: 60, kpm: 60, accuracy: 0.94, guideLevel: 1 },
      shingan: { items: 3, accuracy: 0.96, guideLevel: 0 }
    } },
    { id: "jonin", label: "上忍", exam: {
      kata: { items: 20, accuracy: 0.97, guideLevel: 1 },
      jissen: { seconds: 90, kpm: 90, accuracy: 0.95, guideLevel: 1 },
      shingan: { items: 4, accuracy: 0.97, guideLevel: 0 }
    } },
    { id: "tokujonin", label: "特上忍", exam: {
      kata: { items: 20, accuracy: 0.97, guideLevel: 1 },
      jissen: { seconds: 90, kpm: 120, accuracy: 0.96, guideLevel: 1 },
      shingan: { items: 5, accuracy: 0.97, guideLevel: 0 }
    } },
    { id: "kage", label: "影", exam: {
      kata: { items: 25, accuracy: 0.98, guideLevel: 1 },
      jissen: { seconds: 120, kpm: 150, accuracy: 0.97, guideLevel: 1 },
      shingan: { items: 6, accuracy: 0.98, guideLevel: 0 }
    } }
  ],
  jissenMenu: [
    { id: "word-jissen", label: "ことばの実戦", kind: "word", seconds: 60, source: "DAN_WORDS" },
    { id: "sentence-jissen", label: "文章の実戦", kind: "sentence", seconds: 90, source: "DAN_SENTENCES" },
    { id: "shippu", label: "疾風番付", kind: "banzuke" },
    { id: "weak", label: "弱点特訓", kind: "weak", items: 10, source: "DAN_WORDS" }
  ],
  banzuke: {
    seconds: 60,
    tierOrder: ["無位", "銅", "銀", "金", "白金", "月光"],
    courses: [
      { id: "michi-genin", label: "下忍の道", dan: "genin", wordsRef: "MICHI_GENIN" },
      { id: "michi-chunin", label: "中忍の道", dan: "chunin", wordsRef: "MICHI_CHUNIN" },
      { id: "michi-jonin", label: "上忍の道", dan: "jonin", wordsRef: "MICHI_JONIN" },
      { id: "michi-tokujonin", label: "特上忍の道", dan: "tokujonin", wordsRef: "MICHI_TOKUJONIN" },
      { id: "michi-kage", label: "影の道", dan: "kage", wordsRef: "MICHI_KAGE" }
    ],
    tiers: {
      "michi-genin": { "銅": 30, "銀": 45, "金": 60, "白金": 80, "月光": 100 },
      "michi-chunin": { "銅": 40, "銀": 60, "金": 80, "白金": 100, "月光": 125 },
      "michi-jonin": { "銅": 50, "銀": 70, "金": 95, "白金": 120, "月光": 150 },
      "michi-tokujonin": { "銅": 60, "銀": 85, "金": 110, "白金": 140, "月光": 175 },
      "michi-kage": { "銅": 70, "銀": 95, "金": 125, "白金": 160, "月光": 200 }
    }
  }
};
