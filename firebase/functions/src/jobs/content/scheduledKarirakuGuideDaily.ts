// firebase/functions/src/jobs/content/scheduledKarirakuGuideDaily.ts
/* eslint-disable @typescript-eslint/no-floating-promises */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { findUnsplashHero } from "../../services/unsplash/client.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const SITE_ID = "kariraku";
const SITE_NAME = "Kariraku（カリラク）";

/* ================================
 * Types
 * ================================ */

type PainTopic = {
  id: string;
  topic: string;
  persona: string;
  pain: string;
  compareUrl: string;
  enabled?: boolean;
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

/* ================================
 * helpers
 * ================================ */

function loadPainTopics(): PainTopic[] {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // 1) dist 環境: dist/jobs/content → ../../lib/content
  // 2) src 環境: dist/jobs/content → ../../../src/lib/content
  const candidates = [
    path.resolve(__dirname, "../../lib/content/painTopics_kariraku.json"),
    path.resolve(
      __dirname,
      "../../../src/lib/content/painTopics_kariraku.json"
    ),
  ];

  let jsonPath: string | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      jsonPath = p;
      break;
    }
  }

  if (!jsonPath) {
    console.error(
      "[KarirakuGuide] painTopics_kariraku.json not found in any candidate path",
      { candidates }
    );
    return [];
  }

  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(raw) as PainTopic[];
    return parsed.filter((t) => t.enabled !== false);
  } catch (e) {
    console.error("[KarirakuGuide] failed to load _kariraku.jsopainTopicsn", e);
    return [];
  }
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

function slugify(base: string): string {
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
  const full = `${SITE_ID}-${y}${m}${d}-${core}`;
  return full.slice(0, 80);
}

/** GPT から返ってきた `\n` 文字列を実際の改行に直す */
function sanitizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\\n/g, "\n") // 文字列としての「\n」を改行に
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n"); // 改行が多すぎるところは2つに
}

/* ================================
 * main
 * ================================ */

async function createKarirakuGuideOnce(): Promise<void> {
  const topics = loadPainTopics();
  const picked = pickTopicForToday(topics);
  if (!picked) {
    console.warn("[KarirakuGuide] no pain topics available");
    return;
  }

  // 🔗 比較リンクは今は固定で /compare を使う
  const compareUrl = "/compare";

  const rawBlog = (await generateBlogContent({
    product: { name: picked.topic, asin: "none", tags: [] },
    siteId: SITE_ID,
    siteName: SITE_NAME,
    persona: picked.persona,
    pain: picked.pain,
    templateName: "blogTemplate_kariraku_guide.txt",
    vars: {
      topic: picked.topic,
      compareUrl,
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

  const db = getFirestore();
  const nowTs = Timestamp.now();
  const slug = slugify(title || picked.id);

  await db.collection("blogs").add({
    siteId: SITE_ID,
    painId: picked.id, // 🌟 追加：どの悩みトピックから生まれた記事か
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
  });

  console.log("[KarirakuGuide] blog created", {
    slug,
    title,
    compareUrl,
    painId: picked.id,
  });
}

/**
 * Kariraku 悩み解決ブログ（ガイド系）
 * - scheduledKarirakuGuideDaily: 毎朝 7:00 JST に1本生成
 * - runKarirakuGuideNow: 手動トリガー用 HTTP
 */
export const scheduledKarirakuGuideDaily = functions
  .region(REGION)
  .pubsub.schedule("0 7 * * *") // 毎朝 7:00 JST
  .timeZone(TZ)
  .onRun(async () => {
    await createKarirakuGuideOnce();
  });

export const runKarirakuGuideNow = functions
  .region(REGION)
  .https.onRequest(async (_req, res) => {
    try {
      await createKarirakuGuideOnce();
      res.status(200).send("ok");
    } catch (e) {
      console.error("[KarirakuGuide] HTTP error", e);
      res.status(500).send("error");
    }
  });
