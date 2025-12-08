// firebase/functions/src/jobs/content/scheduledMonthlyCompare.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { pickBestKeywordForSite } from "../../lib/keywords/pickSiteKeyword.js";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";
import { getSiteConfig } from "../../lib/sites/siteConfig.js";
import { findUnsplashHero } from "../../services/unsplash/client.js";

const REGION = "asia-northeast1";
const TZ = "Asia/Tokyo";

const db = getFirestore();

/**
 * 比較ブログ（type: compare）
 *
 * - 毎週 月曜 04:00 JST に実行
 * - 各サイトにつき「3社比較記事」を 1 本ずつ upsert
 *   - slug は `<siteId>-hikaku` 固定
 *   - ＝ 毎回同じURLで内容だけアップデートされる
 */
export const scheduledMonthlyCompare = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("0 4 * * 1") // 毎週 月曜 04:00 JST
  .timeZone(TZ)
  .onRun(async () => {
    const siteIds = await getBlogEnabledSiteIds(db);

    if (!siteIds.length) {
      logger.warn("[monthlyCompare] no blog-enabled sites");
      return;
    }

    const results = await Promise.all(
      siteIds.map((siteId) => createMonthlyCompareForSite(siteId))
    );

    logger.info("[monthlyCompare] finished for all sites", { results });
    return { results };
  });

/** サイトごとに 3社比較記事を1本つくる（同じ月は同じ slug を上書き更新） */
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

  // 🔹 本文生成（blogTemplate_compare.txt を利用）
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
    templateName: "blogTemplate_compare.txt",
    vars: {
      site: {
        id: siteId,
        displayName: siteName,
        domain: `${siteId}.com`, // 必要になったら後でちゃんとしたドメインに
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

  // 🆕 slug はサイトごとに 1 つだけ
  const slug = `${siteId}-hikaku`;

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

  // 既存ドキュメントがあれば createdAt / views / publishedAt を引き継ぐ
  const blogRef = db.collection("blogs").doc(slug);
  const existingSnap = await blogRef.get();

  let createdAt = nowMs;
  let views = 0;
  let publishedAt = nowMs;

  if (existingSnap.exists) {
    const prevCreated = existingSnap.get("createdAt");
    if (typeof prevCreated === "number") {
      createdAt = prevCreated;
    }
    const prevViews = existingSnap.get("views");
    if (typeof prevViews === "number" && prevViews >= 0) {
      views = prevViews;
    }
    const prevPublished = existingSnap.get("publishedAt");
    if (typeof prevPublished === "number") {
      publishedAt = prevPublished;
    }
  }

  // 🔹 サムネイル（比較用）は Unsplash ベースで1枚決める
  const hero = await pickCompareHeroImage({
    siteId,
    siteName,
    seasonKeyword,
    primaryKeyword: targetKeyword,
    services,
  });

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
    createdAt,
    updatedAt: nowMs,
    publishedAt,
    views,
    primaryKeyword: targetKeyword,
    primaryKeywordDocId: picked?.docId ?? null,
    imageUrl: hero.imageUrl,
    imageCredit: hero.imageCredit,
    imageCreditLink: hero.imageCreditLink,
  };

  await blogRef.set(doc, { merge: true });

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

/* ========== サムネイル選定 ========== */

async function pickCompareHeroImage(params: {
  siteId: string;
  siteName: string;
  seasonKeyword: string;
  primaryKeyword: string;
  services: ServiceLite[];
}): Promise<{
  imageUrl: string | null;
  imageCredit: string | null;
  imageCreditLink: string | null;
}> {
  const { siteId, siteName, seasonKeyword, primaryKeyword, services } = params;

  // クエリにサイト名＋季節＋キーワード＋サービス名をざっくり混ぜる
  const serviceNames = services.map((s) => s.name).join(" ");
  const query = [siteId, siteName, seasonKeyword, primaryKeyword, serviceNames]
    .filter((v) => v && v.trim())
    .join(" ");

  const hero = await findUnsplashHero(query || "家電 レンタル 比較");

  if (!hero?.url) {
    return {
      imageUrl: null,
      imageCredit: null,
      imageCreditLink: null,
    };
  }

  return {
    imageUrl: hero.url,
    imageCredit: hero.credit ?? null,
    imageCreditLink: hero.creditLink ?? null,
  };
}

/* ========== ここから下は元のヘルパー ========== */

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
    .filter((line) => line.trim().length > 0)
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

  // 🔽 ここから追加
  offerId: string; // /offers/{offerId} と対応
  blogSlug: string | null; // blogs で最新の service 記事の slug
};

