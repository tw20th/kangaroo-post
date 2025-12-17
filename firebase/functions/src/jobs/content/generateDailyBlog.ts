import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/logger";
import { generateContentWithTemplate } from "../../utils/generateBlogContent.js";
import { makeDailySlug } from "../../lib/slug/daily.js";
import { pickDailyTheme, DailyTheme } from "../../utils/dailyThemes.js";
import {
  pickRandomPainTopicForSite,
  type PainTopic,
} from "../../lib/content/painPicker.js";

/**
 * デイリー記事内で使うサービス情報
 * - slug: ブログ用スラッグ（kariraku-s00000023591001:geo-arekore 等）
 * - offerId: /offers/ 用 ID（s00000023591001:geo-arekore 等）
 */
export type DailyService = {
  name: string;
  slug: string;
  affiliateUrl: string;
  oneLiner: string;
  offerId: string;
};

type GenerateDailyPostOptions = {
  siteId: string;
  seasonKeyword: string;
  trendingCategoriesCsv: string;
  topClicksTitlesCsv?: string;
  priceDropsNote?: string;
  compareSlug: string;
  services: DailyService[];
  publish?: boolean; // default: false
};

type PainContext = {
  painId: string;
  painTopic: string;
  painDetail: string;
  persona: string;
  compareUrl: string;
};

export async function generateDailyPost(
  opts: GenerateDailyPostOptions
): Promise<{ slug: string }> {
  const { siteId, seasonKeyword, compareSlug, publish = false } = opts;

  let {
    trendingCategoriesCsv,
    topClicksTitlesCsv = "",
    priceDropsNote = "",
    services,
  } = opts;

  const db = getFirestore();
  const now = new Date();
  const slug = makeDailySlug(siteId, now); // 例: daily-kariraku-20251117

  // ★ 季節 × 悩みテーマを決定（既存）
  const theme: DailyTheme = pickDailyTheme(seasonKeyword, now);

  // ★ ここで「悩みキーワード（painTopics_kariraku.json）」をランダムで 1 件選ぶ
  const pickedPain: PainTopic | null = pickRandomPainTopicForSite(siteId);
  const painContext: PainContext | null = pickedPain
    ? {
        painId: pickedPain.id,
        painTopic: pickedPain.topic,
        painDetail: pickedPain.pain,
        persona: pickedPain.persona,
        compareUrl: pickedPain.compareUrl,
      }
    : null;

  // === フォールバック類 ===

  // カテゴリが空なら、無難なデフォルトを入れておく
  if (!trendingCategoriesCsv.trim()) {
    trendingCategoriesCsv = "冷蔵庫・オーブンレンジ, 掃除家電, 生活家電セット";
  }
  // 万が一 **** が混じってきた場合も潰しておく
  trendingCategoriesCsv = trendingCategoriesCsv.replace(
    /\*+/g,
    "人気の家電レンタルサービス"
  );

  if (!topClicksTitlesCsv.trim()) {
    topClicksTitlesCsv =
      "年末の家電レンタル, キッチン家電レンタル, サブ冷蔵庫 レンタル";
  }

  if (!priceDropsNote.trim()) {
    priceDropsNote =
      `${seasonKeyword}シーズンの今のところ、目立った値下げや在庫の急変はありません。` +
      "ただし人気サービスは予約が埋まりやすいタイミングなので、検討中なら早めにチェックしておくと安心です。";
  }

  // ★ services に offers 用の ID を必ず持たせる（なければ slug から生成）
  services = services.map((s) => {
    const safeOfferId = s.offerId ?? s.slug.replace(/^kariraku-/, "");
    return { ...s, offerId: safeOfferId };
  });

  // ★ アイキャッチ画像（Unsplash）を試す
  const imageUrl = await fetchDailyImageUrl(seasonKeyword, theme);

  const vars = {
    dateISO: now.toISOString(),
    seasonKeyword,
    trendingCategoriesCsv,
    topClicksTitlesCsv,
    priceDropsNote,
    compareSlug,
    services,
    seasonTag: seasonKeyword,
    site: { displayName: "Kariraku" },

    // 追加: Daily テーマ情報
    dailyThemeId: theme.id,
    dailyThemeLabel: theme.label,
    dailyThemeFullLabel: theme.fullLabel,
    dailyThemeDescription: theme.description,

    // ★ 追加: ランダムに選んだ「悩みコンテキスト」
    painId: painContext?.painId ?? null,
    painTopic: painContext?.painTopic ?? null,
    painPersona: painContext?.persona ?? null,
    painDetail: painContext?.painDetail ?? null,
    painCompareUrl: painContext?.compareUrl ?? null,
  };

  const md = await generateContentWithTemplate(
    "blogTemplate_kariraku_daily.txt",
    vars
  );

  const timestamp = Date.now();

  const doc = {
    slug,
    siteId,
    title: extractTitle(md),
    summary: extractSummary(md),
    content: md,
    imageUrl: imageUrl ?? null,
    status: publish ? "published" : "draft",
    visibility: "public" as const,
    type: "daily" as const,
    tags: ["デイリー", seasonKeyword, "Kariraku"],
    createdAt: timestamp,
    updatedAt: timestamp,
    views: 0,

    // ★ 追加: 後で分析に使うため、ブログにも painId を保存しておく
    painId: painContext?.painId ?? null,
    painTopic: painContext?.painTopic ?? null,
    painPersona: painContext?.persona ?? null,
  };

  // ★ exist チェックはせず、毎回 upsert（同じ slug なら上書き）
  await db.collection("blogs").doc(slug).set(doc, { merge: true });
  logger.info(
    `generateDailyPost: upsert blogs/${slug} (theme=${theme.id}, image=${
      imageUrl ? "ok" : "none"
    }, painId=${painContext?.painId ?? "none"})`
  );

  return { slug };
}

