const GAME_DATA = globalThis.GAME_DATA = {
  label: "巻物便",
  desc: "ことばをうって、巻物を里へとどける。正しくうつほど、荷物がふえる。",
  guideLevel: 1,
  scoring: { delivery: 10, fastBonus: 10 },
  travel: { baseSeconds: 3, secondsPerKey: 0.55 },
  replay: { version: 1, maxDeliveries: 500 },
  journey: { deliveriesPerScene: 2, cleanDeliveries: 3, combo: 20, accuracy: 0.98 },
  routes: [
    { id: "roof", label: "里の屋根", destination: "門番の家" },
    { id: "bamboo", label: "竹林", destination: "竹林の小屋" },
    { id: "bridge", label: "山の橋", destination: "山の道場" },
    { id: "garden", label: "庭の近道", destination: "里の書庫", special: true }
  ],
  outfits: [
    { id: "head-ai", slot: "head", name: "あいのずきん", desc: "はじめの身じたく。", condition: { type: "default" } },
    { id: "head-moon", slot: "head", name: "月のずきん", desc: "正しく100回うつ。", condition: { type: "correct", n: 100 } },
    { id: "head-leaf", slot: "head", name: "葉のずきん", desc: "30回いじょう・せいかくりつ95%いじょうで修行をおえる。", condition: { type: "accuracy", n: 30, accuracy: 0.95 } },
    { id: "belt-ai", slot: "belt", name: "あいのおび", desc: "はじめの身じたく。", condition: { type: "default" } },
    { id: "belt-plum", slot: "belt", name: "むらさきのおび", desc: "おさらいを3回おえる。", condition: { type: "review", n: 3 } },
    { id: "belt-wave", slot: "belt", name: "波のおび", desc: "30れんぞく正しくうつ。", condition: { type: "combo", n: 30 } },
    { id: "bag-plain", slot: "bag", name: "はじめの巻物ぶくろ", desc: "はじめの身じたく。", condition: { type: "default" } },
    { id: "bag-wave", slot: "bag", name: "波の巻物ぶくろ", desc: "巻物を10本とどける。", condition: { type: "delivered", n: 10 } },
    { id: "bag-moon", slot: "bag", name: "月の巻物ぶくろ", desc: "正しく1000回うつ。", condition: { type: "correct", n: 1000 } }
  ],
  courses: [
    { id: "sato-bin", label: "里の便", desc: "みじかいことばで、里をひとまわり。", dan: "genin", seconds: 60, minLength: 2, maxLength: 4 },
    { id: "yama-bin", label: "山の便", desc: "山の道を、ひとつずつわたろう。", dan: "chunin", seconds: 75, minLength: 4, maxLength: 6 },
    { id: "tsuki-bin", label: "月の便", desc: "ながいことばを、月の下でとどける。", dan: "jonin", seconds: 90, minLength: 5, maxLength: 8 }
  ]
};
