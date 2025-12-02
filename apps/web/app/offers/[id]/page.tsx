/* eslint-disable @next/next/no-img-element */
export const revalidate = 0;
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fsGet,
  fsDecode,
  fsGetStringArray,
  fsRunQuery,
} from "@/lib/firestore-rest";
import { getServerSiteId, getSiteEntry } from "@/lib/site-server";
import FaqList from "@/components/common/FaqList";
import RelatedByTags from "@/components/common/RelatedByTags";
import { fetchRelatedOffersByTags } from "@/lib/queries";
import TrackLink from "@/components/common/TrackLink";
import OfferDetailSections from "@/components/offers/OfferDetailSections";

/* ===== types ===== */
type Creative = {
  type: "banner" | "text";
  href: string;
  imgSrc?: string;
  size?: string; // "300x250" (A8)
  materialId?: string;
  label?: string;
};

type VendorSnapshot = {
  vendorId: string;
  name: string;
  siteUrl?: string | null;
  logoUrl?: string | null;
} | null;

type ProductSnapshot = {
  productId: string;
  title: string;
  category: string[];
  images?: string[];
  tags?: string[];
} | null;

type Cta = { type: "a8" | "external"; programId?: string; href: string } | null;
type Shipping = { policy?: string } | null;
type Promotion = {
  couponCode?: string | null;
  validUntil?: string | null;
} | null;

type OfferUi = {
  priceLabel?: string;
  minTermLabel?: string;
  isPriceDynamic?: boolean;
  shippingNote?: string;
  paymentNote?: string;
  warrantyNote?: string;
  faqBullets?: string[];
  /** 比較用の一言ラベル（例：コスパ重視 / 全国配送対応） */
  highlightLabel?: string;
};

type OfferDoc = {
  id: string;
  siteId?: string;
  title: string;
  description?: string;
  images?: string[];
  creatives?: Creative[];
  status?: string;
  archived?: boolean;
  updatedAt?: number;
  tags?: string[];
  notes?: string[];
  planType?: "subscription" | "one-time" | "product" | "trial";
  priceMonthly?: number | null;
  priceRange?: number | null;
  minTermMonths?: number | null;
  ratingValue?: number | null;
  ratingCount?: number | null;
  vendorSnapshot?: VendorSnapshot;
  productSnapshot?: ProductSnapshot;
  cta?: Cta;
  shipping?: Shipping;
  promotion?: Promotion;
  // 追加
  extras?: unknown;
  ui?: OfferUi;
};

/* ===== helpers ===== */
function parseSize(size?: string): { w: number; h: number } | null {
  if (!size) return null;
  const m = size.match(/(\d+)[xX](\d+)/);
  if (!m) return null;
  return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
}
function pickBestBanner(
  creatives?: Creative[]
): { img: string; href?: string; w: number; h: number } | null {
  if (!creatives?.length) return null;
  const banners = creatives.filter(
    (c) => c.type === "banner" && (c.imgSrc || c.size)
  );
  if (banners.length === 0) return null;
  const scored = banners.map((b) => {
    const size = parseSize(b.size);
    const w = size?.w ?? 1200;
    const h = size?.h ?? 628;
    const area = w * h;
    return { img: b.imgSrc!, href: b.href, w, h, area };
  });
  const best = scored.sort((a, b) => b.area - a.area)[0];
  return best ?? null;
}

async function fetchOfferByAnyId(rawParamId: string) {
  const id = decodeURIComponent(rawParamId);
  const byId = await fsGet({ path: `offers/${id}` }).catch(() => null);
  if (byId) return byId;

  // 互換: "programId:vendor" 形式をサポート（旧データ向け）
  const [programId, vendor] = id.split(":");
  if (!programId) return null;
  const tryBoth = await fsRunQuery({
    collection: "offers",
    where: [
      { field: "programId", value: programId },
      ...(vendor ? [{ field: "vendor", value: vendor }] : []),
    ],
    limit: 1,
  }).catch(() => []);
  // @ts-ignore
  if (tryBoth && tryBoth[0]) return tryBoth[0];

  const tryProgOnly = await fsRunQuery({
    collection: "offers",
    where: [{ field: "programId", value: programId }],
    limit: 1,
  }).catch(() => []);
  // @ts-ignore
  return tryProgOnly && tryProgOnly[0] ? tryProgOnly[0] : null;
}

