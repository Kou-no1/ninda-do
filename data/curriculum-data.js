const CURRICULUM_DATA = globalThis.CURRICULUM_DATA = {
  stages: [
    {
      id: "nyumon1", label: "入門・壱", type: "nyumon", title: "中段の文字",
      newKeys: ["a", "s", "d", "f", "g", "h", "j", "k", "l"], newKana: [], jutsu: [],
      wordsRef: "NYUMON_WORDS", guideLevelTraining: 3, guideLevelExam: 3,
      training: [{ kind: "letter", label: "文字の修行", count: 20 }],
      exam: { kind: "letter", items: 20, accuracy: 0.85 }
    },
    {
      id: "nyumon2", label: "入門・弐", type: "nyumon", title: "上段の文字",
      newKeys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], newKana: [], jutsu: [],
      wordsRef: "NYUMON_WORDS", guideLevelTraining: 3, guideLevelExam: 3,
      training: [{ kind: "letter", label: "文字の修行", count: 20 }],
      exam: { kind: "letter", items: 20, accuracy: 0.85 }
    },
    {
      id: "nyumon3", label: "入門・参", type: "nyumon", title: "下段の文字",
      newKeys: ["z", "x", "c", "v", "b", "n", "m"], newKana: [], jutsu: [],
      wordsRef: "NYUMON_WORDS", guideLevelTraining: 3, guideLevelExam: 3,
      training: [{ kind: "letter", label: "文字の修行", count: 20 }],
      exam: { kind: "letter", items: 20, accuracy: 0.85 }
    },
    {
      id: "nyumon4", label: "入門・肆", type: "nyumon", title: "文字の総ざらい",
      newKeys: [], newKana: [], jutsu: ["moji"],
      wordsRef: "NYUMON_WORDS", guideLevelTraining: 3, guideLevelExam: 3,
      training: [{ kind: "letter", label: "文字の修行", count: 26 }],
      exam: { kind: "letter", items: 20, accuracy: 0.85 }
    },
    {
      id: "kyu10", label: "10きゅう", type: "kyu", title: "かまえの術",
      newKeys: ["f", "j"], newKana: [], jutsu: ["kamae"],
      wordsRef: "KYU10_WORDS", guideLevelTraining: 3, guideLevelExam: 3,
      training: [{ kind: "in", label: "いんの修行", count: 20 }],
      exam: { kind: "in", items: 40, accuracy: 0.90 }
    },
    {
      id: "kyu9", label: "9きゅう", type: "kyu", title: "もどりの術",
      newKeys: ["a", "s", "d", "k", "l"], newKana: [], jutsu: ["modori"],
      wordsRef: "KYU9_WORDS", guideLevelTraining: 3, guideLevelExam: 3,
      training: [{ kind: "in", label: "いんの修行", count: 20 }],
      exam: { kind: "in", items: 40, accuracy: 0.90 }
    },
    {
      id: "kyu8", label: "8きゅう", type: "kyu", title: "中段の術",
      newKeys: ["g", "h"], newKana: [], jutsu: ["chudan"],
      wordsRef: "KYU8_WORDS", guideLevelTraining: 3, guideLevelExam: 2,
      training: [{ kind: "in", label: "いんの修行", count: 20 }],
      exam: { kind: "in", items: 40, accuracy: 0.90 }
    },
    {
      id: "kyu7", label: "7きゅう", type: "kyu", title: "ぼいんの術",
      newKeys: ["i", "u", "e", "o"], newKana: ["あ", "い", "う", "え", "お"], jutsu: ["boin"],
      wordsRef: "KYU7_WORDS", guideLevelTraining: 3, guideLevelExam: 2,
      training: [{ kind: "in", label: "いんの修行", count: 20 }, { kind: "word", label: "ことばの修行", count: 10 }],
      exam: { kind: "word", items: 10, accuracy: 0.90 }
    },
    {
      id: "kyu6", label: "6きゅう", type: "kyu", title: "かさたの巻",
      newKeys: ["t"], newKana: ["か", "き", "く", "け", "こ", "さ", "し", "す", "せ", "そ", "た", "ち", "つ", "て", "と"], jutsu: ["kasata"],
      wordsRef: "KYU6_WORDS", guideLevelTraining: 2, guideLevelExam: 2,
      training: [{ kind: "in", label: "いんの修行", count: 20 }, { kind: "word", label: "ことばの修行", count: 10 }],
      exam: { kind: "word", items: 12, accuracy: 0.93 }
    },
    {
      id: "kyu5", label: "5きゅう", type: "kyu", title: "なはまの巻",
      newKeys: ["n", "m"], newKana: ["な", "に", "ぬ", "ね", "の", "は", "ひ", "ふ", "へ", "ほ", "ま", "み", "む", "め", "も"], jutsu: ["nahama"],
      wordsRef: "KYU5_WORDS", guideLevelTraining: 2, guideLevelExam: 2,
      training: [{ kind: "in", label: "いんの修行", count: 20 }, { kind: "word", label: "ことばの修行", count: 10 }],
      exam: { kind: "word", items: 12, accuracy: 0.93 }
    },
    {
      id: "kyu4", label: "4きゅう", type: "kyu", title: "五十音皆伝",
      newKeys: ["y", "r", "w"], newKana: ["や", "ゆ", "よ", "ら", "り", "る", "れ", "ろ", "わ", "を", "ん"], jutsu: ["gojuon", "musubi"],
      wordsRef: "KYU4_WORDS", guideLevelTraining: 2, guideLevelExam: 1,
      training: [{ kind: "in", label: "いんの修行", count: 20 }, { kind: "word", label: "ことばの修行", count: 10 }],
      exam: { kind: "word", items: 12, accuracy: 0.93 }
    },
    {
      id: "kyu3", label: "3きゅう", type: "kyu", title: "にごりの術",
      newKeys: ["z", "b", "p"], newKana: ["が", "ぎ", "ぐ", "げ", "ご", "ざ", "じ", "ず", "ぜ", "ぞ", "だ", "ぢ", "づ", "で", "ど", "ば", "び", "ぶ", "べ", "ぼ", "ぱ", "ぴ", "ぷ", "ぺ", "ぽ"], jutsu: ["nigori"],
      wordsRef: "KYU3_WORDS", guideLevelTraining: 1, guideLevelExam: 1,
      training: [{ kind: "in", label: "いんの修行", count: 20 }, { kind: "word", label: "ことばの修行", count: 10 }],
      exam: { kind: "word", items: 12, accuracy: 0.95 }
    },
    {
      id: "kyu2", label: "2きゅう", type: "kyu", title: "へんげと分身",
      newKeys: ["-", "x"], newKana: ["きゃ", "きゅ", "きょ", "しゃ", "しゅ", "しょ", "ちゃ", "ちゅ", "ちょ", "にゃ", "にゅ", "にょ", "ひゃ", "ひゅ", "ひょ", "みゃ", "みゅ", "みょ", "りゃ", "りゅ", "りょ", "ぎゃ", "ぎゅ", "ぎょ", "じゃ", "じゅ", "じょ", "びゃ", "びゅ", "びょ", "ぴゃ", "ぴゅ", "ぴょ", "っ", "ー"], jutsu: ["henge", "bunshin"],
      wordsRef: "KYU2_WORDS", guideLevelTraining: 1, guideLevelExam: 1,
      training: [{ kind: "in", label: "いんの修行", count: 20 }, { kind: "word", label: "ことばの修行", count: 10 }],
      exam: { kind: "word", items: 12, accuracy: 0.95 }
    },
    {
      id: "kyu1", label: "1きゅう", type: "kyu", title: "心眼の術",
      newKeys: [",", "."], newKana: ["、", "。"], jutsu: ["shingan", "menkyo"],
      wordsRef: "KYU1_WORDS", guideLevelTraining: 1, guideLevelExam: 0,
      training: [{ kind: "sentence", label: "文の修行", count: 3 }],
      exam: { kind: "sentence", items: 3, accuracy: 0.95 }
    }
  ]
};
