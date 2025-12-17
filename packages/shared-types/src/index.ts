// packages/shared-types/src/index.ts

export type OfferSource = "amazon" | "rakuten";

export interface Offer {
  source: OfferSource;
  price: number;
  url: string;
  lastSeenAt: number; // ms

  // A8 オファーと企業マスタを紐付けるための任意フィールド
  companyId?: string | null;
}

export interface PricePoint {
  ts: number; // ms
  source: OfferSource;
  price: number;
}

export interface ProductSpecs {
  capacityMah?: number;
  outputW?: number;
  weightG?: number;
  ports?: string[];
}

export interface BestPrice {
  price: number;
  source: OfferSource;
  url: string;
  updatedAt: number; // ms
}

export interface Product {
  asin: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  categoryId: string;
  siteId: string;

  tags?: string[];
  specs?: ProductSpecs;
  offers: Offer[];
  bestPrice?: BestPrice;
  priceHistory: PricePoint[];
  aiSummary?: string;
  views?: number;
  createdAt: number;
  updatedAt: number;

  // optional
  affiliateUrl?: string;
  url?: string;
  inStock?: boolean;
  lastSeenAt?: number; // ms
  source?: OfferSource; // "amazon" | "rakuten"
}

export type BlogStatus = "draft" | "published";

/** ブログ記事 */
export interface Blog {
  slug: string; // = docId
  title: string;
  imageUrl?: string | null;

  /** Unsplash 帰属（あれば表示） */
  imageCredit?: string | null;
  imageCreditLink?: string | null;

  relatedAsin?: string | null;
  categoryId?: string;
  content: string; // Markdown
  summary?: string | null;
  tags: string[];
  status: BlogStatus;
  views: number;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number | null;
}

export interface Category {
  id: string; // = docId
  siteId: string;
  name: string;
  slug: string;
  parentId?: string;
  path: string[];
  order: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Improvement {
  id: string;
  target: { type: "blog" | "product"; id: string };
  scoreBefore?: number;
  scoreAfter?: number;
  suggestions: string[];
  createdAt: number;
}

export type WorkspaceStatus = "active" | "inactive";

export interface Workspace {
  /** Firestore docId */
  id: string;

  /** このワークスペースの持ち主（ユーザーID） */
  ownerUserId: string;

  /** サイト名（例：カンガルーポスト公式ブログ） */
  siteName: string;

  /** サイトのトップURL */
  topUrl: string;

  /** サイト側で表示するラベル（例：お知らせ / ブログ） */
  blogSectionLabel: string;

  /** ブログセクションのスラッグ（例：blog, news など） */
  blogSectionSlug: string;

  /** 埋め込みウィジェットを使うかどうか */
  widgetEnabled: boolean;

  /** ウィジェットで表示する記事数 */
  widgetLimit: number;

  /** 任意：業種など */
  industry?: string;

  /** 任意：キーワードの好み・メモ */
  keywordPreferences?: string;

  /** オプション：WordPress連携情報 */
  wpUrl?: string;
  wpUser?: string;
  wpAppPassword?: string;

  /** ステータス（有効 / 無効） */
  status: WorkspaceStatus;

  createdAt: number;
  updatedAt: number;
}
