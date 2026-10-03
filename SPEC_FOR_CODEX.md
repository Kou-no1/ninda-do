# 忍打道 —NINDA DO— 現行統合仕様 v1.9.0

正式名称は **忍打道 —NINDA DO—**（にんだどう）。ロゴ・タイトル・README・metaを統一する。
発注者: Kou-no1。原仕様発注日: 2026-07-13。
リポジトリ: https://github.com/Kou-no1/ninda-do.git 。公開: https://kou-no1.github.io/ninda-do/ 。

本書は原仕様v1.0、承認済みPATCH-01〜10、2026-10-03の監査改善を統合した現行仕様であり、原文の逐語複製ではない。原仕様の絶対規則は維持する。履歴は `_reference/patch-history.md`、判断・検証・語彙監査表は `IMPLEMENTATION_NOTES.md`。スキーマ詳細は `_reference/data-design-v0.md`、全カリキュラム数値は `_reference/curriculum-map.md` と一体で読む。

## 0. 目的・絶対規則

小学1〜6年生がホームポジションと正しい指使いを習得してから速さへ進む、依存0のタイピング修行アプリ。基準環境は学校Chromebookの最新Chrome・1366×768。1024pxでも横スクロールしない。物理キーボード必須、スマホ・タッチのみ非対応。

1. 入門〜1級は速度を表示せず、KPM/WPM/速度スコアのDOMも生成しない。先生モードでも例外なし。評価は正確率・気配。連続正打の連撃は速度ではない。
2. ミスは入力を消費せず、正しいキーまで同じ文字に留まる。
3. ガイド量はdataのguideLevelで決まり、級ごとのハードコードは禁止。
4. 1級合格で免許皆伝・下忍・疾風の術、時間制実戦のKPMを解禁する。
5. 不合格を罰にせず「まだ機（き）は熟していない。もういちど修行だ！」と不足基準を示す。何度でも再挑戦可能。
6. ビルド・ES Modules・fetch/XHR・CDN・Webフォント・ライブラリは禁止。通常script順次読み込み。file://で全機能、相対パス、実行時外部HTTP(S)リクエスト0。
7. 画像はインラインSVG、音はWebAudio合成、読み上げはWeb Speech API。画像/音声ファイルは禁止。JSから読まない静的メタfavicon.svg/og.pngだけ例外。
8. 保存はlocalStorage。syncAdapterは既定null、実送信を実装しない。ロジックjsと語彙/難易度/技能/合格基準dataを分離する。
9. KeyboardEvent.keyでJIS/US対応。にんじゃネームは10文字まで、ひらがな/カタカナ/英数等。「ほんとうの名まえじゃなくていいよ」。本名・個人情報・アカウントを持たない。
10. 実際の指使いはキーイベントでは測れない。アプリ合格は打鍵の判定で、身体の運指は先生の観察で補う。

### ファイル・順序

ルート: index.html/style.css/README.md/SPEC_FOR_CODEX.md/IMPLEMENTATION_NOTES.md/favicon.svg/og.png/poster.html。
_reference: data-design-v0.md/curriculum-map.md/ui-mockup.html/patch-history.md。
data: finger/romaji/jutsu/nickname/curriculum/rankの各-data.js、wordsにはnyumon・kyu10〜1・dan単語/文章・michi5コース。
js: main/input-engine/metrics-engine/guide-renderer/training-manager/exam-manager/achievement-manager/collection-renderer/save-manager/audio-manager/svg-icons。
scripts: check-data-integrity.mjs/check-system-regressions.mjs/check-browser-regressions.mjs。
追加ファイルの理由はNOTESに残す。

script順: finger→romaji→jutsu→nickname→curriculum→rank→words（入門/10級〜1級/dan/michi）→svg-icons→save→audio→input→metrics→guide→training→exam→achievement→collection→main。posterはfinger→svg-icons→guide→初期化のみ。

## 1. 世界観・文言

舞台は「キーの里」、道場は「忍打道場」。師匠は既存IPに似せない動物忍者SVG。
キャッチ: **型（かた）をきわめた者だけが、疾風（はやて）をゆるされる。——それが、忍打道。**

