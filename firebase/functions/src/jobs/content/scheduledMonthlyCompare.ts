// firebase/functions/src/jobs/content/scheduledMonthlyCompare.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { generateContentWithTemplate } from "../../utils/generateBlogContent.js";

const REGION = "asia-northeast1";
const TZ = "Asia/Tokyo";
const SITE_ID = process.env.FOCUS_SITE_ID || "kariraku";

export const scheduledMonthlyCompare = functions
  .region(REGION)
  .pubsub.schedule("0 4 1 * *") // 毎月1日 04:00 JST
  .timeZone(TZ)
  .onRun(async () => {
    const db = getFirestore();

    // 3社ピック（siteIdPrimary == SITE_ID）
    const services = await pickServices(db, SITE_ID, 3);
    if (services.length < 3) {
      logger.warn("[monthlyCompare] need >=3 services", {
        found: services.length,
        siteId: SITE_ID,
      });
      return;
    }

    const now = new Date();
    const md = await generateContentWithTemplate(
      "blogTemplate_kariraku_compare.txt",
      {
        site: { id: SITE_ID, displayName: "Kariraku", domain: "kariraku.com" },
        services,
        seasonKeyword: seasonKeywordByMonth(now),
        seasonTag: seasonKeywordByMonth(now),
        dateYYYYMM: yyyymm(now),
        hash8: Math.random().toString(36).slice(2, 10),
      }
    );

    const slug = `compare-${yyyymm(now)}`;
    const title = extractTitle(md);
    const summary = extractSummary(md);

    const doc = {
      slug,
      siteId: SITE_ID,
      title,
      summary,
      content: md,
      status: "published" as const,
      visibility: "public" as const,
      type: "compare" as const,
      tags: sanitizeTags(["家電レンタル", "比較", SITE_ID]),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      publishedAt: Date.now(),
      views: 0,
    };

    await db.collection("blogs").doc(slug).set(doc, { merge: true });
    logger.info("[monthlyCompare] upserted", { slug, title });
  });

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
function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "家電レンタル3社を徹底比較";
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
      area: String(d.get("extras.area") ?? d.get("area") ?? "全国"), // ← ドット記法
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

  // 1st: siteIdPrimary == SITE_ID
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

  // 2nd: 足りなければ siteIds array-contains SITE_ID
  if (docs.length < limit) {
    const snap = await db
      .collection("offers")
      .where("siteIds", "array-contains", siteId)
      .where("archived", "==", false)
      .limit(limit * 2)
      .get();
    // 既出を除外して追加
    const seen = new Set(docs.map((d) => d.id));
    for (const d of snap.docs) {
      if (!seen.has(d.id)) docs.push(d);
      if (docs.length >= limit) break;
    }
  }

  // 3rd: まだ足りなければ archived 条件外して穴埋め（安全のため軽く）
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
