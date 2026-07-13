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

## 既知の課題

- GitHub Pages の公開設定（Settings → Pages → main / root）はGitHub側設定のため、このリポジトリ内容からは直接変更していない。