修行=練習、試し=試験、印=鍛錬キー列、術/巻物=修得技能、免状=プロフィール、二つ名=称号、気配=リズム、免許皆伝=1級合格、疾風=下忍以降の速さ。
入門・壱/弐/参/肆→10級〜1級→下忍→中忍→上忍→特上忍→影。
既存作品の固有名詞・技名・キャラは禁止。「特別上忍」や「火影」等にしない。
児童向け文は小学3年生が読める表記、難しい漢字はruby/ひらがな。UI_TEXTはmain.js冒頭、固有コンテンツ説明はdata。

## 2. 画面・操作・表示

| ID | 画面 | 内容 |
|---|---|---|
| S0 | 里の門 | ロゴ・月・キャッチ・にんじゃネーム。初めては入門、既習者は10級。既存セーブはつづきから |
| S1 | 里 | 3区画のマップ、現在地、次の修行、巻物庫/免状/設定 |
| S2 | 修行 | お題・かな進捗・ローマ字窓・出典・指ガイド・正確率・気配・連撃。時間制実戦だけKPM/残り秒 |
| S3 | 試し | 昇級または三の試し。連撃/手裏剣は生成しない |
| S4 | 巻物庫 | 巻物紋章・二つ名短冊・疾風番付 |
| S5 | 免状 | 名前/二つ名/段位/累計/最高気配/連撃/番付最高位/成長記録/印刷/合言葉 |
| S6 | 設定 | 音/明表示/漢字表示/ポスター/観察表/完全バックアップ/合言葉復元/二段階削除/version/先生モード |

sectionをhiddenで遷移。Tab/Enter/Esc、可視フォーカス。修行中Escは確認後中断し、結果・罰を出さない。打った分は保存するが、修行完了/合格にはしない。

### ガイド・IME・長文

guide3=ローマ字＋キーボード＋両手、2=ローマ字＋キーボード、1=ローマ字のみ、0=なし。
ミスは小さな朱フラッシュ/控えめな音。同じunit2連続ミスは期待キー/指を3秒または正打まで救済表示。正打で元のguideLevelへ戻す。
入門は大文字48px以上＋カタカナ読み、guide常時3、設定ONで読み上げ。
IME警告はプレイ中・編集要素以外だけ。compositionstart/229/isComposingで停止、compositionend/素の1打/Esc/わかったで再開。再開用1打は採点しない。名前入力には警告しない。
長文のかなサイズは12字以下48〜72px、24字以下36px、44字以下30px、45字以上26px。しきい値はPROMPT_LAYOUT_CONFIG。折り返し/可変高さで現在文字を隠さない。ローマ字は直近8字＋先20字。
漢字表示既定ON。displayがあれば上段の読む漢字行、下段の打つkana。ruby第1成分連結=display。漢字に進捗を付けず、判定はkanaだけ。sourceは下部に常時表示。OFFまたはdisplayなしはかなのみ。guide0でも漢字/かなは残す。

### モーダル

メニューは名前/説明/メタの縦カード。↑↓/Tab循環/Enter、先頭フォーカス、ロック理由。Esc/背面で閉じる。級メタは件数・精度・ガイドだけ、秒や速度なし。番付選択は同じoverlay内で差し替える。
結果は紙dialog/aria-modalで、正確率・気配・連撃・ミスキー3・前回自己比較。時間制実戦だけKPM、番付だけスコア/Tier/ベスト帯。再挑戦は修行/試験全体。Tab循環、Enterはフォーカス中の操作（初期はもういちど）、Escは里。背面では閉じない。
終了後・モーダル中・問題切り替え中・停止中は入力しない。修飾キーのショートカットとキーリピートは採点しない。

### 夜テーマ・明表示・印刷

