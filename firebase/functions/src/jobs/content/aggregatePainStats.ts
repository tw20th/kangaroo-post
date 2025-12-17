// firebase/functions/src/jobs/content/aggregatePainStats.ts
import * as functions from "firebase-functions/v1";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const db = getFirestore();

// YYYY-MM-DD -> [startMs, endMs) （とりあえずUTCベースでOK）
function getDateRange(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  return { startMs: start.getTime(), endMs: end.getTime() };
}

type BlogInfo = {
  painId: string;
};

type PainAgg = {
  views: number;
  compareClicks: number;
  ctaClicks: number;
  viewCtr: number;
  compareCtr: number;
  ctaCtr: number;
  score: number;
};

function extractSlugFromRef(ref?: string | null): string | null {
  if (!ref) return null;
  // 例: http://localhost:3000/blog/SGOrEXYk4UtNYoC3KOdv
  const m = /\/blog\/([^/?#]+)/.exec(ref);
  return m ? m[1] : null;
}

/** 実処理本体（再利用しやすい形で分離） */
async function aggregatePainStatsForSite(
  siteId: string,
  dateStr: string
): Promise<void> {
  const { startMs, endMs } = getDateRange(dateStr);

  // --- 1. blog -> painId のマップを作る -----------------
  const blogSnap = await db
    .collection("blogs")
    .where("siteId", "==", siteId)
    .get();

  const blogMap = new Map<string, BlogInfo>();

  blogSnap.forEach((doc) => {
    const data = doc.data() as any;
    const painId: string | undefined = data.painId;
    if (!painId) return;

    const docId = doc.id; // 例: SGOrEXYk4UtNYoC3KOdv
    const slugField: string | undefined = data.slug; // 例: kariraku-2025...

    blogMap.set(docId, { painId });
    if (slugField) {
      blogMap.set(slugField, { painId });
    }
  });

  if (blogMap.size === 0) {
    console.log("[aggregatePainStats] no blogs with painId", { siteId });
    return;
  }

  // --- 2. 当日の blog ビュー & compare クリックを取得 -------------
  const clicksSnap = await db
    .collection("tracks")
    .doc(siteId)
    .collection("clicks")
    .where("type", "==", "blog")
    .where("ts", ">=", startMs)
    .where("ts", "<", endMs)
    .get();

  const painAgg = new Map<string, PainAgg>();

  const ensurePainAgg = (painId: string): PainAgg => {
    const existing = painAgg.get(painId);
    if (existing) return existing;
    const init: PainAgg = {
      views: 0,
      compareClicks: 0,
      ctaClicks: 0,
      viewCtr: 0,
      compareCtr: 0,
      ctaCtr: 0,
      score: 0,
    };
    painAgg.set(painId, init);
    return init;
  };

  clicksSnap.forEach((doc) => {
    const data = doc.data() as any;
    const where: string | null = data.where ?? null;
    const blogSlugField: string | null = data.blogSlug ?? null;
    const ref: string | null = data.ref ?? null;

    let key: string | null = blogSlugField;
    if (!key) {
      key = extractSlugFromRef(ref);
    }
    if (!key) return;

    const blog = blogMap.get(key);
    if (!blog) return;

    const agg = ensurePainAgg(blog.painId);

    if (where === "view") {
      agg.views += 1;
    } else if (where === "compare") {
      agg.compareClicks += 1;
    } else if (where && where.startsWith("cta_")) {
      agg.ctaClicks += 1;
    }
  });

  // --- 3. CTR & スコア計算 ------------------------------
  painAgg.forEach((agg) => {
    const v = agg.views || 1; // 0割り防止
    agg.viewCtr = 1; // 定義上は常に 1
    agg.compareCtr = agg.compareClicks / v;
    agg.ctaCtr = agg.ctaClicks / v;

    // 重み付きスコア: compare 0.7, CTA 0.3 を 0〜100 にスケーリング
    const rawScore = agg.compareCtr * 0.7 + agg.ctaCtr * 0.3;
    agg.score = Math.round(rawScore * 10000) / 100; // 小数2桁
  });

  // --- 4. Firestore に保存 ------------------------------
  const docId = `${siteId}_${dateStr}`;
  const outRef = db.collection("painStats").doc(docId);

  const pains: Record<string, PainAgg> = {};
  painAgg.forEach((agg, painId) => {
    pains[painId] = agg;
  });

  await outRef.set(
    {
      siteId,
      date: dateStr,
      pains,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log("[aggregatePainStats] saved", {
    siteId,
    dateStr,
    docId,
    painCount: painAgg.size,
  });
}

/** Cloud Scheduler から daily で呼ぶ用（今は未使用でもOK） */
export const aggregatePainStats = functions
  .region(REGION)
  .pubsub.schedule("0 1 * * *") // JST 朝10:00 くらいにしたければ後で調整
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // ひとまず kariraku 固定。複数サイト対応するときは配列化
    const siteId = "kariraku";
    await aggregatePainStatsForSite(siteId, dateStr);
  });

/** 手動テスト用 HTTP: aggregatePainStatsNow?siteId=kariraku&date=2025-11-22 */
export const aggregatePainStatsNow = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      const siteId = (req.query.siteId as string) || "kariraku";

      let dateStr = req.query.date as string | undefined;
      if (!dateStr) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        dateStr = `${y}-${m}-${d}`;
      }

      await aggregatePainStatsForSite(siteId, dateStr);

      res.json({ ok: true, siteId, date: dateStr });
    } catch (e: any) {
      console.error(e);
      res
        .status(500)
        .json({ ok: false, error: e?.message ?? String(e ?? "unknown") });
    }
  });