/* ===== Metadata（タイトル/説明） ===== */
export async function generateMetadata({ params }: { params: { id: string } }) {
  const res: unknown = await fetchOfferByAnyId(params.id);
  // @ts-ignore
  if (!res?.fields) return {};
  // @ts-ignore
  const f = res.fields;
  const title = (fsDecode(f?.title) as string) ?? "レンタルサービス";
  const desc =
    (fsDecode(f?.description) as string) ??
    "家電レンタルの料金・最低利用期間の詳細。";
  return {
    title: `${title}｜家電レンタルの詳細`,
    description: desc.slice(0, 160),
  };
}

/* ===== page ===== */
export default async function OfferDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const site = getSiteEntry();
  if (site.features?.offers === false) notFound();

  const siteId = getServerSiteId();
  const res: unknown = await fetchOfferByAnyId(params.id);
  // @ts-ignore
  if (!res) notFound();

  // @ts-ignore
  const f = res.fields;

  const offer: OfferDoc = {
    id: decodeURIComponent(params.id),
    siteId: (fsDecode(f?.siteId) as string | undefined) ?? undefined,
    title: (fsDecode(f?.title) as string) ?? "(no title)",
    description: (fsDecode(f?.description) as string) ?? "",
    images: fsGetStringArray(f, "images") ?? [],
    creatives: (fsDecode(f?.creatives) as Creative[]) ?? [],
    status: (fsDecode(f?.status) as string) ?? undefined,
    archived: (fsDecode(f?.archived) as boolean) ?? false,
    updatedAt: (fsDecode(f?.updatedAt) as number) ?? undefined,
    tags: fsGetStringArray(f, "tags") ?? [],
    notes: fsGetStringArray(f, "notes") ?? [],
    planType: (fsDecode(f?.planType) as OfferDoc["planType"]) ?? undefined,
    priceMonthly: (fsDecode(f?.priceMonthly) as number | null) ?? null,
    priceRange: (fsDecode(f?.priceRange) as number | null) ?? null,
    minTermMonths: (fsDecode(f?.minTermMonths) as number | null) ?? null,
    ratingValue: (fsDecode(f?.ratingValue) as number | null) ?? null,
    ratingCount: (fsDecode(f?.ratingCount) as number | null) ?? null,
    vendorSnapshot: (fsDecode(f?.vendorSnapshot) as VendorSnapshot) ?? null,
    productSnapshot: (fsDecode(f?.productSnapshot) as ProductSnapshot) ?? null,
    cta: (fsDecode(f?.cta) as Cta) ?? null,
    shipping: (fsDecode(f?.shipping) as Shipping) ?? null,
    promotion: (fsDecode(f?.promotion) as Promotion) ?? null,
    // 追加（互換）
    extras: (fsDecode(f?.extras) as unknown) ?? undefined,
    ui: (fsDecode(f?.ui) as OfferDoc["ui"]) ?? undefined,
  };

  // 非公開・サイト不一致は 404
  if (offer.archived) notFound();
  if (offer.status && offer.status !== "active") notFound();
  if (offer.siteId && offer.siteId !== siteId) notFound();

  // 表示用UIメモ（旧 extras.ui を互換吸収）
  const fallbackUi =
    offer.extras && typeof offer.extras === "object" && offer.extras !== null
      ? (offer.extras as { ui?: OfferUi }).ui
      : undefined;
  const ui: OfferUi | undefined = offer.ui ?? fallbackUi;

  // 「こんな方におすすめ」用の箇条書き
  const recommendBullets: string[] = ui?.faqBullets ?? [];

  // ヒーロー（A8バナー or product画像）
  const banner = pickBestBanner(offer.creatives);
  const productHero =
    offer.productSnapshot?.images && offer.productSnapshot.images[0]
      ? offer.productSnapshot.images[0]
      : undefined;

  // CTAリンクの決定順：cta.href > text素材 > バナー > 自ページ
  const textCreative = offer.creatives?.find((c) => c.type === "text");
  const ctaHref =
    offer.cta?.href ??
    textCreative?.href ??
    banner?.href ??
    `${
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? ""
    }/offers/${encodeURIComponent(offer.id)}`;

  const related = await fetchRelatedOffersByTags(
    siteId,
    offer.tags ?? [],
    offer.id,
    3
  );

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  /* ===== JSON-LD: パンくず + Service/Offer ===== */
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: siteUrl + "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "家電レンタル",
        item: `${siteUrl}/offers`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: offer.title,
        item: `${siteUrl}/offers/${encodeURIComponent(offer.id)}`,
      },
    ],
  };

  const serviceLd: any = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: offer.title,
    description: offer.description,
    ...(productHero ? { image: productHero } : {}),
    offers: {
      "@type": "Offer",
      url: ctaHref,
      priceCurrency: "JPY",
      ...(typeof offer.priceMonthly === "number"
        ? { price: String(offer.priceMonthly) }
        : typeof offer.priceRange === "number"
        ? { price: String(offer.priceRange) }
        : {}),
      availability: "https://schema.org/InStock",
    },
  };
  if (
    typeof offer.ratingValue === "number" &&
    typeof offer.ratingCount === "number"
  ) {
    serviceLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: offer.ratingValue,
      reviewCount: offer.ratingCount,
    };
  }

  /* ===== price/minTerm 表示用テキスト ===== */
  const hasPriceInfo =
    ui?.priceLabel ||
    typeof offer.priceMonthly === "number" ||
    typeof offer.priceRange === "number";

  const hasMinTermInfo =
    ui?.minTermLabel || typeof offer.minTermMonths === "number";

  return (
    <main className="container-kariraku py-10 space-y-10">
      {/* 可視パンくず */}
      <nav className="text-sm text-gray-500">
        <Link href="/" className="underline">
          ホーム
        </Link>
        <span className="mx-2">/</span>
        <Link href="/offers" className="underline">
          家電レンタル
        </Link>
        <span className="mx-2">/</span>
        <span className="opacity-70">{offer.title}</span>
      </nav>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />

      {/* タイトル + 序文 */}
      <header className="space-y-2">
        <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
          家電レンタル・サービスの詳細
        </p>
        <h1 className="h1">{offer.title}</h1>

        {ui?.highlightLabel && (
          <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            {ui.highlightLabel}
          </p>
        )}

        <p className="text-xs text-gray-500">※ 本ページは広告を含みます</p>
      </header>

      {/* ヒーロー：画像 + 料金・概要 */}
      <section className="grid items-start gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* 画像側 */}
        {(banner || productHero) && (
          <div className="card p-4 md:p-5">
            {banner ? (
              <TrackLink
                type="offer"
                siteId={siteId}
                offerId={offer.id}
                href={ctaHref}
                where="offer-detail.hero"
                newTab
                className="block"
              >
                <img
                  src={banner.img}
                  alt={offer.title}
                  width={banner.w}
                  height={banner.h}
                  className="img-soft mx-auto h-auto max-h-72 w-full object-contain md:max-h-80"
                />
              </TrackLink>
            ) : (
              <img
                src={productHero!}
                alt={offer.title}
                className="img-soft mx-auto h-auto max-h-72 w-full object-contain md:max-h-80"
              />
            )}
            <p className="mt-2 text-center text-[11px] text-gray-400">
              画像クリックで公式サイト（外部）に移動します。
            </p>
          </div>
        )}

        {/* 右側：料金・最低期間・CTA */}
        <aside className="space-y-4">
          {(hasPriceInfo || hasMinTermInfo || ui?.isPriceDynamic) && (
            <div className="card border-emerald-50 bg-white/90 p-4 text-sm text-gray-700">
              {ui?.priceLabel && (
                <div className="font-semibold">{ui.priceLabel}</div>
              )}
              {ui?.minTermLabel && (
                <div className="text-xs text-gray-600">{ui.minTermLabel}</div>
              )}

              {/* フォールバック（従来フィールド） */}
              {!ui?.priceLabel && typeof offer.priceMonthly === "number" && (
                <div className="mt-1">
                  月額目安：¥{offer.priceMonthly.toLocaleString()}〜
                </div>
              )}
              {!ui?.priceLabel &&
                !offer.priceMonthly &&
                typeof offer.priceRange === "number" && (
                  <div className="mt-1">
                    目安価格：¥{offer.priceRange.toLocaleString()}〜
                  </div>
                )}
              {!ui?.minTermLabel && typeof offer.minTermMonths === "number" && (
                <div className="mt-1">
                  最低利用期間：{offer.minTermMonths}ヶ月〜
                </div>
              )}

              {ui?.isPriceDynamic && (
                <div className="mt-2 text-xs text-gray-500">
                  ※ 料金は時期や商品により変動する場合があります。
                  最新の料金は公式サイトをご確認ください。
                </div>
              )}
            </div>
          )}

          {(offer.tags?.length || offer.notes?.length) && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs">
              {(offer.tags?.length ? offer.tags : offer.notes ?? [])
                ?.slice(0, 4)
                .map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-full bg-white/70 px-2 py-0.5"
                  >
                    {t}
                  </span>
                ))}
            </div>
          )}

          {ctaHref && (
            <div>
              <TrackLink
                type="offer"
                siteId={siteId}
                offerId={offer.id}
                href={ctaHref}
                where="offer-detail.cta"
                newTab
                className="btn btn-brand w-full justify-center md:w-auto"
              >
                {textCreative?.label ?? "公式で詳しく見る"}
              </TrackLink>
              <p className="mt-1 text-[11px] text-gray-400">
                ※ A8.net 経由で公式サイトに遷移します。
              </p>
            </div>
          )}
        </aside>
      </section>

      {/* こんな方におすすめ */}
      {recommendBullets.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">こんな方におすすめです</h2>
          <ul className="space-y-1 list-disc pl-5 text-sm text-gray-700">
            {recommendBullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 概要テキスト */}
      {offer.description && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">サービスの概要</h2>
          <p className="leading-7 whitespace-pre-wrap text-gray-700">
            {offer.description}
          </p>
        </section>
      )}

      {/* 補足（配送ポリシーなど） → 共通セクション */}
      <OfferDetailSections ui={ui} />

      {/* 梱包の補足など（shipping/promotion） */}
      {(offer.shipping?.policy || offer.promotion) && (
        <section className="card bg-white p-4 text-sm text-gray-700 space-y-1">
          {offer.shipping?.policy && <div>配送：{offer.shipping.policy}</div>}
          {offer.promotion?.couponCode && (
            <div>クーポン：{offer.promotion.couponCode}</div>
          )}
          {offer.promotion?.validUntil && (
            <div>有効期限：{offer.promotion.validUntil}</div>
          )}
        </section>
      )}

      {/* FAQ（notes） */}
      <FaqList items={offer.notes} />

      {/* 類似サービス（同タグ） */}
      <RelatedByTags
        title="他のレンタルサービスも比較"
        items={related.map((r) => ({ ...r, href: `/offers/${r.id}` }))}
      />
    </main>
  );
}
