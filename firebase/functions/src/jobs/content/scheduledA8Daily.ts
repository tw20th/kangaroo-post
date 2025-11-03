import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";
import { generateBlogFromOffer } from "./generateBlogFromOffer.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

// 同一オファーの再生成を抑止する日数
const COOL_DOWN_DAYS = Number(process.env.A8_COOLDOWN_DAYS ?? 7);

async function pickOfferForSite(siteId: string): Promise<string | null> {
  // siteIds に含まれる offers から最近更新を優先
  const snap = await db
    .collection("offers")
    .where("siteIds", "array-contains", siteId)
    .where("archived", "==", false)
    .orderBy("updatedAt", "desc")
    .limit(20)
    .get();
  if (snap.empty) return null;

  // 軽いランダムでバラけさせる
  const docs = snap.docs;
  const idx = Math.floor(Math.random() * docs.length);
  return docs[idx].id;
}

async function createA8Post(siteId: string) {
  const offerId = await pickOfferForSite(siteId);
  if (!offerId) return { siteId, slug: null, reason: "no-offer" };

  const recentSince = Date.now() - COOL_DOWN_DAYS * 24 * 60 * 60 * 1000;
  // 直近クールダウン内に同一offerIdが既にあればスキップ
  const existSnap = await db
    .collection("blogs")
    .where("offerId", "==", offerId)
    .where("siteId", "==", siteId)
    .limit(5)
    .get();

  const recentExists = existSnap.docs.some(
    (d) => Number(d.get("createdAt") || 0) > recentSince
  );
  if (recentExists) {
    return { siteId, slug: existSnap.docs[0]?.id ?? null, reason: "cooldown" };
  }

  const out = await generateBlogFromOffer({
    offerId,
    siteId,
    publish: true, // A8は即公開
    dryRun: false,
  });
  return { siteId, slug: out.slug, reason: "created" };
}

/** 朝 06:00 … A8 1本 */
export const scheduledBlogA8_Morning = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .pubsub.schedule("0 6 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    const siteIds = await getBlogEnabledSiteIds(db);
    const results = [];
    for (const siteId of siteIds) results.push(await createA8Post(siteId));
    return { results };
  });

/** 昼 12:00 … A8 1本 */
export const scheduledBlogA8_Noon = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .pubsub.schedule("0 12 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    const siteIds = await getBlogEnabledSiteIds(db);
    const results = [];
    for (const siteId of siteIds) results.push(await createA8Post(siteId));
    return { results };
  });
