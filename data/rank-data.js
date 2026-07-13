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
    { id: "shippu", label: "疾風（しっぷう）の術", kind: "timeAttack", seconds: 30, source: "DAN_WORDS" },
    { id: "weak", label: "弱点特訓", kind: "weak", items: 10, source: "DAN_WORDS" }
  ]
};
