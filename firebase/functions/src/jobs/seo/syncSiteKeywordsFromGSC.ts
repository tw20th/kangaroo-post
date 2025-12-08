// firebase/functions/src/jobs/seo/syncSiteKeywordsFromGSC.ts
import * as functions from "firebase-functions";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const REGION = "asia-northeast1";
const TZ = "Asia/Tokyo";

/* ====== 型 ====== */

type SiteKeywordStatus = "active" | "paused";

export type IntentId = "service" | "compare" | "guide" | "discover";

type SiteKeyword = {
  siteId: string;
  keyword: string;
  intent: IntentId;
  status: SiteKeywordStatus;

  usedCount: number;
  lastUsedAt: number | null;

  impressions: number;
  clicks: number;
  ctr: number;
  score: number;

  createdAt: number;
  updatedAt: number;

  source?: "keywordPools" | "painRules";
  poolKey?: string | null;
  painRuleId?: string | null;
  lastBlogSlug?: string | null;
};

type QueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type SiteSyncResult = {
  siteId: string;
  totalKeywords: number;
  matchedFromGsc: number;
  updated: number;
  reason?: string;
};

type SyncResult = {
  results: SiteSyncResult[];
};

/* ====== GSC → score の簡易計算 ======
 *
 * 「たくさん表示されてて／クリックもされていて／順位も悪くない」を
 * ざっくり1つの数値にまとめるスコア。
 *
 * ※いまはシンプルにしておいて、あとで調整しやすいように。
 */
function calcScoreFromGsc(row: QueryRow): number {
  const impressions = Number(row.impressions) || 0;
  const ctr = Number(row.ctr) || 0;
  const position = Number(row.position) || 0;

  if (impressions <= 0) return 0;

  // 位置が良いほど少しだけブースト（1位〜3位）
  const posBoost =
    position > 0 && position <= 3 ? 1.2 : position <= 10 ? 1.1 : 1.0;

  // 簡易スコア: インプレ × CTR × ポジション補正（上位ほど少し＋）
  // CTR = 0〜1 なので、だいたい impressions の何割か、というイメージ
  return impressions * ctr * posBoost;
}

/* ====== 1サイト分の同期ロジック ====== */

async function syncSiteKeywordsFromGscForSite(
  siteId: string
): Promise<SiteSyncResult> {
  // GSC の latest クエリ（QUERY 単位）を取得
  const latestDoc = await db
    .collection("sites")
    .doc(siteId)
    .collection("seo")
    .doc("latest")
    .get();

  const rows = ((latestDoc.data()?.rows || []) as QueryRow[]).filter(
    (r) => typeof r?.query === "string" && r.query.trim().length > 0
  );

  if (!rows.length) {
    return {
      siteId,
      totalKeywords: 0,
      matchedFromGsc: 0,
      updated: 0,
      reason: "no-gsc-rows",
    };
  }

  // query → aggregated row（同じクエリはまとめる）
  const byQuery = new Map<string, QueryRow>();
  for (const r of rows) {
    const key = r.query.trim();
    const prev = byQuery.get(key);
    if (!prev) {
      byQuery.set(key, { ...r });
    } else {
      const clicks = (prev.clicks || 0) + (r.clicks || 0);
      const impressions = (prev.impressions || 0) + (r.impressions || 0);
      const ctr = impressions ? clicks / impressions : 0;
      // 位置はインプレッション重み付き平均で再計算
      const posWeighted =
        (prev.position || 0) * (prev.impressions || 0) +
        (r.position || 0) * (r.impressions || 0);
      const position = impressions ? posWeighted / impressions : 0;
      byQuery.set(key, {
        query: key,
        clicks,
        impressions,
        ctr,
        position,
      });
    }
  }

  // siteKeywords を取得（active / paused 両方を対象にしておく）
  const kwSnap = await db
    .collection("siteKeywords")
    .where("siteId", "==", siteId)
    .get();

  if (kwSnap.empty) {
    return {
      siteId,
      totalKeywords: 0,
      matchedFromGsc: 0,
      updated: 0,
      reason: "no-siteKeywords",
    };
  }

  const now = Date.now();
  let matchedFromGsc = 0;
  let updated = 0;

  for (const doc of kwSnap.docs) {
    const data = doc.data() as SiteKeyword;
    const key = data.keyword?.trim();
    if (!key) continue;

    const g = byQuery.get(key);
    if (!g) continue;

    matchedFromGsc++;

    const impressions = Number(g.impressions) || 0;
    const clicks = Number(g.clicks) || 0;
    const ctr = impressions ? clicks / impressions : 0;
    const score = calcScoreFromGsc(g);

    await doc.ref.set(
      {
        impressions,
        clicks,
        ctr,
        score,
        updatedAt: now,
      },
      { merge: true }
    );
    updated++;
  }

  return {
    siteId,
    totalKeywords: kwSnap.size,
    matchedFromGsc,
    updated,
  };
}

/* ====== 全サイト分をまとめて実行 ====== */

async function syncAllSitesKeywordsFromGsc(): Promise<SyncResult> {
  const siteSnap = await db.collection("sites").get();
  const siteIds = siteSnap.docs.map((d) => d.id);

  const results: SiteSyncResult[] = [];

  for (const siteId of siteIds) {
    try {
      const r = await syncSiteKeywordsFromGscForSite(siteId);
      results.push(r);
    } catch (e) {
      // ここでは console.error で十分（必要なら logger に差し替え可）
      console.error("[syncAllSitesKeywordsFromGsc] fail", siteId, e);
      results.push({
        siteId,
        totalKeywords: 0,
        matchedFromGsc: 0,
        updated: 0,
        reason: "error",
      });
    }
  }

  return { results };
}

/* ====== スケジュール実行 ======
 *
 * 例: 02:45 JST に毎日実行
 * - 02:30: scheduledPullGsc（GSCから最新rows取得）
 * - 02:40: scheduledUpdateBlogSeoFromGSC（blogs.{slug}.seo.last28更新）
 * - 02:45: ★このジョブ（siteKeywordsにGSC成績を反映）
 */

// 毎月1日の 02:45 JST に実行
export const scheduledSyncSiteKeywordsFromGSC = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  // ────────────────
  // 秒 分 日 月 曜日
  // 45  2  1  *   *
  // → 毎月1日 02:45 に1回
  // ────────────────
  .pubsub.schedule("45 2 1 * *")
  .timeZone(TZ)
  .onRun(async () => {
    return syncAllSitesKeywordsFromGsc();
  });

/* ====== 手動実行（HTTP） ======
 *
 * 例:
 * - 全サイト:   /syncSiteKeywordsFromGSC
 * - 特定サイト: /syncSiteKeywordsFromGSC?siteId=kariraku
 */

export const runSyncSiteKeywordsFromGSCNow = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      const siteId = String(req.query.siteId || "").trim();

      if (siteId) {
        const result = await syncSiteKeywordsFromGscForSite(siteId);
        res.json({ ok: true, mode: "single", result });
        return;
      }

      const out = await syncAllSitesKeywordsFromGsc();
      res.json({ ok: true, mode: "all", ...out });
    } catch (e: unknown) {
      const msg =
        typeof e === "object" && e && "toString" in (e as any)
          ? String(e)
          : "unknown error";
      console.error("[runSyncSiteKeywordsFromGSCNow] failed", msg);
      res.status(500).json({ ok: false, error: msg });
    }
  });
