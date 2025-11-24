// apps/web/app/blog/page.tsx
import Link from "next/link";
import BlogCard from "@/components/blog/BlogCard";
import { getServerSiteId } from "@/lib/site-server";
import { fetchBlogs, type BlogRow } from "@/lib/queries";

import PainRail from "@/components/pain/PainRail";

export const revalidate = 1800;
export const dynamic = "force-dynamic";

// Firestore の type と対応させた記事タイプ
type BlogType = "all" | "compare" | "daily" | "guide" | "service";
type SP = { type?: BlogType };

function formatJp(ts?: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const BLOG_TYPES: BlogType[] = ["all", "compare", "daily", "guide", "service"];

function labelForType(t: BlogType): string {
  switch (t) {
    case "all":
      return "すべて";
    case "compare":
      return "比較記事";
    case "daily":
      return "暮らしのアイデア";
    case "guide":
      return "お悩みガイド";
    case "service":
      return "サービス紹介";
    default:
      return t;
  }
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
    title: "ブログ｜値下げ情報・レビューまとめ",
    description:
      "最新の値下げ情報やレビュー記事を公開日順で表示。価格ソースと公開日時を明記しています。",
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

  // 並び順は一律「更新日の新しい順」
  const orderBy = [{ field: "updatedAt", direction: "DESCENDING" as const }];
  const blogs = await fetchBlogs(siteId, orderBy, 40);

  // Firestore の type フィールドで絞り込み
  const filtered: BlogRow[] =
    type === "all"
      ? blogs
      : blogs.filter((b) => (b.type as BlogType | null) === type);

  const lastPub = filtered.reduce<number>(
    (max, b) => Math.max(max, b.publishedAt ?? b.updatedAt ?? 0),
    0
  );

  // type だけクエリに反映
  const href = (next: Partial<SP>) => {
    const nextType = (next.type ?? type) as BlogType;
    const params = new URLSearchParams();
    if (nextType !== "all") {
      params.set("type", nextType);
    }
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
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

      <h1 className="mt-3 text-2xl font-bold">ブログ</h1>

      {/* コントロール（記事タイプ + 件数） */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="opacity-70">記事タイプ:</span>
          {BLOG_TYPES.map((t) => (
            <Link
              key={t}
              href={href({ type: t })}
              aria-current={type === t ? "page" : undefined}
              className={`rounded px-2 py-1 ${
                type === t
                  ? "bg-green-50 border border-green-300 font-medium"
                  : "hover:underline"
              }`}
            >
              {labelForType(t)}
            </Link>
          ))}
        </div>

        <div className="mx-2 h-4 w-px bg-gray-200" />
        <div className="opacity-80">記事数: {filtered.length}件</div>
        <div className="mx-2 h-4 w-px bg-gray-200" />
        <div className="opacity-80">最終公開: {formatJp(lastPub)}</div>
      </div>

      {/* サブ導線：悩みから探す */}
      <PainRail className="my-10" />

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          公開済みの記事がまだありません。
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((b) => (
            <BlogCard
              key={b.slug}
              slug={b.slug}
              title={b.title}
              summary={b.summary}
              content={(b as any).content ?? undefined}
              imageUrl={b.imageUrl}
              imageCredit={(b as any).imageCredit ?? null}
              imageCreditLink={(b as any).imageCreditLink ?? null}
              publishedAt={b.publishedAt}
              updatedAt={b.updatedAt}
            />
          ))}
        </ul>
      )}

      <div className="mt-8 text-sm text-gray-600">
        <Link href="/offers" className="underline">
          家電レンタル特集
        </Link>{" "}
        もどうぞ。値下げやキャンペーンはブログでお知らせします。
      </div>
    </main>
  );
}
