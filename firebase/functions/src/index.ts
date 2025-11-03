/* env (local only) */
(async () => {
  try {
    if (process.env.FUNCTIONS_EMULATOR || !process.env.K_SERVICE) {
      await import("dotenv/config");
    }
  } catch {}
})();

import * as functions from "firebase-functions";
import { getApps, initializeApp } from "firebase-admin/app";
if (getApps().length === 0) initializeApp();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

/* ========== Health ========== */
export const health = functions.region(REGION).https.onRequest((_req, res) => {
  res.status(200).send("ok");
});

/* ========== HTTP (A8 minimo) ========== */
export { trackClick } from "./http/trackClick.js";
export {
  a8_syncFromFiles,
  a8_normalizeOffers,
  a8_generateBlogFromOffer,
} from "./http/a8Tools.js";
export { sites_syncFromFiles } from "./http/sitesTools.js";

/* ========== Schedules: Posting / Analyze / Rewrite ========== */
// 朝・昼にA8記事を1本ずつ公開
export {
  scheduledBlogA8_Morning,
  scheduledBlogA8_Noon,
} from "./jobs/content/scheduledA8Daily.js";

// 当日分のオンページ分析（Markdownベース）
export { scheduledAnalyzeBlogsNight } from "./jobs/content/analyzeBlog.js";

// 指標が弱い記事を1本だけ自動リライト
export { scheduledRewriteLowScoreBlogs } from "./jobs/content/scheduledRewriteLowScoreBlogs.js";

/* ========== SEO (GSC連携) ========== */
// 毎夜Pull → 翌朝GSC由来で新規/改稿
export { scheduledPullGsc, runPullGscNow } from "./jobs/seo/pullGscQueries.js";
export {
  generateFromGSC,
  runGenerateFromGscNow,
} from "./jobs/seo/generateFromGSC.js";

/*
  注意:
  - 既存の monitoredItems ベースの daily スケジュールは一旦 export していません。
  - 追加した関数の runWith(secrets) は各ファイル側に定義済みです。
*/
