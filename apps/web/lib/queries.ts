// apps/web/lib/queries.ts
import type { Product } from "@affiscope/shared-types";
import {
  fsGet,
  fsRunQuery,
  fsDecode,
  fsGetString as vStr,
  fsGetNumber as vNum,
  fsGetStringArray as vStrArr,
  fsGetBoolean as vBool,
  docIdFromName,
} from "@/lib/firestore-rest";

// ★ ここはもう使わないので削除
// import type { Blog } from "@/types/blog";

/**
 * Discover関連記事用の最小データ型
 * - UI側で必要なフィールドだけを持つ
 */
export type RelatedDiscoverBlog = {
  slug: string;
  title: string;
  summary?: string | null;
  metaDescription?: string | null;
  imageUrl?: string | null;
};

/**
 * Discover 記事用：タグベースで関連記事を取得するヘルパー
 *
 * MEMO:
 * - いまは stub 実装（空配列）
 * - 後で Firestore クエリ実装に差し替える
 */
export async function getRelatedDiscoverBlogsByTags(params: {
  siteId: string;
  currentSlug: string;
  tags: string[];
  limit?: number;
}): Promise<RelatedDiscoverBlog[]> {
  const { siteId, currentSlug, tags, limit = 3 } = params;

  if (!tags || tags.length === 0) {
    return [];
  }

  // 既存のタグ関連記事ロジックを流用
  const relatedItems = await fetchRelatedBlogsByTags(
    siteId,
    tags,
    currentSlug,
    limit
  );

  // Discover関連記事用の薄い型にマッピング
  const blogs: RelatedDiscoverBlog[] = relatedItems
    .map((item) => {
      const slug = item.slug ?? item.id;
      if (!slug) return null;

      return {
        slug,
        title: item.title,
        summary: item.summary ?? null,
        // metaDescription は今の blogs ドキュメントにはほぼ無いので空でOK
        metaDescription: null,
        imageUrl: item.img ?? null,
      } as RelatedDiscoverBlog;
    })
    .filter((b): b is RelatedDiscoverBlog => b !== null);

  return blogs.slice(0, limit);
}

// Discover 一覧などで使うシンプルなブログ型
export type SimpleBlog = {
  slug: string;
  title: string;
  summary?: string | null;
  type?: string | null;
};

/**
 * 最新の Discover 記事を取得
 * - type === "discover"
 * - status === "published"
 * - publishedAt の新しい順
 */
export async function fetchLatestDiscoverBlogs(
  siteId: string,
  limit = 3
): Promise<SimpleBlog[]> {
  const docs = await fsRunQuery({
    collection: "blogs",
    where: [
      { field: "siteId", value: siteId },
      { field: "status", value: "published" },
      { field: "type", value: "discover" },
    ],
    orderBy: [{ field: "publishedAt", direction: "DESCENDING" as const }],
    limit,
  }).catch(() => [] as any[]); // ← 既存の関数と同じノリで any[] にする

  const items: SimpleBlog[] = [];

  for (const d of docs as any[]) {
    const slug = docIdFromName(d.name);
    if (!slug) continue;

    const f = d.fields;

    items.push({
      slug,
      title: vStr(f, "title") ?? "(no title)",
      summary: vStr(f, "summary") ?? null,
      type: vStr(f, "type") ?? null,
    });
  }

  return items;
}

/* =========================
 * 共通で使う最小データ型
 * ========================= */

export type RelatedItem = {
  /** 内部リンクで使うID or slug（どちらでも） */
  id?: string;
  slug?: string;
  /** 表示タイトル */
  title: string;
  /** サムネイル（任意） */
  img?: string | null;
  /** バッジ等（任意） */
  badge?: string | null;
  /** 一部のカードで使う説明（任意） */
  summary?: string | null;
  /** 外部/内部 どちらでも使える汎用href（任意） */
  href?: string;

  /** ↓ブログ側で並べ替えに使うことがあるので任意で保持 */
  updatedAt?: number;
  tags?: string[];
};

/* ===== offers (minimum shape when needed elsewhere) ===== */
export type OfferLite = {
  id: string;
  title: string;
  affiliateUrl: string;
  badges: string[];
  priceMonthly?: number | null;
  minTermMonths?: number | null;
  notes?: string[];
};

