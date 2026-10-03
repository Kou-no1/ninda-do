const GAME_DATA = globalThis.GAME_DATA = {
  label: "巻物便",
  desc: "ことばをうって、巻物を里へとどける。正しくうつほど、荷物がふえる。",
  guideLevel: 1,
  scoring: { delivery: 10, fastBonus: 10 },
  travel: { baseSeconds: 3, secondsPerKey: 0.55 },
  courses: [
    { id: "sato-bin", label: "里の便", desc: "みじかいことばで、里をひとまわり。", dan: "genin", seconds: 60, minLength: 2, maxLength: 4 },
    { id: "yama-bin", label: "山の便", desc: "山の道を、ひとつずつわたろう。", dan: "chunin", seconds: 75, minLength: 4, maxLength: 6 },
    { id: "tsuki-bin", label: "月の便", desc: "ながいことばを、月の下でとどける。", dan: "jonin", seconds: 90, minLength: 5, maxLength: 8 }
  ]
};
