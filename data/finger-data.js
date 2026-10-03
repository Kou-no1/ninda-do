const FINGER_DATA = globalThis.FINGER_DATA = {
  observations: [
    { id: "home", label: "FとJの突起に、人さし指をおける" },
    { id: "fingers", label: "キーを、決められた指でうてる" },
    { id: "return", label: "うったあと、ホームポジションにもどれる" },
    { id: "eyes", label: "手元を見すぎず、画面のお題を読める" },
    { id: "posture", label: "肩と手首に力を入れず、むりのない姿勢でうてる" }
  ],
  keys: {
    q: { finger: "L5", row: "top" }, a: { finger: "L5", row: "home" }, z: { finger: "L5", row: "bottom" },
    w: { finger: "L4", row: "top" }, s: { finger: "L4", row: "home" }, x: { finger: "L4", row: "bottom" },
    e: { finger: "L3", row: "top" }, d: { finger: "L3", row: "home" }, c: { finger: "L3", row: "bottom" },
    r: { finger: "L2", row: "top" }, f: { finger: "L2", row: "home" }, v: { finger: "L2", row: "bottom" },
    t: { finger: "L2", row: "top" }, g: { finger: "L2", row: "home" }, b: { finger: "L2", row: "bottom" },
    y: { finger: "R2", row: "top" }, h: { finger: "R2", row: "home" }, n: { finger: "R2", row: "bottom" },
    u: { finger: "R2", row: "top" }, j: { finger: "R2", row: "home" }, m: { finger: "R2", row: "bottom" },
    i: { finger: "R3", row: "top" }, k: { finger: "R3", row: "home" }, ",": { finger: "R3", row: "bottom" },
    o: { finger: "R4", row: "top" }, l: { finger: "R4", row: "home" }, ".": { finger: "R4", row: "bottom" },
    p: { finger: "R5", row: "top" }, ";": { finger: "R5", row: "home", displayOnly: true }, "-": { finger: "R5", row: "top" }
  },
  fingerColors: {
    L5: "#D98CA6", L4: "#E0AF63", L3: "#9CBF6E", L2: "#6FA8DC",
    R2: "#6FA8DC", R3: "#9CBF6E", R4: "#E0AF63", R5: "#D98CA6", T: "#B9B4A8"
  },
  fingerSymbols: { L5: "左小", L4: "左薬", L3: "左中", L2: "左人", R2: "右人", R3: "右中", R4: "右薬", R5: "右小", T: "親" },
  fingerLabels: {
    L5: "ひだりの こゆび", L4: "ひだりの くすりゆび", L3: "ひだりの なかゆび", L2: "ひだりの ひとさしゆび",
    R2: "みぎの ひとさしゆび", R3: "みぎの なかゆび", R4: "みぎの くすりゆび", R5: "みぎの こゆび", T: "おやゆび"
  }
};