/* =========================
 * blogs: タグ関連記事
 * ========================= */

/** タグごとに ARRAY_CONTAINS で収集 → 重複除去 → 更新日の降順で切り出し */
export async function fetchRelatedBlogsByTags(
  siteId: string,
  tags: readonly string[] = [],
  excludeSlug: string,
  limit = 3
): Promise<RelatedItem[]> {
  if (!tags.length) return [];

  const seen = new Set<string>();
  const picked: RelatedItem[] = [];

  for (const tag of [...new Set(tags)].slice(0, 10)) {
    if (picked.length >= limit + 2) break;

    const docs = await fsRunQuery({
      collection: "blogs",
      where: [
        { field: "siteId", value: siteId },
        { field: "status", value: "published" },
        { field: "tags", op: "ARRAY_CONTAINS", value: tag },
      ],
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" as const }],
      limit: limit + 4,
    }).catch(() => [] as any[]);

    for (const d of docs) {
      const slug = docIdFromName(d.name);
      if (!slug || slug === excludeSlug || seen.has(slug)) continue;

      const f = d.fields;
      picked.push({
        slug,
        title: vStr(f, "title") ?? "(no title)",
        summary: vStr(f, "summary") ?? undefined,
        updatedAt: vNum(f, "updatedAt") ?? undefined,
        tags: vStrArr(f, "tags") ?? [],
      });
      seen.add(slug);

      if (picked.length >= limit + 4) break;
    }
  }

  picked.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return picked.slice(0, limit);
}

/* =========================
 * offers: タグ関連記事（同タグの他社）
 * ========================= */

// 置換対象: fetchRelatedOffersByTags 全体をこの実装に差し替え
export async function fetchRelatedOffersByTags(
  siteId: string,
  tags: readonly string[] = [],
  excludeId: string,
  limit = 3
): Promise<RelatedItem[]> {
  if (!tags.length) return [];

  const seen = new Set<string>();
  const picked: RelatedItem[] = [];

  // Firestore 1回分（orderBy あり → 失敗したらなし）
  const queryOffers = async (where: any[], useOrderBy: boolean) => {
    return await fsRunQuery({
      collection: "offers",
      where,
      orderBy: useOrderBy
        ? [{ field: "updatedAt", direction: "DESCENDING" as const }]
        : [],
      limit: limit + 4,
    }).catch(() => [] as any[]);
  };

  for (const tag of [...new Set(tags)].slice(0, 8)) {
    if (picked.length >= limit + 2) break;

    // Firestore 側は tags のみ（ARRAY_CONTAINS は1つに制限）
    const where = [
      { field: "archived", value: false },
      { field: "tags", op: "ARRAY_CONTAINS", value: tag },
    ];

    let docs = await queryOffers(where, true);

    // インデックス未作成で落ちた場合のフォールバック（orderBy なし）
    if (!docs.length) {
      docs = await queryOffers(where, false);
    }

    for (const d of docs) {
      const f = d.fields as Record<string, any>;

      // ← siteIds はクライアントで絞り込み（配列 or 文字列に対応）
      const siteIds = (fsDecode(f?.siteIds) as any[]) ?? [];
      if (siteId && Array.isArray(siteIds) && siteIds.length > 0) {
        if (!siteIds.includes(siteId)) continue;
      }

      const id =
        (fsDecode(f?.id) as string) ??
        d.name?.split("/").pop()?.toString() ??
        "";
      if (!id || id === excludeId || seen.has(id)) continue;

      const title = (fsDecode(f?.title) as string) ?? "(no title)";
      const creatives = (fsDecode(f?.creatives) as any[]) ?? [];
      const banner = creatives.find(
        (c) => c?.type === "banner" && (c?.imgSrc || c?.size)
      );
      const img = banner?.imgSrc || (vStrArr(f, "images")?.[0] ?? null);
      const href =
        (fsDecode(f?.affiliateUrl) as string) ||
        (fsDecode(f?.landingUrl) as string) ||
        undefined;
      const badge = vStrArr(f, "badges")?.[0] ?? null;

      picked.push({ id, title, img, badge, href });
      seen.add(id);
      if (picked.length >= limit + 2) break;
    }
  }

  return picked.slice(0, limit);
}