/* --- tiny helpers --- */
function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "今日の注目トピック";
}

function extractSummary(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n").filter(Boolean);
  const text = lines
    .slice(0, 30)
    .join(" ")
    .replace(/[#>*_`]/g, "");
  return text.slice(0, 120);
}

/**
 * Unsplash から Daily 用のアイキャッチ画像を 1枚だけ取得する。
 * 失敗した場合は null を返してログだけ出す。
 */
async function fetchDailyImageUrl(
  seasonKeyword: string,
  theme: DailyTheme
): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    logger.debug(
      "[generateDailyPost] UNSPLASH_ACCESS_KEY が設定されていないため画像取得をスキップします。"
    );
    return null;
  }

  const query = buildUnsplashQuery(seasonKeyword, theme);

  try {
    const url = new URL("https://api.unsplash.com/photos/random");
    url.searchParams.set("query", query);
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    });

    if (!res.ok) {
      logger.warn(
        `[generateDailyPost] Unsplash API error status=${res.status}`
      );
      return null;
    }

    const data = (await res.json()) as {
      urls?: { regular?: string; full?: string; small?: string };
    };

    const urlCandidate =
      data.urls?.regular || data.urls?.full || data.urls?.small || null;

    if (!urlCandidate) {
      logger.warn(
        "[generateDailyPost] Unsplash API response に画像 URL が見つかりませんでした。"
      );
      return null;
    }

    return urlCandidate;
  } catch (err) {
    logger.error("[generateDailyPost] Unsplash 画像取得に失敗しました", err);
    return null;
  }
}

/**
 * 季節 × テーマ から Unsplash 検索クエリを組み立てる。
 */
function buildUnsplashQuery(seasonKeyword: string, theme: DailyTheme): string {
  const parts: string[] = [];

  if (seasonKeyword) {
    parts.push(seasonKeyword);
  }
  if (theme?.label) {
    parts.push(theme.label);
  }

  // 家電・暮らし系に寄せる
  parts.push("kitchen appliance", "home", "minimal");

  return parts.join(" ");
}
