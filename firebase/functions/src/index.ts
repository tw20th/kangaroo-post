// firebase/functions/src/index.ts

import * as functions from "firebase-functions/v1";
import type { Request, Response } from "express";
import { getApps, initializeApp } from "firebase-admin/app";
import { requireLocalSafetyMode } from "./lib/infra/safety.js";

// ✅ Emulator安全スイッチ（LOCAL_SAFETY_MODE=true が無いと起動させない）
requireLocalSafetyMode();

if (getApps().length === 0) {
  initializeApp();
}

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

export const health = functions
  .region(REGION)
  .https.onRequest((_req: Request, res: Response) => {
    res.status(200).send("ok");
  });

/* ========== HTTP (A8 minimo) ========== */
export { trackClick } from "./http/trackClick.js";
export {
  a8_syncFromFiles,
  a8_normalizeOffers,
  // ← 企業詳細記事の自動生成は一旦止める
  // a8_generateBlogFromOffer,
} from "./http/a8Tools.js";
export { sites_syncFromFiles } from "./http/sitesTools.js";

// これはクリック計測なので残してOK
export { trackPainClick } from "./http/trackPainClick.js";

/* ========== Schedules: Posting / Analyze / Rewrite ========== */

/**
 * Workspaceごとの週1自動投稿（カンガルーポスト本命）
 */
export { scheduledWeeklyWorkspacePosts } from "./jobs/content/scheduledWeeklyWorkspacePosts.js";

/**
 * A8オファー起点の記事（今回は停止）
 */
// export {
//   scheduledBlogA8_Morning,
//   runA8DailyNow,
// } from "./jobs/content/scheduledA8Daily.js";

/**
 * 季節 × 悩み解決のデイリー記事（旧レーン・今回は停止）
 */
// export {
//   scheduledBlogDaily_Morning,
//   runDailyNow,
// } from "./jobs/content/scheduledBlogDaily.js";

/**
 * Kariraku 悩み解決レーン（guide 記事）★残す
 */
export {
  scheduledKarirakuGuideDaily,
  runKarirakuGuideNow,
} from "./jobs/content/scheduledKarirakuGuideDaily.js";

/**
 * 月次比較記事（3社比較）→ 今回は停止
 */
// export {
//   scheduledMonthlyCompare,
//   runMonthlyCompareNow,
// } from "./jobs/content/scheduledMonthlyCompare.js";

// 比較・企業用の単発生成も止める
// export { runGenerateBlogFromOfferOnce } from "./http/runGenerateBlogFromOfferOnce.js";

/**
 * Discover 記事 ★残す
 */
export {
  scheduledDiscoverDaily,
  runDiscoverDailyNow,
} from "./jobs/content/scheduledDiscoverDaily.js";

/* ========== A8 price updates ========== */
/**
 * 価格更新も今回の運用では使わないので停止
 */
// export { a8_updateOfferPrice } from "./jobs/a8/updateOfferPrice.js";

/* ========== Analyze / Rewrite ========== */
// 記事の夜間分析（SEO観点で残す）
export { scheduledAnalyzeBlogsNight } from "./jobs/content/analyzeBlog.js";
export { debugBlogCtr } from "./http/debugBlogCtr.js";

// painStats 集計は使わないので停止
// export {
//   aggregatePainStats,
//   aggregatePainStatsNow,
// } from "./jobs/content/aggregatePainStats.js";

/** 指標が弱い記事を1本だけ自動リライト（SEO強化なので残す） */
export { scheduledRewriteLowScoreBlogs } from "./jobs/content/scheduledRewriteLowScoreBlogs.js";

/* ========== SEO (GSC連携) ========== */

// ▼ MVPフェーズでは GSC 全停止するため、すべて無効化
// export { scheduledAnalyzeTitlePatterns } from "./jobs/seo/scheduledAnalyzeTitlePatterns.js";

// export {
//   scheduledPullGsc,
//   runPullGscNow,
// } from "./jobs/seo/pullGscQueries.js";

// export {
//   generateFromGSC,
//   runGenerateFromGscNow,
// } from "./jobs/seo/generateFromGSC.js";

// export { runUpdateBlogSeoNow } from "./jobs/seo/updateBlogSeoFromGSC.js";

// export {
//   scheduledSyncSiteKeywordsFromGSC,
//   runSyncSiteKeywordsFromGSCNow,
// } from "./jobs/seo/syncSiteKeywordsFromGSC.js";

/* ========== スコア最適化アルゴリズム ========== */
export { scheduledAggregateKeywordScores } from "./jobs/analytics/aggregateKeywordScores.js";

export * as workspaces from "./http/workspaces.js";
export { getMyWorkspace } from "./http/workspaces.js";

console.log("LOCAL_SAFETY_MODE =", process.env.LOCAL_SAFETY_MODE);
console.log("IS_EMULATOR =", process.env.FIREBASE_EMULATOR_HUB !== undefined);
