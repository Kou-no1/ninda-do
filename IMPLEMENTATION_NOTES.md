# IMPLEMENTATION_NOTES.md

## M1

- `C:\Users\shudi\Documents\New project` は別repoの未コミット変更を多く含むため、`ninda-do/` を独立したGitチェックアウトとして作業する。
- データ定義はブラウザと Node VM 検査で共用するため、仕様の `const XXX = ...` を守りつつ `globalThis.XXX` にも同じ値を入れる。
- `data/words/*.js` の一部文は、語彙検査で最終値を見られるよう読み込み時にひらがな化する置換を使った。表示される値に漢字は残さない。
- `SPEC_FOR_CODEX.md` は本実装の正式仕様として、ユーザー提供仕様の要点を保存した。全文はこの作業依頼本文を正とする。

## 既知の課題

- M1時点ではUIマネージャの多くは安全な初期定義のみ。M2以降で実動作を実装する。

## M2

- `input-engine.js` は M1 の整合性検査で使う必要があったため先行実装済み。M2では `metrics-engine.js` を仕様どおり打鍵イベント購読型へ置き換えた。
- `ん` の単打確定は `ninja` と `ninnjya` の両方を受理するため、`n` 入力直後には確定を保留し、次キーが次ユニットを開始できる場合だけ単打確定として処理する。
- KPM は `mode:"jissen"` のセッションサマリでのみ返す。級フェーズUIにはM3以降も速度DOMを生成しない。

## M3

- S2修行は `TrainingManager.startRunner()` に集約した。後続の試験・実戦も同じランナーを使い、打鍵イベントの処理経路を分岐させない。
- 入門ステージはアルファベット1文字を raw key unit として InputEngine に渡す。表示だけ大文字化し、判定は `KeyboardEvent.key` の小文字化で行う。
- 里マップ上の入門ステージは常時選択可能にした。10級開始者も入門へ戻れるという仕様を満たすため。

## M4

- 昇級試験と昇段試験は `TrainingManager.startRunner()` を共用し、結果判定だけ `ExamManager` で行う。
- 昇段試験の「三の試し」は各フェーズ合格時に短い結果表示を挟み、自動で次フェーズへ進む。途中不合格時はその場で終了し、再挑戦は最初からになる。
- 弱点特訓は保存済み `keyStats` のミス率上位キーを `InputEngine.preferredRomaji(word)` に含む語から優先抽出する。候補がない場合だけ通常の実戦語彙にフォールバックする。

## M5

- 合言葉コードは 11 byte ペイロード + CRC-8 を 5bit かな32文字へ変換し、20文字（5文字×4グループ）で表示する。
- 合言葉復元では keyStats と eventLog は復元しない。仕様通り、免状画面に「うちこみの記録はもどらないよ」と表示する。
- 効果音はユーザー操作後に AudioContext を作成・resume する。教室利用を考えて全体音量は小さめにした。
- ブラウザのプライバシーポリシー等で `localStorage` が例外になる場合だけ、同一セッション内のメモリ保存へフォールバックする。通常環境では仕様通り `localStorage` キー `nindaDoSaveV1` を使う。

## M6

- Browser検証時にフォームsubmitイベントが操作ツールから発火しないケースがあったため、タイトル画面と主要ボタンには同じ処理を呼ぶHTML属性のフォールバックも付けた。通常の `addEventListener` 経路は維持している。
- README.md を追加し、アプリ名・キャッチコピー・公開URL・遊び方・先生向け調整ポイントを記録した。
- Codex内のin-app Browserは `file://` 直接ナビゲーションが安全ポリシーでブロックされたため、実ブラウザ検証はローカルHTTPと通常ChromeのCDPで実施した。`file://` 適性は、外部CDN・fetch/XHR・絶対パス・module script 不使用の静的検査で補完した。

## 受入セルフチェック

