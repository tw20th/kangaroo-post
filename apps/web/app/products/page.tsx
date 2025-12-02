// apps/web/app/products/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSiteId, getSiteEntry } from "@/lib/site-server";
import {
  fsRunQuery,
  vStr,
  vNum,
  fsGetStringArray,
  fsDecode,
  type FsValue,
  docIdFromName,
} from "@/lib/firestore-rest";
import type { OfferLite } from "@/components/offers/OfferCompareTable";
import ProductFilterList from "@/components/products/ProductFilterList";

export const revalidate = 60;
export const dynamic = "force-dynamic";

type FsDoc = { name: string; fields: Record<string, FsValue> };

function normalizeOffer(d: FsDoc): OfferLite {
  const f = d.fields;

  const extras =
    f.extras !== undefined ? (fsDecode(f.extras) as unknown) : undefined;

  const topLevelUi =
    f.ui !== undefined ? (fsDecode(f.ui) as OfferLite["ui"]) : undefined;

  const ui =
    topLevelUi ??
    (extras && typeof extras === "object"
      ? (extras as { ui?: OfferLite["ui"] }).ui
      : undefined);

  return {
    id: docIdFromName(d.name),
    title: vStr(f, "title") ?? "",
    affiliateUrl: vStr(f, "affiliateUrl") ?? vStr(f, "landingUrl") ?? "",
    badges: fsGetStringArray(f, "badges") ?? [],
    priceMonthly: vNum(f, "priceMonthly") ?? null,
    minTermMonths: vNum(f, "minTermMonths") ?? null,
    notes:
      fsGetStringArray(f, "highlights") ?? fsGetStringArray(f, "tags") ?? [],
    ui,
  };
}

async function fetchAllOffers(siteId: string): Promise<OfferLite[]> {
  const docs = (await fsRunQuery({
    collection: "offers",
    where: [
      { field: "siteIds", op: "ARRAY_CONTAINS", value: siteId },
      { field: "archived", op: "EQUAL", value: false },
      { field: "status", op: "EQUAL", value: "active" },
    ],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 50,
  }).catch(() => [] as unknown)) as FsDoc[];

  return docs.map(normalizeOffer);
}

export default async function ProductsPage() {
  const siteId = getServerSiteId();
  const site = getSiteEntry();
  if (site.features?.offers === false) notFound();

  const items = await fetchAllOffers(siteId);

  return (
    <main className="container-kariraku py-10 space-y-8">
      {/* パンくず */}
      <nav className="text-sm text-gray-500">
        <Link href="/" className="underline">
          ホーム
        </Link>
        <span className="mx-2">/</span>
        <span className="opacity-70">条件でさがす</span>
      </nav>

      {/* ヒーロー */}
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold">
          条件で家電レンタルサービスをさがす
        </h1>
        <p className="text-sm text-gray-600">
          引越し・一人暮らし・初期費用をおさえたい…など、
          今の暮らしの状況と月額の目安からサービスをしぼり込みます。
        </p>
        <p className="text-xs text-gray-400">※ 本ページは広告を含みます</p>
      </header>

      {/* フィルター＋一覧（クライアントコンポーネント） */}
      <section className="space-y-3">
        <ProductFilterList items={items} />
      </section>

      {/* 補足導線 */}
      <div className="text-sm text-gray-600">
        まずざっくり比べたい方は{" "}
        <Link href="/compare" className="underline">
          一覧で比較ページ
        </Link>{" "}
        もあわせてご利用ください。
      </div>
    </main>
  );
}
