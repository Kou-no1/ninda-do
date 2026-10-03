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

## v1.10.0 追加データと保存

LEARNING_DATAはreview:{intervals,accuracy,count}、mastery:{minAttempts,secure,developing}、lesson:{format,version,maxBytes,maxItems,maxLength}、drills:[id,label,desc,kana?,count,minMisses?]、missions:[id,title,story,after,goal,n,unlockDan?,reward]、readingNotes:{source:独自解説}。
GAME_DATAはlabel/desc/guideLevel、scoring:{delivery,fastBonus}、travel:{baseSeconds,secondsPerKey}、courses:[id,label,desc,dan,seconds,minLength,maxLength]。RANK_DATA.jissenMenuのcourierは独立した3便選択を開く。

```js
{ unitStats: {"ん": {attempts: 20, misses: 2}},
  confusions: {"f>j": 3},
  learning: {
    reviews: {kyu4: {step: 0, due: "2026-10-04", last: "2026-10-03"}},
    counters: {practice: 0, review: 0, calm: 0, delivered: 0},
    missions: [], readings: [], lessonPack: null, completedLessons: []
  },
  best: {courier: {"sato-bin": {score: 100, words: 8, date: "2026-10-03"}}},
  settings: {textSize: "normal", lineSpacing: "normal", fingerSymbols: false, reduceMotion: false}
}
```

readingsは提供名文のkanaを安定キーとして格納する。completedLessonsは直近100個の内容ハッシュID。lessonPackは最後に明示取込みした一つの課題。複数プロファイル／クラス情報は持たない。
課題形式は`{format:"ninda-do-lesson",v:1,title,stageId,kind,items:[string],rights:"original-or-permitted",id}`。idは正規化内容のFNV-1a識別子（暗号／安全性の証明ではない）。取込み時に再計算する。
session_end追加はstageId/purpose/lessonId/readings/delivered。中断では学習予定・任務・読書・課題完了を加算しないが、実打鍵のunitStats/confusionsは差分保存する。完全バックアップには追加記録を含み、合言葉の収録フィールドは従来のまま。

## v1.11.0 追加データと保存

GAME_DATAにreplay:{version,maxDeliveries}、journey:{deliveriesPerScene,cleanDeliveries,combo,accuracy}、routes:[{id,label,destination,special?}]、outfits:[{id,slot,name,desc,condition}]を追加する。slotはhead/belt/bag、condition.typeはdefault/correct/accuracy/review/combo/delivered。LEARNING_DATA.coachingは[{id,parts,drill,text}]で、既存の小修行を参照する。

```js
{ game: {
    owned: ["head-ai", "belt-ai", "bag-plain"],
    equipped: {head: "head-ai", belt: "belt-ai", bag: "bag-plain"},
    replays: {"sato-bin": {v: 1, seed: 42, signature: "content-id", times: [800, 1600], score: 35}}
  }
}
```

装備は所持とslotを照合し、欠損時は初期3点へ補う。リプレイは各便の直近完了1回。v/seed/識別子/非負得点/昇順の時刻/上限/便の時間内を検査し、異なる内容の旧リプレイは除外する。timesは一時停止を除くミリ秒で、打鍵列・名前は含まない。先生モードのsaveCourierReplay/equipOutfit/報酬付与もSaveManager中央ゲートで書かない。

共通お題コードは`ND{version}-{course序数}-{seedの36進}-{内容識別子}-{誤記チェック}`。識別子とチェックはFNV-1aの36進表現で、暗号・認証ではない。コース・語彙・ガイド・採点・移動・分かれ道・ローマ字・お題間遷移を識別対象にする。ルールを互換性なく変えるときはreplay.versionも上げる。保存・復元のかな合言葉は別形式のまま。
