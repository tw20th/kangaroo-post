// firebase/functions/src/jobs/seo/scheduledAnalyzeTitlePatterns.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";
import { analyzeTitlesForSite } from "../../lib/seo/titlePatternsRunner.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";

/**
 * 毎週 日曜 午前03:00 に実行
 * → サイト内の全タイトルをAIが分析し、
 *    「強いタイトルの型」「弱いタイトル構造」を学習して保存
 */
export const scheduledAnalyzeTitlePatterns = functions
  .region(REGION)
  .pubsub.schedule("0 3 * * 0") // 毎週日曜 03:00 JST
  .timeZone(TZ)
  .onRun(async () => {
    const db = getFirestore();
    const siteIds = await getBlogEnabledSiteIds(db);

    console.log("[TitlePatterns] weekly scheduled run", { siteIds });

    for (const siteId of siteIds) {
      await analyzeTitlesForSite(siteId);
    }

    console.log("[TitlePatterns] all done");
  });
