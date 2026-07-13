# data-design-v0

`data/*.js` はすべて `const XXX = globalThis.XXX = ...` のグローバル定数として定義する。

- `FINGER_DATA`: キー、標準運指、指色、指ラベル。
- `ROMAJI_TABLE`: かなからローマ字候補。配列先頭は表示優先候補。
- `CURRICULUM_DATA`: 入門、10級から1級までのステージ、guideLevel、修行、試験、授与巻物。
- `RANK_DATA`: 下忍以降の段位、三の試し、実戦メニュー。
- `JUTSU_DATA`: 術と巻物15件。
- `NICKNAME_DATA`: 二つ名16件と獲得条件。
- `words/*.js`: 各級の印、語彙、短文。級語彙はその級までの累積かなと累積キーだけで打てること。

調整は原則として `data/*.js` の編集だけで完結させる。
