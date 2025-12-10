// apps/web/app/blog/page.tsx
import Link from "next/link";
import BlogCard from "@/components/blog/BlogCard";
import { getServerSiteId } from "@/lib/site-server";
import { fetchBlogs, type BlogRow } from "@/lib/queries";
import FeaturedDiscoverList from "@/components/blog/FeaturedDiscoverList";

export const revalidate = 1800;
export const dynamic = "force-dynamic";

// Firestore の type と対応させた記事タイプ
type BlogType = "all" | "compare" | "daily" | "guide" | "service" | "discover";

// 並び替えモード
type SortMode = "new" | "popular";

type SP = {
  type?: BlogType;
  sort?: SortMode;
};

function formatJp(ts?: number | null) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 一覧に出すタブ順
const BLOG_TYPES: BlogType[] = [
  "all",
  "compare",
  "daily",
  "guide",
  "service",
  "discover",
];

const SORT_MODES: SortMode[] = ["popular", "new"]; // 表示順：人気順 → 新着順

function labelForType(t: BlogType): string {
  switch (t) {
    case "all":
      return "すべての記事";
    case "compare":
      return "比較・まとめ記事";
    case "daily":
      return "日々のヒント";
    case "guide":
      return "お悩みガイド";
    case "service":
      return "サービス・機能紹介";
    case "discover":
      return "読みもの・コラム";
    default:
      return t;
  }
}

// 人気順用のスコア（views と latestScore をミックス）
function calcPopularityScore(b: BlogRow): number {
  const views = Number((b as { views?: number }).views ?? 0);
  const latestScore = Number((b as { latestScore?: number }).latestScore ?? 0);

  const viewsWeight = Math.log10(views + 1) * 30;
  const scoreWeight = latestScore;

  return viewsWeight + scoreWeight;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SP;
}) {
  const rawType = searchParams?.type as BlogType | undefined;
  const type: BlogType = BLOG_TYPES.includes(rawType ?? "all")
    ? rawType ?? "all"
    : "all";

  const indexable = type === "all";

  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  return {
    title: "ブログ｜サイト運営のヒントとお知らせ",
    description:
      "サイト更新がしんどい人のための、やさしい記事のまとめです。カンガルーポストの使い方や、ゆるく続けるためのコツなどを掲載しています。",
    alternates: { canonical: `${base}/blog` },
    robots: {
      index: indexable,
      follow: true,
      googleBot: { index: indexable, follow: true },
    },
  };
}

