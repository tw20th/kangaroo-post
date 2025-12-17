// firebase/functions/src/jobs/content/generateBlogFromOffer.ts
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/logger";
import { serviceBlogSlug } from "../../lib/slug/a8.js";
import { getSiteConfig } from "../../lib/sites/siteConfig.js";
import { findUnsplashHero } from "../../services/unsplash/client.js";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { stripPlaceholders } from "../../utils/markdown.js";
import { getSeasonalContext } from "../../utils/seasonalContext.js";
import {
  pickBestKeywordForSite,
  type IntentId as KeywordIntentId,
} from "../../lib/keywords/pickSiteKeyword.js";

/* ========= Types ========= */
type Creative =
  | { materialId: string; type: "text"; label?: string; href: string }
  | {
      materialId: string;
      type: "banner";
      label?: string;
      size?: string;
      href: string;
      imgSrc?: string;
    };

type OfferDoc = {
  title: string;
  programId: string;
  siteIds?: string[];
  siteIdPrimary?: string;
  landingUrl?: string;
  affiliateUrl?: string;
  imageUrl?: string | null;
  heroImage?: string | null;
  images?: string[];
  badges?: string[];
  tags?: string[];
  description?: string;
  category?: string[] | null;
  archived?: boolean;

  // ★ ここを追加
  profile?: {
    companyType?: "living" | "gadget" | "trial";
    // それ以外の任意フィールドも通す
    [key: string]: unknown;
  };

  extras?: {
    areas?: string[];
    fees?: Record<string, unknown>;
    payment?: string[];
    deliveryDays?: string[];
    timeSlot?: string;
    area?: string;
    minTerm?: string;
    pickupNote?: string;
    setupNote?: string;
  };
  planType?: "subscription" | "product" | "trial";
  creatives?: Creative[];
  updatedAt?: number;
  price?: number | null;
};
type ProgramDoc = {
  advertiser?: string;
  officialUrl?: string;
};

type ServiceLite = {
  name: string;
  slug: string;
  affiliateUrl: string;
  oneLiner: string;
};

/* ========= Angle (variant) spec ========= */

type VariantId =
  | "case-study"
  | "price-first"
  | "faq-heavy"
  | "pros-cons"
  | "speed-setup"
  | "safety-trust";

type AngleSpec = { h1Prefix?: string; rules: string[]; modules: string[] };

const ANGLES: Record<VariantId, AngleSpec> = {
  "case-study": {
    h1Prefix: "【実体験あり】",
    rules: [
      "冒頭は“誰の体験/状況/結果”を3文で",
      "注意点と回避策を明確に",
      "広告表記は冒頭直後に配置",
    ],
    modules: ["prosCons", "caution", "priceTable", "faq"],
  },
  "price-first": {
    rules: [
      "リードで料金と総額の目安を先に提示",
      "比較表（最低3社）は必須",
      "料金系FAQを入れる",
    ],
    modules: ["priceTable", "compareTable", "faq"],
  },
  "faq-heavy": {
    rules: [
      "FAQを10問前後で不安を先に潰す",
      "途中解約/設置/故障/支払いは必ず含む",
      "要約→詳細→FAQの順で構成",
    ],
    modules: ["faq", "caution", "prosCons"],
  },
  "pros-cons": {
    rules: [
      "Pros/Consは対比で3〜5項目ずつ、料金・手間・安心感など観点を分けて整理する",
      "各項目に1文の根拠を添え、『買った方が良いケース』や『レンタルが向かないケース』にも必ず触れる",
      "最後に向く人/向かない人を中立的にまとめ、読者が自分で選べるようにする",
    ],
    modules: ["prosCons", "whoFit", "faq"],
  },
  "speed-setup": {
    rules: [
      "申込み→設置→回収までのリードタイムを明記",
      "“最短何日で使えるか”を強調",
      "時期・地域差の注意点を入れる",
    ],
    modules: ["setupFlow", "faq"],
  },
  "safety-trust": {
    rules: [
      "故障対応/交換/連絡手段を明記",
      "実例を1つ（可能な限り一般化）",
      "“安心条件”チェックリストを入れる",
    ],
    modules: ["support", "caution", "faq"],
  },
};

