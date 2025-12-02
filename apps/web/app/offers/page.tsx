// apps/web/app/offers/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSiteId, getSiteEntry } from "@/lib/site-server";
import OfferGallery from "@/components/offers/OfferGallery";
import OfferCompareTable, {
  type OfferLite,
} from "@/components/offers/OfferCompareTable";
import {
  fsRunQuery,
  vStr,
  vNum,
  fsGetStringArray,
  type FsValue,
  docIdFromName,
  fsDecode,
} from "@/lib/firestore-rest";
import type { Metadata } from "next";

export const revalidate = 60;
export const dynamic = "force-dynamic";

type FsDoc = { name: string; fields: Record<string, FsValue> };

type SiteOffersConfig = {
  metaTitle?: string;
  metaDescription?: string;
  heroTitle?: string;
  heroLead?: string;
  breadcrumbOffersLabel?: string;
};

function normalizeOffer(d: FsDoc): OfferLite {
  const f = d.fields;

  const extras =
    f?.extras !== undefined ? (fsDecode(f.extras) as unknown) : undefined;

  const topLevelUi =
    f?.ui !== undefined ? (fsDecode(f.ui) as OfferLite["ui"]) : undefined;
  const ui =
    topLevelUi ??
    (extras && typeof extras === "object"
      ? (extras as { ui?: OfferLite["ui"] }).ui
      : undefined);

  return {
    id: docIdFromName(d.name),
    title: vStr(f, "title") ?? "",
    affiliateUrl: vStr(f, "affiliateUrl") ?? vStr(f, "landingUrl") ?? "",
    badges: fsGetStringArray(f, "badges") ?? [],
    priceMonthly: vNum(f, "priceMonthly") ?? null,
    minTermMonths: vNum(f, "minTermMonths") ?? null,
    notes:
      fsGetStringArray(f, "highlights") ?? fsGetStringArray(f, "tags") ?? [],
    ui,
  };
}

async function fetchTopOffers(siteId: string, limit = 3): Promise<OfferLite[]> {
  const docs = await fsRunQuery({
    collection: "offers",
    where: [
      { field: "siteIds", op: "ARRAY_CONTAINS", value: siteId },
      { field: "archived", value: false },
    ],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit,
  }).catch(() => [] as FsDoc[]);
  return (docs as FsDoc[]).map(normalizeOffer);
}

async function fetchCompareKeywords(siteId: string): Promise<string[]> {
  try {
    const siteDoc = await fetch(
      `https://firestore.googleapis.com/v1/projects/${
        process.env.NEXT_PUBLIC_FB_PROJECT_ID
      }/databases/(default)/documents/sites/${encodeURIComponent(siteId)}?key=${
        process.env.NEXT_PUBLIC_FB_API_KEY
      }`,
      { cache: "no-store" }
    ).then((r) => r.json());

    const arr =
      siteDoc?.fields?.keywordPools?.mapValue?.fields?.comparison?.arrayValue
        ?.values ?? [];

    const fromSite = arr
      .map(
        (v: unknown) => (v as { stringValue?: string | undefined })?.stringValue
      )
      .filter((v: string | undefined): v is string => Boolean(v));

    if (fromSite.length) return fromSite;
  } catch {
    // noop: fallback に進む
  }

  // fallback: 人気タグ上位
  const docs = (await fsRunQuery({
    collection: "offers",
    where: [
      { field: "siteIds", op: "ARRAY_CONTAINS", value: siteId },
      { field: "archived", value: false },
    ],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 100,
  }).catch(() => [] as FsDoc[])) as FsDoc[];

  const count = new Map<string, number>();
  for (const d of docs) {
    const tags = fsGetStringArray(d.fields, "tags") ?? [];
    for (const t of tags) count.set(t, (count.get(t) ?? 0) + 1);
  }

  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
}

/** JSON-LD 用の軽量一覧（ItemList） */
async function fetchOffersForSchema(siteId: string, limit = 24) {
  const docs = await fsRunQuery({
    collection: "offers",
    where: [
      { field: "siteIds", op: "ARRAY_CONTAINS", value: siteId },
      { field: "archived", value: false },
    ],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit,
  }).catch(() => [] as FsDoc[]);
  return (docs as FsDoc[]).map((d) => {
    const f = d.fields;
    return {
      id: docIdFromName(d.name),
      name: vStr(f, "title") ?? "",
      url: vStr(f, "affiliateUrl") ?? vStr(f, "landingUrl") ?? "",
      priceMonthly: vNum(f, "priceMonthly") ?? null,
    };
  });
}

/** ページメタ（タイトル/ディスクリプション） */
export async function generateMetadata(): Promise<Metadata> {
  const site = getSiteEntry();
  const offersConfig = (site as { offers?: SiteOffersConfig }).offers;

  const title =
    offersConfig?.metaTitle ??
    "家電レンタルのおすすめ一覧｜比較・料金・最低期間";
  const description =
    offersConfig?.metaDescription ??
    "引越しや転勤、一人暮らしのスタートに便利な家電レンタルサービスをまとめて比較。月額料金・最低利用期間・特徴をわかりやすく一覧表示します。（本ページは広告を含みます）";

  return {
    title,
    description,
  };
}

