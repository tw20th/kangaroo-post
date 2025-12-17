import * as functions from "firebase-functions/v1";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

type BlogDoc = {
  slug?: string;
  siteId: string;
  painId?: string | null;
};

type ClickDoc = {
  type?: string;
  where?: string | null;
  blogSlug?: string | null;
  ts?: number;
};

type PainAgg = {
  views: number;
  ctaClicks: number;
  compareClicks: number;
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 指定した日付 1日分を、painId ごとに集計して painStats へ保存する共通処理
 *
 * @param target JST基準で集計したい日付
 * @param siteFilter 特定 siteId のみ集計したい場合
 */
async function runAggregateForDate(target: Date, siteFilter?: string) {
  const dateStr = formatDate(target);

  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);
  const startTs = start.getTime();
  const endTs = end.getTime();

  functions.logger.info("[aggregatePainStats] start", {
    date: dateStr,
    startTs,
    endTs,
    siteFilter: siteFilter ?? "ALL",
  });

  const siteSnap = await db.collection("tracks").get();
  if (siteSnap.empty) {
    functions.logger.info("[aggregatePainStats] no tracks docs");
    return;
  }

  for (const siteDoc of siteSnap.docs) {
    const siteId = siteDoc.id;

    // siteFilter が指定されている場合は一致する siteId だけ処理
    if (siteFilter && siteId !== siteFilter) continue;

    // --- 1) blogs から slug -> painId マップを作る ---
    const blogsSnap = await db
      .collection("blogs")
      .where("siteId", "==", siteId)
      .get();

    const slugToPain = new Map<string, string>();

    blogsSnap.forEach((b) => {
      const data = b.data() as BlogDoc;
      const painId = data.painId;
      if (!painId) return;

      const docId = b.id;
      const slugField = data.slug;

      // doc ID (= /blog/[slug] のパスに使われている値) でも引けるように
      if (docId) {
        slugToPain.set(docId, painId);
      }

      // slug フィールドでも引けるように（違う値なら両方登録）
      if (slugField && slugField !== docId) {
        slugToPain.set(slugField, painId);
      }
    });

    if (slugToPain.size === 0) {
      functions.logger.info(
        "[aggregatePainStats] no blogs with painId for site",
        { siteId }
      );
      continue;
    }

    // --- 2) tracks/{siteId}/clicks から対象日のイベントを取得 ---
    const clicksSnap = await siteDoc.ref
      .collection("clicks")
      .where("ts", ">=", startTs)
      .where("ts", "<", endTs)
      .get();

    if (clicksSnap.empty) {
      functions.logger.info("[aggregatePainStats] no clicks for site on date", {
        siteId,
        date: dateStr,
      });
      continue;
    }

    // painId 別の集計バッファ
    const aggByPain: Record<string, PainAgg> = {};

    const ensure = (painId: string): PainAgg => {
      if (!aggByPain[painId]) {
        aggByPain[painId] = { views: 0, ctaClicks: 0, compareClicks: 0 };
      }
      return aggByPain[painId];
    };

    // --- 3) ループしながら集計 ---
    for (const doc of clicksSnap.docs) {
      const data = doc.data() as ClickDoc;
      const blogSlug = data.blogSlug ?? null;
      if (!blogSlug) continue;

      const painId = slugToPain.get(blogSlug);
      if (!painId) continue;

      const bucket = ensure(painId);

      // view イベント
      if (data.type === "blog" && data.where === "view") {
        bucket.views += 1;
        continue;
      }

      if (data.type === "blog" && typeof data.where === "string") {
        // CTA ボタン
        if (data.where.startsWith("cta_")) {
          bucket.ctaClicks += 1;
          continue;
        }
        // compare への誘導
        if (data.where === "compare" || data.where.startsWith("compare_")) {
          bucket.compareClicks += 1;
          continue;
        }
      }
    }

    // --- 4) Firestore へ書き込み ---
    const batch = db.batch();
    const statsCol = db.collection("painStats").doc(siteId).collection("daily");

    Object.entries(aggByPain).forEach(([painId, agg]) => {
      const { views, ctaClicks, compareClicks } = agg;
      if (views === 0 && ctaClicks === 0 && compareClicks === 0) return;

      const sampleSize = views;
      const ctr = views > 0 ? ctaClicks / views : 0;
      const compareCtr = views > 0 ? compareClicks / views : 0;

      // 重み付きスコア（views が多いほど同じCTRでもスコア↑）
      const score = ctr * Math.log(sampleSize + 1);

      const docId = `${dateStr}_${painId}`;
      const ref = statsCol.doc(docId);
      batch.set(
        ref,
        {
          siteId,
          painId,
          date: dateStr,
          views,
          ctaClicks,
          compareClicks,
          ctr,
          compareCtr,
          score,
          sampleSize,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();

    functions.logger.info("[aggregatePainStats] written painStats for site", {
      siteId,
      date: dateStr,
      painCount: Object.keys(aggByPain).length,
    });
  }

  functions.logger.info("[aggregatePainStats] done", {
    date: dateStr,
    siteFilter: siteFilter ?? "ALL",
  });
}

/**
 * 本番運用用: 毎日 01:30 JST に「前日分」を集計
 */
export const aggregatePainStatsDaily = functions
  .region(REGION)
  .pubsub.schedule("30 1 * * *") // 毎日 01:30 JST
  .timeZone(TZ)
  .onRun(async () => {
    const target = new Date();
    target.setDate(target.getDate() - 1); // 前日
    await runAggregateForDate(target);
  });

/**
 * テスト用: 「今日 or 指定日」の集計を即時実行する HTTP 関数
 *
 * 例:
 *   .../aggregatePainStatsNow?siteId=kariraku
 *   .../aggregatePainStatsNow?siteId=kariraku&date=2025-11-22
 */
export const aggregatePainStatsNow = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      const siteIdParam =
        typeof req.query.siteId === "string" ? req.query.siteId : undefined;
      const dateParam =
        typeof req.query.date === "string" ? req.query.date : undefined;

      let target: Date;
      if (dateParam) {
        target = new Date(dateParam + "T00:00:00+09:00");
      } else {
        target = new Date(); // 今日
      }

      await runAggregateForDate(target, siteIdParam);

      res.json({
        ok: true,
        siteId: siteIdParam ?? "ALL",
        date: formatDate(target),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      functions.logger.error("[aggregatePainStatsNow] error", { error: msg });
      res.status(500).json({ ok: false, error: msg });
    }
  });
