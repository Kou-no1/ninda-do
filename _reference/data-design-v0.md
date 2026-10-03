# data-design-v0

`data/*.js` はすべて `const XXX = globalThis.XXX = ...` のグローバル定数として定義する。

- `FINGER_DATA`: キー、標準運指、指色、指ラベル、先生の観察項目。
- `ROMAJI_TABLE`: かなからローマ字候補。配列先頭は表示優先候補。
- `CURRICULUM_DATA`: 入門、10級から1級までのステージ、guideLevel、修行、試験、授与巻物。
- `RANK_DATA`: 下忍以降の段位、三の試し、実戦メニュー。
- `JUTSU_DATA`: 術と巻物15件。
- `NICKNAME_DATA`: 二つ名19件と獲得条件。実在する評価器の一覧をintegrityで照合する。
- `words/*.js`: 各級の印、語彙、短文。級語彙はその級までの累積かなと累積キーだけで打てること。

調整は原則として `data/*.js` の編集だけで完結させる。

## ステージと段位

```js
{ id, label, type:"nyumon"|"kyu", title, newKeys:[], newKana:[], jutsu:[], wordsRef,
  guideLevelTraining:0|1|2|3, guideLevelExam:0|1|2|3,
  training:[{kind:"letter"|"in"|"word"|"sentence",label,count,desc?}],
  exam:{kind,items,accuracy} }
```

CURRICULUM_DATA.reviewはlabel/desc/counts（in/word/sentence）。復習は現段階のプールと級累積キーだけを用いる。入門キーを累積へ混ぜない。

RANK_DATA.dansの各項目はid/label/mapAccent/flavor。geninはgrantedBy:kyu1、他はexam:{desc,kata,jissen,shingan}。kata/shinganはitems/accuracy/guideLevel、jissenはseconds/kpm/accuracy/guideLevel。特上忍・影だけsecret:true。
RANK_DATA.jissenMenuはid/label/desc/kind/unlockDan、任意でseconds/items/source/genre。MICHI_ALLは5コースの仮想結合プール、genreで絞る。
RANK_DATA.banzukeはseconds/tierOrder/courses/tiers。courseはid/label/desc/dan/wordsRef、tiers[courseId]は銅/銀/金/白金/月光の数値。

## コンテンツ

JUTSU_DATAはid/kind:jutsu|maki/name/desc/icon/crest。NICKNAME_DATAはid/name/desc/cond。
cond.typeはstage_clear(id)、exam_nomiss、rhythm_hold、first_pass_guide0、total_correct(value)、streak(value)、dan_first_try、weak_key_master、kpm_reach(value)、exam_perfect、all_scrolls、combo_reach(n)、tier_reach(tier)、tier_all(tier)。
NYUMON_WORDS={furigana:{a:エー,...},sections:{nyumon1:[],...}}。KYU*_WORDS={stage,in:[],words:[],sentences:[]}。DAN_WORDS={words:[]}、DAN_SENTENCES={sentences:[]}。

```js
const MICHI_JONIN = {course:"michi-jonin",items:[
  {kana:"わがはいはねこである。なまえはまだない。",
   display:"吾輩は猫である。名前はまだ無い。",source:"夏目漱石『吾輩は猫である』",
   ruby:[["吾輩","わがはい"],["は"],/* 発注者指定の続き */],genre:"meibun"}
]};
```

例のrubyは省略形。実データでは全第1成分を連結するとdisplayになる。36本の提供データは変更せず、genre内訳はkotowaza9/meibun15/koten12、未指定はoriginal。

## セーブの追加フィールド

v=1、キーnindaDoSaveV1を維持する。既存name/createdAt/currentStage/clearedStages/dan/scrolls/nicknames/equippedNickname/totals/keyStats/best/streak/settings/eventLogに以下を後方互換で補う。

| フィールド | 既定 | 意味 |
|---|---|---|
| unlockedStage | currentStage・修行済み地点・合格済みの後続から推定 | 選択と独立した最遠解放地点 |
| practicedStages | [] | 完了した級・入門修行 |
| practicedDans | [] | 現在段位で実戦を完了し、実打鍵があった段位 |
| examAttempts | {} | 段位別に開始した試験回数、初回合格判定に使う |
| weakTargets | [] | ミス率10%超で弱点になったことがあるキー |
| keyStats[key].recent | [] | 直近20打のtrue/false |
| best.rhythm | — | 最高気配 |
| best.combo | 0 | 生涯最大連続正打 |
| best.banzuke | {} | コース別score/tier/date、自己ベストだけ更新 |
| settings.display | night | night/light |
| settings.teacherMode | false | 設定以外の書き込みをSaveManagerで遮断 |
| settings.kanjiDisplay | true | display/ruby行の有無、判定はkana |

totals.keys=correct+miss、wordsは完了お題数。時間は単調時計、停止時間を除外。級summaryと級session_endにはKPMフィールドを持たせない。
session_endはid/mode/completed/correct/miss/acc/rhythm/maxCombo/words/keyStats、時間制jissenのみkpm。eventLogは200件。
runnerは保存済み打鍵・お題・キー統計との差分を30秒/終了/unloadへ渡す。最終評価/最大値は回の全体値。中断はcompleted:falseで合格/修行完了扱いにしない。

完全バックアップはformat:ninda-do-backup/version:1/exportedAt/save、2MiB上限。検査・差分確認後にSaveManager.restoreBackupで置換。先生フラグはOFFへ。合言葉はビット集合の簡易復元で、詳細記録や獲得順は保持しない。
先生の観察チェックは保存データに含めず、描画側のSetだけ。syncAdapterはonEvent/flush、既定null。全イベント経路を統一し、例外を保存へ波及させない。
