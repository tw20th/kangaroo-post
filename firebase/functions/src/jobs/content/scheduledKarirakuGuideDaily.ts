// firebase/functions/src/jobs/content/scheduledKarirakuGuideDaily.ts
/* eslint-disable @typescript-eslint/no-floating-promises */

import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { findUnsplashHero } from "../../services/unsplash/client.js";
import { pickBestKeywordForSite } from "../../lib/keywords/pickSiteKeyword.js";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";
import { getSeasonalContext } from "../../utils/seasonalContext.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

/* ================================
 * Types
 * ================================ */

type PainTopic = {
  id: string;
  /** 記事のテーマとして使うラベル（見出しなど） */
  topic: string;
  /** 元の painRules.label 相当（なければ topic） */
  label: string;
  persona: string;
  /** 説明的な悩みテキスト */
  pain: string;
  compareUrl: string;
  enabled?: boolean;
  /** 関連キーワード（subKeywords 用） */
  keywords: string[];
};

type GeneratedBlog = {
  title: string;
  excerpt: string | null;
  tags: string[];
  content: string;
  imageUrl?: string | null;
  imageCredit?: string | null;
  imageCreditLink?: string | null;
};

type RawPainRule = {
  id?: string;
  label?: string;
  topic?: string;
  persona?: string;
  pain?: string;
  compareUrl?: string;
  enabled?: boolean;
  keywords?: unknown;
};

type OfferLite = {
  id: string;
  title: string;
  affiliateUrl: string;
  highlightLabel?: string;
  targetUsers: string[];
  strengths: string[];
};

async function pickPrimaryOfferForSite(
  siteId: string,
  logPrefix: string
): Promise<OfferLite | null> {
  const snap = await db
    .collection("offers")
    .where("siteIds", "array-contains", siteId)
    .where("status", "==", "active")
    .limit(1) // ← とりあえず1件だけ。順番はランダムでOK
    .get();

  if (snap.empty) {
    console.warn(`[${logPrefix}] no offers for site`, { siteId });
    return null;
  }

  const doc = snap.docs[0];
  const data = doc.data() as {
    title?: unknown;
    affiliateUrl?: unknown;
    highlightLabel?: unknown;
    targetUsers?: unknown;
    strengths?: unknown;
  };

  const title =
    typeof data.title === "string" && data.title.trim().length > 0
      ? data.title.trim()
      : doc.id;

  const affiliateUrl =
    typeof data.affiliateUrl === "string" ? data.affiliateUrl : "";

  if (!affiliateUrl) {
    console.warn(`[${logPrefix}] offer missing affiliateUrl`, {
      siteId,
      id: doc.id,
    });
  }

  const targetUsers =
    Array.isArray(data.targetUsers) && data.targetUsers.length > 0
      ? (data.targetUsers.filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0
        ) as string[])
      : [];

  const strengths =
    Array.isArray(data.strengths) && data.strengths.length > 0
      ? (data.strengths.filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0
        ) as string[])
      : [];

  const highlightLabel =
    typeof data.highlightLabel === "string" && data.highlightLabel.trim()
      ? data.highlightLabel.trim()
      : undefined;

  return {
    id: doc.id,
    title,
    affiliateUrl,
    highlightLabel,
    targetUsers,
    strengths,
  };
}

function buildOfferVars(offer: OfferLite | null): Record<string, unknown> {
  if (!offer) return {};
  return {
    offer: {
      id: offer.id,
      title: offer.title,
      affiliateUrl: offer.affiliateUrl,
      highlightLabel: offer.highlightLabel ?? "",
      targetUsers: offer.targetUsers,
      strengths: offer.strengths,
    },
  };
}

/* ================================
 * helpers
 * ================================ */

/** sites/{siteId}.displayName を取得（なければ siteId を返す） */
async function getSiteName(siteId: string): Promise<string> {
  const snap = await db.collection("sites").doc(siteId).get();
  const name = snap.get("displayName");
  return (typeof name === "string" && name) || siteId;
}