夜の藍#111C2E、深夜#0B1220、月白#ECE7D8、紙#FFF9EA、墨#2A2622。提灯#E8A33Dは現在地/フォーカス/次キー。朱=ミス、金=報酬、竹=正打。
紙はお題札・巻物・短冊・免状・ダイアログ等の道具。スタンプ/朱印/旅地図/切符風は禁止。明表示はbody[data-theme=light]の変数ブロックのみ。本文4.5:1、お題7:1。淡色Tierは紋章色と読める文字色を分ける。
マップは入門4列/級4列/下忍中忍2列/上忍以上全幅。1024px以下は2/2/1/1列、修行操作をマップより上へ置く。上忍は金、特上忍は寒色白金#DCE3EA、影は白金外枠/紫内罫/紫の靄/大きな月、名前だけグロー。提灯現在地リングは外側。
特上忍/影は直前段位で開示、未解禁は「？？？」。先生は全開示。開示再生フラグはページ内だけ。
Webフォントなし、日本語システムフォント、数値tabular-nums。reduced-motionは静止/即配置。
免状はA4縦18mm余白、白地墨、最近3紋・気配/正打/連撃/番付/発行日、1枚。ポスターはA4横12mm余白、同一FINGER_DATAの指色・キー・凡例、1枚。観察表は先生の実観察を一時チェックし、児童の進捗に保存しない。A4縦1枚。
SEは正打三角波約60ms、ミス控えめ矩形波約120ms、合格アルペジオ、昇段低音2打＋アルペジオ。初回操作でresume。読み上げja-JP/rate0.9、英字はカタカナ、OFF/中断で停止。
連撃=連続正打。5からS2のみ、ミスは無音フェード。10の倍数で手裏剣、最大5枚。途切れた後の10も再演出。SE約40ms。最大連撃を保存。

## 3. データ・保存

グローバルconstを使う。FINGER_DATA=キー/運指/指色/ラベル/観察、ROMAJI_TABLE=訓令優先候補、CURRICULUM_DATA=stages/review、RANK_DATA=段位/試験/実戦/番付、JUTSU_DATA=15術、NICKNAME_DATA=19称号、words=語彙。
キー/かな累積はtype:kyuのみ。入門26キーは独立し混ぜない。運指はL5=qaz/L4=wsx/L3=edc/L2=rfvtgb/R2=yhnujm/R3=ik,/R4=ol./R5=p;-。;は表示だけ。指色は小指#D98CA6、薬指#E0AF63、中指#9CBF6E、人差し指#6FA8DC、親指#B9B4A8、左右対称、変更禁止。
項目は文字列または{kana,display?,source?,ruby?,genre?}。打鍵はひらがな＋ー、。のみ、空/重複なし。級は累積かな/キーで打てること。通常語彙は学校/自然/季節/忍者、人名/商品名等禁止。
kyu7>=20語、kyu6〜2>=30語、kyu1>=15文、dan>=100語/30文、dan文12〜30字。級語2〜6字原則、PATCH承認済みkyu2の7〜8字は例外。番付は30/46/37/36/34本、計183。提供名文36本のkana/display/source/rubyは改変禁止。genre9ことわざ/15名文/12古典、未指定147本はoriginal。
引用は認定の保護期間満了日本語原文・作者不詳伝承・独自創作のみ。翻訳/現代作者/歌詞/作品台詞は禁止。追加引用は作者/没年/出典を確認しNOTES一覧で発注者監査を受ける。歴史的表記displayは保存、kanaは現代仮名遣い。

### セーブv1（後方互換）

localStorageキーnindaDoSaveV1。基本形は以下、詳しい既定値/意味はdata-designを参照。

```js
{v:1,name,createdAt,currentStage,unlockedStage,practicedStages:[],practicedDans:[],clearedStages:[],dan,
 scrolls:[],nicknames:[],equippedNickname,totals:{keys,correct,miss,words},keyStats:{},
 examAttempts:{},weakTargets:[],best:{shippuScore,kpm,rhythm,combo,banzuke:{}},streak:{last,days},
 settings:{se:true,voice:true,display:"night",teacherMode:false,kanjiDisplay:true},eventLog:[]}
```

currentStage=選択、unlockedStage=最遠解放。旧保存はcurrentStage・practicedStages・clearedStagesの次地点から推定。過去の選択/合格で進捗や段位を後退させない。
totalsは実打鍵だけ、wordsは完了お題だけ。30秒・beforeunload/pagehide・非表示・終了で差分保存し二重加算しない。修行完了だけで試験ゲートを開き、無入力の時間待ちは実施にしない。
streakはJST、今日不変/昨日+1/それ以外1。作成だけでは増やさない。
eventLog直近200件、kyu_pass/kyu_fail/dan_pass/dan_fail/scroll_get/nickname_get/session_end。session_endに精度/気配/キー/連撃/完了状態、級にはKPMフィールドなし。
全eventは共通appendからadapter.onEventへ、終了/unloadでflush。アダプタ例外はプレイを止めない。保存失敗はページ内メモリを正本にし、警告/バックアップ案内。破損保存を自動上書きしない。
合言葉はv/級序数/dan序数/巻物16bit/二つ名24bit/正打÷100の24bit飽和値/streak8bitとCRC8(0x07)。かな32字、5字区切り。旧12byte/新13byte対応。獲得ID集合を保つが獲得順/正打下2桁/keyStats/best/logは含めず注記する。
完全バックアップはJSON {format:"ninda-do-backup",version:1,exportedAt,save}。FileReader、2MiB上限、形式/数値/参照を検査。差分確認後だけ置換。先生OFFで復元し、復元後もOFF。削除は二段階＋直前合言葉。

