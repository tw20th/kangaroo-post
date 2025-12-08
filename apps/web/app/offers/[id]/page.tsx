// apps/web/app/offers/[id]/page.tsx
import Link from "next/link";
import Image from "next/image";
import { getServerSiteId } from "@/lib/site-server";
import { fsRunQuery, vNum, vStr, type FsValue } from "@/lib/firestore-rest";

export const revalidate = 1800;
export const dynamic = "force-dynamic";

type Params = {
  id: string;
};

type OfferProfile = {
  companyType?: string | null;
  shortCopy?: string | null;
  priceLabel?: string | null;
  minTermLabel?: string | null;
};

type OfferDetail = {
  id: string;
  siteId?: string | null;
  advertiser?: string | null;
  programId?: string | null;
  programName?: string | null;
  displayName?: string | null;
  affiliateUrl?: string | null;
  profile?: OfferProfile;
  overview?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
};

type FsDoc = { name: string; fields: Record<string, FsValue> };

function getDisplayName(offer: OfferDetail): string {
  if (offer.displayName && offer.displayName.trim().length > 0) {
    return offer.displayName.trim();
  }
  if (offer.programName && offer.programName.trim().length > 0) {
    return offer.programName.trim();
  }
  if (offer.advertiser && offer.advertiser.trim().length > 0) {
    return offer.advertiser.trim();
  }
  return "サービス名未設定";
}

function labelForCompanyType(type?: string | null): string {
  if (!type) return "暮らし全般";
  switch (type) {
    case "living":
      return "くらし全般";
    case "gadget":
      return "ガジェット・家電";
    case "trial":
      return "お試し・期間限定";
    default:
      return type;
  }
}

function getThemeThumbnail(type?: string | null): string {
  switch (type) {
    case "living":
      return "/images/offers/theme-living.jpg";
    case "gadget":
      return "/images/offers/theme-gadget.jpg";
    case "trial":
      return "/images/offers/theme-trial.jpg";
    default:
      return "/images/offers/theme-default.jpg";
  }
}

// id フィールドで 1 件だけ取得
async function fetchOfferById(
  _siteId: string,
  rawId: string
): Promise<OfferDetail | null> {
  const id = decodeURIComponent(rawId);

  const rows = (await fsRunQuery({
    collection: "offers",
    where: [
      {
        field: "id",
        op: "EQUAL",
        value: id,
      },
    ],
    limit: 1,
  })) as FsDoc[];

  if (!rows.length) return null;

  const row = rows[0];
  const f = row.fields ?? {};

  const companyType = vStr(f, "profile.companyType");

  const shortCopy =
    vStr(f, "ui.compareHighlight") ||
    vStr(f, "ui.highlightLabel") ||
    vStr(f, "highlightLabel") ||
    vStr(f, "service.overview") ||
    vStr(f, "description");

  const priceLabel = vStr(f, "ui.priceLabel") || vStr(f, "pricing.priceLabel");
  const minTermLabel =
    vStr(f, "ui.minTermLabel") || vStr(f, "pricing.minTermLabel");

  const profile: OfferProfile | undefined =
    companyType || shortCopy || priceLabel || minTermLabel
      ? {
          companyType,
          shortCopy: shortCopy ?? undefined,
          priceLabel: priceLabel ?? undefined,
          minTermLabel: minTermLabel ?? undefined,
        }
      : undefined;

  return {
    id,
    siteId: vStr(f, "siteIdPrimary") || vStr(f, "siteId"),
    advertiser: vStr(f, "advertiser"),
    programId: vStr(f, "programId"),
    programName: vStr(f, "service.name") || vStr(f, "programName"),
    displayName:
      vStr(f, "service.name") || vStr(f, "title") || vStr(f, "displayName"),
    affiliateUrl: vStr(f, "affiliateUrl"),
    overview: vStr(f, "service.overview"),
    createdAt: vNum(f, "createdAt"),
    updatedAt: vNum(f, "updatedAt"),
    profile,
  };
}