/* =========================
 * products
 * ========================= */

export async function fetchProductByAsin(
  asin: string,
  siteId: string
): Promise<Product | null> {
  const doc = await fsGet({ path: `products/${encodeURIComponent(asin)}` });
  if (!doc) return null;

  const f = doc.fields;

  const bpPrice = vNum(f, "bestPrice.price");
  const bpUrl = vStr(f, "bestPrice.url");
  const bpSource = vStr(f, "bestPrice.source") as
    | "amazon"
    | "rakuten"
    | undefined;
  const bpUpdatedAt = vNum(f, "bestPrice.updatedAt");

  const bestPrice =
    typeof bpPrice === "number" &&
    typeof bpUpdatedAt === "number" &&
    bpUrl &&
    bpSource
      ? { price: bpPrice, url: bpUrl, source: bpSource, updatedAt: bpUpdatedAt }
      : undefined;

  return {
    asin,
    title: vStr(f, "title") ?? "",
    brand: vStr(f, "brand") ?? undefined,
    imageUrl: vStr(f, "imageUrl") ?? undefined,
    categoryId: vStr(f, "categoryId") ?? "",
    siteId,
    affiliateUrl: vStr(f, "affiliateUrl") ?? undefined,
    url: vStr(f, "url") ?? undefined,
    inStock: vBool(f, "inStock"),
    lastSeenAt: vNum(f, "lastSeenAt"),
    source:
      (vStr(f, "source") as "amazon" | "rakuten" | undefined) ?? undefined,
    tags: vStrArr(f, "tags") ?? [],
    specs: undefined,
    offers: [],
    bestPrice,
    priceHistory: [],
    aiSummary: vStr(f, "aiSummary") ?? undefined,
    views: vNum(f, "views") ?? 0,
    createdAt: vNum(f, "createdAt") ?? 0,
    updatedAt: vNum(f, "updatedAt") ?? 0,
  };
}

export async function fetchRelated(
  siteId: string,
  categoryId: string,
  excludeAsin: string,
  limit = 8
) {
  if (!categoryId) return [];
  const docs = await fsRunQuery({
    collection: "products",
    where: [
      { field: "siteId", value: siteId },
      { field: "categoryId", value: categoryId },
    ],
    orderBy: [{ field: "createdAt", direction: "DESCENDING" }],
    limit: limit + 2,
  }).catch(() => [] as any[]);

  const rows: Product[] = docs.map((d: any) => {
    const f = d.fields;
    return {
      asin: docIdFromName(d.name),
      title: vStr(f, "title") ?? "",
      brand: vStr(f, "brand") ?? undefined,
      imageUrl: vStr(f, "imageUrl") ?? undefined,
      categoryId: vStr(f, "categoryId") ?? "",
      siteId,
      tags: [],
      specs: undefined,
      offers: [],
      bestPrice: (() => {
        const price = vNum(f, "bestPrice.price");
        const url = vStr(f, "bestPrice.url");
        const source = vStr(f, "bestPrice.source") as
          | "amazon"
          | "rakuten"
          | undefined;
        const updatedAt = vNum(f, "bestPrice.updatedAt");
        return typeof price === "number" &&
          url &&
          source &&
          typeof updatedAt === "number"
          ? { price, url, source, updatedAt }
          : undefined;
      })(),
      priceHistory: [],
      aiSummary: undefined,
      views: vNum(f, "views") ?? 0,
      createdAt: vNum(f, "createdAt") ?? 0,
      updatedAt: vNum(f, "updatedAt") ?? 0,
    } as Product;
  });

  return rows.filter((p) => p.asin !== excludeAsin).slice(0, limit);
}

/** この商品を題材にしたブログ（関連CTA用） */
export type MiniBlog = {
  slug: string;
  title: string;
  publishedAt?: number;
  updatedAt?: number;
};
export async function fetchBlogsByRelatedAsin(
  siteId: string,
  asin: string,
  limit = 6
): Promise<MiniBlog[]> {
  const docs = await fsRunQuery({
    collection: "blogs",
    where: [
      { field: "siteId", value: siteId },
      { field: "relatedAsin", value: asin },
      { field: "status", value: "published" },
    ],
    orderBy: [{ field: "publishedAt", direction: "DESCENDING" as const }],
    limit,
  }).catch(() => [] as any[]);
  return docs.map((d: any) => ({
    slug: docIdFromName(d.name),
    title: vStr(d.fields, "title") ?? "(no title)",
    publishedAt: vNum(d.fields, "publishedAt") ?? undefined,
    updatedAt: vNum(d.fields, "updatedAt") ?? undefined,
  }));
}

