// apps/web/app/offers/page.tsx
import Link from "next/link";
import { getServerSiteId } from "@/lib/site-server";
import { fetchOffersForSite, type OfferRow } from "@/lib/queries-offers";
import OfferCompareCard from "@/components/offers/OfferCompareCard";

export const revalidate = 1800;
export const dynamic = "force-dynamic";

type SearchParams = {
  type?: string;
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

// companyType を日本語ラベルに変換（必要に応じて増やしてOK）
function labelForCompanyType(type: string | null | undefined): string {
  if (!type) return "カテゴリ未設定";
  switch (type) {
    case "living":
      return "くらし全般";
    case "moving":
      return "引っ越し・移動";
    case "cleaning":
      return "掃除・片づけ";
    default:
      return type;
  }
}

export async function generateMetadata() {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  return {
    title: "サービス比較一覧｜Kariraku（カリラク）",
    description:
      "家電レンタルなど、くらしを少しラクにしてくれるサービスを、やさしく比較できるページです。",
    alternates: { canonical: `${base}/offers` },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

export default async function OffersComparePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const siteId = getServerSiteId();

  // Firestore から offers 一覧を取得
  const offers = await fetchOffersForSite(siteId);

  // companyType をユニーク抽出
  const typesSet = new Set<string>();
  offers.forEach((o) => {
    const t = o.profile?.companyType;
    if (typeof t === "string" && t.trim().length > 0) {
      typesSet.add(t);
    }
  });
  const companyTypes = Array.from(typesSet).sort();

  const rawType = searchParams?.type ?? "all";
  const selectedType =
    rawType === "all" || !companyTypes.includes(rawType) ? "all" : rawType;

  // フィルタリング
  const filtered: OfferRow[] =
    selectedType === "all"
      ? offers
      : offers.filter((o) => o.profile?.companyType === selectedType);

  // 最終更新（createdAt / updatedAt 的なフィールドがあればそれを使う）
  const lastUpdated = filtered.reduce<number>(
    (max, o) => Math.max(max, o.updatedAt ?? o.createdAt ?? 0),
    0
  );

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  const hrefForType = (nextType: string) => {
    const params = new URLSearchParams();
    if (nextType !== "all") params.set("type", nextType);
    const qs = params.toString();
    return qs ? `/offers?${qs}` : "/offers";
  };

  return (
    <main className="container-kariraku py-10">
      {/* breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/" className="underline">
          ホーム
        </Link>
        <span className="mx-2">/</span>
        <span className="opacity-70">サービス比較</span>
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
            ],
          }),
        }}
      />

      {/* ヘッダー */}
      <header className="mt-3 mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          くらしを少しラクにしてくれるサービス比較
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          家電レンタルなど、日々のモヤモヤをふわっと軽くしてくれるサービスをまとめました。
          それぞれの「らしさ」を見比べながら、自分に合いそうなものを探せます。
        </p>
      </header>

      {/* コントロールバー（カテゴリフィルター + 件数） */}
      <div className="mt-4 rounded-2xl bg-surface-featured px-4 py-3 text-sm shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* 左側：カテゴリフィルター */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="opacity-70">暮らしのテーマ:</span>
            <div className="inline-flex rounded-full bg-gray-100 p-1">
              <Link
                href={hrefForType("all")}
                aria-current={selectedType === "all" ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-xs md:text-sm ${
                  selectedType === "all"
                    ? "bg-white font-medium text-emerald-800 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                すべて
              </Link>
              {companyTypes.map((t) => (
                <Link
                  key={t}
                  href={hrefForType(t)}
                  aria-current={selectedType === t ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-xs md:text-sm ${
                    selectedType === t
                      ? "bg-white font-medium text-emerald-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {labelForCompanyType(t)}
                </Link>
              ))}
            </div>
          </div>

          {/* 右側：件数と最終更新 */}
          <div className="flex flex-col gap-1 text-right text-xs text-gray-600 md:text-sm">
            <div>掲載サービス数: {filtered.length}件</div>
            {lastUpdated > 0 && <div>最終更新: {formatJp(lastUpdated)}</div>}
          </div>
        </div>
      </div>

      {/* カード一覧 */}
      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600">
          条件に合うサービスがまだありません。
        </p>
      ) : (
        <div className="mt-6">
          {/* 少数でも間延びしないように、最大幅を絞って中央寄せ */}
          <ul className="mx-auto grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2">
            {filtered.map((offer) => (
              <OfferCompareCard key={offer.id} offer={offer} />
            ))}
          </ul>
        </div>
      )}

      {/* 補足リンク */}
      <div className="mt-8 space-y-1 text-sm text-gray-600">
        <div>
          サービス選びに迷ったときは、{" "}
          <Link href="/blog" className="underline">
            ブログ記事
          </Link>
          から、暮らしの具体的なシーン別の読みものもどうぞ。
        </div>
      </div>
    </main>
  );
}
