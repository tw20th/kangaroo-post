// firebase/functions/src/index.ts

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

if (getApps().length === 0) {
  initializeApp();
}

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

export { trackPainClick } from "./http/trackPainClick.js";

/* ========== Schedules: Posting / Analyze / Rewrite ========== */

/**
 * A8オファー起点の記事
 * - scheduledBlogA8_Morning: 朝 6:00 に実行（内部で 3日サイクル判定）
 * - runA8DailyNow: 手動トリガー用 HTTP
 */
export {
  scheduledBlogA8_Morning,
  runA8DailyNow,
} from "./jobs/content/scheduledA8Daily.js";

/**
 * 季節 × 悩み解決のデイリー記事
 * - scheduledBlogDaily_Morning: 毎朝 6:05 に1本生成
 * - runDailyNow: 手動トリガー用 HTTP
 */
export {
  scheduledBlogDaily_Morning,
  runDailyNow,
} from "./jobs/content/scheduledBlogDaily.js";

/**
 * Kariraku 悩み解決レーン（ガイド記事）
 * - scheduledKarirakuGuideDaily: 毎朝 7:00 に1本生成
 * - runKarirakuGuideNow: 手動トリガー用 HTTP
 */
export {
  scheduledKarirakuGuideDaily,
  runKarirakuGuideNow,
} from "./jobs/content/scheduledKarirakuGuideDaily.js";

/**
 * 月次比較記事（3社比較）
 * - scheduledMonthlyCompare: 毎月1日 04:00 に実行
 */
export { scheduledMonthlyCompare } from "./jobs/content/scheduledMonthlyCompare.js";

export {
  scheduledDiscoverDaily,
  runDiscoverDailyNow,
} from "./jobs/content/scheduledDiscoverDaily.js";

/* ========== A8 price updates ========== */
export { a8_updateOfferPrice } from "./jobs/a8/updateOfferPrice.js";

/* ========== Analyze / Rewrite ========== */
export { scheduledAnalyzeBlogsNight } from "./jobs/content/analyzeBlog.js";
export { debugBlogCtr } from "./http/debugBlogCtr.js";
export {
  aggregatePainStats,
  aggregatePainStatsNow,
} from "./jobs/content/aggregatePainStats.js";

/** 指標が弱い記事を1本だけ自動リライト */
export { scheduledRewriteLowScoreBlogs } from "./jobs/content/scheduledRewriteLowScoreBlogs.js";

/* ========== SEO (GSC連携) ========== */
// 毎夜 Pull → 翌朝 GSC 由来で新規/改稿
export { scheduledPullGsc, runPullGscNow } from "./jobs/seo/pullGscQueries.js";
export {
  generateFromGSC,
  runGenerateFromGscNow,
} from "./jobs/seo/generateFromGSC.js";
export { runUpdateBlogSeoNow } from "./jobs/seo/updateBlogSeoFromGSC.js";

/* ========== スコア最適化アルゴリズム ========== */
export { scheduledAggregateKeywordScores } from "./jobs/analytics/aggregateKeywordScores.js";
