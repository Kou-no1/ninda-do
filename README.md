# 忍打道 —NINDA DO—

型（かた）をきわめた者だけが、疾風（はやて）をゆるされる。——それが、忍打道。

公開URL: https://kou-no1.github.io/ninda-do/

## 遊び方

1. `index.html` を開き、にんじゃネームを入れる。
2. 里で「しゅぎょうする」を選び、正しいキーを打つ。
3. 修行を1回終えたら「ためしにいどむ」。1級合格で下忍となり、実戦の修行が開く。

## 先生向け調整ポイント

- 級ごとのキー、かな、合格基準、ガイド量: `data/curriculum-data.js`
- 段位試験のKPMや正確率: `data/rank-data.js`
- 語彙や文章: `data/words/*.js`
- 術と巻物: `data/jutsu-data.js`
- 二つ名条件: `data/nickname-data.js`

ビルド工程はありません。GitHub Pages は `main` ブランチのルートをそのまま配信します。