export default async function BlogIndex({
  searchParams,
}: {
  searchParams?: SP;
}) {
  const siteId = getServerSiteId();

  const rawType = searchParams?.type as BlogType | undefined;
  const type: BlogType = BLOG_TYPES.includes(rawType ?? "all")
    ? rawType ?? "all"
    : "all";

  const rawSort = searchParams?.sort as SortMode | undefined;
  const sortMode: SortMode = SORT_MODES.includes(rawSort ?? "popular")
    ? rawSort ?? "popular"
    : "popular";

  // Firestore からは updatedAt 降順で 40 件取得（Discover もまとめて取る）
  const orderBy = [{ field: "updatedAt", direction: "DESCENDING" as const }];
  const blogs = await fetchBlogs(siteId, orderBy, 40);

  // ★ 今読まれている Discover 用（おすすめエリア）
  const featuredDiscover = blogs
    .filter((b) => (b.type as string | null) === "discover")
    .sort((a, b) => {
      const aTime = a.publishedAt ?? a.updatedAt ?? 0;
      const bTime = b.publishedAt ?? b.updatedAt ?? 0;
      return bTime - aTime; // 新しい順
    })
    .slice(0, 3)
    .map((b) => ({
      slug: b.slug,
      title: b.title,
      summary: b.summary ?? null,
    }));

  const isDiscover = (b: BlogRow): boolean =>
    (b.type as string | null) === "discover";

  // Firestore の type フィールドで絞り込み
  const filtered: BlogRow[] = (() => {
    if (type === "discover") {
      return blogs.filter((b) => isDiscover(b));
    }

    const nonDiscover = blogs.filter((b) => !isDiscover(b));

    if (type === "all") {
      return nonDiscover;
    }

    return nonDiscover.filter((b) => (b.type as BlogType | null) === type);
  })();

  // 人気順 / 新着順の並び替え
  const sorted: BlogRow[] = [...filtered];
  if (sortMode === "popular") {
    sorted.sort((a, b) => calcPopularityScore(b) - calcPopularityScore(a));
  } else {
    sorted.sort((a, b) => {
      const aTime = a.updatedAt ?? a.publishedAt ?? 0;
      const bTime = b.updatedAt ?? b.publishedAt ?? 0;
      return bTime - aTime;
    });
  }

  const lastPub = sorted.reduce<number>(
    (max, b) => Math.max(max, b.publishedAt ?? b.updatedAt ?? 0),
    0
  );

  // type / sort をクエリに反映
  const href = (next: Partial<SP>) => {
    const nextType = (next.type ?? type) as BlogType;
    const nextSort = (next.sort ?? sortMode) as SortMode;

    const params = new URLSearchParams();
    if (nextType !== "all") params.set("type", nextType);
    if (nextSort !== "popular") params.set("sort", nextSort);

    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  return (
    <main className="container-kariraku py-10">
      {/* breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/" className="underline">
          ホーム
        </Link>
        <span className="mx-2">/</span>
        <span className="opacity-70">ブログ</span>
      </nav>

      {/* 構造化データ: BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "ホーム",
                item: siteUrl + "/",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "ブログ",
                item: `${siteUrl}/blog`,
              },
            ],
          }),
        }}
      />

      <header className="mt-3 mb-4">
        <h1 className="text-2xl font-bold tracking-tight">ブログ</h1>
        <p className="mt-1 text-sm text-gray-600">
          サイト更新がしんどいときのヒントや、カンガルーポストの使い方・考え方をまとめています。
        </p>
      </header>

      {/* ★ 今読まれている Discover（おすすめエリア） */}
      <FeaturedDiscoverList blogs={featuredDiscover} />

      {/* コントロール（並び替え + 記事タイプ + 件数） */}
      <div className="mt-4 rounded-2xl bg-surface-featured px-4 py-3 text-sm shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* 並び替え：左側 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="opacity-70">並び替え:</span>
            <div className="inline-flex rounded-full bg-gray-100 p-1">
              {SORT_MODES.map((m) => (
                <Link
                  key={m}
                  href={href({ sort: m })}
                  aria-current={sortMode === m ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-xs md:text-sm ${
                    sortMode === m
                      ? "bg-white font-medium text-emerald-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {m === "popular" ? "人気順" : "新着順"}
                </Link>
              ))}
            </div>
          </div>

          {/* 記事タイプ：右側（横スクロール可） */}
          <div className="flex flex-col gap-2 md:items-end">
            <span className="opacity-70 text-xs md:text-sm">記事タイプ:</span>
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
              {BLOG_TYPES.map((t) => (
                <Link
                  key={t}
                  href={href({ type: t })}
                  aria-current={type === t ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs md:text-sm ${
                    type === t
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium"
                      : "bg-white/80 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {labelForType(t)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* 件数 & 最終公開 */}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-2 text-[11px] text-gray-600 md:text-xs">
          <div>記事数: {sorted.length}件</div>
          <span className="hidden h-3 w-px bg-gray-200 md:inline-block" />
          <div>最終公開: {formatJp(lastPub)}</div>
        </div>
      </div>

      {/* 記事一覧 */}
      {sorted.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600">
          公開済みの記事がまだありません。
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {sorted.map((b) => (
            <BlogCard
              key={b.slug}
              slug={b.slug}
              title={b.title}
              summary={b.summary}
              content={(b as { content?: string }).content ?? undefined}
              imageUrl={b.imageUrl}
              imageCredit={(b as { imageCredit?: string | null }).imageCredit}
              imageCreditLink={
                (b as { imageCreditLink?: string | null }).imageCreditLink
              }
              publishedAt={b.publishedAt}
              updatedAt={b.updatedAt}
            />
          ))}
        </ul>
      )}

      <div className="mt-8 space-y-1 text-sm text-gray-600">
        <div>
          <Link href="/" className="underline">
            カンガルーポストについて
          </Link>{" "}
          もどうぞ。サービスのイメージや、自動生成される記事の雰囲気をご紹介しています。
        </div>
      </div>
    </main>
  );
}