export async function generateMetadata({ params }: { params: Params }) {
  const siteId = getServerSiteId();
  const offer = await fetchOfferById(siteId, params.id);

  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  if (!offer) {
    return {
      title: "サービス詳細｜Kariraku（カリラク）",
      description: "くらしを少しラクにしてくれるサービスの詳細ページです。",
      alternates: { canonical: `${base}/offers/${params.id}` },
      robots: { index: false, follow: true },
    };
  }

  const name = getDisplayName(offer);
  const shortCopy = offer.profile?.shortCopy ?? "";

  return {
    title: `${name}｜サービス詳細`,
    description:
      shortCopy || "くらしを少しラクにしてくれるサービスの詳細ページです。",
    alternates: { canonical: `${base}/offers/${offer.id}` },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

export default async function OfferDetailPage({ params }: { params: Params }) {
  const siteId = getServerSiteId();
  const offer = await fetchOfferById(siteId, params.id);

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  if (!offer) {
    return (
      <main className="container-kariraku py-10">
        <nav className="text-sm text-gray-500">
          <Link href="/" className="underline">
            ホーム
          </Link>
          <span className="mx-2">/</span>
          <Link href="/offers" className="underline">
            サービス比較
          </Link>
          <span className="mx-2">/</span>
          <span className="opacity-70">サービスが見つかりません</span>
        </nav>

        <section className="mt-6 rounded-3xl bg-white p-6 text-sm text-gray-700 shadow-soft">
          <p className="font-semibold">
            指定されたサービスが見つかりませんでした。
          </p>
          <p className="mt-2">
            URL の ID:{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">{params.id}</code>
          </p>
          <p className="mt-2">
            Firestore の <code>offers</code> コレクションで、
            <code>id</code>{" "}
            フィールドが同じ値のドキュメントがあるかご確認ください。
          </p>
          <p className="mt-4">
            一覧に戻る場合は{" "}
            <Link href="/offers" className="underline">
              サービス比較ページ
            </Link>{" "}
            へどうぞ。
          </p>
        </section>
      </main>
    );
  }

  const name = getDisplayName(offer);
  const companyType = offer.profile?.companyType ?? null;
  const companyTypeLabel = labelForCompanyType(companyType);
  const thumbnail = getThemeThumbnail(companyType);
  const shortCopy = offer.profile?.shortCopy ?? "";
  const priceLabel = offer.profile?.priceLabel ?? "";
  const minTermLabel = offer.profile?.minTermLabel ?? "";
  const overview = offer.overview ?? "";
  const affiliateHref = offer.affiliateUrl ?? null;

  return (
    <main className="container-kariraku py-10">
      {/* breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/" className="underline">
          ホーム
        </Link>
        <span className="mx-2">/</span>
        <Link href="/offers" className="underline">
          サービス比較
        </Link>
        <span className="mx-2">/</span>
        <span className="opacity-70">{name}</span>
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
                name: "サービス比較",
                item: `${siteUrl}/offers`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: name,
                item: `${siteUrl}/offers/${offer.id}`,
              },
            ],
          }),
        }}
      />

      {/* ヒーローエリア */}
      <section className="mt-4 overflow-hidden rounded-3xl bg-white shadow-soft">
        <div className="relative w-full overflow-hidden">
          <div className="relative aspect-[16/7] w-full">
            <Image
              src={thumbnail}
              alt={`${companyTypeLabel}のイメージ`}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-black/0" />
          </div>
        </div>

        <div className="px-5 pb-5 pt-4 md:px-7 md:pb-7">
          <div className="mb-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
            {companyTypeLabel}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 md:text-2xl">
            {name}
          </h1>

          {(priceLabel || minTermLabel) && (
            <p className="mt-2 text-sm font-medium text-gray-900">
              {priceLabel}
              {priceLabel && minTermLabel ? " ／ " : ""}
              {minTermLabel}
            </p>
          )}

          {shortCopy && (
            <p className="mt-2 text-sm leading-relaxed text-gray-700">
              {shortCopy}
            </p>
          )}

          {affiliateHref && (
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={affiliateHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex items-center justify-center rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                公式サイトで詳しく見る
              </a>
            </div>
          )}
        </div>
      </section>

      {/* 詳細エリア */}
      <section className="mt-6 grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 text-sm text-gray-700 shadow-soft">
            <h2 className="text-sm font-semibold text-gray-900">
              サービスの雰囲気まとめ
            </h2>
            <p className="mt-2 leading-relaxed">
              {overview ||
                shortCopy ||
                "公式サイトの情報をもとに、中立的な立場でサービス内容を整理しています。料金やキャンペーン内容は変わることがあるため、最終的には公式サイトで最新情報をご確認ください。"}
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          {affiliateHref && (
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 shadow-soft">
              <p className="mb-3 leading-relaxed">
                「もう少し詳しく見てみたいな」と感じたら、公式サイトでプランや料金をチェックしてみてください。
              </p>
              <a
                href={affiliateHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
              >
                公式サイトへ進む
              </a>
            </div>
          )}
        </aside>
      </section>

      <section className="mt-8 text-sm text-gray-600">
        <p>
          他のサービスとも比べてみたいときは、{" "}
          <Link href="/offers" className="underline">
            サービス比較ページ
          </Link>{" "}
          に戻って、いくつか並べて眺めてみるのもおすすめです。
        </p>
      </section>
    </main>
  );
}
