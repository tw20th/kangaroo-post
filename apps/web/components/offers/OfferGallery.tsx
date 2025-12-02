// apps/web/components/offers/OfferGallery.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  fetchCollection,
  type SimpleWhere,
  type SimpleOrderBy,
} from "@/lib/firestore-rest";

type Creative = {
  type: "banner" | "text";
  href: string;
  imgSrc?: string;
  label?: string;
};

type Offer = {
  id: string;
  title: string;
  description?: string;
  images?: string[];
  creatives?: Creative[];
  updatedAt?: number;
  ui?: {
    priceLabel?: string;
    minTermLabel?: string;
    isPriceDynamic?: boolean;
  };
};

function sendClick(payload: Record<string, unknown>) {
  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });

    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon("/api/track", blob);
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch {
    // no-op
  }
}

export default function OfferGallery(props: {
  siteId: string;
  variant?: "grid" | "list" | "hero";
  limit?: number;
}) {
  const { siteId, variant = "grid", limit = 24 } = props;
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // siteId を ref に保持（クリックログ用）
  const siteIdRef = useRef(siteId);
  useEffect(() => {
    siteIdRef.current = siteId;
  }, [siteId]);

  useEffect(() => {
    (async () => {
      const where: SimpleWhere[] = [
        ["siteIds", "array-contains", siteId],
        ["archived", "==", false],
      ];
      const orderBy: SimpleOrderBy = ["updatedAt", "desc"];

      const res = await fetchCollection<Offer>("offers", {
        where,
        orderBy,
        limit,
      });

      setOffers(res);
      setLoading(false);
    })();
  }, [siteId, limit]);

  const makeFireClick = useCallback(
    (offerId: string) => (where: string, href: string) =>
      sendClick({
        type: "offer_click",
        siteId: siteIdRef.current,
        offerId,
        href,
        where,
        ts: Date.now(),
      }),
    []
  );

  if (loading)
    return <div className="p-6 text-sm text-gray-600">読み込み中…</div>;
  if (!offers.length)
    return (
      <div className="p-6 text-sm text-gray-600">
        掲載中のサービスがまだありません。
      </div>
    );

  const RenderImage = ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
  }) => {
    const isA8 = /(?:^|\.)a8\.net\//.test(src);
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        unoptimized={isA8}
      />
    );
  };

  const Card = ({ o }: { o: Offer }) => {
    const banner = o.creatives?.find((c) => c.type === "banner");
    const text = o.creatives?.find((c) => c.type === "text");
    const hero = banner?.imgSrc ?? o.images?.[0];
    const fireClick = makeFireClick(o.id);
    const ctaHref = banner?.href ?? text?.href;
    const ui = o.ui;

    return (
      <article className="card flex h-full flex-col p-4">
        {/* 画像 */}
        {hero && (
          <a
            href={ctaHref || `/offers/${o.id}`}
            target={ctaHref ? "_blank" : undefined}
            rel={ctaHref ? "nofollow sponsored" : undefined}
            className="block"
            onClick={() =>
              fireClick("gallery_card_image", ctaHref || `/offers/${o.id}`)
            }
          >
            <RenderImage
              src={hero}
              alt={o.title}
              width={600}
              height={400}
              className="img-soft mb-3 h-48 w-full object-contain md:h-56"
            />
          </a>
        )}

        {/* テキスト */}
        <div className="flex flex-1 flex-col">
          <h3 className="mb-1 text-[15px] font-semibold leading-snug text-gray-900 md:text-base">
            <Link href={`/offers/${o.id}`} className="hover:underline">
              {o.title}
            </Link>
          </h3>

          {o.description && (
            <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-gray-600 md:text-sm">
              {o.description}
            </p>
          )}

          {/* 目安価格・最低期間 */}
          {(ui?.priceLabel || ui?.minTermLabel) && (
            <div className="mb-3 text-sm text-gray-800">
              {ui?.priceLabel && (
                <div>
                  <span className="font-medium">{ui.priceLabel}</span>
                  {ui.isPriceDynamic && (
                    <span className="ml-1 text-xs text-gray-500">
                      （目安・最新は公式）
                    </span>
                  )}
                </div>
              )}
              {ui?.minTermLabel && (
                <div className="text-xs text-gray-600">{ui.minTermLabel}</div>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="mt-auto pt-1">
            {banner?.href && (
              <a
                href={banner.href}
                rel="nofollow sponsored"
                target="_blank"
                className="btn btn-brand"
                onClick={() => fireClick("gallery_card_cta", banner.href)}
              >
                公式で詳しく見る
              </a>
            )}
            {!banner?.href && text?.href && (
              <a
                href={text.href}
                rel="nofollow sponsored"
                target="_blank"
                className="btn btn-ghost"
                onClick={() => fireClick("gallery_card_cta", text.href)}
              >
                {text.label ?? "公式で詳しく見る"}
              </a>
            )}
          </div>
        </div>
      </article>
    );
  };

  /* ========== variant: list（Discover 仕様のリスト） ========== */
  if (variant === "list") {
    return (
      <section className="space-y-4">
        {offers.map((o) => {
          const banner = o.creatives?.find((c) => c.type === "banner");
          const text = o.creatives?.find((c) => c.type === "text");
          const hero = banner?.imgSrc ?? o.images?.[0];
          const href = banner?.href ?? text?.href ?? `/offers/${o.id}`;
          const fireClick = makeFireClick(o.id);
          const ui = o.ui;

          return (
            <article
              key={o.id}
              className="card flex gap-4 p-4 md:p-5 md:items-start"
            >
              {hero && (
                <div className="w-32 shrink-0 md:w-40">
                  <a
                    href={href}
                    target={banner?.href || text?.href ? "_blank" : undefined}
                    rel={
                      banner?.href || text?.href
                        ? "nofollow sponsored"
                        : undefined
                    }
                    onClick={() => fireClick("list_card_image", href)}
                  >
                    <RenderImage
                      src={hero}
                      alt={o.title}
                      width={320}
                      height={200}
                      className="img-soft h-auto w-full object-cover"
                    />
                  </a>
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 md:text-base">
                  <Link href={`/offers/${o.id}`} className="hover:underline">
                    {o.title}
                  </Link>
                </h3>

                {o.description && (
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-600 md:text-sm">
                    {o.description}
                  </p>
                )}

                {(ui?.priceLabel || ui?.minTermLabel) && (
                  <div className="mt-2 text-xs text-gray-800 md:text-sm">
                    {ui?.priceLabel && (
                      <div className="font-medium">{ui.priceLabel}</div>
                    )}
                    {ui?.minTermLabel && (
                      <div className="text-gray-600">{ui.minTermLabel}</div>
                    )}
                  </div>
                )}

                <div className="mt-3">
                  {banner?.href ? (
                    <a
                      href={banner.href}
                      rel="nofollow sponsored"
                      target="_blank"
                      className="btn btn-brand"
                      onClick={() =>
                        fireClick("list_card_cta", banner.href ?? "")
                      }
                    >
                      公式で詳しく見る
                    </a>
                  ) : text?.href ? (
                    <a
                      href={text.href}
                      rel="nofollow sponsored"
                      target="_blank"
                      className="btn btn-ghost"
                      onClick={() =>
                        fireClick("list_card_cta", text.href ?? "")
                      }
                    >
                      {text.label ?? "公式で詳しく見る"}
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    );
  }

  /* ========== variant: hero（1件を大きく + 他をグリッド） ========== */
  if (variant === "hero") {
    const [first, ...rest] = offers;
    if (!first) return null;

    return (
      <section className="space-y-6">
        <div className="card p-5 md:p-6">
          <Card o={first} />
        </div>

        {rest.length > 0 && (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((o) => (
              <Card key={o.id} o={o} />
            ))}
          </section>
        )}
      </section>
    );
  }

  /* ========== default: grid（Discover 仕様のカードグリッド） ========== */
  return (
    <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {offers.map((o) => (
        <Card key={o.id} o={o} />
      ))}
    </section>
  );
}