- `node scripts/check-data-integrity.mjs`: OK（14 stages, 130 dan words, 32 dan sentences）。
- `node --check`（`js/` と `scripts/`）: OK。
- 合言葉コード: VM上で発行→削除→復元し、currentStage / dan / scrolls / nicknames / totals.correct(100単位) / streak.days の一致を確認。
- 通常Chrome CDP（localhost）: 初期表示、開始、S2修行、ミスで進まない、2連続ミス救済ガイド、正打イベント、コンソールエラー0を確認。
- 通常Chrome CDP（1366x768 / 1024x768）: S2で横スクロールなし、prompt font 48px以上を確認。
- 静的検査: アプリコードに `fetch(` / `XMLHttpRequest` / CDN script / module script / ルート絶対パス参照がないことを確認。
- 2026-07-13 時点の公開URL `https://kou-no1.github.io/ninda-do/`: `404 Not Found`。GitHub API `/repos/Kou-no1/ninda-do/pages` も 404 のため、Pages設定がまだ有効化されていない状態と判断。

## 既知の課題

- GitHub Pages の公開設定（Settings → Pages → main / root）はGitHub側設定のため、このリポジトリ内容からは直接変更していない。

## PATCH-01 §1

- `.overlay { display: grid; }` が `[hidden]` のUAスタイルを上書きしていたため、全体リセットとして `[hidden] { display: none !important; }` を追加した。
- IME警告は修行・試験中、かつイベント対象が編集要素ではない場合だけ表示する。S0のにんじゃネーム入力ではIME利用を許可する。
- IME解除直後の素の1打でオーバーレイを閉じるときは `preventDefault()` と `stopImmediatePropagation()` を行い、その1打が打鍵判定へ流れないようにした。
- Chromeが暗黙に `favicon.ico` を取得して404を出すため、外部ファイルを増やさない data URI favicon を追加した。
- §1.3 受入確認: 起動直後非表示、S0入力中composition無視、修行中compositionで表示・一時停止、IME解除後の1打で非表示かつ判定に流れない、わかったボタン/Escで非表示、すべて通常Chrome CDPで確認。

## PATCH-01 §2

- 語彙監査結果に従い、現代仮名遣い・IP連想・表現推敲の対象語をすべて1語→1語で差し替えた。
- 「を」は助詞専用、「ぢ・づ」は連濁等の限定用法のみ、「ひゅうが」は地名・人名および既存忍者作品の連想を避ける、ひらがな語で長音符を使わない、という理由で修正した。

## PATCH-01 §3

- テーマを「夜の道場」へ変更した。地は `--yoru` / `--yoru-deep`、文字は `--tsuki`、紙面はお題札・エントリー札・巻物カード・免状・設定・結果・ダイアログに限定した。
- S0にはCSS疑似要素の月、S1には夜の山道・月・現在地の提灯SVGを追加した。スタンプ、朱印、判子、旅地図風装飾は追加していない。
- SVGアイコンと手ガイドの色はCSS変数参照へ寄せた。指ゾーン8色は `data/finger-data.js` を変更せず、既存値を維持した。
- 心眼の試し（guideLevel 0）は `.shingan-mode` を付け、S2/S3の道場面を一段暗くする。
- コントラスト実測: 夜面本文 `--tsuki` on `--yoru` = 13.82:1、S2お題札 `--sumi` on `--paper` = 14.29:1。
- §3.6 受入確認: 通常Chrome CDPでS1/S2の 1366x768・1024x768 横スクロールなし、S2お題文字48px以上、S1月背景と現在地提灯、コンソールエラー0、HTTP 400+なしを確認。

## PATCH-02 §1

- 巻物の紋章は `SVG_ICONS.crest(jutsuId)` に集約した。`JUTSU_DATA` には新フィールドを足さず、既存の術IDを紋章IDとして使う判断にした。
- 未修得巻物の修得元は `CURRICULUM_DATA.stages[].jutsu` から逆引きする。`shippu` だけは仕様どおり免許皆伝で修得できる表示にした。
- `kasata` 紋は指定の三つ巴を、塗り円と尾の弧を120度回転で重ねる簡略表現にした。仕様が許容する「難しい場合の代替」までは使っていない。
- 授与トーストは、試験合格前後の `scrolls` 差分を見て新規巻物だけ紋章付きで表示する。再挑戦で既に持っている巻物は再通知しない。
- §1.6 受入確認: 通常Chrome CDPで修得済み15カードに15紋、金紐5（maki 4 + shippu）・藍紐10、未修得15カードに閉じ巻物と「?」、二つ名16札中装着中1札だけ提灯表示、コンソールエラー0を確認。
- 逆引き確認: 実行時に `boin` を7級から6級へ移したところ、未修得表示が「7きゅう『ぼいんの術』で修得できる」から「6きゅう『かさたの巻』で修得できる」へ追従した。
- `node --check` 全JS/MJSと `node scripts/check-data-integrity.mjs` はOK。