/** Firestore の sites/{siteId}.painRules から「悩みトピック」を組み立てる */
async function loadPainTopicsForSite(siteId: string): Promise<PainTopic[]> {
  const snap = await db.collection("sites").doc(siteId).get();
  if (!snap.exists) {
    console.warn("[GuideDaily] site doc not found", { siteId });
    return [];
  }

  const raw = (snap.get("painRules") as RawPainRule[] | undefined) ?? [];
  if (!Array.isArray(raw) || raw.length === 0) {
    console.warn("[GuideDaily] no painRules on site", { siteId });
    return [];
  }

  const defaultPersona =
    siteId === "workiroom"
      ? "在宅ワークで小さな不便やモヤモヤを抱えている人"
      : "サービス選びや日々の暮らしに悩みを抱えている人";

  const defaultPain =
    siteId === "workiroom"
      ? "仕事や生活の小さなストレスが積み重なって、なんとなく疲れてしまっている"
      : "どのサービスや選び方がいいか分からず、モヤモヤしている";

  const defaultCompareUrl = siteId === "kariraku" ? "/compare" : "/blog";

  return raw
    .filter((r) => r && r.enabled !== false)
    .map((r, idx): PainTopic => {
      const topic = r.topic || r.label || "お悩みガイド";
      const label = r.label || topic;

      const keywordsRaw = r.keywords;
      const keywords: string[] = Array.isArray(keywordsRaw)
        ? (keywordsRaw as unknown[])
            .map((k) => (typeof k === "string" ? k.trim() : ""))
            .filter((k) => k.length > 0)
        : [];

      return {
        id: r.id || `rule-${idx}`,
        topic,
        label,
        persona: r.persona || defaultPersona,
        pain: r.pain || r.label || r.topic || defaultPain,
        compareUrl: r.compareUrl || defaultCompareUrl,
        enabled: r.enabled,
        keywords,
      };
    });
}

function pickTopicForToday(topics: PainTopic[]): PainTopic | null {
  if (topics.length === 0) return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const seed = y * 10000 + m * 100 + d;
  const idx = seed % topics.length;
  return topics[idx];
}

function slugify(siteId: string, base: string): string {
  const lower = base
    .toLowerCase()
    .replace(/[ぁ-んァ-ン]/g, "") // ひらがな・カタカナは一旦削る
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, " ") // 記号類をスペースに
    .trim();
  const hyphenated = lower.replace(/\s+/g, "-");
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const core = hyphenated || "guide";
  const full = `${siteId}-${y}${m}${d}-${core}`;
  return full.slice(0, 80);
}

/** GPT から返ってきた `\n` 文字列を実際の改行に直す */
function sanitizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/* ================================
 * main (サイト単位)
 * ================================ */

