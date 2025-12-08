// firebase/functions/src/jobs/content/scheduledDiscoverDaily.ts
/* eslint-disable @typescript-eslint/no-floating-promises */

import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { findUnsplashHero } from "../../services/unsplash/client.js";
import { pickBestKeywordForSite } from "../../lib/keywords/pickSiteKeyword.js";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";
import {
  getSiteConfig,
  type SiteConfig,
  type SiteProfile,
} from "../../lib/sites/siteConfig.js";
import { getSeasonalContext } from "../../utils/seasonalContext.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

/* ================================
 * Types
 * ================================ */

type GeneratedBlog = {
  title: string;
  excerpt: string | null;
  tags: string[];
  content: string;
  imageUrl?: string | null;
  imageCredit?: string | null;
  imageCreditLink?: string | null;
};

/** Discover 用に「必ず4つ揃う」形にしたプロフィール */
type ResolvedProfile = {
  theme: string;
  reader: string;
  tone: string;
  topic: string;
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

async function getSiteName(siteId: string): Promise<string> {
  // sites コレクション側
  const snap = await db.collection("sites").doc(siteId).get();
  const name = snap.get("displayName");

  if (typeof name === "string" && name) return name;

  // siteConfig 側も見てみる（失敗したら無視）
  try {
    const cfg = await getSiteConfig(siteId);
    if (typeof cfg?.displayName === "string" && cfg.displayName) {
      return cfg.displayName;
    }
  } catch {
    // noop
  }

  return siteId;
}

/** siteConfig.profile + サイト別デフォルト をマージしたプロフィール */
function resolveProfile(
  siteId: string,
  cfg: SiteConfig | null
): ResolvedProfile {
  const base: SiteProfile["discover"] = cfg?.profile?.discover ?? {};

  const defaults: Record<string, ResolvedProfile> = {
    kariraku: {
      theme: "一人暮らしや引越し前後の生活を、家電レンタルで少し軽くする",
      reader:
        "引越し・転勤・一人暮らしを控えていて、初期費用や手間が気になっている人",
      tone: "落ち着いた, 静か, 寄り添う, 生活感のある",
      topic:
        "暮らしの小さな不便やストレスを言葉にして、選び方のヒントをそっと並べる",
    },
    workiroom: {
      theme: "在宅ワークと部屋づくりの悩みを、ガジェットと工夫で整える",
      reader:
        "自宅で仕事をする時間が長くて、体のつらさや集中しづらさを感じている人",
      tone: "落ち着いた, ていねい, すこし知的, フラット",
      topic:
        "作業環境や働き方の小さなつまずきを、空間と道具の視点からほぐしていく",
    },
    hadasmooth: {
      theme: "肌と生活リズムのゆらぎを、無理のないケアで整える",
      reader:
        "肌の調子やスキンケアに迷っていて、情報が多すぎて少し疲れている人",
      tone: "やわらかい, ゆっくり, やさしい, ていねい",
      topic:
        "肌の揺らぎの背景を生活習慣といっしょに見つめ直し、できることを静かに整理する",
    },
  };

  const fallback: ResolvedProfile = defaults[siteId] ?? {
    theme: "暮らしと仕事の小さな悩みを静かに整理する",
    reader: "日々の生活や仕事の中で、少しお疲れ気味の人",
    tone: "落ち着いた, 静か, 寄り添う",
    topic:
      "読者の小さな違和感を言葉にして、選択肢をそっと並べるような記事を書く",
  };

  return {
    theme: base.theme ?? fallback.theme,
    reader: base.reader ?? fallback.reader,
    tone: base.tone ?? fallback.tone,
    topic: base.topic ?? fallback.topic,
  };
}

function slugify(siteId: string, base: string): string {
  const lower = base
    .toLowerCase()
    .replace(/[ぁ-んァ-ン]/g, "")
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, " ")
    .trim();
  const hyphenated = lower.replace(/\s+/g, "-");
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const core = hyphenated || "discover";
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

async function createDiscoverOnceForSite(siteId: string): Promise<void> {
  const siteName = await getSiteName(siteId);
  const siteConfig = await getSiteConfig(siteId);
  const profile = resolveProfile(siteId, siteConfig);

  // 🔹 季節コンテキスト（Discover は常に受け取ってOK）
  const seasonal = getSeasonalContext();

  // ★ Discover 用にもサイトごとのメインオファーを1件ピック
  const offer = await pickPrimaryOfferForSite(siteId, "DiscoverDaily");
  const offerVars = buildOfferVars(offer);

  // 🔹 siteKeywords(intent: "discover") から今日の1本を選ぶ
  const pickedKeyword = await pickBestKeywordForSite({
    siteId,
    intent: "discover",
    avoidHours: 12,
  });

  if (!pickedKeyword) {
    console.warn("[DiscoverDaily] no keyword picked", { siteId });
    return;
  }

  const nowMs = Date.now();

  const targetKeyword =
    pickedKeyword.keyword.trim() ||
    (siteId === "kariraku"
      ? "家電レンタル 買ってよかったもの"
      : "おすすめ ガジェット");

  // Discover は「生活 × ちょっとした便利さ」前提のペルソナ・ペインにする
  const persona = profile.reader;

  const pain =
    siteId === "kariraku"
      ? "買うかどうか悩む家電が多くて、まずは気軽に試したいと感じている"
      : "仕事や暮らしの中で、小さなストレスがじわじわ溜まってしまっている";

  const templateName = "blogTemplate_discover.txt";

  // Discover 用のサブキーワード（ひとまず primaryKeyword 1本を共有）
  const subKeywords: string[] = [targetKeyword];

  const rawBlog = (await generateBlogContent({
    product: {
      name: targetKeyword,
      asin: `discover-${siteId}-${nowMs}`,
      tags: ["おすすめ", "暮らし", "discover", seasonal.keyword].filter(
        (t) => t && t.length > 0
      ),
    },
    siteId,
    siteName,
    persona,
    pain,
    templateName,
    vars: {
      intent: "discover",
      topic: targetKeyword,
      compareUrl: siteId === "kariraku" ? "/compare" : "/blog",
      primaryKeyword: targetKeyword,
      subKeywords,

      siteTheme: profile.theme,
      siteReader: profile.reader,
      siteTone: profile.tone,
      siteTopic: profile.topic,

      seasonKeyword: seasonal.keyword,
      seasonLabel: seasonal.label,
      seasonDescription: seasonal.description,

      // ★ ここで offer を渡す
      ...offerVars,
    },
  })) as GeneratedBlog;

  // 改行など整形
  const title = sanitizeText(rawBlog.title);
  const content = sanitizeText(rawBlog.content);
  const excerpt =
    rawBlog.excerpt !== null ? sanitizeText(rawBlog.excerpt) : null;

  // 🔹 タグ + 季節キーワードをマージ（重複は除く）
  const baseTags = rawBlog.tags ?? [];
  const tags = Array.from(
    new Set(
      [...baseTags, seasonal.keyword].filter((t) => t && t.trim().length > 0)
    )
  );

  // Unsplash 画像（なければ補完）
  let imageUrl: string | null = rawBlog.imageUrl ?? null;
  let imageCredit: string | null = rawBlog.imageCredit ?? null;
  let imageCreditLink: string | null = rawBlog.imageCreditLink ?? null;

  if (!imageUrl) {
    const hero = await findUnsplashHero(title || targetKeyword);
    if (hero) {
      imageUrl = hero.url;
      imageCredit = hero.credit ?? null;
      imageCreditLink = hero.creditLink ?? null;
    }
  }

  const nowTs = Timestamp.fromMillis(nowMs);
  const slug = slugify(siteId, title || targetKeyword);

  await db.collection("blogs").add({
    siteId,
    title,
    content,
    excerpt,
    tags,
    slug,
    type: "discover",
    status: "published",
    imageUrl,
    imageCredit,
    imageCreditLink,
    createdAt: nowTs,
    updatedAt: nowTs,
    publishedAt: nowTs,
    primaryKeyword: targetKeyword,
    primaryKeywordDocId: pickedKeyword.docId,

    // ★ 追加
    primaryOfferId: offer?.id ?? null,
    offerIds: offer ? [offer.id] : [],
  });

  // 🔹 siteKeywords 側に利用履歴を反映
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

  console.log("[DiscoverDaily] blog created", {
    siteId,
    slug,
    title,
    targetKeyword,
  });
}

/* ================================
 * sched / HTTP entrypoints
 * ================================ */

/**
 * Discover 向けおすすめ記事（マルチサイト版）
 * - blogs: true の全サイトで 1 本ずつ生成
 */
export const scheduledDiscoverDaily = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 300,
  })
  .pubsub.schedule("0 9 * * *") // 毎朝 09:00 JST
  .timeZone(TZ)
  .onRun(async () => {
    const siteIds = await getBlogEnabledSiteIds(db);
    console.log("[DiscoverDaily] start scheduled run", { siteIds });

    if (!siteIds.length) {
      console.warn("[DiscoverDaily] no blog-enabled sites");
      return;
    }

    for (const siteId of siteIds) {
      // eslint-disable-next-line no-await-in-loop
      await createDiscoverOnceForSite(siteId);
    }
  });

/**
 * 手動トリガー用 HTTP
 */
export const runDiscoverDailyNow = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 300,
  })
  .https.onRequest(async (_req, res) => {
    try {
      const siteIds = await getBlogEnabledSiteIds(db);
      const results: { siteId: string }[] = [];

      for (const siteId of siteIds) {
        // eslint-disable-next-line no-await-in-loop
        await createDiscoverOnceForSite(siteId);
        results.push({ siteId });
      }

      res.status(200).json({ ok: true, results });
    } catch (e) {
      console.error("[DiscoverDaily] HTTP error", e);
      res.status(500).send("error");
    }
  });
