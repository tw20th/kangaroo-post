// firebase/functions/src/jobs/content/generateDailyBlog.ts
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { generateContentWithTemplate } from "../../utils/generateBlogContent.js";
import { makeDailySlug } from "../../lib/slug/daily.js";

type DailyService = {
  name: string;
  slug: string;
  affiliateUrl: string;
  oneLiner: string;
};

export async function generateDailyPost(opts: {
  siteId: string;
  seasonKeyword: string;
  trendingCategoriesCsv: string;
  topClicksTitlesCsv?: string;
  priceDropsNote?: string;
  compareSlug: string;
  services: DailyService[];
  publish?: boolean; // default: false
}) {
  const {
    siteId,
    seasonKeyword,
    trendingCategoriesCsv,
    topClicksTitlesCsv = "",
    priceDropsNote = "",
    compareSlug,
    services,
    publish = false,
  } = opts;

  const db = getFirestore();
  const now = new Date();
  const slug = makeDailySlug(siteId, now);

  // 既存ならスキップ（同日重複防止）
  const exist = await db.collection("blogs").doc(slug).get();
  if (exist.exists) {
    logger.info(`generateDailyPost: already exists blogs/${slug}`);
    return { slug, existed: true };
  }

  const vars = {
    dateISO: now.toISOString(),
    seasonKeyword,
    trendingCategoriesCsv,
    topClicksTitlesCsv,
    priceDropsNote,
    compareSlug,
    services,
    seasonTag: seasonKeyword,
    site: { displayName: "Kariraku" },
  };

  const md = await generateContentWithTemplate(
    "blogTemplate_kariraku_daily.txt",
    vars
  );

  const doc = {
    slug,
    siteId,
    title: extractTitle(md),
    summary: extractSummary(md),
    content: md,
    imageUrl: null as string | null,
    status: publish ? "published" : "draft",
    visibility: "public" as const,
    type: "daily" as const,
    tags: ["デイリー", seasonKeyword, "Kariraku"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    views: 0,
  };

  await db.collection("blogs").doc(slug).set(doc, { merge: true });
  logger.info(`generateDailyPost: created blogs/${slug}`);
  return { slug };
}

/* --- tiny helpers --- */
function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "今日の注目トピック";
}
function extractSummary(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n").filter(Boolean);
  const text = lines
    .slice(0, 30)
    .join(" ")
    .replace(/[#>*_`]/g, "");
  return text.slice(0, 120);
}