async function createGuideOnceForSite(siteId: string): Promise<void> {
  const siteName = await getSiteName(siteId);
  const topics = await loadPainTopicsForSite(siteId);

  if (!topics.length) {
    console.warn("[GuideDaily] no pain topics available", { siteId });
    return;
  }

  const seasonal = getSeasonalContext();
  const nowMs = Date.now();

  const offer = await pickPrimaryOfferForSite(siteId, "GuideDaily");
  const offerVars = buildOfferVars(offer);

  // 🔹 まず siteKeywords(intent: "guide") から今日の1本を選ぶ
  const pickedKeyword = await pickBestKeywordForSite({
    siteId,
    intent: "guide",
    avoidHours: 12,
  });

  // 🔹 キーワードに近い painTopic があればそれを優先
  let picked: PainTopic | null = null;
  if (pickedKeyword?.keyword) {
    const kw = pickedKeyword.keyword;
    picked =
      topics.find((t) => t.topic.includes(kw)) ||
      topics.find((t) => kw.includes(t.topic)) ||
      null;
  }

  // 🔹 マッチしなければ、従来どおり「日付ベースのローテーション」
  if (!picked) {
    picked = pickTopicForToday(topics);
  }

  if (!picked) {
    console.warn("[GuideDaily] no topic picked", { siteId });
    return;
  }

  const defaultKeyword =
    siteId === "kariraku" ? "家電レンタル 悩み" : "ガジェット 悩み";

  const targetKeyword =
    pickedKeyword?.keyword?.trim() || picked.topic || defaultKeyword;

  // 🔗 比較リンク（サイトごとにざっくり出し分け）
  const compareUrl = siteId === "kariraku" ? "/compare" : "/blog";

  // subKeywords: painRules.keywords があればそれを、なければ primaryKeyword を1つだけ
  const subKeywords: string[] =
    picked.keywords.length > 0 ? picked.keywords : [targetKeyword];

  const rawBlog = (await generateBlogContent({
    product: { name: picked.topic, asin: "none", tags: [] },
    siteId,
    siteName,
    persona: picked.persona,
    pain: picked.pain,
    templateName: "blogTemplate_painGuide.txt",
    vars: {
      intent: "guide",
      topic: picked.topic,
      compareUrl,
      primaryKeyword: targetKeyword,
      seasonKeyword: seasonal.keyword,
      pain: {
        id: picked.id,
        label: picked.label,
        description: picked.pain,
        keywords: picked.keywords,
      },
      subKeywords,
      // ★ ここで offer 情報をテンプレに渡す
      ...offerVars,
    },
  })) as GeneratedBlog;

  // 改行コードなどをサニタイズ
  const title = sanitizeText(rawBlog.title);
  const content = sanitizeText(rawBlog.content);
  const excerpt =
    rawBlog.excerpt !== null ? sanitizeText(rawBlog.excerpt) : null;
  const tags = rawBlog.tags ?? [];

  // Unsplash 画像（GPT 側で imageUrl 指定が無ければこちらで補う）
  let imageUrl: string | null = rawBlog.imageUrl ?? null;
  let imageCredit: string | null = rawBlog.imageCredit ?? null;
  let imageCreditLink: string | null = rawBlog.imageCreditLink ?? null;

  if (!imageUrl) {
    const hero = await findUnsplashHero(title || picked.topic);
    if (hero) {
      imageUrl = hero.url;
      imageCredit = hero.credit ?? null;
      imageCreditLink = hero.creditLink ?? null;
    }
  }

  const nowTs = Timestamp.fromMillis(nowMs);
  const slug = slugify(siteId, title || picked.id);

  await db.collection("blogs").add({
    siteId,
    painId: picked.id,
    title,
    content,
    excerpt,
    tags,
    slug,
    type: "guide",
    status: "published",
    imageUrl,
    imageCredit,
    imageCreditLink,
    createdAt: nowTs,
    updatedAt: nowTs,
    publishedAt: nowTs,
    primaryKeyword: targetKeyword,
    primaryKeywordDocId: pickedKeyword ? pickedKeyword.docId : null,

    // ★ ここから追加
    primaryOfferId: offer?.id ?? null,
    offerIds: offer ? [offer.id] : [],
  });

  // 🔹 使ったキーワードがあれば、siteKeywords 側の統計も更新
  if (pickedKeyword) {
    const kwRef = db.collection("siteKeywords").doc(pickedKeyword.docId);
    const prev = pickedKeyword.raw;

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

  console.log("[GuideDaily] blog created", {
    siteId,
    slug,
    title,
    compareUrl,
    painId: picked.id,
    targetKeyword,
  });
}

// ===============================
// sched / HTTP エントリ
// ===============================

/**
 * 悩み解決ブログ（ガイド系、マルチサイト版）
 * - blogs: true の全サイトで 1 本ずつ生成
 */
export const scheduledKarirakuGuideDaily = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 300, // ★ 60秒 → 300秒 に延長（最大 540 まで可）
  })
  .pubsub.schedule("0 7 * * *") // 毎朝 7:00 JST
  .timeZone(TZ)
  .onRun(async () => {
    const siteIds = await getBlogEnabledSiteIds(db);
    console.log("[GuideDaily] start scheduled run", { siteIds });

    if (!siteIds.length) {
      console.warn("[GuideDaily] no blog-enabled sites");
      return;
    }

    for (const siteId of siteIds) {
      console.log("[GuideDaily] start site", { siteId });
      // eslint-disable-next-line no-await-in-loop
      await createGuideOnceForSite(siteId);
      console.log("[GuideDaily] done site", { siteId });
    }
  });

/**
 * 手動トリガー用 HTTP
 * - blogs: true の全サイトで 1 本ずつ生成
 */
export const runKarirakuGuideNow = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 300,
  })
  .https.onRequest(async (_req, res) => {
    try {
      const siteIds = await getBlogEnabledSiteIds(db);
      console.log("[GuideDaily] HTTP run", { siteIds });

      const results: { siteId: string }[] = [];

      for (const siteId of siteIds) {
        // eslint-disable-next-line no-await-in-loop
        await createGuideOnceForSite(siteId);
        results.push({ siteId });
      }

      res.status(200).json({ ok: true, results });
    } catch (e) {
      console.error("[GuideDaily] HTTP error", e);
      res.status(500).send("error");
    }
  });