async function pickServices(
  dbInstance: FirebaseFirestore.Firestore,
  siteId: string,
  limit: number
): Promise<ServiceLite[]> {
  const toLite = async (
    d: FirebaseFirestore.QueryDocumentSnapshot
  ): Promise<ServiceLite> => {
    const title = String(d.get("title") ?? "サービス");
    const offerId = d.id; // 🔹 この offers ドキュメントの ID

    const internalSlug = `${siteId}-${String(offerId).replace(
      /[^a-zA-Z0-9:_-]/g,
      ""
    )}`;

    const categories = Array.isArray(d.get("category"))
      ? (d.get("category") as string[])
      : [];

    const badges = Array.isArray(d.get("badges"))
      ? (d.get("badges") as string[])
      : [];

    // 🔹 blogs から「最新の service 記事（offerId一致）」を1件探す
    const blogSnap = await dbInstance
      .collection("blogs")
      .where("siteId", "==", siteId)
      .where("type", "==", "service")
      .where("offerId", "==", offerId)
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();

    const blogSlug = blogSnap.empty
      ? null
      : String(blogSnap.docs[0].get("slug") ?? "") || null;

    return {
      name: title,
      officialUrl: String(d.get("landingUrl") ?? ""),
      affiliateUrl: String(d.get("affiliateUrl") ?? ""),
      categoriesCsv: categories.join(","),
      area: String(d.get("extras.area") ?? d.get("area") ?? "全国"),
      minTerm: String(d.get("extras.minTerm") ?? "30日〜"),
      highlightsCsv: badges.join(","),
      cautionsCsv: "",
      planExamplesCsv: "",
      reviewSummary: "",
      internalSlug,
      feeClarity: "○",
      deliveryNote: "設置・回収に対応",

      // 🔽 追加した2つ
      offerId,
      blogSlug,
    };
  };

  // 1st: siteIdPrimary == siteId
  let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  {
    const snap = await dbInstance
      .collection("offers")
      .where("siteIdPrimary", "==", siteId)
      .where("archived", "==", false)
      .limit(limit)
      .get();
    docs = snap.docs;
  }

  // 2nd: 足りなければ siteIds array-contains siteId
  if (docs.length < limit) {
    const snap = await dbInstance
      .collection("offers")
      .where("siteIds", "array-contains", siteId)
      .where("archived", "==", false)
      .limit(limit * 2)
      .get();
    const seen = new Set(docs.map((d) => d.id));
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        docs.push(d);
        seen.add(d.id);
      }
      if (docs.length >= limit) break;
    }
  }

  // 3rd: まだ足りなければ archived 条件外して穴埋め
  if (docs.length < limit) {
    const snap = await dbInstance
      .collection("offers")
      .where("siteIds", "array-contains", siteId)
      .limit(limit * 2)
      .get();
    const seen = new Set(docs.map((d) => d.id));
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        docs.push(d);
        seen.add(d.id);
      }
      if (docs.length >= limit) break;
    }
  }

  // 🔹 async toLite に合わせて Promise.all で解決
  const liteList = await Promise.all(docs.slice(0, limit).map(toLite));
  return liteList;
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
/**
 * 手動トリガー用 HTTP
 * - blogs: true の全サイトで 3社比較記事（type: compare）を 1 本ずつ生成
 * - slug は compare-<siteId>-YYYYMM 固定（同じ月は上書き）
 */
export const runMonthlyCompareNow = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onRequest(async (_req, res) => {
    try {
      const siteIds = await getBlogEnabledSiteIds(db);

      if (!siteIds.length) {
        logger.warn("[monthlyCompare] HTTP: no blog-enabled sites");
        res.status(200).json({ ok: true, results: [], reason: "no-sites" });
        return;
      }

      const results = await Promise.all(
        siteIds.map((siteId) => createMonthlyCompareForSite(siteId))
      );

      logger.info("[monthlyCompare] HTTP finished for all sites", { results });
      res.status(200).json({ ok: true, results });
    } catch (e) {
      logger.error("[monthlyCompare] HTTP error", e);
      res.status(500).send("error");
    }
  });
