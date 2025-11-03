// firebase/functions/src/jobs/content/generateBlogFromOffer.ts
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { a8BlogSlug } from "../../lib/slug/a8.js";
import { findUnsplashHero } from "../../services/unsplash/client.js";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { stripPlaceholders } from "../../utils/markdown.js";
import type { Firestore } from "firebase-admin/firestore";

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

/* ========= Helpers ========= */

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9:_-]/g, "");
}

async function pickLatestCompareSlug(
  db: Firestore,
  siteId: string
): Promise<string> {
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

/* ========= Main ========= */
export async function generateBlogFromOffer(opts: {
  offerId: string;
  siteId: string;
  keyword?: string; // ★ キーワード起点
  dryRun?: boolean;
  publish?: boolean;
}) {
  const { offerId, siteId, keyword = "", dryRun, publish = true } = opts;
  const db = getFirestore();

  // 1) offer / program
  const offerSnap = await db.collection("offers").doc(offerId).get();
  if (!offerSnap.exists) throw new Error(`offer not found: ${offerId}`);
  const offer = offerSnap.data() as OfferDoc;

  const programSnap = await db
    .collection("programs")
    .doc(offer.programId)
    .get();
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

  // 4) generate (キーワード有無で出力トーンを切替)
  const targetKeyword = keyword.trim();
  const persona = targetKeyword
    ? "検索で比較/選び方を知りたい人（購入前）"
    : "家電は買うより借りたい時に迷っている人";
  const pain = targetKeyword
    ? "料金比較・選び方・口コミ・他社比較・初期費用を抑えたい"
    : "短期だけ必要・初期費用は抑えたい・設置/回収まで任せたい";

  const siteDisplay = "Kariraku（カリラク）";
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
    templateName: "blogTemplate_kariraku_service.txt",
    vars: {
      // 既存の service.* / competitors.* / compareSlug に加えてキーワード情報を注入
      targetKeyword, // ← テンプレから使える（タイトル/見出しに織り込むヒント）
      __force_sections: "比較表/選び方/おすすめ/FAQ/内部リンク/CTA",
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
      "competitors.0.name": competitorVars[0].name,
      "competitors.0.slug": competitorVars[0].slug,
      "competitors.1.name": competitorVars[1].name,
      "competitors.1.slug": competitorVars[1].slug,
      compareSlug,
    },
  });

  // 5) slug（キーワードがあれば先頭に混ぜて重複を避ける）
  const now = Date.now();
  const titleForSlug = targetKeyword
    ? `${targetKeyword} ${genTitle || offer.title}`
    : genTitle || offer.title;
  const slug = a8BlogSlug(siteId, offerId, titleForSlug, now);

  const existing = await getFirestore().collection("blogs").doc(slug).get();
  if (existing.exists) {
    logger.info(`generateBlogFromOffer: already exists blogs/${slug}`);
    return { slug, existed: true as const };
  }

  // 6) 画像
  let imageUrl: string | null =
    offer.imageUrl ??
    offer.heroImage ??
    ctaBanner?.imgSrc ??
    offer.images?.[0] ??
    null;
  let imageCredit: string | null = null;
  let imageCreditLink: string | null = null;

  if (!imageUrl) {
    const query = [siteId, program.advertiser, offer.title, targetKeyword]
      .filter(Boolean)
      .join(" ");
    const hero = await findUnsplashHero(query || "家電 レンタル");
    if (hero?.url) {
      imageUrl = hero.url;
      imageCredit = hero.credit || null;
      imageCreditLink = hero.creditLink || null;
    }
  }

  // 7) 保存
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

  const doc = {
    slug,
    siteId,
    title:
      genTitle ||
      `${offer.title}｜${program.advertiser ?? ""}`.replace(/｜$/, ""),
    summary:
      excerpt ?? (offer.description ? offer.description.slice(0, 120) : null),
    content: cleanedContent,
    imageUrl,
    imageCredit: imageCredit ?? null,
    imageCreditLink: imageCreditLink ?? null,
    offerId,
    advertiser: program.advertiser ?? null,
    source: "a8-offer",
    status: publish ? ("published" as const) : ("draft" as const),
    visibility: "public" as const,
    tags: cleanedTags,
    createdAt: now,
    updatedAt: now,
    ...(publish ? { publishedAt: now } : {}),
    views: 0,
    type: "service" as const,
    targetKeyword: targetKeyword || null, // ★ 追記：検索キーワードを保持
  };

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