## PATCH-02 §2

- 画面用免状とは別に、印刷専用DOM `#printLicense` を追加した。画面では `hidden` のまま、`@media print` で `[hidden]` を上書きして表示する。
- 印刷用免状は白地・墨文字固定にし、画面テーマのCSS変数に依存しない色指定にした。
- 保存仕様はPATCH-02 §4で `best.combo` が追加される予定のため、この時点では未定義を0扱いで表示する。
- SPEC §0.2-1の回帰を避けるため、画面用免状の最高KPM行は下忍以降のみ生成するよう条件化した。
- §2.2 受入確認: 通常Chrome CDPの `Page.printToPDF` でA4縦1ページ（184738 bytes / 1 page）、印刷ボタン押下で `window.print()` が呼ばれ、保存JSONと画面状態が変化しないことを確認。
- 印刷DOMに免状見出し、名前、段位、二つ名、修得術数、代表紋章3つ、最高気配、累計正打、最大連撃、発行日、発行元が入ることを確認。
- `node --check` 全JS/MJSと `node scripts/check-data-integrity.mjs` はOK。

## PATCH-02 §3

- `poster.html` をルート直下に追加した。読み込みscriptは `finger-data.js`、`svg-icons.js`、`guide-renderer.js`、インライン初期化のみ。
- ポスター描画は `GuideRenderer.renderPoster(target)` として追加し、アプリ本体の修行画面用 `GuideRenderer.render()` には影響しない形にした。
- 指色はすべて `FINGER_DATA.fingerColors` からインラインCSS変数へ渡す。`poster.html` には指色コードを直接書かない。
- 凡例は `FINGER_DATA.fingerLabels` 全件を使うため、左右8指に加えて親指を含む9項目を表示する。
- §3.2 受入確認: 通常Chrome CDPでキー30個、手の指色玉10個、凡例9項目、キー色ミスマッチ0、凡例色が全て `FINGER_DATA` 由来であることを確認。
- `poster.html` の `Page.printToPDF` はA4横1ページ（114874 bytes / 1 page）。設定画面リンクは `href="poster.html"`、`target="_blank"`、index側scriptにposter用scriptが混ざっていないことを確認。
- `node --check` 全JS/MJSと `node scripts/check-data-integrity.mjs` はOK。

## PATCH-02 §4

- 連撃は `MetricsEngine` のセッション状態で `combo` / `maxCombo` として算出し、ミス時に0へ戻す。KPMとは独立した正確さの連続指標として扱う。
- 連撃UIと手裏剣演出は `TrainingManager` の `screen === "S2"` かつ `mode === "training"|"jissen"` の場合だけ有効にした。S3の試験では、modeが `jissen` でも表示しない。
- 手裏剣は10連ごとに的へ追加し、5枚で上限にする。6回目以降の10連到達は既存5枚を光らせるだけにした。
- 新二つ名 `hyakuren` 追加により二つ名が17件になったため、合言葉コードの二つ名マスクを新規発行分のみ3byteへ拡張した。旧11byteペイロード + CRCの復元も残している。
- `AudioManager` は効果音・読み上げが両方OFFのときAudioContextを作らないようにし、合成キー検証時の自動再生警告を避けた。
- §4.2 受入確認: 通常Chrome CDPで4連は非表示、5連で「れんげき 5」、10連で手裏剣1枚、50連で5枚上限、ミス直後は無音フェード表示、フェード後非表示、セッション停止で的クリアを確認。
- 試験中は10正打しても連撃UI・手裏剣とも0。100連で `save.best.combo === 100`、二つ名 `hyakuren` 付与を確認。`prefers-reduced-motion: reduce` では手裏剣の飛翔アニメが `none` になることを確認。
- 合言葉コードは17個目の二つ名を含む状態で発行→削除→復元し、`hyakuren` を含む17件すべてが戻ることを確認（新コード本体21文字）。
- `node --check` 全JS/MJSと `node scripts/check-data-integrity.mjs` はOK。