## 4. 入力エンジン

DOMなしInputEngine: start(text,context)、onEvent/handleKey/displayRomaji/nextExpectedKeys/progress/isDone。segment/isTypeable/preferredRomajiは純関数。
拗音は最長一致、っ/ん/句読点は単独unit。候補接頭辞で絞り、正打の状態遷移を完了してから発火する。kana/unitIndex/expectedKeysは打鍵前の所属を保つ。

```js
{ts,key,correct,expectedKeys,kana,unitIndex,guideLevel,mode} // training / exam / jissen
```

英字26（大文字小文字化）・-・,・.を受理。key.length>1はignore、ミスは状態不変、表示は分岐追従。
っはxtu/ltu/ltsuまたは次の先頭子音1打（a/i/u/e/o/n以外）。んはnn/xn常時可、n単打は次unit全候補がa/i/u/e/o/n/y以外のときだけ。語末/母音/な行/や行前はnn。
isTypeableはキー集合内の完走経路が少なくとも一つあるか判定し、全経路列挙しない。
MUST: sika/shika、tizu/chizu、gakkou/gaxtukou/galtukou、kitte/kixtute、tyawann/chawann、sanpo/sannpo、kinniro、honnya、ninzya/ninja/ninnjya、ra-menn、issyo/issho/ixtusyo、ha,siru.。gakou/tyawan/kiniro/honya/ra-menは不正。raw asdfも含めイベント時点のガイド追従を検査。

## 5. メトリクス・成長

精度=正打/(正打+ミス)、ignore除外。無打鍵表示100%でも問題完了がなければ合格しない。
KPM=正打×60/実経過秒、時間制jissenだけ。performance.nowの単調時計、停止除外、終了は所定制限秒。カウントダウンは締切から計算しinterval回数で測らない。初打瞬間ピークで称号を与えず完了KPMを使う。
気配=連続正打間隔、3000ms超と停止は除外、窓30/最小10、CV<.35不動/<.60静/<.90並/以上乱。回の評価はCV中央値、不動維持率は有効更新割合。
キー統計は期待優先キーへattempts/misses/sumLatency（上限3000ms）、recent直近20。弱点は10打以上かつミスありの率順5。級復習は既習キーのみ、段位弱点特訓10語、不足は通常プール。以前弱点だったキーの直近20が90%以上で弱点討伐。
前回同じ修行の精度・気配・キー改善と比較し、免状に直近8完了記録。級に速度、他者比較は出さない。

## 6. カリキュラム・試験・実戦

全段階のnewKeys/newKana/授与/guide/修行数/試験数と精度は `_reference/curriculum-map.md` の全数値表とdataを参照。
入門4段は中段9キー/上段10/下段7/26総ざらい、guide3、試験20字85%、肆でmoji。
級は10:f j→9:a s d k l→8:g h→7:i u e o→6:t→5:n m→4:y r w→3:z b p→2:- x→1:, .。1級でshingan/menkyo/shippuとgenin。
級復習の追加は進級基準を変えない。試しは修行完了1回で開く。三の試しも現在段位で実戦完了が必要、先生はバイパス。
三の試しは①型単語→②実戦時間制文章→③心眼短文guide0の通し。どれか不足で不合格、再挑戦は①から。中断で移行タイマーを取り消す。各試しの実打鍵を一度だけ保存する。

| 昇段先 | 型:語数/精度/guide | 実戦:秒/KPM/精度/guide | 心眼:文数/精度/guide |
|---|---|---|---|
| 中忍 | 15/96%/1 | 60/60/94%/1 | 3/96%/0 |
| 上忍 | 20/97%/1 | 90/90/95%/1 | 4/97%/0 |
| 特上忍 | 20/97%/1 | 90/120/96%/1 | 5/97%/0 |
| 影 | 25/98%/1 | 120/150/97%/1 | 6/98%/0 |