function angleNotes(variantId: VariantId = "pros-cons") {
  const spec = ANGLES[variantId];
  const h1Prefix = spec.h1Prefix ?? "";
  const noteText =
    `【執筆角度: ${variantId}】\n` +
    spec.rules.map((r, i) => `- ${i + 1}. ${r}`).join("\n");
  return { h1Prefix, noteText, modules: spec.modules };
}

/* ========= Template resolver ========= */

type IntentId = "service" | "compare" | "guide";
type TemplateId =
  | "kariraku_service"
  | "kariraku_compare"
  | "kariraku_daily"
  | "a8";

/**
 * オファー起点の記事で使うテンプレート名を決定する
 * - intent ごとに汎用テンプレへマッピング
 * - templateId は将来の拡張用だが、現状は intent 優先で扱う
 */
function resolveTemplateNameForOffer(params: {
  siteId: string;
  intent: IntentId;
  templateId?: TemplateId;
}): string {
  const { intent, templateId } = params;

  // 1) templateId の種類でざっくり振り分け
  if (templateId === "kariraku_compare") {
    return "blogTemplate_compare.txt";
  }
  if (templateId === "kariraku_daily") {
    return "blogTemplate_painGuide.txt";
  }
  if (templateId === "kariraku_service" || templateId === "a8") {
    return "blogTemplate_companyIntro.txt";
  }

  // 2) intent ごとのデフォルト
  if (intent === "compare") {
    return "blogTemplate_compare.txt";
  }
  if (intent === "guide") {
    return "blogTemplate_painGuide.txt";
  }

  // 3) デフォルト（サービス紹介）
  return "blogTemplate_companyIntro.txt";
}

/* ========= Helpers ========= */

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9:_-]/g, "");
}

async function pickLatestCompareSlug(
  db: Firestore,
  siteId: string
): Promise<string> {
  // まずは固定 slug を見る（{siteId}-hikaku）
  const fixed = `${siteId}-hikaku`;
  const fixedSnap = await db.collection("blogs").doc(fixed).get();
  if (fixedSnap.exists) return fixed;

  // なければ従来どおり「最新 compare」を探す
  const snap = await db
    .collection("blogs")
    .where("siteId", "==", siteId)
    .where("type", "==", "compare")
    .orderBy("updatedAt", "desc")
    .limit(1)
    .get();

  if (snap.empty) return "compare-latest";
  const v = String(snap.docs[0].get("slug") ?? "compare-latest");
  return v || "compare-latest";
}

async function pickCompetitors(
  db: Firestore,
  siteId: string,
  excludeOfferId: string,
  limit: number
): Promise<ServiceLite[]> {
  const snap = await db
    .collection("offers")
    .where("siteIds", "array-contains", siteId)
    .where("archived", "==", false)
    .limit(20)
    .get();

  const items = snap.docs
    .filter((d) => d.id !== excludeOfferId)
    .slice(0, Math.max(limit, 2))
    .map((d) => {
      const title = String(d.get("title") ?? "サービス");
      const slug = `${siteId}-${sanitizeId(d.id)}`;
      return {
        name: title,
        slug,
        affiliateUrl: String(d.get("affiliateUrl") ?? ""),
        oneLiner: `${title.slice(0, 18)}のレンタルに対応`,
      } as ServiceLite;
    });

  while (items.length < limit) {
    items.push({
      name: "他社サービス",
      slug: "compare-latest",
      affiliateUrl: "",
      oneLiner: "比較記事で全体像を確認",
    });
  }
  return items.slice(0, limit);
}

/** タグに入れたくないワード（小文字比較） */
const TAG_BLOCKLIST = new Set([
  "service",
  "services",
  "offer",
  "offers",
  "a8",
  "rakuten",
  "amazon",
  "http",
  "https",
  "www",
  "kasite",
]);

