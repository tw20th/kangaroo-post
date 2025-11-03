// firebase/functions/src/jobs/content/scheduledBlogDaily.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAI } from "../../lib/infra/openai.js";
import {
  appendPainCTASection,
  buildMorningMessages,
  buildNoonMessages,
} from "../../lib/content/prompts/blogPrompts.js";

// monitoredItems ベースのピッカー
import {
  pickHotCandidate,
  pickRecentUpdated,
  pickRecentCreated,
} from "../../lib/pickers/monitored.js";
import { dailySlug } from "../../lib/slug/daily.js";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";

// 画像フォールバック（Unsplash）
import { findUnsplashHero } from "../../services/unsplash/client.js";

// A8オファー→記事化
import { generateBlogFromOffer } from "./generateBlogFromOffer.js";

const REGION = "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();
const openai = () => getOpenAI();

// 環境変数で daily の公開/下書きを切替（既定は draft）
const DAILY_PUBLISH =
  String(process.env.DAILY_PUBLISH || "").toLowerCase() === "true";

type MonitoredItemLite = {
  productId?: string;
  productName?: string;
  name?: string;
  imageUrl?: string | null;
  category?: string | null;
};

async function generateDaily(siteId: string, mode: "morning" | "noon") {
  // 1) 候補選定（ホット→更新順/作成順フォールバック）
  let cand = await pickHotCandidate(siteId, db);
  if (!cand) {
    cand =
      mode === "morning"
        ? await pickRecentUpdated(siteId, db)
        : await pickRecentCreated(siteId, db);
  }
  if (!cand) return { siteId, created: 0 };

  const p = cand.data() as MonitoredItemLite;
  const productKey = p.productId ?? cand.id;
  const productName = p.productName ?? p.name ?? "(no name)";
  const titleBase = mode === "morning" ? "値下げ情報" : "レビューまとめ";
  const mdBuilder =
    mode === "morning" ? buildMorningMessages : buildNoonMessages;

  // ★ “日付入り” スラッグで上書きを防止（同じ商品でも毎日別ID）
  const now = new Date();
  const slug = dailySlug(siteId, productKey, now);

  // 同日の重複だけをスキップ（翌日は作成される）
  if ((await db.collection("blogs").doc(slug).get()).exists) {
    return { siteId, created: 0 };
  }

  // 2) 生成
  const { sys, user } = await mdBuilder({
    siteId,
    asin: productKey,
    productName,
  });

  const resp = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.35,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  const raw =
    resp.choices[0]?.message?.content?.trim() ||
    `# ${productName} ${titleBase}`;
  const content = await appendPainCTASection(siteId, raw);

  // 3) 画像（monitored.image → Unsplash）
  let heroImageUrl: string | null = p.imageUrl ?? null;
  let imageCredit: string | null = null;
  let imageCreditLink: string | null = null;

  if (!heroImageUrl) {
    const hero = await findUnsplashHero(`${siteId} ${productName}`);
    if (hero?.url) {
      heroImageUrl = hero.url;
      imageCredit = hero.credit || null;
      imageCreditLink = hero.creditLink || null;
    }
  }

  // 4) 保存
  const nowMs = Date.now();
  await db
    .collection("blogs")
    .doc(slug)
    .set(
      {
        slug,
        siteId,
        status: DAILY_PUBLISH ? "published" : "draft",
        title: `${productName} ${titleBase}`,
        summary: null,
        content,
        imageUrl: heroImageUrl,
        imageCredit: imageCredit || null,
        imageCreditLink: imageCreditLink || null,
        tags: [
          mode === "morning" ? "値下げ" : "レビュー",
          p.category ?? "misc",
        ],
        relatedAsin: productKey,
        createdAt: nowMs,
        updatedAt: nowMs,
        ...(DAILY_PUBLISH ? { publishedAt: nowMs } : {}),
        views: 0,
        type: "daily",
        visibility: "public",
      },
      { merge: true }
    );

  return { siteId, created: 1, slug };
}

/* ================= スケジュール ================= */

/** 朝 6:00 … デイリー① */
export const scheduledBlogMorning = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"] })
  .pubsub.schedule("0 6 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    const ids = await getBlogEnabledSiteIds(db);
    const results = [];
    for (const id of ids) results.push(await generateDaily(id, "morning"));
    return { results };
  });

/** 正午 12:00 … A8オファーから1本（公開） */
export const scheduledBlogNoon = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"] })
  .pubsub.schedule("0 12 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    const siteIds = await getBlogEnabledSiteIds(db);
    const results: Array<{ siteId: string; slug?: string | null }> = [];

    for (const siteId of siteIds) {
      const offerId = await pickOfferForSite(siteId);
      if (!offerId) {
        results.push({ siteId, slug: null });
        continue;
      }

      // ★ 同一オファーでも “直近7日以内に作ってたらスキップ”、7日過ぎたら再作成OK
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const existSnap = await db
        .collection("blogs")
        .where("offerId", "==", offerId)
        .where("siteId", "==", siteId)
        .limit(5) // orderBy不要（インデックス回避）、複数拾って確認
        .get();

      const recentExists = existSnap.docs.some(
        (d) => Number(d.get("createdAt") || 0) > sevenDaysAgo
      );

      if (recentExists) {
        // 直近分があれば “作らない” だけ返す
        results.push({ siteId, slug: existSnap.docs[0]?.id ?? null });
        continue;
      }

      const out = await generateBlogFromOffer({
        offerId,
        siteId,
        dryRun: false,
      });
      results.push({ siteId, slug: out.slug });
    }

    return { results };
  });

/** 夕方 18:00 … デイリー② */
export const scheduledBlogEvening = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"] })
  .pubsub.schedule("0 18 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    const ids = await getBlogEnabledSiteIds(db);
    const results = [];
    for (const id of ids) results.push(await generateDaily(id, "noon"));
    return { results };
  });

/** 検証用 HTTP トリガ */
export const runBlogDailyNow = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"] })
  .https.onRequest(async (req, res) => {
    const siteId = String(req.query.siteId || "");
    const mode = String(req.query.mode || "morning") as "morning" | "noon";
    if (!siteId) {
      res.status(400).json({ ok: false, error: "siteId required" });
      return;
    }
    const out = await generateDaily(siteId, mode);
    res.json({ ok: true, ...out });
  });

/* ================= helpers ================= */

async function pickOfferForSite(siteId: string): Promise<string | null> {
  // siteIds 配列に含まれる offers の中から、最近更新されたものを優先
  const snap = await db
    .collection("offers")
    .where("siteIds", "array-contains", siteId)
    .where("archived", "==", false)
    .orderBy("updatedAt", "desc")
    .limit(20)
    .get();

  if (snap.empty) return null;
  // なるべくバラけるよう軽いランダム
  const docs = snap.docs;
  const idx = Math.floor(Math.random() * docs.length);
  return docs[idx].id;
}
