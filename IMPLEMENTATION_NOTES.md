# IMPLEMENTATION_NOTES.md

## M1

- `C:\Users\shudi\Documents\New project` は別repoの未コミット変更を多く含むため、`ninda-do/` を独立したGitチェックアウトとして作業する。
- データ定義はブラウザと Node VM 検査で共用するため、仕様の `const XXX = ...` を守りつつ `globalThis.XXX` にも同じ値を入れる。
- `data/words/*.js` の一部文は、語彙検査で最終値を見られるよう読み込み時にひらがな化する置換を使った。表示される値に漢字は残さない。
- `SPEC_FOR_CODEX.md` は本実装の正式仕様として、ユーザー提供仕様の要点を保存した。全文はこの作業依頼本文を正とする。

## 既知の課題

- M1時点ではUIマネージャの多くは安全な初期定義のみ。M2以降で実動作を実装する。
