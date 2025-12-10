// firebase/functions/src/jobs/seo/updateBlogSeoFromGSC.ts
import * as functions from "firebase-functions";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const REGION = "asia-northeast1";
const TZ = "Asia/Tokyo";

type PageQueryRow = {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type SiteResult = { siteId: string; updated: number; reason?: string };
type UpdateResult = { results: SiteResult[] };

// ページURLから /blog/{slug} の slug を抽出
function slugFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/blog\/([^\/?#]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

// rows を集計して last28 用のオブジェクトに整形
function rollup(rows: PageQueryRow[]) {
  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;

  const mapQ = new Map<string, number>(); // query → clicks

  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    if (r.impressions > 0) posWeighted += r.position * r.impressions;
    mapQ.set(r.query, (mapQ.get(r.query) || 0) + r.clicks);
  }

  const topQueries = [...mapQ.entries()]
    .map(([q, c]) => ({ q, c }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10)
    .map((x) => x.q);

  const ctr = impressions ? clicks / impressions : 0;
  const position = impressions ? posWeighted / impressions : 0;

  return { clicks, impressions, ctr, position, topQueries };
}

// sites/{siteId}/seo/pageLatest の rows を blogs/{slug}.seo.last28 に反映
async function updateAllSitesFromPageLatest(): Promise<UpdateResult> {
  const siteSnap = await db.collection("sites").get();
  const siteIds = siteSnap.docs.map((d) => d.id);

  const results: SiteResult[] = [];

  for (const siteId of siteIds) {
    const pageDoc = await db
      .collection("sites")
      .doc(siteId)
      .collection("seo")
      .doc("pageLatest")
      .get();

    const rows = ((pageDoc.data()?.rows || []) as PageQueryRow[]).filter(
      Boolean
    );

    if (!rows.length) {
      results.push({ siteId, updated: 0, reason: "no-rows" });
      continue;
    }

    // slug ごとにまとめる
    const bySlug = new Map<string, PageQueryRow[]>();
    for (const r of rows) {
      const slug = slugFromUrl(r.page);
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug)!.push(r);
    }

    let updated = 0;
    for (const [slug, list] of bySlug.entries()) {
      const ref = db.collection("blogs").doc(slug);
      const snap = await ref.get();
      if (!snap.exists) continue;

      const agg = rollup(list);
      const now = Date.now();

      await ref.set(
        {
          seo: { last28: agg, updatedAt: now },
          updatedAt: now,
        },
        { merge: true }
      );
      updated++;
    }

    results.push({ siteId, updated });
  }

  return { results };
}

/* ============================================================
   GSCページ別クエリ更新処理はMVPでは不要のため停止
============================================================ */

/*
export const scheduledUpdateBlogSeoFromGSC = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 180, memory: "256MB" })
  .pubsub.schedule("40 2 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    return updateAllSitesFromPageLatest();
  });

export const runUpdateBlogSeoNow = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, null);
      return;
    }
    try {
      const out = await updateAllSitesFromPageLatest();
      sendJson(res, 200, { ok: true, ...out });
    } catch (e) {
      const msg =
        typeof e === "object" && e && "toString" in (e as any)
          ? String(e)
          : "unknown error";
      sendJson(res, 500, { ok: false, error: msg });
    }
  });
*/
