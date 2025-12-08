// apps/web/app/compare/[theme]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSiteId } from "@/lib/site-server";
import { fetchCollection, fsRunQuery, fsDecode } from "@/lib/firestore-rest";
import OfferCompareTable, {
  type OfferLite,
} from "@/components/offers/OfferCompareTable";

// Firestore から取る offer のざっくり型（必要なフィールドだけ）
type OfferDoc = {
  id: string;
  title?: string;
  affiliateUrl?: string;
  tags?: string[];
  priceMonthly?: number | null;
  minTermMonths?: number | null;
  badges?: string[];
  notes?: string[];
  ui?: {
    priceLabel?: string;
    minTermLabel?: string;
    compareHighlight?: string;
  };
  extras?: {
    ui?: {
      priceLabel?: string;
      minTermLabel?: string;
      compareHighlight?: string;
    };
  };
  priority?: number;
  updatedAt?: number;
  // ★ 追加: 企業ひも付け
  companyId?: string;
};

// 「/offers のチップで使っているラベル」 → 「どの tag で絞るか」
const THEME_DEFS: Record<
  string,
  { title: string; description: string; tag: string }
> = {
  // 冷蔵庫 レンタル 一人暮らし
  "冷蔵庫 レンタル 一人暮らし": {
    title: "一人暮らし向け 冷蔵庫レンタルを比較",
    description:
      "一人暮らし・単身赴任で使いやすい冷蔵庫レンタルを比較します。月額目安や最低利用期間、設置・回収の有無などを一覧でチェックできます。",
    tag: "冷蔵庫",
  },
  // 洗濯機 レンタル 料金 比較
  "洗濯機 レンタル 料金 比較": {
    title: "洗濯機レンタルの料金・期間を比較",
    description:
      "洗濯機を買う前にレンタルで試したい方向けに、洗濯機レンタルの料金や最低利用期間を比較します。",
    tag: "洗濯機",
  },
  // 家電 レンタル 新生活 セット
  "家電 レンタル 新生活 セット": {
    title: "新生活向け 家電レンタルセットを比較",
    description:
      "冷蔵庫・洗濯機・電子レンジなど、新生活向けの家電セットレンタルをまとめて比較します。",
    tag: "家電セット",
  },
  // ドラム式 洗濯機 レンタル 比較
  "ドラム式 洗濯機 レンタル 比較": {
    title: "ドラム式洗濯機レンタルを比較",
    description:
      "乾燥まで一気に済ませたい方向けに、ドラム式洗濯機レンタルのプランを比較します。",
    tag: "洗濯機", // ドラム式もタグは洗濯機で拾う想定
  },
  // 食洗機 レンタル 料金
  "食洗機 レンタル 料金": {
    title: "食洗機レンタルの料金を比較",
    description:
      "購入前にお試ししたい方向けに、食洗機レンタルの料金や期間を比較します。",
    tag: "食洗機",
  },
};

export default async function CompareThemePage({
  params,
}: {
  params: { theme: string };
}) {
  const siteId = getServerSiteId();
  const themeKey = decodeURIComponent(params.theme);

  const theme = THEME_DEFS[themeKey];
  if (!theme) {
    // 定義されていないテーマ名なら 404
    notFound();
  }

  // まずは「このサイトの active なオファー」をまとめて取得
  // ※ Firestore の制約回避のため、tag での絞り込みはあとでメモリ側で行う
  const offers = await fetchCollection<OfferDoc>("offers", {
    where: [
      ["siteIds", "array-contains", siteId],
      ["archived", "==", false],
      ["status", "==", "active"],
    ] as const,
    // 優先度があれば priority → なければ updatedAt で新しい順
    orderBy: ["priority", "desc"] as const,
    limit: 50,
  });

  // tags に指定タグを含むものだけを残す
  const matched = offers.filter((o) => (o.tags ?? []).includes(theme.tag));

  // 1件もなければ「準備中」ページを表示
  if (matched.length === 0) {
    return (
      <main className="container-kariraku p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="h1">{theme.title}</h1>
          <p className="text-sm text-gray-600">{theme.description}</p>
          <p className="text-xs text-gray-500">※ 本ページは広告を含みます</p>
        </header>

        <p className="text-gray-700">
          まだこのテーマで比較できるサービスがありません。順次追加予定です。
        </p>

        <p className="mt-4 text-sm">
          <Link href="/offers" className="underline">
            ← 家電レンタルの一覧に戻る
          </Link>
        </p>
      </main>
    );
  }

  // OfferCompareTable 用に整形
  const items: OfferLite[] = matched.map((o, index) => {
    const ui = o.ui ?? o.extras?.ui;

    const badges: string[] = [];
    if (ui?.compareHighlight) badges.push(ui.compareHighlight);
    if (o.badges?.length) badges.push(...o.badges);

    return {
      id: o.id,
      title: o.title ?? "",
      affiliateUrl: o.affiliateUrl ?? "",
      badges,
      priceMonthly: o.priceMonthly ?? null,
      minTermMonths: o.minTermMonths ?? null,
      notes: o.notes ?? [],
      ui: {
        priceLabel: ui?.priceLabel ?? undefined,
        minTermLabel: ui?.minTermLabel ?? undefined,
      },
      // 先頭を「おすすめ」扱いしたい場合は今後ここにフラグを足してもOK
    };
  });

  return (
    <main className="container-kariraku p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="h1">{theme.title}</h1>
        <p className="text-sm text-gray-600">{theme.description}</p>
        <p className="text-xs text-gray-500">※ 本ページは広告を含みます</p>
      </header>

      <OfferCompareTable
        items={items}
        caption={`${theme.title} の月額目安・最低利用期間・特徴を一覧で比較できます。`}
      />

      <p className="mt-4 text-sm">
        <Link href="/offers" className="underline">
          ← 家電レンタルの一覧に戻る
        </Link>
      </p>
    </main>
  );
}
