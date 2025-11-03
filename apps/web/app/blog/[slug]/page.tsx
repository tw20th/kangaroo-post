// apps/web/app/blog/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSiteId } from "@/lib/site-server";
import { fetchBlogBySlug, fetchBestPrice } from "@/lib/queries";
import Image from "next/image";

import PainRail from "@/components/pain/PainRail";
import { loadPainRules } from "@/lib/pain-helpers";
import BlogBody from "@/components/blog/BlogBody";
import { normalizeBlogMarkdown, extractToc, isA8Url } from "@/utils/markdown";
import RelatedByTags from "@/components/blog/RelatedByTags";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type BestPrice = {
  price: number;
  url: string;
  source: "amazon" | "rakuten";
  updatedAt: number;
};

// ---- utils ----
const fmt = (ts?: number) =>
  ts
    ? new Date(ts).toLocaleString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

function makeSummaryFromContent(md: string, max = 120) {
  const plain = md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? plain.slice(0, max) + "…" : plain;
}

// ---- SEO ----
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const blog = await fetchBlogBySlug(params.slug).catch(() => null);
  if (!blog) return { title: "記事が見つかりません" };
  const title = `${blog.title}｜値下げ情報・レビュー`;
  const description = blog.summary ?? makeSummaryFromContent(blog.content);
  return { title, description };
}

// ---- page ----
export default async function BlogDetail({
  params,
}: {
  params: { slug: string };
}) {
  const siteId = getServerSiteId();
  await loadPainRules(siteId); // 現状使用箇所なしでも初期化だけ

  const blog = await fetchBlogBySlug(params.slug);
  if (!blog) notFound();
  if (siteId && blog.siteId !== siteId) {
    if (process.env.NODE_ENV === "production") {
      notFound();
    } else {
      console.warn("[BlogDetail] siteId mismatch", {
        siteId,
        blogSiteId: blog.siteId,
        slug: blog.slug,
      });
    }
  }

  // 本文を正規化 → 目次を抽出
  const normalized = normalizeBlogMarkdown(blog.content);
  const toc = extractToc(normalized);

  const bestPrice: BestPrice | null = blog.relatedAsin
    ? await fetchBestPrice(blog.relatedAsin)
    : null;

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.chairscope.com"
  ).replace(/\/$/, "");
  const canonical = `${siteUrl}/blog/${blog.slug}`;

  const imageCredit = (blog as any).imageCredit ?? null;
  const imageCreditLink = (blog as any).imageCreditLink ?? null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/" className="underline">
          ホーム
        </Link>
        <span className="mx-2">/</span>
        <Link href="/blog" className="underline">
          ブログ
        </Link>
        <span className="mx-2">/</span>
        <span className="opacity-70">{blog.title}</span>
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
              {
                "@type": "ListItem",
                position: 3,
                name: blog.title,
                item: canonical,
              },
            ],
          }),
        }}
      />

      <header className="mt-3">
        <h1 className="text-2xl font-bold">{blog.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span>公開: {fmt(blog.publishedAt ?? blog.updatedAt)}</span>
          {blog.updatedAt &&
          blog.publishedAt &&
          blog.updatedAt > blog.publishedAt ? (
            <span>（更新: {fmt(blog.updatedAt)}）</span>
          ) : null}
          <span className="rounded bg-gray-100 px-2 py-0.5">
            本ページは広告を含みます
          </span>
        </div>
        {blog.summary && (
          <p className="mt-3 text-sm text-gray-700">{blog.summary}</p>
        )}
      </header>

      {/* ヒーロー画像 */}
      {blog.imageUrl && !isA8Url(blog.imageUrl) ? (
        <figure className="mt-5 overflow-hidden rounded-2xl border bg-white">
          <div className="relative w-full aspect-[16/9]">
            <Image
              src={blog.imageUrl}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
          {imageCredit && imageCreditLink ? (
            <figcaption className="px-4 py-2 text-xs text-gray-500">
              Photo by{" "}
              <a
                href={imageCreditLink}
                target="_blank"
                rel="noopener nofollow"
                className="underline"
              >
                {imageCredit}
              </a>{" "}
              on{" "}
              <a
                href="https://unsplash.com"
                target="_blank"
                rel="noopener nofollow"
                className="underline"
              >
                Unsplash
              </a>
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {/* 関連商品CTA */}
      {bestPrice && blog.relatedAsin && (
        <div className="mt-4 rounded-xl border bg-white p-4 text-sm">
          <div className="mb-1">
            関連商品の最安値:{" "}
            <strong>
              {new Intl.NumberFormat("ja-JP", {
                style: "currency",
                currency: "JPY",
              }).format(bestPrice.price)}
            </strong>
            （{bestPrice.source === "amazon" ? "Amazon" : "楽天"} /{" "}
            {fmt(bestPrice.updatedAt)}）
          </div>
          <a
            href={`/out/${encodeURIComponent(
              blog.relatedAsin
            )}?to=${encodeURIComponent(bestPrice.url)}&src=blog`}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-lg border px-4 py-2 font-medium hover:shadow-sm"
          >
            {bestPrice.source === "amazon" ? "Amazonで見る" : "楽天で見る"}
          </a>
        </div>
      )}

      {/* 目次 */}
      {toc.length > 0 && (
        <aside className="mt-6 rounded-xl border bg-white p-4 text-sm">
          <div className="mb-2 font-medium">目次</div>
          <ul className="space-y-1">
            {toc.map((t, i) => (
              <li key={i} className={t.level === 3 ? "ml-4" : ""}>
                <a href={`#${t.id}`} className="underline">
                  {t.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* 本文 */}
      <article className="mt-6">
        <BlogBody content={normalized} />
      </article>

      {/* 関連ガイド */}
      <div className="mt-8 rounded-2xl border bg-white p-5">
        {/* ★ タグ連動の関連記事 */}
        <RelatedByTags
          siteId={siteId}
          tags={(blog as any).tags ?? []}
          currentSlug={blog.slug}
        />

        {/* 既存の悩みから選ぶ（保険の回遊導線） */}
        <div className="mt-6">
          <PainRail className="my-6" />
        </div>
      </div>

      {/* 次の一歩 */}
      <div className="mt-8 rounded-2xl border bg-white p-5">
        <div className="font-semibold">次の一歩</div>
        <ul className="mt-2 list-disc pl-6 text-sm">
          <li>
            <Link href="/products" className="underline">
              条件で商品をしぼる
            </Link>
          </li>
          {bestPrice && blog.relatedAsin && (
            <li>
              <a
                href={`/out/${encodeURIComponent(
                  blog.relatedAsin
                )}?to=${encodeURIComponent(bestPrice.url)}&src=blog_bottom`}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="underline"
              >
                公式の価格ページを開く（
                {bestPrice.source === "amazon" ? "Amazon" : "楽天"}）
              </a>
            </li>
          )}
          <li>
            <Link href="/blog" className="underline">
              他の値下げ・比較記事を見る
            </Link>
          </li>
        </ul>
      </div>

      {/* JSON-LD */}
      <link rel="canonical" href={canonical} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: blog.title,
            description: blog.summary ?? makeSummaryFromContent(blog.content),
            image: blog.imageUrl,
            url: canonical,
            datePublished: blog.publishedAt
              ? new Date(blog.publishedAt).toISOString()
              : undefined,
            dateModified: blog.updatedAt
              ? new Date(blog.updatedAt).toISOString()
              : undefined,
            mainEntityOfPage: canonical,
          }),
        }}
      />
    </main>
  );
}
