// firebase/functions/src/utils/dailyThemes.ts
export type DailyThemeId =
  | "yearend-housework"
  | "yearend-cooking"
  | "spring-moving"
  | "rainy-laundry"
  | "summer-return"
  | "summer-outdoor"
  | "autumn-disaster"
  | "winter-stayhome"
  | "generic-home";

export type DailyTheme = {
  id: DailyThemeId;
  /** 記事内で「◯◯×{{label}}」のように使う短い悩みラベル（例: 家事負担） */
  label: string;
  /** 季節込みのフルラベル（例: 年末の家事負担） */
  fullLabel: string;
  /** リードやワンポイントで軽く説明する文 */
  description: string;
};

const THEME_TABLE: Record<string, DailyTheme[]> = {
  // --- 年末（11〜12月） ---
  年末: [
    {
      id: "yearend-housework",
      label: "家事負担",
      fullLabel: "年末の家事負担",
      description:
        "大掃除・来客・片付けが一気に重なり、『掃除道具や家電を一時的に増やしたい』というニーズが高まりやすい時期です。",
    },
    {
      id: "yearend-cooking",
      label: "料理疲れ",
      fullLabel: "年末の料理疲れ",
      description:
        "おせち・年越し・帰省組のごはん準備でキッチンがフル稼働になり、『オーブンやサブ冷蔵庫がもう1台ほしい』という悩みが出やすくなります。",
    },
  ],

  // --- 新生活（3〜4月） ---
  新生活: [
    {
      id: "spring-moving",
      label: "引っ越し準備",
      fullLabel: "新生活前後の引っ越し準備",
      description:
        "進学や就職で一人暮らしを始める人が多く、『最初の数カ月だけ家電をレンタルで済ませたい』というニーズが増えやすい季節です。",
    },
  ],

  // --- 梅雨（6月） ---
  梅雨: [
    {
      id: "rainy-laundry",
      label: "洗濯まわり",
      fullLabel: "梅雨どきの洗濯まわり",
      description:
        "雨が続き部屋干しが増えることで、『除湿機やサーキュレーターを一時的に足したい』と感じる人が増えるタイミングです。",
    },
  ],

  // --- 夏休み（7〜8月） ---
  夏休み: [
    {
      id: "summer-return",
      label: "帰省・来客準備",
      fullLabel: "夏休みの帰省・来客準備",
      description:
        "実家への帰省や、子ども・親戚の一時滞在で『寝具や家電を増やしたいけれど、常設する場所がない』という悩みが出やすくなります。",
    },
    {
      id: "summer-outdoor",
      label: "アウトドア電源",
      fullLabel: "夏のアウトドア電源まわり",
      description:
        "キャンプやフェスなど屋外イベントが増え、『ポータブル電源や冷蔵庫を短期間だけ使いたい』というニーズが高まりやすい季節です。",
    },
  ],

  // --- 防災（9月） ---
  防災: [
    {
      id: "autumn-disaster",
      label: "停電・備え",
      fullLabel: "台風シーズンの停電・備え",
      description:
        "台風シーズンで停電リスクを意識する人が増え、『まずはレンタルでポータブル電源やライトを試したい』という声が増えやすい時期です。",
    },
  ],

  // --- 冬の暮らし（1〜2月） ---
  冬の暮らし: [
    {
      id: "winter-stayhome",
      label: "在宅時間の寒さ対策",
      fullLabel: "冬の在宅時間の寒さ対策",
      description:
        "在宅ワークや勉強時間が長くなる中で、『スポット暖房や加湿器をシーズンだけ増やしたい』というニーズが出やすくなります。",
    },
  ],

  // --- デフォルト ---
  暮らしの見直し: [
    {
      id: "generic-home",
      label: "暮らしの見直し",
      fullLabel: "暮らしの見直し",
      description:
        "ライフスタイルの変化に合わせて、『本当に必要な家電だけを持ちたい』『まずはレンタルで試してから買いたい』という人が増えやすいタイミングです。",
    },
  ],
};

/**
 * 季節キーワードと日付から、1日1テーマを決める。
 * 同じ日付なら同じテーマになるよう、ざっくり決定。
 */
export function pickDailyTheme(seasonKeyword: string, date: Date): DailyTheme {
  const key = seasonKeyword || "暮らしの見直し";
  const list = THEME_TABLE[key] ?? THEME_TABLE["暮らしの見直し"];

  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const seed =
    Number(
      `${y}${m.toString().padStart(2, "0")}${d.toString().padStart(2, "0")}`
    ) || 1;

  const idx = seed % list.length;
  return list[idx];
}