function splitCompositeTag(s: string): string[] {
  const raw = String(s || "").trim();
  if (!raw) return [];
  const spaced = raw.replace(/[:;|/,\t]+/g, " ");
  const decomp = spaced.replace(/[-_]{2,}/g, " ");
  const compact = decomp.replace(/\s{2,}/g, " ").trim();
  return compact.split(" ");
}

function normalizeTagText(s: string): string {
  return s
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[「」『』“”"']/g, " ")
    .replace(/[^\w\u3040-\u30FF\u4E00-\u9FFF\s-]/g, " ")
    .replace(/[-\s]+/g, " ")
    .trim();
}

function isBlockedTag(t: string): boolean {
  const lower = t.toLowerCase();
  return TAG_BLOCKLIST.has(lower);
}
function looksLikeIdFragment(t: string): boolean {
  if (/^[a-f0-9]{6,}$/i.test(t)) return true;
  if (/^s\d{5,}$/i.test(t)) return true;
  if (/^\d{1,4}$/.test(t)) return true;
  if (/^[a-z]{2,5}\d{2,}$/i.test(t)) return true;
  return false;
}
function isTooShortOrDigitsOnly(t: string): boolean {
  if (t.length < 2) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^[A-Za-z0-9]{1,3}$/.test(t)) return true;
  return false;
}
function dedupeCaseInsensitive(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}
function extractPhrases(s: string): string[] {
  const text = s
    .replace(/【[^】]*】/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const tokens = text.split(/\s+/);
  const out = new Set<string>();
  for (const tok of tokens) {
    const t = tok.trim();
    if (!t) continue;
    const j = t.replace(/[^\u3040-\u30FF\u4E00-\u9FFFA-Za-z0-9]/g, "");
    if (!j) continue;
    if (j.length < 2) continue;
    if (/^[A-Za-z0-9]{1,3}$/.test(j)) continue;
    if (isBlockedTag(j)) continue;
    out.add(j);
  }
  const joined = text.replace(/\s+/g, "");
  if (/レンタル/.test(joined)) out.add("レンタル");
  return Array.from(out);
}

function buildFallbackTags(hints: string[] = []): string[] {
  const joined = hints.join(" ").trim();
  const base = normalizeTagText(joined);
  const bucket = new Set<string>();
  extractPhrases(base).forEach((p) => bucket.add(p));
  if (![...bucket].some((t) => /口コミ/.test(t))) bucket.add("口コミ");
  if (![...bucket].some((t) => /評判/.test(t))) bucket.add("評判");
  if (/家電|家具|レンタル|サービス/.test(base)) bucket.add("レンタル");
  const out = [...bucket]
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !looksLikeIdFragment(t))
    .filter((t) => !isTooShortOrDigitsOnly(t));
  return out.slice(0, 5);
}

function sanitizeTags(input: unknown, fallbackHints: string[] = []): string[] {
  const inArr = Array.isArray(input) ? input : [];
  let cleaned = inArr
    .flatMap((t) => splitCompositeTag(String(t ?? "")))
    .map((t) => normalizeTagText(t))
    .filter(Boolean)
    .filter((t) => !isBlockedTag(t))
    .filter((t) => !looksLikeIdFragment(t))
    .filter((t) => !isTooShortOrDigitsOnly(t));

  cleaned = dedupeCaseInsensitive(cleaned);

  if (cleaned.length < 2) {
    const fb = buildFallbackTags(fallbackHints);
    cleaned = dedupeCaseInsensitive([...cleaned, ...fb]);
  }

  cleaned = cleaned
    .map((t) => (t.length > 40 ? t.slice(0, 40) : t))
    .slice(0, 8);
  return cleaned;
}

/** summary / content / title からハイライトを生成（BlogCard とほぼ同じロジック） */
function buildHighlightFromText(
  summary?: string | null,
  content?: string | null,
  title?: string | null
): string | null {
  const base =
    (summary && summary.trim()) ||
    (content && content.replace(/\s+/g, " ").trim()) ||
    (title && title.trim()) ||
    "";

  if (!base) return null;

  const firstSentence = (base.split(/[。！？!?]/)[0] || base).trim();
  const limit = 26;
  return firstSentence.length > limit
    ? `${firstSentence.slice(0, limit)}…`
    : firstSentence;
}

