// firebase/functions/src/jobs/analytics/aggregateKeywordScores.ts
import * as functions from "firebase-functions";
import { logger } from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const FOCUS_SITE_ID = process.env.FOCUS_SITE_ID || null;

/** siteKeywords ドキュメントの想定構造（使う部分だけ型にする） */
type SiteKeywordDoc = {
  siteId: string;
  intent: string;
  status: string;
  keyword: string;

  // GSC 由来の集計値（まだ無ければ 0 扱い）
  clicks?: number;
  impressions?: number;
  ctr?: number; // 0–100 (%)

  // 将来: 日次・週次で取り込む場合にここを使う
  clicks1d?: number;
  clicks7d?: number;
  impressions1d?: number;
  impressions7d?: number;
  ctr1d?: number;
  ctr7d?: number;
  views1d?: number;
  views7d?: number;

  // 自前メトリクス
  usedCount?: number;
  score?: number;
  scoreUpdatedAt?: number;
};

type Metrics = {
  ctr1d: number;
  ctr7d: number;
  views1d: number;
  views7d: number;
  impressions1d: number;
  impressions7d: number;
  usedCount: number;
};

/** 安全な log10（0 や負数に対しては 0 を返す） */
function safeLog10(value: number): number {
  if (value <= 0) return 0;
  return Math.log10(value);
}

/**
 * B. 通常版アルゴリズム
 * CTR (1日/7日) + views (1日/7日) + impressions をミックスして performanceScore を計算
 */
function calcPerformanceScore(m: Metrics): { performanceScore: number } {
  // ctr1d だけ途中で書き換えるので let
  let { ctr1d } = m;
  // 他は読み取り専用なので const
  const { ctr7d, views1d, views7d, impressions1d, impressions7d } = m;

  // --- スパイク検知（1日の CTR が異常に高い & データが少ない時は 7日値に寄せる） ---
  if (
    impressions1d > 0 &&
    impressions7d > 0 &&
    ctr1d > ctr7d * 2 &&
    views1d < 20
  ) {
    ctr1d = ctr7d;
  }

  // CTR を 0〜100 → 0〜1 に正規化
  const ctr1 = ctr1d / 100;
  const ctr7 = ctr7d / 100;

  // views / impressions は log スケールでならす
  const v1 = safeLog10(views1d + 1); // 0〜∞ → 0〜
  const v7 = safeLog10(views7d + 1);
  const imp1 = safeLog10(impressions1d + 1);
  const imp7 = safeLog10(impressions7d + 1);

  // ベーススコア:
  //   7日平均をベースにしつつ、
  //   1日データが十分ある場合は 1日寄りに
  const dataRichness = Math.min(1, (views1d + impressions1d) / 100); // 〜100 くらいで頭打ち
  const ctrBlend =
    ctr7 * (1 - dataRichness * 0.4) + ctr1 * (dataRichness * 0.4);
  const viewsBlend = v7 * 0.7 + v1 * 0.3;
  const impBlend = imp7 * 0.7 + imp1 * 0.3;

  // CTR を一番重く、views / impressions を補助的に
  let performanceScore =
    ctrBlend * 60 + // 最大 60 点
    viewsBlend * 20 +
    impBlend * 20;

  // スコアを 0〜100 にクリップ
  if (performanceScore < 0) performanceScore = 0;
  if (performanceScore > 100) performanceScore = 100;

  return { performanceScore };
}

/**
 * siteKeywords 1件分のメトリクスを Doc から組み立てる
 * （フィールドが無い場合は既存の clicks / impressions / ctr からフォールバック）
 */
function extractMetrics(doc: SiteKeywordDoc): Metrics {
  // CTR（%）: 1日／7日
  const ctr7d =
    typeof doc.ctr7d === "number"
      ? doc.ctr7d
      : typeof doc.ctr === "number"
      ? doc.ctr
      : 0;
  const ctr1d = typeof doc.ctr1d === "number" ? doc.ctr1d : ctr7d;

  // views ≒ clicks とみなす（専用フィールドが無い場合）
  const views7d =
    typeof doc.views7d === "number"
      ? doc.views7d
      : typeof doc.clicks7d === "number"
      ? doc.clicks7d
      : typeof doc.clicks === "number"
      ? doc.clicks
      : 0;

  const views1d =
    typeof doc.views1d === "number"
      ? doc.views1d
      : typeof doc.clicks1d === "number"
      ? doc.clicks1d
      : 0;

  // impressions（表示回数）
  const impressions7d =
    typeof doc.impressions7d === "number"
      ? doc.impressions7d
      : typeof doc.impressions === "number"
      ? doc.impressions
      : 0;

  const impressions1d =
    typeof doc.impressions1d === "number" ? doc.impressions1d : 0;

  const usedCount = typeof doc.usedCount === "number" ? doc.usedCount : 0;

  return {
    ctr1d,
    ctr7d,
    views1d,
    views7d,
    impressions1d,
    impressions7d,
    usedCount,
  };
}

/**
 * siteKeywords.score を CTR/クリック実績をもとに自動更新するバッチ
 *
 * - Cloud Scheduler から毎日 03:30 JST に実行想定
 * - FOCUS_SITE_ID が指定されていればその siteId のみ対象
 */
export const scheduledAggregateKeywordScores = functions
  .region(REGION)
  .pubsub.schedule("30 3 * * *") // 毎日 03:30 JST
  .timeZone(TZ)
  .onRun(async () => {
    const db = getFirestore();

    // 対象クエリ（基本は status=active だけ）
    let query = db
      .collection("siteKeywords")
      .where(
        "status",
        "==",
        "active"
      ) as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

    if (FOCUS_SITE_ID) {
      query = query.where("siteId", "==", FOCUS_SITE_ID);
    }

    const snap = await query.get();
    if (snap.empty) {
      logger.info("[aggregateKeywordScores] no active keywords");
      return { updated: 0 };
    }

    const nowMs = Date.now();
    let updated = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data() as SiteKeywordDoc;

      const metrics = extractMetrics(data);
      const { performanceScore } = calcPerformanceScore(metrics);

      // キーワードとしての総合 score は、とりあえず performanceScore をそのまま使う
      const newScore = Math.round(performanceScore * 10) / 10; // 小数1桁に丸め

      // 変化がなければスキップ
      const prevScore = typeof data.score === "number" ? data.score : 0;
      if (Math.abs(prevScore - newScore) < 0.01) {
        continue;
      }

      await docSnap.ref.set(
        {
          score: newScore,
          scoreUpdatedAt: nowMs,
        },
        { merge: true }
      );
      updated += 1;
    }

    logger.info("[aggregateKeywordScores] updated keywords", {
      updated,
      siteId: FOCUS_SITE_ID ?? "ALL",
    });

    return { updated };
  });
