// apps/web/lib/compare-data.ts

export type ServiceTypeId = "life-set" | "gadget-short" | "trial-buy";

export type ServiceTypeDef = {
  id: ServiceTypeId;
  /** UI 上で使う見出し */
  title: string;
  /** セクション用アンカー（#type-life など） */
  anchor: string;
  /** 冒頭の説明文 */
  description: string;
  /** そのタイプの特徴（箇条書き） */
  bulletPoints: string[];
  /** 比較するときに見てほしいポイント */
  compareHints: string[];
};

export type ServiceInfo = {
  id: string;
  name: string;
  type: ServiceTypeId;
  href: string;
  tagline?: string;
  badges?: string[];
};

export const SERVICE_TYPES: ServiceTypeDef[] = [
  {
    id: "life-set",
    anchor: "type-life",
    title: "生活まるごとレンタル（家具・家電セット）",
    description:
      "引越し・単身赴任・仮住まいなどで、冷蔵庫・洗濯機・ベッドなど「生活に必要なもの一式」をレンタルで揃えたい方向けのタイプです。",
    bulletPoints: [
      "冷蔵庫・洗濯機・ベッドなどをまとめてレンタルできる",
      "設置〜回収までおまかせしやすく、大型家電でも安心",
      "長期利用でも費用感が読みやすい",
    ],
    compareHints: [
      "セットプランの内容（家電だけ / 家具込み など）",
      "新品・中古の選びやすさ",
      "配送エリアと設置・回収の条件",
    ],
  },
  {
    id: "gadget-short",
    anchor: "type-gadget",
    title: "ガジェット短期レンタル（カメラ・双眼鏡・PCなど）",
    description:
      "ライブ・イベント・旅行・推し活・一時的な仕事などで、数日〜数週間だけカメラや双眼鏡・ノートPCなどを使いたい方向けのタイプです。",
    bulletPoints: [
      "カメラ・双眼鏡・スマホ・PC・スーツケースなどジャンルが広い",
      "2泊3日〜など短期レンタルに強い",
      "コンビニ返却・往復送料込みなどで手軽に使いやすい",
    ],
    compareHints: [
      "最低利用日数と延長ルール",
      "送料（往復無料 / 地域別追加）",
      "返却方法（コンビニ返却・集荷対応 など）のラクさ",
    ],
  },
  {
    id: "trial-buy",
    anchor: "type-trial",
    title: "買う前に試せるレンタル（お試し・買えるレンタル）",
    description:
      "「いきなり買うのはちょっと不安…」という高額家電・ガジェットを、まずは自宅で試してから判断したい方向けのタイプです。",
    bulletPoints: [
      "レンタル後にそのまま購入できるサービスもある",
      "高額な家電・ガジェットの“買って失敗”を減らせる",
      "自宅でじっくり試してから決められる",
    ],
    compareHints: [
      "レンタル料金が購入価格から差し引かれるかどうか",
      "新品・美品の割合やコンディション",
      "最低利用期間・延長条件の分かりやすさ",
    ],
  },
];

export const SERVICES: ServiceInfo[] = [
  // 生活まるごとレンタル
  {
    id: "kasite",
    name: "かして！どっとこむ",
    type: "life-set",
    href: "/offers/kasite",
    tagline: "家電・家具をまとめて揃えやすい老舗レンタルサービス",
    badges: ["家電セット", "ファミリー対応", "全国配送"],
  },
  {
    id: "racleaas",
    name: "ラクリアーズ",
    type: "life-set",
    href: "/offers/racleaas",
    tagline: "サブスク感覚で家電を長期レンタルしやすいサービス",
    badges: ["長期レンタル", "サブスク型", "設置込み"],
  },
  {
    id: "happyrent",
    name: "Happy!レンタル",
    type: "life-set",
    href: "/offers/happyrent",
    tagline: "一人暮らし向けに必要なものをピンポイントで揃えやすい",
    badges: ["一人暮らし", "短期〜中期", "家電＋家具"],
  },

  // ガジェット短期レンタル
  {
    id: "geo-arekore",
    name: "ゲオあれこれレンタル",
    type: "gadget-short",
    href: "/offers/geo-arekore",
    tagline:
      "カメラ・スマホ・PC・スーツケースなど“幅広く少しずつ”借りたい人向け",
    badges: ["短期レンタル", "月額レンタル", "コンビニ返却OK"],
  },
  {
    id: "dmm-rental",
    name: "DMMいろいろレンタル",
    type: "gadget-short",
    href: "/offers/dmm",
    tagline: "家電からアウトドア用品まで、とにかく選択肢を広く見たい人向け",
    badges: ["豊富なジャンル", "短期〜長期", "ネット完結"],
  },
  {
    id: "rentry",
    name: "Rentry",
    type: "gadget-short",
    href: "/offers/rentry",
    tagline: "カメラ・ドローンなど趣味寄りガジェットに強いサービス",
    badges: ["カメラ特化", "アウトドア", "旅行向け"],
  },

  // 買う前に試す系
  {
    id: "geo-buy",
    name: "ゲオ（買えるレンタル）",
    type: "trial-buy",
    href: "/offers/geo-arekore",
    tagline: "レンタル料金がムダになりにくい“買えるレンタル”プランあり",
    badges: ["買えるレンタル", "ガジェットお試し", "月額プランあり"],
  },
  {
    id: "panasonic-bistro",
    name: "パナソニック Bistro",
    type: "trial-buy",
    href: "/offers/panasonic-bistro",
    tagline: "高機能オーブンレンジを自宅で試してから検討したい人向け",
    badges: ["高額家電お試し", "メーカー公式", "レシピ検証に"],
  },
];
