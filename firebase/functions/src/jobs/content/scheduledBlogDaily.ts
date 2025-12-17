// firebase/functions/src/jobs/content/scheduledBlogDaily.ts
import * as functions from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";
import { generateDailyPost, DailyService } from "./generateDailyBlog.js";
import { getSeasonalContext } from "../../utils/seasonalContext.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

/**
 * デイリー記事内で軽く触れる「サービス候補」をピックアップ
 * → あくまで“悩み解決の中で紹介する脇役”として使う想定
 */
async function pickDailyServices(
  siteId: string,
  limit = 3
): Promise<DailyService[]> {
  const snap = await db
    .collection("offers")
    .where("siteIds", "array-contains", siteId)
    .where("archived", "==", false)
    .orderBy("updatedAt", "desc")
    .limit(20)
    .get();

  const items: DailyService[] = snap.docs.slice(0, limit).map((d) => {
    const title = String(d.get("title") ?? "サービス");
    const offerId = d.id; // 例: s00000023591001:geo-arekore
    const slug = `${siteId}-${offerId}`; // 将来ブログ用に使うかもなので一応保持
    const affiliateUrl = String(d.get("affiliateUrl") ?? "");

    return {
      name: title,
      slug,
      affiliateUrl,
      offerId,
      oneLiner: `${title.slice(0, 18)}を気軽に試せるレンタル`,
    };
  });

  return items;
}

async function createSeasonalDailyPost(siteId: string) {
  const seasonal = getSeasonalContext(); // ← 年末/新生活/梅雨…など
  const services = await pickDailyServices(siteId);

  const out = await generateDailyPost({
    siteId,
    seasonKeyword: seasonal.keyword,
    trendingCategoriesCsv: "", // 必要ならあとでGSCなどから埋める
    topClicksTitlesCsv: "",
    priceDropsNote: "",
    compareSlug: "compare-latest",
    services,
    publish: false, // デイリーは一旦 draft 運用にしておく（必要なら true に変更）
  });

  functions.logger.info("createSeasonalDailyPost", {
    siteId,
    slug: out.slug,
    season: seasonal.keyword,
  });

  return {
    siteId,
    slug: out.slug,
    seasonKeyword: seasonal.keyword,
    seasonLabel: seasonal.label,
  };
}

/**
 * 毎日 06:05 … 「季節 × 悩み解決」デイリー記事を 1本ずつ生成
 */
export const scheduledBlogDaily_Morning = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"] })
  .pubsub.schedule("5 6 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    const siteIds = await getBlogEnabledSiteIds(db);
    const results = [];
    for (const siteId of siteIds) {
      results.push(await createSeasonalDailyPost(siteId));
    }
    return { results };
  });

/**
 * 手動テスト用 HTTP エンドポイント
 */
export const runDailyNow = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"] })
  .https.onRequest(async (_req, res) => {
    try {
      const siteIds = await getBlogEnabledSiteIds(db);
      const results = [];
      for (const siteId of siteIds) {
        results.push(await createSeasonalDailyPost(siteId));
      }
      res.json({ ok: true, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
