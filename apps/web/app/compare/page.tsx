import Link from "next/link";
import type { Metadata } from "next";
import OfferCompareTable, {
  type OfferLite,
} from "@/components/offers/OfferCompareTable";
import {
  fsRunQuery,
  fsDecode,
  fsGetStringArray,
  type FsValue,
  docIdFromName,
} from "@/lib/firestore-rest";
import { getServerSiteId } from "@/lib/site-server";

type FsDoc = {
  name: string;
  fields: Record<string, FsValue>;
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "家電レンタルサービスの比較一覧",
  description:
    "家電レンタルサービスの月額料金・最低利用期間・特徴を一覧で比較できるページです。引越し・転勤・一人暮らしのスタートなど、今の暮らし方に合うサービス選びの参考にしてください。（本ページは広告を含みます）",
};

/* scenePresets はそのまま */

const scenePresets: {
  [key: string]: {
    label: string;
    title: string;
    body: string;
    hint: string;
  };
} = {
  // ...（ここは今のままでOK）
  move: {
    label: "シーン：引越し・転勤",
    title: "引越し・転勤で家電を一時的に使いたい方へ",
    body: "数ヶ月〜数年だけ家電がほしいときは、冷蔵庫や洗濯機をレンタルにすると、買い替えや処分の手間を減らせます。",
    hint: "最低利用期間が短いサービスほど、引越しやライフスタイルの変化に合わせて解約・見直しがしやすくなります。",
  },
  cost: {
    label: "シーン：初期費用を抑えたい",
    title: "まとまった出費をできるだけ抑えたい方へ",
    body: "敷金・礼金・引越し料金が重なるタイミングでは、家電を“月額払い”にすると、初期費用をぐっと抑えやすくなります。",
    hint: "月額料金の安さだけでなく、最低利用期間を含めたトータルの支払いイメージを見るのがおすすめです。",
  },
  single: {
    label: "シーン：一人暮らしのスタート",
    title: "とりあえず暮らし始めたい一人暮らしの方へ",
    body: "一人暮らしを始めるとき、最初から全部そろえず、最低限の家電をレンタルして様子を見る選び方もあります。",
    hint: "セットプランや短期OKのサービスを中心に比較すると、身軽に暮らし始めやすくなります。",
  },
};

type ComparePageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const siteId = getServerSiteId();

  const rawScene = searchParams?.scene ?? searchParams?.theme ?? undefined;
  const sceneKey =
    typeof rawScene === "string"
      ? rawScene
      : Array.isArray(rawScene)
      ? rawScene[0]
      : undefined;

  const activeScene = sceneKey ? scenePresets[sceneKey] : undefined;

  const raw = (await fsRunQuery({
    collection: "offers",
    where: [
      { field: "siteIds", op: "ARRAY_CONTAINS", value: siteId },
      { field: "archived", op: "EQUAL", value: false },
      { field: "status", op: "EQUAL", value: "active" },
    ],
    limit: 10,
  })) as FsDoc[];

  const baseItems: OfferLite[] = raw.map((doc) => {
    const f = doc.fields;
    const ui = (fsDecode(f.ui) as OfferLite["ui"]) ?? undefined;
    const notes = fsGetStringArray(f, "notes") ?? [];

    return {
      id: docIdFromName(doc.name),
      title: (fsDecode(f.title) as string | null) ?? "",
      affiliateUrl: (fsDecode(f.affiliateUrl) as string | null) ?? "",
      badges: fsGetStringArray(f, "badges") ?? [],
      priceMonthly: (fsDecode(f.priceMonthly) as number | null) ?? null,
      minTermMonths: (fsDecode(f.minTermMonths) as number | null) ?? null,
      notes,
      ui,
      isRecommended: false,
      compareHighlight:
        (ui &&
          (ui as unknown as { compareHighlight?: string | null })
            .compareHighlight) ??
        notes[0] ??
        undefined,
    };
  });

  let recommendedIndex = 0;

  if (baseItems.length > 0) {
    if (sceneKey === "cost") {
      let min = Number.POSITIVE_INFINITY;
      baseItems.forEach((item, index) => {
        const price =
          typeof item.priceMonthly === "number"
            ? item.priceMonthly
            : Number.POSITIVE_INFINITY;
        if (price < min) {
          min = price;
          recommendedIndex = index;
        }
      });
    } else if (sceneKey === "move") {
      let min = Number.POSITIVE_INFINITY;
      baseItems.forEach((item, index) => {
        const term =
          typeof item.minTermMonths === "number"
            ? item.minTermMonths
            : Number.POSITIVE_INFINITY;
        if (term < min) {
          min = term;
          recommendedIndex = index;
        }
      });
    } else {
      recommendedIndex = 0;
    }
  }

  const items: OfferLite[] = baseItems.map((item, index) => ({
    ...item,
    isRecommended: index === recommendedIndex,
  }));

  return (
    <main className="container-kariraku space-y-6 py-10">
      <nav className="text-sm text-gray-500">
        <Link href="/" className="underline">
          ホーム
        </Link>
        <span className="mx-2">/</span>
        <span className="opacity-70">家電レンタルの比較</span>
      </nav>

      <header className="space-y-2">
        <h1 className="h1">家電レンタルサービスを一覧で比較</h1>
        <p className="lead">
          月額の目安・最低利用期間・特徴をまとめて比較できます。引越し・転勤・一人暮らしのスタートなど、
          今の暮らし方に合うサービス選びの参考にしてください。
        </p>
        <p className="text-xs text-gray-400">※ 本ページは広告を含みます</p>
      </header>

      {activeScene && (
        <section className="space-y-1 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="text-xs font-semibold text-emerald-800">
            {activeScene.label}
          </p>
          <h2 className="text-sm font-semibold">{activeScene.title}</h2>
          <p className="text-sm leading-relaxed">{activeScene.body}</p>
          <p className="text-xs leading-relaxed text-emerald-800">
            {activeScene.hint}
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          月額・最低期間・特徴の一覧比較
        </h2>
        <OfferCompareTable
          caption="月額の目安・最低利用期間・特徴を一覧で比較"
          items={items}
        />
        <p className="mt-2 text-xs text-gray-500">
          ※
          掲載している料金や条件は作成時点のものです。最新情報は必ず各公式サイトでご確認ください。
        </p>
      </section>

      <p className="text-sm">
        <Link
          href="/offers"
          className="inline-flex items-center gap-1 underline"
        >
          ← 家電レンタルの一覧に戻る
        </Link>
      </p>
    </main>
  );
}
