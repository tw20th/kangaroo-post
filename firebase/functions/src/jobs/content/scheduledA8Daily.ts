// firebase/functions/src/jobs/content/scheduledA8Daily.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";
import { getSiteConfig } from "../../lib/sites/siteConfig.js";
import { generateBlogFromOffer } from "./generateBlogFromOffer.js";
import { pickBestKeywordForSite } from "../../lib/keywords/pickBestKeywordForSite.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

// 同一オファーの再生成を抑止する日数（env: A8_COOLDOWN_DAYS）
const COOL_DOWN_DAYS = Number(process.env.A8_COOLDOWN_DAYS ?? 0);

/**
 * 3日に1回だけ true にする簡易ロジック
 * 例: 1,4,7,10,... 日だけ実行
 */
function shouldRunTodayJST(): boolean {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = nowJst.getDate();
  return (day - 1) % 3 === 0;
}

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
  if (!offerId) return { siteId, slug: null, reason: "no-offer" as const };

  const nowMs = Date.now();
  const recentSince = nowMs - COOL_DOWN_DAYS * 24 * 60 * 60 * 1000;

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
    return {
      siteId,
      slug: existSnap.docs[0]?.id ?? null,
      reason: "cooldown" as const,
    };
  }

  // 🔹 ここで「service 用キーワード」を siteKeywords から1つ選ぶ
  const pickedKeyword = await pickBestKeywordForSite({
    siteId,
    intent: "service",
  });

  const targetKeyword = pickedKeyword?.keyword?.trim() ?? "";

  // 🔹 サイトごとのテンプレIDを siteConfig から取得
  // sites/<siteId>.json に例えば:
  // "blogTemplates": { "service": "kariraku_service" }
  // があればそれを優先し、なければ従来どおりのデフォルトにフォールバック
  const siteConfig = await getSiteConfig(siteId);
  const templateIdFromSite =
    siteConfig?.blogTemplates?.service ??
    (siteId === "kariraku" ? ("kariraku_service" as const) : ("a8" as const));

  const out = await generateBlogFromOffer({
    offerId,
    siteId,
    publish: true,
    dryRun: false,
    // ◆ intent / keyword / templateId を渡して「キーワード記事化」
    intent: "service",
    // TemplateId は generateBlogFromOffer.ts 側の union 型なので、
    // ここでは文字列をそのまま流しつつ型だけ合わせる
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    templateId: templateIdFromSite as any,
    keyword: targetKeyword || undefined,
  });

  const slug = out.slug;

  // 🔹 キーワードを使えた場合、siteKeywords に利用履歴を書き込む
  if (pickedKeyword) {
    const kwRef = db.collection("siteKeywords").doc(pickedKeyword.id);
    const prev = pickedKeyword;

    await kwRef.set(
      {
        usedCount: (prev.usedCount ?? 0) + 1,
        lastUsedAt: nowMs,
        lastBlogSlug: slug,
        lastOfferId: offerId,
        updatedAt: nowMs,
      },
      { merge: true }
    );
  }

  return {
    siteId,
    slug,
    reason: "created" as const,
    keyword: targetKeyword || null,
  };
}

/**
 * 朝 06:00 … A8商品紹介（3日に1回）
 * - sites コレクションに blogEnabled なサイトが増えれば、自動で対象が増える
 */
export const scheduledBlogA8_Morning = functions
  .region(REGION)
  .runWith({
    secrets: ["OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"],
    timeoutSeconds: 300, // ← タイムアウト対策（最大5分に延長）
  })
  .pubsub.schedule("0 6 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    if (!shouldRunTodayJST()) {
      functions.logger.info(
        "[scheduledBlogA8_Morning] skip: not in 3-day cycle"
      );
      return { skipped: true, reason: "3-day-cycle" };
    }

    const siteIds = await getBlogEnabledSiteIds(db);
    const results = [];

    for (const sId of siteIds) {
      // サイトごとに1本ずつ生成
      // eslint-disable-next-line no-await-in-loop
      const result = await createA8Post(sId);
      results.push(result);
    }

    functions.logger.info("[scheduledBlogA8_Morning] finished", { results });
    return { results };
  });

/**
 * 手動トリガー用エンドポイント
 * ※ 管理画面やローカル検証から叩く想定
 */
export const runA8DailyNow = functions
  .region(REGION)
  .runWith({
    secrets: ["OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"],
    timeoutSeconds: 300, // 手動実行時も余裕を持たせる
  })
  .https.onRequest(async (_req, res) => {
    try {
      const siteIds = await getBlogEnabledSiteIds(db);
      const results = [];

      for (const sId of siteIds) {
        // eslint-disable-next-line no-await-in-loop
        const result = await createA8Post(sId);
        results.push(result);
      }

      res.json({ ok: true, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
