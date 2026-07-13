const NICKNAME_DATA = globalThis.NICKNAME_DATA = [
  { id: "hajimari", name: "はじまりの一歩", cond: { type: "stage_clear", id: "nyumon4" }, desc: "入門・肆に合格した" },
  { id: "kaiden", name: "免許皆伝", cond: { type: "stage_clear", id: "kyu1" }, desc: "1級に合格した" },
  { id: "seijaku", name: "静寂（せいじゃく）の指", cond: { type: "exam_nomiss" }, desc: "ためしをノーミスでかけぬけた" },
  { id: "fudo", name: "不動の構え", cond: { type: "rhythm_hold" }, desc: "気配「不動」を長くたもった" },
  { id: "kaigan", name: "心眼開眼", cond: { type: "first_pass_guide0" }, desc: "心眼の試しに合格した" },
  { id: "senbon", name: "千本打ち", cond: { type: "total_correct", value: 1000 }, desc: "累計正打1000" },
  { id: "manda", name: "万打の行者", cond: { type: "total_correct", value: 10000 }, desc: "累計正打10000" },
  { id: "jumanda", name: "十万打の達人", cond: { type: "total_correct", value: 100000 }, desc: "累計正打100000" },
  { id: "nanoka", name: "七日修行", cond: { type: "streak", value: 7 }, desc: "7日連続で修行" },
  { id: "misoka", name: "三十日修行", cond: { type: "streak", value: 30 }, desc: "30日連続で修行" },
  { id: "ippatsu", name: "一発の忍", cond: { type: "dan_first_try" }, desc: "昇段試験に一発合格" },
  { id: "jakuten", name: "弱点討伐", cond: { type: "weak_key_master" }, desc: "弱点キーを克服した" },
  { id: "hayate", name: "疾風走り", cond: { type: "kpm_reach", value: 100 }, desc: "実戦でKPM100に届いた" },
  { id: "onsoku", name: "音速の忍", cond: { type: "kpm_reach", value: 150 }, desc: "実戦でKPM150に届いた" },
  { id: "kanzen", name: "完全なる型", cond: { type: "exam_perfect" }, desc: "型の試しを正確率100%で合格" },
  { id: "hidensho", name: "秘伝書の主", cond: { type: "all_scrolls" }, desc: "巻物をすべて集めた" },
  { id: "hyakuren", name: "百連の手", cond: { type: "combo_reach", n: 100 }, desc: "百れんぞく、ひとつもミスをしなかった" }
];
