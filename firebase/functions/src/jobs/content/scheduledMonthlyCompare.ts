// firebase/functions/src/jobs/content/scheduledMonthlyCompare.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { pickBestKeywordForSite } from "../../lib/keywords/pickSiteKeyword.js";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";
import { getSiteConfig } from "../../lib/sites/siteConfig.js";

const REGION = "asia-northeast1";
const TZ = "Asia/Tokyo";

const db = getFirestore();

export const scheduledMonthlyCompare = functions
  .region(REGION)
  // 🔹 タイムアウトとメモリを拡張（必要に応じて値は調整OK）
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("0 4 1 * *") // 毎月1日 04:00 JST
  .timeZone(TZ)
  .onRun(async () => {
    // 🔹 blogs 機能が ON のサイト一覧を取得（Kariraku / Workiroom / 追加サイトなど）
    const siteIds = await getBlogEnabledSiteIds(db);

    if (!siteIds.length) {
      logger.warn("[monthlyCompare] no blog-enabled sites");
      return;
    }

    // 🔹 サイトごとの比較記事生成を並列実行して、全体時間を短縮
    const results = await Promise.all(
      siteIds.map((siteId) => createMonthlyCompareForSite(siteId))
    );

    logger.info("[monthlyCompare] finished for all sites", { results });
    return { results };
  });

/** サイトごとに 3社比較記事を1本つくる */
async function createMonthlyCompareForSite(siteId: string) {
  const services = await pickServices(db, siteId, 3);

  if (services.length < 3) {
    logger.warn("[monthlyCompare] need >=3 services", {
      found: services.length,
      siteId,
    });
    return { siteId, slug: null, reason: "not-enough-services" as const };
  }

  const now = new Date();
  const seasonKeyword = seasonKeywordByMonth(now);
  const dateStr = yyyymm(now);
  const hash8 = Math.random().toString(36).slice(2, 10);

  // 🔹 siteKeywords から intent: "compare" を1つ選ぶ
  const picked = await pickBestKeywordForSite({
    siteId,
    intent: "compare",
    avoidHours: 24,
  });
  const targetKeyword = picked?.keyword?.trim() || "サービス 比較 ガイド";

  // 🔹 サイト設定から displayName を取得（なければ siteId を使う）
  const siteCfg = await getSiteConfig(siteId).catch(() => null);
  const siteName =
    typeof siteCfg?.displayName === "string" && siteCfg.displayName
      ? siteCfg.displayName
      : siteId;

  const { title, excerpt, tags, content } = await generateBlogContent({
    siteId,
    siteName,
    product: {
      // product.name は「記事全体のテーマ名」
      name: targetKeyword,
      asin: `compare-${siteId}-${dateStr}`,
      tags: [seasonKeyword, "比較"],
    },
    persona:
      "複数のサービスを比較して、自分に合う1社を見つけたい在宅ワーカー・生活者",
    pain: "どのサービスを選べば良いか分からず、料金や特徴の違いが整理できていない",
    // ★ 汎用テンプレ（比較用）
    templateName: "blogTemplate_compare.txt",
    vars: {
      site: {
        id: siteId,
        displayName: siteName,
        domain: `${siteId}.com`, // 必要なら後でちゃんとしたドメインを渡す
      },
      services,
      seasonKeyword,
      seasonTag: seasonKeyword,
      dateYYYYMM: dateStr,
      hash8,
      primaryKeyword: targetKeyword,
      primaryKeywordDocId: picked?.docId ?? null,
    },
  });

  const md = content;
  const slug = `compare-${siteId}-${dateStr}`;
  const finalTitle =
    title && title.trim()
      ? title.trim()
      : `${targetKeyword}｜${siteName} の3社比較ガイド`;

  const summary =
    excerpt && excerpt.trim() ? excerpt.trim() : extractSummary(md);

  const finalTags =
    Array.isArray(tags) && tags.length
      ? tags
      : sanitizeTags(["比較", seasonKeyword, siteId, targetKeyword]);

  const nowMs = Date.now();

  const doc = {
    slug,
    siteId,
    title: finalTitle,
    summary,
    content: md,
    status: "published" as const,
    visibility: "public" as const,
    type: "compare" as const,
    tags: finalTags,
    createdAt: nowMs,
    updatedAt: nowMs,
    publishedAt: nowMs,
    views: 0,
    primaryKeyword: targetKeyword,
    primaryKeywordDocId: picked?.docId ?? null,
  };

  await db.collection("blogs").doc(slug).set(doc, { merge: true });

  // 🔹 使ったキーワードの統計を siteKeywords に反映
  if (picked) {
    const kwRef = db.collection("siteKeywords").doc(picked.docId);
    const prev = picked.raw;

    await kwRef.set(
      {
        usedCount: (prev.usedCount ?? 0) + 1,
        lastUsedAt: nowMs,
        lastBlogSlug: slug,
        updatedAt: nowMs,
      },
      { merge: true }
    );
  }

  logger.info("[monthlyCompare] upserted", {
    siteId,
    slug,
    title: finalTitle,
    targetKeyword,
  });

  return { siteId, slug, reason: "created" as const };
}

