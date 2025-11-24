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
import TrackBlog from "@/components/analytics/TrackBlog";
import CtaLink from "@/components/analytics/CtaLink";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type BestPrice = {
  price: number;
  url: string;
  source: "amazon" | "rakuten";
  updatedAt: number;
};

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

export default async function BlogDetail({
  params,
}: {
  params: { slug: string };
}) {
  const siteId = getServerSiteId();
  await loadPainRules(siteId);

  const blog = await fetchBlogBySlug(params.slug);
  if (!blog) notFound();
  if (siteId && blog.siteId !== siteId) {
    if (process.env.NODE_ENV === "production") notFound();
    else
      console.warn("[BlogDetail] siteId mismatch", {
        siteId,
        blogSiteId: blog.siteId,
        slug: blog.slug,
      });
  }

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

  // ★ CTR デバッグ用の URL（.env.local に設定したときだけ有効）
  const blogCtrUrl = process.env.NEXT_PUBLIC_BLOG_CTR_URL || null;
  const showCtrDebug = process.env.NODE_ENV !== "production" && !!blogCtrUrl;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* ★ view トラッキング（siteId を渡す） */}
      <TrackBlog slug={blog.slug} siteId={siteId} />

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

      {/* structured data */}
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

      {/* header */}
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

      {/* hero image */}
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

      {/* related product CTA */}
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
          <CtaLink
            slug={blog.slug}
            siteId={siteId}
            whereKey="cta_bestPrice_top"
            href={`/out/${encodeURIComponent(
              blog.relatedAsin
            )}?to=${encodeURIComponent(bestPrice.url)}&src=blog`}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-lg border px-4 py-2 font-medium hover:shadow-sm"
          >
            {bestPrice.source === "amazon" ? "Amazonで見る" : "楽天で見る"}
          </CtaLink>
        </div>
      )}

      {/* table of contents */}
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

      {/* ---- 本文（⭐ painId と siteId を渡す） ---- */}
      <article className="mt-6">
        <BlogBody
          content={normalized}
          siteId={siteId}
          painId={(blog as any).painId ?? null}
          slug={blog.slug}
        />
      </article>

      {/* 関連ガイド（関連記事だけ） */}
      <section className="mt-8 rounded-2xl border bg-white p-5">
        <RelatedByTags
          siteId={siteId}
          tags={(blog as any).tags ?? []}
          currentSlug={blog.slug}
        />
      </section>

      {/* next actions */}
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
              <CtaLink
                slug={blog.slug}
                siteId={siteId}
                whereKey="cta_bestPrice_bottom"
                href={`/out/${encodeURIComponent(
                  blog.relatedAsin
                )}?to=${encodeURIComponent(bestPrice.url)}&src=blog_bottom`}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="underline"
              >
                公式の価格ページを開く（
                {bestPrice.source === "amazon" ? "Amazon" : "楽天"}）
              </CtaLink>
            </li>
          )}
          <li>
            <Link href="/blog" className="underline">
              他の値下げ・比較記事を見る
            </Link>
          </li>

          {/* ★ CTR デバッグボタン（開発環境だけ表示） */}
          {showCtrDebug && blogCtrUrl && (
            <li>
              <a
                href={`${blogCtrUrl}?siteId=${encodeURIComponent(
                  siteId
                )}&slug=${encodeURIComponent(blog.slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-xs text-gray-500"
              >
                クリック率を取得（デバッグ）
              </a>
            </li>
          )}
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