/* ===== 悩みシーンごとの説明文（Kariraku 用デフォルト） ===== */
const scenePresets: {
  [key: string]: {
    label: string;
    title: string;
    body: string;
    hint: string;
  };
} = {
  move: {
    label: "シーン：引越し・転勤",
    title: "引越し・転勤前後の負担を軽くしたい方へ",
    body: "数ヶ月〜数年だけ家電がほしいときは、冷蔵庫や洗濯機をレンタルにすると、買い替えや処分の手間を減らせます。",
    hint: "まずは月額と最低期間を見て、今の暮らし方に合うサービスからチェックしてみてください。",
  },
  cost: {
    label: "シーン：初期費用を抑えたい",
    title: "まとまった出費をおさえたい方へ",
    body: "敷金・礼金・引越し料金が重なるタイミングでは、家電を“月額払い”にすると、初期費用をぐっと抑えやすくなります。",
    hint: "比較表では「月額の目安」と「最低利用期間」を中心に見ると、トータルの負担感がイメージしやすくなります。",
  },
  single: {
    label: "シーン：一人暮らしのスタート",
    title: "とりあえず暮らし始めたい方へ",
    body: "一人暮らしを始めるとき、最初から全部そろえず、最低限の家電をレンタルして様子を見る選び方もあります。",
    hint: "セットプランや短期OKのサービスからチェックすると、身軽にスタートしやすくなります。",
  },
};

type OffersPageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default async function OffersPage({ searchParams }: OffersPageProps) {
  const siteId = getServerSiteId();
  const site = getSiteEntry();

  if (site.features?.offers === false) notFound();

  const offersConfig = (site as { offers?: SiteOffersConfig }).offers ?? {};

  const heroTitle = offersConfig.heroTitle ?? "家電レンタルおすすめ";
  const heroLead =
    offersConfig.heroLead ??
    "引越し・転勤・一人暮らしの負担を軽くする、家電レンタルサービスをまとめました。";

  const breadcrumbOffersLabel = offersConfig.breadcrumbOffersLabel ?? heroTitle;

  const [top3, keywords, schemaOffers] = await Promise.all([
    fetchTopOffers(siteId, 3),
    fetchCompareKeywords(siteId),
    fetchOffersForSchema(siteId, 24),
  ]);

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: breadcrumbOffersLabel,
        item: `${siteUrl}/offers`,
      },
    ],
  };

  const itemListLd =
    schemaOffers.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: schemaOffers.map((o, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: o.name,
            url: o.url || `${siteUrl}/offers/${encodeURIComponent(o.id)}`,
          })),
        }
      : null;

  const rawScene = searchParams?.scene ?? searchParams?.theme ?? undefined;
  const sceneKey =
    typeof rawScene === "string"
      ? rawScene
      : Array.isArray(rawScene)
      ? rawScene[0]
      : undefined;
  const activeScene = sceneKey ? scenePresets[sceneKey] : undefined;

  return (
    <main className="container-kariraku space-y-10 py-10">
      {/* 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}

      {/* breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/" className="underline">
          ホーム
        </Link>
        <span className="mx-2">/</span>
        <span className="opacity-70">{breadcrumbOffersLabel}</span>
      </nav>

      {/* Hero（blog と同じリズムの見出しエリア） */}
      <section className="mt-2 rounded-3xl border border-black/5 bg-white/80 px-5 py-6 shadow-soft">
        <p className="text-xs font-semibold text-emerald-700">
          家電レンタル特集
        </p>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">
          {heroTitle}
        </h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{heroLead}</p>
        <p className="mt-1 text-[11px] text-gray-500">
          ※ 本ページは広告を含みます
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/compare" className="btn btn-brand">
            まずは比較して選ぶ →
          </Link>
          <Link href="#all" className="btn btn-ghost">
            すべてのサービスを見る
          </Link>
        </div>
      </section>

      {/* 悩み別ガイド（シーン指定があるときだけ表示） */}
      {activeScene && (
        <section className="card space-y-2 px-4 py-3 text-sm text-emerald-900">
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

      {/* 比較キーワード */}
      {keywords.length > 0 && (
        <section className="space-y-3">
          <h2 className="h2">よく見られている比較キーワード</h2>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <Link
                key={k}
                href={`/compare/${encodeURIComponent(k)}`}
                className="rounded-full border border-emerald-100 bg-white/80 px-3 py-1 text-xs sm:text-sm text-gray-700 hover:bg-emerald-50/70"
              >
                {k}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* クイック比較（表はやわらかいカード内に） */}
      {top3.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="h2">まずは3社をサクッと比較</h2>
            <Link
              href="/compare"
              className="text-xs sm:text-sm text-emerald-700 hover:underline"
            >
              もっと比較する
            </Link>
          </div>
          <OfferCompareTable
            items={top3}
            caption="月額の目安・最低期間・特徴を一覧で比較"
          />
        </section>
      )}

      {/* 一覧 */}
      <section id="all" className="space-y-3 pb-4">
        <div className="flex items-baseline justify-between">
          <h2 className="h2">掲載中のサービス一覧</h2>
        </div>
        <OfferGallery siteId={siteId} variant="grid" limit={24} />
      </section>
    </main>
  );
}
