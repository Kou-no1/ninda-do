const RANK_DATA = globalThis.RANK_DATA = {
  dans: [
    { id: "genin", label: "下忍", mapAccent: "none", grantedBy: "kyu1" },
    { id: "chunin", label: "中忍", mapAccent: "ai", exam: {
        desc: "昇段のしけん。型・実戦・心眼の三本。",
        kata: { items: 15, accuracy: 0.96, guideLevel: 1 },
        jissen: { seconds: 60, kpm: 60, accuracy: 0.94, guideLevel: 1 },
        shingan: { items: 3, accuracy: 0.96, guideLevel: 0 }
    } },
    { id: "jonin", label: "上忍", mapAccent: "kin", exam: {
        desc: "昇段のしけん。型・実戦・心眼の三本。",
        kata: { items: 20, accuracy: 0.97, guideLevel: 1 },
        jissen: { seconds: 90, kpm: 90, accuracy: 0.95, guideLevel: 1 },
        shingan: { items: 4, accuracy: 0.97, guideLevel: 0 }
    } },
    { id: "tokujonin", label: "特上忍", mapAccent: "hakkin", secret: true, exam: {
        desc: "昇段のしけん。型・実戦・心眼の三本。",
        kata: { items: 20, accuracy: 0.97, guideLevel: 1 },
        jissen: { seconds: 90, kpm: 120, accuracy: 0.96, guideLevel: 1 },
        shingan: { items: 5, accuracy: 0.97, guideLevel: 0 }
    } },
    { id: "kage", label: "影", mapAccent: "gekko", secret: true, exam: {
        desc: "昇段のしけん。型・実戦・心眼の三本。",
        kata: { items: 25, accuracy: 0.98, guideLevel: 1 },
        jissen: { seconds: 120, kpm: 150, accuracy: 0.97, guideLevel: 1 },
        shingan: { items: 6, accuracy: 0.98, guideLevel: 0 }
    } }
  ],
  jissenMenu: [
    { id: "word-jissen", label: "ことばの実戦", kind: "word", seconds: 60, source: "DAN_WORDS", desc: "60びょうで、ことばをどこまでうてるか。" },
    { id: "sentence-jissen", label: "文章の実戦", kind: "sentence", seconds: 90, source: "DAN_SENTENCES", desc: "90びょうで、文をうちつづける。" },
    { id: "shippu", label: "疾風番付", kind: "banzuke", desc: "タイムアタック。スコアで手裏剣のTierがきまる。" },
    { id: "weak", label: "弱点特訓", kind: "weak", items: 10, source: "DAN_WORDS", desc: "ミスのおおいキーを、しゅうちゅうできたえる。" }
  ],
  banzuke: {
    seconds: 60,
    tierOrder: ["無位", "銅", "銀", "金", "白金", "月光"],
    courses: [
      { id: "michi-genin", label: "下忍の道", dan: "genin", wordsRef: "MICHI_GENIN", desc: "ことばと、みじかいことわざの道。" },
      { id: "michi-chunin", label: "中忍の道", dan: "chunin", wordsRef: "MICHI_CHUNIN", desc: "ことわざと俳句の道。" },
      { id: "michi-jonin", label: "上忍の道", dan: "jonin", wordsRef: "MICHI_JONIN", desc: "みじかい名文の道。" },
      { id: "michi-tokujonin", label: "特上忍の道", dan: "tokujonin", wordsRef: "MICHI_TOKUJONIN", desc: "名文と百人一首の道。" },
      { id: "michi-kage", label: "影の道", dan: "kage", wordsRef: "MICHI_KAGE", desc: "古典のながい名文。いちばんけわしい道。" }
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