/* =========================
 * blogs: 一覧/詳細
 * ========================= */

export type BlogRow = {
  slug: string;
  title: string;
  summary?: string | null;
  imageUrl?: string | null;
  imageCredit?: string | null;
  imageCreditLink?: string | null;
  publishedAt?: number;
  updatedAt?: number;
  views?: number;
  // ★ 追加：Firestore の type フィールド
  type?: string | null;
};

export async function fetchBlogs(
  siteId: string,
  orderBy: { field: string; direction: "DESCENDING" | "ASCENDING" }[],
  take = 40
) {
  const docs = await fsRunQuery({
    collection: "blogs",
    where: [
      { field: "status", value: "published" },
      { field: "siteId", value: siteId },
    ],
    orderBy,
    limit: take,
  }).catch(() => [] as any[]);

  const rows: BlogRow[] = docs.map((d: any) => ({
    slug: docIdFromName(d.name),
    title: vStr(d.fields, "title") ?? "(no title)",
    summary: vStr(d.fields, "summary") ?? null,
    imageUrl: vStr(d.fields, "imageUrl") ?? null,
    imageCredit: vStr(d.fields, "imageCredit") ?? null,
    imageCreditLink: vStr(d.fields, "imageCreditLink") ?? null,
    publishedAt: vNum(d.fields, "publishedAt") ?? undefined,
    updatedAt: vNum(d.fields, "updatedAt") ?? undefined,
    views: vNum(d.fields, "views") ?? 0,
    // ★ 追加
    type: vStr(d.fields, "type") ?? null,
  }));

  return rows;
}

export async function fetchBlogBySlug(slug: string) {
  const safeDecode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const raw = slug;
  const decoded = safeDecode(slug);
  const encoded = encodeURIComponent(decoded);
  const tryPaths = [`blogs/${raw}`, `blogs/${encoded}`, `blogs/${decoded}`];

  let doc: any | null = null;
  for (const p of tryPaths) {
    doc = await fsGet({ path: p }).catch(() => null);
    if (doc) break;
  }
  if (!doc) return null;

  const f = (doc as any).fields;
  return {
    slug,
    title: vStr(f, "title") ?? "(no title)",
    content: vStr(f, "content") ?? "",
    imageUrl: vStr(f, "imageUrl") ?? undefined,
    summary: vStr(f, "summary") ?? undefined,
    siteId: vStr(f, "siteId") ?? "",
    updatedAt: vNum(f, "updatedAt") ?? undefined,
    publishedAt: vNum(f, "publishedAt") ?? undefined,
    relatedAsin: vStr(f, "relatedAsin") ?? null,
    imageCredit: vStr(f, "imageCredit") ?? null,
    imageCreditLink: vStr(f, "imageCreditLink") ?? null,
    painId: vStr(f, "painId") ?? undefined,
    tags: vStrArr(f, "tags") ?? [],
    // ★ これを追加
    offerId: vStr(f, "offerId") ?? null,
  };
}

/** ブログCTA用：関連商品の最安値だけ素早く取得 */
export async function fetchBestPrice(asin: string) {
  const doc = await fsGet({
    path: `products/${encodeURIComponent(asin)}`,
  }).catch(() => null);
  const f = (doc as any)?.fields;
  if (!f) return null;

  const price = vNum(f, "bestPrice.price");
  const url = vStr(f, "bestPrice.url");
  const source = vStr(f, "bestPrice.source") as
    | "amazon"
    | "rakuten"
    | undefined;
  const updatedAt = vNum(f, "bestPrice.updatedAt");

  if (
    typeof price === "number" &&
    url &&
    source &&
    typeof updatedAt === "number"
  ) {
    return { price, url, source, updatedAt };
  }
  return null;
}