閾値は仮値、rank-dataだけで調整。初回通し合格=ippatsu、型100%=kanzen、試験全体ミス0合格=seijaku、guide0合格=kaigan。
実戦は下忍:ことば60秒/文章90秒/疾風番付/弱点10語（時間/速度なし）、上忍:名文90秒/古文120秒。名文/古文は5michi結合のgenreフィルタ、Tier/スコアなし。時間制はプールを補充して締切まで続く。プール一巡は重複なしランダム、尽きた後だけ再利用。

### 疾風番付

全60秒（banzuke.seconds）、guide1、自段位以下のコースを解放。スコア=round(正打×精度)、自己ベストだけ{score,tier,date}を保存。先生は全解放/無記録。

| 道 | 銅 | 銀 | 金 | 白金 | 月光 |
|---|---|---|---|---|---|
| 下忍 | 30 | 45 | 60 | 80 | 100 |
| 中忍 | 40 | 60 | 80 | 100 | 125 |
| 上忍 | 50 | 70 | 95 | 120 | 150 |
| 特上忍 | 60 | 85 | 110 | 140 | 175 |
| 影 | 70 | 95 | 125 | 160 | 200 |

未到達は無位。Tierは手裏剣バッジ、月光のみ満月短演出、reduced-motion静止。S4にベスト/Tier/日付/次Tier差/解放理由、免状と印刷に最高位。月光称号=どこか月光、五道の覇者=全道金以上。

## 7. 受入基準（原仕様22項目）

1. file://全機能、通常起動エラー0。
2. 実行時外部リクエスト0。
3. 級の速度DOMなし、先生も同じ。
4. ミスで進まない。
5. 同一unit2連続ミス救済3秒/正打まで。
6. data guideLevel変更で表示変更。
7. MUST/ガイド追従全通過。
8. IME停止/再開、名前入力警告なし。
9. 入門読み上げ、OFF/設定永続。
10. 昇級術授与とリロード保持。
11. 1級免許皆伝/下忍/疾風解禁。
12. 三の試し全基準でだけ昇段。
13. seijaku/senbon/nanoka等の獲得条件と確認手順。
14. 免状に名前/二つ名/段位/累計/最高気配。
15. 合言葉の収録フィールド復元。
16. 削除二段階＋直前合言葉。
17. 1366×768/1024横スクロールなし。入門・短い級の語は48px以上、長文はPATCH-07の段階縮小・折り返しを適用。
18. SE設定保存、ミス音控えめ。
19. integrity exit0、不正dataで非0＋原因。
20. 弱点特訓優先語。
21. JST streak今日/昨日/間隔。
22. Tab/Enter/Escと可視フォーカス。

監査追加: 全工程再試験、遷移単発、時計/停止、実数集計、途中差分保存、先生進捗完全不変、保存失敗/破損耐性、全eventフック、明表示コントラスト、バックアップ/観察表/成長比較を恒久検査する。音の実聴・物理IME・実機Chromebook/主要ブラウザは学校環境で配備前に確認する。

## 8. 検証

Node18+依存0のintegrity/system、Chrome/Edge＋Node22+のブラウザ回帰。CDPは別プロファイルで実ユーザー保存を触らない。

```
node scripts/check-data-integrity.mjs
node scripts/check-system-regressions.mjs
node scripts/check-browser-regressions.mjs
```

全JS/MJSをnode --check。integrityはかな/キー（入門除外）・MUST/ガイド・参照・段位単調・語彙・指カバレッジ・実在評価器・Tier/genre/ruby・mapAccent/flavor/secret/desc/unlockDan・復習/観察データ。ブラウザ証跡はOS一時フォルダ、テスト時刻/語彙短縮はブラウザ内だけ。

## 9. 運用・非目標

mainへ意味単位コミット、push直前integrity。GitHub Pages main/(root)、ビルド不要。機能minor、修正patch、APP_VERSION/README更新。原M1〜M6と全PATCH履歴を参照文書に保つ。
他者ランキング・複数プロファイル・実送信/GAS・アカウント・BGM・外部フォント・数字/英単語/かな入力方式は非目標。合言葉/完全バックアップは手動移行だけ。