/* ========= Main ========= */

export async function generateBlogFromOffer(opts: {
  offerId: string;
  siteId: string;
  keyword?: string;
  dryRun?: boolean;
  publish?: boolean;
  intent?: IntentId;
  templateId?: TemplateId;
  variantId?: VariantId;
  modules?: string[];
}) {
  const {
    offerId,
    siteId,
    keyword = "",
    dryRun,
    publish = true,
    intent = "service",
    templateId,
    variantId = "pros-cons",
    modules: modulesInput,
  } = opts;

  const db = getFirestore();

  // 季節・行事のコンテキスト（日本時間）
  const seasonal = getSeasonalContext();

  // サイト表示名
  const siteCfg = await getSiteConfig(siteId).catch(() => null);
  const siteDisplay =
    typeof siteCfg?.displayName === "string" && siteCfg.displayName
      ? siteCfg.displayName
      : siteId;

  // 1) offer / program
  const offerSnap = await db.collection("offers").doc(offerId).get();
  if (!offerSnap.exists) throw new Error(`offer not found: ${offerId}`);
  const offer = offerSnap.data() as OfferDoc;

  const programSnap = await db
    .collection("programs")
    .doc(offer.programId)
    .get();
  // 1-1) companyType（living / gadget / trial）を取得
  const companyType =
    offer.profile?.companyType === "living" ||
    offer.profile?.companyType === "gadget" ||
    offer.profile?.companyType === "trial"
      ? offer.profile.companyType
      : undefined;
  const program = (
    programSnap.exists ? (programSnap.data() as ProgramDoc) : {}
  ) as ProgramDoc;

  // 2) creatives
  const creatives: Creative[] = Array.isArray(offer.creatives)
    ? offer.creatives
    : [];
  const ctaBanner =
    (creatives.find((c) => c.type === "banner" && c.size === "300x250") as
      | Extract<Creative, { type: "banner" }>
      | undefined) ||
    (creatives.find((c) => c.type === "banner") as
      | Extract<Creative, { type: "banner" }>
      | undefined);
  const ctaText = creatives.find((c) => c.type === "text") as
    | Extract<Creative, { type: "text" }>
    | undefined;

  // 3) template vars (service)
  const serviceName = offer.title;
  const officialUrl = program.officialUrl ?? offer.landingUrl ?? "";
  const affiliateUrl =
    offer.affiliateUrl ?? ctaText?.href ?? ctaBanner?.href ?? officialUrl;

  const competitorList: ServiceLite[] = await pickCompetitors(
    db,
    siteId,
    offerId,
    2
  );
  const compareSlug = await pickLatestCompareSlug(db, siteId);

  const serviceVars = {
    name: serviceName,
    officialUrl,
    affiliateUrl,
    area: offer.extras?.area || (offer.extras?.areas?.join(" / ") ?? "全国"),
    minTerm: offer.extras?.minTerm ?? "30日〜",
    planExamplesCsv: "",
    deliveryNote: offer.extras?.timeSlot
      ? `時間指定: ${offer.extras.timeSlot}`
      : offer.extras?.deliveryDays?.length
      ? `配送日: ${offer.extras.deliveryDays.join("・")}`
      : "公式要確認",
    pickupNote: offer.extras?.pickupNote ?? "",
    setupNote: offer.extras?.setupNote ?? "",
    support: "不具合時は交換対応（要公式確認）",
    categoriesCsv: Array.isArray(offer.category)
      ? offer.category.join(", ")
      : "",
    campaignNote: "",
    reviewSummary: offer.description ? offer.description.slice(0, 120) : "",
    shortId: sanitizeId(offerId).slice(-10),
  };

  const competitorVars = competitorList
    .map((c) => ({ name: c.name, slug: c.slug }))
    .slice(0, 2);
  while (competitorVars.length < 2)
    competitorVars.push({ name: "他社", slug: "compare-latest" });

  // 4) 角度（variant）に応じてプロンプトへヒント注入
  const angle = angleNotes(variantId);

  // ★ ここから：キーワード決定ロジック
  let targetKeyword = keyword.trim();

  // keyword が未指定の場合、companyType に応じたプールから自動で1つ選ぶ
  // 例:
  //  - living → keywordPools.service_living
  //  - gadget → keywordPools.service_gadget
  //  - trial  → keywordPools.service_trial
  if (!targetKeyword) {
    let poolKeyPrefix: string | undefined;

    if (intent === "service" && companyType) {
      poolKeyPrefix = `service_${companyType}`; // sites/kariraku.json の keywordPools のキー
    }

    try {
      const picked = await pickBestKeywordForSite({
        siteId,
        intent: intent as KeywordIntentId,
        avoidHours: 12,
        ...(poolKeyPrefix ? { poolKeyPrefix } : {}),
      });

      if (picked?.keyword) {
        targetKeyword = picked.keyword.trim();
      }
    } catch (e) {
      logger.error("pickBestKeywordForSite failed", {
        siteId,
        intent,
        companyType,
        error: (e as Error)?.message,
      });
    }
  }

  const persona = targetKeyword
    ? "検索で比較や選び方を知りたい人（購入前）"
    : "買わずに短期で使いたい人（設置/回収も任せたい）";

  const painBase = [
    "料金比較",
    "選び方",
    "口コミ",
    "他社比較",
    "初期費用を抑えたい",
  ];
  if (variantId === "speed-setup") painBase.unshift("最短で使いたい");
  if (variantId === "safety-trust") painBase.unshift("故障時の安心感");
  const pain = painBase.join("・");

  // 5) generate（intent / templateId に応じてテンプレ決定）
  const {
    title: genTitle,
    excerpt,
    tags,
    content,
  } = await generateBlogContent({
    siteId,
    siteName: siteDisplay,
    product: { name: serviceName, asin: offerId, tags: offer.tags ?? [] },
    persona,
    pain,
    templateName: resolveTemplateNameForOffer({
      siteId,
      intent,
      templateId,
    }),
    vars: {
      // キーワード・角度ヒント
      targetKeyword,
      variantNote: angle.noteText,
      __angle_rules: angle.noteText,
      __angle_modules: (modulesInput?.length
        ? modulesInput
        : ANGLES[variantId].modules
      ).join(","),
      __force_sections:
        "季節の背景/向いている人/向かない人/買う場合との比較/メリット/デメリット/比較表/選び方/FAQ/内部リンク/CTA",
      // 季節・行事コンテキスト
      seasonKeyword: seasonal.keyword,
      seasonLabel: seasonal.label,
      seasonContext: seasonal.description,
      // 共通メタ
      advertiser: program.advertiser ?? "",
      affiliateUrl,
      // service.*
      "service.name": serviceVars.name,
      "service.affiliateUrl": serviceVars.affiliateUrl,
      "service.officialUrl": serviceVars.officialUrl,
      "service.area": serviceVars.area,
      "service.minTerm": serviceVars.minTerm,
      "service.planExamplesCsv": serviceVars.planExamplesCsv,
      "service.deliveryNote": serviceVars.deliveryNote,
      "service.pickupNote": serviceVars.pickupNote,
      "service.setupNote": serviceVars.setupNote,
      "service.support": serviceVars.support,
      "service.categoriesCsv": serviceVars.categoriesCsv,
      "service.campaignNote": serviceVars.campaignNote,
      "service.reviewSummary": serviceVars.reviewSummary,
      "service.shortId": serviceVars.shortId,
      // competitors.*
      "competitors.0.name": competitorVars[0].name,
      "competitors.0.slug": competitorVars[0].slug,
      "competitors.1.name": competitorVars[1].name,
      "competitors.1.slug": competitorVars[1].slug,
      // compare
      compareSlug,
    },
  });

  // 6) slug（企業記事は offerId ベースの固定 slug）
  const now = Date.now();
  const slug = serviceBlogSlug(siteId, offerId);

  const blogRef = db.collection("blogs").doc(slug);
  const existingSnap = await blogRef.get();

  // 既存記事があれば createdAt / views / publishedAt を引き継ぐ
  let createdAt = now;
  let views = 0;
  let publishedAt: number | undefined;

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

  if (publish && !publishedAt) {
    publishedAt = now;
  }

  // 7) 画像
  // service 記事は「企業の画像」を最優先にする
  const preferUnsplash =
    intent === "service"
      ? false
      : Boolean(siteCfg?.images?.preferUnsplashHero) || false;

  let imageUrl: string | null = null;
  let imageCredit: string | null = null;
  let imageCreditLink: string | null = null;

  // offers 側の候補をできるだけ広く拾う
  const bannerFromCreative =
    (ctaBanner?.imgSrc && String(ctaBanner.imgSrc)) || null;

  const offerFallback =
    offer.heroImage ||
    offer.imageUrl ||
    bannerFromCreative ||
    (offer.images?.[0] ?? null);

  async function tryUnsplashFirst(): Promise<boolean> {
    const query = [siteId, program.advertiser, offer.title, targetKeyword]
      .filter(Boolean)
      .join(" ");
    const hero = await findUnsplashHero(query || "家電 レンタル");
    if (hero?.url) {
      imageUrl = hero.url;
      imageCredit = hero.credit || null;
      imageCreditLink = hero.creditLink || null;
      return true;
    }
    return false;
  }

  if (preferUnsplash) {
    // （今後 compare / guide 用で使う想定）
    const ok = await tryUnsplashFirst();
    if (!ok) {
      imageUrl = offerFallback;
    }
  } else {
    // service 記事はまず企業画像 → なければ Unsplash
    imageUrl = offerFallback;
    if (!imageUrl) {
      await tryUnsplashFirst();
    }
  }

  // 8) 保存用の整形（ここも途中までは元のまま）
  const cleanedContent = stripPlaceholders(content);
  const cleanedTags = sanitizeTags(
    (Array.isArray(tags) && tags.length ? tags : offer.tags) || [],
    [
      genTitle || "",
      serviceName || "",
      program.advertiser || "",
      targetKeyword,
    ].filter(Boolean) as string[]
  );

  const anglePrefix = angle.h1Prefix ?? "";
  const finalTitle =
    (anglePrefix ? `${anglePrefix}${genTitle || ""}` : genTitle) ||
    `${offer.title}｜${program.advertiser ?? ""}`.replace(/｜$/, "");

  const summaryText =
    excerpt ?? (offer.description ? offer.description.slice(0, 120) : null);

  const highlight = buildHighlightFromText(
    summaryText,
    cleanedContent,
    finalTitle
  );

  const baseDoc = {
    slug,
    siteId,
    title: finalTitle,
    summary: summaryText,
    content: cleanedContent,
    highlight: highlight ?? null,
    imageUrl,
    imageCredit: imageCredit ?? null,
    imageCreditLink: imageCreditLink ?? null,
    offerId,
    advertiser: program.advertiser ?? null,
    source: "a8-offer",
    status: publish ? ("published" as const) : ("draft" as const),
    visibility: "public" as const,
    tags: cleanedTags,
    createdAt, // ← ここで既存値 or now
    updatedAt: now,
    ...(publishedAt != null ? { publishedAt } : {}),
    views, // ← ここも既存値 or 0
    type: "service" as const,
    intent,
    variantId,
    modules:
      modulesInput && modulesInput.length
        ? modulesInput
        : ANGLES[variantId].modules,
    targetKeyword: targetKeyword || null,
  };

  // templateId が undefined / null のときはフィールド自体を入れない
  const doc = {
    ...baseDoc,
    ...(templateId != null ? { templateId } : {}),
  } as const;

  if (dryRun) {
    logger.info(`[DRYRUN] blog slug=${slug}`, { doc });
    return { slug, preview: doc };
  }

  await db.collection("blogs").doc(slug).set(doc, { merge: true });
  logger.info(
    `generateBlogFromOffer: created blogs/${slug} from offer ${offerId}`
  );
  return { slug };
}
