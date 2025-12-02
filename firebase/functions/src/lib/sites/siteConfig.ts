// firebase/functions/src/lib/sites/siteConfig.ts
import { promises as fs } from "node:fs";
import path from "node:path";

/* ========= 型定義 ========= */

export type DiscoverProfile = {
  /** サイト全体としてのテーマ（何を大事にしているか） */
  theme?: string;
  /** 想定読者像（誰に向けて書くか） */
  reader?: string;
  /** 文章トーン（やさしい/フラット/ていねい など） */
  tone?: string;
  /** Discover 記事でよく扱うテーマの説明 */
  topic?: string;
  /** Discover 記事につけたいタグ候補 */
  tags?: string[];
};

export type SiteProfile = {
  /** 共通のざっくりテーマ（未設定なら discover.theme を使う） */
  theme?: string;
  /** 共通の読者像（未設定なら discover.reader を使う） */
  reader?: string;
  /** 共通トーン（未設定なら discover.tone を使う） */
  tone?: string;
  /** 共通トピック（未設定なら discover.topic を使う） */
  topic?: string;
  /** Discover 向けの詳細プロファイル */
  discover?: DiscoverProfile;
};

export type SiteBlogTemplates = {
  /** 企業・サービス紹介記事用テンプレID */
  service?: string;
  /** 悩みガイド記事用テンプレID */
  guide?: string;
  /** 比較記事用テンプレID */
  compare?: string;
  /** Discover 記事用テンプレID */
  discover?: string;
};

export type SiteConfig = {
  siteId: string;
  displayName?: string;
  domain?: string;
  brand?: unknown;
  categoryPreset?: string[];
  productRules?: unknown;
  affiliate?: {
    amazon?: {
      partnerTag?: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tagRules?: Array<any>;
  discovery?: unknown;

  /** 画像まわりの設定（例：Unsplash を優先するか） */
  images?: {
    preferUnsplashHero?: boolean;
  };

  /** intent ごとのテンプレID設定 */
  blogTemplates?: SiteBlogTemplates;

  /** サイト固有の世界観プロファイル */
  profile?: SiteProfile;

  // 既存コードとの後方互換用
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
};

/* ========= ローダー本体 ========= */

const cache = new Map<string, SiteConfig | null>();

export async function getSiteConfig(
  siteId: string
): Promise<SiteConfig | null> {
  if (cache.has(siteId)) return cache.get(siteId)!;

  const file = path.resolve(process.cwd(), "sites", `${siteId}.json`);
  try {
    const json = await fs.readFile(file, "utf-8");
    const cfg = JSON.parse(json) as SiteConfig;
    cache.set(siteId, cfg);
    return cfg;
  } catch {
    cache.set(siteId, null);
    return null;
  }
}