## PATCH-02 §5

- 表示テーマは `save.settings.display` に `"night"|"light"` で保存し、`NindaApp.applyTheme()` が `body[data-theme]` に反映する。
- 明モードの色変更は `body[data-theme="light"]` のCSS変数ブロックに集約した。フォーカス・現在地・次キーのリングも変数化し、明モードでは2px実線リングになるようにした。
- 設定画面の「あかるいひょうじ（プロジェクタ・けいじ用）」チェックで即時反映し、リロード後も保持されることを通常Chrome CDPで確認。
- 明モードコントラスト実測: 本文 `--tsuki` on `--yoru` = 12.86:1、S2お題札 `--sumi` on `--paper` = 14.29:1。
- §5.2 受入確認: 明モード保存値 `light`、`body[data-theme="light"]`、現在地リングが2px `--chochin`、下忍前の免状にKPM行なし、印刷免状は明モードでも白地・墨文字固定を確認。コンソールイベント0。
- `node --check` 全JS/MJSと `node scripts/check-data-integrity.mjs` はOK。

## PATCH-02 §6

- `favicon.svg` はルート直下に追加し、丸に手裏剣の静的SVGにした。`index.html` と `poster.html` は相対パス `favicon.svg` を参照する。
- `og.png` は通常Chrome CDPでS0を 1200x630 にして撮影した。保存前にS0を夜テーマへ固定し、スクリーンショット用にスクロールバーを隠した。
- `index.html` head に OGP 5タグ + `twitter:card` を追加した。`og:image` は公開URL `https://kou-no1.github.io/ninda-do/og.png` を指定する。
- `SPEC_FOR_CODEX.md` の控えに、静的メタ資産 `favicon.svg` / `og.png` の例外と `poster.html` 追加を追記した。
- §6.2 受入確認: `og.png` は 1200x630 / 71405 bytes、S0の夜テーマ・ロゴ・キャッチコピーが収まる構図であることを目視確認。headの6タグとfaviconリンク2箇所を静的確認。
- `node --check` 全JS/MJSと `node scripts/check-data-integrity.mjs` はOK。

## PATCH-02 通し確認

- 通常Chrome CDPで `file://` の `index.html` を起動し、title、`NindaApp` 起動、IMEオーバーレイ初期非表示、favicon相対参照、OGP URLを確認。コンソールイベント0、外部HTTP(S)リクエスト0。
- 静的検索で `fetch(` / `XMLHttpRequest` / `type="module"` / ルート絶対 `src`・`href` / 許可外HTTPS参照がないことを確認。
- 1366x768: S2修行で横スクロールなし、お題文字72px、級段階KPM表示なし。1024x768明モード: S1/S2横スクロールなし、お題文字61.44px、級段階KPM表示なし。
- 最終 `node --check` 全JS/MJSと `node scripts/check-data-integrity.mjs` はOK。

## PATCH-03

- `InputEngine.handleKey()` の正打経路で、`completeUnitIfReady()` を先に実行してから `emit(true, ...)` するようにした。購読側の `updateUi()` がイベント時点で遷移後の `nextExpectedKeys()` を読めるようにするため。
- 打鍵イベントの `kana` / `unitIndex` は、状態遷移前のsnapshotを渡して維持した。ミス帰属、2連続ミス救済、キー統計の意味を変えないため。
- `ん` の単打確定待ちでは、`nextExpectedKeys()` に通常の `nn` 継続キーだけでなく次ユニット先頭キーも含めるようにした。`ninja` の `nin` 後に次キー `j` が点灯するようにするため。
- `scripts/check-data-integrity.mjs` にガイド追従検証を追加した。MUSTケースの全合格入力例と印 `asdf` で、correctイベント時点の `session.nextExpectedKeys()` が次入力キーを含むことを検査する。
- CDP確認: S3の9級相当の印 `asdf` で開始時 `a`、`a`後 `s`、`s`後 `d`、`d`後 `f` が点灯し、各時点で手SVGの指点灯も1件あることを確認。
- CDP確認: かな語 `にんじゃ` で `n`後 `i`、`i`後 `n/x`、`nin`後 `j/n/z` が点灯し、ユニット境界で消灯しないことを確認。
- CDP確認: guideLevel 0 で同一文字2連続ミス時、救済のキーボード・手SVG・次キー `a`・朱フラッシュが従来どおり出ることを確認。級フェーズのKPM表示なし、コンソールイベント0。
- `node --check` 全JS/MJSと `node scripts/check-data-integrity.mjs` はOK。

