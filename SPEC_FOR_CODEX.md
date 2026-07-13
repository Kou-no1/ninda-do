# SPEC_FOR_CODEX.md — 忍打道 —NINDA DO— v1.0

このファイルは、2026-07-13 に Kou-no1 から提示された正式仕様に基づく実装用控えです。

絶対規則:

- アプリ正式名称は常に `忍打道 —NINDA DO—` とする。
- 級フェーズでは速度系表示を生成しない。速度は下忍以降でのみ解禁する。
- ミスした打鍵で文字を進めない。
- guideLevel は `data/curriculum-data.js` が決め、UIコードに級ごとの表示量をハードコードしない。
- ビルドなし、ES Modules なし、fetch/XHR なし、外部CDNなし、依存0、`file://` 動作。
- 保存は localStorage のみ。将来連携用に `SaveManager.setSyncAdapter(adapter)` を持つ。
- ロジックは `js/`、コンテンツと合格基準は `data/` に分離する。

完成条件:

- §7 の受入基準22項目を満たす。
- `node scripts/check-data-integrity.mjs` が exit 0。
- GitHub Pages `https://kou-no1.github.io/ninda-do/` の main/(root) 配信で動作する。
