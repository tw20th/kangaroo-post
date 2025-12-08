// apps/web/app/blog/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getServerSiteId } from "@/lib/site-server";
import {
  fetchBlogBySlug,
  fetchBestPrice,
  getRelatedDiscoverBlogsByTags,
} from "@/lib/queries";

import PainRail from "@/components/pain/PainRail";
import { loadPainRules } from "@/lib/pain-helpers";
import BlogBody from "@/components/blog/BlogBody";
import { normalizeBlogMarkdown, extractToc, isA8Url } from "@/utils/markdown";
import RelatedByTags from "@/components/blog/RelatedByTags";
import TrackBlog from "@/components/analytics/TrackBlog";
import CtaLink from "@/components/analytics/CtaLink";
import RelatedDiscoverSection from "@/components/blog/RelatedDiscoverSection";
import {
  fetchOfferCompanyProfile,
  type OfferCompanyProfile,
} from "@/lib/firebase/offers";

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
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
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
    else {
      // eslint-disable-next-line no-console
      console.warn("[BlogDetail] siteId mismatch", {
        siteId,
        blogSiteId: blog.siteId,
        slug: blog.slug,
      });
    }
  }

  const normalized = normalizeBlogMarkdown(blog.content);
  const toc = extractToc(normalized);

  const bestPrice: BestPrice | null = blog.relatedAsin
    ? await fetchBestPrice(blog.relatedAsin)
    : null;

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  const canonical = `${siteUrl}/blog/${blog.slug}`;
  const imageCredit =
    (blog as unknown as { imageCredit?: string | null }).imageCredit ?? null;
  const imageCreditLink =
    (blog as unknown as { imageCreditLink?: string | null }).imageCreditLink ??
    null;

  // ★ CTR デバッグ用の URL（.env.local に設定したときだけ有効）
  const blogCtrUrl = process.env.NEXT_PUBLIC_BLOG_CTR_URL || null;
  const showCtrDebug = process.env.NODE_ENV !== "production" && !!blogCtrUrl;

  // ハイライト帯に使う要約テキスト
  const highlightText =
    blog.summary && blog.summary.trim().length > 0
      ? blog.summary
      : makeSummaryFromContent(blog.content, 160);

  // Discover関連記事
  const relatedDiscoverBlogs = await getRelatedDiscoverBlogsByTags({
    siteId,
    currentSlug: blog.slug,
    tags: (blog as unknown as { tags?: string[] }).tags ?? [],
    limit: 3,
  });

  // 🔹 offerId があれば、会社プロフィールを取得
  const offerId =
    (blog as unknown as { offerId?: string | null }).offerId ?? null;

  let companyProfile: OfferCompanyProfile | null = null;
  if (offerId) {
    companyProfile = await fetchOfferCompanyProfile(offerId);
  }

  const hasCompanyProfile =
    companyProfile !== null &&
    ((companyProfile.strengths && companyProfile.strengths.length > 0) ||
      (companyProfile.weaknesses && companyProfile.weaknesses.length > 0) ||
      (companyProfile.targetUsers && companyProfile.targetUsers.length > 0) ||
      (companyProfile.importantNotes &&
        companyProfile.importantNotes.length > 0));

  return (
    <main className="container-kariraku py-10">
      <div className="mx-auto max-w-3xl">
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
                  item: `${siteUrl}/`,
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
        <header className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight">{blog.title}</h1>
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
        </header>

        {/* この記事でわかること（ハイライト帯） */}
        {highlightText && (
          <section className="mt-4 rounded-2xl border border-emerald-50 bg-surface-featured px-4 py-3 text-sm text-gray-800 shadow-soft">
            <div className="mb-1 text-[11px] font-semibold text-emerald-800">
              この記事でわかること
            </div>
            <p className="leading-relaxed">{highlightText}</p>
          </section>
        )}

        {/* hero image */}
        {blog.imageUrl && !isA8Url(blog.imageUrl) ? (
          <figure className="mt-5 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
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
          <div className="mt-4 rounded-xl border border-black/5 bg-white p-4 text-sm shadow-soft">
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
              className="inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              {bestPrice.source === "amazon" ? "Amazonで見る" : "楽天で見る"}
            </CtaLink>
          </div>
        )}

        {/* table of contents */}
        {toc.length > 0 && (
          <aside className="mt-6 rounded-xl border border-black/5 bg-white p-4 text-sm shadow-soft">
            <div className="mb-2 font-medium">目次</div>
            <ul className="space-y-1">
              {toc.map((t, i) => (
                <li key={t.id ?? i} className={t.level === 3 ? "ml-4" : ""}>
                  <a href={`#${t.id}`} className="underline">
                    {t.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* 🔹 企業プロフィールのチラ見せ */}
        {hasCompanyProfile && companyProfile && (
          <section className="mt-6 rounded-2xl border border-emerald-50 bg-emerald-50/40 p-4 text-sm text-gray-800 shadow-soft">
            <h2 className="mb-2 text-xs font-semibold text-emerald-800">
              このサービスのポイント、そっとまとめると…
            </h2>
            <ul className="space-y-1 list-disc pl-5">
              {companyProfile.strengths
                ?.slice(0, 2)
                .map((s: string, index: number) => (
                  <li key={`strength-${index}`}>{s}</li>
                ))}
              {companyProfile.weaknesses
                ?.slice(0, 1)
                .map((w: string, index: number) => (
                  <li key={`weak-${index}`}>注意：{w}</li>
                ))}
            </ul>
            {offerId && (
              <div className="mt-2 text-right">
                <Link
                  href={`/offers/${encodeURIComponent(offerId)}`}
                  className="text-xs text-emerald-800 underline"
                >
                  もっと詳しくみる →
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ---- 本文（⭐ painId と siteId を渡す） ---- */}
        <article className="mt-6">
          <BlogBody
            content={normalized}
            siteId={siteId}
            painId={
              (blog as unknown as { painId?: string | null }).painId ?? null
            }
            slug={blog.slug}
          />
        </article>

        {/* Discover関連記事（やさしいおすすめカード） */}
        <RelatedDiscoverSection blogs={relatedDiscoverBlogs} />

        {/* 関連ガイド（関連記事だけ） */}
        <section className="mt-8 rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
          <RelatedByTags
            siteId={siteId}
            tags={(blog as unknown as { tags?: string[] }).tags ?? []}
            currentSlug={blog.slug}
          />
        </section>

        {/* 次の一歩 */}
        <div className="mt-8 rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
          <div className="font-semibold">次の一歩</div>
          <ul className="mt-2 list-disc pl-6 text-sm">
            <li>
              <Link href="/offers" className="underline">
                家電レンタルのおすすめサービスを見る
              </Link>
            </li>
            <li>
              <Link href="/compare" className="underline">
                月額・最低期間でサービスを比較する
              </Link>
            </li>
            <li>
              <Link href="/blog" className="underline">
                他のブログ記事を見る
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
                  className="text-xs text-gray-500 underline"
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
      </div>
    </main>
  );
}