## PATCH-04 §1

- `APP_VERSION` は `js/main.js` 冒頭の定数として定義し、設定画面の最下部に `#versionLabel` として表示する。
- バージョン履歴は `README.md` 末尾に追記した。PATCH-03のHEADは、この作業開始時点の `74edfa4` として記録した。
- `node --check` 全JS/MJSと `node scripts/check-data-integrity.mjs` はOK。

## PATCH-04 §2-3

- 先生モードのパスコード `2361` は公開リポジトリ内の定数であり、秘匿情報ではない。教室での偶発的な有効化を防ぐ軽い抑止として扱う。
- 先生モード中の保存抑止は `SaveManager.update()` の既定動作で行い、`setSetting()` だけ `allowTeacherWrite` で許可した。呼び出し側の分岐漏れで進捗が残らないようにするため。
- 先生モードで里マップの級ノードを選ぶ場合は、`currentStage` を保存せず、`NindaApp` 内の一時選択 `teacherStageId` だけで表示と開始対象を切り替える。段位ノードも一時選択にし、下忍ノードの三の試しは次段の中忍試験を開く扱いにした。
- 未修得の巻物・二つ名は先生モード中だけ実体表示にし、`preview` クラスと「プレビュー」ラベルを付ける。未修得二つ名は装着ボタンにしないため、獲得状態は変わらない。
- CDP確認: 設定画面に `忍打道 —NINDA DO— v1.3.0` が表示され、バージョン6回タップ後2秒放置でリセット、7〜9回目で「あと 3/2/1かい…」トースト、10回目でパスコード欄が出ることを確認。
- CDP確認: 誤入力5回で入力欄が閉じ、`2361` + Enter で先生モードON、`body[data-teacher-mode="true"]` とヘッダバッジ、ON時のみ設定トグル表示、リロード後維持を確認。
- CDP確認: 先生モード中は級ノード14/14と段位ノード5件が選択可能、実戦メニューが下忍前でも表示される。未修得巻物14件と二つ名17件がプレビュー表示になり、OFF後は巻物14件が閉じ巻物へ戻る。
- CDP確認: 先生モードONで5級の試しを検証用1問にして合格後、OFFにした。`clearedStages / scrolls / nicknames / equippedNickname / totals / keyStats / best / streak / eventLog` はプレイ前後で完全一致した。
- CDP確認: 先生モード中の5級試し結果に「先生モードのため、記録はのこりません」が出る。級フェーズの `examStats` と結果DOMに `KPM` は出ない。
- CDP確認: `file://` の `index.html` でタイトル、`NindaApp` 起動、IMEオーバーレイ初期非表示を確認。1366x768 と 1024x768 でS1横スクロールなし、外部HTTP(S)リソース0、例外0。

## PATCH-05 §1

- `APP_VERSION` を `1.4.0` に更新し、READMEのバージョン対応表へPATCH-05行を追加した。
- 修行・実戦・試験結果の表示先を、ページ下部の `resultMount` / `examResultMount` から汎用 `#resultOverlay` モーダルへ移した。ページ下部の結果セクションは廃止した。
- 結果モーダルは `TrainingManager.openModal()` として共通化した。Enterは主操作（もういちど）、Escは里へ戻る、Tabはモーダル内循環、背面クリックでは閉じない。
- 三の試しの途中フェーズは `resultActions === false` の場合にモーダルを出さず、自動で次フェーズへ進める。途中通過の表示より通し試験の流れを優先するため。
- 級フェーズでは `state.mode !== "jissen"` の場合、結果モーダルにスコア・KPMのDOMを生成しない。実戦・番付の速度表示は `mode:"jissen"` に限定する。
- `node --check js/main.js js/training-manager.js` と `node scripts/check-data-integrity.mjs` はOK。
