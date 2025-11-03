// apps/web/app/offers/[id]/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fsGet,
  fsDecode,
  fsGetStringArray,
  fsRunQuery,
} from "@/lib/firestore-rest";
import { getServerSiteId, getSiteEntry } from "@/lib/site-server";

type Creative = {
  type: "banner" | "text";
  href: string;
  imgSrc?: string;
  label?: string;
};
type OfferDoc = {
  id: string;
  title: string;
  description?: string;
  images?: string[];
  creatives?: Creative[];
  siteIds?: string[];
  status?: string;
  archived?: boolean;
  updatedAt?: number;
};

function RenderImg({
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
}) {
  const isA8 = /(?:^|\.)a8\.net\//.test(src);
  return isA8 ? (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      className={className}
    />
  ) : (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}

async function fetchOfferByAnyId(rawParamId: string) {
  const id = decodeURIComponent(rawParamId);
  const byId = await fsGet({ path: `offers/${id}` });
  if (byId) return byId;
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
  if (tryBoth && tryBoth[0]) return tryBoth[0];
  const tryProgOnly = await fsRunQuery({
    collection: "offers",
    where: [{ field: "programId", value: programId }],
    limit: 1,
  }).catch(() => []);
  return tryProgOnly && tryProgOnly[0] ? tryProgOnly[0] : null;
}

export default async function OfferDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // ← ここで初めて呼ぶ（モジュール先頭では呼ばない）
  const site = getSiteEntry();
  if (site.features?.offers === false) notFound();

  const siteId = getServerSiteId();
  const res = await fetchOfferByAnyId(params.id);
  if (!res) notFound();

  const f = res.fields;
  const offer: OfferDoc = {
    id: decodeURIComponent(params.id),
    title: (fsDecode(f?.title) as string) ?? "(no title)",
    description: (fsDecode(f?.description) as string) ?? "",
    images: fsGetStringArray(f, "images") ?? [],
    creatives: (fsDecode(f?.creatives) as Creative[]) ?? [],
    siteIds: fsGetStringArray(f, "siteIds") ?? [],
    status: (fsDecode(f?.status) as string) ?? undefined,
    archived: (fsDecode(f?.archived) as boolean) ?? false,
    updatedAt: (fsDecode(f?.updatedAt) as number) ?? undefined,
  };

  if (offer.archived) notFound();
  if (offer.status && offer.status !== "active") notFound();
  if (offer.siteIds?.length && !offer.siteIds.includes(siteId)) notFound();

  const banner = offer.creatives?.find((c) => c.type === "banner");
  const text = offer.creatives?.find((c) => c.type === "text");
  const hero = banner?.imgSrc ?? offer.images?.[0];

  return (
    <main className="container-kariraku p-6 space-y-6">
      <nav className="text-sm">
        <Link href="/" className="underline">
          トップへ戻る
        </Link>
      </nav>

      <header className="space-y-2">
        <h1 className="h1">{offer.title}</h1>
        <p className="text-xs text-gray-500">※ 本ページは広告を含みます</p>
      </header>

      {hero && (
        <div className="card p-4">
          {banner?.href || text?.href ? (
            <a
              href={(banner?.href ?? text?.href)!}
              target="_blank"
              rel="nofollow sponsored"
            >
              <RenderImg
                src={hero}
                alt={offer.title}
                width={1200}
                height={628}
                className="w-full h-auto img-soft"
              />
            </a>
          ) : (
            <RenderImg
              src={hero}
              alt={offer.title}
              width={1200}
              height={628}
              className="w-full h-auto img-soft"
            />
          )}
        </div>
      )}

      {offer.description && (
        <p className="text-gray-700 leading-7 whitespace-pre-wrap">
          {offer.description}
        </p>
      )}

      <div>
        {banner?.href ? (
          <a
            href={banner.href}
            target="_blank"
            rel="nofollow sponsored"
            className="btn btn-brand"
          >
            公式で詳しく見る
          </a>
        ) : text?.href ? (
          <a
            href={text.href}
            target="_blank"
            rel="nofollow sponsored"
            className="btn btn-ghost"
          >
            {text.label ?? "公式で詳しく見る"}
          </a>
        ) : null}
      </div>
    </main>
  );
}