/* ========== 以下は元の関数を siteId パラメータ化して流用 ========== */

function seasonKeywordByMonth(d: Date): string {
  const m = d.getMonth() + 1;
  if ([12, 1, 2].includes(m)) return "冬支度";
  if ([3, 4].includes(m)) return "新生活";
  if ([5, 6, 7].includes(m)) return "梅雨〜夏前";
  if ([8, 9].includes(m)) return "猛暑対策";
  if ([10, 11].includes(m)) return "引っ越しシーズン";
  return "季節の準備";
}

function yyyymm(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function extractSummary(md: string): string {
  const text = md
    .replace(/\r/g, "")
    .split("\n")
    .filter(Boolean)
    .slice(0, 40)
    .join(" ");
  return text.replace(/[#>*_`]/g, "").slice(0, 130);
}

type ServiceLite = {
  name: string;
  officialUrl: string;
  affiliateUrl: string;
  categoriesCsv: string;
  area: string;
  minTerm: string;
  highlightsCsv: string;
  cautionsCsv: string;
  planExamplesCsv: string;
  reviewSummary: string;
  internalSlug: string;
  feeClarity: string;
  deliveryNote: string;
};

async function pickServices(
  db: FirebaseFirestore.Firestore,
  siteId: string,
  limit: number
): Promise<ServiceLite[]> {
  const toLite = (d: FirebaseFirestore.QueryDocumentSnapshot): ServiceLite => {
    const title = String(d.get("title") ?? "サービス");
    const internalSlug = `${siteId}-${String(d.id).replace(
      /[^a-zA-Z0-9:_-]/g,
      ""
    )}`;
    return {
      name: title,
      officialUrl: String(d.get("landingUrl") ?? ""),
      affiliateUrl: String(d.get("affiliateUrl") ?? ""),
      categoriesCsv: (Array.isArray(d.get("category"))
        ? d.get("category")
        : []
      ).join(","),
      area: String(d.get("extras.area") ?? d.get("area") ?? "全国"),
      minTerm: String(d.get("extras.minTerm") ?? "30日〜"),
      highlightsCsv: (Array.isArray(d.get("badges"))
        ? d.get("badges")
        : []
      ).join(","),
      cautionsCsv: "",
      planExamplesCsv: "",
      reviewSummary: "",
      internalSlug,
      feeClarity: "○",
      deliveryNote: "設置・回収に対応",
    };
  };

  // 1st: siteIdPrimary == siteId
  let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  {
    const snap = await db
      .collection("offers")
      .where("siteIdPrimary", "==", siteId)
      .where("archived", "==", false)
      .limit(limit)
      .get();
    docs = snap.docs;
  }

  // 2nd: 足りなければ siteIds array-contains siteId
  if (docs.length < limit) {
    const snap = await db
      .collection("offers")
      .where("siteIds", "array-contains", siteId)
      .where("archived", "==", false)
      .limit(limit * 2)
      .get();
    const seen = new Set(docs.map((d) => d.id));
    for (const d of snap.docs) {
      if (!seen.has(d.id)) docs.push(d);
      if (docs.length >= limit) break;
    }
  }

  // 3rd: まだ足りなければ archived 条件外して穴埋め
  if (docs.length < limit) {
    const snap = await db
      .collection("offers")
      .where("siteIds", "array-contains", siteId)
      .limit(limit * 2)
      .get();
    const seen = new Set(docs.map((d) => d.id));
    for (const d of snap.docs) {
      if (!seen.has(d.id)) docs.push(d);
      if (docs.length >= limit) break;
    }
  }

  return docs.slice(0, limit).map(toLite);
}

function sanitizeTags(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const parts = String(raw ?? "")
      .replace(/[:;|/,\t]+/g, " ")
      .split(" ");
    for (const p of parts) {
      const t = String(p || "")
        .replace(/[「」『』“”"']/g, " ")
        .replace(/[^\w\u3040-\u30FF\u4E00-\u9FFF\s-]/g, " ")
        .replace(/[-\s]+/g, " ")
        .trim();
      if (!t) continue;
      if (t.length < 2) continue;
      if (/^[A-Za-z0-9]{1,3}$/.test(t)) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t.length > 40 ? t.slice(0, 40) : t);
    }
  }
  return out.slice(0, 8);
}
